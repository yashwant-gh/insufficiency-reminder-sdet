async function loadList() {
  // BUG (UI): status filter dropdown value is never sent to the API — always fetches everything
  const res = await fetch("/api/insufficiencies");
  const items = await res.json();
  renderList(items);
}

function renderList(items) {
  const body = document.getElementById("insuff-body");
  body.innerHTML = "";

  items.forEach((item) => {
    const tr = document.createElement("tr");

    const isResolved = item.status === "RESOLVED";
    // BUG (UI): badge class mapping is inverted (OPEN gets the "resolved" green class, RESOLVED gets the "open" rust class)
    const badgeClass = isResolved ? "badge-open" : "badge-resolved";

    const atCap = item.reminderCount >= 3;

    tr.innerHTML = `
      <td>${item.candidateName}</td>
      <td>${item.reason}</td>
      <td><span class="badge ${badgeClass}">${item.status}</span></td>
      <td>${item.reminderCount + 1}</td>
      <td class="row-actions">
        <button data-action="remind" data-id="${item.id}">Send Reminder</button>
        <button data-action="resolve" data-id="${item.id}">Resolve</button>
      </td>
    `;

    // BUG (UI): "Send Reminder" button is never disabled, even once reminderCount hits the cap (3)
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
  await fetch(`/api/insufficiencies/${id}/remind`, { method: "POST" });
  loadList();
}

async function resolveItem(id) {
  // BUG (UI): fires the request but never reloads the list, so the badge/status
  // in the table stays stale until the page is manually refreshed
  await fetch(`/api/insufficiencies/${id}/resolve`, { method: "PATCH" });
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
    // BUG (UI): new item never appears without a manual page reload — list isn't refreshed here
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
