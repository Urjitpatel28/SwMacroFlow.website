/* Fills the reviews section on index.html from Supabase, and posts new reviews back to it.
 *
 * Talks to PostgREST with plain fetch rather than the Supabase JS SDK. The site has no build step
 * and no third party scripts, and two HTTP calls are not worth pulling a bundle off a CDN for.
 *
 * Reads come straight from the table; writes go through the submit_review database function, which
 * is where the per-IP rate limit lives. The anon key has no INSERT permission of its own, so that
 * limit cannot be sidestepped by calling the table directly.
 *
 * Like the download card, the section is hidden until its data is actually in hand: a reviews box
 * that cannot reach its backend is worse than no reviews box. */
(function () {
  var section = document.querySelector('[data-reviews]');
  if (!section) return;

  var config = window.SwReviewConfig || {};
  var base = String(config.url || '').trim().replace(/\/+$/, '');
  var key = String(config.key || '').trim();
  if (!base || !key) return;

  var REST = base + '/rest/v1/';

  // Mirrors of the CHECK constraints on the table. Duplicated here only so a mistyped review gets a
  // sentence instead of a failed request; the database is what enforces them.
  var NAME_MIN = 2, NAME_MAX = 60;
  var ROLE_MAX = 80;
  var COMMENT_MIN = 10, COMMENT_MAX = 1200;

  // A person needs longer than this to read the form and write a sentence. A bot does not wait.
  var MIN_FILL_MS = 3000;

  // Everything shown is averaged and counted from this one response, so the number under the stars
  // always matches the reviews on screen. Worth revisiting with pagination if it is ever reached.
  var PAGE_SIZE = 100;

  var list = section.querySelector('[data-review-list]');
  var emptyNote = section.querySelector('[data-review-empty]');
  var summary = section.querySelector('[data-review-summary]');
  var averageEl = section.querySelector('[data-review-average]');
  var summaryStars = section.querySelector('[data-review-summary-stars]');
  var countEl = section.querySelector('[data-review-count]');
  var form = section.querySelector('[data-review-form]');
  var statusEl = section.querySelector('[data-review-status]');
  var honeypot = section.querySelector('[data-review-hp]');
  var submitBtn = form ? form.querySelector('button[type="submit"]') : null;

  if (!list || !emptyNote || !summary || !form || !statusEl) return;

  var reviews = [];
  var openedAt = Date.now();

  function authHeaders() {
    return { apikey: key, Authorization: 'Bearer ' + key };
  }

  function formatDate(iso) {
    var date = new Date(String(iso || ''));
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function setStatus(message, tone) {
    statusEl.textContent = message;
    if (tone) {
      statusEl.setAttribute('data-tone', tone);
    } else {
      statusEl.removeAttribute('data-tone');
    }
  }

  // The stars are decoration; the label is what a screen reader announces, so it carries the number.
  function starRow(rating) {
    var filled = Math.round(Number(rating) || 0);
    var wrap = document.createElement('span');
    wrap.className = 'stars';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', filled + ' out of 5 stars');

    for (var i = 1; i <= 5; i++) {
      var star = document.createElement('span');
      star.className = i <= filled ? 'star is-on' : 'star';
      star.setAttribute('aria-hidden', 'true');
      star.textContent = '★';
      wrap.appendChild(star);
    }
    return wrap;
  }

  /* Built node by node with textContent. Every string here was typed by a stranger and none of it
   * goes anywhere near innerHTML. */
  function reviewCard(review) {
    var article = document.createElement('article');
    article.className = 'review-card';
    article.appendChild(starRow(review.rating));

    var body = document.createElement('p');
    body.className = 'review-body';
    body.textContent = String(review.comment || '');
    article.appendChild(body);

    var who = document.createElement('p');
    who.className = 'review-who';

    var name = document.createElement('strong');
    name.textContent = String(review.name || '').trim() || 'Anonymous';
    who.appendChild(name);

    var meta = [];
    var role = String(review.role || '').trim();
    var when = formatDate(review.created_at);
    if (role) meta.push(role);
    if (when) meta.push(when);

    if (meta.length) {
      var rest = document.createElement('span');
      rest.textContent = ' · ' + meta.join(' · ');
      who.appendChild(rest);
    }

    article.appendChild(who);
    return article;
  }

  function render() {
    list.textContent = '';

    var total = 0;
    for (var i = 0; i < reviews.length; i++) {
      total += Number(reviews[i].rating) || 0;
      list.appendChild(reviewCard(reviews[i]));
    }

    var any = reviews.length > 0;
    emptyNote.hidden = any;
    summary.hidden = !any;
    if (!any) return;

    var average = total / reviews.length;
    averageEl.textContent = (Math.round(average * 10) / 10).toFixed(1);

    summaryStars.textContent = '';
    summaryStars.appendChild(starRow(average));

    countEl.textContent = reviews.length === 1
      ? 'Based on 1 review'
      : 'Based on ' + reviews.length + ' reviews';
  }

  function fieldValue(name) {
    var field = form.elements[name];
    return field ? String(field.value || '').trim() : '';
  }

  function collect() {
    var checked = form.querySelector('input[name="rating"]:checked');
    var rating = checked ? Number(checked.value) : 0;
    var name = fieldValue('name');
    var role = fieldValue('role');
    var comment = fieldValue('comment');

    if (!rating) return { error: 'Pick a rating from one to five stars.' };
    if (name.length < NAME_MIN || name.length > NAME_MAX) {
      return { error: 'Please give a name between ' + NAME_MIN + ' and ' + NAME_MAX + ' characters.' };
    }
    if (role.length > ROLE_MAX) {
      return { error: 'Keep the role under ' + ROLE_MAX + ' characters.' };
    }
    if (comment.length < COMMENT_MIN) {
      return { error: 'Please write at least ' + COMMENT_MIN + ' characters.' };
    }
    if (comment.length > COMMENT_MAX) {
      return { error: 'Please keep the review under ' + COMMENT_MAX + ' characters.' };
    }

    return { payload: { p_name: name, p_role: role, p_rating: rating, p_comment: comment } };
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    // Nothing is said to a bot that filled the hidden field: an error message tells it what to fix.
    if (honeypot && String(honeypot.value || '').trim()) return;

    if (Date.now() - openedAt < MIN_FILL_MS) {
      setStatus('That was fast. Give it a moment and post again.', 'error');
      return;
    }

    var result = collect();
    if (result.error) {
      setStatus(result.error, 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    setStatus('Posting your review…', '');

    fetch(REST + 'rpc/submit_review', {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(result.payload)
    })
      .then(function (response) {
        if (response.ok) return null;
        return response.text().then(function (text) {
          throw new Error(text || String(response.status));
        });
      })
      .then(function () {
        // Shown from the values we just sent rather than by refetching, so it appears immediately.
        reviews.unshift({
          name: result.payload.p_name,
          role: result.payload.p_role,
          rating: result.payload.p_rating,
          comment: result.payload.p_comment,
          created_at: new Date().toISOString()
        });
        render();
        form.reset();
        openedAt = Date.now();
        setStatus('Thank you. Your review is live.', 'ok');
      })
      .catch(function (error) {
        var detail = String((error && error.message) || '');
        setStatus(
          detail.indexOf('rate_limited') !== -1
            ? 'You have posted a few reviews already. Try again in an hour.'
            : 'That did not go through. Please try again in a moment.',
          'error'
        );
      })
      .then(function () {
        if (submitBtn) submitBtn.disabled = false;
      });
  });

  fetch(REST + 'reviews?select=name,role,rating,comment,created_at&order=created_at.desc&limit=' + PAGE_SIZE, {
    headers: authHeaders()
  })
    .then(function (response) {
      return response.ok ? response.json() : null;
    })
    .then(function (data) {
      if (!Array.isArray(data)) return;
      reviews = data;
      render();
      section.hidden = false;
    })
    .catch(function () {
      // Leave the section hidden. The rest of the page is unaffected by a backend that is down.
    });
})();
