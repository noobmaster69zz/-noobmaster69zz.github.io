/* Hero point field: the same idea as NewsMind's chart. Loose points gather into
   four clusters, one per featured project, and the field tilts with the pointer. */
(() => {
  'use strict';

  const canvas = document.getElementById('field');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const TINTS = ['236,230,220', '6,182,212', '224,82,122'];
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let pts = [], W = 0, H = 0, raf = 0, last = 0, spin = 0;

  // Seeded so the field has the same shape on every visit.
  let seed = 20261114;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

  function build() {
    const centres = [[0.55, -0.35, 0.2], [-0.5, 0.3, 0.45], [0.2, 0.5, -0.55], [-0.35, -0.45, -0.4]];
    pts = [];
    centres.forEach((c, i) => {
      for (let n = 0; n < 260; n++) {
        pts.push({ x: c[0] + gauss() * 0.17, y: c[1] + gauss() * 0.17, z: c[2] + gauss() * 0.17,
          tint: TINTS[rnd() < 0.55 ? 0 : 1 + (i % 2)], r: 0.7 + rnd() * 1.1 });
      }
    });
    for (let n = 0; n < 420; n++) {
      const y = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - y * y), d = 0.95 + rnd() * 0.25;
      pts.push({ x: Math.cos(a) * rr * d, y: y * d, z: Math.sin(a) * rr * d, tint: TINTS[0], r: 0.5 + rnd() * 0.6 });
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
    ctx.globalCompositeOperation = 'lighter';
    for (const p of pts) {
      const x1 = p.x * cy + p.z * sy, z1 = -p.x * sy + p.z * cy;
      const y2 = p.y * cp - z1 * sp, z2 = p.y * sp + z1 * cp;
      const k = D / (D + z2);
      ctx.globalAlpha = Math.min(0.75, Math.max(0.08, 0.18 + (k - 0.76) * 0.9));
      ctx.fillStyle = `rgb(${p.tint})`;
      const r = p.r * k;
      ctx.fillRect(ox + x1 * S * k, oy + y2 * S * k, r, r);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
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
    const lead = document.querySelector('.lead');
    const r = lead.getBoundingClientRect();
    if (e.clientY >= r.top && e.clientY <= r.bottom) {
      lead.style.setProperty('--px', `${e.clientX - r.left}px`);
      lead.style.setProperty('--py', `${e.clientY - r.top}px`);
    }
  }, { passive: true });
  window.addEventListener('resize', size);
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);

  build();
  size();
  sync();
})();
