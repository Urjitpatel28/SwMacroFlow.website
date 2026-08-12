/* Mobile nav toggle for the shared site header. */
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('mobileNav');
  if (!toggle || !menu) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      menu.setAttribute('data-open', 'true');
    } else {
      menu.removeAttribute('data-open');
    }
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  menu.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', function (e) {
    if (toggle.getAttribute('aria-expanded') !== 'true') return;
    if (!e.target.closest('header.nav')) setOpen(false);
  });

  window.matchMedia('(min-width: 1101px)').addEventListener('change', function (e) {
    if (e.matches) setOpen(false);
  });
})();
