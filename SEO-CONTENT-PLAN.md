# SwMacroFlow content and keyword plan

Written August 2026, alongside the technical SEO pass that turned the guides and the macro library
into indexable pages. This file is the part that needs writing rather than building: a keyword map,
ten briefs to write against, and the off-page work that no amount of on-page tuning substitutes for.

Every competitor named below was checked on a live search while this was written.

---

## Where the site actually stands

**The brand has no search presence.** Searching "SwMacroFlow SOLIDWORKS batch macro runner" returns
Batch+, CAD Booster's Drew, CodeStack and the SOLIDWORKS forums. SwMacroFlow appears nowhere.
Google does not yet know the site exists.

That sets the order of work. Brand queries are winnable within weeks of Search Console verification
because nothing competes for them. Head terms are a 6-12 month effort against sites with years of
links. The pages below are how you get from one to the other.

**Also true, and worth fixing before any of this:** `release.json` still has an empty `sha256` and
`sizeBytes`, so the download block renders its "coming shortly" state. Every page in this plan
funnels to a download that currently does not exist. Traffic that arrives before the installer does
is traffic spent.

---

## The wedge

The single most exploitable fact in this market:

> **#TASK, the free batch processor most SOLIDWORKS users reached for, stopped being free on
> 1 May 2020.** Users have been asking for a free replacement ever since, in forum threads that
> still rank.

SwMacroFlow is free, has every feature included, needs no account and no licence, and does the
thing #TASK did. That is a genuine, checkable claim in a market where the alternatives are either
paid (Drew, #TASK), limited (SOLIDWORKS Task Scheduler cannot batch parts to DXF), or aimed at
developers (CodeStack).

Lead with free. It is the strongest differentiator and it is true.

### Who you are actually up against

| Competitor | What it is | Where it is strong | The gap you can fill |
|---|---|---|---|
| **Batch+** (cadplus.xarial.com) | Free, open source, stand-alone batch macro runner | The closest direct competitor. Ranks for the head term. Strong domain, developer audience | No macro chaining in one file-open, no bundled library, no AI assistance. Developer-first docs |
| **#TASK** (Central Innovation) | Was the free batch processor; paid since May 2020 | Enormous historical mindshare | It is no longer free. Every "is there a free #TASK" thread is a query you can answer |
| **Drew** (cadbooster.com) | Paid add-in, macros in batch among many features | Excellent content marketing, strong blog | Paid, and batch running is one feature among many rather than the product |
| **SOLIDWORKS Task Scheduler** | Built in to Professional/Premium | Ships with the product | Limited: fixed task types, no arbitrary VBA, cannot batch parts to DXF |
| **CodeStack** (codestack.net) | Free macro library and API reference | Huge authority on SOLIDWORKS API queries | A reference, not a tool. Sends readers looking for something to run the macros with |

---

## Keyword map

Grouped into four clusters. Each row names the URL that should own the query, so nothing competes
with itself.

### Cluster 1 - Batch running (the money cluster)

| Query | Intent | Owning URL | Status |
|---|---|---|---|
| solidworks batch macro runner | Commercial | `/` | Live, needs links |
| run solidworks macro on multiple files | How-to | **Brief 1** (new) | To write |
| solidworks batch processing free | Commercial | **Brief 2** (new) | To write |
| free #TASK alternative / is #TASK still free | Commercial | **Brief 3** (new) | To write |
| solidworks task scheduler alternative | Commercial | **Brief 3** (new) | To write |
| batch run vba macro solidworks | How-to | `/docs/using-the-app/` | Live |
| solidworks automation without api programming | Informational | **Brief 2** (new) | To write |

### Cluster 2 - Writing macros (authority cluster)

| Query | Intent | Owning URL | Status |
|---|---|---|---|
| how to write a solidworks vba macro | How-to | `/docs/writing-a-macro/` | Live |
| solidworks macro user input dialog | How-to | `/docs/adding-inputs/` | Live |
| solidworks macro msgbox / report result | How-to | `/docs/reporting-results/` | Live |
| solidworks macro not running / will not connect | Troubleshooting | `/docs/troubleshooting/` | Live |
| solidworks macro examples | Informational | `/macros.html` | Live |
| write solidworks macro with chatgpt / AI | How-to | **Brief 8** (new) | To write |

### Cluster 3 - Task long-tail (the volume cluster)

Each of these is a specific job someone types into Google at the moment they need it. Low
competition, and they convert, because the searcher already knows exactly what they want.

| Query | Owning URL | Status |
|---|---|---|
| solidworks batch export pdf | `/macros/save-pdf/` | Live |
| batch change solidworks drawing template / sheet format | `/macros/change-drawing-template/` | Live |
| change solidworks document units in bulk | `/macros/change-document-unit/` | Live |
| insert block in all solidworks drawing sheets | `/macros/insert-block-in-drawings/` | Live |
| reduce solidworks file size / image quality | `/macros/save-with-performance-improvement/` | Live |
| batch convert solidworks to step | **Brief 4** (new, needs a macro) | To write |
| batch convert solidworks drawings to dxf | **Brief 5** (new, needs a macro) | To write |
| batch print solidworks drawings | **Brief 6** (new, needs a macro) | To write |

**The highest-leverage move on this whole page:** each new macro published to
`SwMacroFlow.MacroLibrary` becomes a page automatically, on the next weekly build. Writing a
STEP-export macro is both a product improvement and a new indexable page targeting a real query.
Product work and SEO work are the same work here. Do that before writing blog posts.

### Cluster 4 - Comparison (decision-stage)

| Query | Owning URL | Status |
|---|---|---|
| swmacroflow vs batch+ | **Brief 7** (new) | To write |
| best solidworks batch tools | **Brief 2** (new) | To write |
| solidworks macro scheduler / scheduled batch | **Brief 9** (new) | To write |

---

## Briefs

Each one: the query it targets, the gap in what currently ranks, an outline, and where it links.
Word counts are targets, not quotas - stop when the question is answered.

### Brief 1 - How to run a SOLIDWORKS macro on multiple files
- **URL**: `/guides/run-macro-on-multiple-files/`
- **Target**: "run solidworks macro on multiple files", "solidworks macro batch"
- **Gap**: What ranks now is forum threads from 2015 and a YouTube video. There is no clean,
  current, written answer that covers every option honestly.
- **Length**: 1,400-1,800 words
- **Outline**:
  - H1: How to run a SOLIDWORKS macro on multiple files
  - Why a macro that works on one file does not loop over a folder (the `ActiveDoc` problem)
  - Option 1: write your own loop with `OpenDoc6` / `CloseDoc` - with working code, and the three
    things that break it (dialogs, rebuild errors, SOLIDWORKS hanging)
  - Option 2: SOLIDWORKS Task Scheduler - what it can and cannot do
  - Option 3: a stand-alone batch runner - what this class of tool does differently
  - Comparison table of all three
  - Doing it in SwMacroFlow, briefly and last
- **Links out to**: `/docs/writing-a-macro/`, `/docs/using-the-app/`, `/macros.html`
- **Honesty note**: cover the DIY loop properly, including working code. A page that answers the
  question only if you install something gets bounced, and Google notices.

### Brief 2 - Free SOLIDWORKS batch processing tools, compared
- **URL**: `/guides/free-solidworks-batch-tools/`
- **Target**: "solidworks batch processing free", "best solidworks batch tools"
- **Gap**: Existing comparisons are reseller blogs that only discuss Task Scheduler because they
  sell SOLIDWORKS. Nobody has written the neutral roundup.
- **Length**: 1,600-2,000 words
- **Outline**: what "batch processing" covers - Task Scheduler (built in, limited) - Batch+ (free,
  open source) - #TASK (was free, paid since 2020) - Drew (paid) - rolling your own - SwMacroFlow -
  a decision table by job-to-be-done
- **Links out to**: Briefs 1 and 3, `/macros.html`
- **Honesty note**: name Batch+ as the strong free option it is, and say where it is better. A
  comparison page that concludes "we win everything" is not credible and will not earn links.

### Brief 3 - SOLIDWORKS Task Scheduler alternatives (and what happened to #TASK)
- **URL**: `/guides/task-scheduler-alternatives/`
- **Target**: "solidworks task scheduler alternative", "is #TASK still free", "free #TASK alternative"
- **Gap**: The live forum threads asking this are years old and unanswered. This is the highest-intent
  query in the market and nobody owns it.
- **Length**: 1,200-1,500 words
- **Outline**: what Task Scheduler does and its real limits (fixed task types, no arbitrary VBA,
  parts cannot batch to DXF) - what happened to #TASK and when - the alternatives now, free and
  paid - what to pick for which job
- **Links out to**: Brief 2, `/`, `/docs/using-the-app/`

### Brief 4 - Batch convert SOLIDWORKS files to STEP
- **URL**: `/macros/save-step/` - **generated automatically once the macro is published**
- **Target**: "batch convert solidworks to step", "solidworks export step multiple files"
- **Work required**: write `Save STEP.swp` in the library repo with a `Docs/Save STEP.md`. The page
  builds itself on the next run. No website commit needed.

### Brief 5 - Batch convert SOLIDWORKS drawings to DXF
- **URL**: `/macros/save-dxf/` - generated, same as above
- **Target**: "batch convert solidworks drawings to dxf", "solidworks dxf export batch"
- **Why this one matters more than it looks**: Task Scheduler explicitly cannot batch parts to DXF.
  That limitation is documented, complained about, and directly answerable.

### Brief 6 - Batch print SOLIDWORKS drawings
- **URL**: `/macros/batch-print/` - generated
- **Target**: "batch print solidworks drawings", "print all solidworks drawings in a folder"

### Brief 7 - SwMacroFlow vs Batch+
- **URL**: `/compare/swmacroflow-vs-batch-plus/`
- **Target**: "swmacroflow vs batch+", "batch+ alternative"
- **Length**: 900-1,200 words
- **Write this last.** A comparison page is worth writing when people already search your brand.
  Published now, against a competitor with far more authority, it ranks for nothing and reads as
  presumptuous. Revisit once Search Console shows brand impressions.
- **Honesty note**: Batch+ is free and open source. The differences are macro chaining in a single
  file-open, the bundled library, the AI panel and Task Scheduler integration - not price.

### Brief 8 - Writing a SOLIDWORKS macro with an AI assistant
- **URL**: `/guides/solidworks-macro-with-ai/`
- **Target**: "write solidworks macro with chatgpt", "ai solidworks vba"
- **Gap**: Growing query with almost no good answers, and there is an unfair advantage here:
  `/docs/macro-authoring-spec/` is explicitly written to be pasted into an assistant.
- **Length**: 1,000-1,400 words
- **Outline**: what assistants get right and wrong about the SOLIDWORKS API (hallucinated methods,
  wrong enum names) - giving one the authoring spec as context - verifying generated code before
  running it on 500 files - the built-in Copilot panel
- **Links out to**: `/docs/macro-authoring-spec/`, `/docs/writing-a-macro/`

### Brief 9 - Scheduling a SOLIDWORKS batch to run overnight
- **URL**: `/guides/schedule-solidworks-batch/`
- **Target**: "solidworks macro scheduler", "run solidworks batch overnight"
- **Length**: 800-1,100 words
- **Outline**: why overnight runs are the point of batching - Windows Task Scheduler registration -
  what happens when SOLIDWORKS crashes at 3am - checking results in the morning

### Brief 10 - The SOLIDWORKS macro troubleshooting index
- **URL**: `/docs/troubleshooting/` - **expand the existing page, do not create a new one**
- **Target**: the long tail of "solidworks macro <specific error>"
- **Work**: each distinct error message a user reports becomes an H2 on this page, phrased as the
  symptom the user sees. This page compounds. It is already symptom-first, which is the right
  structure - it just needs more symptoms.

**Note on the `/guides/` URLs above:** they are not generated by `tools/build-site.mjs`, which owns
`/docs/` and `/macros/` only. Writing one means either adding a `guides/<slug>/index.html` by hand
in the shape the generator emits, or extending the generator with a third source directory. The
second is better if more than two get written.

---

## Off-page

No amount of on-page work substitutes for other sites linking to yours. Everything below is
legitimate: no paid links, no guest-post farms, no directory blasts. Those carry real penalty risk
and would be a poor trade for a site with nothing to sell.

**In order:**

1. **Search Console and Bing Webmaster Tools.** Verify, submit the sitemap. Nothing else matters
   until Google knows the site exists.
2. **GitHub.** Add topics (`solidworks`, `solidworks-api`, `vba`, `batch-processing`, `cad`,
   `automation`) to the public repos, and link swmacroflow.in from each README. Free, relevant,
   and it is where this audience already is.
3. **AlternativeTo.** List SwMacroFlow as an alternative to #TASK, SOLIDWORKS Task Scheduler and
   Batch+. That is exactly the site's purpose, and it ranks for "X alternative" queries.
4. **The forum threads that already rank.** The unanswered "is there a free #TASK alternative"
   threads are the highest-value link targets in this market. Answer the question properly, mention
   the tool once, and do not post the same paragraph in ten threads.
5. **r/SolidWorks.** Read the rules first. A free tool with no upsell is genuinely welcome there,
   and an "I built this, it is free, here is the source for the macros" post does well - once.
6. **Product Hunt.** Worth one launch, on the day the installer actually goes live. Not before.
7. **The CAD automation community.** CodeStack (Xarial) and CAD Booster both write about this
   space. They are competitors and also the people most likely to find the tool interesting.

**Do not:** buy links, mass-submit to software directories, spin variations of these articles, or
post the same promotional comment across forums. This niche is small enough that its regulars will
recognise it, and their goodwill is worth more than the links.

---

## What to measure

Check these rather than re-auditing the site.

| Signal | Where | Expect |
|---|---|---|
| Brand impressions for "swmacroflow" | GSC, Performance | Non-zero within ~2 weeks of verification. First sign Google knows you exist |
| Indexed page count | GSC, Pages | Moving from ~6 toward 18 over 2-3 weeks |
| Impressions on `/macros/*` | GSC, filter by page | The long tail lands first, before any head term. First real traffic |
| Referring domains | Bing Webmaster (free) | Any growth at all. Zero after three months means the off-page list above was not worked |

**How you would know this plan was wrong:** if indexed pages reach 18 and brand impressions appear,
but `/macros/*` pages get no impressions after two months, then these queries have less volume than
assumed and the long-tail-first strategy is not the way in. In that case shift effort to Briefs 2
and 3, which target queries with demonstrated demand from live forum threads.
