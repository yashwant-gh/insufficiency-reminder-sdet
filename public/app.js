async function loadList() {
  // Send the selected status to the API so the table shows only
  // records matching the user's current filter.
  const filter = document.getElementById("status-filter").value;

  const url = filter
    ? `/api/insufficiencies?status=${encodeURIComponent(filter)}`
    : "/api/insufficiencies";

  const res = await fetch(url);
  const items = await res.json();

  renderList(items);
}

function renderList(items) {
  const body = document.getElementById("insuff-body");
  body.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");

    const isResolved = item.status === "RESOLVED";

    // OPEN uses the warning/orange style and RESOLVED uses the
    // green style defined in the stylesheet.
    const badgeClass = isResolved ? "badge-resolved" : "badge-open";

    const atCap = item.reminderCount >= 3;

    // Build the cells separately instead of inserting user-provided
    // values into innerHTML. This prevents candidate names and reasons
    // containing HTML or script from being interpreted by the browser.
    const nameCell = document.createElement("td");
    nameCell.textContent = item.candidateName;

    const reasonCell = document.createElement("td");
    reasonCell.textContent = item.reason;

    const statusCell = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${badgeClass}`;
    badge.textContent = item.status;
    statusCell.appendChild(badge);

    const countCell = document.createElement("td");
    countCell.textContent = item.reminderCount + 1;

    const actionsCell = document.createElement("td");
    actionsCell.className = "row-actions";

    const remindButton = document.createElement("button");
    remindButton.dataset.action = "remind";
    remindButton.dataset.id = item.id;
    remindButton.textContent = "Send Reminder";

    const resolveButton = document.createElement("button");
    resolveButton.dataset.action = "resolve";
    resolveButton.dataset.id = item.id;
    resolveButton.textContent = "Resolve";

    actionsCell.appendChild(remindButton);
    actionsCell.appendChild(resolveButton);

    tr.appendChild(nameCell);
    tr.appendChild(reasonCell);
    tr.appendChild(statusCell);
    tr.appendChild(countCell);
    tr.appendChild(actionsCell);

    body.appendChild(tr);
  });

  body.querySelectorAll("button[data-action=remind]").forEach((btn) => {
    btn.addEventListener("click", () => sendReminder(btn.dataset.id));
  });

  body.querySelectorAll("button[data-action=resolve]").forEach((btn) => {
    btn.addEventListener("click", () => resolveItem(btn.dataset.id));
  });
}

async function sendReminder(id) {
  await fetch(`/api/insufficiencies/${id}/remind`, {
    method: "POST"
  });

  await loadList();
}

async function resolveItem(id) {
  await fetch(`/api/insufficiencies/${id}/resolve`, {
    method: "PATCH"
  });

  // Refresh the table after the backend update so the new status
  // is immediately visible to the user.
  await loadList();
}

document.getElementById("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const candidateName = document.getElementById("candidate-name").value;
  const reason = document.getElementById("reason").value;
  const messageEl = document.getElementById("add-message");

  const res = await fetch("/api/insufficiencies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateName, reason })
  });

  if (res.ok) {
    messageEl.textContent = "Insufficiency added.";
    messageEl.className = "message success";

    document.getElementById("candidate-name").value = "";
    document.getElementById("reason").value = "";
  } else {
    messageEl.textContent = "Failed to add insufficiency.";
    messageEl.className = "message error";
  }
});

document.getElementById("status-filter").addEventListener("change", loadList);


// --- Tooling: reset button (utility only, not part of the app under test) ---

function showToast(msg) {
  let toast = document.getElementById("__toast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "__toast";

    toast.style.cssText =
      "position:fixed;bottom:20px;right:20px;background:#333;color:#fff;padding:10px 16px;" +
      "border-radius:4px;font-family:sans-serif;z-index:9999;opacity:0;transition:opacity .2s;";

    document.body.appendChild(toast);
  }

  toast.textContent = msg;
  toast.style.opacity = "1";

  clearTimeout(toast.__timer);

  toast.__timer = setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}

document.getElementById("reset-btn").addEventListener("click", async () => {
  await fetch("/api/reset", { method: "POST" });

  document.getElementById("candidate-name").value = "";
  document.getElementById("reason").value = "";
  document.getElementById("add-message").textContent = "";
  document.getElementById("status-filter").value = "";

  await loadList();

  showToast("Data reset");
});

loadList();