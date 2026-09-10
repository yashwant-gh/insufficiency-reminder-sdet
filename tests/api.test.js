const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:3005";

async function reset() {
  const res = await fetch(`${BASE_URL}/api/reset`, {
    method: "POST"
  });

  assert.equal(res.status, 200);
}

test.beforeEach(async () => {
  await reset();
});

// BUG 2
test("reminder response should contain the updated reminder count", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  const body = await res.json();

  assert.equal(res.status, 200);

  // Priya starts at 2, so response should contain 3
  assert.equal(body.reminderCount, 3);
});

// BUG 3
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

  assert.deepEqual(
    upper.map(item => item.id),
    lower.map(item => item.id)
  );
});

// BUG 4
test("reminder should be rejected for a RESOLVED insufficiency", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/3/remind`,
    { method: "POST" }
  );

  assert.equal(res.status, 400);
});

// BUG 5
test("reminder for nonexistent ID should return 404", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/9999/remind`,
    { method: "POST" }
  );

  assert.equal(res.status, 404);
});

// BUG 6
test("resolve for nonexistent ID should return 404", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies/9999/resolve`,
    { method: "PATCH" }
  );

  assert.equal(res.status, 404);
});

// BUG 7
test("candidateName is required", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reason: "Test reason"
      })
    }
  );

  assert.equal(res.status, 400);
});

// BUG 8
test("new insufficiency should have reminderCount 0", async () => {
  const res = await fetch(
    `${BASE_URL}/api/insufficiencies`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        candidateName: "Test Candidate",
        reason: "Test reason"
      })
    }
  );

  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.status, "OPEN");
  assert.equal(body.reminderCount, 0);
});

// BUG 9
test("reminder count must not exceed 3", async () => {
  // Priya starts at 2.
  const first = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  assert.equal(first.status, 200);

  // Count is now 3. This request should be rejected.
  const second = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  assert.equal(second.status, 400);

  const getRes = await fetch(
    `${BASE_URL}/api/insufficiencies`
  );

  const items = await getRes.json();
  const priya = items.find(item => item.id === 2);

  assert.equal(priya.reminderCount, 3);
});

// BUG 12
test("reaching the reminder cap should return the exact cap error message", async () => {
  // Priya starts with reminderCount = 2.
  // First reminder moves it to 3.
  const first = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  assert.equal(first.status, 200);

  // Second reminder is attempted while count is already 3.
  const second = await fetch(
    `${BASE_URL}/api/insufficiencies/2/remind`,
    { method: "POST" }
  );

  const body = await second.json();

  assert.equal(second.status, 400);
  assert.equal(body.error, "Reminder cap reached");
});