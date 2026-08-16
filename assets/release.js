/* Fills the download block on index.html from release.json, and shows the thank-you dialog once a
 * download has started.
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

  var dialog = document.querySelector('[data-thanks]');

  // The url is a permalink and never changes; version is what the maintainer fills in when a build
  // is actually published. Gating on version rather than on the url is what keeps the button hidden
  // until there is something behind it.
  function isReady(release) {
    return !!release &&
      !!String(release.url || '').trim() &&
      !!String(release.version || '').trim();
  }

  // Shown only when it is a well-formed digest. A wrong checksum is worse than none, because it
  // makes a good file look tampered with - but a missing one is no reason to withhold the download.
  function shaOf(release) {
    var sha = String((release && release.sha256) || '').trim().toLowerCase();
    return /^[a-f0-9]{64}$/.test(sha) ? sha : '';
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

  function showThanks() {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      // No <dialog> support. Falling back to the native alert is ugly, but the SmartScreen warning
      // is the whole point - a user who does not see it reads "Windows protected your PC" as malware.
      window.alert('Thank you. Your download has started.\n\n' +
        'Windows may show a "Windows protected your PC" warning. SwMacroFlow is an app from an ' +
        'independent developer and has not yet built up Microsoft\'s download reputation. ' +
        'Click More info, then Run anyway.');
    }
  }

  function render(release) {
    if (!isReady(release)) return;

    pending.hidden = true;
    ready.hidden = false;

    var url = String(release.url).trim();
    var link = card.querySelector('[data-download-link]');
    link.href = url;

    card.querySelector('[data-download-version]').textContent = 'Version ' + release.version;

    // Size and date are both optional in release.json, so build the line from whichever survived.
    var parts = [];
    var released = formatDate(release.releasedOn);
    var size = formatBytes(release.sizeBytes);
    if (released) parts.push('Released ' + released);
    if (size) parts.push(size);
    parts.push('Windows, per-user install');
    card.querySelector('[data-download-meta]').textContent = parts.join(' · ');

    var sha = shaOf(release);
    if (sha) {
      card.querySelector('[data-download-sha]').textContent = sha;
      card.querySelector('[data-download-sha-row]').hidden = false;
    }

    // Not preventDefault: the browser follows the link and starts the download, and the dialog
    // appears over the page it stays on.
    link.addEventListener('click', showThanks);

    if (dialog) {
      dialog.querySelector('[data-thanks-retry]').addEventListener('click', function (event) {
        event.preventDefault();
        window.location.href = url;
      });
    }
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
