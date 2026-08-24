/* Mounts Razorpay's hosted Payment Button in every donate block.
 *
 * The live button ID lives here and nowhere else. Each block stays hidden until Razorpay has
 * rendered an actual button, so a blocked script or unavailable configuration never leaves a dead
 * donation CTA on the page. */
(function () {
  var PAYMENT_BUTTON_ID = 'pl_TTdJGyiwOzStHB';
  var PAYMENT_BUTTON_SCRIPT = 'https://checkout.razorpay.com/v1/payment-button.js';
  var PAYMENT_BUTTON_SELECTOR = '.razorpay-payment-button a, .razorpay-payment-button button';

  var buttonId = String(PAYMENT_BUTTON_ID).trim();
  if (!buttonId) return;

  var blocks = document.querySelectorAll('[data-donate]');
  var thanksDialog = document.querySelector('dialog[data-thanks]');

  for (var i = 0; i < blocks.length; i++) {
    mountButton(blocks[i]);
  }

  function mountButton(block) {
    var form = block.querySelector('[data-donate-form]');
    if (!form) return;

    // A native modal dialog occupies the browser's top layer. Close it before Razorpay opens its
    // own modal so Checkout cannot appear behind the thank-you message.
    if (thanksDialog && thanksDialog.contains(form)) {
      form.addEventListener('click', function (event) {
        var button = form.querySelector(PAYMENT_BUTTON_SELECTOR);
        if (button && button.contains(event.target) && thanksDialog.open) {
          thanksDialog.close();
        }
      }, true);
    }

    var observer = new MutationObserver(function () {
      if (!form.querySelector(PAYMENT_BUTTON_SELECTOR)) return;
      observer.disconnect();
      block.hidden = false;
    });

    observer.observe(form, { childList: true, subtree: true });

    var script = document.createElement('script');
    script.src = PAYMENT_BUTTON_SCRIPT;
    script.async = true;
    script.setAttribute('data-payment_button_id', buttonId);
    script.addEventListener('error', function () {
      observer.disconnect();
    });
    form.appendChild(script);
  }
})();
