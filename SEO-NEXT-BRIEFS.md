# Next guides to write

Briefs for the `/guides/` pages that are not written yet. The machinery exists, so shipping one is
now: write `guides/<slug>.md`, add an entry to `guides/manifest.json`, add title and description to
the `guides` key in `tools/seo-meta.json`, run `node tools/build-site.mjs`, commit.

This supersedes the URL scheme in `SEO-CONTENT-PLAN.md`, which put comparison pages under
`/compare/`. They live under `/guides/` with `"kind": "comparison"` instead - GitHub Pages cannot
serve a 301, so a prefix split would be permanent, and the comparison content shares a topic cluster
with the rest of the guides.

## Authoring rules

The renderer is `assets/markdown.js`, which is deliberately small. It handles headings, fenced code,
flat lists, pipe tables, horizontal rules, and inline code, bold, italic and links.

- **No images and no blockquotes.** Both fail silently: `![alt](/x.png)` renders as a stray `!`
  followed by a link, and a `>` line renders as literal text.
- **No nested lists.** Flat only.
- **Links must be site-absolute** (`/docs/writing-a-macro/`) or fully qualified. A relative link like
  `../docs/` renders as visible literal text.
- **An `## FAQ` heading with `###` questions** under it produces an `FAQPage` schema node
  automatically. Any other wording produces nothing, though the build warns if a heading looks like
  an FAQ and did not match.
- **1,200 words or more.** The build warns under 600.
- The first prose paragraph becomes the meta description fallback and the card summary on
  `guides.html`, so make it a real summary sentence.

---

## 1. `/guides/free-solidworks-batch-tools/`

**Primary keyword:** `free solidworks batch processing` · **Secondary:** `free solidworks batch
converter`, `batch process solidworks files free`

The category page that `task-scheduler-alternatives` is the comparison half of. Where that page
answers "what do I use instead of X", this one answers "what free options exist at all".

Cover: Task Scheduler (free with Pro/Premium, fixed menu), Batch+ (free, open source), macros with
their own folder loop (free, DIY), SwMacroFlow (free), and honestly note the paid ones exist. A
table of what each costs, what it batches, and whether it runs your own macros.

The differentiator against the competition already ranking: they are all vendor blog posts that
recommend one tool. A page that genuinely covers all of them, including the option that needs no
download, is the one that gets cited.

`related`: `/guides/task-scheduler-alternatives/`, `/guides/run-macro-on-multiple-files/`,
`/macros.html`

## 2. `/guides/swmacroflow-vs-batch-plus/`

**Primary keyword:** `batch+ alternative` · **Secondary:** `xarial batch+ vs`, `solidworks batch
macro runner comparison` · **`kind`:** `comparison`

Write this one **last**, and only once `guides.html` and the three shipped guides have brand
impressions in Search Console. A head-to-head page from a site with no authority reads as spam; from
a site that already ranks for the category, it reads as a resource.

Be scrupulously fair. Batch+ is free, open source, mature, and from the author of CodeStack. The
honest differences are interface style, macro chaining per file, and the AI Copilot - not quality.
Get a fact wrong about a competitor's free product and the page becomes a liability.

`mentions`: Batch+ with its URL. No `Review` or `AggregateRating` schema - self-assigned ratings
about your own or a competitor's product are a manual-action risk.

## 3. `/guides/schedule-solidworks-batch/`

**Primary keyword:** `schedule solidworks batch` · **Secondary:** `run solidworks macro overnight`,
`solidworks unattended batch`

Genuinely low competition and high intent - someone searching this has a batch that takes too long to
run during the day, which is a person with a real problem and a folder of files.

Cover: why unattended runs need dialog-free macros, what breaks overnight (modal dialogs, licence
timeouts, PDM check-outs, Windows updates rebooting the machine), how Windows Task Scheduler runs an
executable, and how SwMacroFlow creates those entries directly. Include the practical detail that the
machine must stay logged in or the task must be configured to run whether or not the user is.

`related`: `/docs/using-the-app/`, `/docs/reporting-results/`,
`/guides/run-macro-on-multiple-files/`

## 4. `/guides/solidworks-macro-with-ai/`

**Primary keyword:** `write solidworks macro with ai` · **Secondary:** `chatgpt solidworks macro`,
`ai solidworks automation`

Nobody owns this and the query is growing. You have an unusual asset for it:
`/docs/macro-authoring-spec/` was written specifically to be pasted into an AI assistant.

Cover: why LLMs get the SOLIDWORKS API subtly wrong (hallucinated enum names, wrong argument counts,
confusing `ModelDoc2` with `ModelDocExtension`), how to give one enough context to be useful, the
paste-the-spec trick, and how to verify generated code before running it across 400 files. Then the
Copilot panel, which does this with the spec already loaded.

Be honest that AI-generated macros need review. A page that says "just ask ChatGPT" is worthless; one
that says "here is how to check what it gave you" is the one people bookmark.

`related`: `/docs/macro-authoring-spec/`, `/docs/writing-a-macro/`, `/docs/adding-inputs/`

## 5. `/guides/batch-export-solidworks-to-pdf/`

**Primary keyword:** `batch export solidworks to pdf` · **Secondary:** `save all solidworks drawings
as pdf`, `solidworks pdf batch converter`

Highest-volume single-task query in the set. Competition is Blue Byte Systems and Javelin, both of
which rank with a macro and a paragraph.

Beat them on completeness rather than novelty: all the ways to do it (Task Scheduler's print/convert
task, a folder-loop macro with working VBA, a batch runner), plus the details their pages skip -
sheet-scope options, what happens with multi-sheet drawings, PDF naming from custom properties,
where the file lands, and rebuilding before export so views are current.

This one should link hard to [`/macros/save-pdf/`](/macros/save-pdf/), which is currently one of the
thin macro pages.

`related`: `/macros/save-pdf/`, `/macros/save-drawing-as-dxf-or-dwg/`,
`/guides/run-macro-on-multiple-files/`

---

## Also outstanding, not guides

**Deepen the six thin macro pages.** `change-drawing-template`, `save-with-performance-improvement`,
`insert-block-in-drawings`, `save-pdf`, `save-edrawings` and `change-document-unit` each have under
about 250 words of unique prose. The build now warns about this, but the copy lives in
`Docs/*.md` in the **`SwMacroFlow.MacroLibrary` repo**, not here - edit it there and re-run the build.

Follow the shape of `save-step`, which is the strongest of the sixteen: Runs-per-file line, Inputs
table, Results, Notes explaining the non-obvious API behaviour, when you would actually use this, and
Chaining. Aim for 400-600 unique words.

**`release.json`** still has `"sha256": ""` and `"sizeBytes": 0`, so the download block cannot show a
checksum. On an unsigned installer that already trips SmartScreen, a published SHA-256 is the only
integrity signal a cautious user has.

**Bing Webmaster Tools.** Google Search Console is verified by DNS TXT; Bing is not set up at all.
Import from Search Console, which needs no new file. Bing feeds ChatGPT search, which matters more
here than Bing's own share.

**`aggregateRating`.** Once `#reviews` holds three or more genuine reviews, emit it on the
`SoftwareApplication` node from the real Supabase data. Never from invented numbers.
