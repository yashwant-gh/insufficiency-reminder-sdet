const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = "http://localhost:3005";

let browser;

test.before(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
});

test.after(async () => {
  await browser.close();
});

// BUG 1: UI filter is not applied
test("status filter should actually filter the table", async () => {
  const page = await browser.newPage();

  await page.goto(BASE_URL);

  await page.locator("#status-filter").selectOption("OPEN");

  await new Promise(resolve => setTimeout(resolve, 200));

  const statuses = await page
    .locator("#insuff-body tr td:nth-child(3)")
    .allTextContents();

  assert.deepEqual(
    statuses.map(status => status.trim()),
    ["OPEN", "OPEN"]
  );

  await page.close();
});

// BUG 10: Resolve action does not update the UI
test("Resolve should update an OPEN insufficiency in the UI", async () => {
  const page = await browser.newPage();

  await page.goto(BASE_URL);

  const priyaRow = page
    .locator("#insuff-body tr")
    .filter({ hasText: "Priya Sharma" });

  await priyaRow
    .locator('button[data-action="resolve"]')
    .click();

  await new Promise(resolve => setTimeout(resolve, 200));

  const status = await priyaRow
    .locator("td:nth-child(3)")
    .innerText();

  assert.equal(status.trim(), "RESOLVED");

  await page.close();
});

// BUG 11: Status badge colors are reversed
test("status badges should use the correct colors", async () => {
  const page = await browser.newPage();

  await page.goto(BASE_URL);

  const openBadge = page
    .locator("#insuff-body tr")
    .filter({ hasText: "Ravi Kumar" })
    .locator(".badge");

  const resolvedBadge = page
    .locator("#insuff-body tr")
    .filter({ hasText: "Amit Verma" })
    .locator(".badge");

  const openColor = await openBadge.evaluate(
    el => getComputedStyle(el).backgroundColor
  );

  const resolvedColor = await resolvedBadge.evaluate(
    el => getComputedStyle(el).backgroundColor
  );

  // OPEN should have the warning/orange background.
  // RESOLVED should have the green background.
  assert.equal(openColor, "rgb(255, 231, 223)");
  assert.equal(resolvedColor, "rgb(231, 246, 236)");

  await page.close();
});

// BUG 13: User supplied HTML is not sanitized
test("user supplied HTML should be sanitized", async () => {
  const page = await browser.newPage();

  await page.goto(BASE_URL);

  const malicious =
    "<img src=x onerror=\"document.body.dataset.xss='true'\">";

  await page.locator("#candidate-name").fill(malicious);
  await page.locator("#reason").fill("Test reason");

  await page.locator("#add-form button[type='submit']").click();

  await new Promise(resolve => setTimeout(resolve, 300));

  // Reload so the newly-created record is rendered by the table.
  await page.reload();

  await new Promise(resolve => setTimeout(resolve, 300));

  const xssTriggered = await page.evaluate(
    () => document.body.dataset.xss === "true"
  );

  assert.equal(xssTriggered, false);

  await page.close();
});