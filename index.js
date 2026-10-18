(() => {
  const nav = document.getElementById('navBar');
  const list = document.getElementById('navList');
  const toggle = document.getElementById('hamburgerBtn');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Native anchors share this measured offset, including direct URLs and history.
  if (nav) {
    const measureNav = () => {
      document.documentElement.style.setProperty('--nav-height', `${nav.getBoundingClientRect().height}px`);
    };
    measureNav();
    if ('ResizeObserver' in window) new ResizeObserver(measureNav).observe(nav);
    window.addEventListener('resize', measureNav);
    const alignInitialHash = () => {
      measureNav();
      let id;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'instant' });
    };
    // Correct the initial anchor jump after fonts and media settle.
    window.addEventListener('load', () => {
      if (document.fonts) document.fonts.ready.then(alignInitialHash);
      else alignInitialHash();
    }, { once: true });
  }

  // Detail pages intentionally have only a Return link.
  if (nav && list && toggle) {
    const mobile = window.matchMedia('(max-width: 767px)');
    const links = [...list.querySelectorAll('.nav__list-link')];
    let open = false;
    toggle.hidden = false;
    nav.classList.add('nav--enhanced');

    const setOpen = (value, restoreFocus = false) => {
      open = value && mobile.matches;
      list.classList.toggle('nav--active', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      list.inert = mobile.matches && !open;
      if (restoreFocus) toggle.focus();
    };
    setOpen(false);
    toggle.addEventListener('click', () => setOpen(!open));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && open) setOpen(false, true);
    });
    document.addEventListener('click', event => {
      if (open && !nav.contains(event.target)) setOpen(false);
    });
    nav.addEventListener('focusout', event => {
      if (open && event.relatedTarget && !nav.contains(event.relatedTarget)) setOpen(false);
    });
    links.forEach(link => link.addEventListener('click', () => setOpen(false)));
    mobile.addEventListener('change', () => {
      const focusWasInMenu = list.contains(document.activeElement);
      const focusWasOnToggle = document.activeElement === toggle;
      setOpen(false, mobile.matches && focusWasInMenu);
      if (!mobile.matches && focusWasOnToggle) links[0]?.focus();
    });

    const sections = links.map(link => document.getElementById(link.hash.slice(1))).filter(Boolean);
    const updateActiveLink = () => {
      const edge = nav.getBoundingClientRect().height + 18;
      let current = sections[0];
      sections.forEach(section => {
        if (section.getBoundingClientRect().top <= edge) current = section;
      });
      const scrollRoot = document.scrollingElement || document.documentElement;
      const maxScroll = scrollRoot.scrollHeight - scrollRoot.clientHeight;
      // The last section may be too short to reach the navbar's position threshold.
      if (maxScroll > 0 && scrollRoot.scrollTop > 0 && scrollRoot.scrollTop >= maxScroll - 1) {
        current = sections[sections.length - 1];
      }
      links.forEach(link => {
        const active = link.hash === `#${current?.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    let scheduled = false;
    window.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        updateActiveLink();
        scheduled = false;
      });
    }, { passive: true });
    window.addEventListener('resize', updateActiveLink);
    updateActiveLink();
  }

  document.querySelectorAll('video').forEach(video => {
    const source = video.querySelector('source[src]');
    if (!source) return;
    const fallback = document.createElement('span');
    fallback.className = 'video__fallback';
    fallback.hidden = true;
    fallback.setAttribute('role', 'status');
    fallback.append('Video unavailable. ');
    const link = document.createElement('a');
    link.href = source.src;
    link.textContent = 'Open video';
    fallback.append(link);
    video.after(fallback);
    // Source errors do not bubble, so listen during capture as well.
    video.addEventListener('error', () => {
      video.pause();
      fallback.hidden = false;
    }, true);
    video.addEventListener('loadeddata', () => { fallback.hidden = true; });
  });

  const previews = [...document.querySelectorAll('.work__img-box video')];
  const visiblePreviews = new Set();
  const attemptedPreviews = new WeakSet();
  const syncPreviews = () => {
    previews.forEach(video => {
      const visible = visiblePreviews.has(video) && !video.closest('[hidden]') && !document.hidden;
      if (!visible || reducedMotion.matches) {
        video.pause();
        attemptedPreviews.delete(video);
        return;
      }
      // Do not repeatedly retry blocked autoplay.
      if (!attemptedPreviews.has(video)) {
        attemptedPreviews.add(video);
        video.play()?.catch(() => { /* The poster remains visible if autoplay is blocked. */ });
      }
    });
  };
  previews.forEach(video => {
    video.controls = false;
    if (reducedMotion.matches) video.pause();
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) visiblePreviews.add(target);
        else visiblePreviews.delete(target);
      });
      syncPreviews();
    }, { threshold: 0.15 });
    previews.forEach(video => observer.observe(video));
  }
  reducedMotion.addEventListener('change', syncPreviews);
  document.addEventListener('visibilitychange', syncPreviews);

  const tabs = [...document.querySelectorAll('.project-tab')];
  const selectTab = selected => {
    tabs.forEach(tab => {
      const active = tab === selected;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) {
        panel.hidden = !active;
        panel.classList.toggle('active', active);
      }
    });
    syncPreviews();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        selectTab(next);
        next.focus();
      }
    });
  });

  document.querySelectorAll('.service-card__box').forEach(service => {
    const background = service.querySelector('.service-card__bg');
    if (!background) return;
    service.addEventListener('pointermove', event => {
      const bounds = service.getBoundingClientRect();
      background.style.left = `${event.clientX - bounds.left}px`;
      background.style.top = `${event.clientY - bounds.top}px`;
    });
  });
})();
