/* The wardrobe: a big live Bud to dress up. Tabs for the looks and for each slot (head, face, neck,
 * holding), every piece shown on a small live Bud; tapping one puts it on (or takes it off), and the
 * caption says where the piece comes from (a place find says where). "Surprise me" mixes a look, and
 * the special days show what Bud wears on its own. While nobody has touched it, it dresses itself. */
(function () {
  'use strict';
  const K = window.Bud;
  const root = document.getElementById('wardrobe');
  if (!root || !K || !K.Screen) return;
  const $ = (s, r) => (r || root).querySelector(s);
  const $$ = (s, r) => Array.from((r || root).querySelectorAll(s));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const BASE = { character: 'eyes', base: 'eyes', pack: 'lantern', theme: 'classic', acc: {}, ambient: null, state: 'idle',
    oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: !REDUCED };
  const GLOW = { classic: 'rgba(121, 247, 230, 0.5)', night: 'rgba(167, 139, 250, 0.45)', sakura: 'rgba(255, 150, 200, 0.5)',
    mint: 'rgba(140, 230, 175, 0.5)', dancheong: 'rgba(255, 190, 90, 0.5)', mono: 'rgba(200, 200, 200, 0.4)' };
  const SLOTS = ['head', 'face', 'neck', 'item'];
  const piece = (id) => (K.ACCESSORIES || []).concat(K.FINDS || [], K.REWARDS || []).find((a) => a.id === id) || null;
  const pack = (id) => (K.PACKS || []).find((p) => p.id === id) || null;
  const TABS = {
    looks: ['', 'party', 'kitty', 'dj', 'study', 'rainy', 'king', 'lantern', 'shades', 'winter', 'blossom', 'halloween'].filter((id) => !id || pack(id)),
    head: ['beret', 'crown', 'catEars', 'strawHat', 'headphones', 'cowboyHat', 'bunnyEars', 'pirateHat', 'beanie', 'witch', 'santaHat', 'partyHat'].filter(piece),
    face: ['sunglasses', 'roundGlasses', 'starGlasses', 'operaGlasses', 'divingGoggles', 'snorkelMask', 'santaBeard'].filter(piece),
    neck: ['bowtie', 'scarf', 'lei', 'norigae', 'saekdong', 'tartanScarf', 'crimsonScarf', 'schoolScarves', 'bestBuds'].filter(piece),
    item: ['bubbleTea', 'croissant', 'coffee', 'balloon', 'taco', 'guitar', 'rocket', 'panda', 'gelato', 'surfboard', 'matcha', 'penguin'].filter(piece),
  };
  const DAYS = {
    birthday: ['Your birthday', 'party', 'On its own, on your birthday'],
    halloween: ['Halloween', 'halloween', 'On its own, every Halloween'],
    seollal: ['Seollal', 'seollal', 'On its own, for the Lunar New Year'],
    chuseok: ['Chuseok', 'moonrabbit', 'On its own, under the harvest moon'],
    christmas: ['Christmas', null, 'On its own, every Christmas'],
  };
  const SANTA = { theme: 'classic', acc: { head: 'santaHat', face: 'santaBeard', item: 'present' }, ambient: 'snow' };

  /* ---- the big Bud */
  const budEl = $('#wdBud');
  const big = window.budMount ? window.budMount(budEl, {}, { fps: 60, follow: true }).scr
    : (() => { const s = new K.Screen($('.bud-screen', budEl), { fps: 60, bloom: true }); s.set(Object.assign({}, BASE)); return s; })();
  const halo = $('#wdHalo'), nameEl = $('#wdName'), whereEl = $('#wdWhere');
  let fit = { theme: 'classic', acc: {}, ambient: null, look: '' };
  let calm = 0;
  function wear(next, name, where) {
    fit = next;
    big.set({ character: 'eyes', theme: fit.theme, acc: Object.assign({}, fit.acc), ambient: fit.ambient, state: 'love' });
    clearTimeout(calm);
    calm = setTimeout(() => big.set({ state: 'idle' }), 1500);
    halo.style.background = `radial-gradient(closest-side, ${GLOW[fit.theme] || GLOW.classic}, rgba(255, 255, 255, 0) 72%)`;
    nameEl.textContent = name; whereEl.textContent = where;
    budEl.classList.add('wd-pop'); setTimeout(() => budEl.classList.remove('wd-pop'), 200);
    mark();
  }
  const ofPack = (id) => {
    const p = pack(id);
    return p ? { theme: p.theme, acc: Object.assign({}, p.acc), ambient: p.ambient, look: id } : { theme: 'classic', acc: {}, ambient: null, look: '' };
  };
  function whereOf(def) {
    if (def.place) return `Found at ${def.place.name}, ${def.place.city}`;
    if (def.how === 'christmas') return 'Santa’s, in the wardrobe all year';
    if (def.how === 'invite') return 'When a friend you invited joins Bud';
    return 'In every Bud’s wardrobe';
  }

  /* ---- the tabs and the pieces, each on a small live Bud */
  const grid = $('#wdGrid');
  const minis = new Map();
  let tab = 'looks';
  function cfgFor(t, id) {
    if (t === 'looks') return id ? { character: 'skins', base: 'eyes', pack: id } : { character: 'eyes', theme: 'classic', acc: {}, ambient: null };
    return { character: 'eyes', theme: 'classic', acc: { [t]: id }, ambient: null };
  }
  function labelFor(t, id) {
    if (t === 'looks') return id ? pack(id).label : 'Classic';
    return piece(id).label;
  }
  // neck pieces and held items sit low and to the side on a face, too small to tell apart on a small
  // Bud, so those tabs show the piece itself, big and centered on a Bud's black screen (lib's drawing)
  const ART = { neck: { x: 0, y: 0, w: 44 }, item: { x: 0, y: 0, w: 1 } }; // the anchors the face uses
  // each piece is measured once (its drawn pixels' box) and then scaled and centered to fill the frame
  function fitArt(a) {
    const S = 240, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.translate(S / 2, S / 2);
    try { K.Acc.drawSlot(x, a.slot, Object.assign({}, ART[a.slot]), artEnv(0), { [a.slot]: a.id }); } catch (e) { /* drawn as is */ }
    const d = x.getImageData(0, 0, S, S).data;
    let x0 = S, y0 = S, x1 = -1, y1 = -1;
    for (let y = 0; y < S; y++) for (let i = 0; i < S; i++) if (d[(y * S + i) * 4 + 3] > 12) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) { a.z = 3; a.ox = 0; a.oy = 0; return; }
    const size = Math.max(x1 - x0, (y1 - y0) * 1.05, 6);
    a.z = Math.min(5.5, 60 / size);
    a.ox = -((x0 + x1) / 2 - S / 2); a.oy = -((y0 + y1) / 2 - S / 2);
  }
  const arts = [];
  const U = K.util;
  // the slow setup of a tile (measuring a piece, making a live face) runs in ~6 ms slices, one a frame,
  // so opening a tab never stalls a frame on a slow phone (a fast one sets up a whole tab in one)
  const jobs = [];
  let pumping = false;
  function later(fn) {
    jobs.push(fn);
    if (!pumping) { pumping = true; requestAnimationFrame(pump); }
  }
  function pump() {
    const t0 = performance.now();
    while (jobs.length && performance.now() - t0 < 6) {
      try { jobs.shift()(); } catch (e) { console.warn('wardrobe tile', e); } // (one bad tile never stops the rest)
    }
    if (jobs.length) requestAnimationFrame(pump); else pumping = false;
  }
  function artEnv(t) {
    const env = { t, theme: 'classic', accColors: K.accColors ? K.accColors('classic') : {}, oled: true, mono: false, lowRes: 0, shape: { type: 'circle' },
      rate: (hz) => hz, wave: (hz, ph) => Math.sin(Math.PI * 2 * (hz * t + (ph || 0))), c: (rgb, a) => U.css(rgb, a == null ? 1 : a) };
    env.acc = (ctx, slot, anchor) => K.Acc.drawSlot(ctx, slot, anchor, env, {});
    return env;
  }
  function drawArt(a, t) {
    if (!a.ready) return; // not measured yet
    const W = a.cv.width, ctx = a.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, W);
    ctx.translate(W / 2, W / 2);
    ctx.scale((W / 100) * a.z, (W / 100) * a.z);
    ctx.translate(a.ox, a.oy);
    try { K.Acc.drawSlot(ctx, a.slot, Object.assign({}, ART[a.slot]), artEnv(t), { [a.slot]: a.id }); } catch (e) { /* a piece that needs more of the face */ }
  }
  let lastArt = 0;
  function artLoop(now) {
    requestAnimationFrame(artLoop);
    if (now - lastArt < 66 || !inView) return; // about 15 fps, only on screen
    lastArt = now;
    arts.forEach((a) => { if (!a.pane.hidden) drawArt(a, now / 1000); });
  }
  const panes = {};
  function pane(t) {
    if (panes[t]) return panes[t];
    const p = document.createElement('div');
    p.className = 'wd-pane'; p.dataset.tab = t;
    const art = !!ART[t];
    p.innerHTML = TABS[t].map((id) => `<button type="button" class="wd-item" data-id="${id}"><span class="mini${art ? ' art' : ''}">${art ? '<canvas width="140" height="140"></canvas>' : '<span class="bud-screen"></span>'}</span><span class="wd-label">${labelFor(t, id)}</span></button>`).join('');
    grid.appendChild(p);
    $$('.wd-item', p).forEach((b) => {
      if (art) {
        const cv = $('canvas', b);
        const a = { cv, ctx: cv.getContext('2d'), slot: t, id: b.dataset.id, pane: p };
        arts.push(a);
        later(() => { fitArt(a); a.ready = true; drawArt(a, 0); });
      } else {
        // small faces animate at 15 fps (a blink or a wave reads the same at this size)
        later(() => {
          const s = new K.Screen($('.bud-screen', b), { fps: 15, bloom: true });
          s.set(Object.assign({}, BASE, cfgFor(t, b.dataset.id)));
          minis.set(b, s);
        });
      }
      b.addEventListener('click', () => { pick(t, b.dataset.id, b); if (window.budTrack) window.budTrack('wardrobe_pick', { tab: t, piece: b.dataset.id || 'classic' }); });
    });
    panes[t] = p;
    return p;
  }
  function show(t) {
    tab = t;
    $$('.wd-tabs button').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    Object.values(panes).forEach((p) => { p.hidden = true; });
    pane(t).hidden = false;
    mark();
  }
  // which pieces are worn, in every pane and on the tabs
  function mark() {
    Object.entries(panes).forEach(([t, p]) => $$('.wd-item', p).forEach((b) => {
      const id = b.dataset.id;
      b.classList.toggle('on', t === 'looks' ? fit.look === id : fit.acc[t] === id);
    }));
    $$('.wd-tabs button').forEach((b) => b.classList.toggle('worn', b.dataset.tab !== 'looks' && !!fit.acc[b.dataset.tab]));
    $$('.wd-days button').forEach((b) => b.classList.toggle('on', fit.day === b.dataset.day));
  }
  function pick(t, id, btn) {
    const m = btn && minis.get(btn);
    if (m) { m.set({ state: 'love' }); setTimeout(() => m.set({ state: 'idle' }), 1100); }
    if (t === 'looks') {
      const p = pack(id);
      wear(ofPack(id), labelFor('looks', id), p ? p.note : 'Just Bud.');
      return;
    }
    const acc = Object.assign({}, fit.acc);
    const def = piece(id);
    if (acc[t] === id) {
      delete acc[t];
      wear({ theme: fit.theme, acc, ambient: fit.ambient, look: null }, `No ${def.label.toLowerCase()}`, 'Back in the wardrobe');
    } else {
      acc[t] = id;
      wear({ theme: fit.theme, acc, ambient: fit.ambient, look: null }, def.label, whereOf(def));
    }
  }
  function day(id) {
    const [name, look, where] = DAYS[id];
    const f = look ? ofPack(look) : Object.assign({}, SANTA, { acc: Object.assign({}, SANTA.acc), look: null });
    f.day = id;
    wear(f, name, where);
  }
  const rand = (a) => a[Math.floor(Math.random() * a.length)];
  function surprise() {
    const acc = { head: rand(TABS.head) };
    if (Math.random() < 0.5) acc.face = rand(TABS.face.filter((x) => x !== 'santaBeard'));
    if (Math.random() < 0.45) acc.neck = rand(TABS.neck);
    if (Math.random() < 0.8) acc.item = rand(TABS.item);
    const f = { theme: rand(['classic', 'night', 'sakura', 'mint', 'dancheong']), acc, ambient: rand([null, null, 'sparkles', 'confetti', 'petals', 'stars', 'snow']), look: null };
    const names = SLOTS.filter((s) => acc[s]).map((s) => piece(acc[s]).label.toLowerCase());
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
    wear(f, 'Surprise!', list.charAt(0).toUpperCase() + list.slice(1));
  }

  const track = (e, d) => window.budTrack && window.budTrack(e, d);
  $$('.wd-tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
  $$('.wd-days button').forEach((b) => b.addEventListener('click', () => { day(b.dataset.day); track('wardrobe_day', { day: b.dataset.day }); }));
  $('#wdSurprise').addEventListener('click', () => { surprise(); track('wardrobe_surprise'); });
  $('#wdReset').addEventListener('click', () => wear(ofPack(''), 'Classic', 'Just Bud.'));
  budEl.addEventListener('click', () => { big.set({ state: 'love' }); clearTimeout(calm); calm = setTimeout(() => big.set({ state: 'idle' }), 1300); });

  /* ---- while nobody has touched it, it dresses itself */
  const DEMO = [['head', 'beret'], ['item', 'croissant'], ['face', 'roundGlasses'], ['neck', 'scarf'], ['looks', 'party'], ['day', 'christmas'], ['looks', 'kitty'], ['surprise'], ['reset']];
  let step = 0, timer = 0, inView = false, touched = false;
  function demo() {
    clearTimeout(timer);
    if (touched || !inView || REDUCED) return;
    const [t, id] = DEMO[step++ % DEMO.length];
    if (t === 'day') day(id);
    else if (t === 'surprise') surprise();
    else if (t === 'reset') wear(ofPack(''), 'Classic', 'Just Bud.');
    else {
      if (tab !== t) show(t);
      const b = $(`.wd-pane[data-tab="${t}"] .wd-item[data-id="${id}"]`);
      if (b) { b.classList.add('wd-press'); setTimeout(() => b.classList.remove('wd-press'), 260); }
      pick(t, id, b);
    }
    timer = setTimeout(demo, 2600);
  }
  const stop = () => { touched = true; clearTimeout(timer); };
  root.addEventListener('pointerdown', stop, { passive: true });
  root.addEventListener('keydown', stop);
  new IntersectionObserver((es) => {
    inView = es[es.length - 1].isIntersecting;
    clearTimeout(timer);
    if (inView) timer = setTimeout(demo, 1200);
  }, { threshold: 0.35 }).observe($('.wd-room'));

  show('looks');
  wear(ofPack(''), 'Classic', 'Just Bud.');
  requestAnimationFrame(artLoop);
})();
