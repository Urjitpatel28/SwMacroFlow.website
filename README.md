# swmacroflow.in

The SwMacroFlow website: a static marketing page, public download links, and the legal pages for the
Windows desktop application.

Plain static HTML. No build step, no framework, no package manager. **Pushing to `main` deploys to
production**: `.github/workflows/static.yml` uploads the repository root to GitHub Pages, so any
`.html` at the root becomes a live route on the next push.

## Pages

| File | Indexed | Purpose |
|---|---|---|
| `index.html` | yes | Landing page with direct download links |
| `terms.html` | yes | Terms for free public use |
| `privacy.html` | yes | What is collected and why |

```
assets/site.css         tokens, nav, footer, buttons, legal-page styles
assets/logo.png         site icon and brand mark
assets/SwMacroFlow.png  application screenshot
```

## Access model

SwMacroFlow is free for everyone. The website does not include user registration, user management,
backend user services, or access checks. Download buttons point directly to the latest public Windows
installer on GitHub Releases.

## Testing locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Because this is a static site, checking the three public pages and
their links is enough for local verification.

## Related

Application code, docs, and releases live in the SwMacroFlow application repositories. Keep this site
copy aligned with the application behavior: no registration wall, no access-key requirement, and no paid
download gate.
