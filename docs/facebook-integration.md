# Facebook Lead Ads integration

The management-only `/integrations/facebook` workspace stores Facebook page
identifiers and environment-variable names. It never stores verify tokens, app
secrets, or page access tokens in PostgreSQL.

## Configure a page

1. Add the page and app IDs in `/integrations/facebook`.
2. Add the referenced variables to the deployment environment. The defaults are
   `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_APP_SECRET`, and
   `FACEBOOK_PAGE_ACCESS_TOKEN`.
3. Copy the generated callback URL into the Meta webhook configuration.
4. Use the value of `FACEBOOK_VERIFY_TOKEN` as Meta's verify token.
5. Subscribe the page to the `leadgen` field and send a test lead.

After adding the deployment secrets, use **Test connection** beside the
configured page. The server calls Graph API with the Page token and confirms
that the returned Page ID matches the saved Page ID. The token is never sent to
the browser.

`FACEBOOK_GRAPH_API_VERSION` is optional and defaults to `v23.0`. Set it to a
supported version such as `v23.0` when upgrading the Meta app.

## Security and delivery

- Verification tokens and webhook signatures use timing-safe comparison.
- POST requests require a valid `X-Hub-Signature-256` HMAC generated with the
  app secret.
- Lead details are fetched server-side from Graph API and the access token is
  never returned to the browser.
- Provider lead IDs are unique per organization, so webhook retries are
  idempotent.
- Each new lead creates a 24-hour inbound record, one claim for each active
  staff member, staff notifications, and an audit record.
- Apply the latest `supabase/rls.sql` after deployment so integration metadata
  remains management-only through the Supabase Data API.

## Staff inbox and conversion

Signed webhook deliveries create one pending claim for every active staff
member. Staff can open `/leads/facebook`, review their available enquiries, and
either:

- decline only their own claim, leaving the enquiry available to other staff;
  or
- claim and convert the enquiry into a normal CRM lead.

Claiming and conversion run in one database transaction. The inbound row is
conditionally claimed before the CRM lead is created, so two staff members
cannot successfully claim the same enquiry. The winning employee becomes the
CRM lead owner, other pending claims are dismissed, and the converted lead
retains the provider ID through the inbound record and audit log.

Pending enquiries stop being claimable after 24 hours. The inbox treats elapsed
records as expired even before a maintenance job persists the `EXPIRED` status.

## Expiry maintenance

Set `FACEBOOK_MAINTENANCE_SECRET` to a server-only value containing at least 32
characters. An external scheduler should call
`GET /api/jobs/facebook-maintenance` once per hour with this header:

```text
Authorization: Bearer <FACEBOOK_MAINTENANCE_SECRET>
```

`POST` is supported as well. The idempotent job marks elapsed pending inbound
leads as expired, dismisses only their still-pending claims, and writes a
per-organization audit record. Conditional updates prevent it from expiring a
lead that another employee is claiming concurrently.

Use the same bearer secret to call `GET /api/jobs/facebook-health` once per day.
It validates every active Page token, confirms that each token belongs to the
expected Page ID, and creates a deduplicated warning for managers when a secret
is missing, rejected, or connected to the wrong Page. Provider tokens and raw
Graph errors are never stored in notifications or audit metadata.

Automatic Page-token renewal remains later integration work, together with live
Meta webhook acceptance testing.
