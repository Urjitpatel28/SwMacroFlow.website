/*
  Generates the crawlable half of the site.

  Why this exists: docs.html used to fetch docs/*.md and render them client-side into one URL with
  hash fragments, and macros.html used to fetch the macro library from the GitHub API at request
  time. Both worked for a reader with JavaScript and neither produced a page a search engine could
  index - seven guides and five macros lived at two URLs that contained no content in their HTML.
  This script turns each one into its own page with its own <title>, description and schema, and
  rewrites docs.html and macros.html into static indexes that link to them.

  It also owns sitemap.xml and llms.txt, because a hand-maintained sitemap on a site whose page
  count is generated is a sitemap that goes stale or, as this one did, gets an unclosed tag in it
  and stops parsing altogether.

  Run it with `node tools/build-site.mjs` before committing, or let the Pages workflow run it. The
  output is committed so `python -m http.server 8000` still previews the whole site with no build.

  Requires Node 20+ (global fetch). No dependencies, on purpose: this repo has no package manager
  and adding one to render Markdown that assets/markdown.js already renders would be a poor trade.
*/

import { execFileSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ORGANIZATION_ID,
  ORIGIN,
  SOFTWARE_ID,
  WEBSITE_ID,
  breadcrumbTrail,
  breadcrumbs,
  escapeHtml,
  footer,
  head,
  nav,
  pager
} from "./templates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const MACRO_LIBRARY = {
  owner: "Urjitpatel28",
  repo: "SwMacroFlow.MacroLibrary",
  branch: "main"
};

/* Where the installer is published. Every download on the site goes through this repository's
   latest-release permalink, so GitHub's own per-asset download_count is the whole picture and
   nothing has to be tracked here to arrive at it. */
const RELEASES_REPO = {
  owner: "Urjitpatel28",
  repo: "SwMacroFlow.Releases"
};

/* A test fixture in the library repo. It is one line long, so a page for it would be thin content
   sitting alongside five substantial ones - exactly the shape that drags a small site's quality
   signals down. It stays visible in the app; it just does not get a URL here. */
const EXCLUDED_MACROS = new Set(["helloworld"]);

const INSTALL_PATH = String.raw`%LOCALAPPDATA%\SwMacroFlow\macros`;

/* Where a downloaded .swp has to end up. Shown on every macro page and on the index, with the copy
   button wired by assets/copy-path.js. */
function installBlock() {
  return `<div class="macro-install">
        <p>Put the downloaded file in this folder, then open SwMacroFlow and choose it from the library.</p>
        <div class="install-code-row">
          <pre><code>${escapeHtml(INSTALL_PATH)}</code></pre>
          <button class="copy-path-button" type="button" aria-label="Copy macro folder path" title="Copy macro folder path">
            <span class="copy-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>`;
}

// ---------- the Markdown renderer ----------

/* assets/markdown.js rather than a Markdown library: it is the renderer the browser and the
   desktop app already use, so a guide rendered at build time is character for character what the
   old client-side reader produced. The file is a browser IIFE, so it is evaluated here with
   globalThis standing in for window. */
async function loadMarkdown() {
  const source = await readFile(join(ROOT, "assets", "markdown.js"), "utf8");
  new Function(source)();
  if (!globalThis.SwMarkdown) throw new Error("assets/markdown.js did not define SwMarkdown.");
  return globalThis.SwMarkdown;
}

const SwMarkdown = await loadMarkdown();

// ---------- helpers ----------

function slugify(value) {
  return String(value)
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+[-_ ]+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* The first paragraph of real prose, used when seo-meta.json has nothing for a page. Skips the
   title, table rows, dividers, list items and fences.

   The whole paragraph, not the first line: these documents are hard-wrapped at 100 columns, so a
   line-at-a-time reading ends every summary mid-sentence ("There is no SwMacroFlow-specific"). It
   gathers consecutive lines until the blank one that ends the paragraph, then clamp() cuts it at a
   word boundary if it is still too long. */
function firstProse(markdown, title) {
  const normalized = String(title).trim().toLowerCase();
  const lines = markdown.replace(/\r\n/g, "\n").split("\n").map(entry => entry.trim());

  const skip = entry => {
    const plain = entry.replace(/^#+\s*/, "").replace(/[*`]/g, "").trim().toLowerCase();
    return (
      !entry ||
      plain === normalized ||
      entry.startsWith("|") ||
      entry.startsWith("#") ||
      entry.startsWith("```") ||
      entry.startsWith("'''") ||
      /^[-*]\s+/.test(entry) ||
      /^\d+\.\s+/.test(entry) ||
      /^[-:| ]+$/.test(entry)
    );
  };

  const start = lines.findIndex(entry => !skip(entry));
  if (start === -1) return "";

  const paragraph = [];
  for (let index = start; index < lines.length && lines[index] && !skip(lines[index]); index += 1) {
    paragraph.push(lines[index]);
  }

  return paragraph.join(" ").replace(/[*`]/g, "");
}

/* A macro's summary in library-index.json is generally the first line of its own document, so
   showing the summary as the lede and then rendering the document underneath prints the same
   sentence twice. This drops that leading paragraph from the body when it is the one already
   shown above. Compared on a normalised prefix because the lede may have been clamped. */
function stripLeadingSummary(markdown, summary) {
  const normalize = value => value.replace(/[*`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const lede = normalize(summary).replace(/\.\.\.$/, "");
  if (lede.length < 20) return markdown;

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  // Past the document's own "# Title" and the blank line under it.
  while (index < lines.length && (!lines[index].trim() || lines[index].trim().startsWith("#"))) index += 1;

  let end = index;
  while (end < lines.length && lines[end].trim()) end += 1;

  const paragraph = normalize(lines.slice(index, end).join(" "));
  const compared = Math.min(lede.length, paragraph.length, 60);
  if (compared < 20 || paragraph.slice(0, compared) !== lede.slice(0, compared)) return markdown;

  return [...lines.slice(0, index), ...lines.slice(end)].join("\n");
}

/* Descriptions are cut at a word boundary rather than mid-word: a snippet Google truncates itself
   is fine, one the site truncates badly is not. The default is sized for a meta description;
   visible ledes and cards pass DISPLAY_LIMIT so a two-sentence macro summary shows in full. */
const DISPLAY_LIMIT = 200;

function clamp(text, limit = 158) {
  const clean = String(text).replace(/[*`]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

/* Authoring date, not build date. A lastmod that moves every time CI runs teaches Google to ignore
   the field, which is worse than having none. */
function gitLastModified(relativePath) {
  try {
    const stamp = execFileSync("git", ["log", "-1", "--format=%cs", "--", relativePath], {
      cwd: ROOT,
      encoding: "utf8"
    }).trim();
    return stamp || null;
  } catch {
    return null;
  }
}

/* Undoes one round of double-encoded UTF-8.

   library-index.json in the macro library arrives with "—" written as "â€”": the em dash was
   encoded to UTF-8 once, those bytes were then read as Windows-1252, and the result was encoded to
   UTF-8 again. The file is still valid UTF-8, so no decoder catches it - it just renders as
   mojibake, and without this it would render as mojibake on an indexed page.

   The repair maps each character back to the single Windows-1252 byte it stands for and decodes
   the result as UTF-8. It is applied only when the text matches the mojibake signature and only
   kept when the decode succeeds, so text that was never double-encoded passes through untouched. */
const CP1252_HIGH = new Map(
  [
    0x20ac, 0x81, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
    0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x8d, 0x017d, 0x8f,
    0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x9d, 0x017e, 0x0178
  ].map((codePoint, index) => [codePoint, 0x80 + index])
);

function repairDoubleEncoding(text) {
  // Â or Ã or â followed by something in the range those mojibake sequences use.
  if (!/[ÂÃâ][-¿ˆ-™]/.test(text)) return text;

  const bytes = [];
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint < 0x100) bytes.push(codePoint);
    else if (CP1252_HIGH.has(codePoint)) bytes.push(CP1252_HIGH.get(codePoint));
    else return text; // Not representable as one Windows-1252 byte, so this is not the pattern.
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return text;
  }
}

/* Not response.text(), which assumes UTF-8 unconditionally.

   The macro library is authored on Windows and some of its documents are Windows-1252, so an em
   dash decoded as UTF-8 comes back as U+FFFD and gets baked into a page Google then indexes with a
   replacement character in it. Strict UTF-8 first, because that is what most of the files are and
   a valid UTF-8 document must never be reinterpreted; Windows-1252 only when strict decoding
   actually throws. */
async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": "swmacroflow-site-build" } });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  const bytes = new Uint8Array(await response.arrayBuffer());
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    console.warn(`  ! ${decodeURIComponent(url.split("/").pop())} is not UTF-8, decoding as Windows-1252`);
    text = new TextDecoder("windows-1252").decode(bytes);
  }

  const repaired = repairDoubleEncoding(text.replace(/^﻿/, ""));
  if (repaired !== text.replace(/^﻿/, "")) {
    console.warn(`  ! repaired double-encoded characters in ${decodeURIComponent(url.split("/").pop())}`);
  }
  return repaired;
}

async function write(relativePath, contents) {
  const target = join(ROOT, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, contents.replace(/\r\n/g, "\n"), "utf8");
  console.log(`  wrote ${relativePath}`);
}

// ---------- sources ----------

async function loadSeoMeta() {
  const raw = await readFile(join(ROOT, "tools", "seo-meta.json"), "utf8");
  return JSON.parse(raw);
}

async function loadGuides(seoMeta) {
  const manifest = JSON.parse(await readFile(join(ROOT, "docs", "manifest.json"), "utf8"));
  const files = await readdir(join(ROOT, "docs"));
  const present = new Set(files.filter(name => name.endsWith(".md")).map(name => name.replace(/\.md$/, "")));

  const guides = [];
  const groups = [];

  for (const group of manifest.groups || []) {
    const members = [];

    for (const name of group.docs || []) {
      if (!present.has(name)) {
        console.warn(`  ! docs/manifest.json lists ${name}, which has no .md file - skipped`);
        continue;
      }

      const markdown = await readFile(join(ROOT, "docs", `${name}.md`), "utf8");
      const slug = slugify(name);
      const title = SwMarkdown.firstHeading(markdown) || slug.replace(/-/g, " ");
      const meta = (seoMeta.docs || {})[slug] || {};

      const guide = {
        name,
        slug,
        title,
        // The H1 and the sidebar label are allowed to differ from the document's own heading:
        // 01-overview.md opens "# SwMacroFlow", which is the right heading inside the application's
        // help pane and a useless one as a page title and a nav entry on the site.
        heading: meta.heading || title,
        navTitle: meta.navTitle || title,
        group: group.title,
        markdown,
        summary: clamp(firstProse(markdown, title) || meta.description || title, DISPLAY_LIMIT),
        seoTitle: meta.title ? `${meta.title} | SwMacroFlow` : `${title} - SwMacroFlow docs`,
        seoDescription: clamp(meta.description || firstProse(markdown, title) || title),
        path: `/docs/${slug}/`,
        lastmod: gitLastModified(`docs/${name}.md`)
      };

      guides.push(guide);
      members.push(guide);
    }

    if (members.length) groups.push({ title: group.title, guides: members });
  }

  if (!guides.length) throw new Error("No guides were found in docs/ - refusing to publish an empty docs index.");
  return { guides, groups };
}

function rawUrl(path) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${MACRO_LIBRARY.owner}/${MACRO_LIBRARY.repo}/${MACRO_LIBRARY.branch}/${encoded}`;
}

async function libraryLastCommitDate() {
  try {
    const url = `https://api.github.com/repos/${MACRO_LIBRARY.owner}/${MACRO_LIBRARY.repo}/commits?per_page=1`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "swmacroflow-site-build" }
    });
    if (!response.ok) return null;
    const commits = await response.json();
    const date = commits?.[0]?.commit?.committer?.date;
    return date ? date.slice(0, 10) : null;
  } catch {
    return null;
  }
}

/* Total installer downloads across every release, or null if GitHub could not be reached. Both the
   .exe and the .msi are counted: they are the same application, and someone who took the MSI is
   still a user. Null rather than zero on failure, because the caller has to be able to tell "the
   API was unreachable" from "nobody has downloaded it", and those want opposite handling. */
async function releaseDownloadTotal() {
  try {
    const url = `https://api.github.com/repos/${RELEASES_REPO.owner}/${RELEASES_REPO.repo}/releases?per_page=100`;
    const headers = { Accept: "application/vnd.github+json", "User-Agent": "swmacroflow-site-build" };

    // Only inside Actions. Unauthenticated calls share a 60/hour budget with every other job on the
    // runner's IP; the workflow's token lifts it to 1000 and costs nothing. Local runs go without.
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const response = await fetch(url, { headers });
    if (!response.ok) return null;

    const releases = await response.json();
    if (!Array.isArray(releases)) return null;

    let total = 0;
    for (const release of releases) {
      for (const asset of release?.assets || []) {
        total += Number(asset?.download_count) || 0;
      }
    }
    return total;
  } catch {
    return null;
  }
}

async function loadMacros(seoMeta) {
  // The same index the desktop app reads, so a macro's name and summary on the site are what the
  // app shows rather than a second derivation that drifts.
  const index = JSON.parse(await fetchText(rawUrl("library-index.json")));
  const entries = (index.entries || []).filter(entry => entry?.name && entry?.macroPath);
  if (!entries.length) throw new Error("library-index.json listed no macros.");

  const lastmod = await libraryLastCommitDate();
  const macros = [];

  for (const entry of entries) {
    if (EXCLUDED_MACROS.has(entry.name.toLowerCase())) {
      console.log(`  - skipping ${entry.name} (excluded)`);
      continue;
    }

    const slug = slugify(entry.name);
    const title = entry.title || entry.name;
    const meta = (seoMeta.macros || {})[slug] || {};

    let markdown = "";
    if (entry.docPath) {
      try {
        markdown = await fetchText(rawUrl(entry.docPath));
      } catch (error) {
        // A macro whose notes will not load is still worth a page: the summary and the download
        // are the parts a reader came for.
        console.warn(`  ! notes for ${entry.name} could not be fetched: ${error.message}`);
      }
    }

    macros.push({
      name: entry.name,
      slug,
      title,
      heading: meta.heading || title,
      navTitle: meta.navTitle || title,
      markdown,
      summary: clamp(entry.summary || firstProse(markdown, title) || title, DISPLAY_LIMIT),
      seoTitle: meta.title ? `${meta.title} | SwMacroFlow` : `${title} - SOLIDWORKS macro | SwMacroFlow`,
      seoDescription: clamp(meta.description || entry.summary || firstProse(markdown, title) || title),
      downloadUrl: rawUrl(entry.macroPath),
      path: `/macros/${slug}/`,
      lastmod
    });
  }

  macros.sort((a, b) => a.title.localeCompare(b.title));
  if (!macros.length) throw new Error("Every macro was excluded - refusing to publish an empty macro index.");
  return macros;
}

// ---------- page bodies ----------

function guideSidebar(groups, currentSlug, base) {
  const blocks = groups.map(group => {
    const items = group.guides
      .map(guide => {
        const active = guide.slug === currentSlug ? ' class="is-active" aria-current="page"' : "";
        return `<li><a href="${base}docs/${guide.slug}/"${active}>${escapeHtml(guide.navTitle)}</a></li>`;
      })
      .join("\n          ");

    return `<p class="docs-nav-group">${escapeHtml(group.title)}</p>
        <ul>
          ${items}
        </ul>`;
  });

  return `<nav class="docs-nav" aria-label="Documentation">
        ${blocks.join("\n        ")}
      </nav>`;
}

function guidePage(guide, groups, previous, next) {
  const base = "/";
  const trail = [
    { name: "Home", path: "/" },
    { name: "Docs", path: "/docs.html" },
    { name: guide.navTitle, path: guide.path }
  ];

  const schema = [
    {
      "@type": "TechArticle",
      "@id": `${ORIGIN}${guide.path}#article`,
      headline: guide.heading,
      description: guide.seoDescription,
      url: `${ORIGIN}${guide.path}`,
      inLanguage: "en",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID },
      publisher: { "@id": ORGANIZATION_ID },
      ...(guide.lastmod ? { dateModified: guide.lastmod } : {})
    },
    breadcrumbs(trail)
  ];

  const body = SwMarkdown.toHtml(guide.markdown, { stripFirstHeading: true });

  return `${head({
    base,
    path: guide.path,
    title: guide.seoTitle,
    description: guide.seoDescription,
    schema
  })}
<body>

${nav(base, "docs")}

<main class="docs-page">
  <div class="docs-layout">

    <aside class="docs-sidebar">
      ${guideSidebar(groups, guide.slug, base)}
    </aside>

    <article class="docs-content">
      ${breadcrumbTrail(base, trail)}
      <p class="page-eyebrow">${escapeHtml(guide.group)}</p>
      <h1>${escapeHtml(guide.heading)}</h1>
      <div class="docs-markdown">${body}</div>

      ${pager(
        previous ? { href: `${base}docs/${previous.slug}/`, title: previous.navTitle } : null,
        next ? { href: `${base}docs/${next.slug}/`, title: next.navTitle } : null
      )}

      <aside class="doc-cta">
        <p>
          These guides describe <a href="${base}index.html">SwMacroFlow</a>, a free Windows app that
          batch-runs SOLIDWORKS macros across folders of parts, assemblies and drawings.
          <a href="${base}index.html#download">Download it</a>, or browse the
          <a href="${base}macros.html">ready-made macro library</a>.
        </p>
      </aside>
    </article>

  </div>
</main>

${footer(base)}

<script src="${base}assets/nav.js" defer></script>
</body>
</html>
`;
}

function macroPage(macro, macros) {
  const base = "/";
  const trail = [
    { name: "Home", path: "/" },
    { name: "Macros", path: "/macros.html" },
    { name: macro.navTitle, path: macro.path }
  ];

  const schema = [
    {
      "@type": "SoftwareSourceCode",
      "@id": `${ORIGIN}${macro.path}#macro`,
      name: macro.title,
      description: macro.seoDescription,
      url: `${ORIGIN}${macro.path}`,
      programmingLanguage: "VBA",
      runtimePlatform: "SOLIDWORKS",
      codeRepository: `https://github.com/${MACRO_LIBRARY.owner}/${MACRO_LIBRARY.repo}`,
      codeSampleType: "full solution",
      targetProduct: { "@id": SOFTWARE_ID },
      isPartOf: { "@id": WEBSITE_ID },
      author: { "@id": ORGANIZATION_ID },
      license: "https://opensource.org/licenses/MIT",
      ...(macro.lastmod ? { dateModified: macro.lastmod } : {})
    },
    breadcrumbs(trail)
  ];

  const notes = macro.markdown
    ? SwMarkdown.toHtml(stripLeadingSummary(macro.markdown, macro.summary), { stripFirstHeading: true })
    : "<p>No documentation has been published for this macro yet. The download below still works.</p>";

  const others = macros
    .filter(other => other.slug !== macro.slug)
    .map(other => `<li><a href="${base}macros/${other.slug}/">${escapeHtml(other.navTitle)}</a></li>`)
    .join("\n          ");

  return `${head({
    base,
    path: macro.path,
    title: macro.seoTitle,
    description: macro.seoDescription,
    schema
  })}
<body>

${nav(base, "macros")}

<main class="docs-page">
  <div class="docs-layout">

    <aside class="docs-sidebar">
      <p class="docs-nav-group">Other macros</p>
      <nav class="docs-nav" aria-label="Macro library">
        <ul>
          ${others}
        </ul>
      </nav>
      <p class="docs-nav-group">Writing your own</p>
      <nav class="docs-nav" aria-label="Guides">
        <ul>
          <li><a href="${base}docs/writing-a-macro/">Writing a macro</a></li>
          <li><a href="${base}docs/adding-inputs/">Adding inputs</a></li>
        </ul>
      </nav>
    </aside>

    <article class="docs-content">
      ${breadcrumbTrail(base, trail)}
      <p class="page-eyebrow">.swp macro</p>
      <h1>${escapeHtml(macro.heading)}</h1>
      <p class="macro-lede">${SwMarkdown.inlineMarkdown(macro.summary)}</p>

      <p class="macro-actions">
        <a class="btn btn-primary" href="${escapeHtml(macro.downloadUrl)}" download>Download ${escapeHtml(macro.title)}.swp</a>
        <a class="btn btn-secondary" href="${base}index.html#download">Get SwMacroFlow</a>
      </p>

      ${installBlock()}

      <div class="docs-markdown">${notes}</div>

      <aside class="doc-cta">
        <p>
          This macro runs by hand in the SOLIDWORKS VBA editor like any other. To run it across a
          whole folder of parts, assemblies or drawings unattended, use it inside
          <a href="${base}index.html">SwMacroFlow</a> - a free Windows app that chains macros and
          batches them over hundreds of files.
        </p>
      </aside>
    </article>

  </div>
</main>

${footer(base)}

<script src="${base}assets/nav.js" defer></script>
<script src="${base}assets/copy-path.js" defer></script>
</body>
</html>
`;
}

function docsIndexPage(groups, guides) {
  const base = "";
  const path = "/docs.html";
  const trail = [
    { name: "Home", path: "/" },
    { name: "Docs", path }
  ];

  const schema = [
    {
      "@type": "CollectionPage",
      "@id": `${ORIGIN}${path}#page`,
      name: "SwMacroFlow documentation",
      description:
        "Guides for running SOLIDWORKS macros in batch with SwMacroFlow: using the app, writing macros, adding inputs, reporting results and troubleshooting.",
      url: `${ORIGIN}${path}`,
      inLanguage: "en",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID },
      hasPart: guides.map(guide => ({
        "@type": "TechArticle",
        "@id": `${ORIGIN}${guide.path}#article`,
        headline: guide.heading,
        url: `${ORIGIN}${guide.path}`
      }))
    },
    breadcrumbs(trail)
  ];

  const sections = groups
    .map(group => {
      const cards = group.guides
        .map(
          guide => `<li class="doc-card">
          <h3><a href="docs/${guide.slug}/">${escapeHtml(guide.navTitle)}</a></h3>
          <p>${SwMarkdown.inlineMarkdown(guide.summary)}</p>
        </li>`
        )
        .join("\n        ");

      return `<section class="doc-group">
      <h2>${escapeHtml(group.title)}</h2>
      <ul class="doc-index">
        ${cards}
      </ul>
    </section>`;
    })
    .join("\n\n    ");

  return `${head({
    base,
    path,
    title: "SwMacroFlow documentation - SOLIDWORKS batch macro guides",
    description:
      "Guides for running SOLIDWORKS macros in batch with SwMacroFlow: using the app, writing a macro, adding inputs, reporting results, and troubleshooting.",
    schema
  })}
<body>

${nav(base, "docs")}

<main class="docs-page">
  <div class="docs-index-head">
    ${breadcrumbTrail(base, trail)}
    <p class="page-eyebrow">Documentation</p>
    <h1>SwMacroFlow documentation</h1>
    <p class="docs-index-lede">
      Everything from a first batch to the full macro authoring contract. The same guides ship inside
      the application - open SwMacroFlow and click <strong>Help</strong>.
    </p>
    <label class="docs-search">
      <span>Search guides</span>
      <input id="docFilter" type="search" placeholder="Filter by title or summary" autocomplete="off">
    </label>
  </div>

  <div class="docs-index-body" id="docIndex">
    ${sections}
  </div>

  <p class="docs-nav-status" id="docFilterEmpty" hidden>No guide matched your search.</p>
</main>

${footer(base)}

<script>
  // Filters cards that are already in the HTML. The previous version of this page fetched and
  // rendered every guide before it could show anything; now the content is the page.
  (function () {
    var input = document.getElementById("docFilter");
    var index = document.getElementById("docIndex");
    var empty = document.getElementById("docFilterEmpty");
    if (!input || !index) return;

    var cards = Array.prototype.slice.call(index.querySelectorAll(".doc-card"));
    var groups = Array.prototype.slice.call(index.querySelectorAll(".doc-group"));

    input.addEventListener("input", function () {
      var query = input.value.trim().toLowerCase();
      var shown = 0;

      cards.forEach(function (card) {
        var match = !query || card.textContent.toLowerCase().indexOf(query) !== -1;
        card.hidden = !match;
        if (match) shown += 1;
      });

      groups.forEach(function (group) {
        group.hidden = !group.querySelector(".doc-card:not([hidden])");
      });

      empty.hidden = shown > 0;
    });
  })();
</script>

<script src="assets/nav.js" defer></script>
</body>
</html>
`;
}

function macrosIndexPage(macros) {
  const base = "";
  const path = "/macros.html";
  const repoUrl = `https://github.com/${MACRO_LIBRARY.owner}/${MACRO_LIBRARY.repo}`;
  const trail = [
    { name: "Home", path: "/" },
    { name: "Macros", path }
  ];

  const schema = [
    {
      "@type": "CollectionPage",
      "@id": `${ORIGIN}${path}#page`,
      name: "SOLIDWORKS macro library",
      description:
        "Free SOLIDWORKS VBA macros you can download and run on their own or batch across folders with SwMacroFlow.",
      url: `${ORIGIN}${path}`,
      inLanguage: "en",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID }
    },
    {
      "@type": "ItemList",
      "@id": `${ORIGIN}${path}#list`,
      name: "Free SOLIDWORKS macros",
      numberOfItems: macros.length,
      itemListElement: macros.map((macro, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${ORIGIN}${macro.path}`,
        name: macro.title
      }))
    },
    breadcrumbs(trail)
  ];

  const cards = macros
    .map(
      macro => `<article class="macro-card">
        <span class="macro-file">.swp macro</span>
        <h2><a class="macro-card-link" href="macros/${macro.slug}/">${escapeHtml(macro.navTitle)}</a></h2>
        <p class="macro-description">${SwMarkdown.inlineMarkdown(macro.summary)}</p>
      </article>`
    )
    .join("\n\n      ");

  return `${head({
    base,
    path,
    title: "Free SOLIDWORKS macros - downloadable .swp macro library",
    description:
      "Free SOLIDWORKS VBA macros to download: batch export to PDF, change document units, swap drawing sheet formats, insert blocks, and reduce file size.",
    schema
  })}
<body>

${nav(base, "macros")}

<main class="macros-page">
  <section class="macros-hero" aria-labelledby="macros-title">
    <div>
      ${breadcrumbTrail(base, trail)}
      <p class="page-eyebrow">Macro library</p>
      <h1 id="macros-title">Free SOLIDWORKS macros, ready to download.</h1>
      <p>
        Every macro here is plain SOLIDWORKS VBA in a <code>.swp</code> file. Each one runs on its own
        in the VBA editor, and runs across a whole folder unattended inside
        <a href="index.html">SwMacroFlow</a>. Open a macro to read its notes and download it.
      </p>
    </div>
    <a class="btn btn-secondary" href="${repoUrl}" target="_blank" rel="noopener">View source repo</a>
  </section>

  <section class="macro-browser">
    <div class="macro-toolbar">
      <label class="macro-search">
        <span>Search macros</span>
        <input id="macroFilter" type="search" placeholder="Search by name or description">
      </label>
      <div class="macro-toolbar-end">
        <div id="macroCount" class="macro-count">${macros.length} macros</div>
        <a class="btn btn-secondary btn-compact"
           href="${repoUrl}/archive/refs/heads/${MACRO_LIBRARY.branch}.zip"
           title="Downloads the whole repository as a zip. Extract the Macros folder into your macro folder.">
          Download all (.zip)
        </a>
      </div>
    </div>

    <div id="macroStatus" class="macro-status" hidden></div>
    <div id="macroGrid" class="macro-grid">
      ${cards}
    </div>
  </section>

  <section class="macro-install-note">
    ${installBlock()}
  </section>
</main>

${footer(base)}

<script>
  // Same filter as the docs index: the cards are in the HTML, this only hides them.
  (function () {
    var input = document.getElementById("macroFilter");
    var grid = document.getElementById("macroGrid");
    var count = document.getElementById("macroCount");
    var status = document.getElementById("macroStatus");
    if (!input || !grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll(".macro-card"));

    input.addEventListener("input", function () {
      var query = input.value.trim().toLowerCase();
      var shown = 0;

      cards.forEach(function (card) {
        var match = !query || card.textContent.toLowerCase().indexOf(query) !== -1;
        card.hidden = !match;
        if (match) shown += 1;
      });

      count.textContent = shown + " of " + cards.length + " macros";
      status.hidden = shown > 0;
      status.textContent = shown ? "" : "No macros matched your search.";
    });
  })();
</script>

<script src="assets/nav.js" defer></script>
<script src="assets/copy-path.js" defer></script>
</body>
</html>
`;
}

// ---------- sitemap and llms.txt ----------

/* Generated rather than hand-kept. The hand-kept one had an unclosed <url> in it, which made the
   whole file unparseable and silently cost the site every submitted URL. */
function sitemap(entries) {
  const urls = entries
    .map(entry => {
      const parts = [`    <loc>${ORIGIN}${entry.path}</loc>`];
      if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
      if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/build-site.mjs. Do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function llmsTxt(guides, macros) {
  const guideLines = guides.map(guide => `- [${guide.title}](${ORIGIN}${guide.path}): ${guide.summary}`);
  const macroLines = macros.map(macro => `- [${macro.title}](${ORIGIN}${macro.path}): ${macro.summary}`);

  return `# SwMacroFlow

> A free standalone Windows application that runs chains of SOLIDWORKS VBA macros across hundreds of
> parts, assemblies and drawings unattended. It opens each file once, runs every macro selected
> against it in order, closes it, and records what each macro reported.

SwMacroFlow drives an installed, licensed x64 SOLIDWORKS session from outside. Nothing is registered
or installed inside SOLIDWORKS itself, and it needs no administrator rights. It is free with every
feature included: macro chaining, batch runs across folders, parallel batches across two to four
SOLIDWORKS instances, a bundled macro library, an AI Copilot side panel (bring your own API key,
with image, PDF, Word and text attachments), and Windows Task Scheduler integration. There is no
trial, no licence, no account, and nothing to buy.

## Product

- [Home](${ORIGIN}/): what SwMacroFlow does, how a batch runs, and the download.
- [Documentation](${ORIGIN}/docs.html): every guide, from a first batch to the macro authoring contract.
- [Macro library](${ORIGIN}/macros.html): free SOLIDWORKS .swp macros to download.

## Guides

${guideLines.join("\n")}

## Macros

${macroLines.join("\n")}

## Policies

- [Terms of use](${ORIGIN}/terms.html)
- [Privacy policy](${ORIGIN}/privacy.html): the site uses no analytics and no advertising tracking.
- [Contact](${ORIGIN}/contact.html): info@swmacroflow.in
`;
}

/* downloads.json, read by assets/downloads.js. Resolved here rather than in the browser so that
   a visitor's page load still talks to nobody but GitHub Pages and Supabase, which is what
   privacy.html promises. Weekly, via the cron that already refreshes the macro library, is as
   current as this number needs to be. */
async function writeDownloadTotal() {
  const total = await releaseDownloadTotal();
  const label = `${RELEASES_REPO.owner}/${RELEASES_REPO.repo}`;

  // A blip at the API must never blank a number that is already published, so the committed file is
  // left exactly as it is and the site goes on showing the last good count.
  if (total === null) {
    console.warn(`  ! download count for ${label} could not be fetched - leaving downloads.json as it is`);
    return;
  }

  console.log(`  ${total} downloads from ${label}`);

  // Published as it stands, with no threshold in front of it. A real count that happens to be
  // small is still the true one, and the page says plainly what it is.
  await write("downloads.json", JSON.stringify({
    _comment: "Generated by tools/build-site.mjs - do not edit. total is the installer downloads GitHub reports across every release. assets/downloads.js shows nothing only when the number is missing, which means the build could not reach the API.",
    total
  }, null, 2) + "\n");
}

// ---------- build ----------

async function build() {
  console.log("Building swmacroflow.in");

  const seoMeta = await loadSeoMeta();
  const { guides, groups } = await loadGuides(seoMeta);
  console.log(`  ${guides.length} guides from docs/`);

  const macros = await loadMacros(seoMeta);
  console.log(`  ${macros.length} macros from ${MACRO_LIBRARY.owner}/${MACRO_LIBRARY.repo}`);

  await writeDownloadTotal();

  for (const [index, guide] of guides.entries()) {
    await write(`docs/${guide.slug}/index.html`, guidePage(guide, groups, guides[index - 1], guides[index + 1]));
  }

  for (const macro of macros) {
    await write(`macros/${macro.slug}/index.html`, macroPage(macro, macros));
  }

  await write("docs.html", docsIndexPage(groups, guides));
  await write("macros.html", macrosIndexPage(macros));

  const staticPages = [
    { path: "/", changefreq: "weekly", priority: "1.0", lastmod: gitLastModified("index.html") },
    { path: "/docs.html", changefreq: "monthly", priority: "0.8", lastmod: gitLastModified("docs") },
    { path: "/macros.html", changefreq: "weekly", priority: "0.8", lastmod: macros[0]?.lastmod || null },
    { path: "/contact.html", changefreq: "yearly", priority: "0.4", lastmod: gitLastModified("contact.html") },
    { path: "/terms.html", changefreq: "yearly", priority: "0.3", lastmod: gitLastModified("terms.html") },
    { path: "/privacy.html", changefreq: "yearly", priority: "0.3", lastmod: gitLastModified("privacy.html") }
  ];

  await write(
    "sitemap.xml",
    sitemap([
      ...staticPages,
      ...guides.map(guide => ({ path: guide.path, lastmod: guide.lastmod, changefreq: "monthly", priority: "0.7" })),
      ...macros.map(macro => ({ path: macro.path, lastmod: macro.lastmod, changefreq: "monthly", priority: "0.7" }))
    ])
  );

  await write("llms.txt", llmsTxt(guides, macros));

  console.log(`Done: ${staticPages.length + guides.length + macros.length} URLs in the sitemap.`);
}

await build();
