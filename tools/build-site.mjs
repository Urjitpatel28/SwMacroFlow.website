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

/* The two metadata lines each macro document carries under its lede:

       **Category:** Export
       **Applies to:** Parts, Assemblies

   They are prose in the file because the desktop app renders the same document in its help pane and
   has no schema to put them in. Here they are structure - the category drives the index page's
   filters, and "applies to" is the question a reader actually arrives with ("does this work on my
   drawings?"). Lifted out rather than left in place, because rendered they are two stray bold lines
   sitting between the lede and the first heading of every page.

   A document without the lines is not an error: the five macros published before this convention
   existed still have to build. Category falls back to Utility, which is where an uncategorised
   utility belongs anyway, and the chips are simply omitted. */
const DOC_TYPES = [
  { key: "parts", label: "PRT", full: "Parts" },
  { key: "assemblies", label: "ASM", full: "Assemblies" },
  { key: "drawings", label: "DRW", full: "Drawings" }
];

function parseMacroMeta(markdown) {
  const read = field => {
    const match = markdown.match(new RegExp(`^\\*\\*${field}:\\*\\*\\s*(.+)$`, "mi"));
    return match ? match[1].trim() : "";
  };

  const category = read("Category") || "Utility";

  // Matched on the word rather than split on the comma, so "Parts and assemblies" and
  // "Parts, Assemblies" both read the same and a stray "and" never becomes a fourth chip.
  const appliesRaw = read("Applies to").toLowerCase();
  const appliesTo = DOC_TYPES.filter(type => appliesRaw.includes(type.key)).map(type => type.key);

  // Lifting the lines out leaves the blank line above them next to the blank line below them, so
  // the run is collapsed rather than left as a double gap the renderer would turn into an empty
  // paragraph.
  const body = markdown
    .replace(/^\*\*(?:Category|Applies to):\*\*.*(?:\r?\n)?/gim, "")
    .replace(/(\r?\n){3,}/g, "$1$1")
    .replace(/^(?:[ \t]*\r?\n)+/, "");

  return { category, appliesTo, body };
}

/* Macro documents link to each other by file name - [Save STEP](Save%20STEP.md) - which is correct
   in the library repo and in the app's help pane, and a dead link on the website, where each
   document lives at /macros/<slug>/ and no .md file is served at all. Rewritten rather than
   forbidden: cross-references are the most useful thing these documents do, and an author should
   not have to know where the site puts them.

   Only links whose target is actually published are rewritten. One pointing at HelloWorld, or at a
   document that never reached the library, is left as it was - a visibly broken link in a preview
   is a better outcome than a confident link to a page that 404s. */
function rewriteDocLinks(text, slugs) {
  return text.replace(/\]\(([^)\s]+?)\.md\)/g, (whole, target) => {
    let decoded;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      return whole;
    }

    const slug = slugify(decoded);
    return slugs.has(slug) ? `](/macros/${slug}/)` : whole;
  });
}

/* Descriptions are cut at a word boundary rather than mid-word: a snippet Google truncates itself
   is fine, one the site truncates badly is not. The default is sized for a meta description;
   visible ledes and cards pass DISPLAY_LIMIT so a two-sentence macro summary shows in full. */
const DISPLAY_LIMIT = 200;

function clamp(text, limit = 158) {
  // Link syntax is flattened to the text it wraps rather than carried through: these strings
  // become a meta description, a lede, and a row inside an element that is already one big link.
  const clean = String(text)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

/*
  Editorial guides at /guides/<slug>/. A third source directory beside docs/ and the macro library.

  These are search-facing articles rather than product documentation, which is why they carry Article
  schema and an authored publication date the docs do not have, and why they get their own hub rather
  than being folded into /docs/. A reader who arrives on "free SOLIDWORKS batch tools" wants a
  different page from the one who clicked Help inside the application.

  Called "articles" everywhere in this file because "guides" already means the pages under /docs/:
  loadGuides, guidePage and guideSidebar all predate this, and renaming them would churn the one code
  path that is already deployed and working.
*/
async function loadArticles(seoMeta) {
  let manifest;

  try {
    manifest = JSON.parse(await readFile(join(ROOT, "guides", "manifest.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    // A checkout without guides/ still builds and still deploys. The thing that must never ship
    // ahead of the content is the nav link, which would point every page on the site at a 404.
    console.warn("  ! guides/manifest.json is missing - no guides will be published");
    return { articles: [], articleGroups: [] };
  }

  const files = await readdir(join(ROOT, "guides"));
  const present = new Set(files.filter(name => name.endsWith(".md")).map(name => name.replace(/\.md$/, "")));

  const articles = [];
  const articleGroups = [];

  for (const group of manifest.groups || []) {
    const members = [];

    for (const entry of group.guides || []) {
      const name = typeof entry === "string" ? entry : entry.file;

      if (!present.has(name)) {
        console.warn(`  ! guides/manifest.json lists ${name}, which has no .md file - skipped`);
        continue;
      }

      const markdown = await readFile(join(ROOT, "guides", `${name}.md`), "utf8");
      const slug = slugify(name);
      const title = SwMarkdown.firstHeading(markdown) || slug.replace(/-/g, " ");
      const meta = (seoMeta.guides || {})[slug] || {};

      const article = {
        name,
        slug,
        title,
        heading: meta.heading || title,
        navTitle: meta.navTitle || title,
        group: group.title,
        // "comparison" changes the eyebrow and lets the page carry mentions[]. It is deliberately
        // not a separate code path - that is the whole reason these are not under a /compare/ prefix.
        kind: entry.kind || "guide",
        markdown,
        faq: extractFaq(markdown, slug),
        mentions: entry.mentions || [],
        related: entry.related || [],
        published: entry.published || null,
        summary: clamp(firstProse(markdown, title) || meta.description || title, DISPLAY_LIMIT),
        seoTitle: meta.title ? `${meta.title} | SwMacroFlow` : `${title} - SwMacroFlow`,
        seoDescription: clamp(meta.description || firstProse(markdown, title) || title),
        path: `/guides/${slug}/`,
        lastmod: gitLastModified(`guides/${name}.md`)
      };

      // A guide sharing a nav hub with the documentation sets an expectation about depth. Three
      // substantial guides is a strong section; eight stubs drags the whole domain down, and nothing
      // else in this build would ever notice it happening.
      const words = markdown.split(/\s+/).filter(Boolean).length;
      if (words < 600) {
        console.warn(`  ! ${slug} is ${words} words - thin for a search-facing guide`);
      }

      // Google ignores a headline over roughly 110 characters rather than truncating it, so warn
      // rather than clamp: a silently dropped property is worse than a long one.
      if (article.heading.length > 110) {
        console.warn(`  ! ${slug} heading is ${article.heading.length} characters - over the ~110 headline limit`);
      }

      articles.push(article);
      members.push(article);
    }

    if (members.length) articleGroups.push({ title: group.title, articles: members });
  }

  return { articles, articleGroups };
}

/* An FAQPage node is emitted only when the document actually contains an FAQ: an "## FAQ" heading
   with "###" questions under it. Driven by the document's own structure rather than by a flag in the
   manifest, because a flag can be set on a page with no FAQ, or forgotten on one that has a good
   one - and then the structured data disagrees with the visible page, which is the case Google
   treats as spam rather than as a mistake. */
function extractFaq(markdown, slug) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex(line => /^##\s+(FAQ|Frequently asked questions)\s*$/i.test(line.trim()));

  if (start === -1) {
    // Silence is the failure mode to guard against here: an author who writes "## Common questions"
    // gets no FAQ node and no error, and nobody finds out for months.
    if (lines.some(line => /^##\s+.*(questions|q ?& ?a)\s*$/i.test(line.trim()))) {
      console.warn(`  ! ${slug}: a heading looks like an FAQ but is not "## FAQ" - no FAQPage emitted`);
    }
    return [];
  }

  const entries = [];

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^##\s/.test(line)) break;

    const question = /^###\s+(.*)$/.exec(line);
    if (question) {
      entries.push({ question: question[1].trim(), answer: [] });
      continue;
    }

    if (entries.length && line) entries[entries.length - 1].answer.push(line);
  }

  return entries
    .map(entry => ({
      question: entry.question,
      answer: clamp(entry.answer.join(" ").replace(/[*`]/g, ""), 1000)
    }))
    .filter(entry => entry.question && entry.answer);
}

/* A related[] entry naming a page that does not exist is dropped with a warning rather than
   emitted. Macros come from a live fetch of the library repo, so one can genuinely disappear between
   builds, and a confident link to a 404 is worse than a missing link. This is the rule
   rewriteDocLinks already follows for links written inside the macro documents. */
function resolveRelated(articles, known) {
  for (const article of articles) {
    article.related = (article.related || [])
      .map(path => {
        if (!known.has(path)) {
          console.warn(`  ! ${article.slug}: related "${path}" is not a published page - dropped`);
          return null;
        }
        return { href: path, title: known.get(path) };
      })
      .filter(Boolean);
  }
}

/* Cross-links are declared once, on the guide, and the reverse direction is derived here. Declaring
   both ends by hand is how a link graph goes stale: someone deletes a guide and the doc page it
   pointed at keeps its link to a 404. Derived, deleting the guide deletes both ends.

   Sorted, because the map would otherwise iterate in manifest order and the committed HTML would
   flap every time a guide was reordered. */
function invertRelated(articles) {
  const map = new Map();

  for (const article of articles) {
    for (const target of article.related) {
      if (!map.has(target.href)) map.set(target.href, []);
      map.get(target.href).push({ href: article.path, title: article.navTitle });
    }
  }

  for (const list of map.values()) list.sort((a, b) => a.href.localeCompare(b.href));
  return map;
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

    const { category, appliesTo, body } = parseMacroMeta(markdown);

    macros.push({
      name: entry.name,
      slug,
      title,
      heading: meta.heading || title,
      navTitle: meta.navTitle || title,
      markdown: body,
      category,
      appliesTo,
      summary: clamp(entry.summary || firstProse(body, title) || title, DISPLAY_LIMIT),
      seoTitle: meta.title ? `${meta.title} | SwMacroFlow` : `${title} - SOLIDWORKS macro | SwMacroFlow`,
      seoDescription: clamp(meta.description || entry.summary || firstProse(body, title) || title),
      downloadUrl: rawUrl(entry.macroPath),
      fileName: decodeURIComponent(entry.macroPath.split("/").pop()),
      path: `/macros/${slug}/`,
      lastmod
    });
  }

  macros.sort((a, b) => a.title.localeCompare(b.title));
  if (!macros.length) throw new Error("Every macro was excluded - refusing to publish an empty macro index.");

  // After the loop, not inside it: a link is only rewritten to a page that exists, and which pages
  // exist is not known until every entry has been read and the excluded ones dropped.
  // Bodies only. A summary has already been through clamp(), which flattens a link to its text,
  // because a meta description cannot carry markup and a row that is itself one big link cannot
  // carry another inside it.
  const slugs = new Set(macros.map(macro => macro.slug));
  for (const macro of macros) {
    macro.markdown = rewriteDocLinks(macro.markdown, slugs);
  }

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

/* The sidebar block that carries cross-silo links, in both directions: a guide's own "Related pages"
   and, on a doc or macro page, the guides that pointed at it. Reuses the docs-nav markup so it needs
   no CSS of its own. */
function relatedNav(base, items, label = "Related guides") {
  const links = items
    .map(item => `<li><a href="${base}${item.href.replace(/^\//, "")}">${escapeHtml(item.title)}</a></li>`)
    .join("\n          ");

  return `<p class="docs-nav-group">${escapeHtml(label)}</p>
      <nav class="docs-nav" aria-label="${escapeHtml(label)}">
        <ul>
          ${links}
        </ul>
      </nav>`;
}

function articleSidebar(groups, currentSlug, base) {
  const blocks = groups.map(group => {
    const items = group.articles
      .map(article => {
        const active = article.slug === currentSlug ? ' class="is-active" aria-current="page"' : "";
        return `<li><a href="${base}guides/${article.slug}/"${active}>${escapeHtml(article.navTitle)}</a></li>`;
      })
      .join("\n          ");

    return `<p class="docs-nav-group">${escapeHtml(group.title)}</p>
        <ul>
          ${items}
        </ul>`;
  });

  return `<nav class="docs-nav" aria-label="Guides">
        ${blocks.join("\n        ")}
      </nav>`;
}

/* `relatedGuides` is optional and defaults to empty, which emits byte-identical output to the
   version of this function that existed before guides did. That matters: it keeps the workflow's
   stale-output check quiet for every doc page no guide happens to reference. */
function guidePage(guide, groups, previous, next, relatedGuides = []) {
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
      ${guideSidebar(groups, guide.slug, base)}${relatedGuides.length ? `\n      ${relatedNav(base, relatedGuides)}` : ""}
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

function articlePage(article, groups, previous, next) {
  const base = "/";
  const trail = [
    { name: "Home", path: "/" },
    { name: "Guides", path: "/guides.html" },
    { name: article.navTitle, path: article.path }
  ];

  /* Article rather than BlogPosting. Google treats the two identically for rich results, so the
     choice is only about describing the site honestly - BlogPosting asserts a Blog, which would
     imply a reverse-chronological index and a publication cadence that do not exist. These are
     evergreen pages edited in place. author and publisher both point at the Organization node the
     homepage already defines, so no new entity is invented to satisfy the author requirement. */
  const schema = [
    {
      "@type": "Article",
      "@id": `${ORIGIN}${article.path}#article`,
      headline: article.heading,
      description: article.seoDescription,
      url: `${ORIGIN}${article.path}`,
      mainEntityOfPage: { "@id": `${ORIGIN}${article.path}` },
      inLanguage: "en",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID },
      author: { "@id": ORGANIZATION_ID },
      publisher: { "@id": ORGANIZATION_ID },
      ...(article.published ? { datePublished: article.published } : {}),
      ...(article.lastmod || article.published
        ? { dateModified: article.lastmod || article.published }
        : {}),
      /* Name and URL only. A Review or AggregateRating node about a competitor - or about our own
         product - is self-serving markup and carries a manual action, so the comparison pages say
         who they discuss and stop there. */
      ...(article.mentions.length
        ? {
            mentions: article.mentions.map(mention => ({
              "@type": "SoftwareApplication",
              name: mention.name,
              url: mention.url
            }))
          }
        : {})
    },
    ...(article.faq.length
      ? [
          {
            "@type": "FAQPage",
            "@id": `${ORIGIN}${article.path}#faq`,
            isPartOf: { "@id": WEBSITE_ID },
            mainEntity: article.faq.map(entry => ({
              "@type": "Question",
              name: entry.question,
              acceptedAnswer: { "@type": "Answer", text: entry.answer }
            }))
          }
        ]
      : []),
    breadcrumbs(trail)
  ];

  const body = SwMarkdown.toHtml(article.markdown, { stripFirstHeading: true });
  const eyebrow = article.kind === "comparison" ? "Comparison" : "Guide";

  return `${head({
    base,
    path: article.path,
    title: article.seoTitle,
    description: article.seoDescription,
    schema
  })}
<body>

${nav(base, "guides")}

<main class="docs-page">
  <div class="docs-layout">

    <aside class="docs-sidebar">
      ${articleSidebar(groups, article.slug, base)}${
        article.related.length ? `\n      ${relatedNav(base, article.related, "Related pages")}` : ""
      }
    </aside>

    <article class="docs-content">
      ${breadcrumbTrail(base, trail)}
      <p class="page-eyebrow">${eyebrow}</p>
      <h1>${escapeHtml(article.heading)}</h1>
      <div class="docs-markdown">${body}</div>

      ${pager(
        previous ? { href: `${base}guides/${previous.slug}/`, title: previous.navTitle } : null,
        next ? { href: `${base}guides/${next.slug}/`, title: next.navTitle } : null
      )}

      <aside class="doc-cta">
        <p>
          <a href="${base}index.html">SwMacroFlow</a> is a free Windows app that batch-runs
          SOLIDWORKS macros across folders of parts, assemblies and drawings. Every feature is
          included, with no account and no licence key.
          <a href="${base}index.html#download">Download it</a>, browse the
          <a href="${base}macros.html">macro library</a>, or read the
          <a href="${base}docs.html">documentation</a>.
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

/* Declared rather than derived from the data, so the filter bar and the sidebar keep a stable order
   as macros are added: Export and Properties are the two anyone came for, and the order does not
   reshuffle the day a fifth Drawing macro overtakes a category above it. A category that turns up in
   a document without being listed here still renders - it sorts to the end rather than disappearing,
   which is the failure mode you can see. */
const CATEGORY_ORDER = ["Export", "Properties", "Drawing", "Utility"];

function categoryRank(category) {
  const at = CATEGORY_ORDER.indexOf(category);
  return at === -1 ? CATEGORY_ORDER.length : at;
}

function categoryGroups(macros) {
  const seen = new Map();
  for (const macro of macros) {
    if (!seen.has(macro.category)) seen.set(macro.category, []);
    seen.get(macro.category).push(macro);
  }

  return [...seen.entries()]
    .map(([title, entries]) => ({ title, key: slugify(title), macros: entries }))
    .sort((a, b) => categoryRank(a.title) - categoryRank(b.title) || a.title.localeCompare(b.title));
}

function macroTag(macro) {
  return `<span class="macro-tag" data-tag="${escapeHtml(slugify(macro.category))}">${escapeHtml(macro.category)}</span>`;
}

/* PRT / ASM / DRW rather than the full words: three short chips fit on one line beside a summary at
   every width, and these are the abbreviations the file extensions already use. The full word is on
   the title attribute, and repeated in the visually hidden text so a screen reader is not read three
   consonant clusters. */
function appliesChips(macro) {
  if (!macro.appliesTo.length) return "";

  const chips = DOC_TYPES.filter(type => macro.appliesTo.includes(type.key))
    .map(
      type =>
        `<span class="macro-chip" title="${type.full}">${type.label}<span class="visually-hidden"> ${type.full}</span></span>`
    )
    .join("");

  return `<p class="macro-applies">${chips}</p>`;
}

function macroPage(macro, macros, relatedGuides = []) {
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

  /* Grouped by category rather than one flat list. At five macros a flat list was the whole library
     and fine; at sixteen it is a column of near-identical "Save …" links, and the reader arriving on
     Save STEP is usually looking for the other export they half-remember. The macro's own category
     is listed first, because that is where the neighbour they want almost always is. */
  const others = categoryGroups(macros)
    .sort((a, b) => (a.title === macro.category ? -1 : b.title === macro.category ? 1 : 0))
    .map(group => {
      const items = group.macros
        .map(other => {
          const active = other.slug === macro.slug ? ' class="is-active" aria-current="page"' : "";
          return `<li><a href="${base}macros/${other.slug}/"${active}>${escapeHtml(other.navTitle)}</a></li>`;
        })
        .join("\n          ");

      return `<p class="docs-nav-group">${escapeHtml(group.title)}</p>
      <nav class="docs-nav" aria-label="${escapeHtml(group.title)} macros">
        <ul>
          ${items}
        </ul>
      </nav>`;
    })
    .join("\n      ");

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
      ${others}
      <p class="docs-nav-group">Writing your own</p>
      <nav class="docs-nav" aria-label="Writing your own">
        <ul>
          <li><a href="${base}docs/writing-a-macro/">Writing a macro</a></li>
          <li><a href="${base}docs/adding-inputs/">Adding inputs</a></li>
        </ul>
      </nav>${relatedGuides.length ? `\n      ${relatedNav(base, relatedGuides)}` : ""}
    </aside>

    <article class="docs-content">
      ${breadcrumbTrail(base, trail)}
      <p class="page-eyebrow">.swp macro</p>
      <h1>${escapeHtml(macro.heading)}</h1>
      <p class="macro-lede">${SwMarkdown.inlineMarkdown(macro.summary)}</p>

      <div class="macro-meta">
        ${macroTag(macro)}
        ${appliesChips(macro)}
      </div>

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

/* No filter box, unlike docs.html and macros.html. Those index sixteen and seven items; this one
   indexes three, and a search field over three cards is furniture. Leaving it out also means this
   page ships no inline <script> that has to be kept in step with the other two. */
function guidesIndexPage(groups, articles) {
  const base = "";
  const path = "/guides.html";
  const trail = [
    { name: "Home", path: "/" },
    { name: "Guides", path }
  ];

  const schema = [
    {
      "@type": "CollectionPage",
      "@id": `${ORIGIN}${path}#page`,
      name: "SOLIDWORKS batch processing guides",
      description:
        "Guides on batch processing SOLIDWORKS files: running a macro across multiple files, Task Scheduler alternatives, and whether you need an add-in.",
      url: `${ORIGIN}${path}`,
      inLanguage: "en",
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": SOFTWARE_ID }
    },
    {
      "@type": "ItemList",
      "@id": `${ORIGIN}${path}#list`,
      numberOfItems: articles.length,
      itemListElement: articles.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: article.heading,
        url: `${ORIGIN}${article.path}`
      }))
    },
    breadcrumbs(trail)
  ];

  const sections = groups
    .map(group => {
      const cards = group.articles
        .map(
          article => `<li class="doc-card">
          <h3><a href="guides/${article.slug}/">${escapeHtml(article.navTitle)}</a></h3>
          <p>${SwMarkdown.inlineMarkdown(article.summary)}</p>
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
    title: "SOLIDWORKS batch processing guides | SwMacroFlow",
    description:
      "How to run a SOLIDWORKS macro on multiple files, what to use instead of Task Scheduler, and whether batch processing needs an add-in. Free guides, no sign-up.",
    schema
  })}
<body>

${nav(base, "guides")}

<main class="docs-page">
  <div class="docs-index-head">
    ${breadcrumbTrail(base, trail)}
    <p class="page-eyebrow">Guides</p>
    <h1>SOLIDWORKS batch processing guides</h1>
    <p class="docs-index-lede">
      Practical answers to the questions people actually ask about automating SOLIDWORKS across
      folders of files - including honest comparisons of the tools that are not ours. For how
      SwMacroFlow itself works, see the <a href="docs.html">documentation</a>.
    </p>
  </div>

  <div class="docs-index-body">
    ${sections}
  </div>
</main>

${footer(base)}

<script src="assets/nav.js" defer></script>
</body>
</html>
`;
}

function macrosIndexPage(macros) {
  const base = "";
  const path = "/macros.html";
  const repoUrl = `https://github.com/${MACRO_LIBRARY.owner}/${MACRO_LIBRARY.repo}`;
  const groups = categoryGroups(macros);
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

  /* Counted here rather than in the browser. A pill that says "Export 6" before any script has run
     is a fact about the library; one that fills itself in on load is a number that flickers, and is
     simply absent for anything reading the HTML rather than running it. */
  const pills = [
    `<button class="macro-pill is-active" type="button" data-filter="all" aria-pressed="true">All<span class="macro-pill-n">${macros.length}</span></button>`,
    ...groups.map(
      group =>
        `<button class="macro-pill" type="button" data-filter="${escapeHtml(group.key)}" aria-pressed="false">${escapeHtml(group.title)}<span class="macro-pill-n">${group.macros.length}</span></button>`
    )
  ].join("\n          ");

  /* One row per macro, and the row is the whole record: what it is called, what it does, what it
     runs on, which group it belongs to, and the file itself. The number is a CSS counter over the
     rows still showing, so filtering renumbers 01..N instead of leaving the gaps that make a
     filtered list look broken. */
  const rows = macros
    .map(
      macro => `<li class="macro-row" data-category="${escapeHtml(slugify(macro.category))}">
        <span class="macro-row-n" aria-hidden="true"></span>
        <div class="macro-row-main">
          <h2 class="macro-row-title"><a class="macro-row-link" href="macros/${macro.slug}/">${escapeHtml(macro.navTitle)}</a></h2>
          <p class="macro-row-summary">${SwMarkdown.inlineMarkdown(macro.summary)}</p>
          ${appliesChips(macro)}
        </div>
        ${macroTag(macro)}
        <a class="macro-dl" href="${escapeHtml(macro.downloadUrl)}" download>
          <span class="macro-dl-arrow" aria-hidden="true"></span>.swp<span class="visually-hidden"> - download ${escapeHtml(macro.fileName)}</span>
        </a>
      </li>`
    )
    .join("\n\n      ");

  return `${head({
    base,
    path,
    title: "Free SOLIDWORKS macros - downloadable .swp macro library",
    description:
      "Free SOLIDWORKS VBA macros to download: batch export to PDF and STEP, read and write custom properties, swap drawing sheet formats, insert blocks, and reduce file size.",
    schema
  })}
<body>

${nav(base, "macros")}

<main class="macros-page">
  <section class="macros-hero" aria-labelledby="macros-title">
    <div>
      ${breadcrumbTrail(base, trail)}
      <p class="page-eyebrow">Macro library</p>
      <h1 id="macros-title">A library of SOLIDWORKS macros, ready to download.</h1>
      <p>
        Every macro here is plain SOLIDWORKS VBA in a <code>.swp</code> file. Each one runs on its own
        in the VBA editor, and runs across a whole folder unattended inside
        <a href="index.html">SwMacroFlow</a>. Open a macro to read its notes, or take the file directly.
      </p>
      <ul class="macro-stats">
        <li><strong>${macros.length}</strong> macros</li>
        <li><strong>${groups.length}</strong> groups</li>
        <li><strong>Free</strong> and MIT licensed</li>
      </ul>
    </div>
    <a class="btn btn-secondary" href="${repoUrl}" target="_blank" rel="noopener">View source repo</a>
  </section>

  <section class="macro-browser">
    <div class="macro-toolbar">
      <div class="macro-pills" role="group" aria-label="Filter by category">
        ${pills}
      </div>
      <div class="macro-toolbar-end">
        <label class="macro-search">
          <span class="visually-hidden">Search macros</span>
          <input id="macroFilter" type="search" placeholder="Search macros">
        </label>
        <a class="btn btn-secondary btn-compact"
           href="${repoUrl}/archive/refs/heads/${MACRO_LIBRARY.branch}.zip"
           title="Downloads the whole repository as a zip. Extract the Macros folder into your macro folder.">
          Download all (.zip)
        </a>
      </div>
    </div>

    <p id="macroCount" class="macro-count" role="status">${macros.length} macros</p>
    <div id="macroStatus" class="macro-status" hidden></div>

    <ol id="macroIndex" class="macro-index">
      ${rows}
    </ol>
  </section>

  <section class="macro-install-note">
    ${installBlock()}

    <!-- The library answers "run someone else's macro". This answers the next question, and the
         answer is not ours. Nested inside the install note rather than beside it so it inherits
         that section's 760px column instead of running the full width of the page. -->
    <aside class="doc-cta">
      <p>
        Want to write your own instead of running ours? Learn the SOLIDWORKS API properly at
        <a href="https://www.cadsharp.com/" target="_blank" rel="noopener">CADSharp</a> &mdash; API
        video tutorials, developer guides, and live training. Shout-out to Keith, who has been
        teaching this stuff to the rest of us for years.
      </p>
    </aside>
  </section>
</main>

${footer(base)}

<script>
  // Every row is already in the HTML; this only hides them. Two independent filters - the category
  // pill and the search box - and a row shows when it passes both, so narrowing one never silently
  // undoes the other.
  (function () {
    var input = document.getElementById("macroFilter");
    var index = document.getElementById("macroIndex");
    var count = document.getElementById("macroCount");
    var status = document.getElementById("macroStatus");
    var pills = document.querySelectorAll(".macro-pill");
    if (!index) return;

    var rows = Array.prototype.slice.call(index.querySelectorAll(".macro-row"));
    var category = "all";

    function apply() {
      var query = input ? input.value.trim().toLowerCase() : "";
      var shown = 0;

      rows.forEach(function (row) {
        var inCategory = category === "all" || row.getAttribute("data-category") === category;
        var matches = !query || row.textContent.toLowerCase().indexOf(query) !== -1;
        var show = inCategory && matches;
        row.hidden = !show;
        if (show) shown += 1;
      });

      count.textContent = shown === rows.length
        ? rows.length + " macros"
        : shown + " of " + rows.length + " macros";
      status.hidden = shown > 0;
      status.textContent = shown ? "" : "No macros matched. Clear the search or choose All.";
    }

    Array.prototype.forEach.call(pills, function (pill) {
      pill.addEventListener("click", function () {
        category = pill.getAttribute("data-filter");
        Array.prototype.forEach.call(pills, function (other) {
          var active = other === pill;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", active ? "true" : "false");
        });
        apply();
      });
    });

    if (input) input.addEventListener("input", apply);
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

/* Takes an object rather than positional arguments so that adding a fourth section later does not
   silently reshuffle the existing three at every call site.

   Note the section rename: what this file called "## Guides" was always the documentation, back when
   that was the only long-form content on the site. Now that /guides/ exists and means something
   else, the docs section is "## Documentation" - which is what it should have said all along. */
function llmsTxt({ docs, articles, macros }) {
  const docLines = docs.map(guide => `- [${guide.title}](${ORIGIN}${guide.path}): ${guide.summary}`);
  const articleLines = articles.map(article => `- [${article.title}](${ORIGIN}${article.path}): ${article.summary}`);
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
- [Guides](${ORIGIN}/guides.html): how-to and comparison articles on batch processing SOLIDWORKS files.
- [Macro library](${ORIGIN}/macros.html): free SOLIDWORKS .swp macros to download.

## Documentation

${docLines.join("\n")}

## Guides

${articleLines.join("\n")}

## Macros

${macroLines.join("\n")}

## Policies

- [Terms of use](${ORIGIN}/terms.html)
- [Privacy policy](${ORIGIN}/privacy.html): the site uses no analytics and no advertising tracking.
- [Contact](${ORIGIN}/contact.html): urjitpatel28@gmail.com
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

  const { articles, articleGroups } = await loadArticles(seoMeta);
  console.log(`  ${articles.length} guides from guides/`);

  /* Cross-links are resolved only once every source has loaded, so a related[] entry can never
     point at a macro that was excluded from the build or a doc that was removed from the manifest. */
  const known = new Map([
    ...guides.map(guide => [guide.path, guide.navTitle]),
    ...macros.map(macro => [macro.path, macro.navTitle]),
    ...articles.map(article => [article.path, article.navTitle]),
    ["/docs.html", "Documentation"],
    ["/macros.html", "Macro library"],
    ["/guides.html", "Guides"]
  ]);

  resolveRelated(articles, known);
  const backlinks = invertRelated(articles);

  await writeDownloadTotal();

  for (const [index, guide] of guides.entries()) {
    await write(
      `docs/${guide.slug}/index.html`,
      guidePage(guide, groups, guides[index - 1], guides[index + 1], backlinks.get(guide.path) || [])
    );
  }

  for (const macro of macros) {
    await write(`macros/${macro.slug}/index.html`, macroPage(macro, macros, backlinks.get(macro.path) || []));
  }

  for (const [index, article] of articles.entries()) {
    await write(
      `guides/${article.slug}/index.html`,
      articlePage(article, articleGroups, articles[index - 1], articles[index + 1])
    );
  }

  await write("docs.html", docsIndexPage(groups, guides));
  await write("macros.html", macrosIndexPage(macros));
  if (articles.length) await write("guides.html", guidesIndexPage(articleGroups, articles));

  const staticPages = [
    { path: "/", changefreq: "weekly", priority: "1.0", lastmod: gitLastModified("index.html") },
    { path: "/docs.html", changefreq: "monthly", priority: "0.8", lastmod: gitLastModified("docs") },
    ...(articles.length
      ? [{ path: "/guides.html", changefreq: "monthly", priority: "0.8", lastmod: gitLastModified("guides") }]
      : []),
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
      ...articles.map(article => ({
        path: article.path,
        lastmod: article.lastmod || article.published,
        changefreq: "monthly",
        priority: "0.7"
      })),
      ...macros.map(macro => ({ path: macro.path, lastmod: macro.lastmod, changefreq: "monthly", priority: "0.7" }))
    ])
  );

  await write("llms.txt", llmsTxt({ docs: guides, articles, macros }));

  console.log(
    `Done: ${staticPages.length + guides.length + articles.length + macros.length} URLs in the sitemap.`
  );
}

await build();
