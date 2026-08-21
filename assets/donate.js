/* Reveals the donate blocks once there is a page behind them.
 *
 * The URL lives here and nowhere else. While it is empty every [data-donate] block stays hidden,
 * so this ships fine before the payment page exists - a dead donate link asks for money and then
 * fails, which is worse than not asking at all. Paste the page URL in and both CTAs appear. */
(function () {
  var DONATE_URL = 'https://rzp.io/rzp/bhf8pQp';   // Razorpay page, e.g. https://rzp.io/l/...

  var url = String(DONATE_URL).trim();
  if (!url) return;

  var blocks = document.querySelectorAll('[data-donate]');
  for (var i = 0; i < blocks.length; i++) {
    var link = blocks[i].querySelector('[data-donate-link]');
    if (!link) continue;
    link.href = url;
    blocks[i].hidden = false;
  }
})();
