/* Fills the download block on index.html from release.json.
 *
 * release.json is the one place a build is described, and the application's auto-updater verifies
 * downloads against the same sha256. A missing or half-filled file is the normal state before the
 * first release, so the pending state is the default and this only ever reveals the real one. */
(function () {
  var card = document.querySelector('.download-card');
  if (!card) return;

  var pending = card.querySelector('[data-download-pending]');
  var ready = card.querySelector('[data-download-ready]');
  if (!pending || !ready) return;

  // A malformed checksum fails this on purpose: publishing a wrong hash is worse than publishing
  // none, because it makes a good file look tampered with.
  function isReady(release) {
    return !!release &&
      !!String(release.url || '').trim() &&
      !!String(release.version || '').trim() &&
      /^[a-f0-9]{64}$/i.test(String(release.sha256 || '').trim());
  }

  function formatBytes(bytes) {
    var value = Number(bytes) || 0;
    if (value <= 0) return '';
    if (value < 1024 * 1024) return Math.round(value / 1024) + ' KB';
    return (value / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function formatDate(iso) {
    var date = new Date(String(iso || ''));
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function render(release) {
    if (!isReady(release)) return;

    pending.hidden = true;
    ready.hidden = false;

    card.querySelector('[data-download-version]').textContent = 'Version ' + release.version;
    card.querySelector('[data-download-link]').href = release.url;
    card.querySelector('[data-download-sha]').textContent =
      String(release.sha256).trim().toLowerCase();

    // Size and date are both optional in release.json, so build the line from whichever survived.
    var parts = [];
    var released = formatDate(release.releasedOn);
    var size = formatBytes(release.sizeBytes);
    if (released) parts.push('Released ' + released);
    if (size) parts.push(size);
    parts.push('Windows, per-user install');
    card.querySelector('[data-download-meta]').textContent = parts.join(' · ');
  }

  fetch('release.json', { cache: 'no-cache' })
    .then(function (response) {
      return response.ok ? response.text() : null;
    })
    .then(function (text) {
      // GitHub Pages serves the file with a BOM often enough that JSON.parse would throw on it.
      render(text ? JSON.parse(text.replace(/^﻿/, '')) : null);
    })
    .catch(function () {
      // Leave the pending state showing. A download link that 404s is worse than "coming shortly".
    });
})();
