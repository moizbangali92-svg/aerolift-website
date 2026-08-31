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
   * 6. Hero equipment selector.
   *    The button is a plain anchor to #request-a-quote, so without JS
   *    it still lands the visitor on the quote form. This only carries
   *    their answers across so nothing is typed twice.
   * ------------------------------------------------------------- */
  /*
   * Live spec label. As the visitor narrows the spec, the action button
   * starts speaking their language: "Get My Specification" becomes
   * "Spec My 15–50 t Gantry Crane". Falls back silently if the label
   * span is missing.
   */
  var specLabel = document.getElementById('selector-submit-label');
  if (specLabel) {
    var EQUIPMENT_NAMES = {
      'eot-crane': 'EOT Crane',
      'gantry-crane': 'Gantry Crane',
      'jib-crane': 'Jib Crane',
      'hoist': 'Hoist',
      'spare-parts': 'Spare Parts'
    };
    var updateSpecLabel = function () {
      var eq = document.getElementById('sel-equipment').value;
      var cap = document.getElementById('sel-capacity').value;
      var label;
      if (eq === 'spare-parts') {
        label = 'Spec My Spare Parts';
      } else if (eq && cap) {
        label = 'Spec My ' + cap + ' ' + EQUIPMENT_NAMES[eq];
      } else if (eq) {
        label = 'Spec My ' + EQUIPMENT_NAMES[eq];
      } else if (cap) {
        label = 'Spec My ' + cap + ' Lift';
      } else {
        label = 'Get My Specification';
      }
      specLabel.textContent = label;
    };
    ['sel-equipment', 'sel-capacity', 'sel-application'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', updateSpecLabel);
    });
  }

  var selectorSubmit = document.getElementById('selector-submit');
  if (selectorSubmit) {
    selectorSubmit.addEventListener('click', function () {
      var equipment = document.getElementById('sel-equipment');
      var capacity = document.getElementById('sel-capacity').value;
      var application = document.getElementById('sel-application').value;

      var requirement = document.getElementById('requirement');
      if (requirement && equipment.value) requirement.value = equipment.value;

      var message = document.getElementById('message');
      if (message && !message.value) {
        var lines = [];
        if (equipment.value) {
          lines.push('Equipment: ' + equipment.options[equipment.selectedIndex].text);
        }
        if (capacity) lines.push('Capacity: ' + capacity);
        if (application) lines.push('Application: ' + application);
        if (lines.length) message.value = lines.join('\n') + '\n\n';
      }

      // Let the anchor do the scrolling, then put the cursor on the first
      // field we still need. preventScroll so focus does not fight the jump.
      var name = document.getElementById('name');
      if (name) {
        window.setTimeout(function () {
          try { name.focus({ preventScroll: true }); } catch (e) { name.focus(); }
        }, 500);
      }
    });
  }

  /* ---------------------------------------------------------------
   * 7. Product filter chips.
   * ------------------------------------------------------------- */
  var filterBar = document.getElementById('product-filters');
  if (filterBar) {
    var chips = filterBar.querySelectorAll('[data-filter]');
    var cards = document.querySelectorAll('#product-grid [data-tags]');
    var status = document.getElementById('filter-status');

    filterBar.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip) return;
      var value = chip.getAttribute('data-filter');

      Array.prototype.forEach.call(chips, function (c) {
        c.setAttribute('aria-pressed', String(c === chip));
      });

      var shown = 0;
      Array.prototype.forEach.call(cards, function (card) {
        var match = value === 'all' ||
          card.getAttribute('data-tags').split(' ').indexOf(value) > -1;
        card.hidden = !match;
        if (match) shown++;
      });

      status.textContent = value === 'all'
        ? 'Showing all ' + cards.length + ' equipment ranges.'
        : 'Showing ' + shown + ' of ' + cards.length + ' equipment ranges for ' +
          chip.textContent.trim().toLowerCase() + '.';
    });
  }

  /* ---------------------------------------------------------------
   * 8. Quote form — validate on blur, announce errors, success state.
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

    var action = form.getAttribute('action') || '';
    var configured = action.indexOf('formspree.io') > -1 && action.indexOf('FORMSPREE_ID') === -1;
    // Set on the form when there is deliberately no backend: the enquiry goes
    // out through the visitor's own mail client instead. See quote-form.html.
    var mailtoOnly = form.getAttribute('data-transport') === 'mailto';

    var showSuccess = function () {
      var success = document.getElementById('form-success');
      if (success) {
        success.classList.remove('hidden');
        success.focus();
        form.classList.add('hidden');
      }
    };

    // Builds a mailto: carrying everything the visitor typed, so nothing they
    // wrote is lost whichever path we end up on.
    var buildMailto = function () {
      var get = function (name) {
        var el = form.querySelector('[name="' + name + '"]');
        return el ? el.value.trim() : '';
      };
      var requirementEl = form.querySelector('[name="requirement"]');
      var requirement = requirementEl && requirementEl.selectedIndex > 0
        ? requirementEl.options[requirementEl.selectedIndex].text
        : '';

      var body = [
        'Name: ' + get('name'),
        'Company: ' + get('company'),
        'Phone: ' + get('phone'),
        'Email: ' + get('email'),
        'Requirement: ' + requirement,
        '',
        'Details:',
        get('message')
      ].join('\n');

      return 'mailto:sales@aerolift-cranes.com'
        + '?subject=' + encodeURIComponent('Quote request from the website')
        + '&body=' + encodeURIComponent(body);
    };

    var say = function (text, linkText) {
      if (!summary) return;
      summary.textContent = '';
      summary.appendChild(document.createTextNode(text + ' '));
      if (linkText) {
        var link = document.createElement('a');
        link.href = buildMailto();
        link.className = 'link-underline font-semibold';
        link.textContent = linkText;
        summary.appendChild(link);
        summary.appendChild(document.createTextNode(' — your details are already filled in.'));
      }
      summary.appendChild(document.createTextNode(' Or call +971 55 702 9550.'));
      summary.classList.remove('hidden');
      if (summary.focus) summary.focus();
    };

    e.preventDefault();

    var pageField = form.querySelector('input[name="page"]');
    if (pageField) pageField.value = window.location.pathname;

    // No backend by design: hand the enquiry straight to the mail client. No
    // failed request first, because announcing an error for the expected path
    // reads as a broken site.
    if (mailtoOnly || !configured) {
      window.location.href = buildMailto();
      say('Opening your email app with these details ready to send. If nothing happens,', 'open it here');
      return;
    }

    var button = document.getElementById('quote-submit');
    var label = document.getElementById('quote-submit-label');
    if (button) button.disabled = true;
    if (label) label.textContent = 'Sending…';

    var restore = function () {
      if (button) button.disabled = false;
      if (label) label.textContent = 'Send Quote Request';
    };

    // A configured endpoint can still fail — an outage, a blocked request, an
    // id that stops resolving. The visitor has already typed out span, capacity
    // and duty cycle by this point, so the fallback keeps their work.
    var offerEmailFallback = function (message) {
      restore();
      say(message, 'Send it as an email instead');
    };

    fetch(action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    }).then(function (res) {
      if (res.ok) { showSuccess(); return; }
      offerEmailFallback('Your request could not be sent just now.');
    }).catch(function () {
      offerEmailFallback('Your request could not be sent — check your connection.');
    });
  });

})();

/* =================================================================
 * 9. Floating WhatsApp button: stand down over the quote form.
 *
 * The button is fixed bottom-right, which puts it on top of the right
 * edge of the form's inputs and textarea — on a phone that means it
 * floats over the words being typed. It is also redundant there:
 * someone already filling the form does not need a shortcut to start
 * a conversation.
 *
 * A position check on scroll rather than IntersectionObserver. Same
 * reasoning as the scroll reveal above: IO is not dependable in every
 * context, and here a missed callback leaves the button sitting on
 * the form. A rect comparison is cheap and always right.
 *
 * Deliberately its own IIFE — the block above returns early on pages
 * with no quote form, and the button exists on every page.
 * ================================================================= */
(function () {
  var waFab = document.querySelector('.wa-fab');
  var quoteSection = document.getElementById('request-a-quote');
  if (!waFab || !quoteSection) return;

  // Runs straight off the scroll event rather than through a
  // requestAnimationFrame throttle. rAF does not fire while a page is not
  // compositing (backgrounded tab, hidden pane), which would leave a
  // "already queued" latch stuck on and the button pinned to whatever state
  // it was last in. One rect read and a class toggle is cheap enough that
  // the throttle bought nothing worth that failure mode.
  var sync = function () {
    var r = quoteSection.getBoundingClientRect();
    // Any sliver on screen counts: the overlap starts the moment the
    // section's top edge reaches the button, not when it is half in view.
    waFab.classList.toggle('wa-fab--stood-down', r.top < window.innerHeight && r.bottom > 0);
  };

  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();   // correct on load, including a restored scroll position
})();

/* =================================================================
 * 10. Gallery lightbox.
 *
 * Progressive enhancement: the markup is a list of ordinary links to
 * full-size images. Without JavaScript, clicking one opens the photo —
 * which is exactly what the gallery did before this existed. With it,
 * the photo opens in place with keyboard navigation.
 *
 * Built rather than pulled in: a lightbox is a dialog, a couple of
 * listeners and a focus trap, and a library would have cost more bytes
 * than the page's images.
 * ================================================================= */
(function () {
  'use strict';

  var links = Array.prototype.slice.call(
    document.querySelectorAll('[data-lightbox]')
  );
  if (!links.length) return;

  var index = 0;
  var lastFocused = null;

  var box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Gallery image viewer');
  box.setAttribute('data-open', 'false');
  box.setAttribute('inert', '');
  box.innerHTML =
    '<img alt="">' +
    '<p class="lightbox-cap"></p>' +
    '<button type="button" class="lightbox-close" aria-label="Close viewer">' +
      '<svg class="icon icon-md" aria-hidden="true"><use href="#i-x"/></svg></button>' +
    '<button type="button" class="lightbox-nav lightbox-nav--prev" aria-label="Previous image">' +
      '<svg class="icon icon-md" aria-hidden="true" style="transform:rotate(180deg)"><use href="#i-arrow-right"/></svg></button>' +
    '<button type="button" class="lightbox-nav lightbox-nav--next" aria-label="Next image">' +
      '<svg class="icon icon-md" aria-hidden="true"><use href="#i-arrow-right"/></svg></button>';
  document.body.appendChild(box);

  var img = box.querySelector('img');
  var cap = box.querySelector('.lightbox-cap');
  var closeBtn = box.querySelector('.lightbox-close');
  var prevBtn = box.querySelector('.lightbox-nav--prev');
  var nextBtn = box.querySelector('.lightbox-nav--next');

  // Only one photo means the arrows are furniture, not controls.
  if (links.length < 2) {
    prevBtn.hidden = true;
    nextBtn.hidden = true;
  }

  var show = function (i) {
    index = (i + links.length) % links.length;
    var link = links[index];
    var thumb = link.querySelector('img');
    img.src = link.getAttribute('href');
    // The thumbnail's alt already describes the photograph; reuse it
    // rather than inventing a second description of the same image.
    img.alt = thumb ? thumb.getAttribute('alt') : '';
    cap.textContent = link.getAttribute('data-caption') || '';
  };

  var open = function (i, trigger) {
    lastFocused = trigger || document.activeElement;
    show(i);
    box.removeAttribute('inert');
    box.setAttribute('data-open', 'true');
    document.body.style.overflow = 'hidden';

    // The closed dialog is `visibility: hidden`, and a hidden element cannot
    // take focus. Setting the attribute is not enough on its own — the style
    // has to be recomputed first, or .focus() silently does nothing and a
    // keyboard user is left tabbing around behind the open dialog. Reading a
    // layout property forces that flush synchronously. The timeout is a
    // fallback for engines that defer it anyway; focusing twice is harmless.
    void box.offsetWidth;
    closeBtn.focus();
    if (document.activeElement !== closeBtn) {
      setTimeout(function () { closeBtn.focus(); }, 50);
    }
  };

  var close = function () {
    box.setAttribute('data-open', 'false');
    box.setAttribute('inert', '');
    document.body.style.overflow = '';
    // Release the image so a large photo is not held in memory.
    img.removeAttribute('src');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  };

  links.forEach(function (link, i) {
    link.addEventListener('click', function (e) {
      // Let modified clicks (new tab, download, middle click) behave normally.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      open(i, link);
    });
  });

  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', function () { show(index - 1); });
  nextBtn.addEventListener('click', function () { show(index + 1); });

  // Clicking the backdrop closes; clicking the photo or a control does not.
  box.addEventListener('click', function (e) {
    if (e.target === box) close();
  });

  document.addEventListener('keydown', function (e) {
    if (box.getAttribute('data-open') !== 'true') return;
    if (e.key === 'Escape') { close(); return; }
    if (links.length < 2) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
  });
})();
