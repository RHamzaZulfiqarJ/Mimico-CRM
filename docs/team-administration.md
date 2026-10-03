# Team administration

The `/team` workspace is restricted to managers and super admins. It provisions Supabase Auth invitations together with CRM profiles and organization memberships.

## Security rules

- The Supabase secret key is read only by the server-side admin client and is never included in browser code.
- Managers can assign client, employee, or manager roles. Only a super admin can assign or modify a super-admin membership.
- Administrators cannot change or deactivate their own membership.
- Serializable database transactions prevent concurrent requests from demoting or deactivating the final active manager/super admin.
- Deactivation changes only the organization membership. It preserves the Auth identity, other organization memberships, related CRM records, and audit history.
- Existing Auth-linked profiles can be added to another organization without creating a duplicate identity.
- New invitations use compensating cleanup: if profile/membership creation fails after the Auth invitation, the newly created Auth user is deleted. A cleanup failure is surfaced for manual intervention.
- Invitation retries reconcile a confirmed Supabase Auth user that has no CRM
  profile/membership. This recovers partial historical invitations without
  deleting the Auth identity; the employee then uses Forgot Password to choose
  a password. Unconfirmed orphan identities are reported for manual cleanup so
  they are never linked silently.
- Every successful invitation, role change, deactivation, and reactivation creates an audit record.

Invitation delivery and Auth cleanup require `SUPABASE_SECRET_KEY`. Live behavior must be integration-tested in development before invitations are enabled for real users.

Invitation redirects use `/auth/complete/invite`, which accepts the session
format produced by both default Supabase templates and the documented SSR
token-hash template. The invited employee must create a password and then sign
in normally; an existing administrator session in the browser is replaced and
cannot skip password setup.

Supabase delivery errors are mapped to actionable messages for managers. Rate
limits and SMTP/recipient restrictions are distinguished from identity
conflicts instead of being collapsed into a generic invitation failure.
