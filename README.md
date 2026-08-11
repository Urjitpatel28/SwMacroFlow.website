# swmacroflow.in

The SwMacroFlow website: the marketing page, the account pages, and the redirect the desktop
application depends on for Google and Microsoft sign-in.

Plain static HTML. No build step, no framework, no package manager. **Pushing to `main` deploys to
production** — `.github/workflows/static.yml` uploads the repository root to GitHub Pages, so any
`.html` at the root becomes a live route on the next push.

## Pages

| File | Indexed | Purpose |
|---|---|---|
| `index.html` | yes | Landing page |
| `terms.html` | yes | Licence terms — free until 1 Aug 2027, one computer, three device changes |
| `privacy.html` | yes | What is collected and why |
| `login.html` | no | Email/password, Google, Microsoft |
| `signup.html` | no | Account creation and the confirmation email |
| `verify.html` | no | Where the confirmation link lands |
| `reset-password.html` | no | Both halves of the reset on one page |
| `account.html` | no | Plan, active computer, device changes used, **release**, sign out |
| `app-auth.html` | no | The desktop application's OAuth bounce |

```
assets/site.css    tokens, nav, footer, buttons — shared by every page
assets/auth.css    the account pages and the legal pages
assets/auth.js     Supabase client and shared helpers
assets/session.js  swaps Sign in ↔ Account in the nav
assets/config.js   Supabase project URL and anon key
```

## Two pages that carry weight

**`app-auth.html`** is a hard dependency of Google and Microsoft sign-in *in the desktop
application*. SwMacroFlow signs in through the system browser and redirects back to a loopback
socket, but the port is assigned by the operating system, so no fixed entry in Supabase's redirect
allow-list can match it. This page is the one static allow-listed URL in the middle, and its only
job is to forward the code to the port carried in `state`.

That makes it a redirector, and it validates accordingly: the port must be digits only in
1024–65535, the nonce must be hex, and the destination is rebuilt from those validated pieces rather
than taken from the query string. **It deliberately loads nothing** — no stylesheet, no nav, no
modules. GitHub Pages cannot serve a Content-Security-Policy, so on the one page that handles an
authorization code, every script it does not load is one that cannot be turned against it. Do not
"tidy" it to match the other pages.

If it is not deployed, email and password sign-in still works everywhere; both social sign-in
buttons in the application dead-end.

**`account.html`**'s release button is the main way a stuck licence gets freed. Uninstalling
SwMacroFlow does not release a seat — the uninstaller hands off to the Windows installer bundle and
never gets to tell the server anything — so a computer that died, was sold, or was reimaged can only
be released from here. Without it, that is a support ticket every time.

## Before this can go live

1. **Configure custom SMTP in Supabase.** The built-in sender allows **two emails per hour,
   project-wide**; sign-up confirmation and password reset both use it, so the third person to sign
   up in an hour silently receives nothing. Resend or Brevo, plus SPF and DKIM records on
   `swmacroflow.in` or the mail lands in spam.
2. **Fill in `assets/config.js`.** Both values are `REPLACE-ME`, and an auth page with a placeholder
   URL fails at module import — a blank page, not a graceful error.
3. **Allow-list exactly these three** in Supabase → Authentication → URL Configuration:
   `https://swmacroflow.in/app-auth.html`, `/account.html`, `/reset-password.html`.
4. **Deploy `privacy.html` before submitting Google's OAuth consent screen for verification.** It
   requires a reachable privacy policy URL; submitting without one is rejected and the queue starts
   over. Microsoft Entra also wants publisher information, and the app registration must be
   multi-tenant **and** personal accounts or personal Microsoft accounts are refused.

### The anon key is meant to be public

`assets/config.js` is served to every visitor. That is correct: Supabase's anon key is an identifier
carrying the `anon` role, not a credential. Row-level security lets a signed-in user read their own
licence row and nothing else, no policy grants a write, and every mutation happens inside a
`SECURITY DEFINER` database function callable only with the service-role key — which never leaves
Supabase, along with the Google and Microsoft client secrets.

The same pair of values also lives in `SwMacroFlow.License/SupabaseConfig.cs` in the application
repository. Changing Supabase projects means changing both.

## Testing locally

```bash
python -m http.server 8000     # then open http://localhost:8000
```

Sign-in against a real Supabase project will not complete from `localhost` unless that origin is
also allow-listed; the page layout, navigation and legal pages can be checked without it.

## Related

Backend, schema, and the admin runbook live in the application repository under `backend/`;
the design is documented in `docs/licensing.md`.
