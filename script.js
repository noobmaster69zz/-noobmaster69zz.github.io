// ---------- mobile menu ----------
const burger = document.getElementById('burger'), menu = document.getElementById('menu');
if (burger) {
  burger.addEventListener('click', () => {
    const o = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', o);
  });
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => menu.classList.remove('open')));
}

// ---------- expandable nodes ----------
document.querySelectorAll('.node').forEach(n => n.addEventListener('click', () =>
  n.setAttribute('aria-expanded', n.getAttribute('aria-expanded') === 'true' ? 'false' : 'true')));

// ---------- lightbox ----------
const lb = document.getElementById('lb');
if (lb) {
  const lbimg = document.getElementById('lbimg');
  document.querySelectorAll('figure img').forEach(im => im.addEventListener('click', () => {
    lbimg.src = im.src; lbimg.alt = im.alt; lb.classList.add('on');
  }));
  lb.addEventListener('click', () => lb.classList.remove('on'));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('on'); });
}

// ---------- schema explorer (project 01) ----------
const SCHEMA = [
  { c: ["id", "device_name", "timestamp", "acc_x, acc_y, acc_z", "gyr_x, gyr_y, gyr_z"],
    p: "Every sample exactly as it arrived, written in batches of 100 rather than one transaction per reading. Nothing downstream ever modifies this table, so any recorded session can be replayed through new detection thresholds without collecting a single new sample." },
  { c: ["id", "device_name", "timestamp", "acc_mag", "gyr_mag", "acc_mag_smooth"],
    p: "Derived values, kept separate from the raw record. Magnitudes collapse three axes into one number so the logic responds to movement regardless of how the device is oriented, and a smoothed magnitude reduces noise without discarding the original." },
  { c: ["id", "device_name", "timestamp", "event_type", "severity", "peak_g", "acknowledged"],
    p: "The interpreted layer — FALL, STF or NEAR_MISS with severity and peak value. This is what the dashboard reads first, and the acknowledged flag is what lets an alert be cleared without deleting the record of it happening." }
];
const sigd = document.getElementById('sigd');
if (sigd) {
  const show = i => {
    const s = SCHEMA[i];
    sigd.innerHTML = '<div class="cols">' + s.c.map(c => '· ' + c).join('<br>') + '</div><p>' + s.p + '</p>';
    document.querySelectorAll('.tbl').forEach(b => b.setAttribute('aria-selected', b.dataset.i == i));
  };
  document.querySelectorAll('.tbl').forEach(b => b.addEventListener('click', () => show(+b.dataset.i)));
  show(0);
}

// ---------- churn rule demo (project 03) ----------
const PHRASES = ["cancel", "refund", "switching", "switch to", "never again", "money back", "worst",
  "disappointed", "not worth", "stop buying", "last time", "competitor", "unacceptable",
  "broken again", "waste of money", "take my business", "poor quality"];
const ta = document.getElementById('review');
if (ta) {
  const out = document.getElementById('readout'),
        verdict = document.getElementById('verdict'),
        trig = document.getElementById('triggers');
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const scan = () => {
    const text = ta.value, lower = text.toLowerCase(), hits = [], spans = [];
    PHRASES.forEach(p => {
      let i = lower.indexOf(p);
      while (i !== -1) { spans.push([i, i + p.length]); if (!hits.includes(p)) hits.push(p); i = lower.indexOf(p, i + p.length); }
    });
    spans.sort((a, b) => a[0] - b[0]);
    const m = [];
    spans.forEach(s => { const l = m[m.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else m.push([...s]); });
    let html = '', cur = 0;
    m.forEach(([a, b]) => { html += esc(text.slice(cur, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>'; cur = b; });
    html += esc(text.slice(cur));
    out.innerHTML = html || '<span style="color:#6E545A">Start typing…</span>';
    const risk = hits.length > 0;
    verdict.className = 'verdict ' + (risk ? 'risk' : 'safe');
    verdict.textContent = risk ? 'At risk of leaving' : 'Retained';
    trig.innerHTML = hits.map(h => '<span>' + esc(h) + '</span>').join('');
  };
  ta.addEventListener('input', scan);
  document.querySelectorAll('.samples button').forEach(b =>
    b.addEventListener('click', () => { ta.value = b.dataset.t; scan(); }));
  scan();
}

// ---------- reveal, counters, active nav ----------
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduce && 'IntersectionObserver' in window) {
  const rv = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); }
  }), { threshold: .06 });
  document.querySelectorAll('.rv').forEach(el => rv.observe(el));

  const done = new WeakSet();
  const cv = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting || done.has(e.target)) return;
    done.add(e.target);
    const t = +e.target.dataset.count;
    let n = 0; const step = Math.max(1, Math.round(t / 30));
    const id = setInterval(() => { n += step; if (n >= t) { n = t; clearInterval(id); } e.target.textContent = n; }, 26);
  }), { threshold: .5 });
  document.querySelectorAll('[data-count]').forEach(el => cv.observe(el));

  const links = [...document.querySelectorAll('nav a.nl[href^="#"], nav a.nl[href*="index.html#"]')];
  const nv = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(l => l.classList.toggle('on', l.getAttribute('href').endsWith('#' + e.target.id)));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('section[id]').forEach(s => nv.observe(s));
} else {
  document.querySelectorAll('.rv').forEach(el => el.classList.add('in'));
}
