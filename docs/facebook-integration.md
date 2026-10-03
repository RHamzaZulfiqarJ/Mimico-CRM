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

The employee inbox and conversion workflow are the next integration slice.
