# Finance workflows

Stage 6 migrates financial workflows one vertical slice at a time. All finance
records are organization-scoped and all monetary values use PostgreSQL
`numeric(18,2)` through Prisma `Decimal`; JavaScript floating-point values are
never persisted.

## Sales

The `/sales` workspace preserves the legacy sales table and adds responsive
cards for narrow screens. Staff can list and create organization sales.
Employees can edit sales allocated to their own profile, while managers and
super administrators can edit any organization sale and choose the allocated
staff member. Permanent deletion remains management-only.

The server calculates `profit = receivedAmount - netPrice`. Client-side profit
display is only a preview and is never trusted for persistence. Related staff
members and leads are checked against the active organization before a write,
and employees may only link leads assigned to them.

Create, update, and delete operations run transactionally with an audit-log
entry. Audit metadata stores monetary snapshots as fixed two-decimal strings.

## Cash book

The `/cashbook` workspace preserves the separate Amounts In and Amounts Out
views while adding one responsive workflow for search, date, direction, and
payment-type filters. The list is capped at 30 records per page and uses a
look-ahead row instead of a separate count query. Today, month, and year net
balances are calculated by one PostgreSQL query in the business timezone.

Staff can create entries. Employees are always recorded as themselves, while
managers and super administrators may select another active staff member.
Every selected project and staff profile is checked against the active
organization. Cheque and online entries require a reference number. New
records receive stable `CASH-...` display IDs derived from their UUID, and
legacy records without a UID receive the same deterministic display fallback.

Amounts are parsed directly into Prisma `Decimal`. Creation and its audit log
are committed as one atomic transaction after independent relationship checks
run concurrently. Permanent deletion is management-only and is also audited.

## Vouchers

The `/vouchers` workspace provides organization-scoped search, project and
status filters, 30-row pagination, responsive tables/cards, and role-aware
visibility. Employees only see vouchers allocated to them; managers and super
administrators can view the organization and allocate vouchers to active staff.

Voucher totals are parsed as `Decimal`, and `remaining = total - paid` is
calculated on the server. Creating a voucher also creates its approval request,
manager notifications, and audit record in the same transaction. Accepting or
rejecting the approval updates the voucher and approval together so their
statuses cannot drift. Only accepted vouchers expose the dedicated print view,
which is formatted for browser printing or Save as PDF. Deletion remains
management-only and audited.

## Refunds

Refund requests start from an accessible lead so employees cannot submit a
request against another employee's client. The form preserves the legacy
branch, customer, CNIC, phone, amount, and reason fields while storing amounts
as exact `Decimal` values. Only one request per lead may await a decision at a
time; the lead flag is reserved and the refund, approval, manager
notifications, and audit record are committed in one transaction.

Managers and super administrators decide refund approvals through the shared
approval workflow. A rejection closes the request and releases the lead for a
future request. An acceptance additionally creates an organization-scoped
cashbook `OUT` entry for the exact refund amount. The refund decision,
cashbook entry, approval status, requester notification, lead flag, and audit
records are atomic, so a partial financial decision cannot be persisted.

The `/refunds` workspace provides organization management with search, status
filters, counts, decision links, and 30-row pagination. Employees see only
requests they submitted. PostgreSQL RLS mirrors that requester/management
boundary for Data API access.

## Payroll transcripts

The management-only `/payroll` workspace replaces the legacy salary transcript
screen with server-calculated payroll. Deduction amounts are stored as
effective-dated policy versions instead of overwriting one mutable setting.
Each salary month resolves the policy active on the first day of that month.

Transcript creation validates the active organization employee, prevents a
second transcript for the same employee and month, and calculates late-arrival,
half-day, and day-off deductions with Prisma `Decimal`. The browser preview is
informational; only the server result is persisted. Calculation rates and
deduction totals are captured in the transactional audit record so the
printable salary slip retains its historical breakdown after rates change.

The workspace includes employee and month filters, search, aggregate gross/net
figures, pagination, audited deletion, and a responsive print/Save as PDF view.
RLS restricts policy changes and transcript writes to management while allowing
an authenticated staff profile to read only its own transcript rows through
the Data API.

## Remaining Stage 6 work

- Import and reconcile legacy sales against MongoDB.
- Import and reconcile legacy cashbook entries and balance totals.
- Import and reconcile legacy vouchers, then verify printed documents.
- Add live role/RLS acceptance tests and reconcile finance totals.
