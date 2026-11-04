/* The app scenes: the Bud app's real screens (light theme) in an iPhone, playing one short scene per
 * chip: agents doing real work (Muse, Dots, Duet, and Duet talking with friends' Buds), the
 * walkie-talkie with a friend, a find on the Discover map, and a change of look. Scenes advance on
 * their own while the section is on screen; a chip jumps to its scene, and the buttons inside the
 * phone can be tapped (they tap themselves if nobody does). Every Bud is a live K.Screen. */
(function () {
  'use strict';
  const K = window.Bud;
  const ICONS = window.BUD_ICONS || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = $('#scenes');
  if (!root || !K) return;
  const app = $('#appScreen', root);

  // icons: <i class="ico" data-i="name">
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const ico = (name) => `<i class="ico">${icon(name)}</i>`;
  $$('[data-i]', root).forEach((i) => { if (!i.firstChild) i.innerHTML = icon(i.dataset.i); });

  /* ------------------------------------------------------------- live faces */
  const BASE = { character: 'eyes', base: 'eyes', pack: 'lantern', theme: 'classic', acc: {}, ambient: null, state: 'idle',
    oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: !REDUCED };
  const lookCfg = (id) => (id ? { character: 'skins', base: 'eyes', pack: id } : { character: 'eyes', theme: 'classic', acc: {}, ambient: null });
  const faces = new Map();
  function face(el, look, fps) {
    if (faces.has(el)) return faces.get(el);
    const host = el.querySelector('.bud-screen') || el;
    const scr = new K.Screen(host, { fps: fps || 30, bloom: true });
    scr.set(Object.assign({}, BASE, lookCfg(look || '')));
    faces.set(el, scr);
    return scr;
  }
  const wake = (el) => $$('.mini', el).forEach((m) => face(m, m.dataset.look, 30));
  // friends' Buds inside chat cards: one element each, moved into every new card, so replays make no new Screens
  const pool = {};
  function friendBud(look) {
    if (!pool[look]) {
      const d = document.createElement('div');
      d.className = 'mini'; d.innerHTML = '<span class="bud-screen"></span>';
      pool[look] = d;
    }
    return pool[look];
  }

  /* ------------------------------------------------------------- Buds around the phone */
  const FLOAT = [
    // look, size, x from the stage's center, y, extra class
    ['party', 210, -370, 30, 'front'], ['kitty', 156, -290, 380, ''], ['dj', 116, -560, 230, 'blur hide-sm'],
    ['shades', 180, 310, 0, ''], ['study', 220, 372, 320, 'front'], ['winter', 120, 590, 170, 'blur hide-sm'],
  ];
  const floaters = $('#floaters', root);
  FLOAT.forEach(([look, d, x, y, cls], i) => {
    const f = document.createElement('div');
    f.className = `floater ${cls}`;
    f.style.cssText = `left:calc(50% + ${x}px - ${d / 2}px);top:${y}px`;
    f.innerHTML = `<div class="bud" style="--d:${d}px;animation-delay:${-i * 0.9}s" data-look="${look}"><span class="bud-glass"><span class="bud-screen"></span></span></div>`;
    floaters.appendChild(f);
    const scr = face(f.firstChild, look, 24);
    f.addEventListener('pointerenter', () => scr.set({ state: 'love' }));
    f.addEventListener('pointerleave', () => scr.set({ state: 'idle' }));
  });
  const floatFaces = () => $$('.floater .bud', root).map((b) => faces.get(b));
  function cheer(state = 'love', ms = 1800) {
    floatFaces().forEach((s, i) => setTimeout(() => { s.set({ state }); setTimeout(() => s.set({ state: 'idle' }), ms); }, i * 110));
  }
  // a little parallax as the section scrolls by
  function parallax() {
    const r = root.getBoundingClientRect();
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    $$('.floater', root).forEach((f, i) => { f.style.transform = `translateY(${p * (i % 2 ? 60 : -50) * (f.classList.contains('blur') ? 0.6 : 1)}px)`; });
  }
  if (!REDUCED) addEventListener('scroll', parallax, { passive: true });
  parallax();

  /* ------------------------------------------------------------- the phone's scale */
  const clip = $('.screen-clip', root);
  const fit = () => app.style.setProperty('--k', String(clip.clientWidth / 390));
  new ResizeObserver(fit).observe(clip);
  fit();

  /* ------------------------------------------------------------- the engine */
  let token = 0;
  class Cancel extends Error {}
  const sleep = (my, ms) => new Promise((ok, no) => setTimeout(() => (my === token ? ok() : no(new Cancel())), REDUCED ? Math.min(ms, 300) : ms));

  // one screen at a time; the others fade out, then leave the layout so their Buds stop drawing
  function show(screen) {
    $$('.scr', app).forEach((s) => {
      const on = s.dataset.screen === screen;
      clearTimeout(s._off);
      if (on) { s.hidden = false; void s.offsetWidth; s.classList.add('on'); } else if (s.classList.contains('on')) {
        s.classList.remove('on');
        s._off = setTimeout(() => { s.hidden = true; }, 400);
      } else s.hidden = true;
    });
    $$('.tabbar i', app).forEach((t) => t.classList.toggle('on', t.dataset.tab === screen));
    wake($(`.scr[data-screen="${screen}"]`, app));
  }

  // the fingertip: to an element's center, in the app's own (unscaled) coordinates
  const finger = $('#finger', app);
  // (from layout offsets, which leave out transforms, so a sheet still sliding up or a card still
  // popping in gives where the button will rest)
  function at(el) {
    let x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
    while (n && n !== app) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    if (n === app) return [x, y];
    const a = app.getBoundingClientRect(), r = el.getBoundingClientRect(), k = a.width / 390;
    return [(r.left + r.width / 2 - a.left) / k, (r.top + r.height / 2 - a.top) / k];
  }
  async function tap(my, el, hold = 0) {
    const [x, y] = at(el);
    finger.style.left = `${x}px`; finger.style.top = `${y + 14}px`;
    finger.classList.add('on');
    await sleep(my, 260);
    finger.style.top = `${y}px`;
    await sleep(my, 220);
    finger.classList.add('down'); el.classList.add('tap', 'press');
    await sleep(my, hold || 160);
    finger.classList.remove('down'); el.classList.remove('tap', 'press');
    await sleep(my, 120);
    finger.classList.remove('on');
  }
  // buttons inside the phone that the visitor can tap; `el` taps itself after `ms` if nobody does
  function choose(my, el, ms) {
    return new Promise((ok, no) => {
      const box = el.parentElement || el;
      let done = false;
      const end = () => { done = true; box.removeEventListener('click', onClick); };
      const go = () => { if (!done) { end(); ok(); } };
      const onClick = (e) => { if (e.target.closest('button')) go(); };
      box.addEventListener('click', onClick);
      sleep(my, ms).then(() => (done ? 0 : tap(my, el).then(go))).catch((e) => { end(); no(e); });
    });
  }

  /* ---- the Bud tab: a chat */
  const chat = $('#chat', app);
  const appBud = $('#appBud', app);
  const status = $('#budStatus', app);
  const budMic = $('#budMic', app);
  const budFace = () => face(appBud, '', 30);
  const IDLE = 'Bud is on your phone · tap Bud to talk';
  function resetChat(look = '') {
    chat.innerHTML = '';
    budFace().set(Object.assign({ state: 'idle' }, lookCfg(look)));
    status.textContent = IDLE;
    budMic.classList.remove('hold');
  }
  const mood = (state, text) => { budFace().set({ state }); status.textContent = text || IDLE; };
  // drop messages that have scrolled far above the top (offsets, since the pop-in transform would
  // count toward scrollHeight and empty the chat)
  function trim() {
    const k = chat.children;
    while (k.length > 1 && k[k.length - 1].offsetTop + k[k.length - 1].offsetHeight - k[1].offsetTop > chat.clientHeight) chat.removeChild(k[0]);
  }
  function add(html, cls) {
    const el = document.createElement('div');
    el.className = cls; el.innerHTML = html;
    chat.appendChild(el);
    trim();
    return el;
  }
  const said = (t) => add(`<span class="said">${ico('mic.fill')}Said to Bud</span><br>${t}`, 'msg you');
  const budSays = (t) => add(t, 'msg ai');
  const typing = () => add('<i></i><i></i><i></i>', 'typing');
  // a message from a friend's Bud
  function fromFriend(look, who, text) {
    const el = add(`<span class="slot"></span><span class="bb"><b>${who}</b>${text}</span>`, 'fmsg');
    const b = friendBud(look);
    $('.slot', el).replaceWith(b);
    const f = face(b, look, 24);
    f.set({ state: 'speaking' }); setTimeout(() => f.set({ state: 'idle' }), 1200);
    return el;
  }
  async function speak(my, words) { // holding Bud to talk: listening while the words come in
    mood('listening', 'Listening…');
    budMic.classList.add('hold');
    await sleep(my, 700);
    said(words);
    await sleep(my, 650);
    budMic.classList.remove('hold');
    mood('thinking', 'Thinking…');
    const t = typing();
    await sleep(my, 800);
    t.remove();
  }
  // an agent's card in the chat
  function card(agent, color, initial, inner, st) {
    const el = add(`<div class="who"><span class="dot">${initial}</span>${agent}<span class="st">${st}</span></div>${inner}`, 'task');
    el.style.setProperty('--a', color);
    return el;
  }
  function state(el, st, cls) {
    $('.st', el).innerHTML = st;
    el.classList.remove('ask', 'done');
    if (cls) el.classList.add(cls);
  }
  const LIVE = (t) => `<b class="live"></b>${t}`;

  /* ---- the scenes */
  const SCENES = {
    async muse(my) {
      show('bud'); resetChat();
      await sleep(my, 400);
      await speak(my, 'Plan me four days in Paris next month. Flights, a hotel, all of it.');
      budSays('Ooh, Paris! Asking Muse.');
      await sleep(my, 600);
      mood('working', 'Muse is browsing…');
      const b = card('Muse', '#4f6bed', 'M', `<div class="browser"><div class="url">${ico('magnifyingglass')}<span>Flights to Paris</span></div>
        <div class="page"><i class="pg-hero"></i><i class="l" style="width:78%"></i><i class="l" style="width:54%"></i><div class="ths"><i></i><i></i><i></i></div></div></div>`,
      LIVE('Browsing · <span class="clock">0:00</span>'));
      const url = $('.url span', b), page = $('.page', b);
      const PAGES = [['Flights to Paris', '#dcebff', '✈️'], ['Hotels in the Marais', '#efdcff', '🏨'], ['Louvre timed tickets', '#ffe6cc', '🖼️'],
        ['Paris weather next month', '#fff0bf', '🌤️'], ['Best croissants near your hotel', '#dff5e8', '🥐']];
      const hero = $('.pg-hero', b);
      for (let s = 0; s < PAGES.length; s++) {
        url.textContent = PAGES[s][0]; hero.style.background = PAGES[s][1]; hero.textContent = PAGES[s][2];
        $('.clock', b).textContent = `0:0${s + 1}`;
        page.classList.remove('flip'); void page.offsetWidth; page.classList.add('flip');
        await sleep(my, 760);
      }
      state(b, 'Done · 0:05', 'done');
      const p = card('Muse', '#4f6bed', 'M', `<h4>Your four days in Paris</h4><div class="trip">
        <div class="tr"><span class="te">✈️</span><div><b>Thursday evening, nonstop</b><span>Back Monday afternoon</span></div></div>
        <div class="tr"><span class="te">🏨</span><div><b>A small hotel in the Marais</b><span>Walk to almost everything</span></div></div>
        <div class="tr"><span class="te">🖼️</span><div><b>Fri · The Louvre, then the Tuileries</b><span>Timed tickets, so no line</span></div></div>
        <div class="tr"><span class="te">🎨</span><div><b>Sat · Montmartre and a cooking class</b><span>Crêpes, of course</span></div></div>
        <div class="tr"><span class="te">⛵</span><div><b>Sun · Musée d’Orsay, a Seine cruise at sunset</b><span>Your last night</span></div></div></div>
        <div class="acts"><button>Change dates</button><button class="go">Add to calendar</button></div>`, 'Planned');
      status.textContent = IDLE;
      await choose(my, $('.go', p), 2600);
      $('.acts', p).outerHTML = `<div class="ok">${ico('checkmark')}On your calendar · saved to Notes</div>`;
      await sleep(my, 700);
      budFace().set({ character: 'eyes', theme: 'sakura', acc: { head: 'beret', item: 'croissant' }, ambient: 'sparkles', state: 'love' });
      add('Bud packed its beret for Paris', 'note');
      cheer();
      await sleep(my, 1100);
      budSays('Paris next month! It’s all on your calendar, and I’m bringing my beret.');
      await sleep(my, 2000);
      budFace().set({ state: 'idle' });
    },
    async dots(my) {
      show('bud'); resetChat();
      await sleep(my, 400);
      await speak(my, 'Go through my unread emails and handle what you can');
      budSays('On it. Sending it to your Dot.');
      await sleep(my, 600);
      mood('working', 'Your Dot is working…');
      const c = card('Dots', '#111214', 'D', '<h4>Going through 11 unread</h4><div class="inbox"></div>', LIVE('Working'));
      const box = $('.inbox', c);
      const MAIL = [
        ['📰', '#eceef2', '7 newsletters', 'Weekly digests and deals', 'Archived', ''],
        ['✈️', '#e6f2ff', 'Your flight to Seattle', 'Confirmation · Fri 8:15 AM', 'On your calendar', 'blue'],
        ['S', '#d6418c', 'Sarah', 'Can we move our sync to Thursday?', 'Reply drafted', 'teal'],
        ['L', '#a87800', 'Landlord', 'Rent reminder for November', 'Reply drafted', 'teal'],
        ['J', '#0e8f82', 'Jae', 'Party at mine Saturday??', 'Reply drafted', 'teal'],
      ];
      for (const [av, bg, who, what, tag, tone] of MAIL) {
        const r = document.createElement('div');
        r.className = 'mail';
        r.innerHTML = `<span class="av" style="background:${bg}">${av}</span><div class="mt"><b>${who}</b><span>${what}</span></div><em class="tag wait"><i></i><i></i><i></i></em>`;
        box.appendChild(r); trim();
        await sleep(my, 430);
        const t = $('.tag', r); t.textContent = tag; t.className = `tag ${tone}`;
        await sleep(my, 260);
      }
      await sleep(my, 500);
      state(c, 'Needs you', 'ask');
      mood('needsyou', 'Your Dot needs your OK');
      $('h4', c).textContent = '3 replies, written like you';
      box.innerHTML = `<div class="draft"><small>To Sarah</small>Thursday works! I’ll bring the slides.</div>
        <div class="draft"><small>To your landlord</small>Paid this morning. Thanks for the reminder!</div>
        <div class="draft"><small>To Jae</small>Haha yes, count me in 🎉</div>`;
      const acts = document.createElement('div');
      acts.className = 'acts'; acts.innerHTML = '<button>Review</button><button class="go">Send all</button>';
      c.appendChild(acts); trim();
      await choose(my, $('.go', acts), 2600);
      mood('working', 'Sending…');
      acts.outerHTML = `<div class="ok sending">${ico('arrow.up')}Sending…</div>`;
      await sleep(my, 900);
      state(c, 'Done', 'done');
      $('h4', c).textContent = 'Inbox zero 🎉';
      box.innerHTML = '<div class="sum"><span><b>3</b>replied</span><span><b>7</b>archived</span><span><b>1</b>flight on your calendar</span></div>';
      $('.ok', c).remove();
      mood('done');
      await sleep(my, 600);
      budSays('Inbox zero! I answered Sarah, your landlord and Jae, and your flight is on your calendar.');
      budFace().set({ state: 'love' });
      await sleep(my, 2000);
      budFace().set({ state: 'idle' });
    },
    async duet(my) {
      show('bud'); resetChat();
      await sleep(my, 400);
      await speak(my, 'Plan a surprise dinner for Mina’s birthday with Henry and Jae');
      budSays('Love it! Duet will check with Henry’s and Jae’s Buds.');
      await sleep(my, 600);
      mood('working', 'Duet is talking with your friends’ Buds…');
      const c = card('Duet', '#d97757', 'D', '<h4>Talking with friends’ Buds</h4><div class="a2a"></div>', LIVE('Live'));
      const a = $('.a2a', c);
      const line = (look, who, text) => {
        const m = document.createElement('div');
        m.className = `am ${look ? 'them' : 'me'}`;
        m.innerHTML = look ? `<span class="slot"></span><span class="bb"><b>${who}</b>${text}</span>` : `<span class="bb">${text}</span>`;
        a.appendChild(m);
        if (look) {
          const b = friendBud(look);
          $('.slot', m).replaceWith(b);
          const f = face(b, look, 24);
          f.set({ state: 'speaking' }); setTimeout(() => f.set({ state: 'idle' }), 1100);
        }
        trim();
      };
      line('', '', 'Planning a surprise dinner for Mina’s birthday. Is Friday at 7:30 good?');
      await sleep(my, 1100);
      line('shades', 'Henry’s Bud', 'Henry’s free Friday! He’ll bring the card.');
      await sleep(my, 1100);
      line('party', 'Jae’s Bud', 'Jae can make 7:30. Mina loves the pasta place in the North End.');
      await sleep(my, 1100);
      state(c, 'Everyone’s in', 'done');
      const b = card('Duet', '#d97757', 'D', `<h4>Mina’s birthday dinner</h4><div class="rows">
        <div><span>When</span><b>Friday · 7:30 PM</b></div><div><span>Where</span><b>Her favorite pasta place</b></div>
        <div><span>Table</span><b>4 · you, Henry, Jae, Mina</b></div><div><span>Dessert</span><b>A cake with candles 🎂</b></div></div>
        <div class="acts"><button>Change</button><button class="go">Book it</button></div>`, 'Needs you');
      b.classList.add('ask');
      mood('needsyou', 'Duet needs your OK');
      await choose(my, $('.go', b), 2600);
      mood('working', 'Booking…');
      $('.acts', b).outerHTML = `<div class="ok sending">${ico('clock')}Booking…</div>`;
      await sleep(my, 900);
      state(b, 'Done', 'done');
      $('h4', b).textContent = 'Booked 🤫';
      $('.ok', b).innerHTML = `${ico('checkmark')}Henry and Jae invited · Mina doesn’t know`;
      $('.ok', b).classList.remove('sending');
      mood('done');
      await sleep(my, 600);
      budSays('All set for Friday! Henry and Jae are in, and Mina has no idea.');
      budFace().set({ state: 'love' });
      cheer('love', 1500);
      await sleep(my, 2000);
      budFace().set({ state: 'idle' });
    },
    async walkie(my) {
      show('friends');
      const sheet = $('#sheet', app), sh = $('#shChat', app), pill = $('#holdPill', app), mic = $('#shMic', app);
      sheet.classList.remove('up', 'holding'); sh.innerHTML = ''; pill.classList.remove('on'); mic.classList.remove('hold');
      const mina = face($('#sheetFace', app), 'kitty', 30);
      mina.set({ state: 'idle' });
      await sleep(my, 1000);
      await tap(my, $('.fr-row', app), 220);
      sheet.classList.add('up');
      const line = (html, cls) => { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; sh.appendChild(el); return el; };
      const wf = () => `<span class="wf">${[6, 12, 18, 10, 22, 14, 8, 16, 20, 12, 7, 15, 10, 6].map((h, i) => `<i style="height:${h}px;animation-delay:${-i * 0.07}s"></i>`).join('')}</span>`;
      line('Mina · 2:05 PM', 'from');
      line('Are you at the park yet?', 'msg them');
      line('Almost there!', 'msg you');
      await sleep(my, 1300);
      // hold to talk, like Bud's own button
      const [x, y] = at(mic);
      finger.style.left = `${x}px`; finger.style.top = `${y}px`; finger.classList.add('on');
      await sleep(my, 300);
      finger.classList.add('down'); mic.classList.add('hold'); pill.classList.add('on'); sheet.classList.add('holding');
      for (let s = 1; s <= 3; s++) { $('#holdTime', app).textContent = `0:0${s}`; await sleep(my, 700); }
      finger.classList.remove('down', 'on'); mic.classList.remove('hold'); pill.classList.remove('on'); sheet.classList.remove('holding');
      line(`${ico('play.fill')}${wf()}<span class="len">0:03</span>`, 'voice mine');
      await sleep(my, 1100);
      mina.set({ state: 'love' });
      line(`${ico('hand.wave.fill')}Mina’s Bud waved back`, 'waved');
      cheer('hello', 1300);
      await sleep(my, 1200);
      line('Mina · now', 'from');
      const v = line(`${ico('stop.fill')}${wf()}<span class="len">0:04</span>`, 'voice them playing');
      mina.set({ state: 'speaking' });
      await sleep(my, 2600);
      v.classList.remove('playing'); mina.set({ state: 'idle' });
      await sleep(my, 1200);
    },
    async discover(my) {
      show('discover');
      const me = $('#pinMe', app), found = $('#found', app), piece = $('#piece', app);
      me.style.left = '200px'; me.style.top = '600px';
      found.classList.remove('up'); piece.style.display = '';
      $('#dcCount', app).textContent = '2'; $('#dcWeek', app).textContent = '1';
      $('button', found).textContent = 'Wear it';
      const meFace = face($('.mini', me), '', 30);
      meFace.set(Object.assign({ state: 'idle' }, lookCfg('')));
      await sleep(my, 1100);
      meFace.set({ state: 'hello' });
      me.style.left = '262px'; me.style.top = '372px';
      await sleep(my, 2600);
      piece.style.display = 'none';
      const conf = $('#confetti', app); conf.innerHTML = '';
      const cols = ['#d6418c', '#4aa8ff', '#ffc83d', '#0e8f82', '#a78bfa'];
      for (let i = 0; i < 34; i++) {
        const c = document.createElement('i');
        c.style.cssText = `left:${150 + Math.random() * 230}px;top:${250 + Math.random() * 60}px;background:${cols[i % 5]};--dx:${(Math.random() - 0.5) * 160}px;animation-delay:${Math.random() * 0.25}s`;
        conf.appendChild(c);
      }
      const ff = face($('.mini', found), '', 30);
      ff.set(Object.assign({}, BASE, { acc: { head: 'beret' }, state: 'love' }));
      found.classList.add('up');
      $('#dcCount', app).textContent = '3'; $('#dcWeek', app).textContent = '2';
      cheer();
      await choose(my, $('button', found), 2400);
      meFace.set(Object.assign({}, BASE, { acc: { head: 'beret' }, state: 'love' }));
      $('button', found).textContent = 'Wearing it';
      await sleep(my, 2400);
      meFace.set({ state: 'idle' });
    },
    async looks(my) {
      show('looks');
      const hero = face($('#lkHero', app), '', 30), name = $('#lkName', app), halo = $('#lkHalo', app);
      const pick = (btn) => {
        $$('.lk-grid button', app).forEach((b) => b.classList.toggle('on', b === btn));
        hero.set(Object.assign({ state: 'love' }, lookCfg(btn.dataset.look)));
        name.textContent = btn.dataset.name;
        halo.style.background = `radial-gradient(closest-side, ${btn.dataset.glow}, rgba(255,255,255,0) 75%)`;
        setTimeout(() => hero.set({ state: 'idle' }), 1600);
      };
      looksPick = pick;
      pick($('.lk-grid button', app));
      for (const look of ['party', 'dj', 'halloween', 'kitty']) {
        await sleep(my, 1600);
        const b = $(`.lk-grid button[data-look="${look}"]`, app);
        await tap(my, b);
        pick(b);
        cheer('love', 1200);
      }
      await sleep(my, 1800);
    },
  };
  const ORDER = ['muse', 'dots', 'duet', 'walkie', 'discover', 'looks'];
  const DUR = { muse: 16000, dots: 16500, duet: 17000, walkie: 12500, discover: 11500, looks: 11000 };
  let looksPick = null;

  // the Looks grid works for visitors too
  $$('.lk-grid button', app).forEach((b) => b.addEventListener('click', () => looksPick && looksPick(b)));

  /* ---- the chips: a looping row that keeps the playing scene in the middle, with its progress */
  const row = $('.chiprow', root);
  const base = $$('.chip', row);
  const N = base.length;
  const track = document.createElement('div');
  track.className = 'chiptrack';
  row.appendChild(track);
  const clone = (c) => { const k = c.cloneNode(true); k.setAttribute('aria-hidden', 'true'); k.tabIndex = -1; k.removeAttribute('role'); return k; };
  base.map(clone).forEach((k) => track.appendChild(k));
  base.forEach((c) => track.appendChild(c));
  base.map(clone).forEach((k) => track.appendChild(k));
  const all = $$('.chip', track);
  let pos = N;
  function center(j, animate) {
    const c = all[j];
    track.style.transition = animate && !REDUCED ? 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    track.style.transform = `translateX(${row.clientWidth / 2 - (c.offsetLeft + c.offsetWidth / 2)}px)`;
    pos = j;
  }
  // after gliding onto a copy, jump back to the same chip in the middle set (they look the same)
  track.addEventListener('transitionend', (e) => { if (e.target === track && (pos < N || pos >= 2 * N)) center(N + (pos % N), false); });
  new ResizeObserver(() => center(pos, false)).observe(row);

  let current = 0, inView = false;
  function play(i) {
    const my = ++token;
    current = i;
    finger.classList.remove('on', 'down');
    const near = [i, N + i, 2 * N + i].sort((p, q) => Math.abs(p - pos) - Math.abs(q - pos))[0];
    center(near, true);
    all.forEach((c, j) => {
      const on = j % N === i;
      c.classList.toggle('on', on);
      if (j >= N && j < 2 * N) c.setAttribute('aria-selected', String(on));
      const f = $('.fill', c);
      f.style.transition = 'none'; f.style.width = '0%';
      if (on) { void f.offsetWidth; f.style.transition = `width ${DUR[ORDER[i]]}ms linear`; f.style.width = '100%'; }
    });
    const t0 = performance.now();
    SCENES[ORDER[i]](my)
      .then(() => sleep(my, Math.max(500, DUR[ORDER[i]] - (performance.now() - t0))))
      .then(() => { if (my === token && inView) play((i + 1) % N); })
      .catch((e) => { if (!(e instanceof Cancel)) console.warn(e); });
  }
  let swiped = false;
  const log = (e, d) => window.budTrack && window.budTrack(e, d);
  all.forEach((c, j) => c.addEventListener('click', () => { if (!swiped) { play(j % N); log('scene_pick', { scene: ORDER[j % N] }); } }));
  // swipe the row to step through
  let sx = null;
  row.addEventListener('pointerdown', (e) => { sx = e.clientX; swiped = false; });
  row.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) > 40) { swiped = true; play((current + (dx < 0 ? 1 : N - 1)) % N); setTimeout(() => { swiped = false; }, 50); }
  });
  new IntersectionObserver((es) => {
    const was = inView;
    inView = es[es.length - 1].isIntersecting;
    if (inView && !was) play(current);
    if (!inView && was) token++;
  }, { threshold: 0.25 }).observe($('.stage', root));
  show('bud');
  center(N, false);
})();
