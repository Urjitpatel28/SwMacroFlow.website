/* Shows the total installer download count in the download block on index.html.
 *
 * The number comes from downloads.json, which tools/build-site.mjs writes at build time from
 * GitHub's per-asset download_count. Nothing is counted here and no third party is contacted on a
 * page load - this is a same-origin fetch of a file the deploy already baked.
 *
 * The build publishes null until the count clears the floor it holds, because an honest small
 * number is worse social proof than no number at all. Every path below therefore leaves the block
 * hidden and only the one good case reveals it. */
(function () {
  var block = document.querySelector('[data-download-total]');
  if (!block) return;

  var value = block.querySelector('[data-download-total-value]');
  if (!value) return;

  function render(data) {
    var total = Number(data && data.total);

    // Covers null, absent, NaN and 0 in one test. Any of them means there is nothing worth showing.
    if (!isFinite(total) || total <= 0) return;

    value.textContent = total.toLocaleString();

    // Only ever this element. The parent [data-download-ready] belongs to assets/release.js, and it
    // staying hidden is what keeps a download count from appearing beside a download that is not
    // being offered yet.
    block.hidden = false;
  }

  fetch('downloads.json', { cache: 'no-cache' })
    .then(function (response) {
      return response.ok ? response.text() : null;
    })
    .then(function (text) {
      // GitHub Pages serves the file with a BOM often enough that JSON.parse would throw on it.
      render(text ? JSON.parse(text.replace(/^﻿/, '')) : null);
    })
    .catch(function () {
      // Leave it hidden. The download button is the point of this section and it does not depend
      // on this file resolving.
    });
})();
