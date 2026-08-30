/*
  Minimal Markdown renderer shared by macros.html and docs.html.

  Deliberately dependency-free and deliberately a subset: headings, fenced code, bullet and numbered
  lists, pipe tables, horizontal rules, and inline code/bold/italic. Everything is HTML-escaped
  first, because the payload is VBA full of <, >, and &. Anything unsupported degrades to plain text
  rather than breaking the page.

  Options:
    headingOffset      demote headings by N levels. macros.html passes 1 so a document's "#" renders
                       as an <h2> underneath the card's own heading. Default 0.
    stripFirstHeading  drop the document's leading "#" heading. docs.html passes true because it
                       shows that title in the page header already. Default false.
*/
(function (global) {
  "use strict";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function inlineMarkdown(value) {
    return escapeHtml(value)
      // Links. Restricted to shapes that can only navigate - absolute http(s), site-root, or a
      // fragment - so a document can never introduce a javascript: or data: URL through here. An
      // href that does not match is left as the literal text it was written as: visible, and
      // harmless. Run before the emphasis rules so a URL containing an asterisk is not mangled.
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*|#[^\s)]+)\)/g,
        (whole, text, href) => `<a href="${href}">${text}</a>`
      )
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function isTableDivider(row) {
    return row
      .replace(/^\||\|$/g, "")
      .split("|")
      .every(cell => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function firstHeading(markdown) {
    const line = String(markdown || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(entry => entry.trim())
      .find(entry => /^#{1,6}\s+/.test(entry));
    return line ? line.replace(/^#{1,6}\s+/, "").trim() : "";
  }

  function toHtml(markdown, options) {
    const settings = options || {};
    const headingOffset = settings.headingOffset || 0;
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];

    let paragraph = [];
    let list = [];
    let listTag = "ul";
    let table = [];
    let code = [];
    let inCode = false;
    let fence = "";
    let codeLanguage = "";
    let headingsSeen = 0;

    function flushParagraph() {
      if (paragraph.length) {
        html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
        paragraph = [];
      }
    }

    function flushList() {
      if (list.length) {
        html.push(`<${listTag}>${list.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</${listTag}>`);
        list = [];
      }
    }

    function flushTable() {
      if (table.length) {
        const rows = table.filter(row => !isTableDivider(row));
        html.push("<table>");
        rows.forEach((row, index) => {
          const cells = row.replace(/^\||\|$/g, "").split("|").map(cell => cell.trim());
          const tag = index === 0 ? "th" : "td";
          html.push(`<tr>${cells.map(cell => `<${tag}>${inlineMarkdown(cell)}</${tag}>`).join("")}</tr>`);
        });
        html.push("</table>");
        table = [];
      }
    }

    function flushCode() {
      if (code.length) {
        const className = codeLanguage ? ` class="lang-${escapeHtml(codeLanguage)}"` : "";
        html.push(`<pre><code${className}>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
      }
      codeLanguage = "";
    }

    function pushHeading(level, text) {
      flushParagraph();
      flushList();
      headingsSeen += 1;
      if (level === 1 && headingsSeen === 1 && settings.stripFirstHeading) return;
      const tag = `h${Math.min(6, level + headingOffset)}`;
      html.push(`<${tag}>${inlineMarkdown(text)}</${tag}>`);
    }

    function startList(tag, item) {
      flushParagraph();
      if (list.length && listTag !== tag) flushList();
      listTag = tag;
      list.push(item);
    }

    lines.forEach(line => {
      const trimmed = line.trim();
      const fenceMatch = /^(```|''')\s*([A-Za-z0-9_+-]*)\s*$/.exec(trimmed);

      if (inCode) {
        if (fenceMatch && fenceMatch[1] === fence && !fenceMatch[2]) {
          flushCode();
          inCode = false;
          fence = "";
        } else {
          code.push(line);
        }
        return;
      }

      if (fenceMatch) {
        flushParagraph();
        flushList();
        flushTable();
        inCode = true;
        fence = fenceMatch[1];
        codeLanguage = fenceMatch[2] || "";
        return;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        flushTable();
        return;
      }

      if (trimmed.startsWith("|") && trimmed.includes("|")) {
        flushParagraph();
        flushList();
        table.push(trimmed);
        return;
      }

      flushTable();

      const headingMatch = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (headingMatch) {
        pushHeading(headingMatch[1].length, headingMatch[2]);
        return;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        flushParagraph();
        flushList();
        html.push("<hr>");
        return;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        startList("ul", trimmed.replace(/^[-*]\s+/, ""));
        return;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        startList("ol", trimmed.replace(/^\d+\.\s+/, ""));
        return;
      }

      // Anything else continues whatever is open. These documents are hard-wrapped at 100 columns,
      // so a wrapped bullet has to stay inside its own <li> rather than escaping the list.
      if (list.length) {
        list[list.length - 1] += " " + trimmed;
      } else {
        paragraph.push(trimmed);
      }
    });

    flushParagraph();
    flushList();
    flushTable();
    flushCode();
    return html.join("");
  }

  global.SwMarkdown = { escapeHtml, inlineMarkdown, firstHeading, toHtml };
// globalThis rather than window alone so tools/build-site.mjs can evaluate this file in Node and
// render the guides at build time with the exact renderer the browser and the desktop app use.
})(typeof window !== "undefined" ? window : globalThis);
