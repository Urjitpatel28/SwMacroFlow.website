# swmacroflow.in

The SwMacroFlow website: a static marketing page, trial sign-up, and the legal pages for the
Windows desktop application.

Plain static HTML. No build step, no framework, no package manager. **Pushing to `main` deploys to
production**: `.github/workflows/static.yml` uploads the repository root to GitHub Pages, so any
`.html` at the root becomes a live route on the next push.

## Pages

| File | Indexed | Purpose |
|---|---|---|
| `index.html` | yes | Landing page; every CTA goes to `login.html#signup` for the 6 month trial |
| `docs.html` | yes | Documentation reader: guide list beside a Markdown viewer |
| `macros.html` | yes | Public macro browser with docs and `.swp` downloads from GitHub |
| `terms.html` | yes | Terms for the 6 month trial and account use |
| `privacy.html` | yes | What is collected and why |

```
assets/site.css         tokens, nav, footer, buttons, auth, legal-page and docs styles
assets/auth-config.js   public Supabase project URL and publishable key placeholders
assets/auth.js          Supabase Auth client wiring for login, account, reset, and nav state
assets/markdown.js      minimal Markdown renderer shared by docs.html and macros.html
assets/logo.png         site icon and brand mark
assets/SwMacroFlow.png  application screenshot
docs/manifest.json      guide groups and order
docs/*.md               the seven guides, rendered by docs.html
```

## Updating the docs

`docs/*.md` are a **manual one-way copy** of `SwMacroFlow.Ui\Resources\Help\*.md` from the application
repository. That repository is private, so the guides cannot be fetched from GitHub at runtime the way
`macros.html` fetches the public macro library — they have to live here.

When the application's help guides change, copy the files across again and commit them. If a guide is
added, removed, or reordered, also edit `docs/manifest.json` so its groups and order still match
`HelpLibrary.Groups` in `SwMacroFlow.Ui\Services\HelpLibrary.cs`. Sidebar labels are not stored in the
manifest: they come from each document's first `#` heading, the same rule the application uses.

## Access model

The website now includes Supabase Auth for email/password and Google sign-in. There is no public
installer link anywhere on the site: every call to action sends visitors to `login.html#signup` to
create an account for the free 6 month trial. Payments, subscriptions, license enforcement, trial
expiry tracking, and custom account tables are still deferred, so the trial is currently a marketing
promise rather than something the site enforces. Browser code uses only the public Supabase URL
and publishable/anon key from `assets/auth-config.js`; never put a service-role key in this repo.

## Supabase setup

1. Create a Supabase project for SwMacroFlow.
2. Copy the project URL and publishable/anon key into `assets/auth-config.js`.
3. In Supabase Auth URL Configuration, set Site URL to `https://swmacroflow.in`.
4. Add redirect URLs for `https://swmacroflow.in/account.html`,
   `https://swmacroflow.in/reset-password.html`, and `http://localhost:8000/**`.
5. Enable email/password auth with email confirmation and Supabase default email delivery.
6. Enable the Google provider. The OAuth app must use
   `https://<project-ref>.supabase.co/auth/v1/callback` as the web redirect URI.

## Testing locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Because this is a static site, check pages over `http://`, not by opening files directly. `docs.html`
fetches `docs/manifest.json`, and the auth pages load ES modules, which browsers block or limit on
`file://`.

## Related

Application code, docs, and releases live in the SwMacroFlow application repositories. Keep this site
copy aligned with the current access model: sign-up for a free 6 month trial, Supabase Auth accounts
for account management, and no payment or license enforcement until those systems are implemented.
