/* Bud landing page.
 *
 * Every Bud on the page is the same live renderer the concept explorer uses (lib/), so
 * the faces, colors and transitions here are the ones the device will show. This file
 * wires them to the page: the hero demo and cursor-following eyes, the scroll-driven 3D
 * reveal, the story, the try-on and share card, the film (or its animatic), reservations,
 * the email list and the A/B variant with dataLayer events.
 */
(function () {
  'use strict';
  const K = window.Bud;
  const U = K.util;
  const CFG = Object.assign(
    { name: 'Bud', depositAmount: 'TBD', price: 'TBD', shipWindow: 'TBD', variants: ['agent', 'companion'], analytics: true },
    window.BUD_CONFIG || {}
  );
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const root = document.documentElement;
  const IN_ARTIFACT = !!(window.claude && typeof window.claude.use === 'function');
  const mq = (q) => !!(window.matchMedia && window.matchMedia(q).matches);
  const REDUCED = mq('(prefers-reduced-motion: reduce)');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        /* private mode: fine */
      }
    },
  };
  function query() {
    try {
      return new URLSearchParams(location.search);
    } catch (e) {
      return new URLSearchParams('');
    }
  }

  /* ------------------------------------------------------------ analytics */

  const variant = () => (CFG.variants.indexOf(root.dataset.variant) >= 0 ? root.dataset.variant : 'agent');
  function track(event, data) {
    if (!CFG.analytics) return;
    (window.dataLayer = window.dataLayer || []).push(Object.assign({ event, variant: variant() }, data || {}));
  }
  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('[data-track]');
    if (t) track(t.dataset.track);
  });

  /* ----------------------------------------------------------- live Buds */

  const TEAL = '#79F7E6';
  const tintOf = (st) => (st === 'idle' || st === 'hello' || st === 'sleeping' ? TEAL : K.TINTS[st] || TEAL);
  const buds = [];

  function mountBud(el, cfg, opts) {
    opts = opts || {};
    const scr = new K.Screen(el.querySelector('.bud-screen'), { fps: opts.fps || 60, bloom: true });
    scr.set(
      Object.assign(
        { character: 'eyes', base: 'eyes', pack: 'lantern', theme: 'classic', acc: {}, ambient: null, state: 'idle' },
        { oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: !REDUCED },
        cfg || {}
      )
    );
    const b = { el, scr, follow: !!opts.follow, gx: 0, gy: 0, amt: 0 };
    buds.push(b);
    return b;
  }

  function setAura(el, st) {
    if (!el) return;
    el.style.backgroundColor = tintOf(st);
    el.style.opacity = st === 'privacy' || st === 'sleeping' ? '0.07' : st === 'idle' ? '0.15' : '0.26';
  }

  // Eyes follow the pointer while it moves, then drift back to their own glances.
  let px = 0;
  let py = 0;
  let lastMove = -1e9;
  const point = (e) => {
    px = e.clientX;
    py = e.clientY;
    lastMove = performance.now();
  };
  window.addEventListener('pointermove', point, { passive: true });
  window.addEventListener('pointerdown', point, { passive: true });
  function gazeTick(now) {
    requestAnimationFrame(gazeTick);
    const active = now - lastMove < 2600;
    for (let i = 0; i < buds.length; i++) {
      const b = buds[i];
      if (!b.follow) continue;
      const r = b.el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      const st = b.scr.cfg.state;
      const k = st === 'thinking' || st === 'working' ? 0.25 : st === 'sleeping' || st === 'privacy' ? 0 : 1;
      const tx = U.clamp((px - (r.left + r.width / 2)) / Math.max(240, window.innerWidth * 0.32), -1, 1);
      const ty = U.clamp((py - (r.top + r.height / 2)) / Math.max(240, window.innerHeight * 0.36), -1, 1);
      b.amt += ((active ? 0.92 * k : 0) - b.amt) * 0.05;
      b.gx += (tx - b.gx) * 0.18;
      b.gy += (ty - b.gy) * 0.18;
      b.scr.cfg.gaze = b.amt > 0.01 ? { x: b.gx, y: b.gy, amt: b.amt } : null;
    }
  }
  if (!REDUCED) requestAnimationFrame(gazeTick);

  /* ------------------------------------------------------------- config */

  function applyConfig() {
    $$('[data-cfg]').forEach((el) => {
      const v = CFG[el.dataset.cfg];
      el.textContent = v ? String(v) : 'TBD';
    });
    if (CFG.contactEmail) {
      const line = $('#contactLine');
      line.hidden = false;
      line.textContent = 'Questions? ';
      if (IN_ARTIFACT) line.append(String(CFG.contactEmail));
      else {
        const a = document.createElement('a');
        a.href = 'mailto:' + CFG.contactEmail;
        a.textContent = CFG.contactEmail;
        line.append(a);
      }
    }
  }

  /* ---------------------------------------------------------------- nav */

  const nav = $('#nav');
  let navBud = null;
  function navSet(st) {
    if (navBud) navBud.set({ state: st });
  }

  /* --------------------------------------------------------------- hero */

  const hero = { bud: null, timer: 0, running: false, lastRun: 0 };
  // a short, safe request: nothing here needs Bud to ask for approval
  const HERO_RUN = [
    ['hello', 1.5, ''],
    ['listening', 2.6, '“Remind me to call Mom at 6.”'],
    ['thinking', 1.3, ''],
    ['done', 2.4, 'Reminder set for 6:00 PM.'],
    ['idle', 0, ''],
  ];

  function lightWords(st) {
    $$('.hw').forEach((w) => w.classList.remove('lit'));
    if (variant() === 'agent') {
      const word = { hello: 'flip', listening: 'talk', thinking: 'talk', done: 'done' }[st];
      const el = word && $(`.hw[data-word="${word}"]`);
      if (el) {
        el.style.setProperty('--c', word === 'flip' ? TEAL : tintOf(st === 'thinking' ? 'listening' : st));
        el.classList.add('lit');
      }
    } else if (st !== 'idle') {
      const el = $('.hw[data-word="face"]');
      el.style.setProperty('--c', tintOf(st));
      el.classList.add('lit');
    }
  }

  function heroSet(st, caption) {
    hero.bud.scr.set({ state: st });
    setAura($('#heroAura'), st);
    lightWords(st);
    const say = $('#heroSay');
    if (caption) {
      say.textContent = caption;
      say.classList.add('on');
    } else say.classList.remove('on');
  }

  function heroRun(fromTap) {
    clearTimeout(hero.timer);
    hero.running = true;
    hero.lastRun = performance.now();
    let i = 0;
    const step = () => {
      const [st, dur, cap] = HERO_RUN[i++];
      heroSet(st, cap);
      if (i < HERO_RUN.length) hero.timer = setTimeout(step, dur * 1000);
      else hero.running = false;
    };
    step();
    if (fromTap) {
      $('#tapHint').classList.add('gone');
      // captions are read out only once someone has asked for the demo
      $('#heroSay').setAttribute('aria-live', 'polite');
      track('hero_tap');
    }
  }

  function setupHero() {
    hero.bud = mountBud($('#heroBud'), {}, { follow: true });
    setAura($('#heroAura'), 'idle');
    $('#heroBud').addEventListener('click', () => heroRun(true));
    if (REDUCED) return;
    // play once on arrival, and again when someone scrolls back up to it after a while
    watchVisible(
      $('#heroBud'),
      (vis) => {
        if (vis && !hero.running && (!hero.lastRun || performance.now() - hero.lastRun > 15000)) {
          clearTimeout(hero.timer);
          hero.timer = setTimeout(() => heroRun(false), hero.lastRun ? 500 : 1500);
        }
      },
      0.6
    );
  }

  /* ------------------------------------------------- on the phone (3D) */

  const OP = { sec: null, v3d: null, cap: -1, flat: null, visible: false };
  const PLACE = { cx: 35.8, cy: 74 }; // mm on the iPhone-style back, below the camera, clear of it
  // camera keyframes along the scroll: face close-up, the whole phone back, the side (thickness), 3/4
  // the phone starts screen-up, flips to show Bud, then Bud's face, its side (thickness), and 3/4
  const CAM_WIDE = [
    { p: 0.0, yaw: Math.PI, pitch: 0.05, zoom: 0.95, focus: 1 },
    { p: 0.06, yaw: Math.PI, pitch: 0.05, zoom: 0.95, focus: 1 },
    { p: 0.26, yaw: 0, pitch: 0, zoom: 0.95, focus: 1 },
    { p: 0.48, yaw: 0, pitch: 0, zoom: 0.48, focus: 0 },
    { p: 0.72, yaw: -1.5, pitch: 0.04, zoom: 0.5, focus: 0.3 },
    { p: 1.0, yaw: -0.64, pitch: 0.3, zoom: 0.74, focus: 0.55 },
  ];
  const CAM_NARROW = [
    { p: 0.0, yaw: Math.PI, pitch: 0.05, zoom: 1.2, focus: 1 },
    { p: 0.06, yaw: Math.PI, pitch: 0.05, zoom: 1.2, focus: 1 },
    { p: 0.26, yaw: 0, pitch: 0, zoom: 1.2, focus: 1 },
    { p: 0.48, yaw: 0, pitch: 0, zoom: 0.66, focus: 0 },
    { p: 0.72, yaw: -1.5, pitch: 0.04, zoom: 0.72, focus: 0.3 },
    { p: 1.0, yaw: -0.64, pitch: 0.3, zoom: 1.0, focus: 0.55 },
  ];
  const isWide = () => window.innerWidth >= 900;
  function camAt(p) {
    const CAM = isWide() ? CAM_WIDE : CAM_NARROW;
    let i = 0;
    while (i < CAM.length - 2 && p > CAM[i + 1].p) i++;
    const a = CAM[i];
    const b = CAM[i + 1];
    const k = U.smoothstep(a.p, b.p, p);
    return { yaw: U.lerp(a.yaw, b.yaw, k), pitch: U.lerp(a.pitch, b.pitch, k), zoom: U.lerp(a.zoom, b.zoom, k), focus: U.lerp(a.focus, b.focus, k) };
  }
  function webglOK() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) {
      return false;
    }
  }

  async function init3d() {
    if (OP.started) return; // two triggers (near the section, or shortly after load) can both fire
    OP.started = true;
    // reduced motion gets the still drawing instead of a moving camera
    if (REDUCED || query().has('flat') || !webglOK() || !K.View3D) return showFlat();
    try {
      const v = new K.View3D($('#onphone3d'), { controls: false });
      v.shiftX = isWide() ? 0.2 : 0;
      v.setFrontScreen(lockScreen());
      v.update({
        phone: 'iphone', phoneColor: 'black', form: 'round-full', size: 44, thickness: 4,
        shellColor: '#F4F1EC', finish: 'matte', name: '', place: PLACE,
        screen: { character: 'eyes', theme: 'classic', state: 'idle', oled: true, variety: !REDUCED },
      });
      const c = camAt(0);
      v.setView(c.yaw, c.pitch, c.zoom, true);
      await v.start();
      OP.v3d = v;
      onScroll();
      if (!OP.visible) v.stop();
    } catch (e) {
      showFlat();
    }
  }

  /** The phone's own screen for the flip: a plain lock screen, no text. */
  function lockScreen() {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 1352;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, c.height);
    bg.addColorStop(0, '#0f1730');
    bg.addColorStop(0.55, '#1d1838');
    bg.addColorStop(1, '#2c1a3f');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);
    const blob = (x, y, r, col) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, c.width, c.height);
    };
    blob(150, 420, 420, 'rgba(121,247,230,0.28)');
    blob(520, 980, 460, 'rgba(255,95,176,0.22)');
    g.fillStyle = '#000';
    g.beginPath();
    g.roundRect ? g.roundRect(230, 34, 180, 52, 26) : g.rect(230, 34, 180, 52);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.beginPath();
    g.roundRect ? g.roundRect(220, 1300, 200, 12, 6) : g.rect(220, 1300, 200, 12);
    g.fill();
    return c;
  }

  function showFlat() {
    const host = $('#onphoneFlat');
    host.hidden = false;
    $('#onphone3d').hidden = true;
    const ph = K.phones.get('iphone');
    const box = document.createElement('div');
    box.className = 'phone';
    box.innerHTML = K.phoneSvg(ph, 'black');
    const bud = document.createElement('div');
    bud.className = 'bud';
    bud.innerHTML = '<span class="bud-glass"><span class="bud-screen"></span></span>';
    const pad = 1.6;
    bud.style.left = `${((PLACE.cx + pad) / (ph.w + pad * 2)) * 100}%`;
    bud.style.top = `${((PLACE.cy + pad) / (ph.h + pad * 2)) * 100}%`;
    box.append(bud);
    host.append(box);
    const size = () => bud.style.setProperty('--d', `${(box.clientWidth * 44) / (ph.w + pad * 2)}px`);
    new ResizeObserver(size).observe(box);
    size();
    OP.flat = mountBud(bud, {}, { follow: true });
  }

  function onphoneScroll() {
    const r = OP.sec.getBoundingClientRect();
    const p = U.clamp(-r.top / Math.max(1, r.height - window.innerHeight));
    $('.onphone-progress i').style.height = `${(p * 100).toFixed(1)}%`;
    const cap = p < 0.13 ? 0 : p < 0.37 ? 1 : p < 0.6 ? 2 : p < 0.84 ? 3 : 4;
    if (cap !== OP.cap) {
      OP.cap = cap;
      $$('.cap').forEach((c) => c.classList.toggle('on', +c.dataset.cap === cap));
      // asleep while it faces away, wakes when the flip brings it around
      const st = cap === 0 ? 'sleeping' : cap === 1 || cap === 4 ? 'hello' : 'idle';
      const patch = { state: st, brightness: cap === 0 ? 0.08 : 1 };
      if (OP.v3d) OP.v3d.screen.set(patch);
      if (OP.flat) OP.flat.scr.set(patch);
    }
    if (OP.v3d) {
      const c = camAt(p);
      OP.v3d.setView(c.yaw, c.pitch, c.zoom);
      OP.v3d.focus = c.focus;
      const shift = isWide() ? 0.2 : 0;
      if (OP.v3d.shiftX !== shift) {
        OP.v3d.shiftX = shift;
        OP.v3d.resize();
      }
    }
  }

  function setupOnphone() {
    OP.sec = $('#onphone');
    const near = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          near.disconnect();
          init3d();
        }
      },
      { rootMargin: '120% 0px' }
    );
    near.observe(OP.sec);
    // margins are ignored inside embedded frames, so also warm it up shortly after load
    setTimeout(() => {
      near.disconnect();
      init3d();
    }, 1800);
    // only render the 3D scene while it is on screen
    watchVisible(OP.sec, (vis) => {
      OP.visible = vis;
      if (!OP.v3d) return;
      if (vis) OP.v3d.start();
      else OP.v3d.stop();
    });
  }

  /* ---------------------------------------------------------------- story */

  const story = { bud: null, cur: null, steps: [] };
  function storyActivate(step) {
    if (story.cur === step) return;
    story.cur = step;
    const st = step.dataset.state;
    story.bud.scr.set({ state: st });
    setAura($('#storyAura'), st);
    const pill = $('#storyPill');
    pill.style.setProperty('--c', tintOf(st));
    pill.querySelector('.lbl').textContent = K.state(st).label;
    navSet(st);
  }
  // Reading focus follows the scroll position: the step nearest a reading line is the one Bud acts
  // out, and text dims gradually as it moves away from that line. (Computed directly, because
  // browsers ignore IntersectionObserver margins inside embedded frames.)
  function storyScroll() {
    if (!story.steps.length) return;
    const vh = window.innerHeight;
    const line = vh * (mq('(max-width: 860px)') ? 0.7 : 0.5);
    let best = null;
    let bestD = Infinity;
    let curD = Infinity;
    for (let i = 0; i < story.steps.length; i++) {
      const el = story.steps[i];
      const a = el.firstElementChild.getBoundingClientRect();
      const b = el.lastElementChild.getBoundingClientRect();
      const d = Math.abs((a.top + b.bottom) / 2 - line) / vh;
      el.style.opacity = (0.28 + 0.72 * (1 - U.smoothstep(0.17, 0.42, d))).toFixed(3);
      if (d < bestD) {
        bestD = d;
        best = el;
      }
      if (el === story.cur) curD = d;
    }
    // a little hysteresis so Bud does not flip back and forth between two steps
    if (best && best !== story.cur && bestD < curD - 0.03) storyActivate(best);
  }
  function setupStory() {
    story.bud = mountBud($('#storyBud'), { state: 'hello' });
    story.steps = $$('.story-steps .step');
    storyActivate(story.steps[0]);
    storyScroll();
    // leaving the story puts the little nav Bud back to idle
    watchVisible($('#how'), (vis) => !vis && navSet('idle'));
  }

  /* ---------------------------------------------------------- uses, privacy */

  function setupUses() {
    $$('.use').forEach((u) => mountBud(u.querySelector('.bud'), { state: u.dataset.state }, { fps: 30 }));
  }

  // The mic light is wired to the mic: Bud listening means the light is on, mic off means it is dark.
  function setupPrivacy() {
    const el = $('#privacyBud');
    const b = mountBud(el, { state: 'listening' }, { follow: true });
    const mic = (on) => {
      b.scr.set({ state: on ? 'listening' : 'privacy' });
      el.querySelector('.mic-light').classList.toggle('on', on);
      el.setAttribute('aria-label', on ? 'Bud listening, with its mic light on' : 'Bud with the mic off, its mic light dark');
      setAura($('#privacyAura'), on ? 'listening' : 'privacy');
    };
    mic(true);
    $('#micToggle').addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const on = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', String(on));
      btn.querySelector('.mt-label').textContent = on ? 'Mic on' : 'Mic off';
      mic(on);
      track('mic_toggle', { on });
    });
  }

  /* ------------------------------------------------------- make it yours */

  const SHELLS = [
    { label: 'Cloud', hex: '#F4F1EC' },
    { label: 'Charcoal', hex: '#2D2D31' },
    { label: 'Sand', hex: '#E5D4BC' },
    { label: 'Sage', hex: '#B7C8B1' },
    { label: 'Blush', hex: '#F0C8C3' },
    { label: 'Sky', hex: '#BBD2EA' },
    { label: 'Butter', hex: '#F2DF9C' },
    { label: 'Clay', hex: '#C7886A' },
  ];
  const LOOKS = [{ id: '', label: 'Classic', theme: 'classic' }].concat(K.PACKS.map((p) => ({ id: p.id, label: p.label, theme: p.theme })));
  const eyeHex = (theme) => U.hex(K.palette('eyes', theme).eye);
  const yours = { bud: null, look: '', shell: SHELLS[0], name: CFG.name, timer: 0 };

  const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  function yoursCfg(st) {
    return yours.look ? { character: 'skins', base: 'eyes', pack: yours.look, state: st } : { character: 'eyes', theme: 'classic', acc: {}, ambient: null, state: st };
  }
  function react(st) {
    clearTimeout(yours.timer);
    const cur = yours.bud.scr.cfg.state;
    yours.bud.scr.set(yoursCfg(cur === st ? (st === 'done' ? 'hello' : 'done') : st));
    yours.timer = setTimeout(() => yours.bud.scr.set({ state: 'idle' }), 2400);
  }
  function saveYours() {
    store.set('bud.yours', { look: yours.look, shell: yours.shell.label, name: yours.name });
  }

  function setupYours() {
    const saved = store.get('bud.yours', null);
    if (saved) {
      if (LOOKS.some((l) => l.id === saved.look)) yours.look = saved.look;
      yours.shell = SHELLS.find((s) => s.label === saved.shell) || SHELLS[0];
      if (cleanName(saved.name)) yours.name = cleanName(saved.name);
    }
    yours.bud = mountBud($('#yoursBud'), yoursCfg('idle'), { follow: true });

    const looks = $('#looks');
    LOOKS.forEach((l) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.innerHTML = '<i></i>';
      b.querySelector('i').style.setProperty('--c', eyeHex(l.theme));
      b.append(l.label);
      b.setAttribute('aria-pressed', String(l.id === yours.look));
      b.addEventListener('click', () => {
        yours.look = l.id;
        $$('.chip', looks).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        react('done');
        saveYours();
        track('tryon_look', { look: l.id || 'classic' });
      });
      looks.append(b);
    });

    const shells = $('#shells');
    const paintShell = () => {
      $('#yoursBud').style.setProperty('--shell', yours.shell.hex);
      $('#shellName').textContent = yours.shell.label;
    };
    SHELLS.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch';
      b.style.setProperty('--s', s.hex);
      b.setAttribute('aria-label', `${s.label} shell`);
      b.title = s.label;
      b.setAttribute('aria-pressed', String(s === yours.shell));
      b.addEventListener('click', () => {
        yours.shell = s;
        $$('.swatch', shells).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        paintShell();
        saveYours();
        track('tryon_shell', { shell: s.label });
      });
      shells.append(b);
    });
    paintShell();

    const input = $('#nameInput');
    const plate = $('#namePlate');
    input.value = yours.name;
    plate.textContent = yours.name;
    let typing = 0;
    input.addEventListener('input', () => {
      yours.name = cleanName(input.value) || CFG.name;
      plate.textContent = yours.name;
      clearTimeout(typing);
      typing = setTimeout(() => {
        react('hello');
        saveYours();
      }, 450);
    });
    $('#cardBtn').addEventListener('click', openCard);
  }

  /* ------------------------------------------------------------ share card */

  async function renderCard() {
    const W = 1080;
    const H = 1350;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const look = LOOKS.find((l) => l.id === yours.look) || LOOKS[0];
    const eye = U.rgb(eyeHex(look.theme));
    const shell = U.rgb(yours.shell.hex);
    const css = U.css;

    // Bud waves for the photo
    yours.bud.scr.set(yoursCfg('hello'));
    try {
      await Promise.all([
        document.fonts.load('780 100px "Figtree"'),
        document.fonts.load('500 40px "Figtree"'),
        document.fonts.load('600 24px "Figtree"'),
        document.fonts.load('900 60px "Nunito"'),
      ]);
    } catch (e) {
      /* fallback fonts are fine */
    }
    await sleep(950);

    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W / 2, 560, 40, W / 2, 560, 760);
    glow.addColorStop(0, css(eye, 0.3));
    glow.addColorStop(1, css(eye, 0));
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = 560;
    const R = 330;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.75)';
    g.shadowBlur = 90;
    g.shadowOffsetY = 46;
    const sg = g.createRadialGradient(cx - R * 0.42, cy - R * 0.5, R * 0.1, cx, cy, R * 1.05);
    sg.addColorStop(0, css(U.lighten(shell, 0.5)));
    sg.addColorStop(0.36, css(shell));
    sg.addColorStop(1, css(U.darken(shell, 0.2)));
    g.fillStyle = sg;
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fill();
    g.restore();
    const gr = R * 0.896;
    g.fillStyle = '#000';
    g.beginPath();
    g.arc(cx, cy, gr, 0, Math.PI * 2);
    g.fill();
    const sr = gr * 0.948;
    g.save();
    g.beginPath();
    g.arc(cx, cy, sr, 0, Math.PI * 2);
    g.clip();
    yours.bud.scr.render(performance.now() / 1000); // fresh frame even if the section is off screen
    g.drawImage(yours.bud.scr.canvas, cx - sr, cy - sr, sr * 2, sr * 2);
    g.restore();
    const ref = g.createLinearGradient(cx - gr, cy - gr, cx + gr * 0.2, cy + gr * 0.4);
    ref.addColorStop(0, 'rgba(255,255,255,0.16)');
    ref.addColorStop(0.45, 'rgba(255,255,255,0.03)');
    ref.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.fillStyle = ref;
    g.beginPath();
    g.arc(cx, cy, gr, 0, Math.PI * 2);
    g.fill();

    g.textAlign = 'center';
    g.fillStyle = '#6D6E77';
    g.font = '600 24px Figtree, system-ui, sans-serif';
    g.letterSpacing = '3px';
    g.fillText(`${look.label} look · ${yours.shell.label} shell`.toUpperCase(), W / 2, 132);
    g.letterSpacing = '0px';
    g.fillStyle = '#F5F5F7';
    let size = 104;
    const title = `Meet ${yours.name}.`;
    do {
      g.font = `780 ${size}px Figtree, system-ui, sans-serif`;
      size -= 4;
    } while (g.measureText(title).width > W - 140 && size > 48);
    g.fillText(title, W / 2, 1040);
    g.fillStyle = '#A4A5AD';
    g.font = '500 40px Figtree, system-ui, sans-serif';
    g.fillText(variant() === 'companion' ? 'My phone has a face now.' : 'My AI, on the back of my phone.', W / 2, 1108);
    g.fillStyle = '#F5F5F7';
    g.font = '900 64px Nunito, "Arial Rounded MT Bold", system-ui, sans-serif';
    g.fillText('bud', W / 2, 1238);
    if (CFG.siteUrl) {
      g.fillStyle = '#6D6E77';
      g.font = '600 24px Figtree, system-ui, sans-serif';
      g.letterSpacing = '3px';
      g.fillText(String(CFG.siteUrl).toUpperCase(), W / 2, 1288);
      g.letterSpacing = '0px';
    }
    setTimeout(() => yours.bud.scr.set({ state: 'idle' }), 1200);
    return c;
  }

  let downloadsP = null;
  const getDownloads = () =>
    (downloadsP = downloadsP || (IN_ARTIFACT ? Promise.resolve(window.claude.use('downloads')).catch(() => null) : Promise.resolve(null)));

  async function openCard() {
    const dlg = $('#cardDlg');
    const btn = $('#cardBtn');
    btn.setAttribute('aria-disabled', 'true');
    let canvas;
    try {
      canvas = await renderCard();
    } finally {
      btn.removeAttribute('aria-disabled');
    }
    const url = canvas.toDataURL('image/png');
    const img = $('#cardImg');
    img.src = url;
    img.alt = `A card that says Meet ${yours.name}, with Bud in the ${yours.shell.label} shell.`;
    const save = $('#cardSave');
    const share = $('#cardShare');
    const hint = $('#cardHint');
    const filename = `${yours.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'my'}-bud.png`;
    hint.textContent = 'Post it anywhere. Tag a friend who needs one.';
    share.hidden = true;
    if (IN_ARTIFACT) {
      // inside a claude.ai preview, files go through the viewer's own save prompt
      save.removeAttribute('download');
      save.href = '#';
      save.hidden = true;
      getDownloads().then((dl) => {
        save.hidden = !dl;
        if (!dl) hint.textContent = 'Right-click or long-press the image to save it.';
      });
      save.onclick = (e) => {
        e.preventDefault();
        getDownloads().then((dl) => {
          if (!dl) return;
          canvas.toBlob((blob) => {
            dl.save({ filename, data: blob })
              .then(() => (hint.textContent = 'Saved.'))
              .catch((err) => (hint.textContent = err && err.code === 'declined' ? 'Not saved.' : 'Right-click or long-press the image to save it.'));
          }, 'image/png');
        });
      };
    } else {
      save.onclick = null;
      save.href = url;
      save.setAttribute('download', filename);
      save.hidden = false;
    }
    if (!IN_ARTIFACT && navigator.canShare) {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          share.hidden = false;
          share.onclick = () => navigator.share({ files: [file], title: `Meet ${yours.name}` }).catch(() => {});
        }
      });
    }
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    track('card_made', { look: yours.look || 'classic', shell: yours.shell.label });
  }
  function setupDialog() {
    const dlg = $('#cardDlg');
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg || e.target.closest('[data-close]')) dlg.close();
    });
  }

  /* ----------------------------------------------------------- the film */

  // The animatic follows the storyboard in docs/ad-film.md, beat for beat.
  const FILM = [
    { dur: 3.6, scene: 'Café, morning', bg: ['#3b2a1e', '#0a0705'], state: 'idle', line: 'A phone lies face down on a café table. On its back, Bud blinks.' },
    { dur: 3.4, scene: 'Café', bg: ['#3b2a1e', '#0a0705'], state: 'hello', line: 'She taps it. “Say hi.” The man at the next table grins and waves back.' },
    { dur: 3.6, scene: 'Sidewalk', bg: ['#1e2a37', '#05070a'], state: 'listening', line: '“Move my 3pm with Sam to tomorrow.”' },
    { dur: 3.0, scene: 'Sidewalk', bg: ['#1e2a37', '#05070a'], state: 'working', line: 'Bud gets to work while she walks.' },
    { dur: 3.4, scene: 'Grocery store', bg: ['#1c3326', '#040805'], state: 'needsyou', line: '“Sam is free at 11 or 2.” “11.”' },
    { dur: 3.0, scene: 'Grocery store', bg: ['#1c3326', '#040805'], state: 'done', line: 'Done before she reaches the checkout.' },
    { dur: 4.2, scene: 'Montage', bg: ['#2a2140', '#06040a'], state: 'love', looks: ['party', 'study', 'kitty'], line: 'A birthday. A late study night. Bud on every phone, in every look.' },
    { dur: 3.2, scene: 'Subway', bg: ['#152030', '#020305'], state: 'idle', gaze: true, line: 'Everyone is staring at a screen. One screen looks back.' },
    { dur: 2.8, scene: 'Bud', bg: ['#0d2a27', '#000000'], state: 'hello', line: 'Flip. Talk. Done.' },
  ];
  const FILM_LEN = FILM.reduce((n, b) => n + b.dur, 0);
  const film = { bud: null, raf: 0, t0: 0, beat: -1, look: '' };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function filmBeat(i) {
    const b = FILM[i];
    const bg = $('#animBg');
    bg.style.setProperty('--bg1', b.bg[0]);
    bg.style.setProperty('--bg2', b.bg[1]);
    $('#animScene').textContent = b.scene;
    const line = $('#animLine');
    line.classList.add('fade');
    setTimeout(() => {
      line.textContent = b.line;
      line.classList.remove('fade');
    }, 220);
    film.look = '';
    film.bud.scr.set({ character: 'eyes', theme: 'classic', acc: {}, ambient: null, state: b.state });
  }
  function filmFrame(now) {
    const t = (now - film.t0) / 1000;
    if (t >= FILM_LEN) return filmEnd();
    film.raf = requestAnimationFrame(filmFrame);
    let i = 0;
    let acc = 0;
    while (i < FILM.length - 1 && t >= acc + FILM[i].dur) acc += FILM[i++].dur;
    if (i !== film.beat) {
      film.beat = i;
      filmBeat(i);
    }
    const b = FILM[i];
    const u = (t - acc) / b.dur;
    if (b.looks) {
      const look = b.looks[Math.min(b.looks.length - 1, Math.floor(u * b.looks.length))];
      if (look !== film.look) {
        film.look = look;
        film.bud.scr.set({ character: 'skins', base: 'eyes', pack: look, state: b.state });
      }
    }
    // the subway beat: Bud glances around, then looks straight at the viewer
    film.bud.scr.cfg.gaze = b.gaze ? { x: u < 0.7 ? Math.sin(u * 9) * 0.8 : 0, y: u < 0.7 ? -0.1 : 0, amt: 0.95 } : null;
    $('#animBar').style.width = `${((t / FILM_LEN) * 100).toFixed(2)}%`;
    $('#animTime').textContent = `${fmtTime(t)} / ${fmtTime(FILM_LEN)}`;
  }
  function filmEnd() {
    cancelAnimationFrame(film.raf);
    film.beat = -1;
    $('#film').classList.remove('playing');
    $('.fp-lbl').textContent = 'Play again';
    $('#animBar').style.width = '100%';
    film.bud.scr.cfg.gaze = null;
    track('film_complete', { kind: 'animatic' });
  }
  function filmPlay(opts) {
    if (CFG.filmSrc) {
      if (!vid.el) return;
      if (opts && opts.restart) vid.el.currentTime = 0;
      vidPlay(true);
      vidCopy();
      return;
    }
    cancelAnimationFrame(film.raf);
    $('#film').classList.add('playing');
    film.t0 = performance.now();
    film.beat = -1;
    film.raf = requestAnimationFrame(filmFrame);
  }
  /** Show one beat as a still (used to export the storyboard; also handy in the console). */
  function filmShow(i) {
    cancelAnimationFrame(film.raf);
    const b = FILM[Math.max(0, Math.min(FILM.length - 1, i))];
    $('#film').classList.add('playing');
    filmBeat(FILM.indexOf(b));
    const line = $('#animLine');
    line.textContent = b.line;
    line.classList.remove('fade');
    if (b.looks) film.bud.scr.set({ character: 'skins', base: 'eyes', pack: b.looks[0], state: b.state });
    let at = 0;
    for (let k = 0; k < FILM.indexOf(b); k++) at += FILM[k].dur;
    $('#animTime').textContent = `${fmtTime(at)} / ${fmtTime(FILM_LEN)}`;
    $('#animBar').style.width = `${(((at + b.dur / 2) / FILM_LEN) * 100).toFixed(1)}%`;
    return { scene: b.scene, line: b.line, at, dur: b.dur };
  }
  window.BudLanding = { filmShow, film: FILM };

  /* The finished film is the vertical cut. It plays muted and loops while it is on screen,
   * pauses when it is not, and sound is one tap away. With sound on it plays once and ends
   * on a replay card. The chapters beside it follow along and jump to their scene. */
  const CHAPTERS = [
    { at: 0, label: 'Meet Bud' },
    { at: 6, label: 'Ask out loud' },
    { at: 10, label: 'It gets to work' },
    { at: 13, label: 'It asks first' },
    { at: 16, label: 'Done' },
    { at: 18.5, label: 'Make it yours' },
    { at: 23, label: 'One flip away' },
  ];
  const AUTOPLAY = !REDUCED && !(navigator.connection && navigator.connection.saveData);
  const vid = {
    el: null, frame: null, held: false, done: false, shown: false, away: false, near: false, played: false, raf: 0, chapter: -1,
    direct: '', copy: '', copyState: '', seekTo: null,
  };
  const FILM_HOLD = 29.2; // the end card at full brightness, just before the film's last fade to black
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1" fill="currentColor"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z" fill="currentColor"/><path d="M16 9.6l4.8 4.8M20.8 9.6L16 14.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.4L12 5.6v12.8l-4.6-3.9H4z" fill="currentColor"/><path d="M15.6 9.2a4 4 0 0 1 0 5.6M18.4 6.6a7.6 7.6 0 0 1 0 10.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  function vidUI() {
    const v = vid.el;
    const f = vid.frame;
    f.classList.toggle('sound', !v.muted);
    f.classList.toggle('paused', v.paused);
    const snd = $('.film-sound', f);
    snd.setAttribute('aria-pressed', String(!v.muted));
    snd.setAttribute('aria-label', v.muted ? 'Turn the sound on' : 'Turn the sound off');
    $('.film-toggle', f).setAttribute('aria-label', v.paused ? 'Play the film' : 'Pause the film');
  }
  function vidTick() {
    const v = vid.el;
    const d = v.duration || 30;
    const t = vid.seekTo != null ? vid.seekTo : v.currentTime;
    $('.film-progress i', vid.frame).style.width = vid.done ? '100%' : `${Math.min(100, (t / d) * 100).toFixed(2)}%`;
    const items = $$('#filmChapters button');
    if (!items.length) return;
    let i = 0;
    while (i < CHAPTERS.length - 1 && t >= CHAPTERS[i + 1].at) i++;
    if (i !== vid.chapter) {
      vid.chapter = i;
      items.forEach((b, k) => {
        b.setAttribute('aria-current', String(k === i));
        if (k !== i) $('.fc-bar', b).style.width = '0';
      });
    }
    const end = i < CHAPTERS.length - 1 ? CHAPTERS[i + 1].at : d;
    const pct = vid.done ? 100 : Math.min(100, ((t - CHAPTERS[i].at) / (end - CHAPTERS[i].at)) * 100);
    $('.fc-bar', items[i]).style.width = `${pct.toFixed(1)}%`;
  }
  function vidLoop() {
    vidTick();
    vid.raf = vid.el.paused ? 0 : requestAnimationFrame(vidLoop);
  }
  /** Play the film. `sound` true or false sets the sound; leave it out to keep it. */
  function vidPlay(sound) {
    const v = vid.el;
    if (sound !== undefined) v.muted = !sound;
    v.loop = v.muted; // muted, it loops quietly beside the copy; with sound, it plays once
    vid.held = false;
    vid.done = false;
    vid.frame.classList.remove('ended');
    if (vid.copyState === 'ready' && v.src !== vid.copy && v.currentTime < 0.05) v.src = vid.copy;
    const p = v.play();
    if (p && p.catch)
      p.catch(() => {
        if (!v.muted) return vidPlay(false); // sound needs a tap in this browser: play muted
        // autoplay is off here (low power mode, for one): show the poster and the play button
        if (!v.poster && CFG.filmPosterVertical) v.poster = CFG.filmPosterVertical;
        vid.frame.classList.add('blocked');
      });
  }
  function vidPause(hold) {
    if (hold) vid.held = true;
    if (!vid.el.paused) vid.el.pause();
  }
  /* Some hosts (claude.ai's file host is one) serve video without byte ranges, and a browser
   * cannot jump around in a video served that way. So once the film is close it is also loaded
   * into memory, and the chapters jump within that copy. If that is blocked, the film still
   * plays straight from the file. */
  function vidCopy() {
    if (vid.copyState || !window.fetch || !(window.URL && URL.createObjectURL)) return;
    vid.copyState = 'loading';
    fetch(vid.direct)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        vid.copy = URL.createObjectURL(b);
        vid.copyState = 'ready';
        const v = vid.el;
        if (vid.seekTo != null) vidUseCopy(vid.seekTo, true);
        else if (v.paused && v.currentTime < 0.05) v.src = vid.copy; // not started yet: switch quietly
      })
      .catch(() => {
        vid.copyState = 'failed';
        if (vid.seekTo != null) vidSeek(vid.seekTo);
      });
  }
  /** Move the player onto the in-memory copy at `t` seconds. */
  function vidUseCopy(t, play) {
    const v = vid.el;
    const resume = play || !v.paused;
    vid.seekTo = null;
    v.src = vid.copy;
    v.addEventListener(
      'loadedmetadata',
      () => {
        if (t) v.currentTime = t;
        vidTick();
        if (resume) vidPlay();
      },
      { once: true }
    );
  }
  /** Jump to `t` seconds and play from there. */
  function vidSeek(t) {
    const v = vid.el;
    vid.done = false;
    if (t < 0.05 || v.src === vid.copy || vid.copyState === 'failed') {
      vid.seekTo = null;
      v.currentTime = t;
      vidTick();
      if (v.paused) vidPlay();
    } else if (vid.copyState === 'ready') vidUseCopy(t, true);
    else {
      vid.seekTo = t; // jumps there as soon as the copy is in
      vidTick();
      vidCopy();
    }
  }
  /** The phone layout sizes the film to the screen under the heading, so it needs the heading's height. */
  function filmFit() {
    const head = $('#film .sec-head');
    if (head) $('#film').style.setProperty('--film-head', `${Math.ceil(head.offsetHeight)}px`);
  }
  /** Called on scroll: load the film as it gets close, play it when it is on screen, pause it when it is not. */
  function filmAuto() {
    const v = vid.el;
    if (!v) return;
    const r = vid.frame.getBoundingClientRect();
    const h = window.innerHeight;
    if (!vid.near && r.top < h * 2.5 && r.bottom > -h) {
      vid.near = true;
      vidCopy();
    }
    const seen = Math.max(0, Math.min(r.bottom, h) - Math.max(r.top, 0)) / Math.max(1, r.height);
    if (!vid.shown && seen >= 0.3) {
      vid.shown = true;
      if (AUTOPLAY && !vid.held && !vid.done && v.paused) vidPlay();
    } else if (vid.shown && seen < 0.06) {
      vid.shown = false;
      vidPause(false);
    }
  }

  function setupFilm() {
    if (CFG.filmSrc) {
      const frame = $('#filmFrame');
      const vertical = !!CFG.filmSrcVertical;
      vid.frame = frame;
      $('#film').classList.toggle('side', vertical);
      frame.classList.toggle('vertical', vertical);
      frame.classList.toggle('auto', AUTOPLAY);
      frame.innerHTML = '';
      const v = document.createElement('video');
      vid.el = v;
      vid.direct = vertical ? CFG.filmSrcVertical : CFG.filmSrc;
      v.src = vid.direct;
      // autoplay starts from black, like the film, so the poster is only for when it cannot autoplay
      const poster = vertical ? CFG.filmPosterVertical || CFG.filmPoster : CFG.filmPoster;
      if (poster && !AUTOPLAY) v.poster = poster;
      v.muted = true;
      v.defaultMuted = true;
      v.loop = true;
      v.playsInline = true;
      v.setAttribute('playsinline', '');
      v.preload = 'metadata';
      v.disablePictureInPicture = true;
      v.setAttribute('aria-label', 'The Bud film, 30 seconds');
      if (CFG.filmCaptions) {
        const tr = document.createElement('track');
        tr.kind = 'captions';
        tr.srclang = 'en';
        tr.label = 'English';
        tr.src = CFG.filmCaptions;
        tr.default = true;
        v.append(tr);
      }
      frame.append(v);
      frame.insertAdjacentHTML(
        'beforeend',
        `<button class="film-play" type="button"><span class="fp-ic">${ICON.play}</span><span class="fp-lbl">Play the film</span></button>
        <div class="film-ui">
          <button class="film-sound" type="button" aria-pressed="false">${ICON.mute.replace('<svg', '<svg class="ic-off"')}${ICON.sound.replace('<svg', '<svg class="ic-on"')}<span class="fs-lbl">Sound on</span></button>
          <button class="film-toggle" type="button">${ICON.pause.replace('<svg', '<svg class="ic-pause"')}${ICON.play.replace('<svg', '<svg class="ic-play"')}</button>
        </div>
        <div class="film-end">
          <button class="btn btn-line btn-sm" type="button" data-film-again>Watch again</button>
          <a class="btn btn-light btn-sm" href="#reserve" data-track="film_reserve"><span data-v="agent">Reserve Bud</span><span data-v="companion">Reserve yours</span></a>
        </div>
        <div class="film-progress" aria-hidden="true"><i></i></div>`
      );
      $('#filmSub').textContent = vertical
        ? 'One morning, one phone. Bud moves a meeting, asks before it acts, and changes its look.'
        : 'Sound on.';

      v.addEventListener('play', () => {
        frame.classList.add('started');
        frame.classList.remove('blocked', 'ended');
        vidUI();
        if (!vid.raf) vid.raf = requestAnimationFrame(vidLoop);
        if (!vid.played) {
          vid.played = true;
          track('film_play', { kind: 'film', vertical, sound: !v.muted });
        }
      });
      v.addEventListener('error', () => {
        if (!vid.copy || v.src !== vid.copy) return;
        vid.copyState = 'failed';
        v.src = vid.direct;
        if (!vid.held) vidPlay();
      });
      v.addEventListener('pause', vidUI);
      v.addEventListener('volumechange', vidUI);
      v.addEventListener('seeked', vidTick);
      v.addEventListener('ended', () => {
        // rest on the end card, not on the black of the last frame, under the replay buttons
        vid.done = true;
        if (v.duration > FILM_HOLD) v.currentTime = FILM_HOLD;
        frame.classList.add('ended');
        vidUI();
        track('film_complete', { kind: 'film', vertical, sound: !v.muted });
      });
      const soundOn = () => {
        track('film_sound_on', { kind: 'film', at: Math.round(v.currentTime) });
        vidPlay(true);
      };
      // a tap on the film turns the sound on first, then pauses and plays
      v.addEventListener('click', () => {
        if (v.muted) soundOn();
        else if (v.paused) vidPlay();
        else vidPause(true);
      });
      $('.film-sound', frame).addEventListener('click', () => {
        if (v.muted) soundOn();
        else {
          v.muted = true;
          v.loop = true;
        }
      });
      $('.film-toggle', frame).addEventListener('click', () => (v.paused ? vidPlay() : vidPause(true)));
      $('.film-play', frame).addEventListener('click', () => filmPlay({ restart: !vid.played }));
      $('[data-film-again]', frame).addEventListener('click', () => {
        v.currentTime = 0;
        vidPlay();
        track('film_replay', { kind: 'film' });
      });

      const list = $('#filmChapters');
      if (vertical && list) {
        list.innerHTML = CHAPTERS.map(
          (c) => `<li><button type="button"><span class="fc-t">${fmtTime(c.at)}</span><span class="fc-l">${c.label}</span><i class="fc-bar" aria-hidden="true"></i></button></li>`
        ).join('');
        list.hidden = false;
        $$('button', list).forEach((b, k) =>
          b.addEventListener('click', () => {
            vidSeek(CHAPTERS[k].at);
            track('film_chapter', { chapter: CHAPTERS[k].label });
          })
        );
        vidTick();
      }
      vidUI();
      filmFit();
      window.addEventListener('resize', filmFit, { passive: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(filmFit);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          vid.away = !v.paused;
          vidPause(false);
        } else if (vid.away) {
          vid.away = false;
          if (vid.shown) vidPlay();
        }
      });
    } else {
      film.bud = mountBud($('#animBud'), {}, { fps: 60 });
      $('#animTime').textContent = `0:00 / ${fmtTime(FILM_LEN)}`;
      $('#filmPlay').addEventListener('click', filmPlay);
      $('#film-title').textContent = 'Bud, out in the world.';
    }
    // "Watch the film" jumps straight to it (no long scroll) and plays it from the top with sound
    $$('[data-film-open]').forEach((b) =>
      b.addEventListener('click', () => {
        const sec = $('#film');
        sec.scrollIntoView({ block: sec.classList.contains('side') ? 'start' : 'center' });
        filmPlay({ restart: true });
      })
    );
  }

  /** Opened with a #section link (like the share link to #film): land on that section. */
  function jumpToHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    if (!/^[\w-]+$/.test(id)) return false;
    const el = document.getElementById(id);
    if (!el || el.tagName !== 'SECTION') return false;
    el.scrollIntoView({ block: 'start' });
    return true;
  }

  /* -------------------------------------------------------------- reserve */

  const refId = (() => {
    let id = store.get('bud.ref', '');
    if (!/^[a-z0-9]{8,16}$/.test(id)) {
      id = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
      store.set('bud.ref', id);
    }
    return id;
  })();
  function utm() {
    const q = query();
    const out = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => q.get(k) && (out[k] = q.get(k).slice(0, 120)));
    return out;
  }
  function checkoutUrl() {
    const link = String(CFG.stripePaymentLink || '').trim();
    if (!/^https:\/\//.test(link)) return '';
    try {
      const u = new URL(link);
      // ties the payment back to the landing variant (Stripe allows letters, digits, _ and -)
      u.searchParams.set('client_reference_id', `lp_${variant()}_${refId}`);
      const tags = utm();
      Object.keys(tags).forEach((k) => u.searchParams.set(k, tags[k]));
      return u.toString();
    } catch (e) {
      return '';
    }
  }
  function setupReserve() {
    const btn = $('#reserveBtn');
    const note = $('#reserveNote');
    mountBud($('#reserveBud'), { state: 'hello' }, { follow: true });
    setAura($('#reserveAura'), 'hello');
    if (checkoutUrl()) {
      btn.href = checkoutUrl();
      btn.rel = 'noopener';
      btn.addEventListener('click', () => (btn.href = checkoutUrl()));
      note.textContent = 'You will finish on a secure Stripe checkout page.';
    } else {
      btn.setAttribute('aria-disabled', 'true');
      btn.removeAttribute('href');
      btn.textContent = 'Reservations open soon';
      note.textContent = 'Join the list and we will email you the moment reservations open.';
    }

    const form = $('#waitForm');
    const msg = $('#waitMsg');
    const say = (text, kind) => {
      msg.textContent = text;
      msg.className = 'wait-msg' + (kind ? ' ' + kind : '');
    };
    if (store.get('bud.joined', false)) say('You’re on the list.', 'ok');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#waitEmail').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        say('Enter an email address, like name@example.com.', 'err');
        $('#waitEmail').focus();
        return;
      }
      const interest = $('#waitInterest').value || null;
      track('waitlist_submit', { interest });
      if (!CFG.waitlistEndpoint) {
        say('You’re on the list. (This is a preview, so nothing was sent.)', 'ok');
        store.set('bud.joined', true);
        form.reset();
        return;
      }
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const r = await fetch(CFG.waitlistEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, interest, variant: variant(), utm: utm(), ts: new Date().toISOString() }),
        });
        if (!r.ok) throw new Error(String(r.status));
        say('You’re on the list. We will email you first.', 'ok');
        store.set('bud.joined', true);
        form.reset();
      } catch (err) {
        say('That did not go through. Check your connection and try again.', 'err');
      } finally {
        submit.disabled = false;
      }
    });
  }

  /* ---------------------------------------------------------- the rest */

  // Visibility is checked on scroll rather than with IntersectionObserver, which misses
  // instant jumps (nav links, #section links) inside the claude.ai frame.
  const watchers = [];
  /** Call `cb(visible)` whenever `el` comes into or leaves view (`share`: how much of it must show). */
  function watchVisible(el, cb, share) {
    if (el) watchers.push({ el, cb, share: share || 0, vis: null });
  }
  function watchScroll() {
    const h = window.innerHeight;
    watchers.forEach((w) => {
      const r = w.el.getBoundingClientRect();
      const seen = Math.min(r.bottom, h) - Math.max(r.top, 0);
      const vis = r.height > 0 && seen > 0 && seen >= w.share * Math.min(r.height, h);
      if (vis !== w.vis) {
        w.vis = vis;
        w.cb(vis);
      }
    });
  }

  // Sections fade up as they come into view. Checked on scroll rather than with an
  // IntersectionObserver, which misses instant jumps inside the claude.ai frame. A jump past
  // a section reveals it too, so nothing is left hidden above.
  let unrevealed = [];
  function setupReveal() {
    if (REDUCED) return;
    unrevealed = $$('.rv').filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.95);
    unrevealed.forEach((el) => el.classList.add('pre'));
  }
  function revealScroll() {
    if (!unrevealed.length) return;
    const line = window.innerHeight * 0.92;
    unrevealed = unrevealed.filter((el) => {
      if (el.getBoundingClientRect().top >= line) return true;
      el.classList.remove('pre');
      return false;
    });
  }

  function setupVariantSwitch() {
    const sw = $('#vswitch');
    if (!(IN_ARTIFACT || query().has('preview'))) return;
    sw.hidden = false;
    const paint = () => $$('[data-set-variant]', sw).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setVariant === variant())));
    $$('[data-set-variant]', sw).forEach((b) =>
      b.addEventListener('click', () => {
        root.dataset.variant = b.dataset.setVariant;
        store.set('bud.variant', b.dataset.setVariant);
        paint();
        heroRun(false);
        track('variant_preview');
      })
    );
    paint();
  }

  let ticking = false;
  function onScroll() {
    ticking = false;
    nav.classList.toggle('scrolled', window.scrollY > 8);
    nav.classList.toggle('show-bud', $('#top').getBoundingClientRect().bottom < 90);
    const cue = $('#scrollCue');
    if (cue) cue.classList.toggle('gone', window.scrollY > 40);
    const nb = nav.getBoundingClientRect().bottom;
    const under = document.elementFromPoint(window.innerWidth / 2, nb + 2);
    let paper = !!(under && under.closest && under.closest('.paper'));
    // the top of the flip chapter is still dark (it fades up from black), so keep the dark bar there
    const op = OP.sec && OP.sec.getBoundingClientRect();
    if (paper && op && nb >= op.top && nb - op.top < window.innerHeight * 0.34) paper = false;
    nav.classList.toggle('on-paper', paper);
    if (OP.sec) onphoneScroll();
    storyScroll();
    filmAuto();
    revealScroll();
    watchScroll();
  }

  function boot() {
    applyConfig();
    track('experiment_impression', { experiment: 'lp_positioning' });
    navBud = new K.Screen($('#navBud'), { fps: 30, bloom: false });
    navBud.set({ character: 'eyes', theme: 'classic', state: 'idle', oled: true, glow: false, shape: { type: 'circle' }, stage: {}, variety: !REDUCED });
    setupHero();
    setupOnphone();
    setupStory();
    setupUses();
    setupPrivacy();
    setupYours();
    setupDialog();
    setupFilm();
    setupReserve();
    setupVariantSwitch();
    setupReveal();
    $$('.faq-list details').forEach((d) =>
      d.addEventListener('toggle', () => d.open && track('faq_open', { question: d.querySelector('summary').textContent }))
    );
    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(onScroll);
        }
      },
      { passive: true }
    );
    window.addEventListener('resize', onScroll, { passive: true });
    if (jumpToHash()) {
      // fonts, images and the host resizing this frame (the 3D chapter above is 4.2 screens tall)
      // can still shift the layout: land again as it settles, until the visitor scrolls on their own
      let moved = false;
      const again = () => !moved && jumpToHash();
      const mine = () => {
        moved = true;
        window.removeEventListener('resize', again);
      };
      ['wheel', 'touchstart', 'keydown', 'mousedown'].forEach((e) => window.addEventListener(e, mine, { once: true, passive: true }));
      window.addEventListener('resize', again, { passive: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(again);
      window.addEventListener('load', () => {
        again();
        setTimeout(again, 400);
      }, { once: true });
    }
    onScroll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
