/* The pose engine: poses, the baseline each state's file fills in, blends, and the runners for
 * idle fidgets and designed transitions. The states are in lib/states/ (one file each), the
 * fidgets in fidgets.js and the transitions in transitions.js.
 *
 * Every state is a seamless loop of `loop` seconds. A pose is a plain object of
 * numbers (eye openness, squash, look direction, effect intensities...). Each state's
 * baseline motion lives in its file; each character then adds its own flavor in
 * character.pose(). Because poses are pure functions of state time, the same
 * code can later export firmware sprite loops frame by frame (Task 3).
 */
(function (K) {
  'use strict';
  const U = K.util;

  K.STATE_GROUPS = ['Conversation', 'Agent', 'Moments', 'Device'];

  // Story: a scripted scenario with captions (also the landing page's storyboard).
  K.STORY = [
    { state: 'hello', dur: 2.4, caption: 'Tap. "Hi, I\'m {name}."' },
    { state: 'listening', dur: 2.8, caption: '"Move my 3pm with Sam to tomorrow."' },
    { state: 'thinking', dur: 1.8, caption: 'Thinking it through.' },
    { state: 'working', dur: 2.8, caption: 'Checking both calendars.' },
    { state: 'needsyou', dur: 2.6, caption: '"Sam is free at 11 or 2. Which one?"' },
    { state: 'listening', dur: 1.8, caption: '"11 is perfect."' },
    { state: 'speaking', dur: 2.4, caption: '"Done. Moved to 11 tomorrow."' },
    { state: 'done', dur: 2.2, caption: 'Invite sent.' },
    { state: 'love', dur: 2.2, caption: '"Thanks, {name}."' },
    { state: 'idle', dur: 2.4, caption: '' },
  ];

  K.DEMOS = {
    core: { label: 'Core loop', steps: [['idle', 2.6], ['listening', 3.0], ['thinking', 2.6], ['speaking', 3.0], ['done', 2.8]] },
    story: { label: 'Story', steps: K.STORY.map((s) => [s.state, s.dur, s.caption]) },
    all: { label: 'All states', steps: K.STATES.map((s) => [s.id, 2.6]) },
    moves: {
      label: 'Transitions',
      steps: [['idle', 2.2], ['hello', 2.2], ['listening', 2.4], ['thinking', 2.6], ['speaking', 2.6], ['done', 2.6], ['working', 2.6], ['done', 2.6], ['recording', 2.4], ['done', 2.6], ['love', 2.2], ['charging', 2.4], ['privacy', 2.4], ['idle', 2.0], ['sleeping', 3.0], ['idle', 2.0], ['needsyou', 2.4], ['lowbattery', 2.6]],
    },
  };

  /* ------------------------------------------------------------------ poses */

  const DEFAULTS = {
    x: 0, y: 0, sx: 1, sy: 1, rot: 0,
    eyeOpen: 1, closed: 0, happy: 0, sleepy: 0, squint: 0, wide: 0, asym: 0,
    eyeL: 1, eyeR: 1, heart: 0, winkL: 0, winkR: 0,
    lookX: 0, lookY: 0, sparkle: 1,
    mouthOpen: 0, mouthCurve: 0.4, mouthX: 0, wobble: 0,
    blush: 0.55, brow: 0, browTilt: 0,
    tintAmt: 0, glow: 0.5, bright: 1, desat: 0,
  };
  const KEYS = Object.keys(DEFAULTS);

  function create(state, tt) {
    const p = Object.assign({}, DEFAULTS);
    p.state = state;
    p.tt = tt;
    p.loopT = 0;
    p.tintKey = null;
    p.tint = null;
    p.ex = {};
    p.fx = {};
    return p;
  }

  /** Shared baseline for a state at state-time tt (seconds since the state started). */
  function base(state, tt) {
    const L = K.state(state).loop;
    const x = ((tt % L) + L) % L;
    const p = create(state, tt);
    p.loopT = x;

    // each state's own motion is in its file (lib/states/<id>.js)
    const own = K.stateParts(state).base;
    if (own) own(p, tt, L, x);
    return p;
  }

  function mixObj(a, b, k) {
    const o = {};
    for (const key in a) o[key] = key in b ? a[key] + (b[key] - a[key]) * k : a[key] * (1 - k);
    for (const key in b) if (!(key in a)) o[key] = b[key] * k;
    return o;
  }

  /** Blend two poses (k = 0 gives a, 1 gives b). Used for smooth state changes. */
  function blend(a, b, k) {
    if (k >= 1) return b;
    if (k <= 0) return a;
    const o = create(k < 0.5 ? a.state : b.state, k < 0.5 ? a.tt : b.tt);
    o.loopT = k < 0.5 ? a.loopT : b.loopT;
    for (let i = 0; i < KEYS.length; i++) {
      const key = KEYS[i];
      o[key] = a[key] + (b[key] - a[key]) * k;
    }
    o.tintKey = k < 0.5 ? a.tintKey : b.tintKey;
    o.tint = U.mix(a.tint, b.tint, k);
    o.ex = mixObj(a.ex, b.ex, k);
    o.fx = mixObj(a.fx, b.fx, k);
    return o;
  }

  function clone(p) {
    const o = Object.assign({}, p);
    o.ex = Object.assign({}, p.ex);
    o.fx = Object.assign({}, p.fx);
    o.tint = p.tint ? p.tint.slice() : p.tint;
    return o;
  }

  /* ---------------------------------------------------------------- fidgets */

  K.fidget = (id) => K.FIDGETS.find((f) => f.id === id) || null;
  const FIDGET_START = 0.6; // seconds into an idle loop

  /** The fidget playing at idle time tt for a screen with this seed, or null. */
  function fidgetAt(tt, seed) {
    const L = K.state('idle').loop;
    const n = Math.floor(tt / L);
    if (n < 1 || (n + Math.floor(seed)) % 2 === 0) return null;
    const f = K.FIDGETS[Math.floor(U.hash(n * 7.13 + seed * 3.7) * K.FIDGETS.length)];
    const x = tt - n * L - FIDGET_START;
    if (x < 0 || x > f.dur) return null;
    return { f, u: x / f.dur };
  }

  /**
   * Full pose for a character: shared baseline, character flavor, resolved tint color.
   * opts.variety plays idle fidgets (opts.seed desyncs screens); opts.fidget + opts.fidgetU
   * force one fidget (used by the sprite exporter).
   */
  function compute(ch, state, tt, pal, themeId, opts) {
    let p = base(state, tt);
    p = ch.pose(p, state, tt) || p;
    if (state === 'idle' && opts) {
      let fg = null;
      if (opts.fidget) fg = { f: K.fidget(opts.fidget), u: opts.fidgetU || 0 };
      else if (opts.variety) fg = fidgetAt(tt, opts.seed || 0);
      if (fg && fg.f) {
        fg.f.apply(p, fg.u);
        if (ch.fidget) ch.fidget(p, fg.f.id, fg.u);
        p.fidget = fg.f.id;
      }
    }
    p.tint = p.tintKey ? K.tint(themeId, p.tintKey) : pal.tint || pal.base || U.WHITE;
    return p;
  }

  /* ------------------------------------------------------------ transitions */

  // The quick blend: what a change between two states plays when no designed move (transitions.js) fits.
  const BLEND = {
    id: 'blend',
    label: 'Quick blend',
    dur: 0.45,
    flash: 0,
    k: (u) => U.easeInOut(Math.min(1, u / 0.7)),
    shape(p, u) {
      const pop = 1 + 0.07 * Math.sin(u * Math.PI * 2) * (1 - u);
      p.sx *= pop;
      p.sy *= 2 - pop;
    },
  };

  /** The move to play between two states: exact pair, then from -> any, then any -> to. */
  K.transitionFor = function (from, to) {
    const T = K.TRANSITIONS;
    return T.find((t) => t.from === from && t.to === to) || T.find((t) => t.from === from && t.to === '*') || T.find((t) => t.from === '*' && t.to === to) || BLEND;
  };
  K.transitionById = (id) => K.TRANSITIONS.find((t) => t.id === id) || (id === 'blend' ? BLEND : null);

  /** Pose for one moment of a transition at local time u (0..1). */
  function transitionPose(tr, a, b, u) {
    const k = U.clamp(tr.k(U.clamp(u)));
    const p = k <= 0 ? clone(a) : k >= 1 ? clone(b) : blend(a, b, k);
    if (tr.shape) tr.shape(p, U.clamp(u), a, b);
    return { pose: p, k };
  }

  K.Pose = { DEFAULTS, create, base, blend, clone, compute, transitionPose, fidgetAt, FIDGET_START };
})(window.Bud);
