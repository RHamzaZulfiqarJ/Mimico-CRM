# CRM data model

## Design contract

The PostgreSQL model in `prisma/schema.prisma` is the target contract for the first migration rehearsal. It deliberately preserves business behavior while correcting MongoDB structures that would be unsafe or inefficient in PostgreSQL.

- Every business record belongs to an `Organization` through `organizationId`.
- Supabase Auth owns credentials. `Profile.authUserId` optionally links a CRM person to `auth.users`; CRM clients do not need a login.
- `OrganizationMembership` is the source of truth for the four existing roles: `client`, `employee`, `manager`, and `super_admin`.
- `Client` is a CRM/customer record. An optional `portalProfileId` links it to a signed-in portal user.
- Migrated records retain an immutable, unique `legacyMongoId` wherever a legacy document exists. Import scripts must upsert by this field.
- MongoDB ID arrays are represented by relations. Lead allocation uses `LeadAssignment`; follow-ups and inventory use their owning foreign keys.
- Monetary values use `Decimal(18,2)`. Phone, CNIC, cheque, and reference values remain strings so leading zeroes are preserved.
- Business timestamps use `timestamptz`; calendar-only dates use PostgreSQL `date`.
- Uploads move to Supabase Storage. `Attachment` stores bucket/object metadata and the previous path for reconciliation.
- Integration secrets are represented only by secret names. Raw Facebook tokens and app secrets must be moved to a server-side secret store.
- `AuditLog` is append-only application history and is separate from user notifications.

The first deployment can seed one organization. Multi-tenant ownership is present now so tenant isolation does not need to be retrofitted later.

## Legacy model mapping

| Mongo model | Target | Migration notes |
| --- | --- | --- |
| `approval` | `Approval` | Normalize requester/decider/lead relations; retain truly variable detail in `payload`. |
| `cashbook` | `CashbookEntry` | Normalize lead/project/staff links; parse amount as decimal and date as timestamp. |
| `deductions` | `PayrollDeductionPolicy` | Store policy values with an effective date instead of one mutable global document. |
| `employee` | `Profile`, `OrganizationMembership` | Merge with matching users; do not create a second identity or password store. |
| `event` | `CalendarEvent` | Normalize owner and start/end timestamps. Invalid or missing ranges go to the import exception report. |
| `facebook` | `FacebookIntegration` | Migrate identifiers only; replace raw secrets with secret references. |
| `facebookEvent` | `Notification` or `AuditLog` | Classify each legacy event by whether it is user-facing or historical; preserve the original document ID. |
| `facebookLead` | `FacebookInboundLead`, `FacebookLeadClaim` | Preserve provider/raw payload; replace each user's embedded claim event with a claim row. |
| `followUp` | `FollowUp` | Link directly to one lead and creator; parse follow-up dates to timestamps. |
| `inventory` | `Inventory` | Link to project and optional owner; parse price as decimal. |
| `lead` | `Lead`, `LeadAssignment`, `Attachment` | Replace `allocatedTo`, `followUps`, and image arrays with relations. Resolve the duplicate legacy client field during extraction. |
| `notification` | `Notification` | Normalize recipient and optional approval; convert read state to `readAt`. |
| `otp` | Not migrated | Supabase Auth recovery/verification replaces custom OTP documents; expired codes are discarded. |
| `project` | `Project` | Link to society; inventory is derived from `Inventory.projectId`, not a duplicated ID array. |
| `refund` | `Refund` | Normalize lead/requester/decider and store amount as decimal. |
| `sale` | `Sale` | Normalize lead/staff; convert net, received, and profit values to decimals. |
| `society` | `Society`, `Attachment` | Society images become Storage objects plus attachment metadata. |
| `task` | `Task` | Collapse the paired legacy new/completed field sets into status, outcome, and completion fields; retain ambiguous source data in `legacyPayload`. |
| `transcript` | `PayrollTranscript` | Normalize employee link and pay period; convert salary fields to decimals. |
| `user` | `Profile`, `OrganizationMembership`, optionally `Client` | Supabase Auth owns login credentials; staff role belongs to membership and CRM customers become client rows. |
| `voucher` | `Voucher` | Normalize project/assignee; preserve phone/CNIC as strings and money as decimals. |

## Import order

1. Seed the organization.
2. Import profiles, Auth mappings, memberships, and CRM clients.
3. Import societies, projects, inventories, and attachments.
4. Import leads, assignments, follow-ups, and lead attachments.
5. Import tasks, calendar events, approvals, and notifications.
6. Import finance and payroll records.
7. Import Facebook integration metadata, inbound leads, and claims.
8. Reconcile counts, rejected rows, foreign keys, duplicate legacy IDs, and financial totals.

Each importer must be restartable, must never match solely by mutable values such as email or phone, and must write rejected/ambiguous records to a review report instead of silently coercing them.

## Database invariants

Prisma foreign keys guarantee entity existence, but server code must also verify that every related record belongs to the same organization before writing. `organizationId`, acting profile IDs, and role must be derived from the authenticated membership rather than accepted from a form or request body.

The generated initial migration must be reviewed and applied to an empty development database before any legacy export is loaded. RLS is applied afterward from `supabase/rls.sql`.
