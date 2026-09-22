
window.Webflow = window.Webflow || [];

window.Webflow.push(function () {
  if (document.getElementById('event-focus-dialog')) return;

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  const dropdowns = [];

  const CLOSE_LABEL = 'Close event details';

  /* ---------- Shared button accessibility ---------- */

  function prepareButton(button) {
    if (button.tagName === 'BUTTON') {
      button.type = 'button';
      return;
    }

    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');

    button.addEventListener('keydown', function (event) {
      const nativeLink =
        button.tagName === 'A' && button.hasAttribute('href');

      if (
        event.key === ' ' ||
        (event.key === 'Enter' && !nativeLink)
      ) {
        event.preventDefault();
        button.click();
      }
    });
  }

  /* ---------- Calendar dropdown setup ---------- */

  document.querySelectorAll('.calendar-dropdown').forEach(function (wrapper, index) {
    const button = wrapper.querySelector('.btn-add-to-cal');
    const list = wrapper.querySelector('.item-list-add-to-cal');

    if (!button || !list) return;

    const card = button.closest('.events-card');

    let isOpen = false;
    let listAnimation = null;
    let cardAnimation = null;

    if (!list.id) {
      let id = 'calendar-options-' + index;

      while (document.getElementById(id)) {
        id += '-menu';
      }

      list.id = id;
    }

    prepareButton(button);

    button.setAttribute('aria-controls', list.id);
    button.setAttribute('aria-expanded', 'false');
    button.classList.remove('br-bottom-0');

    list.style.display = 'none';
    list.style.flexDirection = 'column';
    list.inert = true;

    /* ---------- Add animated plus / minus icon ---------- */

    if (!button.querySelector('.calendar-toggle-icon')) {
      const icon = document.createElement('span');

      icon.className = 'calendar-toggle-icon';
      icon.setAttribute('aria-hidden', 'true');

      button.appendChild(icon);
    }

    /* ---------- Event card height animation ---------- */

    function setListDisplay(display) {
      if (!card || reducedMotion.matches) {
        if (cardAnimation) {
          cardAnimation.cancel();
          cardAnimation = null;
        }

        list.style.display = display;
        return;
      }

      const fromHeight = getComputedStyle(card).height;

      if (cardAnimation) {
        cardAnimation.cancel();
        cardAnimation = null;
      }

      list.style.display = display;

      const toHeight = getComputedStyle(card).height;

      if (fromHeight === toHeight) return;

      const nextAnimation = card.animate(
        [
          { height: fromHeight, overflow: 'hidden' },
          { height: toHeight, overflow: 'hidden' }
        ],
        {
          duration: display === 'none' ? 280 : 420,
          easing: 'cubic-bezier(.16, 1, .3, 1)'
        }
      );

      cardAnimation = nextAnimation;

      nextAnimation.onfinish = function () {
        if (cardAnimation === nextAnimation) {
          cardAnimation = null;
        }
      };
    }

    /* ---------- Calendar open / close state ---------- */

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
        transform: isVisible
          ? current.transform
          : 'translateY(-8px) scale(.98)'
      };

      if (listAnimation) {
        listAnimation.cancel();
        listAnimation = null;
      }

      isOpen = open;

      button.classList.toggle('br-bottom-0', open);
      button.setAttribute('aria-expanded', String(open));

      if (!open && list.contains(document.activeElement)) {
        button.focus();
      }

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
            transform: open
              ? 'translateY(0) scale(1)'
              : 'translateY(-6px) scale(.985)'
          }
        ],
        {
          duration: open ? 360 : 180,
          easing: open
            ? 'cubic-bezier(.16, 1, .3, 1)'
            : 'cubic-bezier(.4, 0, 1, 1)',
          fill: 'both'
        }
      );

      listAnimation = nextAnimation;

      nextAnimation.onfinish = function () {
        if (listAnimation !== nextAnimation) return;

        if (!isOpen) {
          setListDisplay('none');
        }

        nextAnimation.cancel();
        listAnimation = null;
      };
    }

    dropdowns.push({ wrapper, setOpen });

    /* ---------- Calendar interactions ---------- */

    button.addEventListener('click', function (event) {
      event.preventDefault();

      const shouldOpen = !isOpen;

      dropdowns.forEach(function (item) {
        if (item.wrapper !== wrapper) {
          item.setOpen(false);
        }
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
      if (event.target.closest('a, button')) {
        setOpen(false);
      }
    });
  });

  /* ---------- Close calendar on outside click ---------- */

  document.addEventListener('click', function (event) {
    dropdowns.forEach(function (item) {
      if (!item.wrapper.contains(event.target)) {
        item.setOpen(false);
      }
    });
  });

  /* ---------- Expanded event dialog setup ---------- */

  const chevron = function (path) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true"><path d="' + path + '"/></svg>'
    );
  };

  const dialog = document.createElement('dialog');

  dialog.id = 'event-focus-dialog';
  dialog.className = 'event-focus-dialog';
  dialog.setAttribute('aria-label', 'Event details');

  dialog.innerHTML = `
    <div class="event-focus-panel">
      <div class="event-focus-toolbar">
        <button
          class="event-focus-close"
          type="button"
          aria-label="Close event details"
          autofocus
        >×</button>
      </div>
      <div class="event-focus-content"></div>
    </div>
    <button
      class="event-focus-nav event-focus-prev"
      type="button"
      aria-label="Previous event"
    >${chevron('M15 18l-6-6 6-6')}</button>
    <button
      class="event-focus-nav event-focus-next"
      type="button"
      aria-label="Next event"
    >${chevron('M9 18l6-6-6-6')}</button>
  `;

  document.body.appendChild(dialog);

  const panel = dialog.querySelector('.event-focus-panel');
  const content = dialog.querySelector('.event-focus-content');
  const closeButton = dialog.querySelector('.event-focus-close');
  const prevButton = dialog.querySelector('.event-focus-prev');
  const nextButton = dialog.querySelector('.event-focus-next');

  let activeCard = null;
  let activeButton = null;
  let placeholder = null;
  let motion = null;
  let slideMotion = null;
  let closing = false;
  let previousOverflow = '';
  let navCards = [];
  let navIndex = 0;

  /* ---------- Button label: "Close event details" in popup ---------- */

  function setCloseLabel(button) {
    if (!button) return;

    if (button.dataset.originalLabel === undefined) {
      button.dataset.originalLabel = button.textContent;
    }

    button.textContent = CLOSE_LABEL;
    button.setAttribute('aria-expanded', 'true');
  }

  function restoreLabel(button) {
    if (!button) return;

    if (button.dataset.originalLabel !== undefined) {
      button.textContent = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }

    button.setAttribute('aria-expanded', 'false');
  }

  /* ---------- Keep the card's space in the page ---------- */

  function createPlaceholder(card) {
    const rect = card.getBoundingClientRect();
    const styles = getComputedStyle(card);
    const holder = document.createElement('div');

    holder.setAttribute('aria-hidden', 'true');

    Object.assign(holder.style, {
      width: rect.width + 'px',
      height: rect.height + 'px',
      maxWidth: '100%',
      boxSizing: 'border-box',
      margin: styles.margin,
      flex: styles.flex,
      alignSelf: styles.alignSelf,
      gridArea: styles.gridArea,
      visibility: 'hidden',
      pointerEvents: 'none'
    });

    return holder;
  }

  function moveIntoDialog(card) {
    placeholder = createPlaceholder(card);
    card.before(placeholder);

    // Moving the original preserves its calendar listeners.
    content.appendChild(card);
  }

  function returnToPage() {
    if (placeholder && activeCard) {
      placeholder.replaceWith(activeCard);
    }

    placeholder = null;
  }

  function closeCardDropdowns(card) {
    dropdowns.forEach(function (item) {
      if (card && card.contains(item.wrapper)) {
        item.setOpen(false, true);
      }
    });
  }

  /* ---------- View event details buttons ---------- */

  document.querySelectorAll(
    '.events .btn-view-event-details'
  ).forEach(function (button) {
    prepareButton(button);

    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-controls', dialog.id);
    button.setAttribute('aria-expanded', 'false');

    button.addEventListener('click', function (event) {
      event.preventDefault();

      if (activeCard) {
        if (activeButton === button) {
          closeDetails();
        }

        return;
      }

      const card = button.closest('.events-card');

      if (card) {
        openDetails(card, button);
      }
    });
  });

  /* ---------- Open expanded event ---------- */

  function openDetails(card, button) {
    // Settle calendar animations before moving the card.
    dropdowns.forEach(function (item) {
      item.setOpen(false, true);
    });

    // Every event currently visible on the page (respects filters/search).
    navCards = Array.from(
      document.querySelectorAll('.events .events-card')
    ).filter(function (item) {
      return item.getClientRects().length > 0;
    });

    navIndex = Math.max(navCards.indexOf(card), 0);
    dialog.classList.toggle('is-single', navCards.length < 2);

    activeCard = card;
    activeButton = button;

    moveIntoDialog(card);
    setCloseLabel(button);

    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    dialog.showModal();
    panel.scrollTop = 0;

    if (!reducedMotion.matches) {
      dialog.querySelectorAll('.event-focus-nav').forEach(function (nav) {
        nav.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 300, easing: 'ease' }
        );
      });

      motion = panel.animate(
        [
          {
            opacity: 0,
            transform: 'translateY(20px) scale(.94)'
          },
          {
            opacity: 1,
            transform: 'translateY(0) scale(1)'
          }
        ],
        {
          duration: 420,
          easing: 'cubic-bezier(.16, 1, .3, 1)'
        }
      );
    }
  }

  /* ---------- Previous / next event ---------- */

  function showEvent(step) {
    if (!activeCard || closing || navCards.length < 2) return;

    const total = navCards.length;
    const index = (navIndex + step + total) % total;
    const card = navCards[index];

    if (!card || card === activeCard) return;

    closeCardDropdowns(activeCard);
    restoreLabel(activeButton);
    returnToPage();

    activeCard = card;
    activeButton = card.querySelector('.btn-view-event-details');
    navIndex = index;

    moveIntoDialog(card);
    setCloseLabel(activeButton);
    panel.scrollTop = 0;

    if (slideMotion) {
      slideMotion.cancel();
      slideMotion = null;
    }

    if (!reducedMotion.matches) {
      slideMotion = content.animate(
        [
          {
            opacity: 0,
            transform: 'translateX(' + (step > 0 ? 32 : -32) + 'px)'
          },
          {
            opacity: 1,
            transform: 'translateX(0)'
          }
        ],
        {
          duration: 320,
          easing: 'cubic-bezier(.16, 1, .3, 1)'
        }
      );

      slideMotion.onfinish = function () {
        slideMotion = null;
      };
    }
  }

  prevButton.addEventListener('click', function () {
    showEvent(-1);
  });

  nextButton.addEventListener('click', function () {
    showEvent(1);
  });

  /* ---------- Keyboard arrows ---------- */

  dialog.addEventListener('keydown', function (event) {
    if (event.target.closest('input, textarea, select')) return;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showEvent(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showEvent(1);
    }
  });

  /* ---------- Touch swipe ---------- */

  let touchStartX = 0;
  let touchStartY = 0;
  let touchTracking = false;

  dialog.addEventListener('touchstart', function (event) {
    if (event.touches.length !== 1) {
      touchTracking = false;
      return;
    }

    touchTracking = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true });

  dialog.addEventListener('touchend', function (event) {
    if (!touchTracking) return;

    touchTracking = false;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    // Horizontal swipe only; vertical drags keep scrolling the popup.
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showEvent(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* ---------- Close expanded event ---------- */

  function closeDetails() {
    if (!activeCard || closing) return;

    closing = true;

    const current = getComputedStyle(panel);

    const from = {
      opacity: current.opacity,
      transform: current.transform
    };

    if (motion) {
      motion.cancel();
    }

    if (reducedMotion.matches) {
      dialog.close();
      return;
    }

    dialog.classList.add('is-closing');

    dialog.querySelectorAll('.event-focus-nav').forEach(function (nav) {
      nav.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: 180, easing: 'ease', fill: 'forwards' }
      );
    });

    motion = panel.animate(
      [
        from,
        {
          opacity: 0,
          transform: 'translateY(10px) scale(.97)'
        }
      ],
      {
        duration: 180,
        easing: 'cubic-bezier(.4, 0, 1, 1)',
        fill: 'forwards'
      }
    );

    motion.onfinish = function () {
      dialog.close();
    };
  }

  /* ---------- Close button and Escape ---------- */

  closeButton.addEventListener('click', closeDetails);

  dialog.addEventListener('cancel', function (event) {
    event.preventDefault();
    closeDetails();
  });

  /* ---------- Close on backdrop click ---------- */

  // The dialog fills the screen, so a click on the dialog itself
  // (not the panel or chevrons) is a click on the backdrop.
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) {
      closeDetails();
    }
  });

  /* ---------- Restore card and keyboard focus ---------- */

  dialog.addEventListener('close', function () {
    if (motion) {
      motion.cancel();
    }

    if (slideMotion) {
      slideMotion.cancel();
    }

    dialog.querySelectorAll('.event-focus-nav').forEach(function (nav) {
      nav.getAnimations().forEach(function (animation) {
        animation.cancel();
      });
    });

    closeCardDropdowns(activeCard);

    const returnFocus = activeButton;

    restoreLabel(activeButton);
    returnToPage();

    document.body.style.overflow = previousOverflow;
    dialog.classList.remove('is-closing', 'is-single');

    activeCard = null;
    activeButton = null;
    motion = null;
    slideMotion = null;
    closing = false;
    navCards = [];
    navIndex = 0;

    if (returnFocus) {
      returnFocus.focus({ preventScroll: true });
    }
  });
});
