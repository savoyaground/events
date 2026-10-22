
(() => {
  const LIST_ITEM = '.events-collection-list .w-dyn-item';
  const ROWS_PER_PAGE = 3;   // cards per page = columns at this screen size x 3

  function pagerChevron(path) {
    return (
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + path + '"/></svg>'
    );
  }

  function injectPagerStyles() {
    if (document.getElementById('events-pager-styles')) return;
    const style = document.createElement('style');
    style.id = 'events-pager-styles';
    style.textContent = `
      .events-collection-list .w-dyn-item.ev-off-page { display: none !important; }

      .events-pager {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-top: 48px;
      }
      .events-pager[hidden] { display: none; }
      .events-pager-pages { display: flex; gap: 4px; }

      .events-pager-arrow,
      .events-pager-page {
        display: grid;
        place-items: center;
        min-width: 44px;
        height: 44px;
        padding: 0 12px;
        border: 1px solid rgba(20, 19, 19, .15);
        border-radius: 8px;
        background: transparent;
        color: #141313;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        line-height: 1;
        cursor: pointer;
        transition: background-color 200ms ease, border-color 200ms ease, color 200ms ease, opacity 200ms ease;
      }
      .events-pager-page { border-color: transparent; }
      .events-pager-page[aria-current="page"] {
        background: #141313;
        border-color: #141313;
        color: #FFFCF8;
        cursor: default;
      }
      @media (hover: hover) {
        .events-pager-arrow:not(:disabled):hover,
        .events-pager-page:not([aria-current="page"]):hover {
          border-color: #C56129;
          color: #C56129;
        }
      }
      .events-pager-arrow:disabled { opacity: .3; cursor: default; }
      .events-pager-arrow.is-month {
        display: inline-flex;
        gap: 6px;
        padding: 0 16px 0 10px;
        white-space: nowrap;
      }
      .events-pager-arrow.is-month[data-dir="1"] { padding: 0 10px 0 16px; }
      .events-pager-pages[hidden] { display: none; }
      .events-pager-arrow:focus-visible,
      .events-pager-page:focus-visible { outline: 2px solid #C56129; outline-offset: 3px; }

      @media (prefers-reduced-motion: reduce) {
        .events-pager-arrow, .events-pager-page { transition: none; }
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

    if (!items.length || (!search && !citySelect && !monthSelect)) return;

    /* ---------- Read each event from its card ---------- */

    // Each event files under the month it starts in (visitor's local time).
    // The page opens on the current month; the pager's end buttons step to
    // the month before or after. Inside a month, events that haven't ended
    // come first (soonest first), then finished ones. Nothing is hidden.
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

      // An event that began in an earlier month and is still running files under this month
      const monthDate = valid && !past && start < monthStart ? monthStart : start;

      events.push({
        past: past,
        item: item,
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

    /* ---------- Current month first, then upcoming, then past ---------- */

    events.sort(function (a, b) {
      if (a.past !== b.past) return a.past ? 1 : -1;      // current month and later first
      return a.past ? b.time - a.time : a.time - b.time;  // past: most recent first
    });

    const listParent = items[0].parentElement;
    events.forEach(function (event) { listParent.appendChild(event.item); });

    /* ---------- Fill the City and Month dropdowns ---------- */

    function fillSelect(select, entries) {
      if (!select) return;

      const placeholder = select.options[0];
      select.innerHTML = '';
      if (placeholder) {
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

    fillSelect(citySelect, cities);
    fillSelect(monthSelect, months);

    // Open on this month; if it has no events, the next month that does
    // (or the latest one, if every event is in the past)
    const defaultMonth = (function () {
      if (!months.length) return '';
      const ahead = months.find(function (m) { return m.value >= currentMonthKey; });
      return (ahead || months[months.length - 1]).value;
    })();
    if (monthSelect) monthSelect.value = defaultMonth;

    /* ---------- Count, empty state, active tags ---------- */

    const countEl = document.querySelector('.database-overline');

    const emptyEl = document.createElement('p');
    emptyEl.className = 'events-empty v2-par';
    emptyEl.textContent = 'No events match your filters.';
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

    /* ---------- Pagination: 3 rows per page, slides left and right ---------- */

    const grid = listParent;               // the CMS grid (.w-dyn-items)
    const listWrap = grid.parentElement;   // .events-collection-list
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const EASE = 'cubic-bezier(.22, 1, .36, 1)';

    injectPagerStyles();

    const pager = document.createElement('nav');
    pager.className = 'events-pager';
    pager.setAttribute('aria-label', 'Event pages');
    pager.hidden = true;
    pager.innerHTML =
      '<button type="button" class="events-pager-arrow" data-dir="-1" aria-label="Previous page">' +
        pagerChevron('M15 18l-6-6 6-6') +
      '</button>' +
      '<div class="events-pager-pages"></div>' +
      '<button type="button" class="events-pager-arrow" data-dir="1" aria-label="Next page">' +
        pagerChevron('M9 18l6-6-6-6') +
      '</button>';
    listWrap.parentElement.insertBefore(pager, listWrap.nextSibling);

    const pagesEl = pager.querySelector('.events-pager-pages');
    const prevPage = pager.querySelector('[data-dir="-1"]');
    const nextPage = pager.querySelector('[data-dir="1"]');

    let matches = [];     // filtered events, in order
    let page = 0;
    let pageCount = 1;
    let pageSize = 9;
    let paging = null;    // running slide, so fast clicks don't stack

    function columns() {
      const cols = getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length;
      return Math.max(cols, 1);
    }

    function showPage(index) {
      page = Math.max(0, Math.min(index, pageCount - 1));
      const start = page * pageSize;

      matches.forEach(function (e, i) {
        const onPage = i >= start && i < start + pageSize;
        e.item.classList.toggle('ev-off-page', !onPage);
      });

      renderPager();
    }

    // Months that have events for the current search and city, in order
    let monthsWithMatches = [];
    let stepPrevMonth = '';   // set when the left arrow steps to the previous month
    let stepNextMonth = '';   // set when the right arrow steps to the next month

    function neighbourMonths() {
      const month = monthSelect ? monthSelect.value : '';
      if (!month) return { prev: '', next: '' };
      const before = monthsWithMatches.filter(function (m) { return m < month; });
      const after = monthsWithMatches.filter(function (m) { return m > month; });
      return { prev: before[before.length - 1] || '', next: after[0] || '' };
    }

    function monthName(key) {
      const m = months.find(function (entry) { return entry.value === key; });
      return m ? m.label : key;
    }

    const PREV_ICON = pagerChevron('M15 18l-6-6 6-6');
    const NEXT_ICON = pagerChevron('M9 18l6-6-6-6');

    function setArrow(btn, monthKey, isPrev) {
      if (monthKey) {
        btn.classList.add('is-month');
        btn.innerHTML = isPrev
          ? PREV_ICON + '<span>Last month</span>'
          : '<span>Next month</span>' + NEXT_ICON;
        btn.setAttribute('aria-label', (isPrev ? 'Last month: ' : 'Next month: ') + monthName(monthKey));
      } else {
        btn.classList.remove('is-month');
        btn.innerHTML = isPrev ? PREV_ICON : NEXT_ICON;
        btn.setAttribute('aria-label', isPrev ? 'Previous page' : 'Next page');
      }
    }

    function renderPager() {
      const nb = neighbourMonths();
      stepPrevMonth = page === 0 ? nb.prev : '';
      stepNextMonth = page >= pageCount - 1 ? nb.next : '';

      pager.hidden = pageCount < 2 && !nb.prev && !nb.next;
      pagesEl.hidden = pageCount < 2;
      pagesEl.innerHTML = '';

      for (let i = 0; i < pageCount; i += 1) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'events-pager-page';
        btn.textContent = String(i + 1);
        btn.setAttribute('aria-label', 'Page ' + (i + 1));
        if (i === page) btn.setAttribute('aria-current', 'page');
        btn.addEventListener('click', function () { goToPage(i); });
        pagesEl.appendChild(btn);
      }

      setArrow(prevPage, stepPrevMonth, true);
      setArrow(nextPage, stepNextMonth, false);
      prevPage.disabled = page === 0 && !stepPrevMonth;
      nextPage.disabled = page >= pageCount - 1 && !stepNextMonth;
    }

    // Cards on a newly shown page skip the scroll fade-in; the slide is their entrance
    function settleCards(index) {
      const start = index * pageSize;
      matches.slice(start, start + pageSize).forEach(function (e) {
        const card = e.item.querySelector('.events-card');
        if (card) card.classList.add('fade-in-active');
        e.item.querySelectorAll('.reveal-up').forEach(function (el) {
          el.classList.add('reveal-up-active');
        });
      });
    }

    function goToPage(index, options) {
      index = Math.max(0, Math.min(index, pageCount - 1));
      if (index === page) return;

      slide(index > page ? 1 : -1, function () {
        settleCards(index);
        showPage(index);
      }, options);
    }

    // Step to the month before (dir -1, lands on its last page) or after (dir 1, first page)
    function goToMonth(key, dir) {
      if (!monthSelect || !key) return;
      slide(dir, function () {
        monthSelect.value = key;
        apply({ lastPage: dir < 0 });
        settleCards(page);
      });
    }

    // Slide the grid out, swap what it shows, slide it back in
    function slide(dir, swap, options) {
      const animate = !(options && options.instant) && !reducedMotion.matches;

      if (paging) paging.cancel();

      // Keep the top of the grid in view when the new page is shorter
      function keepInView() {
        const top = listWrap.getBoundingClientRect().top;
        if (top < 0) {
          window.scrollBy({ top: top - 120, behavior: animate ? 'smooth' : 'auto' });
        }
      }

      if (!animate) {
        swap();
        keepInView();
        return;
      }

      const out = grid.animate(
        [
          { transform: 'translateX(0)', opacity: 1 },
          { transform: 'translateX(' + (-dir * 64) + 'px)', opacity: 0 }
        ],
        { duration: 220, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }
      );
      paging = out;

      out.onfinish = function () {
        if (paging !== out) return;
        swap();
        keepInView();

        const inn = grid.animate(
          [
            { transform: 'translateX(' + (dir * 64) + 'px)', opacity: 0 },
            { transform: 'translateX(0)', opacity: 1 }
          ],
          { duration: 480, easing: EASE }
        );
        out.cancel();
        paging = inn;
        inn.onfinish = function () { if (paging === inn) paging = null; };
      };
    }

    function paginate(resetPage) {
      if (paging) {
        paging.cancel();
        paging = null;
      }
      const firstShown = page * pageSize;
      pageSize = columns() * ROWS_PER_PAGE;
      pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
      showPage(resetPage ? 0 : Math.floor(firstShown / pageSize));
    }

    function stepBack() {
      if (stepPrevMonth) goToMonth(stepPrevMonth, -1);
      else goToPage(page - 1);
    }
    function stepForward() {
      if (stepNextMonth) goToMonth(stepNextMonth, 1);
      else goToPage(page + 1);
    }

    prevPage.addEventListener('click', stepBack);
    nextPage.addEventListener('click', stepForward);

    // Touch swipe on the grid
    let touchStart = null;
    grid.addEventListener('touchstart', function (event) {
      if (pager.hidden || event.touches.length !== 1) return;
      touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }, { passive: true });
    grid.addEventListener('touchend', function (event) {
      if (!touchStart) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - touchStart.x;
      const dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) stepForward();
        else stepBack();
      }
    }, { passive: true });

    // Rows reflow at each breakpoint (3, 2 or 1 column): keep the same cards in view
    let lastCols = columns();
    let resizing = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizing);
      resizing = setTimeout(function () {
        const cols = columns();
        if (cols === lastCols) return;
        lastCols = cols;
        paginate(false);
      }, 150);
    });

    // The details carousel (events.js) asks for the page holding the card it closed on
    document.addEventListener('savoya:events-reveal', function (event) {
      const item = event.detail && event.detail.item;
      const index = matches.findIndex(function (e) { return e.item === item; });
      if (index < 0) return;
      const target = Math.floor(index / pageSize);
      if (target !== page) {
        settleCards(target);
        showPage(target);
      }
    });

    /* ---------- Apply filters ---------- */

    function apply(options) {
      const query = search ? search.value.trim().toLowerCase() : '';
      const city = citySelect ? citySelect.value : '';
      const month = monthSelect ? monthSelect.value : '';
      const monthSet = {};
      matches = [];

      events.forEach(function (e) {
        const others =
          (!query || e.haystack.includes(query)) &&
          (!city || e.city === city);
        const match = others && (!month || e.monthKey === month);

        if (others && e.monthKey) monthSet[e.monthKey] = true;
        e.item.style.display = match ? '' : 'none';
        if (match) matches.push(e);
      });

      monthsWithMatches = Object.keys(monthSet).sort();

      const shown = matches.length;
      paginate(true);
      if (options && options.lastPage && pageCount > 1) showPage(pageCount - 1);

      if (countEl) {
        countEl.textContent =
          shown + (shown === 1 ? ' event available' : ' events available');
      }

      emptyEl.hidden = shown > 0;

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

      // The month the page opens on isn't a filter the visitor chose, so it gets no tag
      if (month && month !== defaultMonth) {
        active.push({
          label: monthSelect.options[monthSelect.selectedIndex].text,
          clear: function () { monthSelect.value = defaultMonth; }
        });
      }

      renderTags(active);
    }

    /* ---------- Events ---------- */

    let typing = null;

    if (search) {
      search.addEventListener('input', function () {
        clearTimeout(typing);
        typing = setTimeout(apply, 150);
      });
    }

    [citySelect, monthSelect].forEach(function (select) {
      if (select) select.addEventListener('change', apply);
    });

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
        if (monthSelect) monthSelect.value = defaultMonth;
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