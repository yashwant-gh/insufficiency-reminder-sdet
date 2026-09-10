const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 3005;

// -----------------------------------------------------------------------------
// Fix-track gate
// -----------------------------------------------------------------------------
// The /spec endpoint is hidden once Phase 2 opens. The scoreboard state is
// cached briefly so a temporary scoreboard failure does not affect the app.
const SCOREBOARD_URL = (
  process.env.SCOREBOARD_URL ||
  "https://sv-qa-scoreboard.onrender.com"
).replace(/\/+$/, "");

let fixTrackCache = {
  open: false,
  timestamp: 0,
};

async function isFixTrackOpen() {
  if (typeof fetch !== "function") {
    return false;
  }

  if (Date.now() - fixTrackCache.timestamp < 20000) {
    return fixTrackCache.open;
  }

  try {
    const response = await fetch(`${SCOREBOARD_URL}/api/fix-track`);
    const data = await response.json();

    fixTrackCache = {
      open: data && data.open === true,
      timestamp: Date.now(),
    };
  } catch (error) {
    // Keep the previous state if the scoreboard cannot be reached.
  }

  return fixTrackCache.open;
}

const app = express();


// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type,Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});


// -----------------------------------------------------------------------------
// Optional HTTP Basic Authentication
// -----------------------------------------------------------------------------

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || null;

app.use((req, res, next) => {
  if (!ACCESS_PASSWORD) {
    return next();
  }

  const authorization = req.headers.authorization || "";
  const [scheme, encodedCredentials] = authorization.split(" ");

  const decodedCredentials = encodedCredentials
    ? Buffer.from(encodedCredentials, "base64").toString()
    : "";

  const password = decodedCredentials.split(":")[1];

  if (scheme !== "Basic" || password !== ACCESS_PASSWORD) {
    res.set(
      "WWW-Authenticate",
      'Basic realm="SV QA Challenge"'
    );

    return res
      .status(401)
      .send("Auth required. Ask the interviewer for the link.");
  }

  next();
});


// -----------------------------------------------------------------------------
// Application setup
// -----------------------------------------------------------------------------

app.use(express.json());

const { perStudentStore } = require("./isolation");
const { makeSeed } = require("./data");

app.use(perStudentStore(makeSeed));
app.use(express.static(path.join(__dirname, "public")));

const REMINDER_CAP = 3;


// ============================================================================
// GET /api/insufficiencies
// ============================================================================

app.get("/api/insufficiencies", (req, res) => {
  const { status } = req.query;

  if (!status) {
    return res.json(req.store.insufficiencies);
  }

  // The API accepts status values without requiring a particular case.
  // Normalising both values prevents "RESOLVED" and "resolved" from
  // producing different results.
  const normalizedStatus = status.toLowerCase();

  const result = req.store.insufficiencies.filter(
    (item) => item.status.toLowerCase() === normalizedStatus
  );

  res.json(result);
});


// ============================================================================
// POST /api/insufficiencies
// ============================================================================

app.post("/api/insufficiencies", (req, res) => {
  const { candidateName, reason } = req.body;

  // Both fields are required and must contain meaningful string values.
  // This prevents incomplete or whitespace-only records from entering
  // the application state.
  if (
    typeof candidateName !== "string" ||
    typeof reason !== "string" ||
    candidateName.trim() === "" ||
    reason.trim() === ""
  ) {
    return res.status(400).json({
      error: "candidateName and reason are required",
    });
  }

  // Kept unchanged from the supplied application. This audit ID is currently
  // reserved even though the audit log is not wired into the application.
  const auditId = req.store.nextId++;

  const item = {
    id: req.store.nextId++,
    candidateName,
    reason,
    status: "OPEN",
    createdAt: new Date().toISOString(),

    // A newly created insufficiency has not received any reminders yet.
    reminderCount: 0,
  };

  req.store.insufficiencies.push(item);

  res.status(201).json(item);
});


// ============================================================================
// POST /api/insufficiencies/:id/remind
// ============================================================================

app.post("/api/insufficiencies/:id/remind", (req, res) => {
  const item = req.store.insufficiencies.find(
    (entry) => entry.id === Number(req.params.id)
  );

  // A missing record is a client-visible "not found" condition rather than
  // an application error.
  if (!item) {
    return res.status(404).json({
      error: "Insufficiency not found",
    });
  }

  // Reminders only apply to active insufficiencies. Once the record has been
  // resolved, sending another reminder is no longer a valid operation.
  if (item.status === "RESOLVED") {
    return res.status(400).json({
      error: "Cannot remind a resolved insufficiency",
    });
  }

  // The cap represents the maximum number of reminders that may be stored.
  // Checking >= before incrementing prevents a fourth reminder from being
  // created when the current count is already 3.
  if (item.reminderCount >= REMINDER_CAP) {
    return res.status(400).json({
      error: "Reminder cap reached",
    });
  }

  item.reminderCount += 1;

  // Return the same updated value that has been persisted in the store.
  // This keeps the API response consistent with subsequent GET requests.
  res.json({
    id: item.id,
    candidateName: item.candidateName,
    status: item.status,
    reminderCount: item.reminderCount,
  });
});


// ============================================================================
// PATCH /api/insufficiencies/:id/resolve
// ============================================================================

app.patch("/api/insufficiencies/:id/resolve", (req, res) => {
  const item = req.store.insufficiencies.find(
    (entry) => entry.id === Number(req.params.id)
  );

  // Resolving a record that does not exist should return a proper
  // resource-not-found response.
  if (!item) {
    return res.status(404).json({
      error: "Insufficiency not found",
    });
  }

  item.status = "RESOLVED";

  // Preserve the original response contract used by the application.
  res.json(req.store.insufficiencies);
});


// ============================================================================
// Test/reset utility
// ============================================================================

app.post("/api/reset", (req, res) => {
  req.resetStore();

  res.json({
    ok: true,
  });
});


// ============================================================================
// Spec rendering helpers
// ============================================================================

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMarkdown(md) {
  const esc = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const inline = (value) =>
    esc(value)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^\*]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2">$1</a>'
      );

  const lines = md.split("\n");
  const output = [];

  let index = 0;

  const flushList = (buffer, tag) => {
    if (buffer.length) {
      output.push(
        `<${tag}>` +
          buffer
            .map((item) => `<li>${inline(item)}</li>`)
            .join("") +
          `</${tag}>`
      );

      buffer.length = 0;
    }
  };

  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(/^```(\w*)/);

    if (fence) {
      const code = [];

      index++;

      while (
        index < lines.length &&
        !/^```/.test(lines[index])
      ) {
        code.push(lines[index]);
        index++;
      }

      index++;

      output.push(
        `<pre><code>${esc(code.join("\n"))}</code></pre>`
      );

      continue;
    }

    if (
      /^\s*\|.*\|\s*$/.test(line) &&
      index + 1 < lines.length &&
      /-/.test(lines[index + 1]) &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1])
    ) {
      const cells = (row) =>
        row
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());

      const header = cells(line);

      index += 2;

      let table =
        "<table><thead><tr>" +
        header
          .map((cell) => `<th>${inline(cell)}</th>`)
          .join("") +
        "</tr></thead><tbody>";

      while (
        index < lines.length &&
        /^\s*\|.*\|\s*$/.test(lines[index])
      ) {
        table +=
          "<tr>" +
          cells(lines[index])
            .map((cell) => `<td>${inline(cell)}</td>`)
            .join("") +
          "</tr>";

        index++;
      }

      output.push(table + "</tbody></table>");

      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);

    if (heading) {
      const level = heading[1].length;

      output.push(
        `<h${level}>${inline(heading[2])}</h${level}>`
      );

      index++;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      output.push("<hr>");
      index++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const buffer = [];

      while (
        index < lines.length &&
        /^\s*[-*]\s+/.test(lines[index])
      ) {
        buffer.push(
          lines[index].replace(/^\s*[-*]\s+/, "")
        );

        index++;
      }

      flushList(buffer, "ul");
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const buffer = [];

      while (
        index < lines.length &&
        /^\s*\d+\.\s+/.test(lines[index])
      ) {
        buffer.push(
          lines[index].replace(/^\s*\d+\.\s+/, "")
        );

        index++;
      }

      flushList(buffer, "ol");
      continue;
    }

    if (line.trim() === "") {
      index++;
      continue;
    }

    const paragraph = [];

    while (
      index < lines.length &&
      lines[index].trim() !== "" &&
      !/^(#{1,6}\s|```|\s*[-*]\s|\s*\d+\.\s)/.test(
        lines[index]
      ) &&
      !/^\s*\|.*\|\s*$/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index++;
    }

    output.push(
      `<p>${inline(paragraph.join(" "))}</p>`
    );
  }

  return output.join("\n");
}


// ============================================================================
// Spec page styling
// ============================================================================

const SPEC_CSS = `
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;background:#f6f7f9;color:#1c2024;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:820px;margin:0 auto;padding:32px 24px 80px}
.back{display:inline-block;margin-bottom:20px;color:#0b63e5;text-decoration:none;font-size:14px}
.back:hover{text-decoration:underline}
h1{font-size:28px;margin:.4em 0 .3em;line-height:1.25}
h2{font-size:20px;margin:1.6em 0 .4em;padding-bottom:.3em;border-bottom:1px solid #e3e6ea}
h3{font-size:16px;margin:1.3em 0 .3em}
p{margin:.6em 0}
a{color:#0b63e5}
code{background:#eceef1;padding:.12em .4em;border-radius:4px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
pre{background:#0f1720;color:#e6edf3;padding:16px;border-radius:8px;overflow-x:auto;font-size:13px;line-height:1.5}
pre code{background:none;padding:0;color:inherit}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:14px;display:block;overflow-x:auto}
th,td{border:1px solid #dfe3e8;padding:8px 12px;text-align:left;vertical-align:top}
th{background:#eef1f4;font-weight:600}
tr:nth-child(even) td{background:#fafbfc}
ul,ol{margin:.6em 0;padding-left:1.5em}
li{margin:.25em 0}
hr{border:0;border-top:1px solid #e3e6ea;margin:2em 0}
@media (prefers-color-scheme:dark){
 body{background:#0d1117;color:#c9d1d9}
 h2{border-color:#21262d}
 code{background:#1b2028}
 th{background:#161b22}
 th,td{border-color:#21262d}
 tr:nth-child(even) td{background:#0f141a}
 hr{border-color:#21262d}
 .back,a{color:#4c9ffe}
}
`;


// ============================================================================
// Spec endpoint
// ============================================================================

function reqBaseUrl(req) {
  const protocol =
    req.headers["x-forwarded-proto"] ||
    req.protocol ||
    "http";

  return `${protocol}://${req.get("host")}`;
}

app.get("/spec", async (req, res) => {
  if (await isFixTrackOpen()) {
    return res
      .status(403)
      .type("html")
      .send(
        '<!doctype html><meta charset="utf-8">' +
          '<body style="font-family:system-ui,sans-serif;max-width:640px;margin:64px auto;padding:0 20px;line-height:1.6">' +
          "<h2>Spec unavailable during Phase 2</h2>" +
          "<p>The spec is hidden now that the Fix Track is open. Use the app itself and your downloaded bug report to write your tests.</p>" +
          '<p><a href="/">&larr; Back to app</a></p>' +
          "</body>"
      );
  }

  let markdown = "# Spec unavailable";

  try {
    markdown = require("fs").readFileSync(
      path.join(__dirname, "README.md"),
      "utf8"
    );
  } catch (error) {
    // Keep the fallback title when README.md is unavailable.
  }

  markdown = markdown.replace(
    /(https?:\/\/)?localhost:\d+/g,
    reqBaseUrl(req)
  );

  res
    .type("html")
    .send(
      "<!doctype html><html><head>" +
        '<meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        "<title>Spec</title>" +
        `<style>${SPEC_CSS}</style>` +
        "</head><body>" +
        '<div class="wrap">' +
        '<a class="back" href="/">← Back to app</a>' +
        renderMarkdown(markdown) +
        "</div></body></html>"
    );
});


// ============================================================================
// OpenAPI description
// ============================================================================

app.get("/openapi.json", (req, res) => {
  const doc = {
    openapi: "3.0.3",

    info: {
      title: "Insufficiency Reminders API",
      version: "1.0.0",
    },

    servers: [
      {
        url: reqBaseUrl(req),
      },
    ],

    paths: {
      "/api/insufficiencies": {
        get: {
          summary:
            "List insufficiencies, optionally filtered by status",

          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: ["OPEN", "RESOLVED"],
              },
            },
          ],

          responses: {
            "200": {
              description:
                "Array of insufficiency objects",
            },
          },
        },

        post: {
          summary:
            "Create a new OPEN insufficiency",

          requestBody: {
            required: true,

            content: {
              "application/json": {
                schema: {
                  type: "object",

                  properties: {
                    candidateName: {
                      type: "string",
                    },

                    reason: {
                      type: "string",
                    },
                  },

                  required: [
                    "candidateName",
                    "reason",
                  ],
                },

                example: {
                  candidateName: "Asha Rao",
                  reason:
                    "Address proof unclear",
                },
              },
            },
          },

          responses: {
            "201": {
              description:
                "The created insufficiency",
            },
          },
        },
      },

      "/api/insufficiencies/{id}/remind": {
        post: {
          summary:
            "Send a reminder for an OPEN insufficiency (capped at 3)",

          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "integer",
              },
            },
          ],

          responses: {
            "200": {
              description:
                "The updated insufficiency",
            },
          },
        },
      },

      "/api/insufficiencies/{id}/resolve": {
        patch: {
          summary:
            "Mark an insufficiency RESOLVED",

          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "integer",
              },
            },
          ],

          responses: {
            "200": {
              description:
                "Array of all insufficiencies",
            },
          },
        },
      },

      "/api/reset": {
        post: {
          summary:
            "Reset demo data to seed (utility, not part of the app under test)",

          responses: {
            "200": {
              description: "{ ok: true }",
            },
          },
        },
      },
    },
  };

  res.json(doc);
});


// ============================================================================
// Error handling
// ============================================================================

app.use((err, req, res, next) => {
  console.error(
    "handler error:",
    (err && err.stack) || err
  );

  if (!res.headersSent) {
    res.status(500).json({
      error: "internal error",
    });
  }
});

process.on("unhandledRejection", (error) => {
  console.error("unhandledRejection:", error);
});

process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error);
});


// ============================================================================
// Start server
// ============================================================================

app.listen(PORT, () => {
  console.log(
    `insufficiency-reminder listening on port ${PORT}`
  );
});