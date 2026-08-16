# swmacroflow.in

The SwMacroFlow website: a static marketing page, the download block, and the legal pages for the
Windows desktop application.

Plain static HTML. No build step, no framework, no package manager. **Pushing to `main` deploys to
production**: `.github/workflows/static.yml` uploads the repository root to GitHub Pages, so any
`.html` at the root becomes a live route on the next push.

## Pages

| File | Indexed | Purpose |
|---|---|---|
| `index.html` | yes | Landing page; every CTA goes to the `#download` block |
| `docs.html` | yes | Documentation reader: guide list beside a Markdown viewer |
| `macros.html` | yes | Public macro browser with docs and `.swp` downloads from GitHub |
| `terms.html` | yes | Terms of use |
| `privacy.html` | yes | What is collected and why |
| `contact.html` | yes | Support routes and response times |

```
assets/site.css         tokens, nav, footer, buttons, legal-page and docs styles
assets/release.js       fills the #download block on index.html from release.json
assets/markdown.js      minimal Markdown renderer shared by docs.html and macros.html
assets/nav.js           mobile nav toggle for the shared header
assets/logo.png         site icon and brand mark
assets/SwMacroFlow.png  application screenshot
docs/manifest.json      guide groups and order
docs/*.md               the seven guides, rendered by docs.html
release.json            the single description of the current build
```

## Access model

**There isn't one.** SwMacroFlow is free, every feature is included, and the site has no accounts,
no licence keys, no activation, and no payments. The installer is linked publicly from the home
page and anyone can download it.

This is deliberate and the copy depends on it: `index.html`, `terms.html`, and `privacy.html` all
state plainly that there is nothing to buy and nothing to sign up for. If a paid tier is ever
reintroduced, all three have to change together — and the privacy policy in particular, because it
currently promises no device identifier and no account data of any kind.

AI Copilot is **bring your own key**: the user supplies an API key from a provider they choose, that
provider bills them directly, and the key never leaves their machine. That is the one cost the user
may incur, and it is not ours to charge or refund.

## Updating the docs

`docs/*.md` are a **manual one-way copy** of `SwMacroFlow.Ui\Resources\Help\*.md` from the application
repository. That repository is private, so the guides cannot be fetched from GitHub at runtime the way
`macros.html` fetches the public macro library — they have to live here.

When the application's help guides change, copy the files across again and commit them. If a guide is
added, removed, or reordered, also edit `docs/manifest.json` so its groups and order still match
`HelpLibrary.Groups` in `SwMacroFlow.Ui\Services\HelpLibrary.cs`. Sidebar labels are not stored in the
manifest: they come from each document's first `#` heading, the same rule the application uses.

## Publishing a release

`release.json` at the repo root is the single description of the current build. The download block
on `index.html` reads it through `assets/release.js`, and **the application's auto-updater should
verify every download against the same `sha256`** before running it — that is the check that
actually protects users, not an installer hashing itself.

Installers are published as GitHub releases on the **public** `Urjitpatel28/SwMacroFlow.Releases`
repository. The application repository itself is private, and release assets on a private repo are
not publicly downloadable — a link to one 404s for everybody.

`url` in `release.json` is GitHub's stable latest-release permalink and **never needs changing**:

```
https://github.com/Urjitpatel28/SwMacroFlow.Releases/releases/latest/download/SwMacroFlowSetup.exe
```

For each release:

1. Publish a GitHub release on `SwMacroFlow.Releases` with the installer attached, named exactly
   `SwMacroFlowSetup.exe` so the permalink resolves.
2. Get its checksum: `Get-FileHash .\SwMacroFlowSetup.exe -Algorithm SHA256`
3. Fill in `release.json` — `version`, `sha256` (64 hex chars), `sizeBytes`, `releasedOn`
   (`YYYY-MM-DD`).
4. Push to `main`.

The download block goes live when `url` and `version` are both non-empty; until then it shows a
"coming shortly" message. `sha256` is displayed only when it is a valid 64-character hex string —
a wrong checksum is worse than none, because it makes a good file look tampered with, but a missing
one is no reason to withhold the download.

Clicking Download opens a thank-you dialog carrying the **SmartScreen warning**. The installer is
unsigned, so Windows shows "Windows protected your PC" to anyone without an EV certificate's
reputation behind them; a user who has not been warned reads that screen as "this is malware" and
never runs it. If code signing is ever added, that dialog is the thing to revisit.

## Testing locally

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. Because this is a static site, check pages over `http://`, not by
opening files directly: `docs.html` fetches `docs/manifest.json` and `index.html` fetches
`release.json`, and browsers block those on `file://`.

## Related

Application code, docs, and releases live in the SwMacroFlow application repositories. Keep this site
copy aligned with the current model: a free download, no account, no licence, and no payment.
