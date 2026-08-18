/*
  The "copy the macro folder path" button.

  This used to live inline in macros.html, inside the macro document modal. That modal is gone -
  every macro has its own page now - but the button is still worth having on each of those pages
  and on the macro index, so it moved here rather than being duplicated into generated output.

  Wires up every .copy-path-button on the page and copies the text of the <code> in its row.
*/
(function () {
  "use strict";

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    // execCommand is deprecated but it is the only path that works over plain http, which is how
    // the site is previewed locally.
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  document.querySelectorAll(".copy-path-button").forEach(button => {
    const row = button.closest(".install-code-row");
    const code = row && row.querySelector("code");
    if (!code) return;

    button.addEventListener("click", async () => {
      try {
        await copyText(code.textContent);
        button.classList.add("is-copied");
        button.setAttribute("aria-label", "Macro folder path copied");
        button.title = "Copied";
        setTimeout(() => {
          button.classList.remove("is-copied");
          button.setAttribute("aria-label", "Copy macro folder path");
          button.title = "Copy macro folder path";
        }, 1800);
      } catch (error) {
        button.title = "Copy failed";
      }
    });
  });
})();
