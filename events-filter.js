
(() => {
  const LIST_ITEM = '.events-collection-list .w-dyn-item';

  function text(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  function init() {
    const form = document.querySelector('.filter-form-wrapper');
    const search = document.querySelector('.filter-search');
    const citySelect = document.getElementById('all-cities');
    const monthSelect = document.getElementById('all-months');
    const items = Array.from(document.querySelectorAll(LIST_ITEM));

    if (!items.length || (!search && !citySelect && !monthSelect)) return;

    /* ---------- Read each event from its card ---------- */

    const events = items.map(function (item) {
      const card = item.querySelector('.events-card') || item;
      const location = text(card.querySelector('.events-card-location'));
      const firstDate = text(card.querySelector('.events-card-dates'));
      const start = new Date(firstDate);
      const valid = !isNaN(start);

      return {
        item: item,
        city: location.split(',')[0].trim(),
        monthKey: valid
          ? start.getFullYear() + '-' + String(start.getMonth() + 1).padStart(2, '0')
          : '',
        monthLabel: valid
          ? start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          : '',
        time: valid ? start.getTime() : Infinity,
        haystack: (
          text(card.querySelector('.events-card-title')) + ' ' +
          location + ' ' +
          text(card.querySelector('.event-details'))
        ).toLowerCase()
      };
    });

    /* ---------- Soonest first ---------- */

    events.sort(function (a, b) { return a.time - b.time; });

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

    fillSelect(citySelect, cities);
    fillSelect(monthSelect, months);

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

    /* ---------- Apply filters ---------- */

    function apply() {
      const query = search ? search.value.trim().toLowerCase() : '';
      const city = citySelect ? citySelect.value : '';
      const month = monthSelect ? monthSelect.value : '';
      let shown = 0;

      events.forEach(function (e) {
        const match =
          (!query || e.haystack.includes(query)) &&
          (!city || e.city === city) &&
          (!month || e.monthKey === month);

        e.item.style.display = match ? '' : 'none';
        if (match) shown += 1;
      });

      if (countEl) {
        countEl.innerHTML =
          shown + ' upcoming event' + (shown === 1 ? '' : 's') +
          ' &nbsp; · &nbsp; Soonest first';
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

      if (month) {
        active.push({
          label: monthSelect.options[monthSelect.selectedIndex].text,
          clear: function () { monthSelect.value = ''; }
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
        if (monthSelect) monthSelect.value = '';
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