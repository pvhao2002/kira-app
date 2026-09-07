# Personal Overview

The `/app` page uses authenticated, independently loaded read-only sections. No billing cycles, imports, payments, or lessons are mutated by loading this page.

| Endpoint | Response |
| --- | --- |
| `GET /api/v1/dashboards/overview/credit-cards` | `updatedAt`, compact `summary`, `overdue`, `dueToday`, `dueSoon`, `needsInput` |
| `GET /api/v1/dashboards/overview/investments?days=30` | `updatedAt`, `days`, `fromDate`, `toDate`, `activeAccounts`, `currencies`, `review`, `failed` |
| `GET /api/v1/dashboards/overview/tutoring` | `updatedAt`, `weekStart`, `weekEnd`, `lessonCount`, `totalHours`, `totalFee`, `upcoming`, `conflicts` |

All queries are scoped to the principal user and exclude deleted source records. Each attention/upcoming group is `{total, items}` with at most five items; total counts are independent of this limit. Credit rows sort by due date/id; imports by creation/id; lessons/conflicts by date/time. Existing API contracts remain compatible.

## Credit cards

Summary delegates to the existing credit-card dashboard calculation, counting shared bank limits and adjusted balances once per bank. It returns totalCreditLimit, currentBalance, availableCredit, utilizationRate, currency, bankCount, cardCount without an unbounded card list. Existing credit dashboard currency semantics are retained.

Attention uses statement remainingAmount, not statementBalance; unknown amounts are not displayed as zero. Overdue means before today, dueToday is today, dueSoon is after today but before today + 7 days. Paid/cancelled statements and deleted cards/statements are excluded. NEEDS_INPUT is a separate group.

## Investments

Days accepts only 7, 30, 90 (default 30), otherwise HTTP 400 `INVALID_OVERVIEW_PERIOD`. Bounds include today and preceding days in Asia/Ho_Chi_Minh, using a half-open timestamp interval. The SQL day key uses the stored timestamp epoch plus the UTC+7 offset, independent of MySQL session timezone.

Only COMPLETED transactions contribute. Amounts group by transaction currency with daily zero filling. `netDeposits = deposits - withdrawals`, excluding bonuses; it is not profit or portfolio valuation. Active account currencies appear even without activity. Account count includes ACTIVE accounts; transaction history includes non-deleted accounts regardless of activity status.

Review includes READY, READY_WITH_ERRORS, PARTIALLY_CONFIRMED; failed includes FAILED. Import tasks are not restricted by the transaction date filter. Only normalized identifiers, account names and status are returned; no credentials, attachment content or raw AI data. Links use existing accountId/batchId query parameters.

## Tutoring and notifications

Tutoring reuses the resolver for this week and next. Weekly totals exclude cancellations. Upcoming lessons/conflicts cover today through today + 6 days, including ongoing lessons until their end. Fees are expected, not collected income. Other actions open their owning pages.

Notifications reuse `/notifications?page=0&size=5&sort=createdAt,desc` and `/notifications/unread-count`. Opening Overview does not mark notifications read.

## Client behavior

Each section keeps previously loaded data after errors and shows the last successful update time. Rapid period changes cancel earlier requests; retained data labels its actual period. Amount visibility is saved per signed-in user on the device. Hidden mode removes chart bars and amount-bearing tooltips and conceals notification titles. No background polling is introduced.

## Verification

Compile only the affected backend module with Java 25. Do not run tests or UI builds unless requested. Browser checks must use a backend process that has loaded the new endpoints; old processes return section errors until restarted. Verify counts and sums against their owning screens, date/currency boundaries, partial errors, hidden amounts, links, mobile layout and both themes. Do not create financial records merely to populate a preview.
