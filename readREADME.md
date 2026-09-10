# Insufficiency Reminder — SDET Phase 2

## Overview

This repository contains my Phase 2 submission for the Insufficiency Reminder application.

The objective of Phase 2 was to:

1. Investigate the supplied application.
2. Reproduce and understand the reported bugs.
3. Write automated tests that catch those bugs.
4. Run the tests locally and verify the failures.
5. Fix bugs as an optional bonus.
6. Keep the test suite as regression coverage for the reported issues.

A separate bug report containing the 13 confirmed bugs is also included in this repository.

---

# Application Under Test

The application is an "Insufficiency Reminders" web application.

It contains functionality for:

- Viewing insufficiency records
- Filtering records by status
- Adding new insufficiencies
- Sending reminders
- Resolving insufficiencies
- Tracking reminder counts

The application exposes REST API endpoints as well as a browser-based UI.

---

# Bug Investigation

I first explored the application manually and reproduced the reported issues through the UI and API.

For API-related issues, I used Postman to send requests with different inputs, IDs, statuses, and boundary values.

For UI-related issues, I interacted with the application in the browser and checked whether the visible state matched the expected backend state.

After reproducing the issues, I mapped each bug to the relevant API endpoint or UI behavior and created an automated regression test for it.

The detailed bug report is available in:

`my-bug-report.md`

---

# Confirmed Bugs

A total of 13 bugs were confirmed.

## 1. UI — Status filter not applied

Changing the status dropdown did not actually filter the records displayed in the table.

### Expected

Selecting `OPEN` should display only OPEN records.

### Actual

All records remained visible.

### Test

`status filter should actually filter the table`

---

## 2. POST /api/insufficiencies/:id/remind — Stale reminder count

The reminder API response returned a reminder count that did not match the updated persisted count.

### Expected

The response should contain the updated reminder count.

### Actual

The response was one count behind the persisted value.

### Test

`reminder response should contain the updated reminder count`

---

## 3. GET /api/insufficiencies — Case-sensitive status filtering

The status filter behaved differently depending on the capitalization of the supplied status.

### Expected

`RESOLVED` and `resolved` should produce the same result.

### Actual

`RESOLVED` returned no records while `resolved` worked.

### Test

`status filtering should be case-insensitive`

---

## 4. POST /api/insufficiencies/:id/remind — Reminder allowed for resolved record

The API allowed reminders to be sent for an already resolved insufficiency.

### Expected

The request should be rejected with HTTP 400.

### Actual

The request returned HTTP 200.

### Test

`reminder should be rejected for a RESOLVED insufficiency`

---

## 5. POST /api/insufficiencies/:id/remind — Wrong status for nonexistent ID

Sending a reminder for a nonexistent record resulted in an internal server error.

### Expected

HTTP 404 Not Found.

### Actual

HTTP 500 Internal Server Error.

### Test

`reminder for nonexistent ID should return 404`

---

## 6. PATCH /api/insufficiencies/:id/resolve — Wrong status for nonexistent ID

Resolving a nonexistent record returned a successful response.

### Expected

HTTP 404 Not Found.

### Actual

HTTP 200 OK.

### Test

`resolve for nonexistent ID should return 404`

---

## 7. POST /api/insufficiencies — Missing required field

The API accepted a new insufficiency without a `candidateName`.

### Expected

HTTP 400 Bad Request.

### Actual

The record was accepted without the required field.

### Test

`candidateName is required`

---

## 8. POST /api/insufficiencies — Incorrect default reminder count

Newly created insufficiencies started with `reminderCount: 1`.

### Expected

New records should start with `reminderCount: 0`.

### Actual

New records started with `reminderCount: 1`.

### Test

`new insufficiency should have reminderCount 0`

---

## 9. POST /api/insufficiencies/:id/remind — Reminder cap off-by-one

The reminder limit was intended to be 3.

### Expected

When the count is already 3, another reminder should be rejected and the count should remain 3.

### Actual

Another reminder was accepted and the persisted count could increase beyond the limit.

### Test

`reminder count must not exceed 3`

---

## 10. UI — Resolve action did not update the UI

Clicking Resolve successfully triggered the backend request, but the UI did not refresh to show the new status.

### Expected

The row should immediately show `RESOLVED`.

### Actual

The UI continued showing `OPEN`.

### Test

`Resolve should update an OPEN insufficiency in the UI`

---

## 11. UI — Incorrect status badge colors

The status badge classes were mapped in the opposite way.

### Expected

- OPEN → warning/orange style
- RESOLVED → success/green style

### Actual

The styles were reversed.

### Test

`status badges should use the correct colors`

---

## 12. POST /api/insufficiencies/:id/remind — Incorrect reminder cap message

When the reminder cap was reached, the API returned the wrong error message.

### Expected

`Reminder cap reached`

### Actual

`Cannot send more reminders`

### Test

`reaching the reminder cap should return the exact cap error message`

---

## 13. POST /api/insufficiencies — Missing sanitization / XSS

User-controlled candidate names and reasons were inserted into the page without proper sanitization.

HTML/script payloads could therefore be interpreted by the browser.

### Expected

User-provided HTML should be treated as text.

### Actual

The values could be interpreted as HTML.

### Test

`user supplied HTML should be sanitized`

---

# Phase 2 Automated Tests

The automated tests were written using Node's built-in test runner and Playwright.

The API tests send requests directly to the application and verify:

- HTTP status codes
- Response bodies
- Persisted state
- Validation behavior
- Boundary conditions
- Error messages

The UI tests use Playwright with Chrome to verify:

- Status filtering
- Resolve behavior
- Badge styling
- Handling of user-supplied HTML

---

# Test Results

The final test suite contains:

**13 tests**

Current result:

| Result | Count |
|---|---:|
| Passing | 11 |
| Failing | 2 |
| Total | 13 |

The 11 passing tests cover bugs that were fixed during the optional bonus phase.

The remaining 2 failing tests are both related to the reminder-cap behavior:

1. `reminder count must not exceed 3`
2. `reaching the reminder cap should return the exact cap error message`

These failures are intentionally documented rather than hidden.

They demonstrate that the regression tests are still able to detect the remaining reminder-cap defect.

---

# Optional Bug Fixes

After creating the tests, I fixed a number of the reported issues as the optional bonus.

The fixes included:

- Applying the selected status filter to the API request from the UI.
- Correcting the reminder response count.
- Making status filtering case-insensitive.
- Rejecting reminders for resolved insufficiencies.
- Returning 404 for nonexistent reminder IDs.
- Returning 404 for nonexistent resolve IDs.
- Validating the required `candidateName` field.
- Setting the initial reminder count to 0.
- Correcting the Resolve UI refresh behavior.
- Correcting OPEN and RESOLVED badge styling.
- Correcting the reminder-cap error message.
- Preventing user-supplied HTML from being interpreted by the browser.

The reminder-cap behavior remains unresolved and is represented by the two failing regression tests.

---

# Why Some Tests Pass and Others Fail

The purpose of the Phase 2 tests is to provide regression coverage for the bugs discovered in the application.

Initially, the tests were written against the buggy behavior and were expected to fail.

After fixing the bugs as the optional bonus, those same tests began passing.

The two reminder-cap tests continue to fail because that defect has not been fully resolved.

This README intentionally documents both the original defects and the current test state so that the work is transparent.

---

# Tools Used

- **VS Code** — editing application code and writing automated tests.
- **Postman** — manually testing API endpoints and reproducing backend bugs.
- **Node.js built-in test runner** — executing the automated API and UI test files.
- **Playwright** — browser automation and UI regression testing.
- **Google Chrome** — browser executable used by Playwright.
- **PowerShell** — running the application, tests, and development commands.
- **Git** — version control and maintaining the test/fix history.
- **GitHub** — repository hosting and submission.

---

# Running the Application

Install dependencies:

```bash
npm install
