/*
  Shared chrome for every generated page.

  The six hand-written pages at the repo root keep their own hand-written <head>; these templates
  exist so the generated pages - which outnumber them two to one - all get the same metadata without
  anyone having to remember. If a tag has to be added to every page on the site, it goes in `head()`
  here and in the six root files, and nowhere else.

  `base` is the only thing that varies between callers: "" for a page written to the repo root, "/"
  for one written into a subdirectory. Both resolve the same on GitHub Pages and under
  `python -m http.server`, so a generated page previews locally exactly as it deploys.
*/

export const ORIGIN = "https://swmacroflow.in";

export const ORGANIZATION_ID = `${ORIGIN}/#organization`;
export const WEBSITE_ID = `${ORIGIN}/#website`;
export const SOFTWARE_ID = `${ORIGIN}/#software`;

export const OG_IMAGE = {
  url: `${ORIGIN}/assets/og-image.png`,
  width: 1200,
  height: 630
};

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* JSON embedded in a <script> element ends the element early if it ever contains "</script>", and
   a lone "<" is enough to trip some sanitisers. The macro documents are full of VBA, so this is a
   real case rather than a theoretical one. */
function jsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

export function breadcrumbs(trail) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${ORIGIN}${crumb.path}`
    }))
  };
}

/*
  options:
    base         "" for root pages, "/" for pages in a subdirectory
    path         site-absolute path of this page, used for the canonical and og:url
    title        the <title> and og:title
    description  meta description, og:description and twitter:description
    schema       array of JSON-LD nodes, wrapped in an @graph
    head         extra raw markup appended inside <head> (page-specific <style>, etc.)
*/
export function head({ base = "", path, title, description, schema = [], head: extra = "" }) {
  const url = `${ORIGIN}${path}`;
  const graph = schema.length
    ? `\n<script type="application/ld+json">\n${jsonLd({ "@context": "https://schema.org", "@graph": schema })}\n</script>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="index, follow">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="SwMacroFlow">
<meta property="og:locale" content="en">
<meta property="og:image" content="${OG_IMAGE.url}">
<meta property="og:image:width" content="${OG_IMAGE.width}">
<meta property="og:image:height" content="${OG_IMAGE.height}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${OG_IMAGE.url}">
<meta name="theme-color" content="#0d0d0f">
<link rel="icon" href="${base}favicon.ico" sizes="32x32">
<link rel="icon" href="${base}assets/logo.png" type="image/png" sizes="512x512">
<link rel="apple-touch-icon" href="${base}assets/apple-touch-icon.png">
<link rel="manifest" href="${base}site.webmanifest">
<link rel="stylesheet" href="${base}assets/site.css">${graph}${extra}
</head>`;
}

/* `current` marks the nav entry for the section this page belongs to, so a generated guide page
   highlights "Docs" the same way docs.html itself does. */
export function nav(base = "", current = "") {
  const links = [
    { href: `${base}index.html#features`, label: "Features", key: "" },
    { href: `${base}docs.html`, label: "Docs", key: "docs" },
    { href: `${base}macros.html`, label: "Macros", key: "macros" },
    { href: `${base}index.html#how-it-works`, label: "How it works", key: "" },
    { href: `${base}index.html#faq`, label: "FAQ", key: "" },
    { href: `${base}index.html#download`, label: "Download", key: "" }
  ];

  const items = links
    .map(link => {
      const mark = link.key && link.key === current ? ' aria-current="page"' : "";
      return `<a href="${link.href}"${mark}>${link.label}</a>`;
    })
    .join("\n      ");

  return `<header class="nav">
  <div class="nav-inner">
    <a href="${base}index.html" class="brand">
      <img src="${base}assets/logo.png" alt="SwMacroFlow logo" width="28" height="28">
      SwMacroFlow
    </a>
    <nav class="nav-links">
      ${items}
    </nav>
    <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
      <span></span><span></span><span></span>
    </button>
  </div>
  <nav id="mobileNav" class="nav-mobile" aria-label="Site">
    ${items}
  </nav>
</header>`;
}

export function footer(base = "") {
  return `<footer>
  <div class="footer-inner">
    <div class="footer-brand">
      <img src="${base}assets/logo.png" alt="SwMacroFlow logo" width="24" height="24" loading="lazy">
      SwMacroFlow
    </div>
    <div class="footer-links">
      <a href="${base}index.html">Home</a>
      <a href="${base}docs.html">Docs</a>
      <a href="${base}macros.html">Macros</a>
      <a href="${base}index.html#download">Download</a>
      <a href="${base}contact.html">Contact</a>
      <a href="${base}terms.html">Terms</a>
      <a href="${base}privacy.html">Privacy</a>
    </div>
    <div class="footer-copy">&copy; 2026 SwMacroFlow. All rights reserved.</div>
  </div>
</footer>`;
}

/* Prev/next. The point of these is not navigation - the sidebar already covers that - it is that
   they give every generated page inbound links from its neighbours, which a flat list of pages
   hanging off one index does not. */
export function pager(previous, next) {
  if (!previous && !next) return "";

  const left = previous
    ? `<a class="pager-link" href="${previous.href}" rel="prev">
        <span class="pager-dir">Previous</span>
        <span class="pager-title">${escapeHtml(previous.title)}</span>
      </a>`
    : "<span></span>";

  const right = next
    ? `<a class="pager-link pager-next" href="${next.href}" rel="next">
        <span class="pager-dir">Next</span>
        <span class="pager-title">${escapeHtml(next.title)}</span>
      </a>`
    : "<span></span>";

  return `<nav class="pager" aria-label="Guide">
      ${left}
      ${right}
    </nav>`;
}

export function breadcrumbTrail(base, trail) {
  const items = trail
    .map((crumb, index) => {
      const last = index === trail.length - 1;
      const href = crumb.path === "/" ? `${base}index.html` : `${base}${crumb.path.replace(/^\//, "")}`;
      return last
        ? `<li aria-current="page">${escapeHtml(crumb.name)}</li>`
        : `<li><a href="${href}">${escapeHtml(crumb.name)}</a></li>`;
    })
    .join("\n        ");

  return `<nav class="crumbs" aria-label="Breadcrumb">
      <ol>
        ${items}
      </ol>
    </nav>`;
}
