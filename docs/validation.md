# Validation

Verified September 12, 2026.

## Automated checks

`npm test`: **20 passing tests** covering calendar arithmetic, cadence and due-date boundaries, sparse history, same-day orders, follow-up scheduling, later purchases, computed totals, CSV round trips, duplicate orders, conflicting account details, invalid dates and currency, malformed CSV, size limits, and spreadsheet formula escaping.

`npm run check`: JavaScript syntax checks passed for the application, domain rules, and CSV handling.

## Browser checks

- Opened the seeded queue and reviewed account details and order history.
- Logged an activity with a future follow-up. The account moved from the active queue to Scheduled; the visible queue count changed from seven to six.
- Refreshed the page and verified the saved change remained.
- Pasted invalid CSV and verified an explanatory validation error appeared without replacing the workspace.
- Pasted a valid three-order dataset, inspected the preview, confirmed replacement, and verified its calculated account value and persistence after refresh.
- Reset the workspace and verified the original 16-account / 96-order dataset returned.
- Reviewed the interface at 390 px mobile, 810 px intermediate, and 1440 px desktop widths. The page had no horizontal document overflow at the tested widths. Mobile account details remained readable and usable.
- Checked captured browser console output: no application errors or warnings were present at the end of the local validation pass.

## WebMCP contract

Verified registration of `view_reorder_queue` with its expected schema and read-only/untrusted-content annotations. An empty object returned the current queue. A valid account ID opened the same account-details view as the interface. An unknown account ID failed intentionally without replacing the dataset.

## Scope of evidence

These checks demonstrate prototype behavior, not production readiness or business impact. No company system, real customer data, automatic outreach, conversion rate, revenue improvement, or multi-user operation was tested.
