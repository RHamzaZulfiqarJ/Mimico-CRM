# Supabase Auth setup

The application uses email/password accounts, cookie-based SSR sessions, and server-side token-hash verification. Public registration is intentionally disabled; CRM identities must be provisioned by an administrator or migration script.

## Project configuration

1. Set the Supabase Auth Site URL to the value of `NEXT_PUBLIC_APP_URL`.
2. Add local, staging, and production `/auth/complete/**` and `/auth/confirm`
   URLs to the Auth redirect allow list.
3. Disable public user sign-up.
4. Set the password policy to at least 10 characters. The application additionally requires uppercase, lowercase, and numeric characters when a password is changed.
5. Enable password-change security notifications and configure production SMTP before inviting real users.
6. Add the project secret key as `SUPABASE_SECRET_KEY` only in the server environment. Never expose it through a `NEXT_PUBLIC_` variable.

## Invitation and recovery links

The application passes `/auth/complete/invite` or `/auth/complete/recovery` as
the `redirectTo` URL. It derives the origin from the validated incoming CRM
request and uses `NEXT_PUBLIC_APP_URL` only as a fallback, preventing a stale
deployment hostname from leaking into links created on the production domain.
These browser completion pages support Supabase's default
confirmation links (URL-fragment sessions), PKCE `code` callbacks, and custom
`token_hash` links. They replace any existing browser session before sending
the user to `/update-password`, which is important when an administrator opens
an employee invitation in the same browser.

Previously issued links that redirect to `/auth/confirm` are forwarded to the
browser completion handler so their URL-fragment sessions can still be used,
provided the one-time link has not already been consumed or expired.

The default Supabase Invite user and Reset password templates using
`{{ .ConfirmationURL }}` work with these completion pages. For an SSR-only
token-hash template, link directly to `/auth/confirm` instead.

Use this link in the recovery template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
  Reset password
</a>
```

For the Invite user template:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">
  Accept invitation
</a>
```

Do not place access tokens or refresh tokens in application-generated URLs.
The completion page removes one-time credentials from browser history before
navigating. After a password is saved, the temporary session is signed out and
the user signs in normally with the new password.

## Identity provisioning order

1. Create or invite the Supabase Auth user.
2. Upsert `Profile` using the Auth user UUID in `authUserId`.
3. Upsert an active `OrganizationMembership` with one of the four supported roles.
4. For a client portal user, link the CRM `Client.portalProfileId` to that profile.
5. Verify that `/dashboard` resolves the expected organization and role.

An authenticated user without an active profile/membership is sent to `/access-pending`; authentication alone never grants CRM data access.
