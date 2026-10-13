(() => {
  const links = [...document.querySelectorAll('.bubble-link')];
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function colorOf(el) {
    return getComputedStyle(el).backgroundColor || '#eeeaff';
  }

  function maxScaleFor(rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const corners = [
      [0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]
    ];
    const farthest = Math.max(...corners.map(([x, y]) => Math.hypot(x - cx, y - cy)));
    return (farthest * 2.25) / Math.max(rect.width, rect.height);
  }

  function repelOthers(source, sourceRect) {
    const sx = sourceRect.left + sourceRect.width / 2;
    const sy = sourceRect.top + sourceRect.height / 2;
    document.querySelectorAll('.bubble').forEach((bubble) => {
      if (bubble === source) return;
      const r = bubble.getBoundingClientRect();
      const bx = r.left + r.width / 2;
      const by = r.top + r.height / 2;
      let dx = bx - sx;
      let dy = by - sy;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      const distance = Math.max(innerWidth, innerHeight) * 0.78;
      bubble.animate([
        { transform: getComputedStyle(bubble).transform === 'none' ? 'translate(0,0)' : getComputedStyle(bubble).transform, opacity: 1 },
        { transform: `translate(${dx * distance}px, ${dy * distance}px) scale(.72)`, opacity: 0 }
      ], { duration: 620, easing: 'cubic-bezier(.55,.02,.44,.98)', fill: 'forwards' });
    });
  }

  function transitionTo(link, event) {
    const url = link.href;
    if (!url || link.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (prefersReduced) return;

    event.preventDefault();
    if (document.body.classList.contains('is-transitioning')) return;
    document.body.classList.add('is-transitioning');

    const rect = link.getBoundingClientRect();
    const clone = document.createElement('div');
    clone.className = 'transition-bubble';
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.background = colorOf(link);
    clone.innerHTML = `<span>${link.textContent.trim()}</span>`;
    document.body.appendChild(clone);

    repelOthers(link, rect);
    link.style.opacity = '0';

    const scale = maxScaleFor(rect);
    try { sessionStorage.setItem('bubbleTransitionColor', colorOf(link)); } catch (_) {}
    clone.animate([
      { transform: 'scale(1)' },
      { transform: `scale(${scale})` }
    ], {
      duration: 680,
      easing: 'cubic-bezier(.7,0,.22,1)',
      fill: 'forwards'
    });

    setTimeout(() => { window.location.href = url; }, 610);
  }

  links.forEach((link) => link.addEventListener('click', (event) => transitionTo(link, event)));

  // Continue the color takeover briefly on the destination page so the transition
  // does not flash straight from a full-screen bubble to white.
  try {
    const entryColor = sessionStorage.getItem('bubbleTransitionColor');
    if (entryColor) {
      sessionStorage.removeItem('bubbleTransitionColor');
      const wash = document.createElement('div');
      wash.className = 'page-entry-wash';
      wash.style.background = entryColor;
      document.body.appendChild(wash);
      wash.animate([
        { opacity: 1 },
        { opacity: 0 }
      ], { duration: prefersReduced ? 1 : 430, easing: 'ease-out', fill: 'forwards' });
      setTimeout(() => wash.remove(), prefersReduced ? 5 : 450);
    }
  } catch (_) {}

  // Give section pages a soft entrance after the previous bubble has filled the viewport.
  if (document.body.classList.contains('section-page')) {
    document.querySelector('.scroll-content')?.animate([
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: prefersReduced ? 1 : 520, easing: 'ease-out', fill: 'both' });
  }
})();

// TWINKLING STARS
// Soft pastel stars. Edit star_colors to change the palette, number_of_stars for the amount.
(() => {
  const star_field = document.createElement('div');
  star_field.className = 'star-field';
  star_field.setAttribute('aria-hidden', 'true');

  const star_colors = ['#669bd5', '#a98fe8', '#ef9cc4', '#7cc9b5', '#f0bf6e'];
  const number_of_stars = window.innerWidth < 600 ? 40 : 75;

  for (let star_number = 0; star_number < number_of_stars; star_number++) {
    const star = document.createElement('span');
    const is_sparkle = star_number % 4 === 0;
    const star_size = is_sparkle ? 8 + Math.random() * 6 : 2 + Math.random() * 2;

    star.className = is_sparkle ? 'twinkle-star sparkle' : 'twinkle-star';
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 100}%`;
    star.style.width = `${star_size}px`;
    star.style.height = `${star_size}px`;
    star.style.background = star_colors[Math.floor(Math.random() * star_colors.length)];
    star.style.animationDuration = `${3.5 + Math.random() * 4}s`;
    star.style.animationDelay = `${-Math.random() * 8}s`;
    star_field.appendChild(star);
  }

  document.body.prepend(star_field);
})();

// FLOATING BUBBLES: gentle drift, and bubbles glide toward the cursor when it gets close
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // drift = how far (px) each bubble wanders, pull = how far it can slide toward the cursor,
  // radius = how close the cursor must be for the pull to start.
  const configs = [
    { selector: '.bubble-home .home-nav',  drift: [30, 34], pull: 70, radius: 260 },
    { selector: '.bubble-home .name-bubble', drift: [10, 12], pull: 0, radius: 1 },
    { selector: '.side-bubble',            drift: [2, 3],   pull: 14, radius: 120 },
    { selector: '.enter-bubble',           drift: [20, 24], pull: 60, radius: 240 }
  ];

  // Toggle box: "stop icons from floating?"
  let still = false;
  try { still = localStorage.getItem('stillBubbles') === '1'; } catch (_) {}
  if (document.querySelector('.bubble-link, .name-bubble')) {
    const box = document.createElement('button');
    box.type = 'button';
    box.className = 'float-toggle';
    box.setAttribute('role', 'switch');
    box.innerHTML = '<span>stop icons from floating?</span><span class="track" aria-hidden="true"></span>';
    const sync = () => box.setAttribute('aria-checked', String(still));
    sync();
    box.addEventListener('click', () => { still = !still; sync(); try { localStorage.setItem('stillBubbles', still ? '1' : '0'); } catch (_) {} });
    document.body.appendChild(box);
  }
  if (reduced) return;

  const pointer = { x: -9999, y: -9999 };
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });
  const away = () => { pointer.x = -9999; pointer.y = -9999; };
  document.documentElement.addEventListener('pointerleave', away);
  window.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') away(); });

  const items = [];
  configs.forEach((cfg) => {
    document.querySelectorAll(cfg.selector).forEach((el) => {
      items.push({ el, cfg, x: 0, y: 0, vx: 0, vy: 0,
        phaseX: Math.random() * 6.28, phaseY: Math.random() * 6.28,
        speedX: 0.35 + Math.random() * 0.25, speedY: 0.3 + Math.random() * 0.25 });
    });
  });
  if (!items.length) return;

  function frame(now) {
    const t = now / 1000;
    for (const it of items) {
      const r = it.el.getBoundingClientRect();
      const baseLeft = r.left - it.x, baseTop = r.top - it.y;
      const cx = baseLeft + r.width / 2, cy = baseTop + r.height / 2;
      let tx = 0, ty = 0;

      if (!still) {
        tx = Math.sin(t * it.speedX + it.phaseX) * it.cfg.drift[0];
        ty = Math.cos(t * it.speedY + it.phaseY) * it.cfg.drift[1];
        // Drift toward the cursor, stopping once it is over the bubble so it stays easy to click
        const dx = pointer.x - (cx + it.x), dy = pointer.y - (cy + it.y);
        const dist = Math.hypot(dx, dy) || 1;
        if (it.cfg.pull && dist < it.cfg.radius && dist > r.width * 0.3) {
          const strength = (1 - dist / it.cfg.radius) * it.cfg.pull;
          tx += (dx / dist) * strength;
          ty += (dy / dist) * strength;
        }
      }

      tx = Math.min(Math.max(tx, 8 - baseLeft), innerWidth - 8 - (baseLeft + r.width));
      ty = Math.min(Math.max(ty, 8 - baseTop), innerHeight - 8 - (baseTop + r.height));
      it.vx = (it.vx + (tx - it.x) * 0.045) * 0.86;
      it.vy = (it.vy + (ty - it.y) * 0.045) * 0.86;
      it.x += it.vx;
      it.y += it.vy;
      it.el.style.translate = `${it.x.toFixed(2)}px ${it.y.toFixed(2)}px`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// NAME BUBBLE: click to flip to my photo, click again (or wait) to flip back
(() => {
  const bubble = document.getElementById('name-flip');
  if (!bubble) return;
  let timer;
  const set = (on) => {
    bubble.classList.toggle('flipped', on);
    bubble.setAttribute('aria-pressed', String(on));
    clearTimeout(timer);
    if (on) timer = setTimeout(() => set(false), 6000);
  };
  bubble.addEventListener('click', () => set(!bubble.classList.contains('flipped')));
})();

// PROJECT SEARCH: filter project entries by keyword
(() => {
  const input = document.getElementById('proj-search');
  if (!input) return;
  const cards = [...document.querySelectorAll('.project-story')];
  const count = document.getElementById('proj-count');
  const empty = document.getElementById('proj-empty');
  input.addEventListener('input', () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    cards.forEach((c) => {
      const text = c.textContent.toLowerCase();
      const hit = words.every((w) => text.includes(w));
      c.hidden = !hit;
      if (hit) shown++;
    });
    empty.hidden = shown > 0;
    count.textContent = words.length ? `${shown} of ${cards.length} projects match` : '';
  });
})();

// PHOTO LIGHTBOX: click a photo to see it full size with its description
(() => {
  const photos = [...document.querySelectorAll('.round-photo')];
  if (!photos.length) return;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-hidden', 'true');
  box.innerHTML = `
    <div class="lightbox-window">
      <button class="lightbox-close" type="button" aria-label="Close photo">×</button>
      <div class="lightbox-image-wrap">
        <img class="lightbox-image" alt="">
        <p class="lightbox-missing">Photo coming soon</p>
      </div>
      <div class="lightbox-text"><h3></h3><p></p></div>
    </div>`;
  document.body.appendChild(box);

  const img = box.querySelector('.lightbox-image');
  const missing = box.querySelector('.lightbox-missing');
  const title = box.querySelector('h3');
  const desc = box.querySelector('.lightbox-text p');
  let lastFocus = null;

  function open(photo) {
    const match = /url\(['"]?([^'")]+)['"]?\)/.exec(photo.getAttribute('style') || '');
    lastFocus = document.activeElement;
    title.textContent = photo.dataset.title || '';
    desc.textContent = photo.dataset.caption || '';
    img.alt = photo.dataset.title || '';
    img.style.display = 'none';
    missing.style.display = 'none';
    img.onload = () => { img.style.display = 'block'; };
    img.onerror = () => { missing.style.display = 'block'; };
    img.src = match ? match[1] : '';
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
    box.querySelector('.lightbox-close').focus();
  }
  function close() {
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    if (lastFocus) lastFocus.focus();
  }

  photos.forEach((photo) => {
    photo.setAttribute('role', 'button');
    photo.setAttribute('tabindex', '0');
    photo.setAttribute('aria-label', `View photo: ${photo.dataset.title || 'photo'}`);
    photo.addEventListener('click', () => open(photo));
    photo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(photo); }
    });
  });
  box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.lightbox-close')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('open')) close(); });
})();

// NIGHT MODE TOGGLE (remembers the choice)
(() => {
  const root = document.documentElement;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'theme-toggle';

  function apply(mode) {
    if (mode === 'dark') root.dataset.theme = 'dark'; else delete root.dataset.theme;
    button.textContent = mode === 'dark' ? '☀' : '☾';
    button.setAttribute('aria-label', mode === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
  }
  apply(root.dataset.theme === 'dark' ? 'dark' : 'light');

  button.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem('theme', next); } catch (_) {}
  });
  document.body.appendChild(button);
})();

// INTRO PAGE TYPING ANIMATION
(() => {
  if (document.body.dataset.page !== 'intro') return;
  const titleEl = document.getElementById('typed-title');
  const subEl = document.getElementById('typed-sub');
  const enter = document.querySelector('.enter-bubble');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Edit these lines to change what the intro says.
  const title = "Welcome to Roya's site";
  const lines = [
    'Electrical engineering major',
    'Colorado School of Mines, class of 2027',
    'Research in machine learning & space science',
    'NASA JPL · NASA Goddard · ETH Zürich',
    'Building things where physical systems meet data'
  ];

  document.body.classList.add('intro-ready');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  if (reduced) {
    titleEl.textContent = title;
    subEl.textContent = lines[0];
    document.body.classList.add('intro-done');
  } else {
    titleEl.textContent = '';
    subEl.textContent = '';
    (async () => {
      await wait(500);
      for (const ch of title) { titleEl.textContent += ch; await wait(75); }
      document.body.classList.add('intro-done');
      await wait(450);
      let i = 0;
      while (true) {
        const line = lines[i % lines.length];
        for (const ch of line) { subEl.textContent += ch; await wait(42); }
        await wait(1500);
        while (subEl.textContent.length) { subEl.textContent = subEl.textContent.slice(0, -1); await wait(20); }
        await wait(250);
        i++;
      }
    })();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.target.closest('a, button')) enter.click();
  });
})();
