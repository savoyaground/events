/* ==========================================================
   EVENTS PAGE
   Same calendar dropdowns as events.js, but "View Event Details"
   opens a centered, full-screen carousel of every visible event
   with a Material-style "expand from center" effect:
   the focused card is full width, its neighbours collapse
   into narrow slices that grow as they slide toward the center.

   (Formerly events-v2.js.)
   Loads Swiper from jsDelivr on its own.
   ========================================================== */

   (() => {
    if (window.__savoyaEventsV2) return;
    window.__savoyaEventsV2 = true;
  
    const SWIPER_JS = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
    const SWIPER_CSS = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
  
    const MAX_WIDTH = 720;        // px, focused card on desktop
    const COLLAPSED_RATIO = 0.24; // neighbour slice width, as a share of the card
    const COLLAPSED_RATIO_MOBILE = 0.12;
    const GAP = 8;                // px between cards
    const RADIUS = 20;            // px card corner radius
    const CLOSE_LABEL = 'Close Event Description';
    const SPEED = 650;            // ms, slide transition
    const EASE = 'cubic-bezier(.22, 1, .36, 1)'; // shared by the track and the cards
    // Side cards: slightly see-through, under a flat black overlay,
    // and the whole row fades out toward the left and right screen edges.
    const INACTIVE_OPACITY = 0.8; // side card opacity
    const OVERLAY = 0.75;         // black overlay on side cards (75%)
    // Depth: side cards sit "behind" the focused one
    const SIDE_SCALE = 0.9;       // side cards shrink to 90%
    const SIDE_BLUR = 2;          // px, out-of-focus blur on side cards
    const SIDE_GRAYSCALE = 0.6;   // colour drains from side cards
    const PARALLAX = 0.06;        // image drifts inside its card (share of card width)
    const KEN_BURNS_MS = 10000;   // one zoom + pan on the focused photo (then it reverses)
  
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* Pixel icons: drawn on a 20 x 20 grid, one square per "pixel".
       At 40px each pixel is exactly 2px, so the lines stay thin and crisp. */
    const PIXEL_GRID = 20;

    function diagonal(x, y, dx, dy, length) {
      const cells = [];
      for (let i = 0; i < length; i += 1) cells.push([x + dx * i, y + dy * i]);
      return cells;
    }

    const PIXEL_ICONS = {
      // one-pixel diagonal chevron, doubled at the tip so it stays symmetrical
      next:  diagonal(6, 2, 1, 1, 8).concat(diagonal(13, 10, -1, 1, 8)),
      prev:  diagonal(13, 2, -1, 1, 8).concat(diagonal(6, 10, 1, 1, 8)),
      // x: two diagonals that meet in a 2 x 2 center
      close: diagonal(2, 2, 1, 1, 16).concat(diagonal(17, 2, -1, 1, 16))
    };

    function pixelSvg(name, size) {
      const rects = PIXEL_ICONS[name].map(function (c) {
        return '<rect x="' + c[0] + '" y="' + c[1] + '" width="1" height="1"/>';
      }).join('');
      return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + PIXEL_GRID + ' ' + PIXEL_GRID + '" width="' + size + '" height="' + size + '" ' +
        'fill="currentColor" shape-rendering="crispEdges" aria-hidden="true">' + rects + '</svg>'
      );
    }

    // Same x as a CSS mask, for the "Close Event Description" button (takes the text colour)
    const PIXEL_X_MASK = 'url("data:image/svg+xml,' +
      encodeURIComponent(pixelSvg('close', 10).replace('currentColor', '#000')) + '")';
  
    /* ==========================================================
       1. STYLES (carousel only — card styles stay in events.css)
       ========================================================== */
  
    const css = `
      .ev2-dialog {
        position: fixed; inset: 0;
        width: 100vw; height: 100vh; height: 100dvh;
        max-width: none; max-height: none;
        margin: 0; padding: 0; border: 0;
        background: transparent; color: inherit;
        overflow: hidden;
      }
      .ev2-dialog[open] { display: flex; align-items: center; }
      .ev2-dialog:focus, .ev2-dialog:focus-visible { outline: none; }
  
      .ev2-dialog::backdrop {
        background: rgba(8, 8, 10, .9);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        animation: ev2-fade-in 300ms ease both;
      }
      .ev2-dialog.is-closing::backdrop { animation: ev2-fade-out 200ms ease both; }
  
      .ev2-dialog .swiper {
        width: 100%;
        padding: 24px 0;
        overflow: visible;
      }
      .ev2-dialog .swiper-wrapper { align-items: center; }
  
      /* The site styles a .swiper class; keep ours see-through */
      .ev2-dialog .swiper,
      .ev2-dialog .swiper-wrapper,
      .ev2-dialog .swiper-slide { background: transparent !important; }
  
      /* Cloned cards skip the scroll-reveal animations */
      .ev2-dialog .reveal-up,
      .ev2-dialog .fade-in,
      .ev2-dialog .focus-in {
        opacity: 1 !important;
        transform: none !important;
        filter: none !important;
        clip-path: none !important;
      }
  
      .ev2-dialog .swiper-slide {
        width: var(--ev2-w, ${MAX_WIDTH}px);
        height: auto;
      }
  
      /* The clipped "window" that grows and shrinks */
      .ev2-frame {
        position: relative;
        width: 100%;
        max-height: 86vh;
        max-height: 86dvh;
        border-radius: ${RADIUS}px;
        overflow: hidden;
        background: #fff;
        transform-origin: 50% 50%;
        will-change: clip-path, transform, opacity, filter;
      }
  
      /* Soft shadow that follows the clipped card shape */
      .ev2-dialog .swiper-slide { filter: drop-shadow(0 28px 44px rgba(0, 0, 0, .45)); }
  
      /* Image window for the parallax drift */
      .ev2-media { position: relative; overflow: hidden; aspect-ratio: 16 / 9; }
      .ev2-dialog .ev2-media img {
        display: block; width: 100%; height: 100%;
        object-fit: cover;
        scale: 1.15;          /* room for the drift */
        will-change: translate;
      }
  
      /* Flat black overlay on side cards */
      .ev2-shade {
        position: absolute; inset: 0;
        background: rgba(0, 0, 0, ${OVERLAY});
        pointer-events: none;
        opacity: 0;
        z-index: 2;
      }
  
      /* Fade the row out toward the left and right edges of the screen.
         The focused card (plus a little room for its shadow) stays solid. */
      .ev2-dialog .swiper {
        --ev2-solid: calc(var(--ev2-w, 720px) / 2 + 48px);
        -webkit-mask-image: linear-gradient(to right,
          transparent 0,
          #000 calc(50% - var(--ev2-solid)),
          #000 calc(50% + var(--ev2-solid)),
          transparent 100%);
                mask-image: linear-gradient(to right,
          transparent 0,
          #000 calc(50% - var(--ev2-solid)),
          #000 calc(50% + var(--ev2-solid)),
          transparent 100%);
      }
      .ev2-scroll {
        height: 100%;
        max-height: inherit;
        overflow-y: auto;
        overscroll-behavior: contain;
      }
  
      .ev2-dialog .ev2-frame .events-card {
        width: 100% !important;
        max-width: none !important;
        height: auto;
        margin: 0 !important;
        border: none !important;
        opacity: 1 !important;
        transform: none !important;
        visibility: visible !important;
      }
  
      .ev2-dialog .ev2-frame .events-card img {
        height: auto;
        aspect-ratio: 16 / 9;
      }
  
      .ev2-dialog .ev2-frame .events-card .event-details {
        display: block !important;
        -webkit-line-clamp: unset !important;
        line-clamp: unset;
        height: auto !important;
        max-height: none !important;
        white-space: normal !important;
        overflow: visible !important;
      }
  
      /* Track and cards must share one easing, or the cards "pull back" mid-slide */
      .ev2-dialog { --swiper-wrapper-transition-timing-function: ${EASE}; }
      .ev2-dialog .swiper-wrapper { transition-timing-function: ${EASE}; }
  
      .ev2-dialog .ev2-frame .btn-view-event-details::after {
        content: "";
        display: inline-block;
        flex: none;
        width: 1em;
        height: 1em;
        margin-left: .5em;
        vertical-align: -.125em;
        background: currentColor;
        -webkit-mask: ${PIXEL_X_MASK} center / contain no-repeat;
                mask: ${PIXEL_X_MASK} center / contain no-repeat;
      }
  
      /* Collapsed neighbours: whole slice is a "go to" target */
      .ev2-dialog .swiper-slide:not(.swiper-slide-active) .ev2-frame { cursor: pointer; }
      .ev2-dialog .swiper-slide:not(.swiper-slide-active) .ev2-scroll { pointer-events: none; }
  
      /* Close + chevrons: bare white pixel icons, no circle behind them */
      .ev2-close,
      .ev2-nav {
        position: fixed;
        z-index: 20;
        display: grid;
        place-items: center;
        width: 56px;
        height: 56px;
        padding: 0;
        border: 0;
        border-radius: 4px;
        background: none;
        color: #fff;
        cursor: pointer;
        filter: drop-shadow(0 2px 6px rgba(0, 0, 0, .45));
        transition: transform 240ms ${EASE}, opacity 180ms ease;
      }
      .ev2-close svg,
      .ev2-nav svg { display: block; width: 40px; height: 40px; pointer-events: none; }
      .ev2-close { top: 16px; right: 16px; }
      .ev2-nav { top: 50%; margin-top: -28px; }
      .ev2-prev { left: 8.33%; }
      .ev2-next { right: 8.33%; }
      .ev2-nav.swiper-button-disabled { opacity: .3; cursor: default; }

      /* Hover: chevrons step two pixels (4px) the way they point; the x steps up */
      @media (hover: hover) {
        .ev2-prev:not(.swiper-button-disabled):hover { transform: translateX(-4px); }
        .ev2-next:not(.swiper-button-disabled):hover { transform: translateX(4px); }
        .ev2-close:hover { transform: scale(1.1); }
      }
      .ev2-nav:active:not(.swiper-button-disabled),
      .ev2-close:active { opacity: .7; }
      .ev2-close:focus-visible,
      .ev2-nav:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

      @media (max-width: 991px) {
        .ev2-nav { display: none; }
      }
  
      .ev2-dialog.is-single .ev2-nav { display: none; }
  
      @keyframes ev2-fade-in  { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ev2-fade-out { from { opacity: 1; } to { opacity: 0; } }
  
      @media (prefers-reduced-motion: reduce) {
        .ev2-dialog::backdrop,
        .ev2-dialog.is-closing::backdrop { animation: none; }
        .ev2-close, .ev2-nav { transition: none; }
      }
    `;
  
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  
    /* ==========================================================
       2. LOAD SWIPER (once)
       ========================================================== */
  
    function loadSwiper() {
      if (window.Swiper) return Promise.resolve(window.Swiper);
  
      if (!document.querySelector(`link[href="${SWIPER_CSS}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = SWIPER_CSS;
        document.head.appendChild(link);
      }
  
      return new Promise(function (resolve, reject) {
        const existing = document.querySelector(`script[src="${SWIPER_JS}"]`);
        const script = existing || document.createElement('script');
  
        script.addEventListener('load', function () { resolve(window.Swiper); });
        script.addEventListener('error', reject);
  
        if (!existing) {
          script.src = SWIPER_JS;
          document.head.appendChild(script);
        }
      });
    }
  
    /* ==========================================================
       3. SHARED BUTTON ACCESSIBILITY
       ========================================================== */
  
    function prepareButton(button) {
      if (button.dataset.ev2Ready) return;
      button.dataset.ev2Ready = 'true';
  
      if (button.tagName === 'BUTTON') {
        button.type = 'button';
        return;
      }
  
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');
  
      button.addEventListener('keydown', function (event) {
        const nativeLink = button.tagName === 'A' && button.hasAttribute('href');
  
        if (event.key === ' ' || (event.key === 'Enter' && !nativeLink)) {
          event.preventDefault();
          button.click();
        }
      });
    }
  
    /* ==========================================================
       4. ADD TO CALENDAR DROPDOWNS
       Works on page cards and on the cloned cards in the carousel.
       ========================================================== */
  
    const dropdowns = [];
    let dropdownCount = 0;
  
    function setupDropdowns(root) {
      root.querySelectorAll('.calendar-dropdown').forEach(function (wrapper) {
        if (wrapper.dataset.ev2Dropdown) return;
        wrapper.dataset.ev2Dropdown = 'true';
  
        const button = wrapper.querySelector('.btn-add-to-cal');
        const list = wrapper.querySelector('.item-list-add-to-cal');
  
        if (!button || !list) return;
  
        const pageCard = wrapper.closest('.w-dyn-item .events-card');
        let isOpen = false;
        let listAnimation = null;
        let cardAnimation = null;
  
        list.id = 'ev2-calendar-options-' + (dropdownCount += 1);
  
        prepareButton(button);
        button.setAttribute('aria-controls', list.id);
        button.setAttribute('aria-expanded', 'false');
        button.classList.remove('br-bottom-0');
  
        list.style.display = 'none';
        list.style.flexDirection = 'column';
        list.inert = true;
  
        if (!button.querySelector('.calendar-toggle-icon')) {
          const icon = document.createElement('span');
          icon.className = 'calendar-toggle-icon';
          icon.setAttribute('aria-hidden', 'true');
          button.appendChild(icon);
        }
  
        function setListDisplay(display) {
          if (!pageCard || reducedMotion.matches) {
            list.style.display = display;
            return;
          }
  
          const fromHeight = getComputedStyle(pageCard).height;
  
          if (cardAnimation) cardAnimation.cancel();
          list.style.display = display;
  
          const toHeight = getComputedStyle(pageCard).height;
          if (fromHeight === toHeight) return;
  
          cardAnimation = pageCard.animate(
            [
              { height: fromHeight, overflow: 'hidden' },
              { height: toHeight, overflow: 'hidden' }
            ],
            {
              duration: display === 'none' ? 280 : 420,
              easing: 'cubic-bezier(.16, 1, .3, 1)'
            }
          );
        }
  
        function setOpen(open, immediate) {
          if (immediate) {
            if (listAnimation) listAnimation.cancel();
            if (cardAnimation) cardAnimation.cancel();
            listAnimation = null;
            cardAnimation = null;
            isOpen = open;
            button.classList.toggle('br-bottom-0', open);
            button.setAttribute('aria-expanded', String(open));
            list.inert = !open;
            list.style.display = open ? 'flex' : 'none';
            return;
          }
  
          if (isOpen === open) return;
  
          const current = getComputedStyle(list);
          const isVisible = current.display !== 'none';
          const from = {
            opacity: isVisible ? current.opacity : '0',
            transform: isVisible ? current.transform : 'translateY(-8px) scale(.98)'
          };
  
          if (listAnimation) {
            listAnimation.cancel();
            listAnimation = null;
          }
  
          isOpen = open;
          button.classList.toggle('br-bottom-0', open);
          button.setAttribute('aria-expanded', String(open));
  
          if (!open && list.contains(document.activeElement)) button.focus();
  
          list.inert = !open;
  
          if (reducedMotion.matches) {
            setListDisplay(open ? 'flex' : 'none');
            return;
          }
  
          setListDisplay('flex');
  
          const nextAnimation = list.animate(
            [
              from,
              {
                opacity: open ? 1 : 0,
                transform: open ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(.985)'
              }
            ],
            {
              duration: open ? 360 : 180,
              easing: open ? 'cubic-bezier(.16, 1, .3, 1)' : 'cubic-bezier(.4, 0, 1, 1)',
              fill: 'both'
            }
          );
  
          listAnimation = nextAnimation;
  
          nextAnimation.onfinish = function () {
            if (listAnimation !== nextAnimation) return;
            if (!isOpen) setListDisplay('none');
            nextAnimation.cancel();
            listAnimation = null;
          };
        }
  
        dropdowns.push({ wrapper: wrapper, setOpen: setOpen });
  
        button.addEventListener('click', function (event) {
          event.preventDefault();
          const shouldOpen = !isOpen;
  
          dropdowns.forEach(function (item) {
            if (item.wrapper !== wrapper) item.setOpen(false);
          });
  
          setOpen(shouldOpen);
        });
  
        wrapper.addEventListener('keydown', function (event) {
          if (event.key === 'Escape' && isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
            button.focus();
          }
        });
  
        list.addEventListener('click', function (event) {
          if (event.target.closest('a, button')) setOpen(false);
        });
      });
    }
  
    document.addEventListener('click', function (event) {
      dropdowns.forEach(function (item) {
        if (item.wrapper.isConnected && !item.wrapper.contains(event.target)) {
          item.setOpen(false);
        }
      });
    });
  
    function closeAllDropdowns() {
      dropdowns.forEach(function (item) { item.setOpen(false, true); });
    }
  
    /* Card width + slice ratio adapt to the screen so the
       neighbouring slices always stay visible */
  
    function currentRatio() {
      return window.innerWidth < 768 ? COLLAPSED_RATIO_MOBILE : COLLAPSED_RATIO;
    }
  
    function sizeSlides() {
      const r = currentRatio();
      const room = (window.innerWidth - 32 - GAP * 2) / (1 + r);
      const width = Math.max(240, Math.min(MAX_WIDTH, Math.floor(room)));
      dialog.style.setProperty('--ev2-w', width + 'px');
    }
  
    /* ==========================================================
       5. MATERIAL "EXPAND FROM CENTER" EFFECT
       Each slide is clipped from both sides based on its distance
       from the center, then shifted so the visible parts keep an
       even GAP between them. Distance 0 = full card,
       distance ≥ 1 = narrow slice (COLLAPSED_RATIO).
       ========================================================== */
  
    function applyMaterial(swiper) {
      const slides = swiper.slides;
      if (!slides.length) return;
  
      const W = slides[0].offsetWidth;
      const S = GAP;
      const r = currentRatio();
  
      // Distance between the centers of a full card and a collapsed neighbour
      // Side cards are scaled down, so measure their visible (scaled) width
      // to keep the gutter exactly GAP wide.
      const sliver = r * W * SIDE_SCALE;
      const firstStep = W / 2 + S + sliver / 2;
      // Distance between two collapsed neighbours
      const nextStep = sliver + S;
  
      // Our own progress: 0 = centered, +1 = one card to the left, -1 = one to the right.
      // (Swiper's slide.progress drifts a few % with auto-width slides + spaceBetween,
      //  which left the focused card slightly clipped and shaded.)
      const grid = swiper.slidesGrid;
      const step = W + S;
  
      slides.forEach(function (slide, index) {
        const p = grid[index] === undefined ? slide.progress : (-swiper.translate - grid[index]) / step;
        const d = Math.abs(p);
        const sign = p === 0 ? 0 : p > 0 ? -1 : 1; // negative progress = to the right
  
        const visibleRatio = 1 - (1 - r) * Math.min(d, 1);
        const clip = ((1 - visibleRatio) * W) / 2;
  
        const desired = d <= 1 ? d * firstStep : firstStep + (d - 1) * nextStep;
        const natural = d * (W + S);
        const shift = sign * (desired - natural);
  
        const frame = slide.querySelector('.ev2-frame');
        if (!frame) return;
  
        frame.style.clipPath =
          'inset(0 ' + clip.toFixed(2) + 'px 0 ' + clip.toFixed(2) + 'px round ' + RADIUS + 'px)';
        // 0 = focused, 1 = fully a side card
        const amount = Math.min(d, 1);
        const scale = 1 - (1 - SIDE_SCALE) * amount;
  
        frame.style.transform =
          'translate3d(' + shift.toFixed(2) + 'px, 0, 0) scale(' + scale.toFixed(4) + ')';
  
        // Side cards: fade, drain colour, soften focus, darken under the overlay
        frame.style.opacity = String(1 - (1 - INACTIVE_OPACITY) * amount);
        frame.style.filter = amount < 0.001
          ? 'none'
          : 'blur(' + (SIDE_BLUR * amount).toFixed(2) + 'px) grayscale(' + (SIDE_GRAYSCALE * amount).toFixed(3) + ')';
  
        const shade = frame.querySelector('.ev2-shade');
        if (shade) shade.style.opacity = String(amount);
  
        // Parallax: the photo drifts the other way as the card travels
        const img = frame.querySelector('.ev2-media img');
        if (img) {
          const drift = Math.max(-1, Math.min(1, p)) * W * PARALLAX;
          // "translate" (not "transform"): the photo's reveal-up class forces transform: none
          img.style.translate = drift.toFixed(2) + 'px 0';
        }
  
        slide.style.zIndex = String(100 - Math.round(d * 10));
      });
    }
  
    function setMaterialTransition(swiper, duration) {
      swiper.slides.forEach(function (slide) {
        const frame = slide.querySelector('.ev2-frame');
        if (!frame) return;
        frame.style.transitionProperty = 'clip-path, transform, opacity, filter';
        frame.style.transitionDuration = duration + 'ms';
        frame.style.transitionTimingFunction = EASE;
  
        const shade = frame.querySelector('.ev2-shade');
        if (shade) {
          shade.style.transitionProperty = 'opacity';
          shade.style.transitionDuration = duration + 'ms';
          shade.style.transitionTimingFunction = EASE;
        }
  
        const img = frame.querySelector('.ev2-media img');
        if (img) {
          img.style.transitionProperty = 'translate';
          img.style.transitionDuration = duration + 'ms';
          img.style.transitionTimingFunction = EASE;
        }
      });
    }
  
    /* ==========================================================
       6. THE CAROUSEL DIALOG
       ========================================================== */
  
    const dialog = document.createElement('dialog');
    dialog.className = 'ev2-dialog';
    dialog.setAttribute('aria-label', 'Event details');
    dialog.innerHTML = `
      <button class="ev2-close" type="button" aria-label="${CLOSE_LABEL}">${pixelSvg('close', 40)}</button>
      <button class="ev2-nav ev2-prev" type="button" aria-label="Previous event">${pixelSvg('prev', 40)}</button>
      <button class="ev2-nav ev2-next" type="button" aria-label="Next event">${pixelSvg('next', 40)}</button>
      <div class="swiper"><div class="swiper-wrapper"></div></div>
    `;
    document.body.appendChild(dialog);
  
    const swiperEl = dialog.querySelector('.swiper');
    const wrapperEl = dialog.querySelector('.swiper-wrapper');
    const closeButton = dialog.querySelector('.ev2-close');
    const prevButton = dialog.querySelector('.ev2-prev');
    const nextButton = dialog.querySelector('.ev2-next');
  
    let swiper = null;
    let returnFocus = null;
    let closing = false;
    let previousOverflow = '';
  
    function buildSlide(card) {
      const clone = card.cloneNode(true);
  
      // Clean up anything that must stay unique or page-only
      clone.querySelectorAll('[id]').forEach(function (el) { el.removeAttribute('id'); });
      clone.querySelectorAll('[data-ev2-dropdown], [data-ev2-ready]').forEach(function (el) {
        delete el.dataset.ev2Dropdown;
        delete el.dataset.ev2Ready;
      });
      clone.querySelectorAll('.calendar-toggle-icon').forEach(function (el) { el.remove(); });
      clone.querySelectorAll('.ev-img-wait').forEach(function (el) { el.classList.remove('ev-img-wait'); });
      clone.removeAttribute('style');
  
      const details = clone.querySelector('.btn-view-event-details');
      if (details) {
        details.textContent = CLOSE_LABEL;
        details.removeAttribute('aria-haspopup');
        details.removeAttribute('aria-controls');
        details.removeAttribute('aria-expanded');
        details.addEventListener('click', function (event) {
          event.preventDefault();
          closeCarousel();
        });
        prepareButton(details);
      }
  
      const slide = document.createElement('div');
      slide.className = 'swiper-slide';
      slide.ev2Source = card; // the page card this slide was cloned from
  
      const frame = document.createElement('div');
      frame.className = 'ev2-frame';
  
      const scroll = document.createElement('div');
      scroll.className = 'ev2-scroll';
  
      const shade = document.createElement('div');
      shade.className = 'ev2-shade';
      shade.setAttribute('aria-hidden', 'true');
  
      // Wrap the photo so it can drift inside a fixed window
      const photo = clone.querySelector('.events-img');
      if (photo) {
        const media = document.createElement('div');
        media.className = 'ev2-media';
        photo.parentNode.insertBefore(media, photo);
        media.appendChild(photo);
      }
  
      scroll.appendChild(clone);
      frame.appendChild(scroll);
      frame.appendChild(shade);
      slide.appendChild(frame);
  
      setupDropdowns(clone);
  
      return slide;
    }
  
    async function openCarousel(card, button) {
      if (dialog.open) return;
  
      const Swiper = await loadSwiper();
  
      closeAllDropdowns();
  
      // Every event that matches the search/filters, on every page
      // (events-filter.js hides other pages with .ev-off-page)
      const cards = Array.from(document.querySelectorAll('.events .w-dyn-item .events-card'))
        .filter(function (item) {
          const li = item.closest('.w-dyn-item');
          if (li && li.classList.contains('ev-off-page')) return li.style.display !== 'none';
          return item.getClientRects().length > 0;
        });
  
      const startIndex = Math.max(cards.indexOf(card), 0);
  
      wrapperEl.innerHTML = '';
      cards.forEach(function (item) { wrapperEl.appendChild(buildSlide(item)); });
  
      dialog.classList.toggle('is-single', cards.length < 2);
  
      returnFocus = button;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
  
      dialog.showModal();
      closeButton.focus({ preventScroll: true });
  
      sizeSlides();
  
      swiper = new Swiper(swiperEl, {
        slidesPerView: 'auto',
        centeredSlides: true,
        spaceBetween: GAP,
        initialSlide: startIndex,
        speed: reducedMotion.matches ? 0 : SPEED,
        grabCursor: true,
        watchSlidesProgress: true,
        slideToClickedSlide: true,
        keyboard: { enabled: true },
        a11y: { enabled: true },
        navigation: { prevEl: prevButton, nextEl: nextButton },
        on: {
          init: applyMaterial,
          progress: applyMaterial,
          setTranslate: applyMaterial,
          beforeResize: sizeSlides,
          resize: applyMaterial,
          setTransition: setMaterialTransition,
          slideChange: function (s) {
            closeAllDropdowns();
            dialog.querySelectorAll('.ev2-scroll').forEach(function (el) { el.scrollTop = 0; });
            revealContent(s.slides[s.activeIndex], 180);
            kenBurns(s);
          }
        }
      });
  
      applyMaterial(swiper);
  
      if (!reducedMotion.matches) {
        // Opens from the center: the focused card grows out of the middle
        swiperEl.animate(
          [
            { opacity: 0, transform: 'scale(.9)' },
            { opacity: 1, transform: 'scale(1)' }
          ],
          { duration: 450, easing: 'cubic-bezier(.16, 1, .3, 1)' }
        );
  
        dialog.querySelectorAll('.ev2-close, .ev2-nav').forEach(function (el) {
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease' });
        });
  
        revealContent(swiper.slides[swiper.activeIndex], 220);
      }
  
      kenBurns(swiper);
    }
  
    // Ken Burns: the focused photo slowly zooms and pans.
    // Side cards pause where they are, so nothing jumps when a card leaves focus.
    function kenBurns(swiper) {
      if (reducedMotion.matches) return;
  
      swiper.slides.forEach(function (slide, index) {
        const img = slide.querySelector('.ev2-media img');
        if (!img) return;
  
        if (index === swiper.activeIndex) {
          if (!img.ev2KenBurns) {
            // Uses "scale" + transform-origin, so it layers on top of the parallax "translate"
            img.ev2KenBurns = img.animate(
              [
                { scale: 1.15, transformOrigin: '35% 55%' },
                { scale: 1.3, transformOrigin: '65% 40%' }
              ],
              {
                duration: KEN_BURNS_MS,
                easing: 'ease-in-out',
                direction: 'alternate',
                iterations: Infinity
              }
            );
          }
          img.ev2KenBurns.play();
        } else if (img.ev2KenBurns) {
          img.ev2KenBurns.pause();
        }
      });
    }
  
    // The focused card's text rises in, one line after another
    function revealContent(slide, delay) {
      if (!slide || reducedMotion.matches) return;
  
      const parts = slide.querySelectorAll(
        '.events-card-heading > *, .event-details, .events-footer'
      );
  
      parts.forEach(function (el, i) {
        el.getAnimations().forEach(function (a) { a.cancel(); });
        el.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' }
          ],
          { duration: 600, delay: delay + i * 70, easing: EASE, fill: 'backwards' }
        );
      });
    }
  
    function closeCarousel() {
      if (!dialog.open || closing) return;
      closing = true;
  
      if (reducedMotion.matches) {
        dialog.close();
        return;
      }
  
      dialog.classList.add('is-closing');
  
      const motion = swiperEl.animate(
        [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(.94)' }
        ],
        { duration: 200, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }
      );
  
      dialog.querySelectorAll('.ev2-close, .ev2-nav').forEach(function (el) {
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      });
  
      motion.onfinish = function () { dialog.close(); };
    }
  
    dialog.addEventListener('close', function () {
      // The card the visitor ended on: bring its page into view and return focus to it
      const activeSlide = swiper && swiper.slides[swiper.activeIndex];
      const endCard = activeSlide && activeSlide.ev2Source;
      let scrollToEnd = false;

      if (endCard) {
        document.dispatchEvent(new CustomEvent('savoya:events-reveal', {
          detail: { item: endCard.closest('.w-dyn-item') }
        }));
        const endButton = endCard.querySelector('.btn-view-event-details');
        if (endButton && endButton !== returnFocus) {
          returnFocus = endButton;
          scrollToEnd = true;
        }
      }

      if (swiper) {
        swiper.destroy(true, true);
        swiper = null;
      }
  
      // Forget dropdowns that lived in the carousel
      for (let i = dropdowns.length - 1; i >= 0; i -= 1) {
        if (dialog.contains(dropdowns[i].wrapper)) dropdowns.splice(i, 1);
      }
  
      wrapperEl.innerHTML = '';
      swiperEl.getAnimations().forEach(function (a) { a.cancel(); });
      dialog.querySelectorAll('.ev2-close, .ev2-nav').forEach(function (el) {
        el.getAnimations().forEach(function (a) { a.cancel(); });
      });
  
      dialog.classList.remove('is-closing', 'is-single');
      document.body.style.overflow = previousOverflow;
      closing = false;
  
      if (returnFocus) returnFocus.focus({ preventScroll: true });
      if (scrollToEnd && endCard) endCard.scrollIntoView({ block: 'center' });
      returnFocus = null;
    });
  
    closeButton.addEventListener('click', closeCarousel);
  
    dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeCarousel();
    });
  
    // Click on the dark background (not on a card or button) closes
    dialog.addEventListener('click', function (event) {
      if (
        event.target === dialog ||
        event.target === swiperEl ||
        event.target === wrapperEl ||
        event.target.classList.contains('swiper-slide')
      ) {
        closeCarousel();
      }
    });
  
    /* ==========================================================
       7. WIRE UP THE PAGE
       ========================================================== */
  
    /* ----------------------------------------------------------
       Card photos: let the reveal-up play on the real photo.
       The photos are lazy-loaded, so the mask used to open on an
       empty box before the photo arrived. Each photo now stays
       masked until it has loaded, then reveals.
       ---------------------------------------------------------- */
  
    const CARD_IMAGE_SIZES = '(max-width: 767px) 92vw, (max-width: 991px) 46vw, 30vw';
  
    function prepareCardImages() {
      const waitStyle = document.createElement('style');
      waitStyle.textContent =
        '.events .w-dyn-item .events-img.ev-img-wait { clip-path: inset(100% 0 0 0) !important; }';
      document.head.appendChild(waitStyle);
  
      document.querySelectorAll('.events .w-dyn-item .events-img').forEach(function (img) {
        // Webflow sets sizes="100vw", which downloads a full-screen-width photo
        // for a card a third of the screen wide. Ask for a card-sized one instead.
        if (img.getAttribute('sizes') === '100vw') img.sizes = CARD_IMAGE_SIZES;
  
        if (img.classList.contains('w-dyn-bind-empty')) return;
        if (img.complete && img.naturalWidth > 0) return;
  
        img.classList.add('ev-img-wait');
  
        const release = function () { img.classList.remove('ev-img-wait'); };
  
        img.addEventListener('load', release, { once: true });
        img.addEventListener('error', release, { once: true });
      });
    }
  
    function init() {
      prepareCardImages();
      setupDropdowns(document);
  
      document.querySelectorAll('.events .btn-view-event-details').forEach(function (button) {
        prepareButton(button);
        button.setAttribute('aria-haspopup', 'dialog');
  
        button.addEventListener('click', function (event) {
          event.preventDefault();
          const card = button.closest('.events-card');
          if (card) openCarousel(card, button);
        });
      });
  
      // Warm up Swiper so the first click opens instantly
      loadSwiper().catch(function () {});
    }
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  })();