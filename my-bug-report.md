# My bug report — 05

You reported 13 confirmed bugs. For Phase 2, write an automated test that FAILS because of each one — fixing them is an optional bonus.

## 1. UI — ui-filter-not-applied

Issue: Changing the UI status dropdown filter from "All" to "OPEN" or "RESOLVED" fails to filter the records displayed in the table. Resolved entries (e.g., Amit Verma) remain visible even when filtering strictly for OPEN status.
Expected vs actual: Expected: Selecting a status filter (e.g., OPEN) should filter the table to display only records matching that status.

Actual: The status filter has no effect, and all rows remain visible regardless of the selected dropdown option.

## 2. POST /api/insufficiencies/:id/remind — stale-or-mismatched-aggregate

Issue: After triggering a reminder action, the UI and API reflect inconsistent reminder counts/states (e.g., UI displays 1 while API returns reminderCount: 0).
Expected vs actual: Expected: The UI reminder count and the API response state should immediately synchronize and accurately reflect the persisted aggregate count.

Actual: The UI displays 1 while the API returns reminderCount: 0, causing state desynchronization between the frontend display and the backend response.

## 3. GET /api/insufficiencies — case-sensitivity-mismatch

Issue: Status filter is case-sensitive when it should be case-insensitive.
Expected vs actual: Expected: ?status=RESOLVED and ?status=resolved should return the same 2 RESOLVED records.
Actual: ?status=RESOLVED returns [], while ?status=resolved correctly returns the 2 RESOLVED records.

## 4. POST /api/insufficiencies/:id/remind — missing-reference-or-state-check

Issue: The API allows sending a reminder for an already RESOLVED insufficiency.
Expected vs actual: Expected: 400 Bad Request
Actual: 200 OK and returns the resolved record.

## 5. POST /api/insufficiencies/:id/remind — wrong-status-code

Issue: Sending a reminder for a nonexistent insufficiency ID returns an internal server error instead of the required not-found response.
Expected vs actual: Expected: HTTP 404 Not Found for a nonexistent ID.
Actual: HTTP 500 Internal Server Error with {"error":"internal error"}.

## 6. PATCH /api/insufficiencies/:id/resolve — wrong-status-code

Issue: Resolving a nonexistent insufficiency ID returns a successful response instead of reporting that the resource was not found.
Expected vs actual: Expected: HTTP 404 Not Found for nonexistent ID.
Actual: HTTP 200 OK with the full insufficiency list.

## 7. POST /api/insufficiencies — missing-required-field

Issue: The API accepts an insufficiency creation request when the required candidateName field is missing.
Expected vs actual: Expected: HTTP 400 Bad Request when candidateName is missing.
Actual: HTTP 200/201 success response and a record is created without candidateName.

## 8. POST /api/insufficiencies — wrong-persisted-default

Issue: A newly created insufficiency gets reminderCount: 1 instead of the required default 0.
Expected vs actual: Expected: 201 Created with status: "OPEN" and reminderCount: 0
Actual: 201 Created with reminderCount: 1

## 9. POST /api/insufficiencies/:id/remind — off-by-one-boundary

Issue: Reminder count exceeds the maximum allowed value of 3. Sending a reminder when the count is already 3 increases the persisted count to 4.
Expected vs actual: Expected: Count must remain 3 and request should be rejected with 400.
Actual: Request returns 200, and GET shows reminderCount: 4.

## 10. UI — missing-ui-feedback-guard

Issue: The Resolve action in the UI is non-functional. Clicking Resolve on an OPEN insufficiency produces no visible change and does not update the record.
Expected vs actual: Expected:
Clicking Resolve should mark the insufficiency as RESOLVED and immediately update the row/badge without requiring a page reload.

Actual:
Clicking Resolve does nothing; the status remains OPEN and the UI provides no feedback.

## 11. UI — wrong-status-badge-color

Issue: The status badge colors are mapped incorrectly in the UI. OPEN records are displayed with a green badge, while RESOLVED records are displayed with an orange/pink badge.
Expected vs actual: Expected: OPEN should use a warning-style color (orange/yellow) and RESOLVED should use a success-style color (green). Actual: OPEN is shown in green and RESOLVED is shown in orange/pink, which reverses the intended status color mapping.

## 12. POST /api/insufficiencies/:id/remind — wrong-ui-copy-or-label

Issue: At cap, API says "Cannot send more reminders" instead of exact "Reminder cap reached"
Expected vs actual: This was not at all expected

## 13. POST /api/insufficiencies — missing-sanitization

Issue: sanitization
Try <script>alert(1)</script> or HTML in candidate/reason and inspect stored/displayed value
Expected vs actual: not expected outcome

