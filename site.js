/* The network: every project, the four stages they share, and the tools between them.
   Scrolling the essay lights up one stage at a time; after that it is yours to pull on. */
(() => {
  'use strict';

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (id) => document.getElementById(id);
  const canvas = $('net'), ctx = canvas.getContext('2d');
  const tip = $('tip'), panel = $('panel'), stateLabel = $('netState');

  const STAGES = {
    collect: ['Collect', 'Take a feed in without losing or inventing anything.'],
    validate: ['Validate', 'Decide what counts as valid before anything downstream sees it.'],
    store: ['Store', 'Keep the raw record intact and the database out of reach.'],
    explain: ['Explain', 'Show the reader how far to trust the result.'],
  };

  const PROJECTS = {
    newsmind: {
      name: 'NewsMind', kind: '2026, personal project, live',
      text: 'Pulls the financial news wire, scores every headline with FinBERT, has Claude work out which companies a story is likely to move, then checks each call against the stock price afterwards. Next upgrade: move storage from SQLite snapshots to hosted Postgres on Supabase, so the site can query live data.',
      facts: [['277', 'stories read in the first snapshot'], ['8', 'SQLite tables, idempotent loads'], ['13', 'unit tests on every push'], ['6-hourly', 'refresh on GitHub Actions']],
      stages: ['collect', 'validate', 'store', 'explain'],
      tools: ['Python', 'SQLite', 'FinBERT', 'Claude API', 'GitHub Actions', 'JavaScript'],
      actions: [['Open the live site', 'https://noobmaster69zz.github.io/newsmind/'], ['Read the code', 'https://github.com/noobmaster69zz/newsmind']],
    },
    safety: {
      name: 'Safety Monitor', kind: '2026, EG2A17, team of 4',
      text: 'A wearable sensor-to-dashboard pipeline that detects falls, slips and near misses on construction sites in real time. I owned everything downstream of the sensor: the database, the retrieval layer and the dashboard.',
      facts: [['100 Hz', 'sensor stream'], ['3', 'tables, raw data never overwritten'], ['100x', 'fewer database round-trips'], ['0.18 vs 350', 'the threshold that could never fire']],
      stages: ['collect', 'store', 'explain'],
      tools: ['Python', 'MariaDB', 'SQLite', 'Streamlit'],
      actions: [['Read the case study', 'p1-safety-monitor.html']],
    },
    aws: {
      name: 'AWS Application', kind: '2026, EG2A16, solo',
      text: 'A secure three-tier e-commerce application on AWS, delivered inside a $50 budget and then optimised against all six Well-Architected pillars. I designed and provisioned the whole stack.',
      facts: [['$50', 'total budget'], ['4 subnets', 'across 2 availability zones'], ['Private', 'database, never internet-addressable'], ['S3', 'for images, kept out of the database']],
      stages: ['store'],
      tools: ['AWS', 'MySQL', 'Flask', 'Python'],
      actions: [['Read the case study', 'p2-cloud-application.html']],
    },
    churn: {
      name: 'Sentiment and Churn', kind: '2026, personal project',
      text: 'A three-stage pipeline that cleans messy customer reviews, scores them with a language model, flags customers who sound like they are leaving, and serves it as a dashboard a non-analyst can read unaided.',
      facts: [['500', 'raw reviews from 4 channels'], ['434', 'usable after cleaning'], ['17', 'churn phrases, every flag traceable'], ['Teal to rust', 'palette that survives colour blindness']],
      stages: ['collect', 'validate', 'store', 'explain'],
      tools: ['Python', 'pandas', 'DistilBERT', 'SQLite', 'Streamlit'],
      actions: [['Read the case study', 'p3-sentiment-churn.html'], ['Read the code', 'https://github.com/noobmaster69zz/ecommerce-sentiment-churn-pipeline']],
    },
    imports: {
      name: 'Import Resilience', kind: 'EG2A12, team of 4',
      text: 'A multi-page Power BI report on how exposed Singapore is when a few partners supply most of a commodity. I owned the Energy and Resilience page: thirteen visuals covering partner shares, supplier concentration, CPI linkage and dated supply shocks.',
      facts: [['13', 'visuals on my page'], ['HHI', 'to measure supplier concentration']],
      stages: ['explain'],
      tools: ['Power BI'],
      actions: [],
    },
    hdb: {
      name: 'HDB Resale', kind: 'Personal project',
      text: 'Models roughly 200,000 Singapore public housing transactions. The audited cleaning stage catches a remaining-lease column stored in two formats, which parses silently to zero under a naive regex. Scored on a chronological split, so it is tested on genuinely unseen future sales.',
      facts: [['~200,000', 'transactions'], ['Chronological', 'split, no peeking at the future']],
      stages: ['validate', 'explain'],
      tools: ['Python', 'pandas', 'scikit-learn'],
      actions: [],
    },
  };

  /* ---------- Build nodes and links ---------- */
  const nodes = [], links = [], byId = new Map();
  const add = (id, type, name, extra) => {
    const n = { id, type, name, x: 0, y: 0, vx: 0, vy: 0, near: new Set(), ...extra };
    nodes.push(n);
    byId.set(id, n);
    return n;
  };
  const join = (a, b) => { links.push([byId.get(a), byId.get(b)]); byId.get(a).near.add(b); byId.get(b).near.add(a); };

  for (const [id, [name, text]] of Object.entries(STAGES)) add(id, 'stage', name, { text });
  for (const [id, p] of Object.entries(PROJECTS)) add(id, 'project', p.name, p);
  for (const [id, p] of Object.entries(PROJECTS)) {
    p.stages.forEach((s) => join(id, s));
    for (const t of p.tools) {
      if (!byId.has(t)) add(t, 'tool', t, {});
      join(id, t);
    }
  }

  let W = 0, H = 0, dpr = 1, raf = 0, heat = 1;
  let stage = 'all', picked = null, hover = null, drag = null;

  function seedPositions() {
    const order = { stage: 0.2, project: 0.52, tool: 0.86 };
    const groups = { stage: [], project: [], tool: [] };
    nodes.forEach((n) => groups[n.type].push(n));
    for (const [type, list] of Object.entries(groups)) {
      list.forEach((n, i) => {
        const a = (i / list.length) * Math.PI * 2 + (type === 'project' ? 0.5 : 0);
        n.x = W / 2 + Math.cos(a) * Math.min(W, H) * 0.46 * order[type];
        n.y = H / 2 + Math.sin(a) * Math.min(W, H) * 0.46 * order[type];
      });
    }
  }

  function size() {
    const first = !W;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ow = W, oh = H;
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (first) seedPositions();
    else nodes.forEach((n) => { n.x *= W / ow; n.y *= H / oh; });
    wake(0.6);
  }

  /* ---------- Layout: springs along links, everything else pushes apart ---------- */
  function step() {
    const k = Math.min(W, H);
    const rest = k * 0.17, push = k * k * 0.0105;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy + 40, d = Math.sqrt(d2), f = push / d2;
        dx /= d; dy /= d;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
      // With the panel open, the network settles into the space beside it.
      const mid = picked && W > 700 ? (W - 390) / 2 : W / 2;
      a.vx += (mid - a.x) * 0.0022 * (W > H ? H / W : 1);
      a.vy += (H / 2 - a.y) * 0.0022 * (H > W ? W / H : 1);
    }
    for (const [a, b] of links) {
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - rest) * 0.012;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      if (n === drag) { n.vx = n.vy = 0; continue; }
      n.vx *= 0.82; n.vy *= 0.82;
      n.x = Math.min((picked && W > 700 ? W - 390 : W) - 46, Math.max(46, n.x + n.vx * heat));
      n.y = Math.min(H - 26, Math.max(44, n.y + n.vy * heat));
    }
  }

  const lit = (n) => {
    const focus = picked || (stage !== 'all' ? byId.get(stage) : null);
    return !focus || n === focus || focus.near.has(n.id);
  };

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const focus = picked || (stage !== 'all' ? byId.get(stage) : null);

    for (const [a, b] of links) {
      const on = focus && (a === focus || b === focus);
      ctx.strokeStyle = on ? '#F0442C' : `rgba(10,10,10,${focus ? 0.07 : 0.2})`;
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.textBaseline = 'middle';
    for (const n of nodes) {
      const on = lit(n), hot = n === hover || n === picked;
      ctx.globalAlpha = on ? 1 : 0.2;
      if (n.type === 'project') {
        const s = hot ? 15 : 12;
        ctx.fillStyle = n === picked ? '#F0442C' : '#0A0A0A';
        ctx.fillRect(n.x - s / 2, n.y - s / 2, s, s);
        ctx.fillStyle = '#0A0A0A';
        ctx.font = '800 14px Archivo, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(n.name.toUpperCase(), n.x + 13, n.y + 1);
      } else if (n.type === 'stage') {
        ctx.fillStyle = n === picked || n.id === stage ? '#F0442C' : '#F4F3EE';
        ctx.strokeStyle = '#0A0A0A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, hot ? 27 : 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#0A0A0A';
        ctx.font = '500 10px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.name.toUpperCase(), n.x, n.y + 1);
      } else {
        ctx.fillStyle = hot ? '#F0442C' : '#0A0A0A';
        ctx.beginPath();
        ctx.arc(n.x, n.y, hot ? 5 : 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5E5E58';
        ctx.font = '400 11px "IBM Plex Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(n.name, n.x + 8, n.y + 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame() {
    step();
    draw();
    heat *= 0.985;
    raf = heat > 0.02 || drag ? requestAnimationFrame(frame) : 0;
  }

  function wake(amount) {
    heat = Math.max(heat, amount);
    if (reduced.matches) { for (let i = 0; i < 260; i++) step(); heat = 0; draw(); return; }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  /* ---------- Pointer: hover preview, select, drag ---------- */
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  function nodeAt(x, y) {
    let best = null, bestD = Infinity;
    for (const n of nodes) {
      const reach = n.type === 'stage' ? 28 : 16;
      const inLabel = n.type !== 'stage' && x > n.x && x < n.x + 16 + n.name.length * 8.6 && Math.abs(y - n.y) < 11;
      const d = Math.hypot(n.x - x, n.y - y);
      if ((d < reach || inLabel) && d < bestD) { best = n; bestD = d; }
    }
    return best;
  }

  const preview = (n) => (n.type === 'project' ? n.text.split('. ')[0] + '.'
    : n.type === 'stage' ? n.text
    : `Used in ${[...n.near].map((id) => byId.get(id).name).join(', ')}.`);

  function showTip(n) {
    const kind = document.createElement('span');
    kind.className = 'stamp';
    kind.textContent = n.type === 'project' ? n.kind : n.type === 'stage' ? 'Stage' : 'Tool';
    tip.replaceChildren(kind, document.createTextNode(preview(n)));
    tip.hidden = false;
    tip.style.left = `${Math.min(W - 130, Math.max(130, n.x))}px`;
    tip.style.top = `${Math.max(90, n.y)}px`;
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = at(e);
    downAt = [x, y];
    drag = nodeAt(x, y);
    if (drag) { canvas.setPointerCapture(e.pointerId); canvas.classList.add('grabbing'); wake(0.5); }
  });

  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = at(e);
    if (drag) {
      drag.x = Math.min(W - 30, Math.max(30, x));
      drag.y = Math.min(H - 20, Math.max(40, y));
      tip.hidden = true;
      wake(0.5);
      return;
    }
    const n = nodeAt(x, y);
    if (n !== hover) {
      hover = n;
      canvas.classList.toggle('pointing', Boolean(n));
      if (n) showTip(n); else tip.hidden = true;
      if (!raf) draw();
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    const [x, y] = at(e);
    const moved = downAt && Math.hypot(x - downAt[0], y - downAt[1]) > 5;
    const hit = drag;
    drag = null;
    canvas.classList.remove('grabbing');
    if (!moved) pick(hit);
  });

  canvas.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; if (!raf) draw(); });

  /* ---------- Side panel ---------- */
  function pick(n) {
    picked = n || null;
    tip.hidden = true;
    if (!n) { panel.hidden = true; label(); if (!raf) draw(); return; }
    $('panelKind').textContent = n.type === 'project' ? n.kind : n.type === 'stage' ? 'Stage of every pipeline' : 'Tool';
    $('panelName').textContent = n.name;
    $('panelText').textContent = n.type === 'tool'
      ? `${n.name} appears in ${n.near.size} ${n.near.size === 1 ? 'project' : 'projects'} here.` : n.text;

    const facts = $('panelFacts');
    facts.replaceChildren();
    for (const [value, what] of n.facts || []) {
      const li = document.createElement('li');
      const strong = document.createElement('strong');
      strong.textContent = value;
      li.append(strong, ` ${what}`);
      facts.append(li);
    }

    const linksBox = $('panelLinks');
    linksBox.replaceChildren();
    for (const id of n.near) {
      const other = byId.get(id);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = other.name;
      b.addEventListener('click', () => pick(other));
      linksBox.append(b);
    }

    const actions = $('panelActions');
    actions.replaceChildren();
    for (const [text, href] of n.actions || []) {
      const a = document.createElement('a');
      a.className = 'btn btn-solid';
      a.href = href;
      a.textContent = text;
      if (href.startsWith('http')) { a.target = '_blank'; a.rel = 'noopener'; }
      actions.append(a);
    }
    panel.hidden = false;
    label();
    wake(0.7);
  }

  function label() {
    stateLabel.textContent = picked ? `Selected: ${picked.name}`
      : stage === 'all' ? 'Showing the whole system' : `Stage: ${STAGES[stage][0]}`;
  }

  $('panelClose').addEventListener('click', () => pick(null));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) pick(null); });
  document.querySelectorAll('[data-node]').forEach((b) => b.addEventListener('click', () => {
    document.getElementById('system').scrollIntoView();
    pick(byId.get(b.dataset.node));
  }));

  /* ---------- The essay drives the network ---------- */
  const chapters = [...document.querySelectorAll('.chapter')];
  const watch = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      chapters.forEach((c) => c.classList.toggle('live', c === entry.target));
      stage = entry.target.dataset.stage;
      if (!picked) { label(); wake(0.2); }
    }
  }, { rootMargin: '-45% 0px -45% 0px' });
  chapters.forEach((c) => watch.observe(c));
  chapters[0].classList.add('live');

  window.addEventListener('resize', size);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!raf) draw(); });
  size();
})();
