const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:3005";

async function reset() {
  const res = await fetch(`${BASE_URL}/api/reset`, {
    method: "POST",
  });

  assert.equal(res.status, 200);
}

test.beforeEach(async () => {
  await reset();
});


// ============================================================
// BUG 2: stale-or-mismatched-aggregate
// ============================================================

test("reminder response should contain the updated reminder count", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  const body = await res.json();

  assert.equal(res.status, 200);

  // Priya starts with reminderCount = 2.
  // After one reminder, the updated count should be 3.
  assert.equal(body.reminderCount, 3);
});


// ============================================================
// BUG 3: case-sensitivity-mismatch
// ============================================================

test("status filtering should be case-insensitive", async () => {
  const upperRes = await fetch(
    `${BASE_URL}/api/insufficiencies?status=RESOLVED`
  );

  const lowerRes = await fetch(
    `${BASE_URL}/api/insufficiencies?status=resolved`
  );

  const upper = await upperRes.json();
  const lower = await lowerRes.json();

  assert.equal(upperRes.status, 200);
  assert.equal(lowerRes.status, 200);

  // Both uppercase and lowercase queries should return
  // the same RESOLVED records.
  assert.deepEqual(
    upper.map((item) => item.id),
    lower.map((item) => item.id)
  );
});


// ============================================================
// BUG 4: missing-reference-or-state-check
// ============================================================

test("reminder should be rejected for a RESOLVED insufficiency", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/3/remind`,
    { method: "POST" }
  );

  // ID 3 is RESOLVED in the seed data.
  // A reminder should therefore be rejected.
  assert.equal(res.status, 400);
});


// ============================================================
// BUG 5: wrong-status-code
// ============================================================

test("reminder for nonexistent ID should return 404", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/9999/remind`,
    { method: "POST" }
  );

  // The requested insufficiency does not exist.
  assert.equal(res.status, 404);
});


// ============================================================
// BUG 6: wrong-status-code
// ============================================================

test("resolve for nonexistent ID should return 404", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/9999/resolve`,
    { method: "PATCH" }
  );

  // The requested insufficiency does not exist.
  assert.equal(res.status, 404);
});


// ============================================================
// BUG 7: missing-required-field
// ============================================================

test("candidateName is required", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: "Test reason",
      }),
    }
  );

  // candidateName is missing, so the request should be rejected.
  assert.equal(res.status, 400);
});


// ============================================================
// BUG 8: wrong-persisted-default
// ============================================================

test("new insufficiency should have reminderCount 0", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        candidateName: "Test Candidate",
        reason: "Test reason",
      }),
    }
  );

  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.status, "OPEN");

  // A newly created insufficiency must start with zero reminders.
  assert.equal(body.reminderCount, 0);
});


// ============================================================
// BUG 9: off-by-one-boundary
// ============================================================

test("reminder count must not exceed 3", async () => {
  // Priya starts with reminderCount = 2.

  const first = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  assert.equal(first.status, 200);

  const firstBody = await first.json();

  // First reminder: 2 -> 3.
  assert.equal(firstBody.reminderCount, 3);

  // The count is already at the cap.
  // Another reminder must therefore be rejected.
  const second = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  assert.equal(second.status, 400);

  // Verify the persisted value did not exceed the cap.
  const getRes = await fetch(
    `${BASE_URL}/api/insufficiencies`
  );

  const items = await getRes.json();

  const priya = items.find((item) => item.id === 2);

  assert.equal(priya.reminderCount, 3);
});


// ============================================================
// BUG 12: wrong-ui-copy-or-label
// ============================================================

test("reaching the reminder cap should return the exact cap error message", async () => {
  // Priya starts with reminderCount = 2.

  const first = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  assert.equal(first.status, 200);

  // Count is now 3.
  // Another reminder should hit the cap.
  const second = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  const body = await second.json();

  assert.equal(second.status, 400);

  // Verify the exact required error message.
  assert.equal(body.error, "Reminder cap reached");
});