/*
  Savoya Events filter, v3

  - One month at a time, every card for that month on one page
  - Opens on the current month
  - The next event (the first one that hasn't ended) is highlighted
  - Pagination is just "Last Month" and "Next Month"
  - Search and City still filter; the month buttons skip months with no matches
*/
(() => {
  const LIST_ITEM = '.events-collection-list .w-dyn-item';

  const LABEL_NEXT = 'Up Next';
  const LABEL_NOW = 'Happening Now';
  const LABEL_ENDED = 'Event Ended';   // replaces "Add to Calendar" on finished events

  function pagerChevron(path) {
    return (
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + path + '"/></svg>'
    );
  }

  function injectStyles() {
    if (document.getElementById('events-filter-styles')) return;
    const style = document.createElement('style');
    style.id = 'events-filter-styles';
    style.textContent = `
      /* Next event: dark card */
      .events-card.ev-next { background: #141313 !important; border-color: #141313 !important; }
      .ev-next .events-card-dates { color: #DD9058 !important; }
      .ev-next .events-card-location { color: #C9C6C2 !important; }
      .ev-next .events-card-title { color: #FFFCF8 !important; }
      .ev-next .event-details { color: #C9C6C2 !important; }
      .ev-next .btn-add-to-cal:not(.b-0) { background: rgba(255, 252, 248, .08) !important; color: #FFFCF8 !important; }
      .ev-next .btn-add-to-cal:not(.b-0) .calendar-toggle-icon::before,
      .ev-next .btn-add-to-cal:not(.b-0) .calendar-toggle-icon::after { background-color: #FFFCF8 !important; }
      .ev-next .btn-view-event-details { background: transparent !important; color: #DD9058 !important; }

      /* One lap of the site's gold ring on load. The ring and its glow-spin
         animation come from .glow-card in core/cards.css; this only plays it once. */
      @keyframes ev-halo-glow {
        0% { box-shadow: none; }
        10%, 80% { box-shadow: 0 0 24px rgba(245, 173, 89, .28), 0 0 60px rgba(197, 97, 41, .16); }
        100% { box-shadow: none; }
      }
      .glow-card.ev-halo::before { opacity: 1; animation: glow-spin 3.5s linear .4s 1 both running; }
      .glow-card.ev-halo { animation: ev-halo-glow 3.9s ease 1 both; }
      @media (prefers-reduced-motion: reduce) {
        .glow-card.ev-halo, .glow-card.ev-halo::before { animation: none; }
      }

      /* Finished events: black-and-white photo, Add to Calendar disabled.
         The rest of the card (View Full Description) still works. */
      .events-card.ev-past .events-img { filter: grayscale(1); }
      .events-card.ev-past .btn-add-to-cal:not(.b-0) { opacity: .45; cursor: default; pointer-events: none; }
      .events-card.ev-past .btn-add-to-cal:not(.b-0) .calendar-toggle-icon { display: none; }
      .events-card.ev-past .item-list-add-to-cal { display: none !important; }

      .ev-next-badge {
        position: absolute;
        top: 16px;
        left: 16px;
        z-index: 3;
        padding: 6px 12px;
        border-radius: 999px;
        background: #C56129;
        color: #FFFCF8;
        font-family: Inter, sans-serif;
        font-size: 12px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: .02em;
        pointer-events: none;
      }

      /* Month pager */
      .events-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin-top: 48px;
      }
      .events-pager[hidden] { display: none; }
      .events-pager-arrow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 44px;
        padding: 0 18px 0 12px;
        border: 1px solid rgba(20, 19, 19, .15);
        border-radius: 8px;
        background: transparent;
        color: #141313;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        transition: border-color 200ms ease, color 200ms ease, opacity 200ms ease;
      }
      .events-pager-arrow[data-dir="1"] { padding: 0 12px 0 18px; }
      @media (hover: hover) {
        .events-pager-arrow:not(:disabled):hover { border-color: #C56129; color: #C56129; }
      }
      .events-pager-arrow:disabled { opacity: .3; cursor: default; }
      .events-pager-arrow:focus-visible { outline: 2px solid #C56129; outline-offset: 3px; }

      @media (prefers-reduced-motion: reduce) {
        .events-pager-arrow { transition: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function text(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  /* ---------- City labels: "City, ST" or "City, Country code" ---------- */

  const US_STATES = {
    'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
    'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'district of columbia': 'DC',
    'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL',
    'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA',
    'maine': 'ME', 'maryland': 'MD', 'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN',
    'mississippi': 'MS', 'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
    'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
    'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK', 'oregon': 'OR',
    'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
    'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT', 'virginia': 'VA',
    'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
    'puerto rico': 'PR'
  };

  // Country codes (ISO, except the ones people know by another acronym)
  const COUNTRIES = {
    'france': 'FR', 'united kingdom': 'UK', 'england': 'UK', 'great britain': 'UK',
    'canada': 'CA', 'mexico': 'MX', 'germany': 'DE', 'italy': 'IT', 'spain': 'ES',
    'portugal': 'PT', 'netherlands': 'NL', 'belgium': 'BE', 'switzerland': 'CH',
    'austria': 'AT', 'ireland': 'IE', 'monaco': 'MC', 'sweden': 'SE', 'norway': 'NO',
    'denmark': 'DK', 'greece': 'GR', 'japan': 'JP', 'china': 'CN', 'singapore': 'SG',
    'australia': 'AU', 'new zealand': 'NZ', 'india': 'IN', 'brazil': 'BR',
    'united arab emirates': 'UAE', 'saudi arabia': 'SA', 'qatar': 'QA', 'israel': 'IL',
    'south africa': 'ZA', 'south korea': 'KR', 'hong kong': 'HK'
  };

  const US_NAMES = /^(united states( of america)?|usa|us|u\.s\.a?\.?)$/i;

  // "Austin, Texas, United States" -> "Austin, TX"
  // "Washington, DC, United States" -> "Washington, DC"
  // "Paris, France" -> "Paris, FR"
  // "TBD" -> "" (left out of the dropdown)
  function cityLabel(location) {
    if (!location || /^tbd$/i.test(location)) return '';

    const parts = location.split(',').map(function (part) { return part.trim(); }).filter(Boolean);
    const inUS = parts.length > 2 && US_NAMES.test(parts[parts.length - 1]);
    if (inUS) parts.pop();

    const city = parts[0];
    const region = parts[1];
    if (!region) return city;

    const key = region.toLowerCase();

    if (/^[A-Za-z]{2,3}$/.test(region)) return city + ', ' + region.toUpperCase();
    if (US_STATES[key] && (inUS || !COUNTRIES[key])) return city + ', ' + US_STATES[key];
    if (COUNTRIES[key]) return city + ', ' + COUNTRIES[key];
    return city + ', ' + region;
  }

  function init() {
    const form = document.querySelector('.filter-form-wrapper');
    const search = document.querySelector('.filter-search');
    const citySelect = document.getElementById('all-cities');
    const monthSelect = document.getElementById('all-months');
    const items = Array.from(document.querySelectorAll(LIST_ITEM));

    if (!items.length) return;

    injectStyles();

    /* ---------- Read each event from its card ---------- */

    // Dates use the visitor's local time
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    function monthKeyOf(date) {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }
    const currentMonthKey = monthKeyOf(now);

    function cardDates(card) {
      return Array.from(card.querySelectorAll('.events-card-dates'))
        .filter(function (el) { return !el.classList.contains('w-dyn-bind-empty'); })
        .map(function (el) { return new Date(text(el)); })
        .filter(function (date) { return !isNaN(date); });
    }

    const events = [];

    items.forEach(function (item) {
      const card = item.querySelector('.events-card') || item;
      const location = text(card.querySelector('.events-card-location'));
      const dates = cardDates(card);
      const start = dates[0];
      const end = dates.length ? dates[dates.length - 1] : null;
      const valid = !!start;

      // Finished = its last day is before today
      const past = !!(end && end < today);
      const started = !!(start && start <= today);

      // An event that began in an earlier month and is still running files under this month
      const monthDate = valid && !past && start < monthStart ? monthStart : start;

      events.push({
        item: item,
        card: card,
        past: past,
        started: started,
        city: cityLabel(location),
        monthKey: valid ? monthKeyOf(monthDate) : '',
        monthLabel: valid
          ? monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : '',
        time: valid ? start.getTime() : Infinity,
        haystack: (
          text(card.querySelector('.events-card-title')) + ' ' +
          location + ' ' +
          text(card.querySelector('.event-details'))
        ).toLowerCase()
      });
    });

    /* ---------- Calendar order: soonest start first ---------- */

    events.sort(function (a, b) { return a.time - b.time; });

    const listParent = items[0].parentElement;
    events.forEach(function (event) { listParent.appendChild(event.item); });

    /* ---------- Mark finished events and the next one ---------- */

    const badge = document.createElement('span');
    badge.className = 'ev-next-badge';

    // Finished events: black-and-white photo and a disabled "Event Ended" button.
    // The popup (events.js) copies cards with their classes, so it matches.
    events.forEach(function (e) {
      if (!e.past) return;
      e.card.classList.add('ev-past');

      const button = e.card.querySelector('.btn-add-to-cal:not(.b-0)');
      if (!button) return;
      const label = Array.from(button.childNodes).find(function (node) {
        return node.nodeType === 3 && node.textContent.trim();
      });
      if (label) label.textContent = LABEL_ENDED + ' ';
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('tabindex', '-1');
    });

    // Block clicks and keys on a disabled button, in the grid and in the popup
    ['click', 'keydown'].forEach(function (type) {
      document.addEventListener(type, function (event) {
        const target = event.target;
        if (!target || !target.closest) return;
        if (type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
        if (target.closest('.events-card.ev-past .btn-add-to-cal:not(.b-0)')) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      }, true);
    });

    // The halo plays one lap, once per page load, the first time the
    // highlighted card is on screen (on phones it can start below the fold)
    let haloPlayed = false;
    let haloWatch = null;

    function playHalo(card) {
      if (haloPlayed) return;
      if (haloWatch) haloWatch.disconnect();

      function play() {
        haloPlayed = true;
        card.classList.remove('ev-halo');
        void card.offsetWidth;
        card.classList.add('ev-halo');
        card.addEventListener('animationend', function done(event) {
          if (event.animationName !== 'ev-halo-glow') return;
          card.classList.remove('ev-halo');
          card.removeEventListener('animationend', done);
        });
      }

      if (!('IntersectionObserver' in window)) { play(); return; }
      haloWatch = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          haloWatch.disconnect();
          play();
        }
      }, { threshold: 0.5 });
      haloWatch.observe(card);
    }

    // Highlights the one next event (first unfinished one that fits the
    // search and city), and only when its month is the one on screen
    function markNext(candidates, shown) {
      events.forEach(function (e) { e.card.classList.remove('ev-next', 'glow-card', 'ev-halo'); });
      badge.remove();

      const next = candidates.find(function (e) { return !e.past; });
      if (!next || shown.indexOf(next) < 0) return;

      // glow-card (core/cards.css) also gives it the site's ring on hover
      next.card.classList.add('ev-next', 'glow-card');
      badge.textContent = next.started ? LABEL_NOW : LABEL_NEXT;
      next.card.appendChild(badge);
      playHalo(next.card);
    }

    /* ---------- Fill the City and Month dropdowns ---------- */

    function fillSelect(select, entries, keepPlaceholder) {
      if (!select) return;

      const placeholder = select.options[0];
      select.innerHTML = '';
      if (placeholder && keepPlaceholder) {
        placeholder.value = '';
        select.appendChild(placeholder);
      }

      entries.forEach(function (entry) {
        const option = document.createElement('option');
        option.value = entry.value;
        option.textContent = entry.label;
        select.appendChild(option);
      });
    }

    const cities = Array.from(new Set(events.map(function (e) { return e.city; })))
      .filter(Boolean)
      .sort()
      .map(function (city) { return { value: city, label: city }; });

    const months = [];
    events.forEach(function (e) {
      if (e.monthKey && !months.some(function (m) { return m.value === e.monthKey; })) {
        months.push({ value: e.monthKey, label: e.monthLabel });
      }
    });
    months.sort(function (a, b) { return a.value < b.value ? -1 : a.value > b.value ? 1 : 0; });

    fillSelect(citySelect, cities, true);
    fillSelect(monthSelect, months, false);   // always one month, so no "All Months"

    // Current month; if it has no events, the next month that does
    // (or the latest one, if every event is in the past)
    const defaultMonth = (function () {
      if (!months.length) return '';
      const ahead = months.find(function (m) { return m.value >= currentMonthKey; });
      return (ahead || months[months.length - 1]).value;
    })();

    let month = defaultMonth;
    if (monthSelect) monthSelect.value = month;

    function monthLabel(key) {
      const m = months.find(function (entry) { return entry.value === key; });
      return m ? m.label : '';
    }

    /* ---------- Count, empty state, active tags ---------- */

    const countEl = document.querySelector('.database-overline');

    const emptyEl = document.createElement('p');
    emptyEl.className = 'events-empty v2-par';
    emptyEl.hidden = true;
    listParent.parentElement.appendChild(emptyEl);

    const tagTemplate = document.querySelector('[fs-cmsfilter-element="tag-template"]');
    const tagGroup = tagTemplate && tagTemplate.parentElement;

    if (tagTemplate) tagTemplate.remove();

    function renderTags(active) {
      if (!tagGroup || !tagTemplate) return;

      tagGroup.innerHTML = '';

      active.forEach(function (filter) {
        const tag = tagTemplate.cloneNode(true);
        const label = tag.querySelector('[fs-cmsfilter-element="tag-text"]');
        const remove = tag.querySelector('[fs-cmsfilter-element="tag-remove"]');

        tag.removeAttribute('fs-cmsfilter-element');
        if (label) label.textContent = filter.label;

        if (remove) {
          remove.setAttribute('role', 'button');
          remove.setAttribute('tabindex', '0');
          remove.setAttribute('aria-label', 'Remove filter: ' + filter.label);
          remove.style.cursor = 'pointer';

          const clearOne = function (event) {
            event.preventDefault();
            filter.clear();
            apply();
          };

          remove.addEventListener('click', clearOne);
          remove.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') clearOne(event);
          });
        }

        tagGroup.appendChild(tag);
      });
    }

    /* ---------- Month pager: Last Month / Next Month ---------- */

    const grid = listParent;               // the CMS grid (.w-dyn-items)
    const listWrap = grid.parentElement;   // .events-collection-list
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const pager = document.createElement('nav');
    pager.className = 'events-pager';
    pager.setAttribute('aria-label', 'Event months');
    pager.innerHTML =
      '<button type="button" class="events-pager-arrow" data-dir="-1">' +
        pagerChevron('M15 18l-6-6 6-6') + '<span>Last Month</span>' +
      '</button>' +
      '<button type="button" class="events-pager-arrow" data-dir="1">' +
        '<span>Next Month</span>' + pagerChevron('M9 18l6-6-6-6') +
      '</button>';
    listWrap.parentElement.insertBefore(pager, listWrap.nextSibling);

    const prevBtn = pager.querySelector('[data-dir="-1"]');
    const nextBtn = pager.querySelector('[data-dir="1"]');

    let prevMonth = '';
    let nextMonth = '';
    let sliding = null;

    function renderPager(monthsWithMatches) {
      const before = monthsWithMatches.filter(function (m) { return m < month; });
      const after = monthsWithMatches.filter(function (m) { return m > month; });
      prevMonth = before[before.length - 1] || '';
      nextMonth = after[0] || '';

      prevBtn.disabled = !prevMonth;
      nextBtn.disabled = !nextMonth;
      prevBtn.setAttribute('aria-label', prevMonth ? 'Last Month: ' + monthLabel(prevMonth) : 'No earlier events');
      nextBtn.setAttribute('aria-label', nextMonth ? 'Next Month: ' + monthLabel(nextMonth) : 'No later events');
      pager.hidden = !prevMonth && !nextMonth;
    }

    // Cards in a newly shown month skip the scroll fade-in; the slide is their entrance
    function settleCards(shown) {
      shown.forEach(function (e) {
        e.card.classList.add('fade-in-active');
        e.item.querySelectorAll('.reveal-up').forEach(function (el) {
          el.classList.add('reveal-up-active');
        });
      });
    }

    function goToMonth(key, dir) {
      if (!key) return;

      function swap() {
        month = key;
        if (monthSelect) monthSelect.value = key;
        settleCards(apply());
        const top = listWrap.getBoundingClientRect().top;
        if (top < 0) window.scrollBy({ top: top - 120, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      }

      if (sliding) sliding.cancel();
      if (reducedMotion.matches || !grid.animate) { swap(); return; }

      const out = grid.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: 'translateX(' + (-dir * 64) + 'px)', opacity: 0 }
        ],
        { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }
      );
      sliding = out;

      out.onfinish = function () {
        if (sliding !== out) return;
        swap();
        const inn = grid.animate(
          [
            { transform: 'translateX(' + (dir * 64) + 'px)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 }
          ],
          { duration: 480, easing: 'cubic-bezier(.22, 1, .36, 1)' }
        );
        out.cancel();
        sliding = inn;
        inn.onfinish = function () { if (sliding === inn) sliding = null; };
      };
    }

    prevBtn.addEventListener('click', function () { goToMonth(prevMonth, -1); });
    nextBtn.addEventListener('click', function () { goToMonth(nextMonth, 1); });

    // Touch swipe on the grid
    let touchStart = null;
    grid.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    grid.addEventListener('touchend', function (event) {
      if (!touchStart) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goToMonth(nextMonth, 1);
        else goToMonth(prevMonth, -1);
      }
    }, { passive: true });

    /* ---------- Apply filters ---------- */

    // Shows the chosen month's matching cards; returns them
    function apply() {
      const query = search ? search.value.trim().toLowerCase() : '';
      const city = citySelect ? citySelect.value : '';

      // Events that fit the search and city, in any month
      const candidates = events.filter(function (e) {
        return (!query || e.haystack.includes(query)) && (!city || e.city === city);
      });
      const monthList = Array.from(new Set(candidates
        .map(function (e) { return e.monthKey; })
        .filter(Boolean))).sort();

      // If this month has no matches, move to the nearest month that does
      // (the next one ahead first, otherwise the latest earlier one)
      if (monthList.length && monthList.indexOf(month) < 0) {
        const ahead = monthList.find(function (m) { return m > month; });
        month = ahead || monthList[monthList.length - 1];
        if (monthSelect) monthSelect.value = month;
      }

      const shown = [];
      events.forEach(function (e) {
        const match = candidates.indexOf(e) >= 0 && e.monthKey === month;
        e.item.style.display = match ? '' : 'none';
        if (match) shown.push(e);
      });

      markNext(candidates, shown);
      renderPager(monthList);

      if (countEl) {
        countEl.textContent =
          shown.length + (shown.length === 1 ? ' event available' : ' events available');
      }

      emptyEl.textContent = 'No events match your filters.';
      emptyEl.hidden = shown.length > 0;

      const active = [];

      if (query) {
        active.push({
          label: '“' + search.value.trim() + '”',
          clear: function () { search.value = ''; }
        });
      }

      if (city) {
        active.push({
          label: city,
          clear: function () { citySelect.value = ''; }
        });
      }

      renderTags(active);
      return shown;
    }

    /* ---------- Inputs ---------- */

    let typing = null;

    if (search) {
      search.addEventListener('input', function () {
        clearTimeout(typing);
        typing = setTimeout(apply, 150);
      });
    }

    if (citySelect) citySelect.addEventListener('change', apply);

    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        const key = monthSelect.value;
        if (key && key !== month) goToMonth(key, key > month ? 1 : -1);
      });
    }

    // Stop Webflow's form handler: Enter just filters, it never submits.
    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopImmediatePropagation();
        apply();
      }, true);
    }

    document.querySelectorAll('[fs-cmsfilter-element="clear"]').forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        if (search) search.value = '';
        if (citySelect) citySelect.value = '';
        month = defaultMonth;
        if (monthSelect) monthSelect.value = month;
        apply();
      });
    });

    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
