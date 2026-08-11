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
| `docs.html` | yes | Documentation reader: guide list beside a Markdown viewer |
| `macros.html` | yes | Public macro browser with docs and `.swp` downloads from GitHub |
| `terms.html` | yes | Terms for free public use |
| `privacy.html` | yes | What is collected and why |

```
assets/site.css         tokens, nav, footer, buttons, legal-page and docs styles
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

SwMacroFlow is free for everyone. The website does not include user registration, user management,
backend user services, or access checks. Download buttons point directly to the latest public Windows
installer on GitHub Releases.

## Testing locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Because this is a static site, checking the public pages and their
links is enough for local verification. `docs.html` must be checked over `http://`, not by opening the
file directly: it `fetch`es `docs/manifest.json` and the guides, which browsers block on `file://`.

## Related

Application code, docs, and releases live in the SwMacroFlow application repositories. Keep this site
copy aligned with the application behavior: no registration wall, no access-key requirement, and no paid
download gate.
