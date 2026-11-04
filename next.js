/* meetbud.app, next version (draft): live Buds from lib/ (K.Screen), the hero's tap, the steps Bud
 * acts out as they scroll by, and the waitlist form (it sends nothing while BUD_NEXT has no
 * endpoint). */
(function () {
  'use strict';
  const K = window.Bud;
  const U = K.util;
  const CFG = window.BUD_NEXT || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // events for analytics tools that read window.dataLayer (Google Tag Manager and most others)
  const track = (event, data) => { if (CFG.analytics) (window.dataLayer = window.dataLayer || []).push(Object.assign({ event, variant: 'companion' }, data || {})); };
  window.budTrack = track;
  document.addEventListener('click', (e) => { const t = e.target.closest && e.target.closest('[data-track]'); if (t) track(t.dataset.track); });
  const TEAL = '#79F7E6';
  const tintOf = (st) => (st === 'idle' || st === 'hello' || st === 'sleeping' ? TEAL : K.TINTS[st] || TEAL);

  /* ------------------------------------------------------------- live Buds */
  const buds = [];
  const BASE = { character: 'eyes', base: 'eyes', pack: 'lantern', theme: 'classic', acc: {}, ambient: null, state: 'idle',
    oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: !REDUCED };
  function mount(el, cfg, opts) {
    opts = opts || {};
    const scr = new K.Screen(el.querySelector('.bud-screen'), { fps: opts.fps || 60, bloom: true });
    scr.set(Object.assign({}, BASE, cfg || {}));
    const b = { el, scr, follow: !!opts.follow, gx: 0, gy: 0, amt: 0 };
    buds.push(b);
    return b;
  }
  const look = (id, st) => (id ? { character: 'skins', base: 'eyes', pack: id, state: st || 'idle' } : { state: st || 'idle' });
  window.budMount = mount; // for wardrobe.js: a Bud whose eyes follow the pointer

  // eyes follow the pointer while it moves, then go back to their own glances
  let px = 0, py = 0, moved = -1e9;
  const point = (e) => { px = e.clientX; py = e.clientY; moved = performance.now(); };
  addEventListener('pointermove', point, { passive: true });
  addEventListener('pointerdown', point, { passive: true });
  function gaze(now) {
    requestAnimationFrame(gaze);
    const active = now - moved < 2600;
    for (const b of buds) {
      if (!b.follow) continue;
      const r = b.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const st = b.scr.cfg.state;
      const k = st === 'thinking' || st === 'working' ? 0.25 : st === 'sleeping' ? 0 : 1;
      const tx = U.clamp((px - (r.left + r.width / 2)) / Math.max(240, innerWidth * 0.32), -1, 1);
      const ty = U.clamp((py - (r.top + r.height / 2)) / Math.max(240, innerHeight * 0.36), -1, 1);
      b.amt += ((active ? 0.92 * k : 0) - b.amt) * 0.05;
      b.gx += (tx - b.gx) * 0.18;
      b.gy += (ty - b.gy) * 0.18;
      b.scr.cfg.gaze = b.amt > 0.01 ? { x: b.gx, y: b.gy, amt: b.amt } : null;
    }
  }
  if (!REDUCED) requestAnimationFrame(gaze);

  /* ------------------------------------------------------------- the hero */
  const hero = mount($('#heroBud'), { state: 'hello' }, { follow: true });
  setTimeout(() => hero.scr.set({ state: 'idle' }), 2600);
  const heroSay = $('#heroSay');
  const LINES = [
    ['listening', 'Hi! What can I do?', 1800],
    ['thinking', 'On it…', 1300],
    ['done', 'Done!', 1600],
    ['love', '', 1800],
  ];
  // a tap on Bud: the photo's live face, or the 3D phone's once hero3d.js has made it (window.budHero.screen)
  let run = 0;
  function heroTap() {
    const scr = (window.budHero && window.budHero.screen) || hero.scr;
    const id = ++run;
    track('hero_tap');
    let i = 0;
    const step = () => {
      if (id !== run) return;
      if (i >= LINES.length) { scr.set({ state: 'idle' }); heroSay.classList.remove('on'); return; }
      const [st, line, ms] = LINES[i++];
      scr.set({ state: st });
      heroSay.textContent = line;
      heroSay.classList.toggle('on', !!line);
      setTimeout(step, ms);
    };
    step();
  }
  window.budHero = Object.assign(window.budHero || {}, { tap: heroTap });
  $('#heroBud').addEventListener('click', heroTap);

  /* ------------------------------------------- how it works: steps Bud acts out */
  const flow = mount($('#flowBud'), { state: 'idle' }, { follow: false });
  const steps = $$('#steps li');
  const flowSay = $('#flowSay');
  const aura = $('#flowAura');
  let cur = null;
  function activate(li) {
    if (cur === li) return;
    cur = li;
    steps.forEach((s) => s.classList.toggle('on', s === li));
    const st = li ? li.dataset.state : 'idle';
    flow.scr.set({ state: st });
    aura.style.backgroundColor = tintOf(st);
    flowSay.textContent = li ? li.dataset.say : '';
    flowSay.classList.toggle('on', !!li);
  }
  steps.forEach((s) => s.querySelector('.state').style.setProperty('--c', tintOf(s.dataset.state)));
  // the step nearest a reading line is the one Bud acts out (computed on scroll, which also works in frames)
  function onScroll() {
    const line = innerHeight * (innerWidth <= 860 ? 0.72 : 0.5);
    let best = null, bestD = Infinity;
    for (const s of steps) {
      const r = s.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - line);
      if (r.bottom > 0 && r.top < innerHeight && d < bestD) { best = s; bestD = d; }
    }
    activate(best);
    $('#nav').classList.toggle('solid', scrollY > 24);
    const pastHero = $('.hero').getBoundingClientRect().bottom < 0;
    const atJoin = $('#join').getBoundingClientRect().top < innerHeight * 0.8;
    $('#stickyCta').classList.toggle('on', pastHero && !atJoin);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('scrollend', onScroll); // (a fast fling's last frame)
  addEventListener('resize', onScroll);
  onScroll();

  /* ------------------------------------------------ the footer: a crowd of Buds peeking up */
  // every one different: the looks (Seollal and Moon rabbit for Chuseok too), Classic, Santa (the
  // Christmas outfit) and three mixed from pieces; the middle ones show on every screen
  const mix = (name, theme, acc, ambient) => ({ name, cfg: { character: 'eyes', theme, acc, ambient: ambient || null } });
  const PEEK = [
    'rainy', 'lantern', mix('pirate', 'night', { head: 'pirateHat', item: 'spyglass' }), 'dj', 'kitty', 'seollal', 'party',
    mix('christmas', 'classic', { head: 'santaHat', face: 'santaBeard', item: 'present' }, 'snow'), '', 'shades',
    mix('paris', 'sakura', { head: 'beret', face: 'roundGlasses', item: 'croissant' }), 'study', 'king', 'blossom', 'halloween',
    mix('summer', 'mint', { head: 'strawHat', face: 'sunglasses', item: 'surfboard' }), 'moonrabbit', 'winter',
  ].map((p) => (typeof p === 'string' ? { name: p || 'classic', cfg: look(p) } : p));
  const SIZES = [0.9, 0.98, 0.88, 1.04, 0.92, 1, 0.9, 1.06, 0.94, 1.02, 0.88, 1.04, 0.9, 1, 0.94, 1.06, 0.9, 0.96];
  const peek = $('#peek');
  if (peek) {
    const crowd = PEEK.map(({ name, cfg }, i) => {
      const w = document.createElement('div');
      w.className = 'peeker';
      w.style.setProperty('--s', SIZES[i]); w.style.setProperty('--i', i);
      w.innerHTML = '<div class="bud"><span class="bud-glass"><span class="bud-screen"></span></span></div>';
      peek.appendChild(w);
      const b = mount(w.firstChild, cfg, { fps: 24, follow: true });
      const feel = (st, ms) => { b.scr.set({ state: st }); clearTimeout(b.t); b.t = setTimeout(() => b.scr.set({ state: 'idle' }), ms); };
      w.addEventListener('pointerenter', () => feel('love', 1500));
      w.addEventListener('click', () => { w.classList.remove('hop'); void w.offsetWidth; w.classList.add('hop'); feel('love', 1800); track('footer_bud', { look: name }); });
      w.addEventListener('animationend', (e) => { if (e.animationName === 'peekhop') w.classList.remove('hop'); });
      return { w, feel };
    });
    // they pop up when the footer shows, and while it does, one on screen pops up to say hi now and then
    let hi = 0;
    new IntersectionObserver((es) => {
      const on = es[es.length - 1].isIntersecting;
      peek.classList.toggle('up', on);
      clearInterval(hi);
      if (!on || REDUCED) return;
      hi = setInterval(() => {
        const seen = crowd.filter((c) => { const r = c.w.getBoundingClientRect(); return r.left > 0 && r.right < innerWidth && !c.w.matches(':hover'); });
        const c = seen[Math.floor(Math.random() * seen.length)];
        if (!c) return;
        c.w.classList.add('hi'); c.feel(Math.random() < 0.5 ? 'hello' : 'love', 1600);
        setTimeout(() => c.w.classList.remove('hi'), 1500);
      }, 2200);
    }, { threshold: 0.15 }).observe(peek);
  }

  /* ------------------------------------------------------------- the waitlist */
  // Bud's server keeps the list (connect/waitlist.mjs): { email, interest, variant, utm, ts }. The
  // variant stays "companion", the name the page has had since the A/B test ended, so sign-ups line up.
  const VARIANT = 'companion';
  const utm = () => {
    const out = {};
    try {
      const q = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => q.get(k) && (out[k] = q.get(k).slice(0, 120)));
    } catch (e) { /* no query */ }
    return out;
  };
  const joined = { get: () => { try { return localStorage.getItem('bud.joined') === '1'; } catch (e) { return false; } }, set: () => { try { localStorage.setItem('bud.joined', '1'); } catch (e) { /* private window */ } } };
  const form = $('#joinForm'), err = $('#joinErr');
  const thank = () => { form.hidden = true; err.hidden = true; $('#thanks').hidden = false; };
  if (joined.get()) thank();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#email');
    const email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { input.focus(); err.textContent = 'Enter an email address, like name@example.com.'; err.hidden = false; return; }
    err.hidden = true;
    track('waitlist_submit');
    const btn = form.querySelector('button[type="submit"]');
    if (CFG.waitlistEndpoint) {
      btn.disabled = true;
      try {
        const r = await fetch(CFG.waitlistEndpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, interest: null, variant: VARIANT, utm: utm(), ts: new Date().toISOString() }) });
        if (!r.ok) throw new Error(r.status === 429 ? 'busy' : String(r.status));
      } catch (x) {
        err.textContent = x.message === 'busy' ? 'Too many sign-ups from here today. Try again tomorrow.' : 'That did not go through. Check your connection and try again.';
        err.hidden = false;
        btn.disabled = false;
        return;
      }
      btn.disabled = false;
    }
    joined.set();
    thank();
    ((window.budHero && window.budHero.screen) || hero.scr).set({ state: 'love' });
  });
  $$('.faq details').forEach((d) => d.addEventListener('toggle', () => d.open && track('faq_open', { question: d.querySelector('summary').textContent })));
})();
