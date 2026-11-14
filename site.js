(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Project deck: one project per slide ----------
     The deck is a native horizontal scroller with snap points, so swiping and
     trackpads work without any script. The script adds tabs, arrows and keys. */
  const deck = document.getElementById('deck');
  const slides = [...deck.querySelectorAll('.slide')];
  const tabs = [...document.querySelectorAll('#tabs [role="tab"]')];
  const prev = document.getElementById('prev'), next = document.getElementById('next');
  const count = document.getElementById('count');
  let current = 0;

  function show(i) {
    current = i;
    tabs.forEach((tab, n) => {
      tab.setAttribute('aria-selected', String(n === i));
      tab.tabIndex = n === i ? 0 : -1;
    });
    // Keep the current tab in view without moving the page itself.
    const strip = tabs[i].parentElement;
    strip.scrollTo({ left: tabs[i].offsetLeft - strip.offsetLeft - 24, behavior: reduced.matches ? 'auto' : 'smooth' });
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
    count.textContent = `${i + 1} of ${slides.length}`;
  }

  function go(i) {
    i = Math.min(slides.length - 1, Math.max(0, i));
    deck.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduced.matches ? 'auto' : 'smooth' });
  }

  // Whichever slide is mostly in view is the current one, however the visitor got there.
  let ticking = false;
  deck.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const x = deck.scrollLeft + slides[0].offsetLeft;
      let best = 0;
      slides.forEach((slide, n) => {
        if (Math.abs(slide.offsetLeft - x) < Math.abs(slides[best].offsetLeft - x)) best = n;
      });
      if (best !== current) show(best);
    });
  }, { passive: true });

  prev.addEventListener('click', () => go(current - 1));
  next.addEventListener('click', () => go(current + 1));
  tabs.forEach((tab, i) => tab.addEventListener('click', () => go(i)));
  const onKeys = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1); }
  };
  deck.addEventListener('keydown', onKeys);
  document.getElementById('tabs').addEventListener('keydown', (e) => {
    onKeys(e);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setTimeout(() => tabs[current].focus({ preventScroll: true }), 0);
  });
  show(0);

  /* ---------- Hero point field ----------
     Loose points gathered into clusters, one per featured project. It tilts with the pointer. */
  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d');
  const TINTS = ['21,23,28', '122,22,50', '11,114,133'];
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let pts = [], W = 0, H = 0, raf = 0, last = 0, spin = 0;

  // Seeded so the field has the same shape on every visit.
  let seed = 20261114;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

  function build() {
    const centres = [[0.55, -0.35, 0.2], [-0.5, 0.3, 0.45], [0.2, 0.5, -0.55], [-0.35, -0.45, -0.4]];
    centres.forEach((c, i) => {
      for (let n = 0; n < 240; n++) {
        pts.push({ x: c[0] + gauss() * 0.17, y: c[1] + gauss() * 0.17, z: c[2] + gauss() * 0.17,
          tint: TINTS[rnd() < 0.4 ? 0 : 1 + (i % 2)], r: 0.9 + rnd() * 1.2 });
      }
    });
    for (let n = 0; n < 380; n++) {
      const y = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y), d = 0.95 + rnd() * 0.25;
      pts.push({ x: Math.cos(a) * rr * d, y: y * d, z: Math.sin(a) * rr * d, tint: TINTS[0], r: 0.6 + rnd() * 0.7 });
    }
  }

  function size() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const yaw = spin + mouse.sx * 0.5, pitch = -0.2 + mouse.sy * 0.3;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // Sit the field to the right, behind the portrait, so the headline stays clear.
    const S = Math.min(W, H) * 0.52, ox = W * (W > 760 ? 0.7 : 0.5), oy = H * 0.46, D = 3.2;
    for (const p of pts) {
      const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
      const y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
      const k = D / (D + z2);
      ctx.globalAlpha = Math.min(0.55, Math.max(0.06, 0.12 + (k - 0.76) * 0.7));
      ctx.fillStyle = `rgb(${p.tint})`;
      const r = p.r * k;
      ctx.fillRect(ox + x1 * S * k, oy + y2 * S * k, r, r);
    }
    ctx.globalAlpha = 1;
  }

  // Time-based, so it turns at the same speed on any screen.
  function frame(now) {
    const dt = Math.min(100, now - last);
    last = now;
    spin += dt * 0.00004;
    const ease = 1 - Math.exp(-dt / 220);
    mouse.sx += (mouse.x - mouse.sx) * ease;
    mouse.sy += (mouse.y - mouse.sy) * ease;
    draw();
    raf = requestAnimationFrame(frame);
  }

  function sync() {
    const run = !reduced.matches && !document.hidden;
    if (run && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!run && raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);

  build();
  size();
  sync();
})();
