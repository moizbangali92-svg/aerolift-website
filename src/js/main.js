/* Aerolift L.L.C. — home page behaviour.
   Vanilla JS only. Loaded with `defer`. Everything degrades without it. */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------
   * 1. Sticky header — add a shadow once the page scrolls.
   * ------------------------------------------------------------- */
  var header = document.getElementById('site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------------
   * 2. Mobile menu — slide-in panel, focus trapped, Esc to close.
   *    Without JS the panel stays in the DOM as a plain nav list.
   * ------------------------------------------------------------- */
  var menuBtn = document.getElementById('menu-toggle');
  var panel = document.getElementById('mobile-menu');
  var overlay = document.getElementById('menu-overlay');
  var lastFocused = null;

  function focusable() {
    return panel
      ? Array.prototype.slice.call(
          panel.querySelectorAll('a[href], button:not([disabled])')
        ).filter(function (el) { return el.offsetParent !== null; })
      : [];
  }

  function openMenu() {
    if (!panel) return;
    lastFocused = document.activeElement;
    panel.classList.remove('translate-x-full');
    panel.removeAttribute('inert');
    overlay.classList.remove('hidden');
    menuBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    var f = focusable();
    if (f.length) f[0].focus();
  }

  function closeMenu() {
    if (!panel) return;
    panel.classList.add('translate-x-full');
    overlay.classList.add('hidden');
    menuBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    // inert keeps the off-screen panel out of the tab order
    panel.setAttribute('inert', '');
    // Send focus back where it came from, but never strand it on <body> —
    // fall back to the toggle so keyboard users keep their place.
    var back = (lastFocused && lastFocused !== document.body) ? lastFocused : menuBtn;
    back.focus();
  }

  if (menuBtn && panel && overlay) {
    panel.setAttribute('inert', '');
    menuBtn.addEventListener('click', function () {
      menuBtn.getAttribute('aria-expanded') === 'true' ? closeMenu() : openMenu();
    });
    overlay.addEventListener('click', closeMenu);

    var closeBtn = document.getElementById('menu-close');
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // Close after following an in-page link
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeMenu();
    });

    document.addEventListener('keydown', function (e) {
      if (menuBtn.getAttribute('aria-expanded') !== 'true') return;
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key !== 'Tab') return;
      var f = focusable();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // Leaving the mobile breakpoint with the panel open would strand it
    window.matchMedia('(min-width: 1024px)').addEventListener('change', function (e) {
      if (e.matches && menuBtn.getAttribute('aria-expanded') === 'true') closeMenu();
    });
  }

  /* ---------------------------------------------------------------
   * 3. Desktop Products dropdown — hover + click + keyboard.
   * ------------------------------------------------------------- */
  var dd = document.getElementById('products-dropdown');
  if (dd) {
    var trigger = dd.querySelector('[aria-expanded]');
    var list = dd.querySelector('[data-dropdown-list]');
    var hideTimer;

    var show = function () {
      clearTimeout(hideTimer);
      trigger.setAttribute('aria-expanded', 'true');
      list.classList.remove('invisible', 'opacity-0', '-translate-y-1');
    };
    var hide = function () {
      trigger.setAttribute('aria-expanded', 'false');
      list.classList.add('invisible', 'opacity-0', '-translate-y-1');
    };

    dd.addEventListener('mouseenter', show);
    dd.addEventListener('mouseleave', function () { hideTimer = setTimeout(hide, 120); });
    dd.addEventListener('focusin', show);
    dd.addEventListener('focusout', function (e) {
      if (!dd.contains(e.relatedTarget)) hide();
    });
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      trigger.getAttribute('aria-expanded') === 'true' ? hide() : show();
    });
    dd.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hide(); trigger.focus(); }
    });
  }

  /* ---------------------------------------------------------------
   * 4. Scroll reveal. IntersectionObserver, one-shot, opacity+transform.
   * ------------------------------------------------------------- */
  var pending = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (reduceMotion) {
    pending.forEach(function (el) { el.classList.add('is-in'); });
    pending = [];
  } else {
    // Siblings inside one group land in sequence rather than all at once.
    // Capped so a long list never leaves the last item waiting.
    var STEP = 70, MAX_STEP = 4;
    pending.forEach(function (el) {
      var siblings = el.parentElement
        ? el.parentElement.querySelectorAll(':scope > .reveal')
        : [];
      if (siblings.length < 2) return;
      var i = Array.prototype.indexOf.call(siblings, el);
      el.style.setProperty('--reveal-delay', Math.min(i, MAX_STEP) * STEP + 'ms');
    });

    // Two mechanisms, because each covers the other's blind spot:
    //
    //  - IntersectionObserver catches elements as they enter the viewport, and
    //    keeps working in contexts where scroll events never reach the window.
    //  - A position sweep catches elements that were carried PAST the viewport
    //    between two sampled frames (fast wheel scroll, jump to an #anchor,
    //    restored scroll position). IO records no intersection for those, and
    //    they would sit at opacity 0 for the rest of the session.
    //
    // Both call the same idempotent reveal(), so overlap is harmless.
    var reveal = function (el) {
      el.classList.add('is-in');
      if (io) io.unobserve(el);
    };

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) reveal(entry.target);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
      pending.forEach(function (el) { io.observe(el); });
    }

    var ticking = false;
    var sweep = function () {
      ticking = false;
      var line = window.innerHeight * 0.92;
      pending = pending.filter(function (el) {
        if (!el.classList.contains('is-in') &&
            el.getBoundingClientRect().top > line) return true;
        reveal(el);
        return false;
      });
    };
    var request = function () {
      if (ticking || !pending.length) return;
      ticking = true;
      window.requestAnimationFrame(sweep);
    };

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    window.addEventListener('hashchange', request);
    sweep();
  }

  /* ---------------------------------------------------------------
   * 5. FAQ accordion. Markup is <details>/<summary>, so it already
   *    works without JS. This only closes the siblings.
   * ------------------------------------------------------------- */
  var faqs = document.querySelectorAll('[data-faq] details');
  Array.prototype.forEach.call(faqs, function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      Array.prototype.forEach.call(faqs, function (other) {
        if (other !== d) other.open = false;
      });
    });
  });

  /* ---------------------------------------------------------------
   * 6. Quote form — validate on blur, announce errors, success state.
   *    Native `required` still guards the form if JS fails.
   * ------------------------------------------------------------- */
  var form = document.getElementById('quote-form');
  if (!form) return;

  var MESSAGES = {
    name: 'Enter your name so we know who to reply to.',
    company: 'Enter your company name.',
    phone: 'Enter a phone number we can reach you on, including country code.',
    email: 'Enter a valid email address, for example name@company.ae',
    requirement: 'Select the equipment or service you need.',
    message: 'Tell us what you need to lift, and where.'
  };

  function fieldError(input) {
    return document.getElementById(input.id + '-error');
  }

  function validate(input) {
    var err = fieldError(input);
    var ok = input.checkValidity();
    input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    if (err) {
      // Write into the span, not the <p> — the <p> also holds the alert icon.
      var slot = err.querySelector('[data-error-text]') || err;
      slot.textContent = ok ? '' : (MESSAGES[input.name] || 'Check this field.');
      err.classList.toggle('is-visible', !ok);
    }
    return ok;
  }

  var inputs = form.querySelectorAll('input[required], select[required], textarea[required]');

  Array.prototype.forEach.call(inputs, function (input) {
    input.addEventListener('blur', function () { validate(input); });
    // Once a field has been marked bad, re-check as the user fixes it.
    input.addEventListener('input', function () {
      if (input.getAttribute('aria-invalid') === 'true') validate(input);
    });
  });

  form.addEventListener('submit', function (e) {
    var firstBad = null;
    Array.prototype.forEach.call(inputs, function (input) {
      if (!validate(input) && !firstBad) firstBad = input;
    });

    var summary = document.getElementById('form-summary');
    if (firstBad) {
      e.preventDefault();
      if (summary) {
        summary.textContent =
          'Your request was not sent. Check the highlighted fields below and try again.';
        summary.classList.remove('hidden');
      }
      firstBad.focus();
      return;
    }
    if (summary) summary.classList.add('hidden');

    // No endpoint wired yet — show the success state instead of a dead POST.
    // REPLACE: delete this block once the real form action is in place.
    if (!form.getAttribute('action') || form.getAttribute('action').indexOf('PLACEHOLDER') > -1) {
      e.preventDefault();
      var success = document.getElementById('form-success');
      if (success) {
        success.classList.remove('hidden');
        success.focus();
        form.classList.add('hidden');
      }
    }
  });
})();
