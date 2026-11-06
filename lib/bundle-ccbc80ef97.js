// lib/core.js
/* Bud concept library: namespace, registries and shared helpers.
 *
 * Plain browser scripts (no modules, no build step) so the explorer runs straight
 * from file://. Every other file in lib/ attaches itself to window.Bud.
 * The same files are meant to be reused by the landing page (Task 2), the sprite
 * exporter (Task 3) and the companion app prototype (Task 4).
 */
(function (root) {
  'use strict';

  const Bud = (root.Bud = root.Bud || {});
  Bud.version = '0.1.0';

  /* ---------------------------------------------------------------- registries */

  function makeRegistry(kind, validate) {
    const list = [];
    const map = Object.create(null);
    return {
      kind,
      list,
      add(def) {
        if (!def || typeof def.id !== 'string') throw new Error(`Bud: a ${kind} needs a string id`);
        if (validate) validate(def);
        const prev = map[def.id];
        if (prev) list[list.indexOf(prev)] = def;
        else list.push(def);
        map[def.id] = def;
        return def;
      },
      get(id) { return map[id] || null; },
      has(id) { return !!map[id]; },
      ids() { return list.map((d) => d.id); },
    };
  }

  function validateCharacter(def) {
    if (def.wrapper) {
      if (typeof def.resolve !== 'function') throw new Error(`Bud: wrapper character "${def.id}" needs resolve()`);
      return;
    }
    ['draw', 'pose'].forEach((fn) => {
      if (typeof def[fn] !== 'function') throw new Error(`Bud: character "${def.id}" needs ${fn}()`);
    });
    if (!def.palettes || !def.palettes.classic) throw new Error(`Bud: character "${def.id}" needs palettes.classic`);
  }

  function validateForm(def) {
    ['body', 'screen'].forEach((fn) => {
      if (typeof def[fn] !== 'function') throw new Error(`Bud: form "${def.id}" needs ${fn}(size)`);
    });
  }

  Bud.characters = makeRegistry('character', validateCharacter);
  Bud.forms = makeRegistry('form', validateForm);
  Bud.phones = makeRegistry('phone');
  Bud.themes = makeRegistry('theme');

  Bud.registerCharacter = (def) => Bud.characters.add(def);
  Bud.registerForm = (def) => Bud.forms.add(def);
  Bud.registerPhone = (def) => Bud.phones.add(def);
  Bud.registerTheme = (def) => Bud.themes.add(def);

  const ranks = new WeakMap();
  /**
   * Adds def to a list kept in order of rank (a state's number, a built-in's outfit code, a find's
   * order), so lib files can load in any order and lists keep the order Bluetooth and the app use.
   * Ranks are kept beside the entries, so entries keep their shape. Two entries can't share an id or a rank.
   */
  Bud.addRanked = function (list, def, rank) {
    if (!Number.isFinite(rank)) throw new Error(`Bud: ${def.id} needs a number for its place`);
    const clash = list.find((d) => d.id === def.id || ranks.get(d) === rank);
    if (clash) throw new Error(`Bud: ${def.id} (${rank}) clashes with ${clash.id} (${ranks.get(clash)})`);
    ranks.set(def, rank);
    list.push(def);
    list.sort((a, b) => ranks.get(a) - ranks.get(b));
    return def;
  };

  /* ------------------------------------------------------------------- math */

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fract = (x) => x - Math.floor(x);
  const smoothstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const WHITE = [255, 255, 255];
  const BLACK = [0, 0, 0];

  const U = (Bud.util = {
    TAU,
    clamp,
    lerp,
    fract,
    smoothstep,
    easeOut: (t) => 1 - Math.pow(1 - clamp(t), 3),
    easeIn: (t) => Math.pow(clamp(t), 3),
    easeInOut(t) {
      t = clamp(t);
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    easeOutBack(t, s = 1.70158) {
      t = clamp(t) - 1;
      return 1 + t * t * ((s + 1) * t + s);
    },

    /** Deterministic 0..1 noise from a number. */
    hash(n) {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
      return s - Math.floor(s);
    },

    /** Sine that completes a whole number of cycles per loop, so sprite loops stay seamless. */
    osc(tt, loop, cycles = 1, phase = 0) {
      return Math.sin(TAU * ((cycles * tt) / loop + phase));
    },

    /** Like osc, but asks for a frequency (Hz) and rounds it to the nearest loop-safe value. */
    hz(tt, loop, freq, phase = 0) {
      const c = Math.max(1, Math.round(freq * loop));
      return Math.sin(TAU * ((c * tt) / loop + phase));
    },

    /** 0 outside [a, b], 1 inside, with soft shoulders of width f. */
    win(x, a, b, f = 0.15) {
      return smoothstep(a, a + f, x) * (1 - smoothstep(b - f, b, x));
    },

    /** Parabolic hop: 0 at a, 1 halfway, 0 at b. */
    hop(x, a, b) {
      if (x <= a || x >= b) return 0;
      const u = (x - a) / (b - a);
      return 4 * u * (1 - u);
    },

    /** Eye openness for blinks at the given times (seconds within a loop). */
    blink(x, times, dur = 0.2) {
      let open = 1;
      const close = 0.06;
      const hold = 0.04;
      for (let i = 0; i < times.length; i++) {
        const d = x - times[i];
        if (d > -close && d < dur) {
          const v = d < 0 ? -d / close : d < hold ? 0 : (d - hold) / (dur - hold);
          open = Math.min(open, clamp(v));
        }
      }
      return open;
    },

    /* ----------------------------------------------------------------- color */

    rgb(hex) {
      if (Array.isArray(hex)) return hex;
      let h = String(hex).trim().replace('#', '');
      if (h.length === 3) h = h.split('').map((c) => c + c).join('');
      const n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    hex(c) {
      return '#' + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
    },
    mix(a, b, t) {
      if (t <= 0) return a;
      if (t >= 1) return b;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    },
    css(c, a = 1) {
      const r = Math.round(c[0]);
      const g = Math.round(c[1]);
      const b = Math.round(c[2]);
      return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a < 0 ? 0 : a.toFixed(3)})`;
    },
    lighten: (c, t) => U.mix(c, WHITE, t),
    darken: (c, t) => U.mix(c, BLACK, t),
    gray(c) {
      const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      return [l, l, l];
    },
    desat: (c, t) => (t > 0 ? U.mix(c, U.gray(c), t) : c),
    /** Relative luminance 0..1 (sRGB weights, good enough for UI decisions). */
    luma: (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255,
    WHITE,
    BLACK,

    /* ---------------------------------------------------------------- canvas */

    /** Adds a rounded rectangle sub-path. */
    rr(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    },
    ellipse(ctx, x, y, rx, ry, rot = 0) {
      ctx.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
      ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
    },
    /** Four-point sparkle star. */
    star4(ctx, x, y, r, thin = 0.28) {
      const t = r * thin;
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x + t * 0.35, y - t * 0.35, x + r, y);
      ctx.quadraticCurveTo(x + t * 0.35, y + t * 0.35, x, y + r);
      ctx.quadraticCurveTo(x - t * 0.35, y + t * 0.35, x - r, y);
      ctx.quadraticCurveTo(x - t * 0.35, y - t * 0.35, x, y - r);
      ctx.closePath();
    },
  });

  /* --------------------------------------------------------------- palettes */

  const palCache = new Map();

  /** Parsed palette (hex strings become [r,g,b]) for a character and theme. */
  Bud.palette = function (charId, themeId) {
    const key = charId + '|' + themeId;
    let pal = palCache.get(key);
    if (pal) return pal;
    const ch = Bud.characters.get(charId);
    const raw = (ch && ch.palettes && (ch.palettes[themeId] || ch.palettes.classic)) || {};
    pal = {};
    for (const k in raw) {
      const v = raw[k];
      pal[k] = typeof v === 'string' && v[0] === '#' ? U.rgb(v) : v;
    }
    palCache.set(key, pal);
    return pal;
  };

  /* ---------------------------------------------------------------- storage */

  /** localStorage wrapped in try/catch: private windows and blocked storage just fall back. */
  Bud.store = {
    get(key, fallback) {
      try {
        const v = root.localStorage.getItem(key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        root.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove(key) {
      try {
        root.localStorage.removeItem(key);
      } catch (e) {
        /* ignore */
      }
    },
  };

  let uidCounter = 0;
  Bud.uid = (prefix = 'k') => `${prefix}${(++uidCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
})(window);

;
// lib/themes.js
/* Color themes and state colors.
 *
 * A theme id picks a palette inside each character (character.palettes[themeId]).
 * State colors are shared across characters so "blue means listening" stays true
 * everywhere. Mono drops all hue so expressions must read from shape and motion.
 */
(function (K) {
  'use strict';
  const U = K.util;

  [
    { id: 'classic', label: 'Classic', note: 'Goblin-fire teal, warm mochi, clay tile.' },
    { id: 'night', label: 'Night', note: 'Violet and slate. Usually the fewest lit pixels.' },
    { id: 'sakura', label: 'Sakura', note: 'Cherry blossom pinks.' },
    { id: 'mint', label: 'Mint', note: 'Mint and celadon greens.' },
    { id: 'dancheong', label: 'Dancheong', note: 'Palace paint colors: green, vermilion, gold and blue.' },
    { id: 'mono', label: 'Mono', note: 'Grayscale, like a single-color OLED. State has to read from motion alone.' },
  ].forEach(K.registerTheme);

  /** Semantic state colors. Ember's flame, Bun's horn tip, Giwa's mane all pull from these. */
  const TINTS = {
    listening: '#4AA8FF',
    thinking: '#FF9A2E',
    speaking: '#A98BFF',
    working: '#FFB547',
    done: '#FFD84D',
    recording: '#FF3D4F',
    lowbattery: '#FF6A3A',
    needsyou: '#FF5FB0',
    confused: '#FF8A5B',
    charging: '#4ADE80',
    privacy: '#9AA3B5',
    love: '#FF5C8A',
  };
  const TINTS_BY_THEME = {
    mono: Object.fromEntries(Object.keys(TINTS).map((k) => [k, '#FFFFFF'])),
  };
  K.TINTS = TINTS;

  const tintCache = new Map();
  K.tint = function (themeId, key) {
    const ck = themeId + '|' + key;
    let v = tintCache.get(ck);
    if (!v) {
      const hex = (TINTS_BY_THEME[themeId] && TINTS_BY_THEME[themeId][key]) || TINTS[key] || '#FFFFFF';
      v = U.rgb(hex);
      tintCache.set(ck, v);
    }
    return v;
  };

  /** Accessory colors per theme (beanie, scarf and friends). */
  const ACC = {
    classic: { hat: '#E5484D', hat2: '#FFF4E6', scarf: '#F2A33A', scarf2: '#FFF4E6' },
    night: { hat: '#6B5CE7', hat2: '#E6E1FF', scarf: '#F2C14E', scarf2: '#4A4290' },
    sakura: { hat: '#FF7EA8', hat2: '#FFFFFF', scarf: '#FFFFFF', scarf2: '#FF8FB6' },
    mint: { hat: '#21A866', hat2: '#E9FFF3', scarf: '#FF8A65', scarf2: '#FFF3E8' },
    dancheong: { hat: '#2F5DA8', hat2: '#F2C14E', scarf: '#E8402E', scarf2: '#2E8B6E' },
    mono: { hat: '#9A9A9A', hat2: '#FFFFFF', scarf: '#D0D0D0', scarf2: '#6B6B6B' },
  };
  const accCache = new Map();
  K.accColors = function (themeId) {
    let v = accCache.get(themeId);
    if (!v) {
      const raw = ACC[themeId] || ACC.classic;
      v = {};
      for (const k in raw) v[k] = U.rgb(raw[k]);
      accCache.set(themeId, v);
    }
    return v;
  };
})(window.Bud);

;
// lib/states/_kit.js
/* The states' kit: the list the state files join, and the motion helpers they share.
 *
 * Each state is one file, lib/states/<id>.js, that registers its K.STATES entry with its number
 * (the first 15 are what Bluetooth sends; the moods follow), its base() motion and Bud's own eye
 * touches (eyes(), which lib/characters/eyes.js calls). lib/pose.js runs them. Copy _template.js
 * to add one, then run node tools/lib-files.mjs.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const { smoothstep } = U;

  // group: how the explorer arranges the buttons. key: keyboard shortcut.
  K.STATES = [];
  const byId = Object.create(null);
  const parts = Object.create(null);
  K.state = (id) => byId[id] || K.STATES[0];

  /**
   * A state: number is its place in K.STATES, def its entry ({ id, label, group, key, loop, hint }),
   * own its base(p, tt, L, x) (motion at state-time tt, x = tt within the loop of L seconds) and
   * eyes(p, e, tt, L) (Bud's touches to its pose, e = p.ex).
   */
  K.registerState = function (number, def, own) {
    K.addRanked(K.STATES, def, number);
    byId[def.id] = def;
    parts[def.id] = own;
    return def;
  };
  const NONE = Object.freeze({});
  /** What a state's file adds to the engine: { base, eyes }, either one may be missing. */
  K.stateParts = (id) => parts[id] || NONE;

  /** Quick eye darts with holds in between, like real eyes. pts: [[time, lookX, lookY], ...] */
  function saccade(x, pts) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [t0, tx, ty] = pts[i];
      if (x < t0) break;
      const k = smoothstep(t0, t0 + 0.09, x);
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
    }
    return [cx, cy];
  }

  K.StateKit = { saccade };
})(window.Bud);

;
// lib/states/charging.js
/* Charging: state 11, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc } = U;

  K.registerState(11, { id: 'charging', label: 'Charging', group: 'Device', loop: 3.0, hint: 'Content and relaxed, green bolt.' }, {
    base(p, tt, L, x) {
      const b = osc(tt, L, 1);
      p.sleepy = 0.35;
      p.happy = 0.25;
      p.sy = 1 + 0.02 * b;
      p.y = 1 + 0.6 * b;
      p.mouthCurve = 0.6;
      p.blush = 0.5;
      p.bright = 0.92;
      p.tintKey = 'charging';
      p.tintAmt = 0.8;
      p.glow = 0.6;
      p.fx.bolt = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      // blissed out while it charges: soft smiling eyes, flat relaxed lids, slow breath
      p.happy = 0.55 + 0.08 * U.osc(tt, L, 1);
      p.sleepy = 0.36;
      p.browTilt = 0.34;
      p.lookY = 0.1;
      e.perk = 0.3;
    },
  });
})(window.Bud);

;
// lib/states/cold.js
/* Cold: state 16, a mood Bud shows on its own (the firmware's Mood, never sent by the app). */
(function (K) {
  'use strict';
  const { osc, blink, TAU } = K.util;

  K.registerState(16, { id: 'cold', label: 'Cold', group: 'Moments', loop: 2.4, hint: 'A chilly room: shivers, squeezed eyes, pale blue cheeks, chattering.' }, {
    base(p, tt, L, x) {
      // a quick shiver that comes in waves, huddled a little smaller
      const shiver = Math.sin(TAU * 11 * tt) * (0.55 + 0.45 * Math.abs(osc(tt, L, 1)));
      p.x = 0.9 * shiver;
      p.squint = 0.55;
      p.sy = 0.96;
      p.sx = 0.97;
      p.y = 1;
      p.lookY = 0.12;
      p.eyeOpen = blink(x, [1.6]);
      p.mouthCurve = 0;
      p.wobble = 1;
      p.glow = 0.4;
      p.bright = 0.92;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.cold = 1;
      e.wave = 1;
      e.droop = 0.25;
    },
  });
})(window.Bud);

;
// lib/states/confused.js
/* Confused: state 7, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc, blink } = U;

  K.registerState(7, { id: 'confused', label: 'Confused', group: 'Agent', key: '8', loop: 2.4, hint: 'Did not catch that: head tilt, mismatched eyes, a question mark.' }, {
    base(p, tt, L, x) {
      p.rot = 0.13 + 0.03 * osc(tt, L, 1);
      p.eyeL = 0.8;
      p.eyeR = 1.14;
      p.lookX = 0.42 * osc(tt, L, 1, 0.25);
      p.lookY = -0.15;
      p.mouthCurve = -0.15;
      p.wobble = 0.5;
      p.brow = 0.3;
      p.browTilt = -0.2;
      p.eyeOpen = blink(x, [0.9, 1.15]);
      p.tintKey = 'confused';
      p.tintAmt = 0.9;
      p.glow = 0.6;
      p.fx.question = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.horn = 0.8 * U.osc(tt, L, 1, 0.5);
    },
  });
})(window.Bud);

;
// lib/states/dizzy.js
/* Dizzy: state 15, a mood Bud shows on its own (the firmware's Mood, never sent by the app). */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc } = U;

  K.registerState(15, { id: 'dizzy', label: 'Dizzy', group: 'Moments', loop: 2.0, hint: 'After a shake: swirly eyes, a wobbly mouth, swaying.' }, {
    base(p, tt, L, x) {
      p.rot = 0.13 * osc(tt, L, 1);
      p.x = 2.4 * osc(tt, L, 1, 0.25);
      p.y = 0.8 * osc(tt, L, 2);
      p.sy = 1 + 0.02 * osc(tt, L, 2, 0.1);
      p.mouthCurve = 0;
      p.wobble = 1;
      p.glow = 0.6;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.spiral = 1;
      e.wave = 1;
      e.horn = 1.2 * U.osc(tt, L, 2);
    },
  });
})(window.Bud);

;
// lib/states/done.js
/* Done: state 4, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, hop, smoothstep } = K.util;

  K.registerState(4, { id: 'done', label: 'Done', group: 'Conversation', key: '5', loop: 2.4, hint: 'Happy hop, a burst and a check.' }, {
    base(p, tt, L, x) {
      const h = hop(x, 0.05, 0.6);
      const land = hop(x, 0.6, 0.85);
      p.y = -7 * h;
      p.sy = 1 + 0.07 * h - 0.09 * land;
      p.sx = 1 - 0.04 * h + 0.08 * land;
      p.rot = 0.05 * osc(tt, L, 2) * smoothstep(0.85, 1.2, x);
      p.happy = 1;
      p.mouthOpen = 0.65;
      p.mouthCurve = 1;
      p.blush = 1;
      p.brow = 0.7;
      p.tintKey = 'done';
      p.tintAmt = 1 - 0.15 * smoothstep(0.8, 2.0, x);
      p.glow = 1;
      p.fx.sparkles = 1;
      p.fx.burst = 1;
      p.fx.check = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 0.3;
    },
  });
})(window.Bud);

;
// lib/states/hello.js
/* Hello: state 9, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { win, hop } = K.util;

  K.registerState(9, { id: 'hello', label: 'Hello', group: 'Moments', key: '0', loop: 2.2, hint: 'Pops up with a wink and a burst of sparkles. No words, so it works in any language.' }, {
    base(p, tt, L, x) {
      const h = hop(x, 0.0, 0.45);
      const land = hop(x, 0.45, 0.62);
      p.y = -5 * h;
      p.sy = 1 + 0.06 * h - 0.07 * land;
      p.sx = 1 - 0.03 * h + 0.06 * land;
      p.wide = 0.45;
      p.sparkle = 1.5;
      p.blush = 0.9;
      p.mouthOpen = 0.45;
      p.mouthCurve = 1;
      p.winkR = win(x, 0.75, 1.45, 0.12);
      p.rot = 0.06 * win(x, 0.75, 1.45, 0.15);
      p.glow = 0.9;
      p.fx.pop = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 0.5;
      e.perk = 1;
    },
  });
})(window.Bud);

;
// lib/states/hot.js
/* Hot: state 17, a mood Bud shows on its own (the firmware's Mood, never sent by the app). */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;

  K.registerState(17, { id: 'hot', label: 'Hot', group: 'Moments', loop: 2.6, hint: 'A hot room: droopy eyes, a sweat drop sliding down, rosy cheeks, heavy breaths.' }, {
    base(p, tt, L, x) {
      const pant = Math.abs(osc(tt, L, 4));
      p.sleepy = 0.5;
      p.lookY = 0.18;
      p.y = 1.4 + 0.5 * pant;
      p.sy = 0.98 + 0.02 * pant;
      p.sx = 1.02;
      p.eyeOpen = blink(x, [1.9], 0.3);
      p.glow = 0.7;
      p.fx.sweat = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.hot = 1; // no mouth: an open one panting read as talking
      e.droop = 0.45;
      e.h = 0.94;
    },
  });
})(window.Bud);

;
// lib/states/idle.js
/* Idle: state 0, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;
  const { saccade } = K.StateKit;

  K.registerState(0, { id: 'idle', label: 'Idle', group: 'Conversation', key: '1', loop: 6.0, hint: 'Breathing, blinking, quick glances.' }, {
    base(p, tt, L, x) {
      const b = osc(tt, L, 2);
      p.sy = 1 + 0.028 * b;
      p.sx = 1 - 0.018 * b;
      p.y = -1.4 * osc(tt, L, 2, 0.15);
      p.eyeOpen = blink(x, [1.3, 4.4, 4.68]);
      const [lx, ly] = saccade(x, [[1.9, -0.55, 0.1], [2.55, -0.62, 0.04], [3.3, 0, 0], [4.95, 0.5, -0.12], [5.6, 0, 0]]);
      p.lookX = lx + 0.025 * osc(tt, L, 11);
      p.lookY = ly + 0.02 * osc(tt, L, 7, 0.3);
      p.mouthCurve = 0.45;
    },
  });
})(window.Bud);

;
// lib/states/listening.js
/* Listening: state 1, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc } = K.util;

  K.registerState(1, { id: 'listening', label: 'Listening', group: 'Conversation', key: '2', loop: 1.6, hint: 'Leans in, eyes wide, turns blue, sound ripples.' }, {
    base(p, tt, L, x) {
      const v = 0.5 + 0.5 * osc(tt, L, 3) * osc(tt, L, 2, 0.25);
      p.ex.voice = v;
      p.wide = 0.3 + 0.12 * v;
      p.sy = 1.03 + 0.03 * v;
      p.sx = 1 - 0.015 * v;
      p.rot = 0.06;
      p.lookX = 0.1;
      p.lookY = -0.12;
      p.mouthOpen = 0.14;
      p.mouthCurve = 0.15;
      p.brow = 0.6;
      p.tintKey = 'listening';
      p.tintAmt = 1;
      p.glow = 0.95;
      p.fx.waves = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.h = 1.04 + 0.12 * e.voice;
      e.perk = 0.7;
    },
  });
})(window.Bud);

;
// lib/states/love.js
/* Love: state 10, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { hop } = K.util;

  K.registerState(10, { id: 'love', label: 'Love', group: 'Moments', loop: 2.0, hint: 'Heart eyes and floating hearts, for a thank-you.' }, {
    base(p, tt, L, x) {
      const beat = hop(x, 0.0, 0.18) + 0.7 * hop(x, 0.22, 0.4);
      p.heart = 1;
      p.sy = 1 + 0.05 * beat;
      p.sx = 1 + 0.03 * beat;
      p.y = -0.6 * beat;
      p.blush = 1;
      p.mouthCurve = 0.85;
      p.tintKey = 'love';
      p.tintAmt = 0.9;
      p.glow = 0.9;
      p.fx.hearts = 1;
    },
  });
})(window.Bud);

;
// lib/states/lowbattery.js
/* Low battery: state 12, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, win, blink } = K.util;

  K.registerState(12, { id: 'lowbattery', label: 'Low battery', group: 'Device', loop: 3.0, hint: 'Droopy, flickering, battery icon.' }, {
    base(p, tt, L, x) {
      const flick = 1 - 0.55 * (win(x, 0.8, 0.95, 0.03) + win(x, 1.05, 1.18, 0.03) + 0.6 * win(x, 2.3, 2.42, 0.03));
      p.sleepy = 0.55;
      p.lookX = -0.15;
      p.lookY = 0.45;
      p.sy = 0.93 + 0.012 * osc(tt, L, 1);
      p.sx = 1.045;
      p.y = 4;
      p.mouthCurve = -0.35;
      p.wobble = 1;
      p.browTilt = -0.8;
      p.eyeOpen = blink(x, [1.9], 0.38);
      p.bright = 0.82 * flick;
      p.desat = 0.45;
      p.glow = 0.3;
      p.tintKey = 'lowbattery';
      p.tintAmt = 0.3;
      p.fx.battery = 1;
      p.fx.sweat = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.droop = 0.7;
    },
  });
})(window.Bud);

;
// lib/states/needsyou.js
/* Needs you: state 6, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, hop } = K.util;

  K.registerState(6, { id: 'needsyou', label: 'Needs you', group: 'Agent', key: '7', loop: 1.6, hint: 'Bounces and pulses the edge for attention.' }, {
    base(p, tt, L, x) {
      const h = hop(x, 0.0, 0.32) + hop(x, 0.36, 0.68);
      const land = hop(x, 0.32, 0.4) + hop(x, 0.68, 0.8);
      p.y = -5 * h;
      p.sy = 1 + 0.06 * h - 0.07 * land;
      p.sx = 1 - 0.03 * h + 0.06 * land;
      p.rot = 0.07 * osc(tt, L, 2);
      p.wide = 0.55;
      p.sparkle = 1.6;
      p.lookY = -0.12;
      p.mouthOpen = 0.32;
      p.mouthCurve = 0.35;
      p.brow = 0.8;
      p.browTilt = -0.6;
      p.blush = 0.85;
      p.tintKey = 'needsyou';
      p.tintAmt = 1;
      p.glow = 1;
      p.fx.bang = 1;
      p.fx.attn = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 1;
      e.perk = 1;
    },
  });
})(window.Bud);

;
// lib/states/privacy.js
/* Mic off: state 14, the number Bluetooth sends. */
(function (K) {
  'use strict';

  K.registerState(14, { id: 'privacy', label: 'Mic off', group: 'Device', loop: 3.0, hint: 'Not listening: eyes lowered, dimmed, mic-off icon.' }, {
    base(p, tt, L, x) {
      p.sleepy = 0.72;
      p.browTilt = 0.67; // cancels the sleepy droop: flat, calm lids
      p.lookY = 0.55;
      p.lookX = -0.1;
      p.y = 2;
      p.sy = 0.98;
      p.mouthCurve = 0;
      p.bright = 0.62;
      p.desat = 0.5;
      p.glow = 0.2;
      p.tintKey = 'privacy';
      p.tintAmt = 0.7;
      p.fx.micoff = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.droop = 0.5;
    },
  });
})(window.Bud);

;
// lib/states/recording.js
/* Recording: state 8, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;

  K.registerState(8, { id: 'recording', label: 'Recording', group: 'Device', key: '9', loop: 2.0, hint: 'Focused, red ring running around the edge.' }, {
    base(p, tt, L, x) {
      p.squint = 0.22;
      p.browTilt = 0.3;
      p.sy = 1 + 0.012 * osc(tt, L, 1);
      p.mouthCurve = 0.1;
      p.eyeOpen = blink(x, [1.45]);
      p.tintKey = 'recording';
      p.tintAmt = 1;
      p.glow = 0.85;
      p.fx.rec = 1;
      p.fx.ring = 1;
    },
  });
})(window.Bud);

;
// lib/states/sleeping.js
/* Sleeping: state 13, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc } = K.util;

  K.registerState(13, { id: 'sleeping', label: 'Sleeping', group: 'Device', loop: 4.0, hint: 'Dimmed, slow breathing, floating Zs.' }, {
    base(p, tt, L, x) {
      const b = osc(tt, L, 1);
      p.closed = 1;
      p.sy = 1 + 0.045 * b;
      p.sx = 1 - 0.028 * b;
      p.y = 3 + 1.2 * b;
      p.rot = -0.04;
      p.mouthOpen = 0.18 + 0.1 * (0.5 + 0.5 * b);
      p.mouthCurve = 0;
      p.blush = 0.35;
      p.glow = 0.25;
      p.bright = 0.5;
      p.desat = 0.25;
      p.fx.zzz = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.droop = 1;
    },
  });
})(window.Bud);

;
// lib/states/speaking.js
/* Speaking: state 3, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;

  K.registerState(3, { id: 'speaking', label: 'Speaking', group: 'Conversation', key: '4', loop: 2.0, hint: 'Answers out loud: bounces with its voice, turns violet.' }, {
    base(p, tt, L, x) {
      const syll = Math.abs(osc(tt, L, 5));
      const phrase = 0.62 + 0.38 * osc(tt, L, 1, 0.1);
      const v = syll * phrase;
      p.ex.voice = v;
      p.mouthOpen = 0.12 + 0.55 * v;
      p.mouthCurve = 0.3;
      p.sy = 1 + 0.025 * v;
      p.y = -0.9 * v;
      p.wide = 0.12;
      p.lookX = 0.12 * osc(tt, L, 1);
      p.eyeOpen = blink(x, [1.5]);
      p.blush = 0.65;
      p.tintKey = 'speaking';
      p.tintAmt = 1;
      p.glow = 0.85;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.h = 1 + 0.06 * e.voice;
      e.talk = 1;
      e.perk = 0.4;
      p.y += 0.6 * e.voice;
    },
  });
})(window.Bud);

;
// lib/states/thinking.js
/* Thinking: state 2, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc, blink } = U;

  K.registerState(2, { id: 'thinking', label: 'Thinking', group: 'Conversation', key: '3', loop: 2.4, hint: 'Looks up and away, turns orange, ticks over.' }, {
    base(p, tt, L, x) {
      p.lookX = 0.62 + 0.08 * osc(tt, L, 1);
      p.lookY = -0.72;
      p.asym = 0.6;
      p.rot = -0.05 + 0.025 * osc(tt, L, 1);
      p.x = 1.2 * osc(tt, L, 1, 0.25);
      p.mouthCurve = -0.05;
      p.mouthX = 2.5;
      p.eyeOpen = blink(x, [1.7]);
      p.brow = 0.35;
      p.browTilt = 0.15;
      p.tintKey = 'thinking';
      p.tintAmt = 1;
      p.glow = 0.8;
      p.fx.dots = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.horn = 1.5 * U.osc(tt, L, 2);
    },
  });
})(window.Bud);

;
// lib/states/wave.js
/* Wave: state 18, a friend's Bud waving at yours. Not one Bluetooth sends: the app shows it, and Bud's
 * screen shows Hello for it until Bud's firmware draws the hand (mobile/src/bud/session.ts ON_BUD). */
(function (K) {
  'use strict';
  const { osc } = K.util;

  K.registerState(18, { id: 'wave', label: 'Wave', group: 'Moments', loop: 2.4, hint: 'A friend’s Bud waved: a big smile, and a hand at Bud’s side waving back.' }, {
    base(p, tt, L, x) {
      p.y = -1.2 * osc(tt, L, 2);
      p.rot = -0.03 + 0.025 * osc(tt, L, 2); // swaying with the wave
      p.lookX = 0.25; // toward the hand
      p.happy = 0.85;
      p.blush = 0.8;
      p.mouthOpen = 0.35;
      p.mouthCurve = 1;
      p.glow = 0.85;
      p.fx.hand = 1;
    },
    // Bud's own touches (lib/characters/eyes.js)
    eyes(p, e, tt, L) {
      e.round = 0.4;
      e.perk = 0.8;
    },
  });
})(window.Bud);

;
// lib/states/working.js
/* Working: state 5, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const U = K.util;
  const { osc, smoothstep } = U;

  K.registerState(5, { id: 'working', label: 'Working', group: 'Agent', key: '6', loop: 3.0, hint: 'Reading line by line while a task runs; progress around the edge.' }, {
    base(p, tt, L, x) {
      const ph = U.fract(tt / 1);
      const line = Math.floor(U.fract(tt / L) * 3);
      p.lookX = -0.6 + 1.2 * smoothstep(0, 0.78, ph) - 1.2 * smoothstep(0.84, 0.97, ph);
      p.lookY = -0.18 + 0.2 * line;
      p.squint = 0.2;
      p.browTilt = 0.18;
      p.sy = 1 + 0.01 * osc(tt, L, 3);
      p.mouthCurve = 0.05;
      p.tintKey = 'working';
      p.tintAmt = 1;
      p.glow = 0.75;
      p.fx.progress = 1;
    },
  });
})(window.Bud);

;
// lib/pose.js
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

;
// lib/fidgets.js
/* Idle fidgets: short one-shot moves that liven up idle (lib/pose.js plays them). */
(function (K) {
  'use strict';
  const U = K.util;
  const { win, hop, blink } = U;

  // Idle variety: short one-shot moves layered on every other idle loop. Each `apply`
  // edits the idle pose at local time u (0..1). For firmware they export as one-shot clips.
  const ease = (u) => U.smoothstep(0, 1, u);
  K.FIDGETS = [
    {
      id: 'blinks',
      label: 'Double blink',
      dur: 1.0,
      apply(p, u) {
        p.eyeOpen = Math.min(p.eyeOpen, blink(u, [0.18, 0.42], 0.16));
      },
    },
    {
      id: 'look',
      label: 'Look around',
      dur: 2.2,
      apply(p, u) {
        const e = win(u, 0.02, 0.98, 0.12);
        const l = Math.sin(u * Math.PI * 2);
        p.lookX = 0.85 * l * e;
        p.lookY = -0.18 * e;
        p.rot += -0.06 * l * e;
      },
    },
    {
      id: 'hop',
      label: 'Little hop',
      dur: 1.2,
      apply(p, u) {
        const ant = hop(u, 0, 0.18);
        const h = hop(u, 0.18, 0.62);
        const land = hop(u, 0.62, 0.82);
        p.y -= 6 * h;
        p.sy *= 1 + 0.07 * h - 0.08 * land - 0.06 * ant;
        p.sx *= 1 - 0.03 * h + 0.07 * land + 0.05 * ant;
        p.happy = Math.max(p.happy, 0.85 * win(u, 0.12, 0.86, 0.1));
        p.blush = Math.max(p.blush, 0.8 * win(u, 0.12, 0.86, 0.1));
      },
    },
    {
      id: 'wiggle',
      label: 'Wiggle',
      dur: 1.4,
      apply(p, u) {
        const e = win(u, 0, 1, 0.2);
        const w = Math.sin(u * Math.PI * 6);
        p.rot += 0.09 * w * e;
        p.x += 1.6 * w * e;
      },
    },
    {
      id: 'yawn',
      label: 'Yawn',
      dur: 2.4,
      apply(p, u) {
        const a = win(u, 0.1, 0.78, 0.18);
        p.eyeOpen = Math.min(p.eyeOpen, 1 - 0.9 * a);
        p.mouthOpen = Math.max(p.mouthOpen, 0.85 * a);
        p.mouthCurve = U.lerp(p.mouthCurve, 0, a);
        p.sy *= 1 + 0.07 * a;
        p.sx *= 1 - 0.035 * a;
        p.y -= 1.5 * a;
        p.rot += 0.04 * a * Math.sin(u * Math.PI);
      },
    },
    {
      id: 'doze',
      label: 'Doze off',
      dur: 2.6,
      apply(p, u) {
        const d = ease(u / 0.72) * (1 - U.smoothstep(0.76, 0.8, u));
        p.sleepy = Math.max(p.sleepy, 0.85 * d);
        p.y += 2.2 * d;
        p.rot += 0.05 * d;
        const startle = hop(u, 0.78, 0.96);
        p.wide = Math.max(p.wide, 0.55 * startle);
        p.y -= 3 * startle;
      },
    },
  ];
})(window.Bud);

;
// lib/transitions.js
/* Designed transitions: moves between specific states (lib/pose.js plays them, lib/fx.js and
 * lib/screen.js draw their overlays). */
(function (K) {
  'use strict';
  const U = K.util;
  const { win, hop, smoothstep } = U;

  // Designed moves between specific states. `flash` is when the new state's own loop
  // starts (as a fraction of `dur`), `k` is the blend curve and `shape` adds the move.
  // Overlays for the same ids live in fx.js. Anything unlisted uses `blend`.
  const sstep = smoothstep;
  K.TRANSITIONS = [
    {
      id: 'flare',
      from: 'thinking',
      to: 'done',
      label: 'Thinking flares into done',
      dur: 0.95,
      flash: 0.45,
      k: (u) => sstep(0.38, 0.55, u),
      shape(p, u, a) {
        // the thinking dots fly up into the flare (fx.js), so the old ones stop drawing
        if (a && a.fx) a.fx.dots = 0;
        const gather = sstep(0, 0.42, u) * (1 - sstep(0.42, 0.5, u));
        const flash = hop(u, 0.38, 0.66);
        p.sy *= 1 - 0.07 * gather + 0.1 * flash;
        p.sx *= 1 + 0.05 * gather - 0.04 * flash;
        p.y += 2.5 * gather - 3 * flash;
        p.glow = Math.max(p.glow, 0.6 + 0.6 * flash);
        p.tint = U.mix(p.tint, U.WHITE, 0.55 * flash);
        p.tintAmt = Math.max(p.tintAmt, flash);
        p.eyeOpen = Math.min(p.eyeOpen, 1 - 0.8 * hop(u, 0.28, 0.48));
        if ('orbitR' in p.ex) p.ex.orbitR = 1 - sstep(0, 0.42, u);
        if ('size' in p.ex) p.ex.size *= 1 + 0.25 * flash;
      },
    },
    {
      id: 'save',
      from: 'recording',
      to: 'done',
      label: 'Recording saves into done',
      dur: 1.05,
      flash: 0.55,
      k: (u) => sstep(0.45, 0.65, u),
      shape(p, u) {
        const press = sstep(0, 0.5, u) * (1 - sstep(0.5, 0.58, u));
        const flash = hop(u, 0.5, 0.75);
        p.squint = Math.max(p.squint, 0.4 * press);
        p.sy *= 1 - 0.05 * press + 0.08 * flash;
        p.glow = Math.max(p.glow, 0.5 + 0.6 * flash);
        if ('clubGlow' in p.ex) p.ex.clubGlow = Math.max(p.ex.clubGlow, press);
      },
    },
    {
      id: 'gather',
      from: 'listening',
      to: 'thinking',
      label: 'Listening gathers into thinking',
      dur: 0.65,
      flash: 0.35,
      k: (u) => sstep(0.1, 0.6, u),
      shape(p, u) {
        const pull = hop(u, 0, 0.7);
        p.sx *= 1 - 0.04 * pull;
        p.sy *= 1 + 0.04 * pull;
        p.lookY = U.lerp(p.lookY, -0.8, 0.5 * pull);
      },
    },
    {
      id: 'perk',
      from: 'idle',
      to: 'listening',
      label: 'Perks up to listen',
      dur: 0.55,
      flash: 0.25,
      k: (u) => sstep(0, 0.5, u),
      shape(p, u) {
        const ant = hop(u, 0, 0.25);
        const up = hop(u, 0.2, 0.7);
        p.sy *= 1 - 0.05 * ant + 0.07 * up;
        p.sx *= 1 + 0.04 * ant - 0.03 * up;
        p.y -= 3 * up;
        p.wide = Math.max(p.wide, 0.5 * up);
      },
    },
    {
      id: 'wake',
      from: 'sleeping',
      to: '*',
      label: 'Wakes up',
      dur: 0.75,
      flash: 0.3,
      k: (u) => sstep(0.12, 0.5, u),
      shape(p, u) {
        const squash = hop(u, 0, 0.22);
        const pop = hop(u, 0.18, 0.55);
        p.sy *= 1 - 0.1 * squash + 0.09 * pop;
        p.sx *= 1 + 0.07 * squash - 0.05 * pop;
        p.y -= 3.5 * pop;
        p.wide = Math.max(p.wide, 0.7 * hop(u, 0.15, 0.6));
        p.bright = Math.max(p.bright, U.lerp(0.5, 1, sstep(0, 0.3, u)));
      },
    },
    {
      id: 'settle',
      from: '*',
      to: 'sleeping',
      label: 'Settles into sleep',
      dur: 1.4,
      flash: 0,
      k: (u) => U.easeInOut(u),
      shape(p, u) {
        const sigh = hop(u, 0.05, 0.45);
        p.sy *= 1 + 0.05 * sigh;
        p.y -= 1.5 * sigh;
      },
    },
    {
      id: 'jump',
      from: '*',
      to: 'needsyou',
      label: 'Jumps for attention',
      dur: 0.65,
      flash: 0.3,
      k: (u) => sstep(0.2, 0.5, u),
      shape(p, u) {
        const squat = hop(u, 0, 0.28);
        const air = hop(u, 0.22, 0.78);
        const land = hop(u, 0.78, 0.95);
        p.sy *= 1 - 0.12 * squat + 0.08 * air - 0.08 * land;
        p.sx *= 1 + 0.08 * squat - 0.04 * air + 0.06 * land;
        p.y -= 8 * air;
      },
    },
    {
      id: 'sag',
      from: '*',
      to: 'lowbattery',
      label: 'Sags on low battery',
      dur: 1.0,
      flash: 0,
      k: (u) => U.easeInOut(u),
      shape(p, u) {
        p.sy *= 1 - 0.06 * hop(u, 0.15, 0.85);
        p.x += 0.8 * Math.sin(u * 40) * hop(u, 0.3, 0.75);
        p.bright *= 1 - 0.45 * win(u, 0.42, 0.52, 0.03);
      },
    },
    {
      id: 'answer',
      from: 'thinking',
      to: 'speaking',
      label: 'Thinking turns into an answer',
      dur: 0.6,
      flash: 0.35,
      k: (u) => sstep(0.15, 0.55, u),
      shape(p, u) {
        const pop = hop(u, 0.2, 0.7);
        p.sy *= 1 + 0.05 * pop;
        p.lookY = U.lerp(p.lookY, 0, sstep(0, 0.4, u));
      },
    },
    {
      id: 'complete',
      from: 'working',
      to: 'done',
      label: 'Work completes into done',
      dur: 1.0,
      flash: 0.55,
      k: (u) => sstep(0.45, 0.65, u),
      shape(p, u) {
        const press = sstep(0, 0.5, u) * (1 - sstep(0.5, 0.58, u));
        const flash = hop(u, 0.5, 0.75);
        p.squint = Math.max(p.squint, 0.3 * press);
        p.sy *= 1 - 0.05 * press + 0.08 * flash;
        p.glow = Math.max(p.glow, 0.5 + 0.6 * flash);
      },
    },
    {
      id: 'greet',
      from: '*',
      to: 'hello',
      label: 'Pops up to say hi',
      dur: 0.55,
      flash: 0.15,
      k: (u) => sstep(0, 0.4, u),
      shape(p, u) {
        const squat = hop(u, 0, 0.3);
        const pop = hop(u, 0.25, 0.8);
        p.sy *= 1 - 0.08 * squat + 0.08 * pop;
        p.sx *= 1 + 0.06 * squat - 0.04 * pop;
      },
    },
    {
      id: 'unmute',
      from: 'privacy',
      to: '*',
      label: 'Mic back on',
      dur: 0.55,
      flash: 0.25,
      k: (u) => sstep(0.1, 0.5, u),
      shape(p, u) {
        const pop = hop(u, 0.1, 0.6);
        p.wide = Math.max(p.wide, 0.5 * pop);
        p.y -= 2 * pop;
      },
    },
    {
      id: 'mute',
      from: '*',
      to: 'privacy',
      label: 'Mic off',
      dur: 0.8,
      flash: 0,
      k: (u) => U.easeInOut(u),
      shape(p, u) {
        p.y += 1.5 * hop(u, 0.1, 0.9);
      },
    },
    {
      id: 'plug',
      from: '*',
      to: 'charging',
      label: 'Starts charging',
      dur: 0.7,
      flash: 0.3,
      k: (u) => sstep(0.2, 0.5, u),
      shape(p, u) {
        const zap = hop(u, 0.05, 0.4);
        p.x += 1.2 * Math.sin(u * 60) * zap;
        p.wide = Math.max(p.wide, 0.6 * zap);
        p.glow = Math.max(p.glow, 0.5 + 0.5 * zap);
      },
    },
    {
      id: 'swoon',
      from: '*',
      to: 'love',
      label: 'Melts into love',
      dur: 0.7,
      flash: 0.3,
      k: (u) => sstep(0.1, 0.5, u),
      shape(p, u) {
        const squash = hop(u, 0.05, 0.35);
        const pop = hop(u, 0.3, 0.75);
        p.sy *= 1 - 0.07 * squash + 0.07 * pop;
        p.sx *= 1 + 0.05 * squash - 0.03 * pop;
      },
    },
  ];
})(window.Bud);

;
// lib/face.js
/* Shared face parts: oval eyes with lids, mouths, blush, glows.
 *
 * Characters call these with their own proportions and colors. All sizes are in
 * stage units (the stage is 100 x 100, centered on 0,0).
 */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, clamp } = U;

  /** Clip to the area between a (sloped) top lid and a flat bottom lid. */
  function lidClip(ctx, cx, cy, rx, ry, topCut, slope, botCut) {
    const R = rx * 2.4;
    const Y = ry * 3 + 4;
    if (topCut > 0.001) {
      const ty = cy - ry + 2 * ry * topCut;
      ctx.beginPath();
      ctx.moveTo(cx - R, ty - slope * R);
      ctx.lineTo(cx + R, ty + slope * R);
      ctx.lineTo(cx + R, cy + Y);
      ctx.lineTo(cx - R, cy + Y);
      ctx.closePath();
      ctx.clip();
    }
    if (botCut > 0.001) {
      const by = cy + ry - 2 * ry * botCut;
      ctx.beginPath();
      ctx.moveTo(cx - R, cy - Y);
      ctx.lineTo(cx + R, cy - Y);
      ctx.lineTo(cx + R, by);
      ctx.lineTo(cx - R, by);
      ctx.closePath();
      ctx.clip();
    }
  }

  /** Lid amounts shared by every eye style, so expressions stay consistent across characters. */
  function lids(p, side) {
    const asym = p.asym * (side > 0 ? 1 : -0.25);
    return {
      asym,
      top: clamp(Math.max(p.sleepy * 0.5, p.squint * 0.34, asym * 0.32, Math.max(0, p.browTilt) * 0.12), 0, 0.85),
      bot: p.squint * 0.26,
      slope: side * (0.28 * p.sleepy - 0.3 * p.browTilt),
    };
  }

  /**
   * Two oval eyes.
   * spec: { x: half spacing, y, rx, ry, color, hi: highlight color (null for none),
   *         look: [x, y] travel, line: stroke width for closed/happy arcs }
   * Honors per-eye scale (p.eyeL, p.eyeR), winks (p.winkL, p.winkR: that eye becomes a
   * happy arc) and heart eyes (p.heart).
   */
  function ovalEyes(ctx, p, s, env) {
    const c = env.c;
    const wide = 1 + 0.2 * p.wide;
    const look = s.look || [s.rx * wide * 0.6, s.ry * wide * 0.4];
    const ox = p.lookX * look[0];
    const oy = p.lookY * look[1];
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const es = side < 0 ? p.eyeL : p.eyeR;
      const rx = s.rx * wide * es;
      const ry = s.ry * wide * es;
      const lw = (s.line || Math.max(1.2, s.rx * wide * 0.55)) * Math.sqrt(es);
      const hp = Math.max(p.happy, side < 0 ? p.winkL : p.winkR);
      const shut = Math.max(hp, p.closed, p.heart);
      const openA = clamp(1 - shut * 1.6);
      const cx = side * s.x + ox;
      const cy = s.y + oy;
      const L = lids(p, side);
      const open = p.eyeOpen;

      if (openA > 0.01) {
        const h = ry * Math.max(0.06, open) * (L.asym < 0 ? 1 - L.asym * 0.12 : 1);
        ctx.save();
        ctx.globalAlpha *= openA;
        lidClip(ctx, cx, cy, rx, h, L.top, L.slope, L.bot);
        ctx.beginPath();
        U.ellipse(ctx, cx, cy, rx, h);
        ctx.fillStyle = c(s.color);
        ctx.fill();
        if (open > 0.35 && s.hi !== null) {
          const hs = (s.hiSize || s.rx * wide * 0.42) * es * (0.85 + 0.15 * p.sparkle);
          ctx.fillStyle = c(s.hi || U.WHITE);
          ctx.beginPath();
          U.ellipse(ctx, cx - rx * 0.3 + p.lookX * rx * 0.1, cy - h * 0.36, hs, hs * 1.08);
          ctx.fill();
          ctx.beginPath();
          U.ellipse(ctx, cx + rx * 0.34, cy + h * 0.36, hs * 0.42, hs * 0.42);
          ctx.fill();
          if (p.sparkle > 1.15) {
            ctx.globalAlpha *= clamp((p.sparkle - 1.15) / 0.4);
            ctx.beginPath();
            U.ellipse(ctx, cx + rx * 0.3, cy - h * 0.18, hs * 0.32, hs * 0.32);
            ctx.fill();
          }
        }
        ctx.restore();

        if (L.top > 0.14 && open > 0.3) {
          ctx.save();
          ctx.globalAlpha *= openA * clamp((L.top - 0.14) * 5);
          const ty = cy - h + 2 * h * L.top;
          const e = rx * 1.08;
          ctx.beginPath();
          ctx.moveTo(cx - e, ty - L.slope * e);
          ctx.lineTo(cx + e, ty + L.slope * e);
          ctx.strokeStyle = c(s.color);
          ctx.lineWidth = lw * 0.55;
          ctx.stroke();
          ctx.restore();
        }
        if (open < 0.25) {
          ctx.save();
          ctx.globalAlpha *= openA * (1 - open / 0.25);
          ctx.beginPath();
          ctx.moveTo(cx - rx, cy);
          ctx.quadraticCurveTo(cx, cy + ry * 0.35, cx + rx, cy);
          ctx.strokeStyle = c(s.color);
          ctx.lineWidth = lw * 0.8;
          ctx.stroke();
          ctx.restore();
        }
      }

      if (hp > 0.01 && p.heart < 0.99) {
        ctx.save();
        ctx.globalAlpha *= clamp(hp * 1.4) * clamp(1 - p.heart * 1.5);
        ctx.beginPath();
        ctx.moveTo(cx - rx, cy + ry * 0.32);
        ctx.quadraticCurveTo(cx, cy - ry * 1.15, cx + rx, cy + ry * 0.32);
        ctx.strokeStyle = c(s.color);
        ctx.lineWidth = lw;
        ctx.stroke();
        ctx.restore();
      }
      if (p.closed > 0.01) {
        ctx.save();
        ctx.globalAlpha *= clamp(p.closed * 1.4);
        ctx.beginPath();
        ctx.moveTo(cx - rx, cy - ry * 0.02);
        ctx.quadraticCurveTo(cx, cy + ry * 0.85, cx + rx, cy - ry * 0.02);
        ctx.strokeStyle = c(s.color);
        ctx.lineWidth = lw * 0.85;
        ctx.stroke();
        ctx.restore();
      }
      if (p.heart > 0.01) {
        const hs = Math.max(rx, ry * 0.8) * 1.15 * (1 + 0.5 * (p.sy - 1));
        ctx.save();
        ctx.globalAlpha *= clamp(p.heart * 1.4);
        ctx.fillStyle = c(s.heart || s.color);
        ctx.beginPath();
        heart(ctx, cx, cy + hs * 0.1, hs);
        ctx.fill();
        if (s.hi !== null) {
          ctx.fillStyle = c(s.hi || U.WHITE, 0.85);
          ctx.beginPath();
          U.ellipse(ctx, cx - hs * 0.42, cy - hs * 0.25, hs * 0.2, hs * 0.14, -0.6);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  /**
   * Small mouth: a curve when closed, an "o" when slightly open, a D-shaped grin when happy.
   * spec: { x, y, w, color, inner, tongue, line, look }
   */
  function mouth(ctx, p, s, env) {
    const c = env.c;
    const x = s.x + p.mouthX * (s.shift == null ? 1 : s.shift) + p.lookX * (s.look == null ? 1.2 : s.look);
    const y = s.y + p.lookY * (s.lookY == null ? 0.8 : s.lookY);
    const open = p.mouthOpen;
    const curve = p.mouthCurve;
    const w = s.w * (1 + 0.3 * open);
    const lw = s.line || Math.max(1, s.w * 0.28);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (open < 0.12) {
      ctx.beginPath();
      if (p.wobble > 0.05) {
        const n = 4;
        const amp = w * 0.13 * p.wobble;
        ctx.moveTo(x - w / 2, y);
        for (let i = 1; i <= n; i++) {
          const xx = x - w / 2 + (w * i) / n;
          ctx.quadraticCurveTo(xx - w / n / 2, y + (i % 2 ? -amp : amp) - curve * w * 0.12, xx, y);
        }
      } else {
        ctx.moveTo(x - w / 2, y - curve * w * 0.1);
        ctx.quadraticCurveTo(x, y + curve * w * 0.55, x + w / 2, y - curve * w * 0.1);
      }
      ctx.strokeStyle = c(s.color);
      ctx.lineWidth = lw;
      ctx.stroke();
    } else if (Math.abs(curve) < 0.45) {
      const r = s.w * (0.24 + 0.26 * open);
      ctx.beginPath();
      U.ellipse(ctx, x, y + r * 0.25, r * 0.85, r * (0.8 + 0.45 * open));
      ctx.fillStyle = c(s.inner || s.color);
      ctx.fill();
    } else {
      const h = w * (0.3 + 0.55 * open);
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x, y + w * 0.12, x + w / 2, y);
      ctx.quadraticCurveTo(x + w * 0.44, y + h, x, y + h);
      ctx.quadraticCurveTo(x - w * 0.44, y + h, x - w / 2, y);
      ctx.closePath();
      ctx.fillStyle = c(s.inner || s.color);
      ctx.fill();
      if (s.tongue) {
        ctx.clip();
        ctx.beginPath();
        U.ellipse(ctx, x, y + h * 0.98, w * 0.3, h * 0.45);
        ctx.fillStyle = c(s.tongue);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** Two blush ovals. spec: { x: half spacing, y, rx, ry, color, alpha } */
  function blush(ctx, p, s, env) {
    const a = p.blush * (s.alpha == null ? 0.5 : s.alpha);
    if (a < 0.02) return;
    ctx.fillStyle = env.c(s.color, a);
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      ctx.beginPath();
      U.ellipse(ctx, side * s.x + p.lookX * (s.look == null ? 1 : s.look), s.y + p.lookY * 0.6, s.rx, s.ry);
      ctx.fill();
    }
  }

  /** Soft radial glow disc. */
  function glow(ctx, x, y, r, color, alpha, env) {
    if (alpha < 0.01 || r <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, env.c(color, alpha));
    g.addColorStop(0.45, env.c(color, alpha * 0.45));
    g.addColorStop(1, env.c(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /** Teardrop path (point up), used for sweat drops and petals. */
  function drop(ctx, x, y, r) {
    ctx.moveTo(x, y - r * 1.9);
    ctx.bezierCurveTo(x + r * 0.35, y - r * 1.2, x + r, y - r * 0.55, x + r, y);
    ctx.arc(x, y, r, 0, Math.PI);
    ctx.bezierCurveTo(x - r, y - r * 0.55, x - r * 0.35, y - r * 1.2, x, y - r * 1.9);
    ctx.closePath();
  }

  /** Heart path centered on x,y; s is about half its width. */
  function heart(ctx, x, y, s) {
    ctx.moveTo(x, y + s * 0.9);
    ctx.bezierCurveTo(x - s * 1.35, y + s * 0.05, x - s * 0.95, y - s * 1.15, x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.95, y - s * 1.15, x + s * 1.35, y + s * 0.05, x, y + s * 0.9);
    ctx.closePath();
  }

  K.Face = { lidClip, lids, ovalEyes, mouth, blush, glow, drop, heart };
})(window.Bud);

;
// lib/fx.js
/* Shared expression overlays (ripples, thinking dots, sparkles, Zs, battery...)
 * and ambient particles used by skin packs.
 *
 * Overlays are positioned with anchors that each character provides:
 *   anchors(pose) -> { x, y, top, side, sideY, badge: [x, y] }
 * All drawing happens in stage units and is a pure function of time, so it can be
 * exported as sprite frames later.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { TAU, fract, clamp, smoothstep } = U;

  const Z_COLOR = [214, 222, 255];
  const SWEAT = [140, 212, 255];
  const INK = [28, 18, 30];

  const DEFAULT_ANCHORS = { x: 0, y: 4, top: -30, side: 26, sideY: 2, badge: [22, -32] };

  function waves(ctx, p, env, a, A) {
    const col = U.lighten(p.tint, 0.1);
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      const ox = A.x + side * (A.side + 2);
      const oy = A.sideY;
      for (let i = 0; i < 3; i++) {
        const u = fract(p.tt / 0.8 + i / 3);
        const r = 4 + u * 11;
        const al = a * (1 - u) * smoothstep(0, 0.18, u);
        if (al < 0.01) continue;
        ctx.strokeStyle = env.c(col, al);
        ctx.lineWidth = 2.4 * (1 - u * 0.35);
        ctx.beginPath();
        const a0 = side > 0 ? -0.72 : Math.PI - 0.72;
        ctx.arc(ox, oy, r, a0, a0 + 1.44);
        ctx.stroke();
      }
    }
  }

  function dots(ctx, p, env, a, A) {
    const col = U.lighten(p.tint, 0.15);
    const bx = A.badge[0] - 6;
    const by = A.badge[1] + 2;
    for (let i = 0; i < 3; i++) {
      const ph = (p.tt / 0.8) * TAU - i * 0.95;
      const b = Math.max(0, Math.sin(ph));
      ctx.fillStyle = env.c(col, a * (0.4 + 0.6 * b));
      ctx.beginPath();
      ctx.arc(bx + i * 6.2, by - b * 3.4, 2.5, 0, TAU);
      ctx.fill();
    }
  }

  function sparkles(ctx, p, env, a, A) {
    const x = p.loopT;
    const col = U.lighten(p.tint, 0.35);
    const cy = A.y - 4;
    if (x < 1.0) {
      const u = x / 1.0;
      const e = U.easeOut(u);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU + 0.35 + (U.hash(i + 1) - 0.5) * 0.3;
        const d = 18 + e * 20 * (0.75 + 0.5 * U.hash(i + 9));
        const r = (4 - 2.8 * u) * (0.7 + 0.5 * U.hash(i + 3));
        const al = a * (1 - u * u);
        ctx.fillStyle = env.c(i % 3 === 0 ? U.WHITE : col, al);
        ctx.beginPath();
        U.star4(ctx, A.x + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.9, r);
        ctx.fill();
      }
    }
    for (let i = 0; i < 3; i++) {
      const start = 1.0 + i * 0.38;
      const k = clamp((x - start) / 0.7);
      if (k <= 0 || k >= 1) continue;
      const s = Math.sin(k * Math.PI);
      const ang = -2.2 + i * 1.6;
      const d = 30 + U.hash(i + 20) * 6;
      ctx.fillStyle = env.c(col, a * s);
      ctx.beginPath();
      U.star4(ctx, A.x + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.85, 2.8 * s + 0.4);
      ctx.fill();
    }
  }

  function burst(ctx, p, env, a, A) {
    const x = p.loopT;
    if (x > 0.6) return;
    const u = x / 0.6;
    ctx.strokeStyle = env.c(U.lighten(p.tint, 0.25), a * (1 - u) * 0.9);
    ctx.lineWidth = 3.4 * (1 - u) + 0.3;
    ctx.beginPath();
    ctx.arc(A.x, A.y - 4, 12 + 34 * U.easeOut(u), 0, TAU);
    ctx.stroke();
  }

  function recDot(ctx, p, env, a, A) {
    const pulse = 0.5 + 0.5 * U.osc(p.tt, K.state('recording').loop, 2);
    const x = A.rec ? A.rec[0] : -A.badge[0];
    const y = A.rec ? A.rec[1] : A.badge[1];
    F.glow(ctx, x, y, 8, p.tint, a * 0.5 * pulse, env);
    ctx.fillStyle = env.c(p.tint, a * (0.55 + 0.45 * pulse));
    ctx.beginPath();
    ctx.arc(x, y, 3.6, 0, TAU);
    ctx.fill();
  }

  function zzz(ctx, p, env, a, A) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 3; i++) {
      const u = fract(p.tt / 2 + i / 3);
      const al = a * Math.sin(u * Math.PI);
      if (al < 0.02) continue;
      const sz = 2.2 + u * 2.6;
      const zx = A.badge[0] - 8 + u * 10 + Math.sin(u * TAU) * 1.4;
      const zy = A.badge[1] + 10 - u * 15;
      ctx.strokeStyle = env.c(Z_COLOR, al);
      ctx.lineWidth = Math.max(1, sz * 0.45);
      ctx.beginPath();
      ctx.moveTo(zx - sz, zy - sz);
      ctx.lineTo(zx + sz, zy - sz);
      ctx.lineTo(zx - sz, zy + sz);
      ctx.lineTo(zx + sz, zy + sz);
      ctx.stroke();
    }
  }

  function battery(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const w = 12;
    const h = 6.6;
    const on = U.osc(p.tt, K.state('lowbattery').loop, 3) > -0.2 ? 1 : 0.25;
    ctx.save();
    ctx.translate(bx, by);
    ctx.strokeStyle = env.c([236, 236, 242], a);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    U.rr(ctx, -w / 2, -h / 2, w, h, 1.6);
    ctx.stroke();
    ctx.fillStyle = env.c([236, 236, 242], a);
    ctx.fillRect(w / 2 + 0.2, -1.4, 1.5, 2.8);
    ctx.fillStyle = env.c(K.tint(env.theme, 'recording'), a * on);
    ctx.beginPath();
    U.rr(ctx, -w / 2 + 1.7, -h / 2 + 1.7, 2.6, h - 3.4, 0.6);
    ctx.fill();
    ctx.restore();
  }

  function sweat(ctx, p, env, a, A) {
    const u = fract(p.tt / K.state('lowbattery').loop);
    const al = a * U.win(u, 0, 1, 0.2);
    if (al < 0.02) return;
    const x = A.x + A.side * 0.82 + 1;
    const y = (A.sweatY == null ? A.sideY - 10 : A.sweatY) + u * 5;
    ctx.fillStyle = env.c(SWEAT, al);
    ctx.beginPath();
    F.drop(ctx, x, y, 2.3);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, al * 0.8);
    ctx.beginPath();
    ctx.arc(x - 0.8, y - 0.4, 0.7, 0, TAU);
    ctx.fill();
  }

  function bang(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const pop = 1 + 0.16 * Math.max(0, Math.sin((p.tt / 0.8) * TAU));
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(pop, pop);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.moveTo(-4.6, 4.2);
    ctx.lineTo(-8.4, 8.6);
    ctx.lineTo(-1.6, 6.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(INK, a);
    ctx.beginPath();
    U.rr(ctx, -1.25, -4.6, 2.5, 6, 1.25);
    ctx.arc(0, 3.4, 1.4, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Done: a check pops into the badge just after the happy hop, and draws itself in.
  function check(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const k = U.clamp((p.tt - 0.3) / 0.32);
    if (k <= 0) return;
    const s = 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2); // springs in, a touch past full size
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.moveTo(-4.6, 4.2);
    ctx.lineTo(-8.4, 8.6);
    ctx.lineTo(-1.6, 6.4);
    ctx.closePath();
    ctx.fill();
    const len = 10.4;
    const d = U.clamp((p.tt - 0.48) / 0.24);
    if (d > 0) {
      ctx.strokeStyle = env.c(INK, a);
      ctx.lineWidth = 2.1;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([len * d, len]);
      ctx.beginPath();
      ctx.moveTo(-3.4, 0.1);
      ctx.lineTo(-1, 2.6);
      ctx.lineTo(3.6, -2.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function question(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const bob = 1.2 * Math.sin((p.tt / K.state('confused').loop) * TAU * 2);
    ctx.save();
    ctx.translate(bx, by + bob);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.moveTo(-4.6, 4.2);
    ctx.lineTo(-8.4, 8.6);
    ctx.lineTo(-1.6, 6.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(INK, a);
    ctx.lineWidth = 1.9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.2, -2.2);
    ctx.quadraticCurveTo(-2.2, -4.7, 0, -4.7);
    ctx.quadraticCurveTo(2.3, -4.7, 2.3, -2.6);
    ctx.quadraticCurveTo(2.3, -1.1, 0.3, -0.5);
    ctx.lineTo(0.2, 0.9);
    ctx.stroke();
    ctx.fillStyle = env.c(INK, a);
    ctx.beginPath();
    ctx.arc(0.2, 3.5, 1.25, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function bolt(ctx, x, y, s) {
    ctx.moveTo(x + 0.35 * s, y - s);
    ctx.lineTo(x - 0.6 * s, y + 0.15 * s);
    ctx.lineTo(x - 0.02 * s, y + 0.15 * s);
    ctx.lineTo(x - 0.3 * s, y + s);
    ctx.lineTo(x + 0.62 * s, y - 0.2 * s);
    ctx.lineTo(x + 0.04 * s, y - 0.2 * s);
    ctx.closePath();
  }

  function charging(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    const L = K.state('charging').loop;
    const fill = 0.25 + 0.75 * U.easeInOut(U.fract(p.tt / L));
    const w = 13;
    const h = 7.4;
    ctx.save();
    ctx.translate(bx - 1, by);
    ctx.strokeStyle = env.c([236, 236, 242], a);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    U.rr(ctx, -w / 2, -h / 2, w, h, 1.8);
    ctx.stroke();
    ctx.fillStyle = env.c([236, 236, 242], a);
    ctx.fillRect(w / 2 + 0.2, -1.5, 1.5, 3);
    ctx.fillStyle = env.c(p.tint, a);
    ctx.beginPath();
    U.rr(ctx, -w / 2 + 1.6, -h / 2 + 1.6, (w - 3.2) * fill, h - 3.2, 0.7);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, a);
    ctx.beginPath();
    bolt(ctx, 0, 0, 3.3);
    ctx.fill();
    ctx.restore();
  }

  function micoff(ctx, p, env, a, A) {
    const [bx, by] = A.badge;
    ctx.save();
    ctx.translate(bx, by);
    ctx.strokeStyle = env.c([226, 230, 238], a);
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    U.rr(ctx, -2.3, -5.6, 4.6, 7.6, 2.3);
    ctx.moveTo(-4.4, -0.4);
    ctx.quadraticCurveTo(-4.4, 4.2, 0, 4.2);
    ctx.quadraticCurveTo(4.4, 4.2, 4.4, -0.4);
    ctx.moveTo(0, 4.2);
    ctx.lineTo(0, 6.4);
    ctx.stroke();
    ctx.strokeStyle = env.c(U.lighten(p.tint, 0.3), a);
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-5.6, -6.2);
    ctx.lineTo(5.6, 6.6);
    ctx.stroke();
    ctx.restore();
  }

  // hello: sparkles pop beside the winking eye. No words, so it reads the same in every language.
  const POP_COL = U.rgb('#FFF4CC');
  function pop(ctx, p, env, a, A) {
    const x = p.loopT;
    const [bx, by] = A.badge;
    const stars = [
      [0.68, -7, 7, 3.4],
      [0.8, 2, -2, 4.6],
      [0.92, 8, 8, 2.8],
    ];
    for (let i = 0; i < stars.length; i++) {
      const [t0, dx, dy, r] = stars[i];
      const s = U.easeOutBack(U.clamp((x - t0) / 0.2)) * (1 - U.smoothstep(t0 + 0.42, t0 + 0.7, x));
      if (s < 0.02) continue;
      ctx.save();
      ctx.translate(bx + dx, by + dy + 5);
      ctx.rotate(0.35 * (1 - s) + i * 0.4);
      F.glow(ctx, 0, 0, r * 2.6 * s, POP_COL, 0.4 * a, env);
      ctx.fillStyle = env.c(POP_COL, a);
      ctx.beginPath();
      U.star4(ctx, 0, 0, r * s);
      ctx.fill();
      ctx.restore();
    }
  }

  function hearts(ctx, p, env, a, A) {
    const L = K.state('love').loop;
    const col = U.lighten(p.tint, 0.15);
    for (let i = 0; i < 4; i++) {
      const u = fract(p.tt / L + i / 4);
      const al = a * Math.sin(u * Math.PI);
      if (al < 0.02) continue;
      const side = i % 2 ? 1 : -1;
      const x = A.x + side * (A.side + 2 + 3 * U.hash(i + 4)) + 2 * Math.sin(u * TAU + i);
      const y = A.y + 6 - u * 30;
      ctx.fillStyle = env.c(col, al);
      ctx.beginPath();
      F.heart(ctx, x, y, 2.6 + 1.6 * U.hash(i + 1));
      ctx.fill();
    }
  }

  // wave: a hand beside Bud, raised and waving from the wrist. Bud has no arms, so it floats where one
  // would be, out past its right eye and a little lower, in Bud's own color: a palm, four fingers and
  // the thumb toward Bud. It pops up as the wave starts, then waves four times a loop.
  function hand(ctx, p, env, a, A) {
    const L = K.state('wave').loop;
    const up = U.easeOutBack(clamp(p.tt / 0.4));
    const col = U.lighten(p.tint, 0.08);
    ctx.save();
    ctx.translate(A.x + A.side + 8, A.sideY + 16); // the wrist
    ctx.rotate(0.12 + 0.34 * Math.sin((TAU * 4 * p.loopT) / L) * smoothstep(0.15, 0.45, p.tt)); // leaning out a little, waving
    ctx.scale(1.05 * up, 1.05 * up);
    F.glow(ctx, 0, -12, 15, col, 0.3 * a, env);
    ctx.fillStyle = env.c(col, a);
    ctx.beginPath();
    U.rr(ctx, -5.5, -13, 11, 10.5, 4);
    ctx.fill();
    for (const [x, len, tilt] of [[-4.1, 6.6, -0.16], [-1.4, 8, -0.05], [1.4, 7.6, 0.05], [4.1, 6, 0.17]]) {
      ctx.save();
      ctx.translate(x, -11.5);
      ctx.rotate(tilt);
      ctx.beginPath();
      U.rr(ctx, -1.25, -len, 2.5, len + 1.5, 1.25);
      ctx.fill();
      ctx.restore();
    }
    ctx.translate(-4.8, -6.5);
    ctx.rotate(-0.95);
    ctx.beginPath();
    U.rr(ctx, -1.35, -6, 2.7, 6.8, 1.35);
    ctx.fill();
    ctx.restore();
  }

  const DRAWERS = { waves, dots, sparkles, burst, rec: recDot, zzz, battery, sweat, bang, check, question, bolt: charging, micoff, pop, hearts, hand };
  const ORDER = ['burst', 'waves', 'dots', 'sparkles', 'rec', 'zzz', 'battery', 'sweat', 'bang', 'check', 'question', 'bolt', 'micoff', 'pop', 'hearts', 'hand'];

  /** Draw a pose's overlays at overall alpha `alpha` (used to cross-fade during state changes). */
  function draw(ctx, pose, env, alpha, anchors) {
    if (alpha <= 0.01) return;
    const A = Object.assign({}, DEFAULT_ANCHORS, anchors || {});
    for (let i = 0; i < ORDER.length; i++) {
      const key = ORDER[i];
      const v = pose.fx[key];
      if (v && v > 0.01) {
        ctx.save();
        DRAWERS[key](ctx, pose, env, v * alpha, A);
        ctx.restore();
      }
    }
  }

  /* ------------------------------------------------------- ambient particles */

  /** Ambient particles a look can add, in outfit code order (code 1 first). */
  K.AMBIENTS = [];
  const LAYERS = Object.create(null);
  /** An ambience: code is its outfit code, def its K.AMBIENTS entry, layers its back() and front(). */
  K.registerAmbient = function (code, def, layers) {
    K.addRanked(K.AMBIENTS, def, code);
    LAYERS[def.id] = layers;
    return def;
  };

  // env.rate(hz) snaps a rate to whole cycles per loop when exporting sprites, so ambient
  // motion loops seamlessly too; live it returns hz unchanged.
  function ambient(ctx, kind, t, env, layer) {
    const B = env.bounds;
    const W = B.x1 - B.x0;
    const H = B.y1 - B.y0;
    const rate = env.rate || ((hz) => hz);
    const wave = (hz, ph) => Math.sin(TAU * (rate(hz) * t + (ph || 0)));
    ctx.save();
    // each ambience draws itself (lib/ambients/<id>.js), behind Bud, in front or both
    const draw = LAYERS[kind] && LAYERS[kind][layer];
    if (draw) draw(ctx, t, env, { B, W, H, rate, wave });
    ctx.restore();
  }

  /* ---------------------------------------------------- transition overlays */

  // Stage-space extras for the designed moves in transitions.js (the screen-edge ring for
  // "save" lives in screen.js because it follows the screen shape).
  const TRANSITION_FX = {
    flare(ctx, fr, env, A) {
      const u = fr.u;
      const col = U.lighten(fr.poseA ? fr.poseA.tint : fr.pose.tint, 0.15);
      const tx = A.x;
      const ty = A.top + 6;
      const ember = fr.poseA && 'orbitR' in fr.poseA.ex;
      if (!ember && u < 0.45) {
        const g = U.easeIn(u / 0.45);
        for (let i = 0; i < 3; i++) {
          const sx = A.badge[0] - 6 + i * 6.2;
          const sy = A.badge[1] + 2;
          ctx.fillStyle = env.c(col, 1 - 0.3 * g);
          ctx.beginPath();
          ctx.arc(U.lerp(sx, tx, g), U.lerp(sy, ty, g), 2.5 * (1 - 0.5 * g), 0, TAU);
          ctx.fill();
        }
      }
      const fl = U.hop(u, 0.38, 0.72);
      if (fl > 0.01) F.glow(ctx, A.x, A.y - 4, 18 + 30 * fl, U.WHITE, 0.55 * fl, env);
      if (u > 0.42 && u < 0.9) {
        const v = (u - 0.42) / 0.48;
        ctx.strokeStyle = env.c(U.lighten(fr.pose.tint, 0.3), 0.9 * (1 - v));
        ctx.lineWidth = 3 * (1 - v) + 0.4;
        ctx.beginPath();
        ctx.arc(A.x, A.y - 4, 14 + 32 * U.easeOut(v), 0, TAU);
        ctx.stroke();
      }
    },
    gather(ctx, fr, env, A) {
      const u = fr.u;
      if (u > 0.75) return;
      const col = U.lighten(fr.poseA ? fr.poseA.tint : fr.pose.tint, 0.1);
      ctx.lineCap = 'round';
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 3; i++) {
          const v = U.clamp(u / 0.75 + i * 0.12);
          const r = 16 - 13 * U.easeIn(v);
          const al = (1 - v) * U.smoothstep(0, 0.1, u);
          if (al < 0.02 || r < 1) continue;
          ctx.strokeStyle = env.c(col, al);
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          const a0 = side > 0 ? -0.72 : Math.PI - 0.72;
          ctx.arc(A.x + side * (A.side + 2), A.sideY, r, a0, a0 + 1.44);
          ctx.stroke();
        }
      }
    },
    mute(ctx, fr, env, A) {
      const u = fr.u;
      const g = U.smoothstep(0.15, 0.6, u);
      const al = 1 - U.smoothstep(0.75, 1, u);
      if (g < 0.01 || al < 0.01) return;
      ctx.strokeStyle = env.c(U.lighten(K.tint(env.theme, 'privacy'), 0.35), al);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(A.x - 22, A.y - 24);
      ctx.lineTo(A.x - 22 + 44 * g, A.y - 24 + 46 * g);
      ctx.stroke();
    },
    plug(ctx, fr, env, A) {
      const a = U.hop(fr.u, 0.05, 0.5);
      if (a < 0.02) return;
      F.glow(ctx, A.x, A.y - 4, 30, K.tint(env.theme, 'charging'), 0.5 * a, env);
      ctx.fillStyle = env.c(U.lighten(K.tint(env.theme, 'charging'), 0.4), a);
      ctx.beginPath();
      bolt(ctx, A.x, A.y - 4, 10 + 6 * a);
      ctx.fill();
    },
    swoon(ctx, fr, env, A) {
      const v = U.clamp((fr.u - 0.2) / 0.7);
      if (v <= 0 || v >= 1) return;
      const col = U.lighten(K.tint(env.theme, 'love'), 0.15);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + 0.5;
        const d = 12 + 26 * U.easeOut(v);
        ctx.fillStyle = env.c(col, 1 - v);
        ctx.beginPath();
        F.heart(ctx, A.x + Math.cos(ang) * d, A.y - 4 + Math.sin(ang) * d * 0.85, 2.6 * (1 - 0.4 * v));
        ctx.fill();
      }
    },
    greet(ctx, fr, env, A) {
      const v = U.clamp((fr.u - 0.08) / 0.7);
      if (v <= 0 || v >= 1) return;
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.55;
        const d = 22 + 14 * U.easeOut(v);
        ctx.fillStyle = env.c(i % 2 ? U.WHITE : [255, 226, 140], 1 - v);
        ctx.beginPath();
        U.star4(ctx, A.x + Math.cos(ang) * d, A.y - 4 + Math.sin(ang) * d, 3.2 * (1 - v) + 0.6);
        ctx.fill();
      }
    },
    wake(ctx, fr, env, A) {
      const a = U.hop(fr.u, 0.12, 0.62);
      if (a < 0.02) return;
      ctx.strokeStyle = env.c([236, 236, 242], a);
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      [-0.55, 0, 0.55].forEach((ang) => {
        const x = A.x + Math.sin(ang) * 4;
        const y = A.top + 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.sin(ang) * 3, y - Math.cos(ang) * 3);
        ctx.lineTo(x + Math.sin(ang) * (6 + 3 * a), y - Math.cos(ang) * (6 + 3 * a));
        ctx.stroke();
      });
    },
  };

  /** Draw the stage-space overlay of a running transition (fr = { tr, u, pose, poseA, poseB }). */
  function transition(ctx, fr, env, anchors) {
    if (!fr || !fr.tr) return;
    const fn = TRANSITION_FX[fr.tr.id];
    if (!fn) return;
    ctx.save();
    fn(ctx, fr, env, Object.assign({}, DEFAULT_ANCHORS, anchors || {}));
    ctx.restore();
  }

  K.FX = { draw, ambient, transition, DEFAULT_ANCHORS, ORDER };
})(window.Bud);

;
// lib/ambients/bats.js
/* Bats, ambience 9 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(9, { id: 'bats', label: 'Bats' }, {
    back(ctx, t, env, { B, W, H, rate, wave }) {
      for (let i = 0; i < 3; i++) {
        const sp = 0.07 + 0.03 * U.hash(i);
        const u = fract(U.hash(i * 5.5) + t * rate(sp));
        const x = B.x0 - 8 + u * (W + 16);
        const y = B.y0 + H * (0.12 + 0.22 * U.hash(i * 3.7)) + 3 * wave(0.318, i / TAU);
        const f = wave(1.91, (i * 2) / TAU);
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = env.c([150, 120, 210], 0.9);
        ctx.beginPath();
        ctx.ellipse(0, 0, 1.5, 1.9, 0, 0, TAU);
        ctx.moveTo(-1.2, -0.4);
        ctx.quadraticCurveTo(-4, -3.2 * f - 1, -6.4, -0.6 * f);
        ctx.quadraticCurveTo(-4.4, 0.2, -3.2, 1.1);
        ctx.quadraticCurveTo(-2.2, 0.4, -1.2, 0.8);
        ctx.moveTo(1.2, -0.4);
        ctx.quadraticCurveTo(4, -3.2 * f - 1, 6.4, -0.6 * f);
        ctx.quadraticCurveTo(4.4, 0.2, 3.2, 1.1);
        ctx.quadraticCurveTo(2.2, 0.4, 1.2, 0.8);
        ctx.fill();
        ctx.restore();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/confetti.js
/* Confetti, ambience 6 (its outfit code): drawn in front of Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(6, { id: 'confetti', label: 'Confetti' }, {
    front(ctx, t, env, { B, W, H, rate, wave }) {
      const cols = [[255, 92, 138], [255, 216, 77], [74, 168, 255], [74, 222, 128], [169, 139, 255]];
      for (let i = 0; i < 16; i++) {
        const sp = 8 + 6 * U.hash(i * 2.7);
        const u = fract(U.hash(i * 6.1) + t * rate(sp / (H + 10)));
        const x = B.x0 + U.hash(i * 3.9) * W + 2.5 * wave(0.25, i / TAU);
        const y = B.y0 - 5 + u * (H + 10);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(TAU * rate(0.3 + 0.4 * U.hash(i)) * t + i);
        ctx.scale(wave(0.8 + 0.6 * U.hash(i * 1.9), i / TAU), 1);
        ctx.fillStyle = env.c(cols[i % cols.length], 0.95);
        ctx.fillRect(-1.4, -0.85, 2.8, 1.7);
        ctx.restore();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/fireflies.js
/* Fireflies, ambience 1 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const F = K.Face;

  K.registerAmbient(1, { id: 'fireflies', label: 'Fireflies' }, {
    back(ctx, t, env, { B, W, H, wave }) {
      for (let i = 0; i < 7; i++) {
        const x = B.x0 + W * (0.5 + 0.42 * wave((0.21 + 0.1 * U.hash(i)) / TAU, (i * 2.3) / TAU));
        const y = B.y0 + H * (0.5 + 0.4 * wave((0.17 + 0.08 * U.hash(i + 4)) / TAU, (i * 1.7) / TAU));
        const tw = 0.5 + 0.5 * wave((2 + U.hash(i + 2) * 2) / TAU, i / TAU);
        F.glow(ctx, x, y, 6, [232, 255, 120], 0.45 * tw, env);
        ctx.fillStyle = env.c([245, 255, 190], 0.6 + 0.4 * tw);
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, TAU);
        ctx.fill();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/notes.js
/* Music, ambience 7 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  // Canonical app a0a697a: hash(i * 3.3), hash(i), hash(i * 7.7), frozen as binary64.
  // Firmware wardrobe/notes_seeds.inc stores their binary32 rounding. Do not resample.
  const NOTES_SEEDS = [
    [0.8193039737561776, 0.8193039737561776, 0.8193039737561776],
    [0.13875052042567404, 0.10467192550277105, 0.28723763824018533],
    [0.6593669948961178, 0.8001120227854699, 0.8940612899932603],
    [0.28634302130012657, 0.6297139996895567, 0.0861935725188232],
    [0.040223235708253924, 0.77850105969992, 0.2013074443602818],
    [0.6013259836508951, 0.5623689354324597, 0.6565490502252942],
  ];

  K.registerAmbient(7, { id: 'notes', label: 'Music' }, {
    back(ctx, t, env, { B, W, H, rate, wave }) {
      const cols = [[169, 139, 255], [74, 168, 255], [255, 120, 170]];
      const mid = (B.x0 + B.x1) / 2;
      for (let i = 0; i < 6; i++) {
        const u = fract(NOTES_SEEDS[i][0] + t * rate(0.2 + 0.08 * NOTES_SEEDS[i][1]));
        const side = i % 2 ? 1 : -1;
        const x = mid + side * (W * 0.33 + 4 * NOTES_SEEDS[i][2]) + 3 * wave(0.5, i / TAU);
        const y = B.y1 - 10 - u * H * 0.7;
        const a = Math.sin(Math.PI * u);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(0.25 * wave(0.4, i / TAU));
        ctx.fillStyle = env.c(cols[i % 3], 0.9 * a);
        ctx.beginPath();
        U.ellipse(ctx, 0, 0, 2, 1.45, -0.4);
        ctx.fill();
        ctx.fillRect(1.25, -6.4, 0.75, 6.2);
        if (i % 3 === 0) {
          ctx.beginPath();
          U.ellipse(ctx, 4.6, -1, 2, 1.45, -0.4);
          ctx.fill();
          ctx.fillRect(5.85, -7.4, 0.75, 6.2);
          ctx.beginPath();
          ctx.moveTo(1.25, -6.4);
          ctx.lineTo(6.6, -7.4);
          ctx.lineTo(6.6, -5.8);
          ctx.lineTo(1.25, -4.8);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(2, -6.4);
          ctx.quadraticCurveTo(4.6, -5, 3.8, -2.6);
          ctx.quadraticCurveTo(3.7, -4.2, 2, -4.6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/petals.js
/* Petals, ambience 4 (its outfit code): drawn in front of Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(4, { id: 'petals', label: 'Petals' }, {
    front(ctx, t, env, { B, W, H, rate, wave }) {
      for (let i = 0; i < 11; i++) {
        const sp = 5 + 5 * U.hash(i * 2.1);
        const u = fract(U.hash(i * 4.7) + t * rate(sp / (H + 10)));
        const x = B.x0 + fract(U.hash(i * 3.3) + u * 0.35) * W + 3 * wave(0.207, (i * 2) / TAU);
        const y = B.y0 - 5 + u * (H + 10);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(TAU * rate((1 + U.hash(i)) / TAU) * t + i);
        ctx.scale(1, 0.55 + 0.45 * wave(0.35, i / TAU));
        ctx.fillStyle = env.c([255, 183, 210], 0.9);
        ctx.beginPath();
        U.ellipse(ctx, 0, 0, 2.3, 1.4);
        ctx.fill();
        ctx.restore();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/rain.js
/* Rain, ambience 5 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { fract } = U;

  K.registerAmbient(5, { id: 'rain', label: 'Rain' }, {
    back(ctx, t, env, { B, W, H, rate }) {
      ctx.lineCap = 'round';
      for (let i = 0; i < 20; i++) {
        const sp = 42 + 20 * U.hash(i * 1.7);
        const u = fract(U.hash(i * 5.3) + t * rate(sp / (H + 12)));
        const x = B.x0 + U.hash(i * 2.3) * (W + 6) - u * 4;
        const y = B.y0 - 6 + u * (H + 12);
        ctx.strokeStyle = env.c([150, 200, 255], 0.3 + 0.3 * U.hash(i * 9.1));
        ctx.lineWidth = 0.7 + 0.4 * U.hash(i * 4.4);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 1.1, y + 4.6);
        ctx.stroke();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/snow.js
/* Snow, ambience 3 (its outfit code): drawn in front of Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, fract } = U;

  K.registerAmbient(3, { id: 'snow', label: 'Snow' }, {
    front(ctx, t, env, { B, W, H, rate, wave }) {
      for (let i = 0; i < 22; i++) {
        const sp = 5 + 7 * U.hash(i * 1.3);
        const x = B.x0 + U.hash(i * 3.1) * W + 2.6 * wave(0.143, i / TAU);
        const y = B.y0 - 3 + fract(U.hash(i * 7.3) + t * rate(sp / (H + 6))) * (H + 6);
        const r = 0.7 + 1.1 * U.hash(i * 1.7);
        ctx.fillStyle = env.c(U.WHITE, 0.55 + 0.4 * U.hash(i * 5.1));
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/sparkles.js
/* Sparkles, ambience 2 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;

  K.registerAmbient(2, { id: 'sparkles', label: 'Sparkles' }, {
    back(ctx, t, env, { B, W, H, wave }) {
      for (let i = 0; i < 7; i++) {
        const x = B.x0 + W * (0.08 + 0.84 * U.hash(i * 9.1));
        const y = B.y0 + H * (0.06 + 0.5 * U.hash(i * 2.9));
        const s = Math.max(0, wave(0.255, (i * 2.1) / TAU));
        if (s < 0.02) continue;
        ctx.fillStyle = env.c([255, 214, 102], 0.9 * s);
        ctx.beginPath();
        U.star4(ctx, x, y, 0.6 + 2.4 * s);
        ctx.fill();
      }
    },
  });
})(window.Bud);

;
// lib/ambients/stars.js
/* Moon and stars, ambience 8 (its outfit code): drawn behind Bud. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const F = K.Face;

  K.registerAmbient(8, { id: 'stars', label: 'Moon and stars' }, {
    back(ctx, t, env, { B, W, H, wave }) {
      const mx = B.x0 + W * 0.25;
      const my = B.y0 + H * 0.25;
      F.glow(ctx, mx, my, 15, [255, 232, 160], 0.35, env);
      ctx.fillStyle = env.c([255, 241, 196]);
      ctx.beginPath();
      ctx.arc(mx, my, 5.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = env.c([226, 206, 150], 0.7);
      ctx.beginPath();
      ctx.arc(mx - 1.6, my - 1.2, 1.2, 0, TAU);
      ctx.arc(mx + 1.8, my + 1.4, 0.9, 0, TAU);
      ctx.arc(mx + 0.6, my - 2.4, 0.6, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 10; i++) {
        const x = B.x0 + W * (0.1 + 0.8 * U.hash(i * 4.3));
        const y = B.y0 + H * (0.08 + 0.6 * U.hash(i * 8.1));
        if (Math.hypot(x - mx, y - my) < 13) continue;
        const tw = 0.5 + 0.5 * wave(0.3 + 0.3 * U.hash(i), i / TAU);
        ctx.fillStyle = env.c([255, 250, 225], 0.3 + 0.65 * tw);
        ctx.beginPath();
        U.star4(ctx, x, y, 0.7 + 1.5 * tw);
        ctx.fill();
      }
    },
  });
})(window.Bud);

;
// lib/accessories/_kit.js
/* The wardrobe's kit: what the accessory files share, and the lists they join.
 *
 * Each accessory (an item Bud can wear) is one file, lib/accessories/<slot>/<id>.js, that draws
 * it and registers it: K.registerBuiltin for the 21 built-ins, by outfit code (Bud draws those
 * itself), K.registerFind for the place finds and K.registerReward for the rewards, by their place
 * in K.FINDS and K.REWARDS. A factory that makes several items keeps them in one file (school
 * scarves, pennants, snow globes). Copy _template.js to add one, then run node tools/lib-files.mjs.
 *
 * Characters decide where things go by calling env.acc(ctx, slot, anchor) while they draw, with
 * anchor = { x, y, w, rot } in their own local coordinates:
 *   head: bottom-center of where a hat sits, w = head width (optional ear: [dx, dy] from
 *         the anchor to where headphone cups go)
 *   face: center between the eyes, dx = half the eye spacing, rx/ry = one eye's half size
 *   neck: center of where a scarf wraps, w = width to wrap
 *   item: where a held item hangs, w = scale (1 = about 13 stage units tall)
 * The looks (K.PACKS) are in lib/looks.js, the ambiences in lib/ambients/.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;

  const C = {
    pumpkin: U.rgb('#FF8A1F'),
    pumpkinDark: U.rgb('#D96400'),
    stem: U.rgb('#4E8F2E'),
    carve: U.rgb('#FFE066'),
    gat: U.rgb('#23232B'),
    gatEdge: U.rgb('#A9A9BC'),
    bead: U.rgb('#E8C07A'),
    petal: U.rgb('#FFB7CF'),
    petalDeep: U.rgb('#FF5C8A'),
    witch: U.rgb('#6B4BD8'),
    witchBand: U.rgb('#FF9A2E'),
    lanternBlue: U.rgb('#2F5DA8'),
    lanternRed: U.rgb('#D9452B'),
    gold: U.rgb('#F2C14E'),
    light: U.rgb('#FFE7A0'),
    pouch: U.rgb('#E8402E'),
    pouchDark: U.rgb('#B52A1E'),
    saekdong: ['#E8402E', '#F2C14E', '#2E8B6E', '#2F5DA8', '#F28AB2'].map(U.rgb),
    earPink: U.rgb('#FF9EBB'),
    gemRed: U.rgb('#E5484D'),
    gemBlue: U.rgb('#4AA8FF'),
    phones: U.rgb('#ECECF2'),
    lens: U.rgb('#14161C'),
    cup: U.rgb('#F7F3EC'),
    sleeve: U.rgb('#B07A4F'),
    canopyRib: U.rgb('#FFFFFF'),
    // place finds
    bridge: U.rgb('#E8542C'),
    water: U.rgb('#2F5DA8'),
    beret: U.rgb('#D9302F'),
    copper: U.rgb('#5FB8A2'),
    flame: U.rgb('#FFB547'),
    jade: U.rgb('#7FD1AE'),
    lock: U.rgb('#FF5C8A'),
    steel: U.rgb('#C9CDD6'),
    stick: U.rgb('#C99A5B'),
    dangoPink: U.rgb('#FFA3C4'),
    dangoGreen: U.rgb('#9BD67A'),
    busby: U.rgb('#1C1C22'),
    plume: U.rgb('#E5484D'),
    leiPetals: ['#FF7EB3', '#FFD84D', '#FFFFFF', '#FF9A2E', '#C78BFF'].map(U.rgb),
    board: U.rgb('#F7F3EC'),
    boardStripe: U.rgb('#2BB3A3'),
    cap: U.rgb('#C8102E'),
    duck: U.rgb('#FFD84D'),
    beak: U.rgb('#FF9A2E'),
    tea: U.rgb('#B5651D'),
    crimson: U.rgb('#A51C30'),
    rocket: U.rgb('#ECECF2'),
    fin: U.rgb('#E5484D'),
    flamingo: U.rgb('#FF8FB1'),
    straw: U.rgb('#E9C77B'),
    fan: U.rgb('#FF6F91'),
    bread: U.rgb('#D99A4E'),
    cupRed: U.rgb('#E8402E'),
    noodle: U.rgb('#F6D58C'),
    // Christmas
    santa: U.rgb('#D92B3A'),
    santaDark: U.rgb('#A51D2C'),
    fur: U.rgb('#FBF8F2'),
    furShade: U.rgb('#DCD6CC'),
    beard: U.rgb('#EEE8DE'),
    gift: U.rgb('#2F9E5B'),
    giftDark: U.rgb('#23784A'),
  };

  /** Gentle sway; loop-safe when exporting sprites (env.wave), plain sine otherwise. */
  function sway(env, k, ph) {
    return env.wave ? env.wave(k / TAU, (ph || 0) / TAU) : Math.sin(env.t * k + (ph || 0));
  }

  function begin(ctx, a) {
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.rot) ctx.rotate(a.rot);
  }

  /** A five-petal blossom (the blossom hat, the cherry branch). */
  function flower(ctx, x, y, r, env, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = env.c(C.petal);
    for (let i = 0; i < 5; i++) {
      ctx.rotate(TAU / 5);
      ctx.beginPath();
      U.ellipse(ctx, 0, -r * 0.62, r * 0.42, r * 0.6);
      ctx.fill();
    }
    ctx.fillStyle = env.c(C.petalDeep);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** One lens's half width and half height, for glasses at the face anchor. */
  function lensSize(a) {
    const lw = Math.min(a.rx * 1.25 + 1, a.dx - 1.5);
    return [lw, a.ry + 1];
  }

  /** The knit scarf (built-in 13) in the theme's scarf colors; the school and tartan scarves wear it in theirs. */
  function scarf(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const hw = w / 2;
    const bh = Math.max(4, w * 0.2);
    begin(ctx, a);
    const sw = sway(env, 2.1) * 0.12;
    ctx.save();
    ctx.translate(hw * 0.45, bh * 0.4);
    ctx.rotate(0.18 + sw);
    ctx.fillStyle = env.c(U.darken(col.scarf, 0.08));
    ctx.beginPath();
    U.rr(ctx, -bh * 0.42, 0, bh * 0.84, bh * 2.1, bh * 0.25);
    ctx.fill();
    ctx.fillStyle = env.c(col.scarf2);
    ctx.fillRect(-bh * 0.42, bh * 0.9, bh * 0.84, bh * 0.28);
    ctx.strokeStyle = env.c(U.darken(col.scarf, 0.08));
    ctx.lineWidth = Math.max(0.5, bh * 0.1);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * bh * 0.26, bh * 2.05);
      ctx.lineTo(i * bh * 0.26, bh * 2.45);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-hw, -bh / 2);
    ctx.quadraticCurveTo(0, bh * 0.35, hw, -bh / 2);
    ctx.lineTo(hw, bh / 2);
    ctx.quadraticCurveTo(0, bh * 1.35, -hw, bh / 2);
    ctx.closePath();
    ctx.fillStyle = env.c(col.scarf);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = env.c(col.scarf2);
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(i * hw * 0.42 - bh * 0.14, -bh, bh * 0.28, bh * 3);
    }
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(col.scarf, 0.12));
    ctx.beginPath();
    U.ellipse(ctx, hw * 0.45, bh * 0.45, bh * 0.42, bh * 0.38);
    ctx.fill();
    ctx.restore();
  }

  /** Five-point star. */
  function star5(ctx, x, y, r, inner = 0.48) {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * inner : r;
      const t = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i) ctx.lineTo(x + rad * Math.cos(t), y + rad * Math.sin(t));
      else ctx.moveTo(x + rad * Math.cos(t), y + rad * Math.sin(t));
    }
    ctx.closePath();
  }

  const P = {
    ink: U.rgb('#1B1B22'),
    orange: U.rgb('#F2742B'),
    yale: U.rgb('#1F3A6B'),
    columbia: U.rgb('#8DBCE8'),
    cardinal: U.rgb('#9B1C24'),
    berkeley: U.rgb('#1D3E7A'),
    tartanGreen: U.rgb('#1F6B45'),
    tartanRed: U.rgb('#C7333A'),
    tartanGold: U.rgb('#F2C14E'),
    glass: U.rgb('#CFE8FF'),
    sky: U.rgb('#9FD3F2'),
    night: U.rgb('#26305A'),
    sand: U.rgb('#E9C27B'),
    snowcap: U.rgb('#F4F7FB'),
    mountain: U.rgb('#5B6FB8'),
    clay: U.rgb('#C8643B'),
    wood: U.rgb('#B98A55'),
    woodDark: U.rgb('#8A5E33'),
    brass: U.rgb('#D9A441'),
    bronze: U.rgb('#A8743A'),
    leaf: U.rgb('#58B368'),
    leafDark: U.rgb('#2F7D47'),
    pink: U.rgb('#FF8FB1'),
    cream: U.rgb('#FFF4DC'),
    crust: U.rgb('#D9973F'),
    crustDark: U.rgb('#A8651F'),
    sauce: U.rgb('#D93A2B'),
    cheese: U.rgb('#FFD45E'),
    rice: U.rgb('#FBFAF5'),
    nori: U.rgb('#1E3B2A'),
    tea: U.rgb('#C98A4B'),
    matcha: U.rgb('#8CC152'),
    mint: U.rgb('#5DC08A'),
    stone: U.rgb('#8C8F98'),
    gray: U.rgb('#9AA0AA'),
    tan: U.rgb('#D6A46B'),
    sea: U.rgb('#3FA7D6'),
    navy: U.rgb('#24325F'),
    red: U.rgb('#E2433B'),
    yellow: U.rgb('#FFD84D'),
    purple: U.rgb('#9B6BD8'),
    blue: U.rgb('#4A8FE7'),
  };
  const WHITE = U.WHITE;

  /** A held item: at the hand, swaying a little, scaled. Ends with ctx.restore(). */
  function hold(ctx, a, env, k = 2, amp = 0.4) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, k) * amp);
    ctx.scale(s, s);
  }
  /** Fills the path `draw` makes, in one color. */
  function paint(ctx, env, col, draw, alpha) {
    ctx.fillStyle = env.c(col, alpha);
    ctx.beginPath();
    draw();
    ctx.fill();
  }
  /** Strokes the path `draw` makes, round-ended. */
  function ink(ctx, env, col, width, draw, alpha) {
    ctx.strokeStyle = env.c(col, alpha);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    draw();
    ctx.stroke();
  }
  /** A soft highlight. */
  function gleam(ctx, env, x, y, rx, ry, rot = 0, alpha = 0.32) {
    paint(ctx, env, WHITE, () => U.ellipse(ctx, x, y, rx, ry, rot), alpha);
  }
  /** Rising steam, two wisps. */
  function steam(ctx, env, y, gap = 2.4) {
    for (let i = 0; i < 2; i++) {
      const x0 = -gap / 2 + i * gap;
      const k = sway(env, 2.6, i * 2.2);
      ink(ctx, env, WHITE, 0.7, () => {
        ctx.moveTo(x0, y);
        ctx.bezierCurveTo(x0 + 1.3 * k, y - 1.5, x0 - 1.3 * k, y - 2.7, x0 + 0.5 * k, y - 4.2);
      }, 0.45);
    }
  }

  // A cup of something hot, or cold, by the place it's from.
  function steamingCup(ctx, a, env, body, top, wisps = true) {
    hold(ctx, a, env, 2, 0.3);
    if (wisps) steam(ctx, env, -4.8);
    body();
    top();
    ctx.restore();
  }

  /** Two little eyes (and a shine), for a plush face. */
  function plushEyes(ctx, env, x, y, gap, r) {
    for (const s of [-1, 1]) {
      paint(ctx, env, C.lens, () => ctx.arc(x + s * gap, y, r, 0, TAU));
      paint(ctx, env, WHITE, () => ctx.arc(x + s * gap - r * 0.3, y - r * 0.35, r * 0.35, 0, TAU), 0.9);
    }
  }
  /** Two pink cheeks, for a plush face. */
  function blush(ctx, env, x, y, gap, r) {
    paint(ctx, env, C.earPink, () => {
      U.ellipse(ctx, x - gap, y, r, r * 0.55);
      U.ellipse(ctx, x + gap, y, r, r * 0.55);
    }, 0.6);
  }

  /* ------------------------------------------------------------- the lists */

  const DRAW = { head: {}, face: {}, neck: {}, item: {} };

  /** Draw whatever the current outfit puts in `slot`. Called by characters via env.acc. */
  function drawSlot(ctx, slot, anchor, env, acc) {
    const id = acc && acc[slot];
    const fn = id && DRAW[slot] && DRAW[slot][id];
    if (!fn) return false;
    ctx.save();
    fn(ctx, anchor, env);
    ctx.restore();
    return true;
  }

  /** The wardrobe's slots. An outfit wears one item per slot; the looks (lib/looks.js) are preset outfits. */
  K.SLOTS = [
    { id: 'head', label: 'Head' },
    { id: 'face', label: 'Face' },
    { id: 'neck', label: 'Neck' },
    { id: 'item', label: 'Holding' },
  ];
  /** The 21 built-ins, in outfit code order (code 1 first): the accessories Bud draws itself. */
  K.ACCESSORIES = [];

  /** Pieces earned: Best buds with friends, when a friend you invited joins Bud and you become
   * friends (both get it), and Santa's (how: 'christmas'), which the wardrobe has all year. Not in
   * ACCESSORIES: the wardrobe shows them once earned. */
  K.REWARDS = [];

  /** Place finds: a piece you get by visiting its place (within radius meters), for a Bud
   * passport. Not in ACCESSORIES: the wardrobe shows them once found. */
  K.FINDS = [];

  function add(list, rank, def, draw) {
    K.addRanked(list, def, rank);
    DRAW[def.slot][def.id] = draw;
    return def;
  }
  /** A built-in: code is its outfit code (1 to 21, what Bluetooth sends), def its K.ACCESSORIES entry. */
  K.registerBuiltin = (code, def, draw) => add(K.ACCESSORIES, code, def, draw);
  /** A place find: order is its place in K.FINDS (1 first), def its entry (with `place`). */
  K.registerFind = (order, def, draw) => add(K.FINDS, order, def, draw);
  /** A reward: order is its place in K.REWARDS, def its entry (with `how`). */
  K.registerReward = (order, def, draw) => add(K.REWARDS, order, def, draw);

  K.accessory = (id) => K.ACCESSORIES.find((a) => a.id === id) || K.FINDS.find((a) => a.id === id) || null;

  /** Turn the explorer's accessory list (['beanie', 'scarf']) into slot form; the last piece per slot wins. */
  K.accFromToggles = function (ids) {
    const out = {};
    (ids || []).forEach((id) => {
      const a = K.ACCESSORIES.find((x) => x.id === id);
      if (a) out[a.slot] = a.id;
    });
    return out;
  };

  K.AccKit = { C, sway, begin, flower, lensSize, scarf, star5, P, WHITE, hold, paint, ink, gleam, steam, steamingCup, plushEyes, blush };
  K.Acc = { DRAW, drawSlot };
})(window.Bud);

;
// lib/accessories/face/divingGoggles.js
/* Diving goggles, worn on the face: a piece found at Haenyeo Museum, Jeju (find 68: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { begin, lensSize, P, paint, ink, gleam } = K.AccKit;

  // Haenyeo Museum: a Jeju diver's round goggles, rimmed in orange rubber.
  function divingGoggles(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const r = Math.max(lw, lh) * 1.05;
    begin(ctx, a);
    ink(ctx, env, P.orange, Math.max(0.8, r * 0.18), () => {
      ctx.moveTo(-a.dx - r, 0);
      ctx.lineTo(-a.dx - r * 1.7, -r * 0.2);
      ctx.moveTo(a.dx + r, 0);
      ctx.lineTo(a.dx + r * 1.7, -r * 0.2);
    });
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      paint(ctx, env, P.glass, () => ctx.arc(cx, 0, r, 0, TAU), 0.45);
      ink(ctx, env, P.orange, Math.max(0.9, r * 0.24), () => ctx.arc(cx, 0, r, 0, TAU));
      gleam(ctx, env, cx - r * 0.35, -r * 0.35, r * 0.28, r * 0.14, -0.6, 0.55);
    }
    ink(ctx, env, U.darken(P.orange, 0.2), Math.max(0.8, r * 0.18), () => {
      ctx.moveTo(-a.dx + r * 0.9, 0);
      ctx.quadraticCurveTo(0, -r * 0.3, a.dx - r * 0.9, 0);
    });
    ctx.restore();
  }

  K.registerFind(68, { id: 'divingGoggles', label: 'Diving goggles', kr: '물안경', slot: 'face', place: { name: 'Haenyeo Museum', city: 'Jeju', lat: 33.5228, lon: 126.8635, radius: 500 } }, divingGoggles);
})(window.Bud);

;
// lib/accessories/face/operaGlasses.js
/* Opera glasses, worn on the face: a piece found at Sydney Opera House, Sydney (find 95: Oceania). */
(function (K) {
  'use strict';
  const { TAU } = K.util;
  const { C, begin, lensSize, paint, ink, gleam } = K.AccKit;

  // Sydney Opera House: gold opera glasses on a little handle.
  function operaGlasses(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const r = Math.max(lw, lh) * 0.95;
    begin(ctx, a);
    ink(ctx, env, C.gold, Math.max(0.9, r * 0.22), () => {
      ctx.moveTo(a.dx + r * 0.6, r * 0.6);
      ctx.lineTo(a.dx + r * 1.4, r * 2.6);
    });
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      paint(ctx, env, C.lens, () => ctx.arc(cx, 0, r, 0, TAU), 0.85);
      ink(ctx, env, C.gold, Math.max(0.9, r * 0.26), () => ctx.arc(cx, 0, r, 0, TAU));
      gleam(ctx, env, cx - r * 0.3, -r * 0.3, r * 0.25, r * 0.12, -0.6, 0.5);
    }
    ink(ctx, env, C.gold, Math.max(0.9, r * 0.3), () => {
      ctx.moveTo(-a.dx + r, 0);
      ctx.lineTo(a.dx - r, 0);
    });
    paint(ctx, env, C.lock, () => ctx.arc(0, 0, r * 0.22, 0, TAU));
    ctx.restore();
  }

  K.registerFind(95, { id: 'operaGlasses', label: 'Opera glasses', slot: 'face', place: { name: 'Sydney Opera House', city: 'Sydney', lat: -33.857, lon: 151.2151, radius: 500 } }, operaGlasses);
})(window.Bud);

;
// lib/accessories/face/roundGlasses.js
/* Round glasses, worn on the face: built-in accessory 12 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, begin } = K.AccKit;

  function roundGlasses(ctx, a, env) {
    const r = Math.min(Math.max(a.rx, a.ry) * 1.05 + 1.5, a.dx - 1);
    begin(ctx, a);
    const fw = Math.max(0.7, r * 0.1);
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      ctx.fillStyle = env.c(U.WHITE, 0.05);
      ctx.beginPath();
      ctx.arc(cx, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = env.c(U.WHITE, 0.28);
      ctx.lineWidth = fw * 0.9;
      ctx.beginPath();
      ctx.arc(cx, 0, r * 0.72, -2.5, -1.75);
      ctx.stroke();
      ctx.strokeStyle = env.c(C.gold);
      ctx.lineWidth = fw;
      ctx.beginPath();
      ctx.arc(cx, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-a.dx + r, -r * 0.18);
    ctx.quadraticCurveTo(0, -r * 0.42, a.dx - r, -r * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(12, { id: 'roundGlasses', label: 'Round glasses', slot: 'face', kind: 'Glasses' }, roundGlasses);
})(window.Bud);

;
// lib/accessories/face/santaBeard.js
/* Santa beard, worn on the face: a Christmas piece (reward 3), in the wardrobe all year. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint } = K.AccKit;

  // Christmas: a round, fluffy beard under the eyes, with a bright white mustache on top.
  function santaBeard(ctx, a, env) {
    const k = a.ry;
    const hw = a.dx + a.rx * 1.2;
    const top = k * 1.05;
    const low = k * 2.45;
    const side = k * 0.35; // where the sideburns end, beside the eyes
    begin(ctx, a);
    ctx.translate(0, sway(env, 1.5) * k * 0.02);
    // the beard, rising beside the eyes, and the curls along its lower edge
    paint(ctx, env, C.beard, () => {
      ctx.moveTo(-hw, side);
      ctx.quadraticCurveTo(-hw, low, 0, low);
      ctx.quadraticCurveTo(hw, low, hw, side);
      ctx.quadraticCurveTo(hw * 0.86, top, hw * 0.55, top);
      ctx.lineTo(-hw * 0.55, top);
      ctx.quadraticCurveTo(-hw * 0.86, top, -hw, side);
      ctx.closePath();
    });
    ctx.fillStyle = env.c(C.beard);
    for (let i = 0; i < 5; i++) {
      const t = (0.12 + i * 0.19) * Math.PI;
      ctx.beginPath();
      ctx.arc(-Math.cos(t) * hw * 0.84, top + Math.sin(t) * (low - top) * 0.88, k * 0.26, 0, TAU);
      ctx.fill();
    }
    // the mustache: two white curls from the middle, tipped up at their ends
    for (let s = -1; s <= 1; s += 2) {
      paint(ctx, env, U.WHITE, () => U.ellipse(ctx, s * a.dx * 0.46, top + k * 0.04, a.dx * 0.55, k * 0.26, s * -0.3));
    }
    ctx.restore();
  }

  K.registerReward(3, { id: 'santaBeard', label: 'Santa beard', slot: 'face', how: 'christmas' }, santaBeard);
})(window.Bud);

;
// lib/accessories/face/snorkelMask.js
/* Snorkel mask, worn on the face: a piece found at John Pennekamp Coral Reef State Park, Key Largo (find 56: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { begin, lensSize, P, paint, ink, gleam } = K.AccKit;

  // John Pennekamp reef: one wide snorkel mask, and the snorkel up the side.
  function snorkelMask(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const hw = a.dx + lw * 1.1;
    const hh = lh * 1.35;
    begin(ctx, a);
    ink(ctx, env, P.yellow, Math.max(1.1, hh * 0.3), () => {
      ctx.moveTo(hw + hh * 0.2, hh * 0.5);
      ctx.lineTo(hw + hh * 0.5, -hh * 0.4);
      ctx.lineTo(hw + hh * 0.5, -hh * 2.6);
    });
    paint(ctx, env, P.red, () => U.rr(ctx, hw + hh * 0.2, -hh * 3, hh * 0.6, hh * 0.5, hh * 0.15));
    paint(ctx, env, P.glass, () => U.rr(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.85), 0.42);
    ink(ctx, env, P.sea, Math.max(1, hh * 0.32), () => U.rr(ctx, -hw, -hh, hw * 2, hh * 2, hh * 0.85));
    gleam(ctx, env, -hw * 0.5, -hh * 0.45, hw * 0.25, hh * 0.18, -0.25, 0.55);
    ctx.restore();
  }

  K.registerFind(56, { id: 'snorkelMask', label: 'Snorkel mask', slot: 'face', place: { name: 'John Pennekamp Coral Reef State Park', city: 'Key Largo', lat: 25.12, lon: -80.405, radius: 2500 } }, snorkelMask);
})(window.Bud);

;
// lib/accessories/face/starGlasses.js
/* Star glasses, worn on the face: a piece found at Hollywood Sign, Los Angeles (find 8). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, begin, lensSize, star5 } = K.AccKit;

  // Hollywood Sign: star-shaped sunglasses.
  function starGlasses(ctx, a, env) {
    const [lw, lh] = lensSize(a);
    const r = Math.max(lw, lh) * 1.12;
    const fw = Math.max(0.8, r * 0.11);
    begin(ctx, a);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      ctx.beginPath();
      star5(ctx, cx, lh * 0.1, r);
      const g = ctx.createLinearGradient(0, -r, 0, r);
      g.addColorStop(0, env.c(U.mix(C.lens, C.lock, 0.35), 0.94));
      g.addColorStop(1, env.c(C.lens, 0.86));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = env.c(C.gold);
      ctx.lineWidth = fw;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = env.c(U.WHITE, 0.35);
      ctx.lineWidth = fw * 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.45, r * 0.3);
      ctx.lineTo(cx - r * 0.05, -r * 0.45);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = fw;
    ctx.beginPath();
    ctx.moveTo(-a.dx + r * 0.5, -lh * 0.2);
    ctx.quadraticCurveTo(0, -lh * 0.55, a.dx - r * 0.5, -lh * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(8, { id: 'starGlasses', label: 'Star glasses', slot: 'face', place: { name: 'Hollywood Sign', city: 'Los Angeles', lat: 34.1341, lon: -118.3215, radius: 4000 } }, starGlasses);
})(window.Bud);

;
// lib/accessories/face/sunglasses.js
/* Sunglasses, worn on the face: built-in accessory 11 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, begin, lensSize } = K.AccKit;

  function sunglasses(ctx, a, env) {
    const col = env.accColors;
    const [lw, lh] = lensSize(a);
    begin(ctx, a);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const fw = Math.max(0.8, Math.min(lw, lh) * 0.16);
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      ctx.beginPath();
      ctx.moveTo(cx - lw, -lh * 0.85);
      ctx.lineTo(cx + lw, -lh * 0.85);
      ctx.quadraticCurveTo(cx + lw * 1.04, lh * 0.55, cx + lw * 0.45, lh);
      ctx.lineTo(cx - lw * 0.45, lh);
      ctx.quadraticCurveTo(cx - lw * 1.04, lh * 0.55, cx - lw, -lh * 0.85);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -lh, 0, lh);
      g.addColorStop(0, env.c(C.lens, 0.94));
      g.addColorStop(1, env.c(U.mix(C.lens, col.hat, 0.35), 0.82));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = env.c(col.hat);
      ctx.lineWidth = fw;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = env.c(U.WHITE, 0.32);
      ctx.lineWidth = fw * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.62, lh * 0.55);
      ctx.lineTo(cx - lw * 0.02, -lh * 0.75);
      ctx.stroke();
      ctx.lineWidth = fw * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.22, lh * 0.7);
      ctx.lineTo(cx + lw * 0.3, -lh * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = env.c(col.hat);
    ctx.lineWidth = fw;
    ctx.beginPath();
    ctx.moveTo(-a.dx + lw * 0.95, -lh * 0.62);
    ctx.quadraticCurveTo(0, -lh * 0.95, a.dx - lw * 0.95, -lh * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(11, { id: 'sunglasses', label: 'Sunglasses', slot: 'face', kind: 'Glasses' }, sunglasses);
})(window.Bud);

;
// lib/accessories/head/ballCap.js
/* Ball cap, worn on the head: a piece found at Fenway Park, Boston (find 11). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Fenway Park: a ball cap, brim forward.
  function ballCap(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(0, -w * 0.01);
    ctx.rotate(-0.05 + sway(env, 1.6) * 0.015);
    ctx.fillStyle = env.c(U.darken(C.cap, 0.18));
    ctx.beginPath();
    ctx.moveTo(w * 0.05, -w * 0.02);
    ctx.quadraticCurveTo(w * 0.36, -w * 0.07, w * 0.44, w * 0.02);
    ctx.quadraticCurveTo(w * 0.3, w * 0.04, w * 0.05, w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.cap);
    ctx.beginPath();
    ctx.moveTo(-w * 0.27, 0);
    ctx.bezierCurveTo(-w * 0.27, -w * 0.31, w * 0.27, -w * 0.31, w * 0.27, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.cap, 0.25));
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.23);
    ctx.lineTo(0, 0);
    ctx.moveTo(-w * 0.14, -w * 0.2);
    ctx.quadraticCurveTo(-w * 0.12, -w * 0.08, -w * 0.13, 0);
    ctx.moveTo(w * 0.14, -w * 0.2);
    ctx.quadraticCurveTo(w * 0.12, -w * 0.08, w * 0.13, 0);
    ctx.stroke();
    ctx.fillStyle = env.c(U.WHITE, 0.9);
    ctx.beginPath();
    ctx.arc(0, -w * 0.235, w * 0.025, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.16);
    ctx.beginPath();
    U.ellipse(ctx, -w * 0.1, -w * 0.16, w * 0.07, w * 0.03, -0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(11, { id: 'ballCap', label: 'Ball cap', slot: 'head', place: { name: 'Fenway Park', city: 'Boston', lat: 42.3467, lon: -71.0972, radius: 500 } }, ballCap);
})(window.Bud);

;
// lib/accessories/head/beanie.js
/* Beanie, worn on the head: built-in accessory 1 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { begin } = K.AccKit;

  function beanie(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const hw = w * 0.5;
    const cuffH = w * 0.2;
    const domeH = w * 0.5;
    begin(ctx, a);
    ctx.beginPath();
    ctx.moveTo(-hw * 0.94, -cuffH * 0.5);
    ctx.bezierCurveTo(-hw * 0.98, -cuffH - domeH * 1.1, hw * 0.98, -cuffH - domeH * 1.1, hw * 0.94, -cuffH * 0.5);
    ctx.closePath();
    ctx.fillStyle = env.c(col.hat);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = env.c(U.darken(col.hat, 0.2), 0.55);
    ctx.lineWidth = Math.max(0.6, w * 0.03);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * hw * 0.26, -cuffH);
      ctx.quadraticCurveTo(i * hw * 0.2, -cuffH - domeH * 0.6, i * hw * 0.08, -cuffH - domeH);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(col.hat, 0.1));
    ctx.beginPath();
    U.rr(ctx, -hw, -cuffH, hw * 2, cuffH, cuffH * 0.45);
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(col.hat, 0.3), 0.5);
    ctx.lineWidth = Math.max(0.5, w * 0.025);
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * hw * 0.17, -cuffH * 0.8);
      ctx.lineTo(i * hw * 0.17, -cuffH * 0.2);
      ctx.stroke();
    }
    const py = -cuffH - domeH * 0.84 - w * 0.07;
    ctx.fillStyle = env.c(col.hat2);
    ctx.beginPath();
    ctx.arc(0, py, w * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(col.hat2, 0.12));
    ctx.beginPath();
    ctx.arc(w * 0.04, py + w * 0.05, w * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(1, { id: 'beanie', label: 'Beanie', slot: 'head', kind: 'Hat' }, beanie);
})(window.Bud);

;
// lib/accessories/head/beret.js
/* Beret, worn on the head: a piece found at Eiffel Tower, Paris (find 2). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Eiffel Tower: a red beret, worn at an angle.
  function beret(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(w * 0.04, -w * 0.03);
    ctx.rotate(-0.16 + sway(env, 1.6) * 0.02);
    ctx.fillStyle = env.c(U.darken(C.beret, 0.3));
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, w * 0.28, w * 0.06);
    ctx.fill();
    ctx.fillStyle = env.c(C.beret);
    ctx.beginPath();
    U.ellipse(ctx, w * 0.03, -w * 0.075, w * 0.37, w * 0.12);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.2);
    ctx.beginPath();
    U.ellipse(ctx, -w * 0.1, -w * 0.13, w * 0.14, w * 0.032, -0.08);
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.beret, 0.22));
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.03, -w * 0.19);
    ctx.lineTo(w * 0.06, -w * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(2, { id: 'beret', label: 'Beret', slot: 'head', place: { name: 'Eiffel Tower', city: 'Paris', lat: 48.8584, lon: 2.2945, radius: 800 } }, beret);
})(window.Bud);

;
// lib/accessories/head/blossom.js
/* Blossom, worn on the head: built-in accessory 9 (its outfit code). */
(function (K) {
  'use strict';
  const { sway, begin, flower } = K.AccKit;

  function blossom(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    flower(ctx, w * 0.3, -w * 0.06, w * 0.2, env, 0.3 + sway(env, 1.2) * 0.08);
    flower(ctx, w * 0.12, -w * 0.18, w * 0.13, env, 1.1);
    ctx.restore();
  }

  K.registerBuiltin(9, { id: 'blossom', label: 'Blossom', kr: '벚꽃', slot: 'head', kind: 'Flower (spring)' }, blossom);
})(window.Bud);

;
// lib/accessories/head/boater.js
/* Boater, worn on the head: a piece found at Rialto Bridge, Venice (find 91: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin, paint, ink } = K.AccKit;

  // Rialto Bridge: a gondolier's straw boater with a red ribbon.
  function boater(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(-0.05 + sway(env, 1.6) * 0.02);
    paint(ctx, env, U.darken(C.straw, 0.1), () => U.ellipse(ctx, 0, -w * 0.02, w * 0.46, w * 0.08));
    paint(ctx, env, C.straw, () => ctx.rect(-w * 0.23, -w * 0.22, w * 0.46, w * 0.2));
    paint(ctx, env, U.lighten(C.straw, 0.12), () => U.ellipse(ctx, 0, -w * 0.22, w * 0.23, w * 0.05));
    paint(ctx, env, C.cupRed, () => ctx.rect(-w * 0.23, -w * 0.12, w * 0.46, w * 0.06));
    const sw = sway(env, 2.4) * 0.05;
    paint(ctx, env, C.cupRed, () => {
      ctx.moveTo(w * 0.22, -w * 0.1);
      ctx.quadraticCurveTo(w * 0.32, -w * 0.02, w * (0.3 + sw), w * 0.12);
      ctx.lineTo(w * (0.26 + sw), w * 0.1);
      ctx.quadraticCurveTo(w * 0.27, 0, w * 0.2, -w * 0.07);
    });
    ink(ctx, env, U.darken(C.straw, 0.2), Math.max(0.3, w * 0.008), () => {
      for (let i = 1; i < 4; i++) {
        ctx.moveTo(-w * 0.23, -w * (0.12 + 0.025 * i) - w * 0.03);
        ctx.lineTo(w * 0.23, -w * (0.12 + 0.025 * i) - w * 0.03);
      }
    }, 0.6);
    ctx.restore();
  }

  K.registerFind(91, { id: 'boater', label: 'Boater', slot: 'head', place: { name: 'Rialto Bridge', city: 'Venice', lat: 45.438, lon: 12.3359, radius: 600 } }, boater);
})(window.Bud);

;
// lib/accessories/head/bucketHat.js
/* Hiking hat, worn on the head: a piece found at Bukhansan National Park, Seoul (find 63: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin, paint, ink } = K.AccKit;

  // Bukhansan: an olive hiking bucket hat, stitched round the brim.
  function bucketHat(ctx, a, env) {
    const w = a.w;
    const cloth = U.rgb('#8A9A5B');
    begin(ctx, a);
    ctx.rotate(sway(env, 1.6) * 0.015);
    paint(ctx, env, U.darken(cloth, 0.12), () => {
      ctx.moveTo(-w * 0.42, w * 0.03);
      ctx.lineTo(-w * 0.3, -w * 0.1);
      ctx.lineTo(w * 0.3, -w * 0.1);
      ctx.lineTo(w * 0.42, w * 0.03);
      ctx.quadraticCurveTo(0, w * 0.1, -w * 0.42, w * 0.03);
      ctx.closePath();
    });
    paint(ctx, env, cloth, () => {
      ctx.moveTo(-w * 0.28, -w * 0.08);
      ctx.bezierCurveTo(-w * 0.27, -w * 0.36, w * 0.27, -w * 0.36, w * 0.28, -w * 0.08);
      ctx.closePath();
    });
    ctx.setLineDash([w * 0.03, w * 0.025]);
    ink(ctx, env, U.lighten(cloth, 0.35), Math.max(0.35, w * 0.01), () => {
      ctx.moveTo(-w * 0.36, w * 0.02);
      ctx.quadraticCurveTo(0, w * 0.075, w * 0.36, w * 0.02);
      ctx.moveTo(-w * 0.26, -w * 0.14);
      ctx.quadraticCurveTo(0, -w * 0.11, w * 0.26, -w * 0.14);
    });
    ctx.setLineDash([]);
    paint(ctx, env, U.darken(cloth, 0.3), () => ctx.arc(w * 0.18, -w * 0.2, w * 0.018, 0, TAU));
    ctx.restore();
  }

  K.registerFind(63, { id: 'bucketHat', label: 'Hiking hat', kr: '등산모자', slot: 'head', place: { name: 'Bukhansan National Park', city: 'Seoul', lat: 37.6511, lon: 126.9614, radius: 2000 } }, bucketHat);
})(window.Bud);

;
// lib/accessories/head/bunnyEars.js
/* Bunny ears, worn on the head: built-in accessory 5 (its outfit code). */
(function (K) {
  'use strict';
  const { C, sway, begin } = K.AccKit;

  function bunnyEars(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const ew = w * 0.1;
    const eh = w * 0.5;
    begin(ctx, a);
    const sw = sway(env, 1.1);
    ctx.strokeStyle = env.c(col.hat2, 0.9);
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, w * 0.08);
    ctx.quadraticCurveTo(0, -w * 0.13, w * 0.44, w * 0.08);
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * w * 0.18, -w * 0.02);
      ctx.rotate(s * 0.14 + (s > 0 ? 0.32 + 0.06 * sw : 0.02 * sw));
      ctx.beginPath();
      ctx.moveTo(-ew, 0);
      ctx.bezierCurveTo(-ew * 1.35, -eh * 0.6, -ew * 0.8, -eh, 0, -eh);
      ctx.bezierCurveTo(ew * 0.8, -eh, ew * 1.35, -eh * 0.6, ew, 0);
      ctx.closePath();
      ctx.fillStyle = env.c(col.hat2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-ew * 0.42, -eh * 0.12);
      ctx.bezierCurveTo(-ew * 0.72, -eh * 0.6, -ew * 0.4, -eh * 0.86, 0, -eh * 0.86);
      ctx.bezierCurveTo(ew * 0.4, -eh * 0.86, ew * 0.72, -eh * 0.6, ew * 0.42, -eh * 0.12);
      ctx.closePath();
      ctx.fillStyle = env.c(C.earPink);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  K.registerBuiltin(5, { id: 'bunnyEars', label: 'Bunny ears', slot: 'head', kind: 'Ears' }, bunnyEars);
})(window.Bud);

;
// lib/accessories/head/busby.js
/* Guard hat, worn on the head: a piece found at Buckingham Palace, London (find 7). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Buckingham Palace: the guards' tall bearskin hat, with a red plume.
  function busby(ctx, a, env) {
    const w = a.w;
    const bw = w * 0.21;
    const bh = w * 0.64;
    begin(ctx, a);
    ctx.translate(0, -w * 0.01);
    ctx.rotate(sway(env, 1.5) * 0.015);
    ctx.fillStyle = env.c(C.busby);
    ctx.beginPath();
    ctx.moveTo(-bw, 0);
    ctx.bezierCurveTo(-bw * 1.2, -bh * 0.62, -bw * 0.78, -bh, 0, -bh);
    ctx.bezierCurveTo(bw * 0.78, -bh, bw * 1.2, -bh * 0.62, bw, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.WHITE, 0.16); // a soft rim, so it shows on dark themes too
    ctx.lineWidth = w * 0.018;
    ctx.stroke();
    ctx.fillStyle = env.c(U.lighten(C.busby, 0.12), 0.8);
    ctx.beginPath();
    for (const [x, y] of [[-0.45, 0.25], [0.3, 0.42], [-0.15, 0.62], [0.45, 0.75], [-0.5, 0.82]]) U.ellipse(ctx, bw * x, -bh * y, w * 0.03, w * 0.045);
    ctx.fill();
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = w * 0.028;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.95, -w * 0.035);
    ctx.quadraticCurveTo(0, w * 0.02, bw * 0.95, -w * 0.035);
    ctx.stroke();
    ctx.fillStyle = env.c(C.plume);
    ctx.beginPath();
    U.ellipse(ctx, -bw * 1.02, -bh * 0.55, w * 0.04, w * 0.12, -0.1);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(7, { id: 'busby', label: 'Guard hat', slot: 'head', place: { name: 'Buckingham Palace', city: 'London', lat: 51.5014, lon: -0.1419, radius: 700 } }, busby);
})(window.Bud);

;
// lib/accessories/head/catEars.js
/* Cat ears, worn on the head: built-in accessory 4 (its outfit code). */
(function (K) {
  'use strict';
  const { C, sway, begin } = K.AccKit;

  function catEars(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const ew = w * 0.17;
    const eh = w * 0.3;
    begin(ctx, a);
    const twitch = Math.max(0, sway(env, 1.3)) ** 6; // a quick flick now and then
    ctx.strokeStyle = env.c(col.hat2, 0.9);
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, w * 0.08);
    ctx.quadraticCurveTo(0, -w * 0.13, w * 0.44, w * 0.08);
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * w * 0.32, 0);
      ctx.rotate(s * (0.3 + (s > 0 ? 0.16 * twitch : 0)));
      ctx.beginPath();
      ctx.moveTo(-ew, 0);
      ctx.quadraticCurveTo(-ew * 0.55, -eh * 0.75, 0, -eh);
      ctx.quadraticCurveTo(ew * 0.55, -eh * 0.75, ew, 0);
      ctx.closePath();
      ctx.fillStyle = env.c(col.hat2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-ew * 0.55, -eh * 0.08);
      ctx.quadraticCurveTo(-ew * 0.3, -eh * 0.58, 0, -eh * 0.76);
      ctx.quadraticCurveTo(ew * 0.3, -eh * 0.58, ew * 0.55, -eh * 0.08);
      ctx.closePath();
      ctx.fillStyle = env.c(C.earPink);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  K.registerBuiltin(4, { id: 'catEars', label: 'Cat ears', slot: 'head', kind: 'Ears' }, catEars);
})(window.Bud);

;
// lib/accessories/head/cowboyHat.js
/* Cowboy hat, worn on the head: a piece found at Fort Worth Stockyards, Fort Worth (find 40: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint, gleam } = K.AccKit;

  // Fort Worth Stockyards: a brown cowboy hat with its brim curled up.
  function cowboyHat(ctx, a, env) {
    const w = a.w;
    const hat = U.rgb('#9A6235');
    begin(ctx, a);
    ctx.rotate(-0.05 + sway(env, 1.6) * 0.02);
    paint(ctx, env, U.darken(hat, 0.15), () => {
      ctx.moveTo(-w * 0.55, -w * 0.12);
      ctx.quadraticCurveTo(-w * 0.45, w * 0.03, 0, w * 0.02);
      ctx.quadraticCurveTo(w * 0.45, w * 0.03, w * 0.55, -w * 0.12);
      ctx.quadraticCurveTo(w * 0.42, -w * 0.02, 0, -w * 0.04);
      ctx.quadraticCurveTo(-w * 0.42, -w * 0.02, -w * 0.55, -w * 0.12);
      ctx.closePath();
    });
    paint(ctx, env, hat, () => {
      ctx.moveTo(-w * 0.24, -w * 0.04);
      ctx.bezierCurveTo(-w * 0.28, -w * 0.36, -w * 0.08, -w * 0.32, 0, -w * 0.26);
      ctx.bezierCurveTo(w * 0.08, -w * 0.32, w * 0.28, -w * 0.36, w * 0.24, -w * 0.04);
      ctx.closePath();
    });
    paint(ctx, env, U.rgb('#3B2A1E'), () => ctx.rect(-w * 0.245, -w * 0.11, w * 0.49, w * 0.05));
    paint(ctx, env, C.steel, () => ctx.arc(w * 0.12, -w * 0.085, w * 0.025, 0, TAU));
    gleam(ctx, env, -w * 0.12, -w * 0.24, w * 0.06, w * 0.03, -0.4, 0.2);
    ctx.restore();
  }

  K.registerFind(40, { id: 'cowboyHat', label: 'Cowboy hat', slot: 'head', place: { name: 'Fort Worth Stockyards', city: 'Fort Worth', lat: 32.7903, lon: -97.3461, radius: 700 } }, cowboyHat);
})(window.Bud);

;
// lib/accessories/head/crown.js
/* Crown, worn on the head: built-in accessory 3 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function crown(ctx, a, env) {
    const w = a.w;
    const cw = w * 0.25;
    const ch = w * 0.27;
    begin(ctx, a);
    ctx.translate(0, -w * 0.02);
    ctx.beginPath();
    ctx.moveTo(-cw, 0);
    ctx.lineTo(-cw, -ch * 0.78);
    ctx.lineTo(-cw * 0.48, -ch * 0.36);
    ctx.lineTo(0, -ch);
    ctx.lineTo(cw * 0.48, -ch * 0.36);
    ctx.lineTo(cw, -ch * 0.78);
    ctx.lineTo(cw, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -ch, 0, 0);
    g.addColorStop(0, env.c(U.lighten(C.gold, 0.4)));
    g.addColorStop(1, env.c(U.darken(C.gold, 0.1)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.gold, 0.22));
    ctx.fillRect(-cw, -ch * 0.24, cw * 2, ch * 0.24);
    ctx.fillStyle = env.c(C.gemRed);
    ctx.beginPath();
    ctx.arc(0, -ch * 0.12, w * 0.032, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(C.gemBlue);
    ctx.beginPath();
    ctx.arc(-cw * 0.62, -ch * 0.12, w * 0.024, 0, TAU);
    ctx.arc(cw * 0.62, -ch * 0.12, w * 0.024, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.lighten(C.gold, 0.55));
    [[-cw, -ch * 0.78], [0, -ch], [cw, -ch * 0.78]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, w * 0.028, 0, TAU);
      ctx.fill();
    });
    const tw = Math.max(0, sway(env, 2.2));
    if (tw > 0.05) {
      ctx.fillStyle = env.c(U.WHITE, 0.9 * tw);
      ctx.beginPath();
      U.star4(ctx, cw * 0.5, -ch * 0.66, w * 0.06 * tw);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerBuiltin(3, { id: 'crown', label: 'Crown', slot: 'head', kind: 'Hat' }, crown);
})(window.Bud);

;
// lib/accessories/head/edelweiss.js
/* Edelweiss, worn on the head: a piece found at Zermatt (find 88: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin, P, paint } = K.AccKit;

  // Zermatt: edelweiss, two woolly white stars tucked over one ear.
  function edelweissFlower(ctx, x, y, r, env, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      paint(ctx, env, U.rgb('#F3F1E6'), () => U.ellipse(ctx, 0, -r * 0.6, r * 0.24, r * 0.55));
      paint(ctx, env, U.rgb('#C9D3B6'), () => U.ellipse(ctx, 0, -r * 0.92, r * 0.1, r * 0.16), 0.8);
    }
    paint(ctx, env, U.rgb('#E9C84E'), () => ctx.arc(0, 0, r * 0.28, 0, TAU));
    ctx.restore();
  }
  function edelweiss(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    paint(ctx, env, P.leafDark, () => U.ellipse(ctx, w * 0.36, -w * 0.02, w * 0.04, w * 0.1, 0.9));
    edelweissFlower(ctx, w * 0.3, -w * 0.08, w * 0.17, env, 0.2 + sway(env, 1.2) * 0.06);
    edelweissFlower(ctx, w * 0.12, -w * 0.17, w * 0.11, env, 0.8);
    ctx.restore();
  }

  K.registerFind(88, { id: 'edelweiss', label: 'Edelweiss', slot: 'head', place: { name: 'Zermatt', city: 'Zermatt', lat: 46.019, lon: 7.7496, radius: 1500 } }, edelweiss);
})(window.Bud);

;
// lib/accessories/head/gat.js
/* Gat, worn on the head: built-in accessory 8 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function gat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.lineWidth = Math.max(0.6, w * 0.035);
    ctx.fillStyle = env.c(C.gat, 0.9);
    ctx.strokeStyle = env.c(C.gatEdge, 0.85);
    ctx.beginPath();
    U.ellipse(ctx, 0, -w * 0.02, w * 0.78, w * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -w * 0.06);
    ctx.lineTo(-w * 0.23, -w * 0.42);
    ctx.quadraticCurveTo(0, -w * 0.5, w * 0.23, -w * 0.42);
    ctx.lineTo(w * 0.25, -w * 0.06);
    ctx.quadraticCurveTo(0, w * 0.02, -w * 0.25, -w * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = env.c(C.gatEdge, 0.5);
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, -w * 0.13);
    ctx.quadraticCurveTo(0, -w * 0.08, w * 0.24, -w * 0.13);
    ctx.stroke();
    // beaded chin string (갓끈) hanging off the far side of the brim
    ctx.fillStyle = env.c(C.bead);
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      ctx.beginPath();
      ctx.arc(-w * (0.6 + 0.08 * u), w * (0.06 + 0.42 * u) + sway(env, 2, i) * 0.15, w * 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerBuiltin(8, { id: 'gat', label: 'Gat', kr: '갓', slot: 'head', kind: 'Hat (Korean traditional)' }, gat);
})(window.Bud);

;
// lib/accessories/head/headphones.js
/* Headphones, worn on the head: built-in accessory 6 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  function headphones(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const ear = a.ear || [w * 0.56, w * 0.42];
    begin(ctx, a);
    if (ear[2]) ctx.translate(ear[2], 0); // cups centered on the body even when the hat anchor is off-center
    ctx.translate(0, Math.max(0, sway(env, 4.4)) * w * 0.012); // nodding to the beat
    ctx.lineCap = 'round';
    ctx.strokeStyle = env.c(C.phones);
    ctx.lineWidth = w * 0.06;
    ctx.beginPath();
    ctx.moveTo(-ear[0], ear[1] - w * 0.1);
    ctx.bezierCurveTo(-ear[0] * 1.02, -w * 0.4, ear[0] * 1.02, -w * 0.4, ear[0], ear[1] - w * 0.1);
    ctx.stroke();
    ctx.strokeStyle = env.c(col.hat);
    ctx.lineWidth = w * 0.028;
    ctx.beginPath();
    ctx.moveTo(-ear[0] * 0.62, -w * 0.17);
    ctx.bezierCurveTo(-ear[0] * 0.3, -w * 0.29, ear[0] * 0.3, -w * 0.29, ear[0] * 0.62, -w * 0.17);
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * ear[0], ear[1]);
      ctx.fillStyle = env.c(C.phones);
      ctx.beginPath();
      U.rr(ctx, -w * 0.085, -w * 0.16, w * 0.17, w * 0.32, w * 0.075);
      ctx.fill();
      ctx.fillStyle = env.c(col.hat);
      ctx.beginPath();
      U.rr(ctx, -s * w * 0.035 - w * 0.04, -w * 0.12, w * 0.08, w * 0.24, w * 0.04);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  K.registerBuiltin(6, { id: 'headphones', label: 'Headphones', slot: 'head', kind: 'Audio' }, headphones);
})(window.Bud);

;
// lib/accessories/head/laurelWreath.js
/* Laurel wreath, worn on the head: a piece found at Colosseum, Rome (find 89: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin, P, paint, ink } = K.AccKit;

  // The Colosseum: a laurel wreath, leaves meeting at the front.
  function laurelWreath(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(0, -w * 0.04);
    for (const s of [-1, 1]) {
      ink(ctx, env, P.leafDark, Math.max(0.4, w * 0.015), () => {
        ctx.moveTo(s * w * 0.04, w * 0.02);
        ctx.quadraticCurveTo(s * w * 0.38, -w * 0.02, s * w * 0.4, -w * 0.22);
      });
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const x = s * w * (0.08 + 0.32 * u);
        const y = w * (0.01 - 0.2 * u * u);
        const rot = s * (0.4 + u * 0.9) + sway(env, 2, i) * 0.04;
        paint(ctx, env, i % 2 ? P.leaf : P.leafDark, () => U.ellipse(ctx, x, y - w * 0.04, w * 0.035, w * 0.075, rot));
      }
    }
    paint(ctx, env, C.gold, () => U.ellipse(ctx, 0, w * 0.02, w * 0.045, w * 0.03));
    ctx.restore();
  }

  K.registerFind(89, { id: 'laurelWreath', label: 'Laurel wreath', slot: 'head', place: { name: 'Colosseum', city: 'Rome', lat: 41.8903, lon: 12.4922, radius: 500 } }, laurelWreath);
})(window.Bud);

;
// lib/accessories/head/newsboyCap.js
/* Newsboy cap, worn on the head: a piece found at Brooklyn Bridge, New York (find 32: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin, paint, ink, gleam } = K.AccKit;

  // Brooklyn Bridge: a gray newsboy cap with a little button on top.
  function newsboyCap(ctx, a, env) {
    const w = a.w;
    const cap = U.rgb('#7D8590');
    begin(ctx, a);
    ctx.translate(0, -w * 0.01);
    ctx.rotate(-0.06 + sway(env, 1.6) * 0.015);
    paint(ctx, env, U.darken(cap, 0.25), () => {
      ctx.moveTo(-w * 0.05, -w * 0.01);
      ctx.quadraticCurveTo(-w * 0.32, -w * 0.05, -w * 0.4, w * 0.03);
      ctx.quadraticCurveTo(-w * 0.24, w * 0.05, -w * 0.05, w * 0.02);
      ctx.closePath();
    });
    paint(ctx, env, cap, () => {
      ctx.moveTo(-w * 0.3, 0);
      ctx.bezierCurveTo(-w * 0.42, -w * 0.26, w * 0.36, -w * 0.32, w * 0.33, -w * 0.02);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(cap, 0.18), Math.max(0.4, w * 0.012), () => {
      for (const k of [-0.16, 0, 0.16]) {
        ctx.moveTo(k * w, -w * 0.21);
        ctx.quadraticCurveTo(k * w * 1.3, -w * 0.1, k * w * 1.5, 0);
      }
    });
    paint(ctx, env, U.darken(cap, 0.3), () => ctx.arc(-w * 0.02, -w * 0.215, w * 0.03, 0, TAU));
    gleam(ctx, env, -w * 0.08, -w * 0.15, w * 0.08, w * 0.025, -0.3, 0.18);
    ctx.restore();
  }

  K.registerFind(32, { id: 'newsboyCap', label: 'Newsboy cap', slot: 'head', place: { name: 'Brooklyn Bridge', city: 'New York', lat: 40.7061, lon: -73.9969, radius: 1000 } }, newsboyCap);
})(window.Bud);

;
// lib/accessories/head/partyHat.js
/* Party hat, worn on the head: built-in accessory 2 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function partyHat(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const bw = w * 0.21;
    const hh = w * 0.58;
    begin(ctx, a);
    ctx.translate(w * 0.17, 0);
    ctx.rotate(0.24 + sway(env, 1.8) * 0.03);
    ctx.beginPath();
    ctx.moveTo(-bw, 0);
    ctx.lineTo(0, -hh);
    ctx.lineTo(bw, 0);
    ctx.quadraticCurveTo(0, bw * 0.35, -bw, 0);
    ctx.closePath();
    ctx.fillStyle = env.c(col.hat);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = env.c(col.hat2, 0.95);
    ctx.lineWidth = w * 0.055;
    for (let i = 0; i < 5; i++) {
      const y = -hh * (0.08 + 0.21 * i);
      ctx.beginPath();
      ctx.moveTo(-bw, y + bw * 0.45);
      ctx.lineTo(bw, y - bw * 0.35);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = env.c(C.gold);
    ctx.beginPath();
    ctx.arc(0, -hh, w * 0.075, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.6);
    ctx.beginPath();
    ctx.arc(-w * 0.02, -hh - w * 0.025, w * 0.025, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(2, { id: 'partyHat', label: 'Party hat', slot: 'head', kind: 'Hat' }, partyHat);
})(window.Bud);

;
// lib/accessories/head/pirateHat.js
/* Pirate hat, worn on the head: a piece found at Tampa Riverwalk, Tampa (find 55: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin, star5, P, paint, ink } = K.AccKit;

  // Tampa Riverwalk: a pirate captain's hat with a white plume (no skull).
  function pirateHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(0.04 + sway(env, 1.6) * 0.02);
    const sw = sway(env, 2.2) * 0.04;
    paint(ctx, env, U.rgb('#F7F3EC'), () => {
      ctx.moveTo(w * 0.05, -w * 0.3);
      ctx.bezierCurveTo(w * 0.28, -w * (0.62 + sw), w * 0.5, -w * 0.5, w * 0.42, -w * 0.32);
      ctx.bezierCurveTo(w * 0.3, -w * 0.42, w * 0.15, -w * 0.36, w * 0.05, -w * 0.3);
    });
    paint(ctx, env, P.ink, () => {
      ctx.moveTo(-w * 0.52, -w * 0.06);
      ctx.quadraticCurveTo(-w * 0.36, -w * 0.48, 0, -w * 0.4);
      ctx.quadraticCurveTo(w * 0.36, -w * 0.48, w * 0.52, -w * 0.06);
      ctx.quadraticCurveTo(0, w * 0.08, -w * 0.52, -w * 0.06);
      ctx.closePath();
    });
    ink(ctx, env, C.gold, Math.max(0.6, w * 0.03), () => {
      ctx.moveTo(-w * 0.52, -w * 0.06);
      ctx.quadraticCurveTo(-w * 0.36, -w * 0.48, 0, -w * 0.4);
      ctx.quadraticCurveTo(w * 0.36, -w * 0.48, w * 0.52, -w * 0.06);
    });
    paint(ctx, env, C.gold, () => star5(ctx, 0, -w * 0.2, w * 0.07));
    ctx.restore();
  }

  K.registerFind(55, { id: 'pirateHat', label: 'Pirate hat', slot: 'head', place: { name: 'Tampa Riverwalk', city: 'Tampa', lat: 27.9484, lon: -82.4619, radius: 1200 } }, pirateHat);
})(window.Bud);

;
// lib/accessories/head/rangerHat.js
/* Ranger hat, worn on the head: a piece found at Yosemite Valley, Yosemite (find 39: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, begin, paint, ink, gleam } = K.AccKit;

  // Yosemite: a park ranger's hat, pinched on top, with a brown band.
  function rangerHat(ctx, a, env) {
    const w = a.w;
    const felt = U.rgb('#C9A36A');
    begin(ctx, a);
    ctx.rotate(sway(env, 1.6) * 0.015);
    paint(ctx, env, U.darken(felt, 0.12), () => U.ellipse(ctx, 0, -w * 0.02, w * 0.52, w * 0.08));
    paint(ctx, env, felt, () => {
      ctx.moveTo(-w * 0.2, -w * 0.04);
      ctx.lineTo(-w * 0.17, -w * 0.3);
      ctx.lineTo(-w * 0.06, -w * 0.36);
      ctx.lineTo(0, -w * 0.31);
      ctx.lineTo(w * 0.06, -w * 0.36);
      ctx.lineTo(w * 0.17, -w * 0.3);
      ctx.lineTo(w * 0.2, -w * 0.04);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(felt, 0.22), Math.max(0.4, w * 0.012), () => {
      ctx.moveTo(0, -w * 0.31);
      ctx.lineTo(0, -w * 0.18);
    });
    paint(ctx, env, U.rgb('#6B4423'), () => ctx.rect(-w * 0.2, -w * 0.11, w * 0.4, w * 0.06));
    gleam(ctx, env, -w * 0.25, -w * 0.05, w * 0.12, w * 0.02, 0, 0.2);
    ctx.restore();
  }

  K.registerFind(39, { id: 'rangerHat', label: 'Ranger hat', slot: 'head', place: { name: 'Yosemite Valley', city: 'Yosemite', lat: 37.7487, lon: -119.5872, radius: 1500 } }, rangerHat);
})(window.Bud);

;
// lib/accessories/head/santaHat.js
/* Santa hat, worn on the head: a Christmas piece (reward 2), in the wardrobe all year. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint } = K.AccKit;

  // Christmas: a soft red hat whose tip flops over to one side, a fluffy white brim and a pompom.
  function santaHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(0.05 + sway(env, 1.7) * 0.02);
    // the hat, rising from the brim and flopping over to the right
    paint(ctx, env, C.santa, () => {
      ctx.moveTo(-w * 0.3, -w * 0.06);
      ctx.quadraticCurveTo(-w * 0.26, -w * 0.5, w * 0.08, -w * 0.55);
      ctx.quadraticCurveTo(w * 0.36, -w * 0.58, w * 0.44, -w * 0.34);
      ctx.quadraticCurveTo(w * 0.24, -w * 0.4, w * 0.3, -w * 0.06);
      ctx.closePath();
    });
    // the fold's shadow, under the flop
    paint(ctx, env, C.santaDark, () => {
      ctx.moveTo(w * 0.12, -w * 0.4);
      ctx.quadraticCurveTo(w * 0.3, -w * 0.47, w * 0.44, -w * 0.34);
      ctx.quadraticCurveTo(w * 0.26, -w * 0.38, w * 0.12, -w * 0.4);
      ctx.closePath();
    });
    paint(ctx, env, U.WHITE, () => U.ellipse(ctx, -w * 0.1, -w * 0.36, w * 0.06, w * 0.12, 0.5), 0.2);
    // the brim: a band of fur with a soft, bumpy edge
    paint(ctx, env, C.fur, () => U.rr(ctx, -w * 0.34, -w * 0.15, w * 0.68, w * 0.14, w * 0.07));
    ctx.fillStyle = env.c(C.fur);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(-w * 0.26 + i * w * 0.13, -w * 0.15, w * 0.045, 0, TAU);
      ctx.fill();
    }
    paint(ctx, env, C.furShade, () => U.rr(ctx, -w * 0.3, -w * 0.045, w * 0.6, w * 0.03, w * 0.015), 0.8);
    // the pompom, swinging a little
    const swing = sway(env, 2.3, 1) * w * 0.012;
    paint(ctx, env, C.fur, () => ctx.arc(w * 0.45 + swing, -w * 0.3, w * 0.075, 0, TAU));
    paint(ctx, env, C.furShade, () => ctx.arc(w * 0.47 + swing, -w * 0.27, w * 0.035, 0, TAU), 0.7);
    ctx.restore();
  }

  K.registerReward(2, { id: 'santaHat', label: 'Santa hat', slot: 'head', how: 'christmas' }, santaHat);
})(window.Bud);

;
// lib/accessories/head/strawHat.js
/* Straw hat, worn on the head: a piece found at Southernmost Point, Key West (find 17). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Key West: a wide straw sun hat with a ribbon.
  function strawHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(0, -w * 0.02);
    ctx.rotate(0.06 + sway(env, 1.4) * 0.02);
    ctx.fillStyle = env.c(U.darken(C.straw, 0.12));
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, w * 0.48, w * 0.09);
    ctx.fill();
    ctx.fillStyle = env.c(C.straw);
    ctx.beginPath();
    ctx.moveTo(-w * 0.22, -w * 0.02);
    ctx.bezierCurveTo(-w * 0.22, -w * 0.3, w * 0.22, -w * 0.3, w * 0.22, -w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.boardStripe);
    ctx.fillRect(-w * 0.22, -w * 0.09, w * 0.44, w * 0.06);
    ctx.strokeStyle = env.c(U.darken(C.straw, 0.22), 0.6);
    ctx.lineWidth = w * 0.008;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) U.ellipse(ctx, 0, 0, w * (0.27 + i * 0.07), w * (0.05 + i * 0.012));
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(17, { id: 'strawHat', label: 'Straw hat', slot: 'head', place: { name: 'Southernmost Point', city: 'Key West', lat: 24.5465, lon: -81.7975, radius: 3000 } }, strawHat);
})(window.Bud);

;
// lib/accessories/head/tricornHat.js
/* Tricorn hat, worn on the head: a piece found at USS Constitution, Boston (find 21: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, P, paint, ink } = K.AccKit;

  // USS Constitution: a navy tricorn hat with gold edging.
  function tricornHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(sway(env, 1.6) * 0.02);
    paint(ctx, env, P.navy, () => {
      ctx.moveTo(-w * 0.46, -w * 0.02);
      ctx.quadraticCurveTo(-w * 0.3, -w * 0.12, -w * 0.4, -w * 0.32);
      ctx.quadraticCurveTo(0, -w * 0.2, w * 0.4, -w * 0.32);
      ctx.quadraticCurveTo(w * 0.3, -w * 0.12, w * 0.46, -w * 0.02);
      ctx.quadraticCurveTo(0, w * 0.1, -w * 0.46, -w * 0.02);
      ctx.closePath();
    });
    paint(ctx, env, U.darken(P.navy, 0.25), () => U.ellipse(ctx, 0, -w * 0.12, w * 0.24, w * 0.11));
    ink(ctx, env, C.gold, Math.max(0.6, w * 0.03), () => {
      ctx.moveTo(-w * 0.4, -w * 0.32);
      ctx.quadraticCurveTo(0, -w * 0.2, w * 0.4, -w * 0.32);
      ctx.moveTo(-w * 0.46, -w * 0.02);
      ctx.quadraticCurveTo(0, w * 0.1, w * 0.46, -w * 0.02);
    });
    paint(ctx, env, C.cup, () => ctx.arc(-w * 0.28, -w * 0.16, w * 0.06, 0, TAU));
    paint(ctx, env, C.gold, () => ctx.arc(-w * 0.28, -w * 0.16, w * 0.025, 0, TAU));
    ctx.restore();
  }

  K.registerFind(21, { id: 'tricornHat', label: 'Tricorn hat', slot: 'head', place: { name: 'USS Constitution', city: 'Boston', lat: 42.3725, lon: -71.0566, radius: 500 } }, tricornHat);
})(window.Bud);

;
// lib/accessories/head/umbrella.js
/* Umbrella, worn on the head: built-in accessory 7 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin } = K.AccKit;

  function umbrella(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const R = w * 0.62;
    const edge = -w * 0.34;
    begin(ctx, a);
    ctx.rotate(0.12 + 0.03 * sway(env, 1.4));
    // shaft and a J handle off to one side
    ctx.strokeStyle = env.c(U.darken(col.hat, 0.35));
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(R * 0.92, edge);
    ctx.lineTo(R * 0.92, edge + w * 0.16);
    ctx.quadraticCurveTo(R * 0.92, edge + w * 0.24, R * 0.8, edge + w * 0.22);
    ctx.stroke();
    // canopy: a dome with a scalloped edge
    const n = 4;
    ctx.beginPath();
    ctx.moveTo(-R, edge);
    ctx.bezierCurveTo(-R, edge - R * 0.78, R, edge - R * 0.78, R, edge);
    for (let i = n - 1; i >= 0; i--) {
      const x0 = -R + (2 * R * (i + 1)) / n;
      const x1 = -R + (2 * R * i) / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, edge - R * 0.16, x1, edge);
    }
    ctx.closePath();
    ctx.fillStyle = env.c(col.hat);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = env.c(col.hat2, 0.9);
    for (let i = 0; i < n; i += 2) {
      const x0 = -R + (2 * R * i) / n;
      ctx.beginPath();
      ctx.moveTo(0, edge - R * 0.62);
      ctx.lineTo(x0, edge + 2);
      ctx.lineTo(x0 + (2 * R) / n, edge + 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(col.hat, 0.35));
    ctx.beginPath();
    ctx.arc(0, edge - R * 0.6, w * 0.025, 0, TAU);
    ctx.fill();
    ctx.fillRect(-w * 0.012, edge - R * 0.72, w * 0.024, R * 0.1);
    ctx.restore();
  }

  K.registerBuiltin(7, { id: 'umbrella', label: 'Umbrella', slot: 'head', kind: 'Weather' }, umbrella);
})(window.Bud);

;
// lib/accessories/head/witch.js
/* Witch hat, worn on the head: built-in accessory 10 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  function witch(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    const sw = sway(env, 1.6) * w * 0.04;
    ctx.fillStyle = env.c(C.witch);
    ctx.beginPath();
    U.ellipse(ctx, 0, -w * 0.02, w * 0.72, w * 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -w * 0.06);
    ctx.quadraticCurveTo(-w * 0.12, -w * 0.5, w * 0.05 + sw, -w * 0.8);
    ctx.quadraticCurveTo(w * 0.32 + sw, -w * 0.86, w * 0.42 + sw, -w * 0.7);
    ctx.quadraticCurveTo(w * 0.22, -w * 0.62, w * 0.18, -w * 0.4);
    ctx.lineTo(w * 0.32, -w * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.witchBand);
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -w * 0.1);
    ctx.lineTo(w * 0.3, -w * 0.1);
    ctx.lineTo(w * 0.27, -w * 0.2);
    ctx.lineTo(-w * 0.26, -w * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(10, { id: 'witch', label: 'Witch hat', slot: 'head', kind: 'Hat (Halloween)', seasonal: true }, witch);
})(window.Bud);

;
// lib/accessories/item/acorn.js
/* Acorn, held: a piece found at Bethesda Terrace, Central Park, New York (find 35: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { hold, paint, ink, gleam } = K.AccKit;

  // Central Park: an acorn, for the squirrels.
  function acorn(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    paint(ctx, env, U.rgb('#C98B4E'), () => {
      ctx.moveTo(-3.8, -1.4);
      ctx.bezierCurveTo(-4, 4, -1, 6.4, 0, 6.6);
      ctx.bezierCurveTo(1, 6.4, 4, 4, 3.8, -1.4);
      ctx.closePath();
    });
    gleam(ctx, env, -1.6, 1.6, 0.6, 2, 0.2, 0.3);
    paint(ctx, env, U.rgb('#7A5230'), () => {
      ctx.moveTo(-4.6, -0.6);
      ctx.bezierCurveTo(-4.8, -5, 4.8, -5, 4.6, -0.6);
      ctx.quadraticCurveTo(0, 0.6, -4.6, -0.6);
    });
    ink(ctx, env, U.rgb('#5A3A20'), 0.3, () => {
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(i * 1.2 - 0.6, -3.6);
        ctx.lineTo(i * 1.2 + 0.6, -0.4);
        ctx.moveTo(i * 1.2 + 0.6, -3.6);
        ctx.lineTo(i * 1.2 - 0.6, -0.4);
      }
    }, 0.7);
    ink(ctx, env, U.rgb('#5A3A20'), 0.7, () => {
      ctx.moveTo(0, -3.8);
      ctx.quadraticCurveTo(0.4, -5.2, 1.4, -5.6);
    });
    ctx.restore();
  }

  K.registerFind(35, { id: 'acorn', label: 'Acorn', slot: 'item', place: { name: 'Bethesda Terrace, Central Park', city: 'New York', lat: 40.7742, lon: -73.9711, radius: 800 } }, acorn);
})(window.Bud);

;
// lib/accessories/item/bagel.js
/* Bagel, held: a piece found at Washington Square Park, New York (find 37: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint } = K.AccKit;

  // Washington Square: a sesame bagel.
  function bagel(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, 5.6, 4.6);
    ctx.fillStyle = env.c(P.crust);
    ctx.fill();
    paint(ctx, env, U.darken(P.crust, 0.15), () => U.ellipse(ctx, 0, 1.4, 5.4, 3.2), 0.6);
    paint(ctx, env, U.lighten(P.crust, 0.15), () => U.ellipse(ctx, 0, -0.9, 4.8, 3.2));
    paint(ctx, env, U.rgb('#8A5A2B'), () => U.ellipse(ctx, 0, -0.2, 1.7, 1.25));
    ctx.fillStyle = env.c(C.cup);
    for (let i = 0; i < 14; i++) {
      const t = (i / 14) * TAU;
      const r = 3.3 + (i % 2) * 0.7;
      ctx.beginPath();
      U.ellipse(ctx, Math.cos(t) * r, Math.sin(t) * r * 0.66 - 0.7, 0.32, 0.18, t);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(37, { id: 'bagel', label: 'Bagel', slot: 'item', place: { name: 'Washington Square Park', city: 'New York', lat: 40.7309, lon: -73.9975, radius: 400 } }, bagel);
})(window.Bud);

;
// lib/accessories/item/balloon.js
/* Balloon, held: built-in accessory 17 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, begin } = K.AccKit;

  function balloon(ctx, a, env) {
    const col = env.accColors;
    const s = a.w || 1;
    begin(ctx, a);
    ctx.scale(s, s);
    const bx = -4 + 1.5 * sway(env, 1.2);
    const by = -22 + 1.2 * sway(env, 1.7, 1);
    ctx.strokeStyle = env.c(U.WHITE, 0.55);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bx + 3, by * 0.45, bx, by + 7.4);
    ctx.stroke();
    const g = ctx.createRadialGradient(bx - 2, by - 2.6, 0.5, bx, by, 7.5);
    g.addColorStop(0, env.c(U.lighten(col.hat, 0.5)));
    g.addColorStop(1, env.c(col.hat));
    ctx.fillStyle = g;
    ctx.beginPath();
    U.ellipse(ctx, bx, by, 5.4, 6.5);
    ctx.fill();
    ctx.fillStyle = env.c(col.hat);
    ctx.beginPath();
    ctx.moveTo(bx, by + 6.2);
    ctx.lineTo(bx - 1.2, by + 7.7);
    ctx.lineTo(bx + 1.2, by + 7.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.7);
    ctx.beginPath();
    U.ellipse(ctx, bx - 2.1, by - 2.8, 1.2, 1.9, 0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(17, { id: 'balloon', label: 'Balloon', slot: 'item', kind: 'Held item' }, balloon);
})(window.Bud);

;
// lib/accessories/item/banhMi.js
/* Banh mi, held: a piece found at Hoi An Ancient Town, Hoi An (find 79: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink } = K.AccKit;

  // Hoi An: a banh mi, herbs, chili and pickled carrot spilling out.
  function banhMi(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    ctx.rotate(-0.35);
    paint(ctx, env, P.leaf, () => {
      for (let i = 0; i < 5; i++) U.ellipse(ctx, -4.4 + i * 2.2, -1.6, 1.2, 0.6, 0.4);
    });
    paint(ctx, env, U.rgb('#F28A3C'), () => {
      for (let i = 0; i < 4; i++) U.rr(ctx, -3.6 + i * 2.2, -1.3, 1.6, 0.4, 0.2);
    });
    paint(ctx, env, U.rgb('#F5A3B5'), () => U.rr(ctx, -5, -0.9, 10, 0.9, 0.4));
    paint(ctx, env, P.sauce, () => {
      for (const x of [-2, 1.8]) ctx.arc(x, -1.8, 0.35, 0, TAU);
    });
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-6.4, 0);
      ctx.bezierCurveTo(-6.4, 3, 6.4, 3, 6.4, 0);
      ctx.closePath();
      ctx.moveTo(-6.2, -1.4);
      ctx.bezierCurveTo(-6.2, -4.2, 6.2, -4.2, 6.2, -1.4);
      ctx.quadraticCurveTo(0, -2.2, -6.2, -1.4);
    });
    ink(ctx, env, U.lighten(P.crust, 0.3), 0.4, () => {
      for (const x of [-3, 0, 3]) {
        ctx.moveTo(x - 0.8, -3.3);
        ctx.lineTo(x + 0.8, -2.5);
      }
    });
    ctx.restore();
  }

  K.registerFind(79, { id: 'banhMi', label: 'Banh mi', slot: 'item', place: { name: 'Hoi An Ancient Town', city: 'Hoi An', lat: 15.8772, lon: 108.326, radius: 700 } }, banhMi);
})(window.Bud);

;
// lib/accessories/item/beachBall.js
/* Beach ball, held: a piece found at Copacabana Beach, Rio de Janeiro (find 107: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint, gleam } = K.AccKit;

  // Copacabana: a beach ball, bouncing.
  function beachBall(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, -Math.abs(sway(env, 2.4)) * 1.2);
    ctx.scale(s, s);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -1, 5.4, 0, TAU);
    ctx.clip();
    const cols = [C.cup, U.rgb('#E8402E'), C.cup, U.rgb('#FFD84D'), C.cup, U.rgb('#4A8FE7')];
    cols.forEach((col, i) => paint(ctx, env, col, () => {
      ctx.moveTo(0, -1);
      ctx.arc(0, -1, 6, (i / 6) * TAU + 0.3, ((i + 1) / 6) * TAU + 0.3);
      ctx.closePath();
    }));
    ctx.restore();
    paint(ctx, env, C.cup, () => ctx.arc(0, -1, 1, 0, TAU));
    gleam(ctx, env, -2.2, -3.4, 1.6, 0.8, -0.6, 0.4);
    ctx.restore();
  }

  K.registerFind(107, { id: 'beachBall', label: 'Beach ball', slot: 'item', place: { name: 'Copacabana Beach', city: 'Rio de Janeiro', lat: -22.9757, lon: -43.1866, radius: 2000 } }, beachBall);
})(window.Bud);

;
// lib/accessories/item/beignet.js
/* Beignet, held: a piece found at Jackson Square, New Orleans (find 50: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, hold, paint } = K.AccKit;

  // Jackson Square: a puffy beignet under a snow of powdered sugar.
  function beignet(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.12);
    paint(ctx, env, U.darken(P.crust, 0.18), () => {
      ctx.moveTo(-5.2, -1);
      ctx.quadraticCurveTo(-5.8, 4.6, -1, 4.6);
      ctx.quadraticCurveTo(3.6, 5.6, 5.2, 2.6);
      ctx.quadraticCurveTo(5.8, -2.4, 3.2, -3.6);
      ctx.quadraticCurveTo(-1, -4.6, -5.2, -1);
    });
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-4.8, -1.6);
      ctx.quadraticCurveTo(-5, 3.2, -1, 3.4);
      ctx.quadraticCurveTo(3.4, 4.2, 4.6, 1.6);
      ctx.quadraticCurveTo(5, -2.6, 2.8, -3.6);
      ctx.quadraticCurveTo(-1, -4.4, -4.8, -1.6);
    });
    ctx.fillStyle = env.c(WHITE, 0.95);
    for (let i = 0; i < 34; i++) {
      const x = -4 + U.hash(i) * 8;
      const y = -3.4 + U.hash(i + 40) * 4.4 + (x > 2 ? 0.6 : 0);
      ctx.beginPath();
      ctx.arc(x, y, 0.22 + U.hash(i + 9) * 0.32, 0, TAU);
      ctx.fill();
    }
    paint(ctx, env, WHITE, () => {
      U.ellipse(ctx, -1.6, -2.4, 1.6, 0.6, -0.3);
      U.ellipse(ctx, 1.8, -2.2, 1.4, 0.5, 0.2);
    }, 0.85);
    ctx.restore();
  }

  K.registerFind(50, { id: 'beignet', label: 'Beignet', slot: 'item', place: { name: 'Jackson Square', city: 'New Orleans', lat: 29.9575, lon: -90.063, radius: 400 } }, beignet);
})(window.Bud);

;
// lib/accessories/item/bibimbap.js
/* Bibimbap, held: a piece found at Jeonju Hanok Village, Jeonju (find 70: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, hold, paint, steam } = K.AccKit;

  // Jeonju: bibimbap in a hot stone bowl, an egg in the middle.
  function bibimbap(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -4.6);
    paint(ctx, env, U.rgb('#3B3F48'), () => {
      ctx.moveTo(-5.8, -2.2);
      ctx.lineTo(5.8, -2.2);
      ctx.bezierCurveTo(5.4, 3.8, 3, 5, 0, 5);
      ctx.bezierCurveTo(-3, 5, -5.4, 3.8, -5.8, -2.2);
    });
    paint(ctx, env, U.rgb('#5A606C'), () => U.ellipse(ctx, 0, -2.2, 5.8, 1.6));
    const top = [P.leaf, U.rgb('#F28A3C'), U.rgb('#8A5A2B'), P.yellow, U.rgb('#C0392B')];
    top.forEach((col, i) => {
      const t = (i / top.length) * TAU;
      paint(ctx, env, col, () => U.ellipse(ctx, Math.cos(t) * 3, -2.2 + Math.sin(t) * 0.8, 1.6, 0.6, t * 0.2));
    });
    paint(ctx, env, WHITE, () => U.ellipse(ctx, 0, -2.4, 1.7, 0.75));
    paint(ctx, env, U.rgb('#FFB21F'), () => ctx.arc(0, -2.5, 0.55, 0, TAU));
    ctx.restore();
  }

  K.registerFind(70, { id: 'bibimbap', label: 'Bibimbap', kr: '비빔밥', slot: 'item', place: { name: 'Jeonju Hanok Village', city: 'Jeonju', lat: 35.8153, lon: 127.1517, radius: 800 } }, bibimbap);
})(window.Bud);

;
// lib/accessories/item/blueberries.js
/* Blueberries, held: a piece found at Cadillac Mountain, Acadia (find 29: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink, gleam } = K.AccKit;

  // Cadillac Mountain: a tin pail of wild Maine blueberries.
  function blueberries(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    ink(ctx, env, C.steel, 0.4, () => ctx.arc(0, -1.4, 4.4, Math.PI * 1.05, Math.PI * 1.95));
    for (const [x, y] of [[-2.8, -2], [-1, -2.6], [0.9, -2.2], [2.6, -1.8], [-1.8, -0.9], [0.2, -1], [1.9, -0.6]]) {
      paint(ctx, env, U.rgb('#3D4FA8'), () => ctx.arc(x, y, 1.05, 0, TAU));
      paint(ctx, env, U.rgb('#7F8FD8'), () => ctx.arc(x - 0.3, y - 0.35, 0.3, 0, TAU), 0.7);
    }
    paint(ctx, env, C.steel, () => {
      ctx.moveTo(-4.4, -0.6);
      ctx.lineTo(4.4, -0.6);
      ctx.lineTo(3.4, 5.6);
      ctx.lineTo(-3.4, 5.6);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(C.steel, 0.2), 0.4, () => {
      ctx.moveTo(-4.1, 1.4);
      ctx.lineTo(4.1, 1.4);
    });
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, 3.4, -2.8, 1.4, 0.55, -0.5));
    gleam(ctx, env, -2.2, 2.6, 0.5, 1.8, 0.1, 0.35);
    ctx.restore();
  }

  K.registerFind(29, { id: 'blueberries', label: 'Blueberries', slot: 'item', place: { name: 'Cadillac Mountain', city: 'Acadia', lat: 44.3529, lon: -68.2239, radius: 1200 } }, blueberries);
})(window.Bud);

;
// lib/accessories/item/brush.js
/* Brush, held: a piece found at Insadong, Seoul (find 60: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Insadong: a calligraphy brush, an ink drop at the tip.
  function brush(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(0.35);
    paint(ctx, env, U.rgb('#C9A15C'), () => U.rr(ctx, -0.8, -10, 1.6, 11, 0.7));
    ink(ctx, env, U.rgb('#8A6A33'), 0.25, () => {
      for (const y of [-7, -3]) {
        ctx.moveTo(-0.8, y);
        ctx.lineTo(0.8, y);
      }
    });
    paint(ctx, env, P.red, () => U.rr(ctx, -0.25, -11.6, 0.5, 1.8, 0.25));
    paint(ctx, env, P.ink, () => {
      ctx.moveTo(-1.2, 1);
      ctx.lineTo(1.2, 1);
      ctx.quadraticCurveTo(1.4, 4, 0, 6.2);
      ctx.quadraticCurveTo(-1.4, 4, -1.2, 1);
    });
    paint(ctx, env, P.ink, () => ctx.arc(0.2, 7.4 + sway(env, 2) * 0.2, 0.45, 0, TAU), 0.85);
    ctx.restore();
  }

  K.registerFind(60, { id: 'brush', label: 'Brush', kr: '붓', slot: 'item', place: { name: 'Insadong', city: 'Seoul', lat: 37.5728, lon: 126.9857, radius: 400 } }, brush);
})(window.Bud);

;
// lib/accessories/item/bubbleTea.js
/* Bubble tea, held: a piece found at Shilin Night Market, Taipei (find 78: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, paint, ink, gleam, steamingCup } = K.AccKit;

  // Shilin Night Market: bubble tea, pearls at the bottom, a big straw.
  function bubbleTea(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      ink(ctx, env, P.pink, 1.2, () => {
        ctx.moveTo(1.2, -3);
        ctx.lineTo(2.6, -10.6);
      });
      paint(ctx, env, P.glass, () => {
        ctx.moveTo(-4, -4.4);
        ctx.lineTo(4, -4.4);
        ctx.lineTo(3.2, 6);
        ctx.lineTo(-3.2, 6);
        ctx.closePath();
      }, 0.55);
      paint(ctx, env, U.rgb('#D7A979'), () => {
        ctx.moveTo(-3.85, -2.6);
        ctx.lineTo(3.85, -2.6);
        ctx.lineTo(3.2, 6);
        ctx.lineTo(-3.2, 6);
        ctx.closePath();
      });
      ctx.fillStyle = env.c(U.rgb('#3A2418'));
      for (const [x, y] of [[-2.2, 4.8], [-0.7, 5], [0.8, 4.8], [2.2, 5], [-1.5, 3.6], [0.1, 3.7], [1.6, 3.5]]) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, TAU);
        ctx.fill();
      }
    }, () => {
      paint(ctx, env, P.glass, () => {
        ctx.moveTo(-4.2, -4.4);
        ctx.bezierCurveTo(-4, -7.6, 4, -7.6, 4.2, -4.4);
        ctx.closePath();
      }, 0.5);
      ink(ctx, env, WHITE, 0.4, () => ctx.rect(-4.1, -4.6, 8.2, 0.4), 0.7);
      gleam(ctx, env, -2.4, 0.4, 0.5, 2.6, 0.1, 0.35);
    }, false);
  }

  K.registerFind(78, { id: 'bubbleTea', label: 'Bubble tea', slot: 'item', place: { name: 'Shilin Night Market', city: 'Taipei', lat: 25.0875, lon: 121.5248, radius: 500 } }, bubbleTea);
})(window.Bud);

;
// lib/accessories/item/buchae.js
/* Fan, held: a piece found at Bukchon Hanok Village, Seoul (find 18). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Bukchon: a folding fan, like the ones in Korean fan dance.
  function buchae(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(-0.15 + sway(env, 3) * 0.06);
    ctx.scale(s, s);
    const r = 8.4;
    ctx.fillStyle = env.c(C.fan);
    ctx.beginPath();
    ctx.moveTo(0, 4.8);
    ctx.arc(0, 4.8, r, -Math.PI * 0.86, -Math.PI * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.gold, 0.85);
    ctx.beginPath();
    ctx.arc(0, 4.8, r, -Math.PI * 0.86, -Math.PI * 0.14);
    ctx.arc(0, 4.8, r * 0.82, -Math.PI * 0.14, -Math.PI * 0.86, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.fan, 0.25), 0.7);
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const t = -Math.PI * (0.86 - (0.72 * i) / 8);
      ctx.moveTo(0, 4.8);
      ctx.lineTo(Math.cos(t) * r * 0.98, 4.8 + Math.sin(t) * r * 0.98);
    }
    ctx.stroke();
    ctx.fillStyle = env.c(C.petal);
    ctx.beginPath();
    for (const [x, y] of [[-3, -0.6], [2.4, -1.4], [0, -2.4]]) U.ellipse(ctx, x, y, 0.9, 0.9);
    ctx.fill();
    ctx.fillStyle = env.c(C.stick);
    ctx.beginPath();
    U.rr(ctx, -0.6, 4, 1.2, 3.2, 0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(18, { id: 'buchae', label: 'Fan', kr: '부채', slot: 'item', place: { name: 'Bukchon Hanok Village', city: 'Seoul', lat: 37.5826, lon: 126.983, radius: 500 } }, buchae);
})(window.Bud);

;
// lib/accessories/item/bungeoppang.js
/* Bungeoppang, held: a piece found at Myeongdong, Seoul (find 19). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Myeongdong: bungeoppang, a warm fish-shaped bread.
  function bungeoppang(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(-0.5);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.bread);
    ctx.beginPath();
    U.ellipse(ctx, -1, 0, 5, 3);
    ctx.moveTo(3.2, 0);
    ctx.lineTo(7, -2.8);
    ctx.lineTo(6.2, 0);
    ctx.lineTo(7, 2.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.bread, 0.28), 0.8);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = -1.6 + i * 1.6;
      ctx.moveTo(x - 0.7, -1.6);
      ctx.quadraticCurveTo(x + 0.4, 0, x - 0.7, 1.6);
    }
    ctx.moveTo(-4, -2);
    ctx.quadraticCurveTo(-3, 0, -4, 2);
    ctx.stroke();
    ctx.fillStyle = env.c(U.darken(C.bread, 0.45));
    ctx.beginPath();
    ctx.arc(-4.4, -0.7, 0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.25);
    ctx.beginPath();
    U.ellipse(ctx, -1.4, -1.6, 2.2, 0.6, -0.1);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(19, { id: 'bungeoppang', label: 'Bungeoppang', kr: '붕어빵', slot: 'item', place: { name: 'Myeongdong', city: 'Seoul', lat: 37.5636, lon: 126.9826, radius: 500 } }, bungeoppang);
})(window.Bud);

;
// lib/accessories/item/bus.js
/* Double-decker, held: a piece found at Tower Bridge, London (find 82: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint } = K.AccKit;

  // Tower Bridge: a red double-decker bus.
  function bus(ctx, a, env) {
    hold(ctx, a, env, 2.6, 0.25);
    paint(ctx, env, U.rgb('#D7263D'), () => U.rr(ctx, -6.8, -7, 13.6, 11.4, 1.6));
    paint(ctx, env, U.rgb('#BFE2F5'), () => {
      for (const x of [-5.8, -2.8, 0.2, 3.2]) {
        U.rr(ctx, x, -6, 2.4, 2.4, 0.4);
        U.rr(ctx, x, -1.4, 2.4, 2.4, 0.4);
      }
    });
    paint(ctx, env, C.cup, () => ctx.rect(-6.8, -3.2, 13.6, 0.6));
    paint(ctx, env, P.ink, () => {
      ctx.arc(-3.8, 4.4, 1.4, 0, TAU);
      ctx.arc(3.8, 4.4, 1.4, 0, TAU);
    });
    paint(ctx, env, C.steel, () => {
      ctx.arc(-3.8, 4.4, 0.5, 0, TAU);
      ctx.arc(3.8, 4.4, 0.5, 0, TAU);
    });
    paint(ctx, env, P.yellow, () => ctx.arc(6.1, 2.6, 0.45, 0, TAU));
    ctx.restore();
  }

  K.registerFind(82, { id: 'bus', label: 'Double-decker', slot: 'item', place: { name: 'Tower Bridge', city: 'London', lat: 51.5055, lon: -0.0754, radius: 500 } }, bus);
})(window.Bud);

;
// lib/accessories/item/cableCar.js
/* Cable car, held: a piece found at Powell and Market, San Francisco (find 44: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink } = K.AccKit;

  // Powell and Market: a San Francisco cable car.
  function cableCar(ctx, a, env) {
    hold(ctx, a, env, 2.4, 0.3);
    ink(ctx, env, U.rgb('#2B2D35'), 0.35, () => {
      ctx.moveTo(-7, -9);
      ctx.lineTo(7, -9.6);
      ctx.moveTo(0, -9.3);
      ctx.lineTo(0, -5.6);
    });
    paint(ctx, env, U.rgb('#C0392B'), () => U.rr(ctx, -6.2, -3.4, 12.4, 7.4, 1));
    paint(ctx, env, U.rgb('#F2E3C6'), () => U.rr(ctx, -6.6, -5.8, 13.2, 2.6, 1.2));
    paint(ctx, env, U.rgb('#2B5DA8'), () => ctx.rect(-6.2, 1.2, 12.4, 1.2));
    paint(ctx, env, U.rgb('#BFE2F5'), () => {
      for (const x of [-5.2, -2.4, 0.4, 3.2]) U.rr(ctx, x, -2.6, 2, 3, 0.4);
    });
    paint(ctx, env, P.ink, () => {
      ctx.arc(-3.6, 4.6, 1.1, 0, TAU);
      ctx.arc(3.6, 4.6, 1.1, 0, TAU);
    });
    paint(ctx, env, C.gold, () => ctx.arc(0, -4.5, 0.5, 0, TAU));
    ctx.restore();
  }

  K.registerFind(44, { id: 'cableCar', label: 'Cable car', slot: 'item', place: { name: 'Powell and Market', city: 'San Francisco', lat: 37.7843, lon: -122.4082, radius: 400 } }, cableCar);
})(window.Bud);

;
// lib/accessories/item/cactus.js
/* Saguaro, held: a piece found at Saguaro National Park, Tucson (find 45: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink } = K.AccKit;

  // Saguaro National Park: a saguaro cactus with a pink bloom.
  function cactus(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.25);
    paint(ctx, env, P.sand, () => U.ellipse(ctx, 0, 5.4, 5.6, 1.4));
    const green = U.rgb('#4FA35A');
    paint(ctx, env, green, () => {
      U.rr(ctx, -1.6, -8.4, 3.2, 14, 1.6);
      U.rr(ctx, -5.2, -4.4, 2.4, 6, 1.2);
      U.rr(ctx, -5.2, 0, 4.4, 2.2, 1.1);
      U.rr(ctx, 2.8, -6.4, 2.4, 6.4, 1.2);
      U.rr(ctx, 0.8, -2.2, 4.4, 2.2, 1.1);
    });
    ink(ctx, env, U.darken(green, 0.25), 0.3, () => {
      for (const x of [-0.6, 0.6]) {
        ctx.moveTo(x, -7.6);
        ctx.lineTo(x, 5);
      }
    });
    paint(ctx, env, U.rgb('#FF6F91'), () => {
      for (let i = 0; i < 5; i++) {
        const t = (i / 5) * TAU;
        U.ellipse(ctx, Math.cos(t) * 0.7, -8.8 + Math.sin(t) * 0.7, 0.6, 0.45, t);
      }
    });
    paint(ctx, env, P.yellow, () => ctx.arc(0, -8.8, 0.35, 0, TAU));
    ctx.restore();
  }

  K.registerFind(45, { id: 'cactus', label: 'Saguaro', slot: 'item', place: { name: 'Saguaro National Park', city: 'Tucson', lat: 32.1797, lon: -110.7366, radius: 1500 } }, cactus);
})(window.Bud);

;
// lib/accessories/item/cannoli.js
/* Cannoli, held: a piece found at North End, Boston (find 27: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam } = K.AccKit;

  // The North End: a cannoli, cream and chocolate chips at both ends.
  function cannoli(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    ctx.rotate(-0.5);
    paint(ctx, env, P.cream, () => {
      U.ellipse(ctx, -5.2, 0, 1.6, 2.3);
      U.ellipse(ctx, 5.2, 0, 1.6, 2.3);
    });
    paint(ctx, env, P.crust, () => U.rr(ctx, -4.8, -2.2, 9.6, 4.4, 2.2));
    ctx.fillStyle = env.c(U.darken(P.crust, 0.2), 0.7);
    for (let i = 0; i < 12; i++) ctx.fillRect(-4 + (i % 6) * 1.5, -1.4 + (i < 6 ? 0 : 1.6), 0.45, 0.45);
    paint(ctx, env, U.rgb('#4A2C1B'), () => {
      for (const [x, y] of [[-5.6, -0.6], [-5, 0.9], [5.4, -0.8], [5.8, 0.6], [4.9, 0.2]]) ctx.arc(x, y, 0.32, 0, TAU);
    });
    gleam(ctx, env, -1, -1.3, 2.6, 0.4, 0, 0.3);
    ctx.restore();
  }

  K.registerFind(27, { id: 'cannoli', label: 'Cannoli', slot: 'item', place: { name: 'North End', city: 'Boston', lat: 42.3637, lon: -71.0537, radius: 350 } }, cannoli);
})(window.Bud);

;
// lib/accessories/item/canoe.js
/* Canoe, held: a piece found at Lake Louise, Banff (find 104: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Lake Louise: a red canoe with its paddle.
  function canoe(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.4);
    ctx.rotate(-0.15 + sway(env, 1.8) * 0.05);
    ink(ctx, env, P.wood, 0.6, () => {
      ctx.moveTo(-1.6, 4);
      ctx.lineTo(3.4, -8.6);
    });
    paint(ctx, env, P.wood, () => U.ellipse(ctx, 3.6, -9, 0.9, 2.2, 0.38));
    paint(ctx, env, U.rgb('#D93A2B'), () => {
      ctx.moveTo(-7, -0.6);
      ctx.quadraticCurveTo(0, 0.6, 7, -0.6);
      ctx.quadraticCurveTo(5, 3.6, 0, 3.6);
      ctx.quadraticCurveTo(-5, 3.6, -7, -0.6);
    });
    paint(ctx, env, U.rgb('#F2E3C6'), () => {
      ctx.moveTo(-6.8, -0.6);
      ctx.quadraticCurveTo(0, 0.6, 6.8, -0.6);
      ctx.quadraticCurveTo(0, 1.4, -6.8, -0.6);
    });
    ink(ctx, env, P.sea, 0.6, () => {
      ctx.moveTo(-6.4, 4.4);
      ctx.quadraticCurveTo(-2, 3.8 + sway(env, 3) * 0.3, 2, 4.4);
      ctx.quadraticCurveTo(4.6, 4.8, 6.6, 4.4);
    }, 0.7);
    ctx.restore();
  }

  K.registerFind(104, { id: 'canoe', label: 'Canoe', slot: 'item', place: { name: 'Lake Louise', city: 'Banff', lat: 51.416, lon: -116.221, radius: 1500 } }, canoe);
})(window.Bud);

;
// lib/accessories/item/chai.js
/* Chai, held: a piece found at Taj Mahal, Agra (find 81: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, paint, gleam, steamingCup } = K.AccKit;

  // The Taj Mahal: chai in a little clay cup.
  function chai(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      paint(ctx, env, P.clay, () => {
        ctx.moveTo(-3.8, -3.4);
        ctx.lineTo(3.8, -3.4);
        ctx.lineTo(2.6, 5.4);
        ctx.lineTo(-2.6, 5.4);
        ctx.closePath();
      });
      paint(ctx, env, U.darken(P.clay, 0.2), () => ctx.rect(-3.6, -1.8, 7.2, 0.6));
      gleam(ctx, env, -1.8, 1.4, 0.5, 2.4, 0.15, 0.25);
    }, () => {
      paint(ctx, env, U.rgb('#C98F5A'), () => U.ellipse(ctx, 0, -3.4, 3.7, 0.8));
      paint(ctx, env, U.rgb('#E3B985'), () => U.ellipse(ctx, -0.6, -3.5, 1.6, 0.35));
    });
  }

  K.registerFind(81, { id: 'chai', label: 'Chai', slot: 'item', place: { name: 'Taj Mahal', city: 'Agra', lat: 27.175, lon: 78.0421, radius: 800 } }, chai);
})(window.Bud);

;
// lib/accessories/item/cherryBranch.js
/* Cherry branch, held: a piece found at Tidal Basin, Washington (find 46: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, flower, hold, ink } = K.AccKit;

  // The Tidal Basin: a cherry branch in bloom.
  function cherryBranch(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, U.rgb('#6B4423'), 0.7, () => {
      ctx.moveTo(-1, 6.4);
      ctx.quadraticCurveTo(0, 0, 3.4, -8.4);
      ctx.moveTo(0.6, -1);
      ctx.quadraticCurveTo(-2.4, -3.6, -4.2, -6);
    });
    for (const [x, y, r] of [[3.4, -8.4, 1.6], [1.4, -4, 1.4], [-4.2, -6, 1.5], [-1.6, -3.2, 1.1], [0.4, 1.4, 1.2]]) {
      flower(ctx, x, y, r, env, x + sway(env, 1.4, y) * 0.1);
    }
    ctx.restore();
  }

  K.registerFind(46, { id: 'cherryBranch', label: 'Cherry branch', slot: 'item', place: { name: 'Tidal Basin', city: 'Washington', lat: 38.884, lon: -77.0385, radius: 800 } }, cherryBranch);
})(window.Bud);

;
// lib/accessories/item/chowder.js
/* Chowder, held: a piece found at Faneuil Hall, Boston (find 26: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam, steam } = K.AccKit;

  // Faneuil Hall: clam chowder in a bread bowl, an oyster cracker on top.
  function chowder(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -4.2);
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-5.6, -2.6);
      ctx.bezierCurveTo(-6, 3.8, -2.6, 5.6, 0, 5.6);
      ctx.bezierCurveTo(2.6, 5.6, 6, 3.8, 5.6, -2.6);
      ctx.closePath();
    });
    paint(ctx, env, U.lighten(P.crust, 0.2), () => U.ellipse(ctx, 0, -2.6, 5.6, 1.6));
    paint(ctx, env, P.cream, () => U.ellipse(ctx, 0, -2.5, 4.6, 1.15));
    ctx.fillStyle = env.c(U.rgb('#E9D49A'));
    for (const [x, y] of [[-2.2, -2.6], [1.3, -2.2], [2.6, -2.8], [-0.6, -2.1]]) ctx.fillRect(x, y, 0.7, 0.55);
    paint(ctx, env, P.leaf, () => {
      for (const [x, y] of [[-1.4, -2.9], [0.4, -2.7], [2, -2.4]]) ctx.arc(x, y, 0.22, 0, TAU);
    });
    paint(ctx, env, U.rgb('#F5DFA8'), () => ctx.arc(-3, -3.4, 0.9, 0, TAU));
    gleam(ctx, env, -3.4, 1.6, 0.7, 1.8, 0.3, 0.2);
    ctx.restore();
  }

  K.registerFind(26, { id: 'chowder', label: 'Chowder', slot: 'item', place: { name: 'Faneuil Hall', city: 'Boston', lat: 42.36, lon: -71.0562, radius: 300 } }, chowder);
})(window.Bud);

;
// lib/accessories/item/churro.js
/* Churro, held: a piece found at Zócalo, Mexico City (find 105: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, WHITE, hold, paint, ink } = K.AccKit;

  // The Zócalo: a churro, ridged and sugared.
  function churro(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    ctx.rotate(0.3);
    paint(ctx, env, U.rgb('#F7F3EC'), () => U.rr(ctx, -2.4, 2.4, 4.8, 4, 0.8));
    paint(ctx, env, U.rgb('#3E2418'), () => U.ellipse(ctx, 0, 2.6, 2.2, 0.6));
    paint(ctx, env, P.crust, () => U.rr(ctx, -1.2, -10.4, 2.4, 13, 1.2));
    ink(ctx, env, U.darken(P.crust, 0.25), 0.35, () => {
      for (const x of [-0.6, 0, 0.6]) {
        ctx.moveTo(x, -10);
        ctx.lineTo(x, 2.2);
      }
    });
    ctx.fillStyle = env.c(WHITE, 0.9);
    for (let i = 0; i < 14; i++) ctx.fillRect(-1 + U.hash(i) * 1.8, -9.6 + U.hash(i + 11) * 11, 0.3, 0.3);
    ctx.restore();
  }

  K.registerFind(105, { id: 'churro', label: 'Churro', slot: 'item', place: { name: 'Zócalo', city: 'Mexico City', lat: 19.4327, lon: -99.1331, radius: 500 } }, churro);
})(window.Bud);

;
// lib/accessories/item/clownfish.js
/* Clownfish, held: a piece found at Cairns Esplanade, Cairns (find 97: Oceania). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, WHITE, hold, paint } = K.AccKit;

  // Cairns, by the Great Barrier Reef: a clownfish.
  function clownfish(ctx, a, env) {
    hold(ctx, a, env, 2.4, 0.5);
    const orange = U.rgb('#FF7A1A');
    paint(ctx, env, orange, () => {
      ctx.moveTo(4, 0);
      ctx.lineTo(6.6, -2.6);
      ctx.lineTo(6.6, 2.6);
      ctx.closePath();
      U.ellipse(ctx, 0, -3, 2, 1, 0.3);
    });
    paint(ctx, env, orange, () => U.ellipse(ctx, 0, 0, 5, 3.2));
    for (const x of [-2.6, 0.6, 3.6]) {
      ctx.save();
      ctx.beginPath();
      U.ellipse(ctx, 0, 0, 5, 3.2);
      ctx.clip();
      paint(ctx, env, P.ink, () => U.rr(ctx, x - 0.75, -4, 1.5, 8, 0.7));
      paint(ctx, env, C.cup, () => U.rr(ctx, x - 0.5, -4, 1, 8, 0.5));
      ctx.restore();
    }
    paint(ctx, env, C.lens, () => ctx.arc(-3.6, -0.6, 0.5, 0, TAU));
    paint(ctx, env, WHITE, () => ctx.arc(-3.75, -0.8, 0.18, 0, TAU));
    ctx.restore();
  }

  K.registerFind(97, { id: 'clownfish', label: 'Clownfish', slot: 'item', place: { name: 'Cairns Esplanade', city: 'Cairns', lat: -16.9206, lon: 145.7783, radius: 1000 } }, clownfish);
})(window.Bud);

;
// lib/accessories/item/coffee.js
/* Coffee, held: built-in accessory 16 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  function coffee(ctx, a, env) {
    const col = env.accColors;
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.WHITE, 0.45);
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x0 = -1.3 + i * 2.6;
      const k = sway(env, 2.6, i * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, -9.6);
      ctx.bezierCurveTo(x0 + 1.6 * k, -11.4, x0 - 1.6 * k, -12.8, x0 + 0.6 * k, -14.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-4, -6.5);
    ctx.lineTo(4, -6.5);
    ctx.lineTo(3, 6);
    ctx.lineTo(-3, 6);
    ctx.closePath();
    ctx.fillStyle = env.c(C.cup);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-3.7, -2.6);
    ctx.lineTo(3.7, -2.6);
    ctx.lineTo(3.3, 2.4);
    ctx.lineTo(-3.3, 2.4);
    ctx.closePath();
    ctx.fillStyle = env.c(C.sleeve);
    ctx.fill();
    ctx.fillStyle = env.c(C.cup, 0.95);
    ctx.beginPath();
    F.heart(ctx, 0, -0.1, 1.3);
    ctx.fill();
    ctx.fillStyle = env.c(col.hat);
    ctx.beginPath();
    U.rr(ctx, -4.7, -8.4, 9.4, 2.4, 1.1);
    ctx.fill();
    ctx.beginPath();
    U.rr(ctx, -3.4, -9.6, 6.8, 1.6, 0.8);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(16, { id: 'coffee', label: 'Coffee', slot: 'item', kind: 'Held item' }, coffee);
})(window.Bud);

;
// lib/accessories/item/cottonCandy.js
/* Cotton candy, held: a piece found at Coney Island Boardwalk, New York (find 36: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, ink } = K.AccKit;

  // Coney Island: a cloud of pink cotton candy on a paper cone.
  function cottonCandy(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    paint(ctx, env, U.rgb('#F7F3EC'), () => {
      ctx.moveTo(-0.9, -1);
      ctx.lineTo(0.9, -1);
      ctx.lineTo(0.3, 6.4);
      ctx.lineTo(-0.3, 6.4);
      ctx.closePath();
    });
    ink(ctx, env, U.rgb('#4AA8FF'), 0.35, () => {
      for (const y of [1, 3, 5]) {
        ctx.moveTo(-0.7, y - 0.6);
        ctx.lineTo(0.7, y);
      }
    });
    const puffs = [[0, -5, 3.4], [-2.6, -3.6, 2.4], [2.6, -3.8, 2.6], [-1.4, -7.4, 2.2], [1.6, -7.2, 2.3], [0, -2.4, 2.2]];
    for (const [x, y, r] of puffs) paint(ctx, env, U.rgb('#FFB7D5'), () => ctx.arc(x, y, r, 0, TAU));
    for (const [x, y, r] of puffs.slice(0, 3)) paint(ctx, env, U.rgb('#FFD3E6'), () => ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, TAU), 0.8);
    ctx.restore();
  }

  K.registerFind(36, { id: 'cottonCandy', label: 'Cotton candy', slot: 'item', place: { name: 'Coney Island Boardwalk', city: 'New York', lat: 40.5735, lon: -73.9785, radius: 800 } }, cottonCandy);
})(window.Bud);

;
// lib/accessories/item/croissant.js
/* Croissant, held: a piece found at The Louvre, Paris (find 84: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, gleam } = K.AccKit;

  // The Louvre: a flaky croissant.
  function croissant(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    const seg = [[-4.6, 1.2, 1.4, 2, -0.9], [-2.4, -0.4, 1.9, 2.8, -0.4], [0, -0.9, 2.2, 3.2, 0], [2.4, -0.4, 1.9, 2.8, 0.4], [4.6, 1.2, 1.4, 2, 0.9]];
    for (const [x, y, rx, ry, r] of seg) {
      paint(ctx, env, P.crust, () => U.ellipse(ctx, x, y, rx, ry, r));
      paint(ctx, env, U.darken(P.crust, 0.18), () => U.ellipse(ctx, x, y + ry * 0.45, rx * 0.9, ry * 0.4, r), 0.6);
    }
    gleam(ctx, env, -0.4, -2.6, 1.2, 0.5, 0, 0.35);
    ctx.restore();
  }

  K.registerFind(84, { id: 'croissant', label: 'Croissant', slot: 'item', place: { name: 'The Louvre', city: 'Paris', lat: 48.8611, lon: 2.3369, radius: 600 } }, croissant);
})(window.Bud);

;
// lib/accessories/item/custardTart.js
/* Custard tart, held: a piece found at Belém Tower, Lisbon (find 93: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, ink } = K.AccKit;

  // Belém: a custard tart, caramelized in spots, a dust of cinnamon.
  function custardTart(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-5.4, -1.4);
      ctx.lineTo(5.4, -1.4);
      ctx.lineTo(4.2, 3.6);
      ctx.lineTo(-4.2, 3.6);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(P.crust, 0.2), 0.35, () => {
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(i * 1.4, -1.2);
        ctx.lineTo(i * 1.15, 3.4);
      }
    }, 0.7);
    paint(ctx, env, U.rgb('#FFD86B'), () => U.ellipse(ctx, 0, -1.4, 5.2, 1.6));
    ctx.fillStyle = env.c(U.rgb('#7A4A1E'), 0.75);
    for (const [x, y, r] of [[-2.2, -1.6, 0.8], [1.4, -1.2, 0.6], [2.8, -1.8, 0.45], [-0.4, -2, 0.4], [0.4, -0.8, 0.35]]) {
      ctx.beginPath();
      U.ellipse(ctx, x, y, r, r * 0.55);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(93, { id: 'custardTart', label: 'Custard tart', slot: 'item', place: { name: 'Belém Tower', city: 'Lisbon', lat: 38.6916, lon: -9.216, radius: 1200 } }, custardTart);
})(window.Bud);

;
// lib/accessories/item/dango.js
/* Dango, held: a piece found at Tokyo Tower, Tokyo (find 6). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Tokyo Tower: dango, three dumplings on a stick.
  function dango(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(0.12);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(C.stick);
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 6.6);
    ctx.lineTo(0, -10.6);
    ctx.stroke();
    for (const [y, col] of [[-7.6, C.dangoPink], [-3.4, C.cup], [0.8, C.dangoGreen]]) {
      ctx.fillStyle = env.c(col);
      ctx.beginPath();
      ctx.arc(0, y, 2.2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = env.c(U.WHITE, 0.5);
      ctx.beginPath();
      ctx.arc(-0.75, y - 0.75, 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(6, { id: 'dango', label: 'Dango', slot: 'item', place: { name: 'Tokyo Tower', city: 'Tokyo', lat: 35.6586, lon: 139.7454, radius: 700 } }, dango);
})(window.Bud);

;
// lib/accessories/item/deepDish.js
/* Deep dish, held: a piece found at Navy Pier, Chicago (find 49: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Navy Pier: a slice of Chicago deep-dish pizza, cheese stretching.
  function deepDish(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    paint(ctx, env, P.crustDark, () => {
      ctx.moveTo(-5.4, -2);
      ctx.lineTo(5.4, -2);
      ctx.lineTo(5.4, 1.6);
      ctx.lineTo(0, 6.4);
      ctx.lineTo(-5.4, 1.6);
      ctx.closePath();
    });
    paint(ctx, env, P.crust, () => U.rr(ctx, -5.8, -4.2, 11.6, 2.6, 1.2));
    paint(ctx, env, P.sauce, () => {
      ctx.moveTo(-4.8, -1.8);
      ctx.lineTo(4.8, -1.8);
      ctx.lineTo(0, 4.6);
      ctx.closePath();
    });
    paint(ctx, env, P.cheese, () => {
      ctx.moveTo(-4.6, -1.9);
      ctx.lineTo(4.6, -1.9);
      ctx.lineTo(3.4, -0.4);
      ctx.lineTo(-3.6, -0.6);
      ctx.closePath();
    });
    ink(ctx, env, P.cheese, 0.5, () => {
      ctx.moveTo(1.2, 1.2);
      ctx.quadraticCurveTo(1.6, 3.6, 0.9, 6.6 + sway(env, 2) * 0.3);
    });
    paint(ctx, env, P.leafDark, () => {
      U.ellipse(ctx, -1.4, 0.4, 0.7, 0.4, 0.5);
      U.ellipse(ctx, 1.6, -0.2, 0.6, 0.35, -0.4);
    });
    ctx.restore();
  }

  K.registerFind(49, { id: 'deepDish', label: 'Deep dish', slot: 'item', place: { name: 'Navy Pier', city: 'Chicago', lat: 41.8916, lon: -87.6019, radius: 800 } }, deepDish);
})(window.Bud);

;
// lib/accessories/item/deer.js
/* Fawn, held: a piece found at Nara Park, Nara (find 75: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, hold, paint, plushEyes } = K.AccKit;

  // Nara Park: a spotted fawn.
  function deer(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    const coat = U.rgb('#C98B52');
    paint(ctx, env, coat, () => {
      U.ellipse(ctx, -0.6, 2.4, 4.2, 2.6);
      U.rr(ctx, -3.8, 3.2, 1, 3.4, 0.5);
      U.rr(ctx, 1.8, 3.2, 1, 3.4, 0.5);
      U.rr(ctx, 1.4, -3.4, 2, 5.4, 1);
    });
    paint(ctx, env, C.cup, () => {
      for (const [x, y] of [[-2.6, 1.4], [-1, 1], [0.6, 1.6], [-1.8, 2.8]]) ctx.arc(x, y, 0.45, 0, TAU);
    });
    paint(ctx, env, coat, () => {
      U.ellipse(ctx, 2.6, -4.4, 2.2, 1.9);
      U.ellipse(ctx, 0.4, -6, 1.6, 0.7, -0.6);
      U.ellipse(ctx, 4.8, -6, 1.6, 0.7, 0.6);
    });
    paint(ctx, env, U.rgb('#F2C4A0'), () => {
      U.ellipse(ctx, 0.4, -6, 1, 0.35, -0.6);
      U.ellipse(ctx, 4.8, -6, 1, 0.35, 0.6);
    });
    paint(ctx, env, U.lighten(coat, 0.45), () => U.ellipse(ctx, 3, -3.4, 1.2, 0.8));
    plushEyes(ctx, env, 2.6, -4.8, 0.9, 0.38);
    paint(ctx, env, C.lens, () => U.ellipse(ctx, 3, -3.6, 0.4, 0.3));
    ctx.restore();
  }

  K.registerFind(75, { id: 'deer', label: 'Fawn', slot: 'item', place: { name: 'Nara Park', city: 'Nara', lat: 34.684, lon: 135.8523, radius: 1200 } }, deer);
})(window.Bud);

;
// lib/accessories/item/dimSum.js
/* Dim sum, held: a piece found at The Peak Tower, Hong Kong (find 77: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { hold, paint, ink, steam } = K.AccKit;

  // Victoria Peak: dim sum, two buns in a bamboo steamer.
  function dimSum(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -4.2, 3.4);
    for (const x of [-2.2, 2.2]) {
      paint(ctx, env, U.rgb('#FBF6EC'), () => {
        ctx.moveTo(x - 2.4, -0.6);
        ctx.bezierCurveTo(x - 2.4, -3.6, x - 0.6, -4.4, x, -4.6);
        ctx.bezierCurveTo(x + 0.6, -4.4, x + 2.4, -3.6, x + 2.4, -0.6);
        ctx.closePath();
      });
      ink(ctx, env, U.rgb('#E2D7C2'), 0.3, () => {
        for (const k of [-1, -0.4, 0.4, 1]) {
          ctx.moveTo(x, -4.4);
          ctx.quadraticCurveTo(x + k * 1.2, -2.8, x + k * 1.9, -0.8);
        }
      });
    }
    paint(ctx, env, U.rgb('#D9B47A'), () => U.rr(ctx, -6, -1.2, 12, 6, 1.2));
    ink(ctx, env, U.rgb('#A8814A'), 0.35, () => {
      for (const y of [0.6, 2.4]) {
        ctx.moveTo(-5.6, y);
        ctx.lineTo(5.6, y);
      }
    });
    paint(ctx, env, U.rgb('#C49A5E'), () => U.rr(ctx, -6.2, -1.6, 12.4, 1, 0.5));
    ctx.restore();
  }

  K.registerFind(77, { id: 'dimSum', label: 'Dim sum', slot: 'item', place: { name: 'The Peak Tower', city: 'Hong Kong', lat: 22.2714, lon: 114.1499, radius: 600 } }, dimSum);
})(window.Bud);

;
// lib/accessories/item/dolphin.js
/* Dolphin, held: a piece found at Clearwater Beach, Clearwater (find 52: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, P, WHITE, hold, paint } = K.AccKit;

  // Clearwater Beach: a dolphin leaping out of a splash.
  function dolphin(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.6);
    const body = U.rgb('#6FA3D8');
    ctx.rotate(-0.3);
    paint(ctx, env, body, () => {
      ctx.moveTo(-6, 2.4);
      ctx.bezierCurveTo(-5.4, -3.4, 0, -6, 4.4, -3.4);
      ctx.quadraticCurveTo(6.4, -2.8, 6.8, -1.8);
      ctx.quadraticCurveTo(5.4, -1.6, 4.4, -1.2);
      ctx.bezierCurveTo(1, -1.2, -2.4, 0.6, -4, 3.6);
      ctx.closePath();
      ctx.moveTo(-0.6, -4.4);
      ctx.quadraticCurveTo(0.2, -7.2, 2, -7.6);
      ctx.quadraticCurveTo(1.4, -5.6, 1.6, -4.4);
      ctx.closePath();
      ctx.moveTo(-5.2, 2.4);
      ctx.quadraticCurveTo(-7.6, 3.4, -8, 5.6);
      ctx.quadraticCurveTo(-6, 4.2, -4.8, 4.6);
      ctx.quadraticCurveTo(-4.4, 5.8, -2.6, 6.6);
      ctx.quadraticCurveTo(-3.4, 4.6, -4, 3.4);
      ctx.closePath();
    });
    paint(ctx, env, U.lighten(body, 0.55), () => {
      ctx.moveTo(-3.6, 2.6);
      ctx.bezierCurveTo(-2, -0.6, 1.6, -1.4, 4.6, -1.3);
      ctx.bezierCurveTo(1.4, -0.4, -1.6, 0.8, -3.6, 2.6);
    });
    paint(ctx, env, C.lens, () => ctx.arc(3.2, -3.4, 0.45, 0, TAU));
    paint(ctx, env, WHITE, () => ctx.arc(3.05, -3.6, 0.15, 0, TAU));
    ctx.rotate(0.3);
    paint(ctx, env, P.sea, () => {
      for (const [x, y, r] of [[-5.6, 6.4, 0.7], [-2.2, 6.8, 0.55], [-7.4, 5.6, 0.45], [0.2, 6.2, 0.4]]) ctx.arc(x, y + sway(env, 3, x) * 0.3, r, 0, TAU);
    }, 0.85);
    ctx.restore();
  }

  K.registerFind(52, { id: 'dolphin', label: 'Dolphin', slot: 'item', place: { name: 'Clearwater Beach', city: 'Clearwater', lat: 27.9772, lon: -82.8289, radius: 1000 } }, dolphin);
})(window.Bud);

;
// lib/accessories/item/duckling.js
/* Duckling, held: a piece found at Public Garden, Boston (find 12). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // The Public Garden: a duckling, as in the famous bronze ducklings there.
  function duckling(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2.4) * 0.5);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.duck);
    ctx.beginPath();
    U.ellipse(ctx, 0.4, 1.6, 4.4, 3.4);
    U.ellipse(ctx, -2.2, -2.8, 2.6, 2.5);
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.duck, 0.12));
    ctx.beginPath();
    U.ellipse(ctx, 1.4, 1.2, 2.2, 1.3, -0.4);
    ctx.fill();
    ctx.fillStyle = env.c(C.beak);
    ctx.beginPath();
    U.ellipse(ctx, -4.9, -2.4, 1.4, 0.7, 0.15);
    ctx.fill();
    ctx.fillStyle = env.c(C.lens);
    ctx.beginPath();
    ctx.arc(-2.9, -3.3, 0.55, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(12, { id: 'duckling', label: 'Duckling', slot: 'item', place: { name: 'Public Garden', city: 'Boston', lat: 42.3541, lon: -71.0703, radius: 500 } }, duckling);
})(window.Bud);

;
// lib/accessories/item/eomuk.js
/* Eomuk, held: a piece found at Jagalchi Market, Busan (find 64: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, hold, ink, steam } = K.AccKit;

  // Jagalchi Market: eomuk, a ribbon of fish cake folded onto a skewer.
  function eomuk(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    steam(ctx, env, -9.6);
    ink(ctx, env, C.stick, 0.6, () => {
      ctx.moveTo(0, 6.6);
      ctx.lineTo(0, -10);
    });
    const cake = U.rgb('#E9B872');
    ink(ctx, env, cake, 2.2, () => {
      ctx.moveTo(-2.6, -8);
      for (let i = 0; i < 4; i++) {
        const y = -8 + i * 3.2;
        const s = i % 2 ? -1 : 1;
        ctx.bezierCurveTo(4 * s, y - 0.4, 4 * s, y + 1.8, 0, y + 1.6);
        ctx.bezierCurveTo(-4 * s, y + 1.4, -4 * s, y + 3.4, 0.4 * s, y + 3.2);
      }
    });
    ink(ctx, env, U.lighten(cake, 0.3), 0.5, () => {
      for (let i = 0; i < 4; i++) {
        const y = -7.6 + i * 3.2;
        ctx.moveTo(-1.6, y);
        ctx.quadraticCurveTo(0, y - 0.4, 1.6, y);
      }
    }, 0.7);
    ctx.restore();
  }

  K.registerFind(64, { id: 'eomuk', label: 'Eomuk', kr: '어묵', slot: 'item', place: { name: 'Jagalchi Market', city: 'Busan', lat: 35.0971, lon: 129.0313, radius: 500 } }, eomuk);
})(window.Bud);

;
// lib/accessories/item/flamingo.js
/* Flamingo, held: a piece found at South Beach, Miami Beach (find 16). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // South Beach: a pink flamingo on one leg.
  function flamingo(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 1.8) * 0.4);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.darken(C.flamingo, 0.15));
    ctx.lineWidth = 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.6, 1);
    ctx.lineTo(0.6, 7);
    ctx.moveTo(0.6, 3.6);
    ctx.lineTo(2.2, 2.4);
    ctx.lineTo(1, 2);
    ctx.stroke();
    ctx.fillStyle = env.c(C.flamingo);
    ctx.beginPath();
    U.ellipse(ctx, 1.4, -0.4, 3.8, 2.3, -0.25);
    ctx.fill();
    ctx.strokeStyle = env.c(C.flamingo);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-1.6, -1);
    ctx.bezierCurveTo(-3.6, -3.6, -0.4, -5.6, -2, -8.4);
    ctx.stroke();
    ctx.fillStyle = env.c(C.flamingo);
    ctx.beginPath();
    ctx.arc(-2.1, -8.8, 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(C.lens);
    ctx.beginPath();
    ctx.moveTo(-3.2, -8.9);
    ctx.lineTo(-4.6, -7.6);
    ctx.lineTo(-3.4, -8.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.flamingo, 0.2));
    ctx.beginPath();
    U.ellipse(ctx, 2.8, -0.6, 1.6, 0.9, -0.3);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(16, { id: 'flamingo', label: 'Flamingo', slot: 'item', place: { name: 'South Beach', city: 'Miami Beach', lat: 25.781, lon: -80.13, radius: 1500 } }, flamingo);
})(window.Bud);

;
// lib/accessories/item/gelato.js
/* Gelato, held: a piece found at Trevi Fountain, Rome (find 90: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, ink, gleam } = K.AccKit;

  // Trevi Fountain: gelato, a pistachio scoop and a strawberry one.
  function gelato(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    paint(ctx, env, U.rgb('#E2A85E'), () => {
      ctx.moveTo(-3.2, -2.4);
      ctx.lineTo(3.2, -2.4);
      ctx.lineTo(0, 6.4);
      ctx.closePath();
    });
    ctx.save();
    ctx.clip();
    ink(ctx, env, U.rgb('#B97A3A'), 0.35, () => {
      for (let i = -4; i <= 4; i++) {
        ctx.moveTo(i * 1.4 - 4, -2.4);
        ctx.lineTo(i * 1.4 + 4, 6.4);
        ctx.moveTo(i * 1.4 + 4, -2.4);
        ctx.lineTo(i * 1.4 - 4, 6.4);
      }
    });
    ctx.restore();
    paint(ctx, env, U.rgb('#B5D88A'), () => ctx.arc(0, -3.2, 3.2, 0, TAU));
    paint(ctx, env, U.rgb('#FF9EB5'), () => ctx.arc(0.3, -6.6, 2.6, 0, TAU));
    paint(ctx, env, U.rgb('#E64B6B'), () => {
      for (const [x, y] of [[-0.8, -7.2], [1.2, -6.2], [0.2, -8.2]]) ctx.arc(x, y, 0.3, 0, TAU);
    });
    paint(ctx, env, U.rgb('#7FA85A'), () => {
      for (const [x, y] of [[-1.4, -3], [1.2, -2.6], [-0.2, -4.4]]) ctx.arc(x, y, 0.28, 0, TAU);
    });
    gleam(ctx, env, -0.8, -7.4, 0.8, 0.4, -0.4, 0.4);
    ctx.restore();
  }

  K.registerFind(90, { id: 'gelato', label: 'Gelato', slot: 'item', place: { name: 'Trevi Fountain', city: 'Rome', lat: 41.9009, lon: 12.4833, radius: 400 } }, gelato);
})(window.Bud);

;
// lib/accessories/item/giraffe.js
/* Giraffe, held: a piece found at Giraffe Centre, Nairobi (find 100: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, hold, paint, ink } = K.AccKit;

  // The Giraffe Centre: a giraffe, neck up, spots and little horns.
  function giraffe(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    const coat = U.rgb('#F2C46B');
    const spot = U.rgb('#B9732F');
    ctx.rotate(sway(env, 1.6) * 0.04);
    paint(ctx, env, coat, () => {
      U.ellipse(ctx, -0.4, 3.4, 4, 2.6);
      U.rr(ctx, -3.6, 4.4, 1.2, 2.2, 0.5);
      U.rr(ctx, 1.6, 4.4, 1.2, 2.2, 0.5);
      U.rr(ctx, 1, -6, 2.2, 10, 1.1);
    });
    paint(ctx, env, spot, () => {
      for (const [x, y, r] of [[-2, 2.6, 0.9], [0.4, 3.8, 0.8], [-0.2, 2, 0.6], [2, -3.4, 0.6], [2.2, -0.4, 0.6], [1.7, 1.8, 0.5]]) {
        U.ellipse(ctx, x, y, r, r * 0.8);
      }
    });
    paint(ctx, env, coat, () => U.ellipse(ctx, 2.8, -7.4, 2.6, 1.9, 0.15));
    paint(ctx, env, U.lighten(coat, 0.35), () => U.ellipse(ctx, 4.4, -7, 1.1, 1, 0.15));
    ink(ctx, env, spot, 0.5, () => {
      ctx.moveTo(1.8, -9);
      ctx.lineTo(1.6, -10.6);
      ctx.moveTo(3.2, -9.1);
      ctx.lineTo(3.3, -10.7);
    });
    paint(ctx, env, spot, () => {
      ctx.arc(1.6, -10.7, 0.45, 0, TAU);
      ctx.arc(3.3, -10.8, 0.45, 0, TAU);
    });
    paint(ctx, env, C.lens, () => ctx.arc(2.6, -7.8, 0.45, 0, TAU));
    paint(ctx, env, C.earPink, () => U.ellipse(ctx, 3.6, -6.6, 0.6, 0.35), 0.6);
    ctx.restore();
  }

  K.registerFind(100, { id: 'giraffe', label: 'Giraffe', slot: 'item', place: { name: 'Giraffe Centre', city: 'Nairobi', lat: -1.3764, lon: 36.7454, radius: 600 } }, giraffe);
})(window.Bud);

;
// lib/accessories/item/globes.js
/* Snow globes, held: found at Lake Kawaguchi, the Pyramids of Giza and the Empire State Building. */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, P, WHITE, hold, paint, ink, gleam } = K.AccKit;

  // A snow globe with the place inside; snow (or glitter) drifts in it.
  function globe(scene, base, flake) {
    return (ctx, a, env) => {
      hold(ctx, a, env, 2, 0.3);
      paint(ctx, env, base, () => {
        ctx.moveTo(-4.7, 6);
        ctx.lineTo(4.7, 6);
        ctx.lineTo(3.7, 2.4);
        ctx.lineTo(-3.7, 2.4);
        ctx.closePath();
      });
      paint(ctx, env, U.darken(base, 0.22), () => U.rr(ctx, -4.9, 5.1, 9.8, 1.3, 0.55));
      paint(ctx, env, U.lighten(base, 0.25), () => U.rr(ctx, -3.6, 2.4, 7.2, 0.6, 0.3));
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, -2.6, 5.5, 0, TAU);
      ctx.clip();
      scene(ctx, env);
      for (let i = 0; i < 10; i++) {
        const x = -4.4 + ((i * 3.3) % 8.8);
        const y = -7 + ((i * 2.9) % 8.4) + sway(env, 1.4, i * 1.3) * 0.9;
        paint(ctx, env, flake, () => ctx.arc(x + sway(env, 1.1, i) * 0.4, y, 0.32 + (i % 3) * 0.08, 0, TAU), 0.9);
      }
      ctx.restore();
      paint(ctx, env, P.glass, () => ctx.arc(0, -2.6, 5.5, 0, TAU), 0.18);
      ink(ctx, env, WHITE, 0.45, () => ctx.arc(0, -2.6, 5.5, 0, TAU), 0.55);
      gleam(ctx, env, -2.3, -5.6, 1.5, 0.7, -0.6, 0.5);
      ctx.restore();
    };
  }
  // Lake Kawaguchi: Mount Fuji over the lake.
  const fujiGlobe = globe((ctx, env) => {
    paint(ctx, env, P.sky, () => ctx.rect(-6, -9, 12, 9));
    paint(ctx, env, P.sea, () => ctx.rect(-6, 0, 12, 4));
    paint(ctx, env, P.mountain, () => {
      ctx.moveTo(-6, 0.3);
      ctx.lineTo(-1.1, -5.8);
      ctx.lineTo(1.1, -5.8);
      ctx.lineTo(6, 0.3);
      ctx.closePath();
    });
    paint(ctx, env, P.snowcap, () => {
      ctx.moveTo(-1.1, -5.8);
      ctx.lineTo(1.1, -5.8);
      ctx.lineTo(2.6, -3.9);
      ctx.lineTo(1.4, -4.4);
      ctx.lineTo(0.4, -3.6);
      ctx.lineTo(-0.7, -4.4);
      ctx.lineTo(-2.6, -3.9);
      ctx.closePath();
    });
    paint(ctx, env, C.lock, () => ctx.arc(3.2, -6.4, 0.9, 0, TAU), 0.9);
  }, U.rgb('#C0392B'), WHITE);
  // Giza: the pyramids under a desert sun, in gold glitter.
  const pyramidGlobe = globe((ctx, env) => {
    paint(ctx, env, U.rgb('#FFD9A0'), () => ctx.rect(-6, -9, 12, 9));
    paint(ctx, env, P.sand, () => ctx.rect(-6, 0, 12, 4));
    paint(ctx, env, U.rgb('#FFB547'), () => ctx.arc(2.8, -5.6, 1.2, 0, TAU));
    for (const [x, h, s] of [[-1.4, 5.6, 4.2], [2.6, 3.4, 2.6]]) {
      paint(ctx, env, U.rgb('#E2B567'), () => {
        ctx.moveTo(x - s, 0.4);
        ctx.lineTo(x, 0.4 - h);
        ctx.lineTo(x + s, 0.4);
        ctx.closePath();
      });
      paint(ctx, env, U.rgb('#B98545'), () => {
        ctx.moveTo(x, 0.4 - h);
        ctx.lineTo(x + s, 0.4);
        ctx.lineTo(x + s * 0.2, 0.4);
        ctx.closePath();
      });
    }
  }, U.rgb('#3F6FB5'), C.gold);
  // The Empire State Building: an Art Deco tower over the city at night.
  const skylineGlobe = globe((ctx, env) => {
    paint(ctx, env, P.night, () => ctx.rect(-6, -9, 12, 13));
    paint(ctx, env, U.rgb('#4A5B8C'), () => {
      for (const [x, h] of [[-5.4, 3], [-3.6, 4.4], [2.6, 3.6], [4.2, 2.4]]) ctx.rect(x, 2 - h, 1.6, h + 2);
    });
    paint(ctx, env, U.rgb('#C9CDD6'), () => {
      ctx.moveTo(-1.6, 3);
      ctx.lineTo(-1.6, -2.4);
      ctx.lineTo(-1.1, -2.4);
      ctx.lineTo(-1.1, -4.2);
      ctx.lineTo(-0.6, -4.2);
      ctx.lineTo(-0.6, -5.6);
      ctx.lineTo(-0.15, -5.6);
      ctx.lineTo(0, -8.2);
      ctx.lineTo(0.15, -5.6);
      ctx.lineTo(0.6, -5.6);
      ctx.lineTo(0.6, -4.2);
      ctx.lineTo(1.1, -4.2);
      ctx.lineTo(1.1, -2.4);
      ctx.lineTo(1.6, -2.4);
      ctx.lineTo(1.6, 3);
      ctx.closePath();
    });
    ctx.fillStyle = env.c(C.light, 0.9);
    for (let y = -1.8; y < 2.6; y += 0.9) for (const x of [-1.1, -0.25, 0.6]) ctx.fillRect(x, y, 0.45, 0.4);
  }, U.rgb('#2B2D35'), WHITE);

  K.registerFind(74, { id: 'fujiGlobe', label: 'Fuji globe', slot: 'item', place: { name: 'Lake Kawaguchi', city: 'Fujikawaguchiko', lat: 35.514, lon: 138.7507, radius: 3000 } }, fujiGlobe);
  K.registerFind(98, { id: 'pyramidGlobe', label: 'Pyramid globe', slot: 'item', place: { name: 'Pyramids of Giza', city: 'Giza', lat: 29.9792, lon: 31.1342, radius: 1500 } }, pyramidGlobe);
  K.registerFind(33, { id: 'skylineGlobe', label: 'Skyline globe', slot: 'item', place: { name: 'Empire State Building', city: 'New York', lat: 40.7484, lon: -73.9857, radius: 400 } }, skylineGlobe);
})(window.Bud);

;
// lib/accessories/item/goldenGate.js
/* Golden Gate, held: a piece found at Golden Gate Bridge, San Francisco (find 1). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Golden Gate Bridge: a little span of it, towers, cables and the bay below.
  function goldenGate(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.water, 0.85);
    ctx.beginPath();
    U.rr(ctx, -7.2, 4.4, 14.4, 2.2, 1.1);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = env.c(C.bridge);
    // the hangers, from the main cable down to the deck
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    for (let x = -3.6; x <= 3.61; x += 0.9) {
      const t = (x / 4.2 + 1) / 2;
      const y = -6.8 * ((1 - t) * (1 - t) + t * t) + 2 * 2.4 * t * (1 - t);
      ctx.moveTo(x, y);
      ctx.lineTo(x, 2.4);
    }
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-7.1, 2);
    ctx.quadraticCurveTo(-5.6, -1.2, -4.2, -6.8);
    ctx.quadraticCurveTo(0, 2.4, 4.2, -6.8);
    ctx.quadraticCurveTo(5.6, -1.2, 7.1, 2);
    ctx.stroke();
    ctx.fillStyle = env.c(C.bridge);
    for (const tx of [-4.2, 4.2]) {
      ctx.beginPath();
      U.rr(ctx, tx - 0.95, -7.8, 0.6, 11.4, 0.25);
      U.rr(ctx, tx + 0.35, -7.8, 0.6, 11.4, 0.25);
      ctx.fill();
      ctx.beginPath();
      for (const y of [-7.4, -5, -2.6]) U.rr(ctx, tx - 0.95, y, 1.9, 0.5, 0.2);
      ctx.fill();
    }
    ctx.fillStyle = env.c(U.darken(C.bridge, 0.28));
    ctx.beginPath();
    U.rr(ctx, -7.2, 2.2, 14.4, 1.1, 0.45);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(1, { id: 'goldenGate', label: 'Golden Gate', slot: 'item', place: { name: 'Golden Gate Bridge', city: 'San Francisco', lat: 37.8199, lon: -122.4783, radius: 1500 } }, goldenGate);
})(window.Bud);

;
// lib/accessories/item/guitar.js
/* Guitar, held: a piece found at Lower Broadway, Nashville (find 48: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink } = K.AccKit;

  // Lower Broadway, Nashville: an acoustic guitar.
  function guitar(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(0.45);
    const body = U.rgb('#D9973F');
    paint(ctx, env, P.woodDark, () => {
      U.rr(ctx, -0.6, -11, 1.2, 8, 0.4);
      U.rr(ctx, -1, -12.6, 2, 2, 0.5);
    });
    paint(ctx, env, body, () => {
      ctx.arc(0, -1.6, 2.6, 0, TAU);
      ctx.arc(0, 2.6, 3.4, 0, TAU);
    });
    paint(ctx, env, U.darken(body, 0.18), () => ctx.arc(0, 2.6, 3.4, 0.2, Math.PI - 0.2), 0.5);
    paint(ctx, env, U.rgb('#2B1A10'), () => ctx.arc(0, 0.2, 1.05, 0, TAU));
    paint(ctx, env, P.woodDark, () => U.rr(ctx, -1.4, 3.6, 2.8, 0.6, 0.3));
    ink(ctx, env, U.rgb('#F2EAD6'), 0.12, () => {
      for (const x of [-0.3, 0, 0.3]) {
        ctx.moveTo(x, -11);
        ctx.lineTo(x, 3.8);
      }
    }, 0.8);
    ctx.restore();
  }

  K.registerFind(48, { id: 'guitar', label: 'Guitar', slot: 'item', place: { name: 'Lower Broadway', city: 'Nashville', lat: 36.1614, lon: -86.7761, radius: 600 } }, guitar);
})(window.Bud);

;
// lib/accessories/item/gyeongjuBread.js
/* Gyeongju bread, held: a piece found at Cheomseongdae, Gyeongju (find 69: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam } = K.AccKit;

  // Cheomseongdae: Gyeongju bread, a round bun stamped with a flower.
  function gyeongjuBread(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    paint(ctx, env, U.darken(P.crust, 0.1), () => U.ellipse(ctx, 0, 1.6, 5.4, 3.4));
    paint(ctx, env, P.crust, () => U.ellipse(ctx, 0, 0.6, 5.2, 3.4));
    paint(ctx, env, U.darken(P.crust, 0.25), () => {
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * TAU;
        U.ellipse(ctx, Math.cos(t) * 1.7, 0.4 + Math.sin(t) * 1.1, 0.6, 0.35, t);
      }
    }, 0.75);
    paint(ctx, env, U.darken(P.crust, 0.3), () => ctx.arc(0, 0.4, 0.55, 0, TAU), 0.8);
    gleam(ctx, env, -2.4, -1.4, 1.4, 0.5, -0.2, 0.3);
    ctx.restore();
  }

  K.registerFind(69, { id: 'gyeongjuBread', label: 'Gyeongju bread', kr: '경주빵', slot: 'item', place: { name: 'Cheomseongdae', city: 'Gyeongju', lat: 35.8347, lon: 129.219, radius: 700 } }, gyeongjuBread);
})(window.Bud);

;
// lib/accessories/item/hallabong.js
/* Hallabong, held: a piece found at Seongsan Ilchulbong, Jeju (find 66: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink, gleam } = K.AccKit;

  // Seongsan Ilchulbong: a hallabong, Jeju's bumpy-topped tangerine.
  function hallabong(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    const peel = U.rgb('#FF9A1F');
    paint(ctx, env, peel, () => U.ellipse(ctx, 0, 1, 5.4, 4.8));
    paint(ctx, env, peel, () => U.ellipse(ctx, 0, -3.6, 2.2, 1.9));
    paint(ctx, env, U.darken(peel, 0.12), () => U.ellipse(ctx, 0, 3.6, 4.4, 1.8), 0.5);
    ctx.fillStyle = env.c(U.darken(peel, 0.18), 0.5);
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(-4 + U.hash(i) * 8, -1.5 + U.hash(i + 20) * 6, 0.18, 0, TAU);
      ctx.fill();
    }
    ink(ctx, env, P.leafDark, 0.5, () => {
      ctx.moveTo(0, -5.3);
      ctx.lineTo(0.2, -6.2);
    });
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, 1.6, -6.2, 1.7, 0.7, -0.4));
    gleam(ctx, env, -2.2, -0.6, 1.2, 0.8, -0.5, 0.35);
    ctx.restore();
  }

  K.registerFind(66, { id: 'hallabong', label: 'Hallabong', kr: '한라봉', slot: 'item', place: { name: 'Seongsan Ilchulbong', city: 'Jeju', lat: 33.4584, lon: 126.9414, radius: 800 } }, hallabong);
})(window.Bud);

;
// lib/accessories/item/hareubang.js
/* Hareubang, held: a piece found at Jeju Stone Park, Jeju (find 67: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint } = K.AccKit;

  // Jeju Stone Park: a little dol hareubang, Jeju's stone grandfather.
  function hareubang(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.25);
    const rock = U.rgb('#7E838E');
    paint(ctx, env, rock, () => U.rr(ctx, -3.8, -2.4, 7.6, 8.6, 3));
    paint(ctx, env, U.darken(rock, 0.12), () => {
      U.ellipse(ctx, 0, -6.4, 3.6, 2.8);
      U.ellipse(ctx, 0, -4.2, 4.2, 0.9);
    });
    paint(ctx, env, rock, () => U.ellipse(ctx, 0, -2.2, 3.4, 2.6));
    paint(ctx, env, U.darken(rock, 0.3), () => {
      ctx.arc(-1.4, -2.8, 0.9, 0, TAU);
      ctx.arc(1.4, -2.8, 0.9, 0, TAU);
    });
    paint(ctx, env, U.lighten(rock, 0.2), () => U.ellipse(ctx, 0, -1.6, 0.8, 1.3));
    paint(ctx, env, U.darken(rock, 0.25), () => {
      U.rr(ctx, -3, 1.6, 3, 1.1, 0.5);
      U.rr(ctx, 0.2, 2.8, 3, 1.1, 0.5);
    });
    ctx.fillStyle = env.c(U.darken(rock, 0.35), 0.5);
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(-3 + U.hash(i) * 6, -7.6 + U.hash(i + 5) * 13, 0.2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(67, { id: 'hareubang', label: 'Hareubang', kr: '돌하르방', slot: 'item', place: { name: 'Jeju Stone Park', city: 'Jeju', lat: 33.4495, lon: 126.6597, radius: 900 } }, hareubang);
})(window.Bud);

;
// lib/accessories/item/kimbap.js
/* Kimbap, held: a piece found at Gwangjang Market, Seoul (find 58: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, gleam } = K.AccKit;

  // Gwangjang Market: three slices of kimbap.
  function kimbap(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    const fill = [P.yellow, P.leaf, U.rgb('#F28A3C'), U.rgb('#F5A3B5')];
    for (const [x, y] of [[-3.4, 2], [3.4, 2], [0, -2.6]]) {
      paint(ctx, env, P.nori, () => ctx.arc(x, y, 3.2, 0, TAU));
      paint(ctx, env, P.rice, () => ctx.arc(x, y, 2.6, 0, TAU));
      fill.forEach((col, i) => {
        const t = (i / fill.length) * TAU + 0.4;
        paint(ctx, env, col, () => ctx.arc(x + Math.cos(t) * 0.9, y + Math.sin(t) * 0.9, 0.7, 0, TAU));
      });
      ctx.fillStyle = env.c(U.rgb('#E9E3CF'));
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 2 + U.hash(i + x) * 3.6, y + 1 + U.hash(i + y) * 0.8, 0.35, 0.25);
    }
    gleam(ctx, env, -1.2, -4.6, 1.2, 0.4, -0.3, 0.25);
    ctx.restore();
  }

  K.registerFind(58, { id: 'kimbap', label: 'Kimbap', kr: '김밥', slot: 'item', place: { name: 'Gwangjang Market', city: 'Seoul', lat: 37.5698, lon: 127.0007, radius: 350 } }, kimbap);
})(window.Bud);

;
// lib/accessories/item/koala.js
/* Koala, held: a piece found at Lone Pine Koala Sanctuary, Brisbane (find 96: Oceania). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, gleam, plushEyes, blush } = K.AccKit;

  // Lone Pine: a koala with big fluffy ears.
  function koala(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    const fur = U.rgb('#A3A8B3');
    paint(ctx, env, fur, () => U.ellipse(ctx, 0, 2.8, 4.2, 3.6));
    paint(ctx, env, U.lighten(fur, 0.4), () => U.ellipse(ctx, 0, 3.4, 2.6, 2.4));
    for (const s of [-1, 1]) {
      paint(ctx, env, fur, () => ctx.arc(s * 4, -4.8, 2.6, 0, TAU));
      paint(ctx, env, U.lighten(fur, 0.55), () => ctx.arc(s * 4.1, -4.6, 1.5, 0, TAU));
    }
    paint(ctx, env, fur, () => U.ellipse(ctx, 0, -3, 4.4, 3.8));
    plushEyes(ctx, env, 0, -3.6, 2.2, 0.55);
    paint(ctx, env, U.rgb('#3A3D45'), () => U.ellipse(ctx, 0, -2.2, 1.1, 1.5));
    gleam(ctx, env, -0.3, -2.9, 0.3, 0.5, 0, 0.5);
    blush(ctx, env, 0, -1.6, 3, 0.6);
    ctx.restore();
  }

  K.registerFind(96, { id: 'koala', label: 'Koala', slot: 'item', place: { name: 'Lone Pine Koala Sanctuary', city: 'Brisbane', lat: -27.534, lon: 152.9688, radius: 600 } }, koala);
})(window.Bud);

;
// lib/accessories/item/lantern.js
/* Silk lantern, held: built-in accessory 19 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  function lantern(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.scale(s, s);
    const sw = sway(env, 1.6) * 0.12;
    ctx.strokeStyle = env.c([150, 110, 70]);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5, -9);
    ctx.stroke();
    ctx.translate(5, -9);
    ctx.rotate(sw);
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 3);
    ctx.stroke();
    F.glow(ctx, 0, 10, 16, C.light, 0.38, env);
    ctx.fillStyle = env.c(C.lanternRed);
    ctx.beginPath();
    U.rr(ctx, -5, 3.5, 10, 13, 3.2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    U.rr(ctx, -5, 3.5, 10, 13, 3.2);
    ctx.clip();
    ctx.fillStyle = env.c(C.lanternBlue);
    ctx.fillRect(-5, 3.5, 10, 6);
    const g = ctx.createRadialGradient(0, 10, 0, 0, 10, 6);
    g.addColorStop(0, env.c(C.light, 0.85));
    g.addColorStop(1, env.c(C.light, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-5, 3.5, 10, 13);
    ctx.restore();
    ctx.fillStyle = env.c(C.gold);
    ctx.fillRect(-3.4, 2.6, 6.8, 1.6);
    ctx.fillRect(-3.4, 15.8, 6.8, 1.6);
    ctx.strokeStyle = env.c(C.lanternRed);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 17.4);
    ctx.lineTo(0, 21);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(19, { id: 'lantern', label: 'Silk lantern', kr: '청사초롱', slot: 'item', kind: 'Held item (Korean traditional)' }, lantern);
})(window.Bud);

;
// lib/accessories/item/libertyBell.js
/* Liberty Bell, held: a piece found at Liberty Bell Center, Philadelphia (find 47: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink, gleam } = K.AccKit;

  // The Liberty Bell: a bronze bell hung from its yoke, crack and all.
  function libertyBell(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.3);
    paint(ctx, env, P.woodDark, () => U.rr(ctx, -5.4, -9.4, 10.8, 1.8, 0.7));
    ctx.translate(0, -7.6);
    ctx.rotate(sway(env, 1.6) * 0.08);
    paint(ctx, env, P.bronze, () => {
      ctx.arc(0, 0.6, 1, Math.PI, 0);
      ctx.moveTo(-2.6, 1.6);
      ctx.bezierCurveTo(-2.8, -0.4, 2.8, -0.4, 2.6, 1.6);
      ctx.bezierCurveTo(3, 5, 3.6, 8.6, 5.4, 10.4);
      ctx.quadraticCurveTo(5.8, 11.6, 4.6, 11.8);
      ctx.lineTo(-4.6, 11.8);
      ctx.quadraticCurveTo(-5.8, 11.6, -5.4, 10.4);
      ctx.bezierCurveTo(-3.6, 8.6, -3, 5, -2.6, 1.6);
    });
    paint(ctx, env, U.darken(P.bronze, 0.22), () => {
      ctx.rect(-3.1, 4, 6.2, 0.55);
      U.rr(ctx, -5.6, 10.6, 11.2, 1.2, 0.5);
    });
    ink(ctx, env, U.rgb('#3B2412'), 0.4, () => {
      ctx.moveTo(-0.6, 11.6);
      ctx.lineTo(0, 9.6);
      ctx.lineTo(-0.5, 8.2);
      ctx.lineTo(0.3, 6.4);
      ctx.lineTo(-0.1, 4.8);
    });
    gleam(ctx, env, -1.6, 5.6, 0.5, 2.6, 0.2, 0.35);
    ctx.restore();
  }

  K.registerFind(47, { id: 'libertyBell', label: 'Liberty Bell', slot: 'item', place: { name: 'Liberty Bell Center', city: 'Philadelphia', lat: 39.9497, lon: -75.1502, radius: 400 } }, libertyBell);
})(window.Bud);

;
// lib/accessories/item/library.js
/* Library book, held: a piece found at Boston Public Library, Boston (find 24: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, star5, P, hold, paint } = K.AccKit;

  // Boston Public Library: a green book with a gold band.
  function library(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.12);
    const cover = U.rgb('#2E7D5B');
    paint(ctx, env, U.rgb('#F7F1E1'), () => U.rr(ctx, -4.2, -5.6, 8.6, 11, 0.6));
    paint(ctx, env, cover, () => U.rr(ctx, -4.8, -6, 8.6, 11.4, 0.8));
    paint(ctx, env, U.darken(cover, 0.25), () => ctx.rect(-4.8, -6, 1.2, 11.4));
    paint(ctx, env, C.gold, () => {
      ctx.rect(-3.2, -3.4, 6.4, 0.9);
      ctx.rect(-3.2, 2, 6.4, 0.5);
    });
    paint(ctx, env, C.gold, () => star5(ctx, 0, -0.5, 1.2));
    paint(ctx, env, P.red, () => {
      ctx.moveTo(1.6, 5.2);
      ctx.lineTo(1.6, 7.4);
      ctx.lineTo(2.2, 6.8);
      ctx.lineTo(2.8, 7.4);
      ctx.lineTo(2.8, 5.2);
      ctx.closePath();
    });
    ctx.restore();
  }

  K.registerFind(24, { id: 'library', label: 'Library book', slot: 'item', place: { name: 'Boston Public Library', city: 'Boston', lat: 42.3493, lon: -71.0783, radius: 350 } }, library);
})(window.Bud);

;
// lib/accessories/item/lighthouse.js
/* Lighthouse, held: a piece found at Portland Head Light, Cape Elizabeth (find 28: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, P, hold, paint } = K.AccKit;

  // Portland Head Light: a striped lighthouse, its lamp glowing.
  function lighthouse(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    const glow = 0.55 + sway(env, 2.4) * 0.25;
    const beam = ctx.createLinearGradient(0, -8, 7.4, -8);
    beam.addColorStop(0, env.c(C.light, 0.85 * glow + 0.1));
    beam.addColorStop(1, env.c(C.gold, 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, -7.9);
    ctx.lineTo(7.4, -10.6);
    ctx.lineTo(7.4, -5.2);
    ctx.closePath();
    ctx.fill();
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(-2.4, 5.6);
      ctx.lineTo(-1.6, -6);
      ctx.lineTo(1.6, -6);
      ctx.lineTo(2.4, 5.6);
      ctx.closePath();
    });
    ctx.save();
    ctx.clip();
    paint(ctx, env, P.red, () => {
      ctx.rect(-3, -3.6, 6, 2);
      ctx.rect(-3, 0.8, 6, 2);
    });
    ctx.restore();
    paint(ctx, env, U.rgb('#2B2D35'), () => {
      U.rr(ctx, -2.2, -6.6, 4.4, 1, 0.3);
      ctx.moveTo(-1.6, -9.2);
      ctx.lineTo(1.6, -9.2);
      ctx.lineTo(0, -11);
      ctx.closePath();
    });
    paint(ctx, env, C.light, () => ctx.rect(-1.2, -9.2, 2.4, 2.6), 0.6 + glow * 0.4);
    paint(ctx, env, U.rgb('#8C8F98'), () => U.rr(ctx, -4, 5, 8, 1.4, 0.6));
    ctx.restore();
  }

  K.registerFind(28, { id: 'lighthouse', label: 'Lighthouse', slot: 'item', place: { name: 'Portland Head Light', city: 'Cape Elizabeth', lat: 43.6231, lon: -70.2079, radius: 500 } }, lighthouse);
})(window.Bud);

;
// lib/accessories/item/llama.js
/* Llama, held: a piece found at Machu Picchu, Cusco (find 106: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, plushEyes } = K.AccKit;

  // Machu Picchu: a fluffy llama with a woven blanket.
  function llama(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    const wool = U.rgb('#F7EEDF');
    paint(ctx, env, wool, () => {
      for (const [x, y, r] of [[-2.8, 2.6, 2.2], [0, 2, 2.6], [2.8, 2.6, 2.2], [-1.4, 4, 2], [1.6, 4, 2]]) ctx.arc(x, y, r, 0, TAU);
      U.rr(ctx, -3.2, 4.6, 1.2, 2, 0.5);
      U.rr(ctx, 2, 4.6, 1.2, 2, 0.5);
    });
    paint(ctx, env, wool, () => {
      U.rr(ctx, 1.6, -5.8, 2.6, 8, 1.3);
      U.ellipse(ctx, 3.4, -6.6, 2.2, 1.9);
      U.ellipse(ctx, 2.2, -8.8, 0.5, 1.4, -0.2);
      U.ellipse(ctx, 4.2, -8.9, 0.5, 1.4, 0.2);
    });
    const stripes = [U.rgb('#E2433B'), U.rgb('#FFD84D'), U.rgb('#2BB3A3'), U.rgb('#9B6BD8')];
    stripes.forEach((col, i) => paint(ctx, env, col, () => ctx.rect(-2.4 + i * 1.2, 0.2, 1.2, 2.6)));
    plushEyes(ctx, env, 3.4, -6.9, 0.85, 0.35);
    paint(ctx, env, U.rgb('#E9D9C0'), () => U.ellipse(ctx, 3.6, -5.4, 1, 0.7));
    ctx.restore();
  }

  K.registerFind(106, { id: 'llama', label: 'Llama', slot: 'item', place: { name: 'Machu Picchu', city: 'Cusco', lat: -13.1638, lon: -72.5453, radius: 1000 } }, llama);
})(window.Bud);

;
// lib/accessories/item/lotus.js
/* Lotus, held: a piece found at Changdeokgung Palace, Seoul (find 61: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint } = K.AccKit;

  // Changdeokgung: a pink lotus on its pad.
  function lotus(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.35);
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, 0, 4.2, 6, 1.8));
    paint(ctx, env, P.leafDark, () => {
      ctx.moveTo(0, 4.2);
      ctx.lineTo(4.4, 3.2);
      ctx.lineTo(4.6, 4.4);
      ctx.closePath();
    });
    const petal = U.rgb('#FF9EC4');
    for (const [r, s] of [[-0.9, 1], [0.9, 1], [-0.45, 1.1], [0.45, 1.1], [0, 1.2]]) {
      ctx.save();
      ctx.translate(0, 3);
      ctx.rotate(r);
      paint(ctx, env, r === 0 ? U.lighten(petal, 0.2) : petal, () => {
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-2.2 * s, -2, -1.6 * s, -6, 0, -7.4 * s);
        ctx.bezierCurveTo(1.6 * s, -6, 2.2 * s, -2, 0, 0);
      });
      ctx.restore();
    }
    paint(ctx, env, P.yellow, () => ctx.arc(0, 1.6, 0.8, 0, TAU));
    ctx.restore();
  }

  K.registerFind(61, { id: 'lotus', label: 'Lotus', kr: '연꽃', slot: 'item', place: { name: 'Changdeokgung Palace', city: 'Seoul', lat: 37.5794, lon: 126.9928, radius: 500 } }, lotus);
})(window.Bud);

;
// lib/accessories/item/loveLock.js
/* Love lock, held: a piece found at N Seoul Tower, Seoul (find 5). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  // N Seoul Tower: a love lock with a heart on it.
  function loveLock(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.4);
    ctx.rotate(0.06 * sway(env, 1.7));
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(C.steel);
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2.4, -2.6);
    ctx.lineTo(-2.4, -5.2);
    ctx.arc(0, -5.2, 2.4, Math.PI, 0);
    ctx.lineTo(2.4, -2.6);
    ctx.stroke();
    ctx.fillStyle = env.c(C.lock);
    ctx.beginPath();
    U.rr(ctx, -4, -3, 8, 7.4, 1.8);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.92);
    ctx.beginPath();
    F.heart(ctx, 0, 0.5, 1.7);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.25);
    ctx.beginPath();
    U.rr(ctx, -3.3, -2.4, 1.2, 5.6, 0.6);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(5, { id: 'loveLock', label: 'Love lock', slot: 'item', place: { name: 'N Seoul Tower', city: 'Seoul', lat: 37.5512, lon: 126.9882, radius: 700 } }, loveLock);
})(window.Bud);

;
// lib/accessories/item/manatee.js
/* Manatee, held: a piece found at Blue Spring State Park, Orange City (find 57: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, gleam, plushEyes } = K.AccKit;

  // Blue Spring: a gentle manatee.
  function manatee(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.5);
    const skin = U.rgb('#9AA3AE');
    ctx.rotate(-0.15);
    paint(ctx, env, skin, () => {
      U.ellipse(ctx, 0, 0, 5.4, 3.4);
      U.ellipse(ctx, 5.6, 1.2, 2.2, 1.8);
      U.ellipse(ctx, -0.6, 3.2, 1.6, 0.7, 0.5);
    });
    paint(ctx, env, U.lighten(skin, 0.25), () => U.ellipse(ctx, -4.4, 0.4, 2.2, 1.9));
    plushEyes(ctx, env, -3.6, -1.2, 0.01, 0.38);
    paint(ctx, env, U.darken(skin, 0.2), () => {
      ctx.arc(-5.6, 0.2, 0.2, 0, TAU);
      ctx.arc(-5.1, 0.8, 0.2, 0, TAU);
    });
    gleam(ctx, env, 0, -2, 2.6, 0.6, 0, 0.25);
    ctx.restore();
  }

  K.registerFind(57, { id: 'manatee', label: 'Manatee', slot: 'item', place: { name: 'Blue Spring State Park', city: 'Orange City', lat: 28.9481, lon: -81.34, radius: 1200 } }, manatee);
})(window.Bud);

;
// lib/accessories/item/mapleSyrup.js
/* Maple syrup, held: a piece found at Château Frontenac, Quebec City (find 103: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, hold, paint, ink, gleam } = K.AccKit;

  // Château Frontenac: a jug of maple syrup with a red leaf on the label.
  function mapleSyrup(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    paint(ctx, env, U.rgb('#C46A1A'), () => {
      ctx.moveTo(-1.2, -6.2);
      ctx.lineTo(1.2, -6.2);
      ctx.lineTo(1.4, -4);
      ctx.bezierCurveTo(4.6, -3.2, 4.8, -1, 4.8, 1);
      ctx.lineTo(4.8, 5.4);
      ctx.lineTo(-4.8, 5.4);
      ctx.lineTo(-4.8, 1);
      ctx.bezierCurveTo(-4.8, -1, -4.6, -3.2, -1.4, -4);
      ctx.closePath();
    }, 0.92);
    ink(ctx, env, U.rgb('#C46A1A'), 0.9, () => ctx.arc(4.4, -0.6, 1.8, -1.6, 1.4), 0.92);
    paint(ctx, env, C.cup, () => U.rr(ctx, -3.8, -0.4, 7.6, 4.4, 0.6));
    ctx.fillStyle = env.c(U.rgb('#D7263D'));
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? 0.75 : 1.7;
      const t = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i) ctx.lineTo(rad * Math.cos(t), 1.8 + rad * Math.sin(t));
      else ctx.moveTo(rad * Math.cos(t), 1.8 + rad * Math.sin(t));
    }
    ctx.closePath();
    ctx.fill();
    paint(ctx, env, U.rgb('#D7263D'), () => ctx.rect(-0.15, 1.8, 0.3, 1.4));
    paint(ctx, env, U.rgb('#2B2D35'), () => U.rr(ctx, -1.4, -7, 2.8, 1.2, 0.4));
    gleam(ctx, env, -3.4, -1.6, 0.5, 1.6, 0.2, 0.3);
    ctx.restore();
  }

  K.registerFind(103, { id: 'mapleSyrup', label: 'Maple syrup', slot: 'item', place: { name: 'Château Frontenac', city: 'Quebec City', lat: 46.8116, lon: -71.205, radius: 500 } }, mapleSyrup);
})(window.Bud);

;
// lib/accessories/item/matcha.js
/* Matcha, held: a piece found at Arashiyama Bamboo Grove, Kyoto (find 71: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, paint, ink, steamingCup } = K.AccKit;

  // Arashiyama: a bowl of frothy matcha, its bamboo whisk leaning in.
  function matcha(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      ink(ctx, env, U.rgb('#E9D9B0'), 0.6, () => {
        ctx.moveTo(3.4, -6.6);
        ctx.lineTo(1.6, -2.6);
      });
      paint(ctx, env, U.rgb('#3E4F45'), () => {
        ctx.moveTo(-5.4, -3);
        ctx.lineTo(5.4, -3);
        ctx.bezierCurveTo(5.2, 3, 3, 4.6, 0, 4.6);
        ctx.bezierCurveTo(-3, 4.6, -5.2, 3, -5.4, -3);
      });
      paint(ctx, env, U.rgb('#2C3A32'), () => U.rr(ctx, -2, 4.2, 4, 1.2, 0.5));
      ink(ctx, env, U.rgb('#7D9A86'), 0.5, () => {
        ctx.moveTo(-5, -0.6);
        ctx.quadraticCurveTo(0, 0.6, 5, -0.6);
      }, 0.8);
    }, () => {
      paint(ctx, env, P.matcha, () => U.ellipse(ctx, 0, -3, 5.2, 1.1));
      paint(ctx, env, U.lighten(P.matcha, 0.3), () => U.ellipse(ctx, -0.8, -3.1, 2.4, 0.5));
    });
  }

  K.registerFind(71, { id: 'matcha', label: 'Matcha', slot: 'item', place: { name: 'Arashiyama Bamboo Grove', city: 'Kyoto', lat: 35.0167, lon: 135.6712, radius: 800 } }, matcha);
})(window.Bud);

;
// lib/accessories/item/mintTea.js
/* Mint tea, held: a piece found at Jemaa el-Fnaa, Marrakesh (find 99: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, P, paint, ink, steamingCup } = K.AccKit;

  // Jemaa el-Fnaa: mint tea in a gold-rimmed glass, sprigs on top.
  function mintTea(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      paint(ctx, env, P.glass, () => {
        ctx.moveTo(-3.2, -4.2);
        ctx.lineTo(3.2, -4.2);
        ctx.lineTo(2.4, 5.4);
        ctx.lineTo(-2.4, 5.4);
        ctx.closePath();
      }, 0.5);
      paint(ctx, env, U.rgb('#D49A3A'), () => {
        ctx.moveTo(-3, -2);
        ctx.lineTo(3, -2);
        ctx.lineTo(2.4, 5.4);
        ctx.lineTo(-2.4, 5.4);
        ctx.closePath();
      }, 0.9);
      ink(ctx, env, C.gold, 0.6, () => {
        ctx.moveTo(-3.2, -4.2);
        ctx.lineTo(3.2, -4.2);
        ctx.moveTo(-2.7, 0.8);
        ctx.lineTo(2.7, 0.8);
      });
      paint(ctx, env, C.gold, () => {
        for (const x of [-1.6, 0, 1.6]) U.ellipse(ctx, x, 2.6, 0.45, 0.7);
      }, 0.9);
    }, () => {
      for (const [x, r] of [[-1, -0.5], [0.8, 0.4], [0, 0]]) {
        paint(ctx, env, P.mint, () => U.ellipse(ctx, x, -5.6, 0.9, 1.6, r));
      }
      ink(ctx, env, P.leafDark, 0.35, () => {
        ctx.moveTo(0, -4);
        ctx.lineTo(0, -6.8);
      });
    });
  }

  K.registerFind(99, { id: 'mintTea', label: 'Mint tea', slot: 'item', place: { name: 'Jemaa el-Fnaa', city: 'Marrakesh', lat: 31.6258, lon: -7.9892, radius: 500 } }, mintTea);
})(window.Bud);

;
// lib/accessories/item/mosaicLizard.js
/* Mosaic lizard, held: a piece found at Park Güell, Barcelona (find 92: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, hold, paint } = K.AccKit;

  // Park Güell: a little lizard in mosaic tiles.
  function mosaicLizard(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.rotate(-0.4);
    const tiles = [U.rgb('#2BB3A3'), U.rgb('#FFD84D'), U.rgb('#4A8FE7'), U.rgb('#F28A3C'), U.rgb('#7FD1AE')];
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, 5, 2);
    U.ellipse(ctx, 5.4, -0.4, 2, 1.5);
    ctx.moveTo(-4.6, -0.6);
    ctx.quadraticCurveTo(-8, 0, -7.4, 3.4);
    ctx.quadraticCurveTo(-7, 0.8, -4.6, 0.8);
    for (const [x, s] of [[-2.4, 1], [2.4, 1], [-2.4, -1], [2.4, -1]]) U.ellipse(ctx, x, s * 2.4, 0.7, 1.4, s * 0.4);
    ctx.fillStyle = env.c(tiles[0]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 40; i++) {
      paint(ctx, env, tiles[i % tiles.length], () => ctx.rect(-8 + (i % 10) * 1.6, -3.4 + Math.floor(i / 10) * 1.7, 1.4, 1.5));
    }
    ctx.restore();
    paint(ctx, env, C.lens, () => ctx.arc(6.2, -1, 0.4, 0, TAU));
    ctx.restore();
  }

  K.registerFind(92, { id: 'mosaicLizard', label: 'Mosaic lizard', slot: 'item', place: { name: 'Park Güell', city: 'Barcelona', lat: 41.4139, lon: 2.1526, radius: 600 } }, mosaicLizard);
})(window.Bud);

;
// lib/accessories/item/onigiri.js
/* Onigiri, held: a piece found at Shibuya Crossing, Tokyo (find 73: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint } = K.AccKit;

  // Shibuya Crossing: an onigiri, wrapped in nori.
  function onigiri(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    paint(ctx, env, P.rice, () => {
      ctx.moveTo(0, -6.4);
      ctx.bezierCurveTo(2.2, -6.4, 6.4, 2.4, 5.6, 4);
      ctx.bezierCurveTo(4.8, 5.4, -4.8, 5.4, -5.6, 4);
      ctx.bezierCurveTo(-6.4, 2.4, -2.2, -6.4, 0, -6.4);
    });
    ctx.fillStyle = env.c(U.rgb('#E7E3D6'));
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      U.ellipse(ctx, -3.4 + U.hash(i) * 6.8, -2.6 + U.hash(i + 30) * 6, 0.35, 0.2, U.hash(i + 7) * 3);
      ctx.fill();
    }
    paint(ctx, env, P.nori, () => U.rr(ctx, -2.4, 0.6, 4.8, 4.6, 0.4));
    paint(ctx, env, U.lighten(P.nori, 0.15), () => ctx.rect(-2.4, 1.6, 4.8, 0.3), 0.7);
    ctx.restore();
  }

  K.registerFind(73, { id: 'onigiri', label: 'Onigiri', slot: 'item', place: { name: 'Shibuya Crossing', city: 'Tokyo', lat: 35.6595, lon: 139.7005, radius: 400 } }, onigiri);
})(window.Bud);

;
// lib/accessories/item/orchid.js
/* Orchid, held: a piece found at Gardens by the Bay, Singapore (find 80: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink } = K.AccKit;

  // Gardens by the Bay: a purple orchid sprig.
  function orchid(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, P.leafDark, 0.5, () => {
      ctx.moveTo(-1.4, 6.4);
      ctx.quadraticCurveTo(-1, -2, 2.4, -7.6);
    });
    for (const [x, y, r] of [[1.6, -6.4, 2.4], [-1, -0.6, 2.8]]) {
      paint(ctx, env, P.purple, () => {
        for (let i = 0; i < 5; i++) {
          const t = (i / 5) * TAU - Math.PI / 2;
          U.ellipse(ctx, x + Math.cos(t) * r * 0.5, y + Math.sin(t) * r * 0.5, r * 0.42, r * 0.28, t);
        }
      });
      paint(ctx, env, U.rgb('#E7C2FF'), () => ctx.arc(x, y, r * 0.3, 0, TAU));
      paint(ctx, env, P.yellow, () => ctx.arc(x, y + r * 0.1, r * 0.12, 0, TAU));
    }
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, -3, 5, 3, 0.9, -0.4));
    ctx.restore();
  }

  K.registerFind(80, { id: 'orchid', label: 'Orchid', slot: 'item', place: { name: 'Gardens by the Bay', city: 'Singapore', lat: 1.283, lon: 103.865, radius: 900 } }, orchid);
})(window.Bud);

;
// lib/accessories/item/panda.js
/* Panda, held: a piece found at Chengdu Panda Base, Chengdu (find 76: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, WHITE, hold, paint, ink, blush } = K.AccKit;

  // The Chengdu panda base: a panda with a bamboo sprig.
  function panda(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, 2.6, 4.6, 3.8));
    paint(ctx, env, P.ink, () => {
      U.ellipse(ctx, -3.6, 4.6, 1.6, 1.3);
      U.ellipse(ctx, 3.6, 4.6, 1.6, 1.3);
      U.ellipse(ctx, -3.8, 1.4, 1.2, 2, 0.4);
    });
    ink(ctx, env, P.leaf, 0.6, () => {
      ctx.moveTo(4.8, 4.4);
      ctx.lineTo(3.6, -4.6);
    });
    paint(ctx, env, P.leaf, () => {
      U.ellipse(ctx, 5, -3.2, 1.6, 0.5, -0.6);
      U.ellipse(ctx, 2.6, -2.2, 1.4, 0.45, 0.5);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 3.8, 1.6, 1.2, 1.9, -0.4));
    paint(ctx, env, P.ink, () => {
      ctx.arc(-3.2, -6.6, 1.5, 0, TAU);
      ctx.arc(3.2, -6.6, 1.5, 0, TAU);
    });
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, -3.6, 4.4, 3.6));
    paint(ctx, env, P.ink, () => {
      U.ellipse(ctx, -1.6, -3.8, 1.1, 1.4, 0.5);
      U.ellipse(ctx, 1.6, -3.8, 1.1, 1.4, -0.5);
    });
    paint(ctx, env, WHITE, () => {
      ctx.arc(-1.5, -4, 0.4, 0, TAU);
      ctx.arc(1.7, -4, 0.4, 0, TAU);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 0, -2.2, 0.7, 0.45));
    blush(ctx, env, 0, -1.8, 2.8, 0.6);
    ctx.restore();
  }

  K.registerFind(76, { id: 'panda', label: 'Panda', slot: 'item', place: { name: 'Chengdu Panda Base', city: 'Chengdu', lat: 30.7409, lon: 104.1374, radius: 1000 } }, panda);
})(window.Bud);

;
// lib/accessories/item/paperBoat.js
/* Paper boat, held: a piece found at Cheonggye Plaza, Seoul (find 62: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, P, hold, paint, ink } = K.AccKit;

  // Cheonggyecheon: a folded paper boat, bobbing on the stream.
  function paperBoat(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.6);
    ctx.rotate(sway(env, 1.8) * 0.08);
    paint(ctx, env, P.sea, () => U.ellipse(ctx, 0, 4.8, 6.4, 1.2), 0.5);
    paint(ctx, env, U.rgb('#BFE2F5'), () => {
      ctx.moveTo(-6, 0.4);
      ctx.lineTo(6, 0.4);
      ctx.lineTo(4, 4.2);
      ctx.lineTo(-4, 4.2);
      ctx.closePath();
    });
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(-3, 0.6);
      ctx.lineTo(0, -6);
      ctx.lineTo(3, 0.6);
      ctx.closePath();
    });
    paint(ctx, env, U.rgb('#E3EEF7'), () => {
      ctx.moveTo(0, -6);
      ctx.lineTo(3, 0.6);
      ctx.lineTo(0.6, 0.6);
      ctx.closePath();
    });
    ink(ctx, env, U.rgb('#8FB8D8'), 0.3, () => {
      ctx.moveTo(-6, 0.4);
      ctx.lineTo(-3, 0.6);
      ctx.moveTo(6, 0.4);
      ctx.lineTo(3, 0.6);
    });
    ctx.restore();
  }

  K.registerFind(62, { id: 'paperBoat', label: 'Paper boat', kr: '종이배', slot: 'item', place: { name: 'Cheonggye Plaza', city: 'Seoul', lat: 37.5692, lon: 126.9778, radius: 450 } }, paperBoat);
})(window.Bud);

;
// lib/accessories/item/penguin.js
/* Penguin, held: a piece found at Boulders Beach, Cape Town (find 101: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, P, hold, paint, plushEyes, blush } = K.AccKit;

  // Boulders Beach: an African penguin.
  function penguin(ctx, a, env) {
    hold(ctx, a, env, 2.4, 0.4);
    ctx.rotate(sway(env, 2.4) * 0.06);
    paint(ctx, env, C.beak, () => {
      U.ellipse(ctx, -1.8, 6, 1.4, 0.6);
      U.ellipse(ctx, 1.8, 6, 1.4, 0.6);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 0, 0.2, 4.6, 6.2));
    paint(ctx, env, P.ink, () => {
      U.ellipse(ctx, -4.4, 0.6, 1.1, 3, 0.35);
      U.ellipse(ctx, 4.4, 0.6, 1.1, 3, -0.35);
    });
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, 1.8, 3.2, 4.2));
    paint(ctx, env, C.cup, () => {
      U.ellipse(ctx, -1.5, -2.8, 1.5, 1.2);
      U.ellipse(ctx, 1.5, -2.8, 1.5, 1.2);
    });
    plushEyes(ctx, env, 0, -2.8, 1.5, 0.55);
    paint(ctx, env, C.beak, () => {
      ctx.moveTo(-0.9, -1.6);
      ctx.lineTo(0.9, -1.6);
      ctx.lineTo(0, -0.4);
      ctx.closePath();
    });
    blush(ctx, env, 0, -1.4, 2.4, 0.6);
    ctx.restore();
  }

  K.registerFind(101, { id: 'penguin', label: 'Penguin', slot: 'item', place: { name: 'Boulders Beach', city: 'Cape Town', lat: -34.1975, lon: 18.4517, radius: 800 } }, penguin);
})(window.Bud);

;
// lib/accessories/item/pennants.js
/* Campus pennants, held: found at Stanford and Berkeley. */
(function (K) {
  'use strict';
  const { TAU } = K.util;
  const { C, sway, star5, P, hold, paint, ink } = K.AccKit;

  // A campus pennant on a stick, in the school's colors (no letters, no crest).
  function pennant(main, trim) {
    return (ctx, a, env) => {
      hold(ctx, a, env, 1.8, 0.3);
      ink(ctx, env, C.stick, 0.9, () => {
        ctx.moveTo(-4.4, 6);
        ctx.lineTo(-4.4, -10.4);
      });
      paint(ctx, env, C.gold, () => ctx.arc(-4.4, -10.8, 0.75, 0, TAU));
      const f = sway(env, 3.2) * 0.6;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.quadraticCurveTo(0.8, -8.8 + f, 6.4, -6.8 + f * 1.4);
      ctx.quadraticCurveTo(0.8, -5.4 + f, -4, -3.4);
      ctx.closePath();
      ctx.fillStyle = env.c(main);
      ctx.fill();
      ctx.save();
      ctx.clip();
      paint(ctx, env, trim, () => ctx.rect(-4, -10.4, 1.5, 7.4));
      ink(ctx, env, trim, 0.4, () => {
        ctx.moveTo(-2.5, -9.6);
        ctx.quadraticCurveTo(1, -8.5 + f, 6.4, -6.8 + f * 1.4);
      }, 0.7);
      ctx.restore();
      paint(ctx, env, trim, () => star5(ctx, 1.2, -6.6 + f * 0.6, 1.15));
      ctx.restore();
    };
  }
  const stanfordPennant = pennant(P.cardinal, C.cup);
  const berkeleyPennant = pennant(P.berkeley, C.gold);

  K.registerFind(41, { id: 'stanfordPennant', label: 'Stanford pennant', slot: 'item', place: { name: 'Stanford Main Quad', city: 'Stanford', lat: 37.4268, lon: -122.1705, radius: 700 } }, stanfordPennant);
  K.registerFind(42, { id: 'berkeleyPennant', label: 'Berkeley pennant', slot: 'item', place: { name: 'Sather Tower', city: 'Berkeley', lat: 37.8721, lon: -122.2578, radius: 700 } }, berkeleyPennant);
})(window.Bud);

;
// lib/accessories/item/pouch.js
/* Lucky pouch, held: built-in accessory 20 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function pouch(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.6);
    ctx.scale(s, s);
    ctx.fillStyle = env.c(C.pouch);
    ctx.beginPath();
    ctx.moveTo(-2.6, -3.2);
    ctx.bezierCurveTo(-7.5, -1, -6.8, 6.4, 0, 6.4);
    ctx.bezierCurveTo(6.8, 6.4, 7.5, -1, 2.6, -3.2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.6, -3.2);
    ctx.lineTo(-4.2, -6);
    ctx.lineTo(4.2, -6);
    ctx.lineTo(2.6, -3.2);
    ctx.closePath();
    ctx.fillStyle = env.c(C.pouchDark);
    ctx.fill();
    ctx.fillStyle = env.c(C.gold);
    ctx.fillRect(-3, -3.8, 6, 1.2);
    ctx.beginPath();
    ctx.arc(0, 1.8, 1.9, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    U.ellipse(ctx, -1.8, -4.6, 1.6, 1, -0.4);
    U.ellipse(ctx, 1.8, -4.6, 1.6, 1, 0.4);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(20, { id: 'pouch', label: 'Lucky pouch', kr: '복주머니', slot: 'item', kind: 'Held item (Seollal)', seasonal: true }, pouch);
})(window.Bud);

;
// lib/accessories/item/present.js
/* Present, held: a Christmas piece (reward 4), in the wardrobe all year. */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, hold, paint, gleam } = K.AccKit;

  // Christmas: a green box tied with a gold ribbon and a big bow.
  function present(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.scale(1.2, 1.2);
    paint(ctx, env, C.gift, () => U.rr(ctx, -4, -2.4, 8, 6.8, 0.8));
    paint(ctx, env, C.giftDark, () => U.rr(ctx, -4.6, -3.8, 9.2, 2.2, 0.6));
    paint(ctx, env, C.gold, () => ctx.rect(-0.75, -3.8, 1.5, 8.2));
    paint(ctx, env, C.gold, () => ctx.rect(-4, 0.9, 8, 1.2));
    // the bow: two loops and a knot
    for (let s = -1; s <= 1; s += 2) {
      paint(ctx, env, C.gold, () => U.ellipse(ctx, s * 1.55, -4.75, 1.7, 1.05, s * 0.45));
      paint(ctx, env, U.darken(C.gold, 0.25), () => U.ellipse(ctx, s * 1.45, -4.7, 0.7, 0.4, s * 0.45));
    }
    paint(ctx, env, U.darken(C.gold, 0.1), () => ctx.arc(0, -4.3, 0.75, 0, Math.PI * 2));
    gleam(ctx, env, -2.6, -0.6, 0.5, 1.4, 0.15, 0.22);
    ctx.restore();
  }

  K.registerReward(4, { id: 'present', label: 'Present', slot: 'item', how: 'christmas' }, present);
})(window.Bud);

;
// lib/accessories/item/pretzel.js
/* Pretzel, held: a piece found at Marienplatz, Munich (find 87: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, WHITE, hold, ink } = K.AccKit;

  // Marienplatz: a salted pretzel.
  function pretzel(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, P.crustDark, 1.9, () => {
      ctx.moveTo(-3.6, 4.2);
      ctx.bezierCurveTo(-6.6, 1, -5.6, -5, -1.6, -4.6);
      ctx.bezierCurveTo(1.6, -4.2, 1.8, 1.2, 0, 1.4);
      ctx.bezierCurveTo(-1.8, 1.2, -1.6, -4.2, 1.6, -4.6);
      ctx.bezierCurveTo(5.6, -5, 6.6, 1, 3.6, 4.2);
      ctx.moveTo(-3.6, 4.2);
      ctx.quadraticCurveTo(0, 2.6, 3.6, 4.2);
    });
    ink(ctx, env, U.lighten(P.crustDark, 0.25), 0.55, () => {
      ctx.moveTo(-4.6, -1.6);
      ctx.quadraticCurveTo(-4.4, -4, -2, -4.3);
    }, 0.6);
    ctx.fillStyle = env.c(WHITE);
    for (const [x, y] of [[-4.8, 0.4], [-3, -4], [3, -4.2], [4.9, 0.2], [-0.4, 3.4], [1.6, 3.5], [0, -0.6]]) {
      ctx.fillRect(x, y, 0.45, 0.45);
    }
    ctx.restore();
  }

  K.registerFind(87, { id: 'pretzel', label: 'Pretzel', slot: 'item', place: { name: 'Marienplatz', city: 'Munich', lat: 48.1373, lon: 11.5755, radius: 400 } }, pretzel);
})(window.Bud);

;
// lib/accessories/item/protea.js
/* Protea, held: a piece found at Kirstenbosch Garden, Cape Town (find 102: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, ink } = K.AccKit;

  // Kirstenbosch: a king protea.
  function protea(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, P.leafDark, 0.7, () => {
      ctx.moveTo(0, 6.4);
      ctx.lineTo(0, 0);
    });
    paint(ctx, env, P.leaf, () => {
      U.ellipse(ctx, -1.8, 4.4, 1.8, 0.6, -0.5);
      U.ellipse(ctx, 1.8, 3.4, 1.8, 0.6, 0.5);
    });
    const pink = U.rgb('#F28AB2');
    for (let i = 0; i < 9; i++) {
      const t = -Math.PI + (i / 8) * Math.PI;
      ctx.save();
      ctx.translate(0, -1);
      ctx.rotate(t + Math.PI / 2);
      paint(ctx, env, i % 2 ? pink : U.darken(pink, 0.12), () => {
        ctx.moveTo(-0.9, 0);
        ctx.quadraticCurveTo(-0.8, -4, 0, -5.4);
        ctx.quadraticCurveTo(0.8, -4, 0.9, 0);
        ctx.closePath();
      });
      ctx.restore();
    }
    paint(ctx, env, U.rgb('#FBE7EF'), () => U.ellipse(ctx, 0, -2.4, 2.2, 2.6));
    ink(ctx, env, U.rgb('#E7B8C9'), 0.25, () => {
      for (const x of [-1, 0, 1]) {
        ctx.moveTo(x * 0.8, -0.2);
        ctx.lineTo(x * 1.4, -4.4);
      }
    });
    ctx.restore();
  }

  K.registerFind(102, { id: 'protea', label: 'Protea', slot: 'item', place: { name: 'Kirstenbosch Garden', city: 'Cape Town', lat: -33.9866, lon: 18.4313, radius: 1000 } }, protea);
})(window.Bud);

;
// lib/accessories/item/puffin.js
/* Puffin, held: a piece found at Old Harbour, Reykjavik (find 94: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink } = K.AccKit;

  // Reykjavik's harbor: a puffin, its beak in stripes.
  function puffin(ctx, a, env) {
    hold(ctx, a, env, 2.4, 0.4);
    paint(ctx, env, C.beak, () => {
      U.ellipse(ctx, -1.6, 6.1, 1.4, 0.55);
      U.ellipse(ctx, 1.6, 6.1, 1.4, 0.55);
    });
    paint(ctx, env, P.ink, () => U.ellipse(ctx, 0, 1.2, 4.2, 5.2));
    paint(ctx, env, C.cup, () => U.ellipse(ctx, 0, 2.6, 2.8, 3.6));
    paint(ctx, env, P.ink, () => ctx.arc(0, -3.8, 3.6, 0, TAU));
    paint(ctx, env, C.cup, () => U.ellipse(ctx, -0.6, -3.4, 2.6, 2.2));
    paint(ctx, env, U.rgb('#E8542C'), () => {
      ctx.moveTo(-2.6, -4.2);
      ctx.quadraticCurveTo(-5.8, -3.6, -5, -2);
      ctx.quadraticCurveTo(-4, -1.8, -2.6, -2.6);
      ctx.closePath();
    });
    paint(ctx, env, U.rgb('#FFD84D'), () => ctx.rect(-3.3, -4.3, 0.6, 2), 0.95);
    paint(ctx, env, U.rgb('#5B6F8A'), () => ctx.rect(-2.75, -4.3, 0.4, 1.8));
    paint(ctx, env, C.lens, () => ctx.arc(-0.6, -4.2, 0.5, 0, TAU));
    ink(ctx, env, U.rgb('#E8542C'), 0.3, () => ctx.arc(-0.6, -4.2, 0.75, 0, TAU));
    ctx.restore();
  }

  K.registerFind(94, { id: 'puffin', label: 'Puffin', slot: 'item', place: { name: 'Old Harbour', city: 'Reykjavik', lat: 64.1513, lon: -21.9429, radius: 600 } }, puffin);
})(window.Bud);

;
// lib/accessories/item/pumpkin.js
/* Pumpkin, held: built-in accessory 18 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { C, sway, begin } = K.AccKit;

  function pumpkin(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2.4) * 0.8);
    ctx.scale(s, s);
    F.glow(ctx, 0, 0, 12, C.carve, 0.22, env);
    ctx.fillStyle = env.c(C.pumpkinDark);
    ctx.beginPath();
    U.ellipse(ctx, -3.4, 0.4, 4.3, 5.2);
    U.ellipse(ctx, 3.4, 0.4, 4.3, 5.2);
    ctx.fill();
    ctx.fillStyle = env.c(C.pumpkin);
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, 5, 5.8);
    ctx.fill();
    ctx.fillStyle = env.c(C.stem);
    ctx.beginPath();
    U.rr(ctx, -0.9, -8, 1.8, 3.2, 0.8);
    ctx.fill();
    ctx.fillStyle = env.c(C.carve);
    ctx.beginPath();
    ctx.moveTo(-3.6, -1.6);
    ctx.lineTo(-1.2, -1.6);
    ctx.lineTo(-2.4, -3.6);
    ctx.closePath();
    ctx.moveTo(3.6, -1.6);
    ctx.lineTo(1.2, -1.6);
    ctx.lineTo(2.4, -3.6);
    ctx.closePath();
    ctx.moveTo(-3.6, 1);
    ctx.lineTo(-1.8, 2);
    ctx.lineTo(0, 1);
    ctx.lineTo(1.8, 2);
    ctx.lineTo(3.6, 1);
    ctx.lineTo(2.6, 3.4);
    ctx.lineTo(-2.6, 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(18, { id: 'pumpkin', label: 'Pumpkin', slot: 'item', kind: 'Seasonal (Halloween)', seasonal: true }, pumpkin);
})(window.Bud);

;
// lib/accessories/item/ramyeon.js
/* Ramyeon, held: a piece found at Yeouido Hangang Park, Seoul (find 20). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // The Han River: a cup of ramyeon, chopsticks in, steam rising.
  function ramyeon(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.3);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.WHITE, 0.45);
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x0 = -1.6 + i * 2.6;
      const k = sway(env, 2.6, i * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, -5.6);
      ctx.bezierCurveTo(x0 + 1.4 * k, -7.2, x0 - 1.4 * k, -8.6, x0 + 0.5 * k, -10.2);
      ctx.stroke();
    }
    ctx.strokeStyle = env.c(C.stick);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(1.4, -3.6);
    ctx.lineTo(5.2, -10.2);
    ctx.moveTo(2.4, -3.4);
    ctx.lineTo(6.4, -9.6);
    ctx.stroke();
    ctx.fillStyle = env.c(C.cupRed);
    ctx.beginPath();
    ctx.moveTo(-4.4, -4);
    ctx.lineTo(4.4, -4);
    ctx.lineTo(3.2, 6);
    ctx.lineTo(-3.2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.noodle);
    ctx.beginPath();
    U.ellipse(ctx, 0, -4, 4.4, 1.1);
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.noodle, 0.2));
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let x = -3; x <= 3; x += 1.5) {
      ctx.moveTo(x - 0.6, -4.4);
      ctx.quadraticCurveTo(x, -3.4, x + 0.6, -4.4);
    }
    ctx.stroke();
    ctx.fillStyle = env.c(C.cup, 0.9);
    ctx.fillRect(-3.8, -0.4, 7.6, 1.6);
    ctx.restore();
  }

  K.registerFind(20, { id: 'ramyeon', label: 'Ramyeon', kr: '라면', slot: 'item', place: { name: 'Yeouido Hangang Park', city: 'Seoul', lat: 37.5284, lon: 126.9326, radius: 1200 } }, ramyeon);
})(window.Bud);

;
// lib/accessories/item/rocket.js
/* Rocket, held: a piece found at Kennedy Space Center, Cape Canaveral (find 15). */
(function (K) {
  'use strict';
  const { TAU } = K.util;
  const { C, sway, begin } = K.AccKit;

  // Kennedy Space Center: a little rocket, engine lit.
  function rocket(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2.2) * 0.5);
    ctx.rotate(0.12);
    ctx.scale(s, s);
    const f = 1 + sway(env, 9) * 0.15;
    ctx.fillStyle = env.c(C.flame);
    ctx.beginPath();
    ctx.moveTo(-1.6, 4.6);
    ctx.quadraticCurveTo(0, 4.6 + 5 * f, 1.6, 4.6);
    ctx.fill();
    ctx.fillStyle = env.c(C.light);
    ctx.beginPath();
    ctx.moveTo(-0.8, 4.6);
    ctx.quadraticCurveTo(0, 4.6 + 2.8 * f, 0.8, 4.6);
    ctx.fill();
    ctx.fillStyle = env.c(C.fin);
    ctx.beginPath();
    for (const k of [-1, 1]) {
      ctx.moveTo(k * 2, 0.4);
      ctx.lineTo(k * 4, 4.4);
      ctx.lineTo(k * 2, 3.6);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = env.c(C.rocket);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(3.2, -7, 2.4, 1, 2, 4.6);
    ctx.lineTo(-2, 4.6);
    ctx.bezierCurveTo(-2.4, 1, -3.2, -7, 0, -10);
    ctx.fill();
    ctx.fillStyle = env.c(C.fin);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(1.6, -8.6, 2.1, -7.4, 2.3, -6.4);
    ctx.lineTo(-2.3, -6.4);
    ctx.bezierCurveTo(-2.1, -7.4, -1.6, -8.6, 0, -10);
    ctx.fill();
    ctx.fillStyle = env.c(C.gemBlue);
    ctx.beginPath();
    ctx.arc(0, -3, 1.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(15, { id: 'rocket', label: 'Rocket', slot: 'item', place: { name: 'Kennedy Space Center', city: 'Cape Canaveral', lat: 28.5229, lon: -80.6823, radius: 3000 } }, rocket);
})(window.Bud);

;
// lib/accessories/item/sailboat.js
/* Sailboat, held: a piece found at Charles River Esplanade, Boston (find 25: Boston and New England). */
(function (K) {
  'use strict';
  const { C, sway, P, hold, paint, ink } = K.AccKit;

  // The Esplanade: a little sailboat on the Charles.
  function sailboat(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.6);
    ctx.rotate(sway(env, 1.8) * 0.06);
    ink(ctx, env, P.woodDark, 0.5, () => {
      ctx.moveTo(0, 2.4);
      ctx.lineTo(0, -10);
    });
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(0.4, -9.6);
      ctx.quadraticCurveTo(5.4, -4, 5, 1.2);
      ctx.lineTo(0.4, 1.2);
      ctx.closePath();
    });
    paint(ctx, env, P.sea, () => {
      ctx.moveTo(-0.4, -7.4);
      ctx.quadraticCurveTo(-3.6, -3, -3.6, 1.2);
      ctx.lineTo(-0.4, 1.2);
      ctx.closePath();
    });
    paint(ctx, env, P.red, () => {
      ctx.moveTo(0.2, -10);
      ctx.lineTo(2.2, -9.4);
      ctx.lineTo(0.2, -8.8);
      ctx.closePath();
    });
    paint(ctx, env, P.red, () => {
      ctx.moveTo(-5.6, 2);
      ctx.lineTo(6, 2);
      ctx.lineTo(4.4, 4.6);
      ctx.lineTo(-4.2, 4.6);
      ctx.closePath();
    });
    paint(ctx, env, C.cup, () => ctx.rect(-5.2, 2.6, 10.8, 0.6));
    ink(ctx, env, P.sea, 0.6, () => {
      ctx.moveTo(-6, 5.6);
      for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(-5 + i * 2, 4.8 + sway(env, 3, i) * 0.3, -4 + i * 2, 5.6);
    }, 0.8);
    ctx.restore();
  }

  K.registerFind(25, { id: 'sailboat', label: 'Sailboat', slot: 'item', place: { name: 'Charles River Esplanade', city: 'Boston', lat: 42.3573, lon: -71.0737, radius: 400 } }, sailboat);
})(window.Bud);

;
// lib/accessories/item/seaTurtle.js
/* Sea turtle, held: a piece found at New England Aquarium, Boston (find 22: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, hold, paint, ink, gleam, plushEyes } = K.AccKit;

  // The New England Aquarium: a green sea turtle, paddling.
  function seaTurtle(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.5);
    const skin = U.rgb('#9BCB7A');
    const p = sway(env, 2.4) * 0.25;
    paint(ctx, env, skin, () => {
      U.ellipse(ctx, -4.4, -2.8, 2.4, 1, -0.6 + p);
      U.ellipse(ctx, 4.4, -2.8, 2.4, 1, 0.6 - p);
      U.ellipse(ctx, -3.6, 3.6, 1.8, 0.8, 0.6 - p);
      U.ellipse(ctx, 3.6, 3.6, 1.8, 0.8, -0.6 + p);
      U.ellipse(ctx, 0, -6, 1.8, 1.9);
    });
    plushEyes(ctx, env, 0, -6.4, 0.8, 0.35);
    paint(ctx, env, U.rgb('#3F8F5A'), () => U.ellipse(ctx, 0, 0.4, 4.4, 5));
    ink(ctx, env, U.rgb('#2C6B43'), 0.35, () => {
      ctx.moveTo(-1.4, -2.6);
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * TAU - Math.PI / 2;
        ctx.lineTo(1.6 * Math.cos(t), 0.2 + 2 * Math.sin(t));
      }
      ctx.closePath();
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * TAU - Math.PI / 2;
        ctx.moveTo(1.6 * Math.cos(t), 0.2 + 2 * Math.sin(t));
        ctx.lineTo(4 * Math.cos(t), 0.4 + 4.6 * Math.sin(t));
      }
    });
    gleam(ctx, env, -1.6, -2, 1.2, 0.7, -0.5, 0.25);
    ctx.restore();
  }

  K.registerFind(22, { id: 'seaTurtle', label: 'Sea turtle', slot: 'item', place: { name: 'New England Aquarium', city: 'Boston', lat: 42.3592, lon: -71.0494, radius: 300 } }, seaTurtle);
})(window.Bud);

;
// lib/accessories/item/showTicket.js
/* Show ticket, held: a piece found at Times Square, New York (find 34: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, star5, hold, paint, ink } = K.AccKit;

  // Times Square: a golden show ticket.
  function showTicket(ctx, a, env) {
    hold(ctx, a, env, 2, 0.4);
    ctx.rotate(-0.25 + sway(env, 2) * 0.05);
    const gold = U.rgb('#F5C451');
    paint(ctx, env, gold, () => {
      ctx.moveTo(-6, -3);
      ctx.lineTo(6, -3);
      ctx.arc(6, 0, 1, -Math.PI / 2, Math.PI / 2, true);
      ctx.lineTo(6, 3);
      ctx.lineTo(-6, 3);
      ctx.arc(-6, 0, 1, Math.PI / 2, -Math.PI / 2, true);
      ctx.closePath();
    });
    ctx.setLineDash([0.5, 0.5]);
    ink(ctx, env, U.darken(gold, 0.35), 0.25, () => {
      ctx.moveTo(2.6, -2.8);
      ctx.lineTo(2.6, 2.8);
    });
    ctx.setLineDash([]);
    paint(ctx, env, U.rgb('#C0392B'), () => star5(ctx, -2, 0, 2));
    paint(ctx, env, U.darken(gold, 0.3), () => {
      ctx.rect(3.4, -1.4, 1.8, 0.5);
      ctx.rect(3.4, -0.2, 1.8, 0.5);
      ctx.rect(3.4, 1, 1.8, 0.5);
    });
    ctx.restore();
  }

  K.registerFind(34, { id: 'showTicket', label: 'Show ticket', slot: 'item', place: { name: 'Times Square', city: 'New York', lat: 40.7575, lon: -73.9858, radius: 400 } }, showTicket);
})(window.Bud);

;
// lib/accessories/item/slideRule.js
/* Slide rule, held: a piece found at MIT Killian Court, Cambridge (find 23: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, ink } = K.AccKit;

  // MIT: a slide rule, its middle strip pulled out a little.
  function slideRule(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.55);
    paint(ctx, env, U.rgb('#F3EDD9'), () => U.rr(ctx, -7, -2, 14, 4, 0.6));
    paint(ctx, env, U.rgb('#E3D9BC'), () => ctx.rect(-5.6, -0.7, 14, 1.4));
    ink(ctx, env, P.ink, 0.18, () => {
      for (let i = 0; i <= 26; i++) {
        const x = -6.6 + i * 0.5;
        ctx.moveTo(x, -2);
        ctx.lineTo(x, i % 5 ? -1.4 : -1);
        ctx.moveTo(x + 1.4, 0.7);
        ctx.lineTo(x + 1.4, i % 5 ? 0.3 : 0);
      }
    }, 0.7);
    paint(ctx, env, P.glass, () => U.rr(ctx, 0.4, -2.4, 1.6, 4.8, 0.3), 0.55);
    ink(ctx, env, P.red, 0.25, () => {
      ctx.moveTo(1.2, -2.4);
      ctx.lineTo(1.2, 2.4);
    });
    ctx.restore();
  }

  K.registerFind(23, { id: 'slideRule', label: 'Slide rule', slot: 'item', place: { name: 'MIT Killian Court', city: 'Cambridge', lat: 42.3588, lon: -71.0915, radius: 600 } }, slideRule);
})(window.Bud);

;
// lib/accessories/item/spyglass.js
/* Spyglass, held: a piece found at Castillo de San Marcos, St. Augustine (find 53: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, gleam } = K.AccKit;

  // Castillo de San Marcos: a brass spyglass, pulled out.
  function spyglass(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.7);
    paint(ctx, env, P.brass, () => U.rr(ctx, -6.6, -1, 4.6, 2, 0.5));
    paint(ctx, env, U.darken(P.brass, 0.12), () => U.rr(ctx, -2.4, -1.3, 4.4, 2.6, 0.5));
    paint(ctx, env, U.rgb('#6B4423'), () => U.rr(ctx, 1.6, -1.6, 4.8, 3.2, 0.6));
    paint(ctx, env, P.brass, () => {
      U.rr(ctx, 1.4, -1.7, 0.8, 3.4, 0.3);
      U.rr(ctx, 6, -1.8, 0.9, 3.6, 0.3);
    });
    paint(ctx, env, P.glass, () => U.ellipse(ctx, 6.9, 0, 0.3, 1.3), 0.8);
    gleam(ctx, env, -4.2, -0.5, 1.6, 0.25, 0, 0.4);
    ctx.restore();
  }

  K.registerFind(53, { id: 'spyglass', label: 'Spyglass', slot: 'item', place: { name: 'Castillo de San Marcos', city: 'St. Augustine', lat: 29.8979, lon: -81.3116, radius: 500 } }, spyglass);
})(window.Bud);

;
// lib/accessories/item/surfboard.js
/* Surfboard, held: a piece found at Bondi Beach, Sydney (find 10). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Bondi Beach: a surfboard.
  function surfboard(ctx, a, env) {
    const s = (a.w || 1) * 0.82;
    begin(ctx, a);
    ctx.translate(0.6, -2.2 + sway(env, 2) * 0.4);
    ctx.rotate(0.24);
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, -9.6);
    ctx.bezierCurveTo(4, -6.4, 4, 4, 1.4, 7.2);
    ctx.lineTo(-1.4, 7.2);
    ctx.bezierCurveTo(-4, 4, -4, -6.4, 0, -9.6);
    ctx.closePath();
    ctx.fillStyle = env.c(C.boardStripe);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = env.c(C.board);
    ctx.fillRect(-0.7, -10, 1.4, 18);
    ctx.fillStyle = env.c(C.flame);
    ctx.fillRect(-4, 3, 8, 1.1);
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(C.boardStripe, 0.2));
    ctx.beginPath();
    ctx.moveTo(-0.2, 5.4);
    ctx.lineTo(1.4, 7.6);
    ctx.lineTo(-0.2, 7.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(10, { id: 'surfboard', label: 'Surfboard', slot: 'item', place: { name: 'Bondi Beach', city: 'Sydney', lat: -33.8915, lon: 151.2767, radius: 1200 } }, surfboard);
})(window.Bud);

;
// lib/accessories/item/swan.js
/* Swan, held: a piece found at Lake Eola Park, Orlando (find 54: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint, ink } = K.AccKit;

  // Lake Eola: a white swan with an orange beak.
  function swan(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.5);
    paint(ctx, env, P.sea, () => U.ellipse(ctx, 0, 5, 6, 1.1), 0.5);
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(-5.6, 0);
      ctx.bezierCurveTo(-5.6, 5.4, 4.4, 5.4, 5, 1.4);
      ctx.bezierCurveTo(3, 2.4, 1, 0.6, 1.2, -1.6);
      ctx.bezierCurveTo(-1, -1, -3, 1.4, -5.6, 0);
    });
    ink(ctx, env, C.cup, 1.5, () => {
      ctx.moveTo(-3.4, 1.4);
      ctx.bezierCurveTo(-5.6, -1.6, -1, -4.8, -3.6, -7.6);
    });
    paint(ctx, env, C.cup, () => U.ellipse(ctx, -3.4, -7.8, 1.3, 1.1));
    paint(ctx, env, C.beak, () => {
      ctx.moveTo(-4.4, -8.2);
      ctx.lineTo(-6.6, -7.4);
      ctx.lineTo(-4.4, -7.2);
      ctx.closePath();
    });
    paint(ctx, env, C.lens, () => ctx.arc(-3.6, -8.1, 0.32, 0, TAU));
    ink(ctx, env, U.rgb('#D9DDE6'), 0.35, () => {
      ctx.moveTo(-1.6, 1.2);
      ctx.quadraticCurveTo(1, 3.4, 3.6, 1.8);
    });
    ctx.restore();
  }

  K.registerFind(54, { id: 'swan', label: 'Swan', slot: 'item', place: { name: 'Lake Eola Park', city: 'Orlando', lat: 28.5438, lon: -81.3716, radius: 500 } }, swan);
})(window.Bud);

;
// lib/accessories/item/swimRing.js
/* Swim ring, held: a piece found at Haeundae Beach, Busan (find 65: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, hold, paint, gleam } = K.AccKit;

  // Haeundae: a striped swim ring.
  function swimRing(ctx, a, env) {
    hold(ctx, a, env, 2, 0.5);
    ctx.rotate(sway(env, 1.6) * 0.1);
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 5.6, 0, TAU);
    ctx.arc(0, 0, 2.6, 0, TAU, true);
    ctx.clip();
    for (let i = 0; i < 8; i++) {
      paint(ctx, env, i % 2 ? C.cup : U.rgb('#FF5C8A'), () => {
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 6, (i / 8) * TAU, ((i + 1) / 8) * TAU);
        ctx.closePath();
      });
    }
    ctx.restore();
    gleam(ctx, env, -2.6, -2.8, 1.6, 0.6, -0.7, 0.45);
    ctx.restore();
  }

  K.registerFind(65, { id: 'swimRing', label: 'Swim ring', kr: '튜브', slot: 'item', place: { name: 'Haeundae Beach', city: 'Busan', lat: 35.1586, lon: 129.1605, radius: 1000 } }, swimRing);
})(window.Bud);

;
// lib/accessories/item/taco.js
/* Taco, held: a piece found at South Congress, Austin (find 51: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint } = K.AccKit;

  // South Congress: a taco, lettuce and tomato peeking out.
  function taco(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    paint(ctx, env, P.leaf, () => {
      for (let i = 0; i < 7; i++) U.ellipse(ctx, -4.4 + i * 1.5, -2.6 + Math.abs(i - 3) * 0.45, 1.1, 0.9);
    });
    paint(ctx, env, P.sauce, () => {
      for (const x of [-2.6, 0.2, 2.8]) ctx.arc(x, -2.4, 0.8, 0, TAU);
    });
    paint(ctx, env, P.cheese, () => {
      for (const x of [-1.2, 1.4]) U.rr(ctx, x - 0.9, -3.2, 1.8, 0.5, 0.2);
    });
    paint(ctx, env, U.rgb('#F2C14E'), () => {
      ctx.moveTo(-6, -1.6);
      ctx.bezierCurveTo(-6, 6, 6, 6, 6, -1.6);
      ctx.quadraticCurveTo(0, 1.4, -6, -1.6);
    });
    ctx.fillStyle = env.c(U.rgb('#D9973F'), 0.7);
    for (const [x, y] of [[-3.6, 1.6], [-1, 3.4], [2, 3.2], [3.8, 1.2], [0.4, 1.8]]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(51, { id: 'taco', label: 'Taco', slot: 'item', place: { name: 'South Congress', city: 'Austin', lat: 30.2487, lon: -97.75, radius: 900 } }, taco);
})(window.Bud);

;
// lib/accessories/item/takoyaki.js
/* Takoyaki, held: a piece found at Dotonbori, Osaka (find 72: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, hold, paint, ink } = K.AccKit;

  // Dotonbori: takoyaki in a little boat, sauce, mayo and bonito flakes.
  function takoyaki(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ink(ctx, env, C.stick, 0.4, () => {
      ctx.moveTo(2.8, -1.6);
      ctx.lineTo(5.2, -7.6);
    });
    for (const [x, y] of [[-3.2, -0.8], [0, -1.2], [3.2, -0.8], [-1.6, -2.8], [1.6, -2.8]]) {
      paint(ctx, env, U.rgb('#C98242'), () => ctx.arc(x, y, 1.9, 0, TAU));
      paint(ctx, env, U.rgb('#5A2E14'), () => U.ellipse(ctx, x, y - 0.6, 1.5, 0.8), 0.9);
    }
    ink(ctx, env, U.rgb('#FFF8E0'), 0.35, () => {
      ctx.moveTo(-4.6, -1.6);
      for (let i = 0; i < 6; i++) ctx.lineTo(-3.4 + i * 1.6, i % 2 ? -3.4 : -1.2);
    });
    paint(ctx, env, U.rgb('#F2A5A0'), () => {
      for (const [x, y, r] of [[-1.6, -4, 0.4], [1, -3.6, -0.6], [2.4, -2.4, 0.3]]) U.ellipse(ctx, x, y, 0.8, 0.3, r);
    }, 0.9);
    paint(ctx, env, U.rgb('#D9B47A'), () => {
      ctx.moveTo(-5.8, 0);
      ctx.lineTo(5.8, 0);
      ctx.lineTo(4.4, 4.2);
      ctx.lineTo(-4.4, 4.2);
      ctx.closePath();
    });
    ink(ctx, env, U.rgb('#B48E55'), 0.3, () => {
      ctx.moveTo(-5, 1.6);
      ctx.lineTo(5, 1.6);
    });
    ctx.restore();
  }

  K.registerFind(72, { id: 'takoyaki', label: 'Takoyaki', slot: 'item', place: { name: 'Dotonbori', city: 'Osaka', lat: 34.6688, lon: 135.5014, radius: 500 } }, takoyaki);
})(window.Bud);

;
// lib/accessories/item/teacup.js
/* Teacup, held: a piece found at Boston Tea Party Ships, Boston (find 13). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Boston Tea Party Ships: a cup of tea on its saucer.
  function teacup(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.3);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.WHITE, 0.45);
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const x0 = -1.2 + i * 2.4;
      const k = sway(env, 2.6, i * 2.2);
      ctx.beginPath();
      ctx.moveTo(x0, -4.8);
      ctx.bezierCurveTo(x0 + 1.4 * k, -6.4, x0 - 1.4 * k, -7.6, x0 + 0.5 * k, -9.2);
      ctx.stroke();
    }
    ctx.fillStyle = env.c(C.cup);
    ctx.beginPath();
    U.ellipse(ctx, 0, 4.3, 6, 1.3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4.4, -3.6);
    ctx.lineTo(4.4, -3.6);
    ctx.bezierCurveTo(4.4, 1.6, 2.6, 3.6, 0, 3.6);
    ctx.bezierCurveTo(-2.6, 3.6, -4.4, 1.6, -4.4, -3.6);
    ctx.fill();
    ctx.strokeStyle = env.c(C.cup);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(4.6, -1.2, 1.5, -1.3, 1.6);
    ctx.stroke();
    ctx.fillStyle = env.c(C.tea);
    ctx.beginPath();
    U.ellipse(ctx, 0, -3.5, 4.1, 0.8);
    ctx.fill();
    ctx.fillStyle = env.c(C.gold);
    ctx.fillRect(-4.2, -1.6, 8.4, 0.5);
    ctx.restore();
  }

  K.registerFind(13, { id: 'teacup', label: 'Teacup', slot: 'item', place: { name: 'Boston Tea Party Ships', city: 'Boston', lat: 42.3522, lon: -71.0513, radius: 450 } }, teacup);
})(window.Bud);

;
// lib/accessories/item/telescope.js
/* Telescope, held: a piece found at Griffith Observatory, Los Angeles (find 43: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, star5, P, hold, paint, ink, gleam } = K.AccKit;

  // Griffith Observatory: a brass telescope on a tripod.
  function telescope(ctx, a, env) {
    hold(ctx, a, env, 2, 0.25);
    ink(ctx, env, P.woodDark, 0.6, () => {
      ctx.moveTo(0, -1);
      ctx.lineTo(-3.4, 6);
      ctx.moveTo(0, -1);
      ctx.lineTo(3.4, 6);
      ctx.moveTo(0, -1);
      ctx.lineTo(0, 6);
    });
    ctx.save();
    ctx.translate(0, -1.6);
    ctx.rotate(-0.6);
    paint(ctx, env, P.brass, () => U.rr(ctx, -4.6, -1.2, 9.2, 2.4, 0.6));
    paint(ctx, env, U.darken(P.brass, 0.2), () => {
      ctx.rect(-1.4, -1.25, 0.5, 2.5);
      ctx.rect(1.8, -1.25, 0.5, 2.5);
    });
    paint(ctx, env, U.lighten(P.brass, 0.2), () => U.rr(ctx, 4.2, -1.6, 1.4, 3.2, 0.5));
    paint(ctx, env, P.glass, () => U.ellipse(ctx, 5.6, 0, 0.35, 1.3), 0.8);
    gleam(ctx, env, 0, -0.6, 3.4, 0.3, 0, 0.35);
    ctx.restore();
    paint(ctx, env, C.light, () => star5(ctx, 4.6, -8.6, 1), 0.7 + sway(env, 3) * 0.3);
    ctx.restore();
  }

  K.registerFind(43, { id: 'telescope', label: 'Telescope', slot: 'item', place: { name: 'Griffith Observatory', city: 'Los Angeles', lat: 34.1183, lon: -118.3003, radius: 600 } }, telescope);
})(window.Bud);

;
// lib/accessories/item/torch.js
/* Torch, held: a piece found at Statue of Liberty, New York (find 3). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Statue of Liberty: her torch, flame flickering.
  function torch(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.3);
    ctx.scale(s, s);
    const f = 1 + sway(env, 7, 0.4) * 0.07;
    const glow = ctx.createRadialGradient(0, -8, 0.4, 0, -8, 5 * f);
    glow.addColorStop(0, env.c(C.light, 0.9));
    glow.addColorStop(1, env.c(C.gold, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -8, 5 * f, 0, TAU);
    ctx.fill();
    for (const [k, col] of [[1, C.flame], [0.6, C.light]]) {
      ctx.fillStyle = env.c(col);
      ctx.beginPath();
      ctx.moveTo(sway(env, 5) * 0.4 * k, -5.4 - 6.6 * k * f);
      ctx.bezierCurveTo(2.6 * k, -8.6, 2.4 * k, -6, 0, -5.4);
      ctx.bezierCurveTo(-2.4 * k, -6, -2.6 * k, -8.6, sway(env, 5) * 0.4 * k, -5.4 - 6.6 * k * f);
      ctx.fill();
    }
    ctx.fillStyle = env.c(C.copper);
    ctx.beginPath();
    ctx.moveTo(-3.1, -5.6);
    ctx.lineTo(3.1, -5.6);
    ctx.lineTo(1.7, -2.6);
    ctx.lineTo(-1.7, -2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.copper, 0.18));
    ctx.beginPath();
    U.rr(ctx, -3.3, -6.1, 6.6, 0.9, 0.4);
    U.rr(ctx, -0.9, -2.8, 1.8, 8.8, 0.6);
    ctx.fill();
    ctx.fillStyle = env.c(U.lighten(C.copper, 0.25));
    ctx.beginPath();
    U.rr(ctx, -1.2, 0.2, 2.4, 0.7, 0.3);
    U.rr(ctx, -1.2, 3.2, 2.4, 0.7, 0.3);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(3, { id: 'torch', label: 'Torch', slot: 'item', place: { name: 'Statue of Liberty', city: 'New York', lat: 40.6892, lon: -74.0445, radius: 3000 } }, torch);
})(window.Bud);

;
// lib/accessories/item/tteokbokki.js
/* Tteokbokki, held: a piece found at Dongdaemun Design Plaza, Seoul (find 59: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, P, WHITE, hold, paint, ink, steam } = K.AccKit;

  // Dongdaemun: tteokbokki in a paper cup, a pick in one rice cake.
  function tteokbokki(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -5.6);
    ink(ctx, env, C.stick, 0.45, () => {
      ctx.moveTo(1.2, -2.6);
      ctx.lineTo(3.6, -8.4);
    });
    paint(ctx, env, P.sauce, () => {
      for (const [x, y] of [[-2.2, -2.8], [0.2, -3.4], [2.2, -2.6]]) U.rr(ctx, x - 1.6, y - 0.7, 3.2, 1.4, 0.7);
    });
    paint(ctx, env, U.rgb('#F2E3D0'), () => {
      ctx.moveTo(-4.4, -2.4);
      ctx.lineTo(4.4, -2.4);
      ctx.lineTo(3.4, 5.8);
      ctx.lineTo(-3.4, 5.8);
      ctx.closePath();
    });
    paint(ctx, env, P.sauce, () => U.ellipse(ctx, 0, -2.4, 4.4, 0.9));
    paint(ctx, env, U.rgb('#E2433B'), () => {
      for (const x of [-2.6, 0, 2.6]) U.rr(ctx, x - 1.1, 0.4, 2.2, 2, 0.8);
    }, 0.85);
    paint(ctx, env, WHITE, () => U.ellipse(ctx, -1.2, -2.6, 0.5, 0.25), 0.7);
    ctx.restore();
  }

  K.registerFind(59, { id: 'tteokbokki', label: 'Tteokbokki', kr: '떡볶이', slot: 'item', place: { name: 'Dongdaemun Design Plaza', city: 'Seoul', lat: 37.567, lon: 127.0097, radius: 450 } }, tteokbokki);
})(window.Bud);

;
// lib/accessories/item/tulip.js
/* Tulip, held: a piece found at Keukenhof, Lisse (find 86: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Keukenhof: a red tulip.
  function tulip(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.rotate(sway(env, 1.4) * 0.05);
    ink(ctx, env, P.leafDark, 0.6, () => {
      ctx.moveTo(0, 6.4);
      ctx.lineTo(0, -3);
    });
    paint(ctx, env, P.leaf, () => {
      ctx.moveTo(0, 5.6);
      ctx.quadraticCurveTo(-4.4, 2, -3.2, -2.4);
      ctx.quadraticCurveTo(-1.4, 1.4, 0, 3.4);
      ctx.moveTo(0, 4.6);
      ctx.quadraticCurveTo(3.6, 2.6, 3.4, -1.2);
      ctx.quadraticCurveTo(1.6, 1.2, 0, 2.6);
    });
    const red = U.rgb('#E8402E');
    paint(ctx, env, red, () => {
      ctx.moveTo(-3, -6.6);
      ctx.lineTo(-1.5, -4.8);
      ctx.lineTo(0, -7.4);
      ctx.lineTo(1.5, -4.8);
      ctx.lineTo(3, -6.6);
      ctx.bezierCurveTo(3.4, -2.6, 2.4, -1.8, 0, -1.8);
      ctx.bezierCurveTo(-2.4, -1.8, -3.4, -2.6, -3, -6.6);
    });
    paint(ctx, env, U.lighten(red, 0.25), () => U.ellipse(ctx, -1, -4.4, 0.6, 1.6, 0.2), 0.7);
    ctx.restore();
  }

  K.registerFind(86, { id: 'tulip', label: 'Tulip', slot: 'item', place: { name: 'Keukenhof', city: 'Lisse', lat: 52.2706, lon: 4.5468, radius: 800 } }, tulip);
})(window.Bud);

;
// lib/accessories/item/waffle.js
/* Waffle, held: a piece found at Grand-Place, Brussels (find 85: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, hold, paint } = K.AccKit;

  // Grand-Place: a Brussels waffle with a strawberry and cream.
  function waffle(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    const dough = U.rgb('#E7B062');
    paint(ctx, env, U.darken(dough, 0.15), () => U.rr(ctx, -5.4, -3.2, 10.8, 8, 1.4));
    paint(ctx, env, dough, () => U.rr(ctx, -5.4, -3.8, 10.8, 8, 1.4));
    ctx.fillStyle = env.c(U.darken(dough, 0.22));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(-4.6 + c * 2.5, -3 + r * 2.4, 1.7, 1.6);
    paint(ctx, env, WHITE, () => {
      ctx.arc(1.4, -4.2, 1.6, 0, TAU);
      ctx.arc(3, -4.4, 1.2, 0, TAU);
    });
    paint(ctx, env, U.rgb('#E2374F'), () => {
      ctx.moveTo(-1.2, -6.4);
      ctx.quadraticCurveTo(-3.6, -5.6, -2, -2.6);
      ctx.quadraticCurveTo(0.6, -4.6, -1.2, -6.4);
    });
    paint(ctx, env, P.leaf, () => U.ellipse(ctx, -1.4, -6.4, 0.9, 0.35, -0.3));
    ctx.restore();
  }

  K.registerFind(85, { id: 'waffle', label: 'Waffle', slot: 'item', place: { name: 'Grand-Place', city: 'Brussels', lat: 50.8467, lon: 4.3525, radius: 400 } }, waffle);
})(window.Bud);

;
// lib/accessories/neck/bestBuds.js
/* Best buds, worn at the neck: a piece earned by inviting a friend (reward 1). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Best buds: a thin gold chain with a heart pendant split down the middle by a zigzag, one half
  // pink and one teal. Earned together: a friend you invite, and you.
  function bestBuds(ctx, a, env) {
    const k = Math.min(a.w * 0.16, 8);
    const hw = a.w * 0.42;
    begin(ctx, a);
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = Math.max(0.6, k * 0.12);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-hw, -k * 0.5);
    ctx.quadraticCurveTo(0, k * 0.9, hw, -k * 0.5);
    ctx.stroke();
    ctx.translate(0, k * 0.4);
    ctx.rotate(0.08 * sway(env, 2.2));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, k * 0.45);
    ctx.stroke();
    // the heart: two lobes and a point, in two halves along a zigzag
    const h = k * 1.25;
    const heart = () => {
      ctx.beginPath();
      ctx.moveTo(0, k * 0.55 + h * 0.3);
      ctx.bezierCurveTo(-h * 0.1, k * 0.55 - h * 0.05, -h * 0.75, k * 0.55 + h * 0.05, -h * 0.55, k * 0.55 + h * 0.55);
      ctx.bezierCurveTo(-h * 0.4, k * 0.55 + h * 0.85, -h * 0.1, k * 0.55 + h * 1.05, 0, k * 0.55 + h * 1.25);
      ctx.bezierCurveTo(h * 0.1, k * 0.55 + h * 1.05, h * 0.4, k * 0.55 + h * 0.85, h * 0.55, k * 0.55 + h * 0.55);
      ctx.bezierCurveTo(h * 0.75, k * 0.55 + h * 0.05, h * 0.1, k * 0.55 - h * 0.05, 0, k * 0.55 + h * 0.3);
      ctx.closePath();
    };
    const zig = [[0, k * 0.55 + h * 0.3], [h * 0.12, k * 0.55 + h * 0.55], [-h * 0.1, k * 0.55 + h * 0.78], [h * 0.08, k * 0.55 + h * 1.0], [0, k * 0.55 + h * 1.25]];
    [[-1, C.petalDeep], [1, C.jade]].forEach(([side, color]) => {
      ctx.save();
      heart();
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(side * h, k * 0.55 - h * 0.2);
      zig.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(side * h, k * 0.55 + h * 1.4);
      ctx.closePath();
      ctx.fillStyle = env.c(color);
      ctx.fill();
      ctx.restore();
    });
    ctx.strokeStyle = env.c(U.darken(C.gold, 0.1));
    ctx.lineWidth = Math.max(0.5, k * 0.09);
    ctx.beginPath();
    ctx.moveTo(zig[0][0], zig[0][1]);
    zig.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.stroke();
    ctx.fillStyle = env.c(U.WHITE, 0.5);
    ctx.beginPath();
    U.ellipse(ctx, -h * 0.32, k * 0.55 + h * 0.42, h * 0.1, h * 0.06, -0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerReward(1, { id: 'bestBuds', label: 'Best buds', slot: 'neck', how: 'invite' }, bestBuds);
})(window.Bud);

;
// lib/accessories/neck/bowtie.js
/* Bow tie, worn at the neck: built-in accessory 14 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin } = K.AccKit;

  function bowtie(ctx, a, env) {
    const col = env.accColors;
    const k = Math.min(a.w * 0.16, 8);
    begin(ctx, a);
    ctx.rotate(0.07 * sway(env, 2.4));
    ctx.fillStyle = env.c(col.hat);
    ctx.beginPath();
    for (let s = -1; s <= 1; s += 2) {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * k * 0.9, -k * 0.95, s * k * 1.45, -k * 0.62);
      ctx.quadraticCurveTo(s * k * 1.65, 0, s * k * 1.45, k * 0.62);
      ctx.quadraticCurveTo(s * k * 0.9, k * 0.95, 0, 0);
    }
    ctx.fill();
    ctx.fillStyle = env.c(col.hat2, 0.9);
    ctx.beginPath();
    [[-0.98, -0.22], [-0.68, 0.32], [0.98, -0.22], [0.68, 0.32]].forEach(([x, y]) => {
      ctx.moveTo(x * k + k * 0.13, y * k);
      ctx.arc(x * k, y * k, k * 0.13, 0, TAU);
    });
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(col.hat, 0.22));
    ctx.beginPath();
    U.rr(ctx, -k * 0.32, -k * 0.4, k * 0.64, k * 0.8, k * 0.22);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(14, { id: 'bowtie', label: 'Bow tie', slot: 'neck', kind: 'Bow tie' }, bowtie);
})(window.Bud);

;
// lib/accessories/neck/crimsonScarf.js
/* Crimson scarf, worn at the neck: a piece found at Harvard Yard, Cambridge (find 14). */
(function (K) {
  'use strict';
  const { C, scarf } = K.AccKit;

  // Harvard Yard: a crimson and white scarf (the scarf, in the school's colors).
  function crimsonScarf(ctx, a, env) {
    const e = Object.create(env);
    e.accColors = Object.assign({}, env.accColors, { scarf: C.crimson, scarf2: C.cup });
    scarf(ctx, a, e);
  }

  K.registerFind(14, { id: 'crimsonScarf', label: 'Crimson scarf', slot: 'neck', place: { name: 'Harvard Yard', city: 'Cambridge', lat: 42.3744, lon: -71.1169, radius: 600 } }, crimsonScarf);
})(window.Bud);

;
// lib/accessories/neck/lei.js
/* Lei, worn at the neck: a piece found at Waikiki Beach, Honolulu (find 9). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Waikiki: a flower lei.
  function lei(ctx, a, env) {
    const k = Math.min(a.w * 0.16, 8);
    const spread = Math.min(a.w * 0.42, k * 3.2);
    begin(ctx, a);
    ctx.rotate(0.04 * sway(env, 2));
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = Math.PI * (0.06 + (0.88 * i) / (n - 1));
      const x = -Math.cos(t) * spread;
      const y = Math.sin(t) * k * 0.55 - k * 0.1;
      const col = C.leiPetals[i % C.leiPetals.length];
      ctx.fillStyle = env.c(col);
      ctx.beginPath();
      for (let p = 0; p < 5; p++) {
        const pt = (p * TAU) / 5 + i;
        U.ellipse(ctx, x + Math.cos(pt) * k * 0.2, y + Math.sin(pt) * k * 0.2, k * 0.17, k * 0.17);
      }
      ctx.fill();
      ctx.fillStyle = env.c(C.gold);
      ctx.beginPath();
      ctx.arc(x, y, k * 0.09, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(9, { id: 'lei', label: 'Lei', slot: 'neck', place: { name: 'Waikiki Beach', city: 'Honolulu', lat: 21.2793, lon: -157.8292, radius: 1500 } }, lei);
})(window.Bud);

;
// lib/accessories/neck/norigae.js
/* Norigae, worn at the neck: a piece found at Gyeongbokgung Palace, Seoul (find 4). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Gyeongbokgung: a norigae, a knotted charm with jade and a tassel.
  function norigae(ctx, a, env) {
    const k = Math.min(a.w * 0.16, 8);
    begin(ctx, a);
    ctx.translate(k * 0.75, -k * 0.1);
    ctx.rotate(0.07 * sway(env, 2.2));
    ctx.strokeStyle = env.c(C.lanternRed);
    ctx.lineWidth = k * 0.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, k * 0.5);
    ctx.stroke();
    ctx.fillStyle = env.c(C.lanternRed);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const t = (i * TAU) / 4 + TAU / 8;
      U.ellipse(ctx, Math.cos(t) * k * 0.24, k * 0.78 + Math.sin(t) * k * 0.24, k * 0.2, k * 0.12, t);
    }
    ctx.fill();
    ctx.fillStyle = env.c(C.jade);
    ctx.beginPath();
    U.ellipse(ctx, 0, k * 1.3, k * 0.28, k * 0.34);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.45);
    ctx.beginPath();
    U.ellipse(ctx, -k * 0.08, k * 1.2, k * 0.07, k * 0.11, -0.3);
    ctx.fill();
    ctx.strokeStyle = env.c(C.saekdong[3]);
    ctx.lineWidth = k * 0.07;
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      const x = i * k * 0.07;
      ctx.moveTo(x, k * 1.62);
      ctx.quadraticCurveTo(x + sway(env, 2.6, i) * k * 0.08, k * 2.1, x * 1.6 + sway(env, 2.6, i) * k * 0.12, k * 2.65);
    }
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(4, { id: 'norigae', label: 'Norigae', kr: '노리개', slot: 'neck', place: { name: 'Gyeongbokgung Palace', city: 'Seoul', lat: 37.5796, lon: 126.977, radius: 700 } }, norigae);
})(window.Bud);

;
// lib/accessories/neck/saekdong.js
/* Saekdong, worn at the neck: built-in accessory 15 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  function saekdong(ctx, a, env) {
    const w = a.w;
    const hw = w / 2;
    const bh = Math.max(4, w * 0.2);
    begin(ctx, a);
    ctx.beginPath();
    ctx.moveTo(-hw, -bh / 2);
    ctx.quadraticCurveTo(0, bh * 0.35, hw, -bh / 2);
    ctx.lineTo(hw, bh / 2);
    ctx.quadraticCurveTo(0, bh * 1.35, -hw, bh / 2);
    ctx.closePath();
    ctx.save();
    ctx.clip();
    const n = 10;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = env.c(C.saekdong[i % C.saekdong.length]);
      ctx.fillRect(-hw + (w * i) / n, -bh, w / n + 0.3, bh * 3);
    }
    ctx.restore();
    const sw = sway(env, 2) * 0.1;
    ctx.fillStyle = env.c(C.saekdong[0]);
    ctx.save();
    ctx.translate(-hw * 0.3, bh * 0.6);
    ctx.rotate(-0.2 + sw);
    ctx.beginPath();
    U.ellipse(ctx, -bh * 0.5, 0, bh * 0.55, bh * 0.32, -0.3);
    U.ellipse(ctx, bh * 0.5, 0, bh * 0.55, bh * 0.32, 0.3);
    ctx.fill();
    ctx.fillRect(-bh * 0.2, 0, bh * 0.4, bh * 1.8);
    ctx.restore();
    ctx.restore();
  }

  K.registerBuiltin(15, { id: 'saekdong', label: 'Saekdong', kr: '색동', slot: 'neck', kind: 'Rainbow collar (Seollal)' }, saekdong);
})(window.Bud);

;
// lib/accessories/neck/scarf.js
/* Scarf, worn at the neck: built-in accessory 13 (its outfit code). The kit draws it
 * (K.AccKit.scarf), since the school and tartan scarves wear it too. */
(function (K) {
  'use strict';
  const { scarf } = K.AccKit;

  K.registerBuiltin(13, { id: 'scarf', label: 'Scarf', slot: 'neck', kind: 'Scarf' }, scarf);
})(window.Bud);

;
// lib/accessories/neck/schoolScarves.js
/* School scarves, worn at the neck: the knit scarf in a school's colors, found at Princeton, Yale and Columbia. */
(function (K) {
  'use strict';
  const { C, scarf, P } = K.AccKit;

  // School scarves, in the school's colors (a plain knit scarf, no crest).
  function schoolScarf(main, stripe) {
    return (ctx, a, env) => {
      const e = Object.create(env);
      e.accColors = Object.assign({}, env.accColors, { scarf: main, scarf2: stripe });
      scarf(ctx, a, e);
    };
  }
  const princetonScarf = schoolScarf(P.orange, P.ink);
  const yaleScarf = schoolScarf(P.yale, C.cup);
  const columbiaScarf = schoolScarf(P.columbia, C.cup);

  K.registerFind(31, { id: 'princetonScarf', label: 'Princeton scarf', slot: 'neck', place: { name: 'Nassau Hall', city: 'Princeton', lat: 40.3487, lon: -74.6594, radius: 700 } }, princetonScarf);
  K.registerFind(30, { id: 'yaleScarf', label: 'Yale scarf', slot: 'neck', place: { name: 'Yale Old Campus', city: 'New Haven', lat: 41.3086, lon: -72.9286, radius: 600 } }, yaleScarf);
  K.registerFind(38, { id: 'columbiaScarf', label: 'Columbia scarf', slot: 'neck', place: { name: 'Low Memorial Library', city: 'New York', lat: 40.8083, lon: -73.9619, radius: 500 } }, columbiaScarf);
})(window.Bud);

;
// lib/accessories/neck/tartanScarf.js
/* Tartan scarf, worn at the neck: a piece found at Edinburgh Castle, Edinburgh (find 83: Europe). */
(function (K) {
  'use strict';
  const { begin, scarf, P, ink } = K.AccKit;

  // Edinburgh Castle: a tartan scarf, green and red with gold and navy lines.
  function tartanScarf(ctx, a, env) {
    const e = Object.create(env);
    e.accColors = Object.assign({}, env.accColors, { scarf: P.tartanGreen, scarf2: P.tartanRed });
    scarf(ctx, a, e);
    const hw = a.w / 2;
    const bh = Math.max(4, a.w * 0.2);
    begin(ctx, a);
    ctx.beginPath();
    ctx.moveTo(-hw, -bh / 2);
    ctx.quadraticCurveTo(0, bh * 0.35, hw, -bh / 2);
    ctx.lineTo(hw, bh / 2);
    ctx.quadraticCurveTo(0, bh * 1.35, -hw, bh / 2);
    ctx.closePath();
    ctx.clip();
    ink(ctx, env, P.tartanGold, Math.max(0.35, bh * 0.06), () => {
      for (let i = -7; i <= 7; i += 2) {
        ctx.moveTo(i * hw * 0.15, -bh);
        ctx.lineTo(i * hw * 0.15, bh * 1.6);
      }
    }, 0.85);
    ink(ctx, env, P.navy, Math.max(0.5, bh * 0.14), () => {
      for (const y of [-0.12, 0.3]) {
        ctx.moveTo(-hw, y * bh);
        ctx.quadraticCurveTo(0, y * bh + bh * 0.85, hw, y * bh);
      }
    }, 0.5);
    ctx.restore();
  }

  K.registerFind(83, { id: 'tartanScarf', label: 'Tartan scarf', slot: 'neck', place: { name: 'Edinburgh Castle', city: 'Edinburgh', lat: 55.9486, lon: -3.2006, radius: 500 } }, tartanScarf);
})(window.Bud);

;
// lib/looks.js
/* The looks: Classic (no outfit) and these presets, each a color theme, an outfit and an
 * ambience. Their order is the looks' codes (Classic is 0, then 1 to 13). */
(function (K) {
  'use strict';

  /** Skin packs for direction 5: a full look (theme + outfit + item + ambience) sold as one bundle. */
  K.PACKS = [
    { id: 'lantern', label: 'Night walk', kr: '청사초롱', note: 'Gat hat and a silk lantern, fireflies.', theme: 'night', acc: { head: 'gat', item: 'lantern' }, ambient: 'fireflies' },
    { id: 'party', label: 'Party', kr: '파티', note: 'Party hat, a balloon and confetti.', theme: 'classic', acc: { head: 'partyHat', item: 'balloon' }, ambient: 'confetti' },
    { id: 'shades', label: 'Cool', kr: '선글라스', note: 'Sunglasses and a bow tie.', theme: 'night', acc: { face: 'sunglasses', neck: 'bowtie' }, ambient: 'sparkles' },
    { id: 'study', label: 'Study buddy', kr: '공부', note: 'Round glasses and a coffee, for focus time.', theme: 'mint', acc: { face: 'roundGlasses', item: 'coffee' }, ambient: null },
    { id: 'kitty', label: 'Kitty', kr: '야옹', note: 'Cat ears and a bow tie.', theme: 'sakura', acc: { head: 'catEars', neck: 'bowtie' }, ambient: 'sparkles' },
    { id: 'moonrabbit', label: 'Moon rabbit', kr: '달토끼', note: 'Bunny ears under a full moon, for Chuseok.', theme: 'night', acc: { head: 'bunnyEars' }, ambient: 'stars' },
    { id: 'dj', label: 'DJ', kr: '디제이', note: 'Headphones and floating music notes.', theme: 'classic', acc: { head: 'headphones' }, ambient: 'notes' },
    { id: 'rainy', label: 'Rainy day', kr: '비 오는 날', note: 'An umbrella and soft rain.', theme: 'mint', acc: { head: 'umbrella' }, ambient: 'rain' },
    { id: 'king', label: 'Little king', kr: '임금님', note: 'A gold crown and a bow tie.', theme: 'dancheong', acc: { head: 'crown', neck: 'bowtie' }, ambient: 'sparkles' },
    { id: 'seollal', label: 'Seollal', kr: '설날', note: 'New Year: saekdong rainbow collar and a lucky pouch.', theme: 'dancheong', acc: { neck: 'saekdong', item: 'pouch' }, ambient: 'sparkles' },
    { id: 'winter', label: 'Cozy winter', kr: '겨울', note: 'Beanie, scarf and snowfall.', theme: 'mint', acc: { head: 'beanie', neck: 'scarf' }, ambient: 'snow' },
    { id: 'blossom', label: 'Blossom', kr: '벚꽃', note: 'Cherry blossoms and falling petals.', theme: 'sakura', acc: { head: 'blossom' }, ambient: 'petals' },
    { id: 'halloween', label: 'Halloween', kr: '핼러윈', note: 'Witch hat, pumpkin and bats.', theme: 'classic', acc: { head: 'witch', item: 'pumpkin' }, ambient: 'bats' },
  ];
  K.pack = (id) => K.PACKS.find((p) => p.id === id) || K.PACKS[0];
})(window.Bud);

;
// lib/characters/eyes.js
/* Eyes ("Bud"): two expressive eyes and a little horn that doubles as a status light.
 *
 * The chosen direction. Everything reads from the eyes: lids for mood, shape for
 * emotion (happy arcs, hearts, a wink), size and position for attention. The horn tip
 * glows in the state color and perks up or droops with the mood. A small mouth shows
 * only when it has something to do: a rounded one that bounces open as Bud talks (or pants
 * when it's hot), a wavy one when it's dizzy or cold; otherwise there is no mouth.
 * firmware/core/face.cpp draws the same shapes on Bud's screen.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const F = K.Face;
  const { TAU, mix, clamp, lerp } = U;

  const W0 = 22;
  const H0 = 30;
  const R0 = 10;
  const GAP = 18.5;
  const CY = 2; // eye line on the stage

  const exDefaults = () => ({ voice: 0, h: 1, round: 0, horn: 0, perk: 0, droop: 0, talk: 0, wave: 0, spiral: 0, cold: 0, hot: 0 });
  const MOUTH_Y = H0 / 2 + 4.5; // the mouth's top, under the eyes (above a neck piece's bow)
  const COLD_CHEEK = U.rgb('#A8DCFF');
  const HOT_CHEEK = U.rgb('#FF7A6B');

  function rectEye(ctx, p, env, side, col, e, pal) {
    const L = F.lids(p, side);
    const es = side < 0 ? p.eyeL : p.eyeR;
    const hp = Math.max(p.happy, side < 0 ? p.winkL : p.winkR);
    const wide = 1 + 0.14 * p.wide;
    const persp = p.lookX * side;
    const blinkBulge = 1 + 0.1 * (1 - p.eyeOpen);
    let w = W0 * wide * es * blinkBulge * (1 + 0.07 * persp);
    let h = H0 * wide * es * e.h * (1 + 0.05 * persp) * (1 - 0.3 * hp);
    if (L.asym < 0) h *= 1 - L.asym * 0.15;
    const r = lerp(R0, Math.min(w, h) / 2, e.round);
    const cx = side * GAP * (1 + 0.1 * p.wide) + p.lookX * 6;
    const cy = p.lookY * 5 - hp * 2;
    const open = Math.max(0.09, p.eyeOpen);
    const shut = Math.max(p.closed, p.heart);

    if (shut < 0.99) {
      ctx.save();
      ctx.globalAlpha *= clamp(1 - shut * 1.5);
      const hh = h * open;
      F.lidClip(ctx, cx, cy, w / 2, hh / 2, L.top, L.slope, L.bot);
      if (hp > 0.01) {
        const rr = w * 0.62;
        const d = hh * 0.62 * hp;
        ctx.beginPath();
        ctx.rect(cx - w, cy - hh, w * 2, hh * 2 + rr * 2);
        ctx.arc(cx, cy + hh / 2 + rr - d, rr, 0, TAU);
        ctx.clip('evenodd');
      }
      const g = ctx.createLinearGradient(0, cy - hh / 2, 0, cy + hh / 2);
      g.addColorStop(0, env.c(U.lighten(col, 0.22)));
      g.addColorStop(1, env.c(col));
      ctx.beginPath();
      U.rr(ctx, cx - w / 2, cy - hh / 2, w, hh, Math.min(r, hh / 2));
      ctx.fillStyle = g;
      ctx.fill();
      if (open > 0.5 && hp < 0.5) {
        const hs = w * 0.21 * (0.9 + 0.12 * p.sparkle);
        ctx.fillStyle = env.c(U.WHITE, 0.88);
        ctx.beginPath();
        U.rr(ctx, cx - w * 0.31 + p.lookX * 1.5, cy - hh * 0.33, hs, hs, hs * 0.38);
        ctx.fill();
        ctx.fillStyle = env.c(U.WHITE, 0.55);
        ctx.beginPath();
        ctx.arc(cx + w * 0.2 + p.lookX * 1.2, cy + hh * 0.26, w * 0.065, 0, TAU);
        ctx.fill();
        if (p.sparkle > 1.15) {
          ctx.globalAlpha *= clamp((p.sparkle - 1.15) / 0.4);
          ctx.fillStyle = env.c(U.WHITE, 0.9);
          ctx.beginPath();
          ctx.arc(cx + w * 0.12, cy - hh * 0.05, hs * 0.3, 0, TAU);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    if (p.closed > 0.01) {
      ctx.save();
      ctx.globalAlpha *= clamp(p.closed * 1.4);
      ctx.strokeStyle = env.c(col);
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.42, cy + 2);
      ctx.quadraticCurveTo(cx, cy + 8, cx + w * 0.42, cy + 2);
      ctx.stroke();
      ctx.restore();
    }
    if (p.heart > 0.01) {
      const beat = 1 + 0.06 * (p.sy - 1) * 10;
      const s = W0 * 0.62 * es * beat;
      const hc = mix(K.tint(env.theme, 'love'), pal.eye, 0.12);
      ctx.save();
      ctx.globalAlpha *= clamp(p.heart * 1.4);
      F.glow(ctx, cx, cy, s * 1.8, hc, 0.22, env);
      const hg = ctx.createLinearGradient(0, cy - s, 0, cy + s);
      hg.addColorStop(0, env.c(U.lighten(hc, 0.25)));
      hg.addColorStop(1, env.c(hc));
      ctx.fillStyle = hg;
      ctx.beginPath();
      F.heart(ctx, cx, cy, s);
      ctx.fill();
      ctx.fillStyle = env.c(U.WHITE, 0.8);
      ctx.beginPath();
      U.ellipse(ctx, cx - s * 0.42, cy - s * 0.35, s * 0.2, s * 0.14, -0.6);
      ctx.fill();
      ctx.restore();
    }
  }

  /** The horn: a rounded nub whose tip is Bud's status light. */
  function horn(ctx, p, env, pal, e) {
    const L = K.state(p.state).loop;
    const tilt = 0.22 + 0.05 * e.horn - 0.35 * e.perk * 0.4 + 0.55 * e.droop;
    ctx.save();
    ctx.translate(-1 + p.lookX * 3, -19.5 + p.lookY * 2 - p.wide * 2 - 1.5 * e.perk + 2.5 * e.droop);
    ctx.rotate(tilt);
    ctx.scale(1, 1 + 0.12 * e.perk - 0.15 * e.droop);
    ctx.beginPath();
    ctx.moveTo(-4.2, 2);
    ctx.quadraticCurveTo(-3.9, -4.6, 0.3, -9.2);
    ctx.quadraticCurveTo(2.1, -10.4, 3, -8.4);
    ctx.quadraticCurveTo(4.4, -3.2, 4.2, 2);
    ctx.closePath();
    ctx.fillStyle = env.c(mix(pal.horn, p.tint, p.tintAmt * 0.35));
    ctx.fill();
    // status light: always softly on, pulses at rest, takes the state color otherwise
    const idlePulse = 0.45 + 0.35 * Math.max(0, U.osc(p.tt, L, Math.max(1, Math.round(L / 3))));
    const led = p.tintAmt > 0.05 ? mix(pal.eye, p.tint, p.tintAmt) : pal.eye;
    const ledA = (p.tintAmt > 0.05 ? 0.6 + 0.4 * p.tintAmt : idlePulse) * (1 - 0.6 * e.droop);
    F.glow(ctx, 1.2, -8.1, 7, led, 0.55 * ledA, env);
    ctx.fillStyle = env.c(U.lighten(led, 0.25), ledA);
    ctx.beginPath();
    ctx.arc(1.25, -8.1, 1.7, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /**
   * The talking mouth: a little D, flat on top and round below, that opens as the voice does
   * (p.mouthOpen) and closes to a small smile between words; wide open, a tongue shows.
   */
  function talkMouth(ctx, p, env, col, pal, amt) {
    if (amt < 0.02) return;
    const open = clamp((p.mouthOpen - 0.1) / 0.6);
    const x = p.lookX * 4;
    const y = MOUTH_Y + p.lookY * 3;
    const rx = 4.4 + 1.2 * open;
    const ry = 1.6 + 4.6 * open;
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = env.c(col);
    ctx.fill();
    const tongue = U.smoothstep(0.45, 0.75, open);
    if (tongue > 0.02) {
      ctx.clip();
      ctx.globalAlpha *= tongue;
      ctx.beginPath();
      U.ellipse(ctx, x + 0.4, y + ry * 0.95, rx * 0.58, ry * 0.42);
      ctx.fillStyle = env.c(pal.cheek);
      ctx.fill();
    }
    ctx.restore();
  }

  /** A wavy mouth: slow and loose when dizzy, quick and small when cold (chattering teeth). */
  function wavyMouth(ctx, p, env, col, amt, fast) {
    if (amt < 0.02) return;
    const x = p.lookX * 4;
    const y = MOUTH_Y + 2 + p.lookY * 3;
    const w = 12;
    const amp = fast ? 1.3 : 1.8;
    const shift = p.tt * (fast ? 9 : 2.2);
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.strokeStyle = env.c(col);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const px = x - w / 2 + (w * i) / 4;
      const py = y + (i % 2 ? -amp : amp) * Math.cos(Math.PI * shift) * (i === 0 || i === 4 ? 0.5 : 1);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Dizzy: each eye a spiral turning in place. */
  function spiralEye(ctx, p, env, side, col, amt) {
    if (amt < 0.02) return;
    const cx = side * GAP + p.lookX * 6;
    const cy = p.lookY * 5;
    const turn = p.tt * TAU * 0.9 * side;
    ctx.save();
    ctx.globalAlpha *= amt;
    ctx.strokeStyle = env.c(col);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const steps = 28;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = turn + u * TAU * 2.25;
      const r = 1 + u * 10.5;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r * 1.12;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Cold (pale blue) or hot (rosy) cheeks, just below the outer corner of each eye. */
  function moodCheeks(ctx, p, env, color, amt) {
    if (amt < 0.02) return;
    ctx.fillStyle = env.c(color, 0.8 * amt);
    for (let s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      U.ellipse(ctx, s * (GAP + W0 * 0.5) + p.lookX * 6, H0 * 0.5 + 5 + p.lookY * 4, 4.6, 2.5);
      ctx.fill();
    }
  }

  K.registerCharacter({
    id: 'eyes',
    label: 'Eyes',
    kr: '눈',
    tagline: 'Two eyes and a little horn',
    blurb: 'The chosen direction: two expressive eyes and a little horn whose tip is the status light. Everything reads from the eyes, so it stays clear at tiny sizes, and the black around it keeps the screen cheap to run.',
    swatch: ['eye', 'horn', 'cheek'],
    palettes: {
      classic: { eye: '#79F7E6', horn: '#46B9AA', cheek: '#FF8FB1', tint: '#79F7E6', bg: '#0E2230' },
      night: { eye: '#B6A6FF', horn: '#7A6BDE', cheek: '#FF8FC8', tint: '#B6A6FF', bg: '#0D0B22' },
      sakura: { eye: '#FF9EC8', horn: '#D36F9A', cheek: '#FFD3E4', tint: '#FF9EC8', bg: '#2B0F1E' },
      mint: { eye: '#86FFC3', horn: '#46AE7E', cheek: '#FFA3B5', tint: '#86FFC3', bg: '#0B2219' },
      dancheong: { eye: '#FFD34E', horn: '#E8402E', cheek: '#FF8A70', tint: '#FFD34E', bg: '#13305E' },
      mono: { eye: '#FFFFFF', horn: '#A6A6A6', cheek: '#8A8A8A', tint: '#FFFFFF', bg: '#111111' },
    },

    pose(p, state, tt) {
      p.ex = Object.assign(exDefaults(), p.ex);
      const e = p.ex;
      const L = K.state(state).loop;
      e.horn = U.osc(tt, L, 1, 0.2);
      // each state's touches for Bud are in its file (lib/states/<id>.js)
      const touch = K.stateParts(state).eyes;
      if (touch) touch(p, e, tt, L);
      return p;
    },

    fidget(p, id, u) {
      const e = p.ex;
      if (id === 'hop') e.perk = Math.max(e.perk, U.hop(u, 0.1, 0.8));
      if (id === 'yawn') e.droop = Math.max(e.droop, 0.6 * U.win(u, 0.1, 0.78, 0.18));
      if (id === 'look') e.horn += 1.2 * Math.sin(u * Math.PI * 2);
    },

    anchors(p) {
      return { x: p.x, y: p.y + CY, top: p.y - 18, side: GAP + W0 / 2 + 1, sideY: p.y + CY, sweatY: p.y - 10, badge: [25, -28], rec: [-26, -28] };
    },

    draw(ctx, p, pal, env) {
      const e = p.ex;
      const col = mix(pal.eye, p.tint, p.tintAmt * 0.85);
      ctx.save();
      ctx.translate(p.x, p.y + CY);
      ctx.rotate(p.rot);
      ctx.scale(p.sx, p.sy);

      F.glow(ctx, -GAP, 0, 26, col, 0.22 * p.glow, env);
      F.glow(ctx, GAP, 0, 26, col, 0.22 * p.glow, env);

      env.acc(ctx, 'head', { x: p.lookX * 3, y: -21 + p.lookY * 2 - p.wide * 2, w: 46, ear: [34, 21] });
      horn(ctx, p, env, pal, e);

      // cheeks only show when Bud is properly happy (done, a wink, love); faint ones read as smudges
      const joy = Math.max(p.happy, p.winkL, p.winkR, p.heart);
      const cheekA = U.smoothstep(0.3, 0.6, joy) * Math.min(1, p.blush * 1.2) * 0.85;
      if (cheekA > 0.02) {
        ctx.fillStyle = env.c(pal.cheek, cheekA);
        for (let s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          U.ellipse(ctx, s * (GAP + W0 * 0.42) + p.lookX * 6, H0 * 0.5 + 1 + p.lookY * 4, 4.6, 2.5);
          ctx.fill();
        }
      }

      moodCheeks(ctx, p, env, COLD_CHEEK, e.cold);
      moodCheeks(ctx, p, env, HOT_CHEEK, e.hot);
      if (e.spiral < 0.98) {
        ctx.save();
        ctx.globalAlpha *= 1 - e.spiral;
        rectEye(ctx, p, env, -1, col, e, pal);
        rectEye(ctx, p, env, 1, col, e, pal);
        ctx.restore();
      }
      spiralEye(ctx, p, env, -1, col, e.spiral);
      spiralEye(ctx, p, env, 1, col, e.spiral);
      talkMouth(ctx, p, env, col, pal, e.talk);
      wavyMouth(ctx, p, env, col, e.wave, e.cold > e.spiral);

      const wide = 1 + 0.14 * p.wide;
      env.acc(ctx, 'face', { x: p.lookX * 6, y: p.lookY * 5, dx: GAP * (1 + 0.1 * p.wide), rx: (W0 / 2) * wide, ry: (H0 / 2) * wide });
      env.acc(ctx, 'neck', { x: 0, y: 25, w: 44 });
      ctx.restore();
      env.acc(ctx, 'item', { x: p.x - 33, y: p.y + 30, w: 1 });
    },
  });
})(window.Bud);

;
// lib/characters/skins.js
/* Base + skins (direction 5).
 *
 * Not a new face: a wrapper that takes any base creature and applies a skin pack
 * (color theme + hat/neck/item + ambience) from looks.js. The explorer shows
 * a base picker and pack picker when this is selected.
 */
(function (K) {
  'use strict';

  K.registerCharacter({
    id: 'skins',
    label: 'Base + skins',
    kr: '옷장',
    tagline: 'Any base creature, swappable looks',
    blurb: 'Direction 5 is a system rather than a new face: pick any base creature (Bud by default), then dress it with a skin pack (outfit, hat, glasses, held item, color theme and ambience). A possible revenue line.',
    wrapper: true,
    resolve(cfg) {
      const pack = K.pack(cfg.pack);
      const b = K.characters.get(cfg.base);
      const base = b && !b.wrapper ? b.id : 'eyes';
      return { character: base, theme: pack.theme, acc: pack.acc, ambient: pack.ambient };
    },
  });
})(window.Bud);

;
// lib/screen.js
/* Screen: renders one animated character into a canvas that looks like a small display.
 *
 * Pipeline per frame:
 *   1. paint(): background, character, overlays and transition moves into a buffer at the
 *      simulated resolution (for example 128 px across), in stage units (100 x 100)
 *   2. simulate the panel: color depth (RGB565 or dithered 1-bit) and brightness
 *   3. scale up to the real canvas (nearest neighbor when low-res)
 *   4. OLED bloom, optional pixel grid, then mask to the screen shape
 * paint() is also what the sprite exporter uses, so exported frames match the preview.
 * All Screens share one requestAnimationFrame loop and pause when off screen.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU, clamp } = U;
  const DPR_CAP = 2;

  /* --------------------------------------------------------------- frame loop */

  const screens = new Set();
  let raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    screens.forEach((s) => s._tick(now));
  }
  function ensureLoop() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------- shapes */

  /** Path for a screen shape filling a w x h box (pixels), optionally inset. */
  function shapePath(ctx, shape, w, h, inset) {
    inset = inset || 0;
    const x = inset;
    const y = inset;
    const W = Math.max(1, w - 2 * inset);
    const H = Math.max(1, h - 2 * inset);
    const type = shape && shape.type;
    ctx.beginPath();
    if (type === 'circle') {
      ctx.ellipse(w / 2, h / 2, W / 2, H / 2, 0, 0, TAU);
    } else if (type === 'arch') {
      const r = Math.min(W / 2, H);
      const br = Math.max(0, Math.min((shape.br || 0) * Math.min(w, h), (H - r) * 0.9, W / 4));
      ctx.moveTo(x, y + r);
      ctx.arc(x + r, y + r, r, Math.PI, 0);
      ctx.lineTo(x + W, y + H - br);
      if (br > 0.5) ctx.arcTo(x + W, y + H, x + W - br, y + H, br);
      else ctx.lineTo(x + W, y + H);
      ctx.lineTo(x + br, y + H);
      if (br > 0.5) ctx.arcTo(x, y + H, x, y + H - br, br);
      else ctx.lineTo(x, y + H);
      ctx.closePath();
    } else {
      const r = Math.max(0, ((shape && shape.r) || 0) * Math.min(w, h) - inset);
      U.rr(ctx, x, y, W, H, r);
    }
  }

  function perimeter(shape, w, h) {
    const type = shape && shape.type;
    if (type === 'circle') return Math.PI * (w + h) * 0.5;
    if (type === 'arch') return w + 2 * Math.max(0, h - w / 2) + (Math.PI * w) / 2;
    return 2 * (w + h);
  }

  function inside(shape, px, py, w, h) {
    const type = shape && shape.type;
    if (type === 'circle') {
      const u = (px - w / 2) / (w / 2);
      const v = (py - h / 2) / (h / 2);
      return u * u + v * v <= 1;
    }
    if (type === 'arch') {
      const r = Math.min(w / 2, h);
      if (py >= r) return true;
      const dx = px - w / 2;
      const dy = py - r;
      return dx * dx + dy * dy <= r * r;
    }
    return true;
  }

  /** Where the 100-unit stage sits inside the screen buffer. */
  function layout(iw, ih, cfg) {
    const st = cfg.stage || {};
    if (cfg.chrome && ih / iw > 1.25) {
      const S = iw * (st.scale || 0.94);
      return { cx: iw / 2, cy: ih * 0.47, s: S / 100, chrome: true };
    }
    const S = Math.min(iw, ih) * (st.scale || 1);
    let cy = ih / 2;
    if (st.align === 'bottom') cy = ih - S / 2;
    cy += ((st.dy || 0) * S) / 100;
    return { cx: iw / 2, cy, s: S / 100, chrome: false };
  }

  /** Slow burn-in-safe drift, in stage units. */
  function drift(t) {
    return [3.2 * Math.sin((t * TAU) / 23), 2.6 * Math.sin((t * TAU) / 31 + 1.3)];
  }

  const STATE_LINE = {
    idle: 'Ready',
    listening: 'Listening',
    thinking: 'Thinking',
    done: 'Done',
    recording: 'Recording',
    sleeping: 'Sleeping',
    lowbattery: 'Battery low',
    needsyou: 'Needs you',
  };

  /** Stroke the screen-edge path starting at 12 o'clock on round screens, so progress reads like a clock. */
  function edgePath(b, cfg, iw, ih, inset) {
    if (cfg.shape && cfg.shape.type === 'circle') {
      b.beginPath();
      b.ellipse(iw / 2, ih / 2, Math.max(1, iw / 2 - inset), Math.max(1, ih / 2 - inset), -Math.PI / 2, 0, TAU);
    } else shapePath(b, cfg.shape, iw, ih, inset);
  }

  /** The accent of the agent at work (cfg.accent, '#RRGGBB'), gray on mono and desaturated with the
   * pose like everything else (env.c); null for none. */
  function accentOf(cfg, theme, pose) {
    if (!cfg.accent) return null;
    const c = U.rgb(cfg.accent);
    return theme === 'mono' ? U.gray(c) : pose.desat > 0.01 ? U.desat(c, pose.desat) : c;
  }
  /** The working ring's color: the agent's accent, else the theme's working tint. */
  function workingColor(cfg, theme, pose) {
    return accentOf(cfg, theme, pose) || K.tint(theme, 'working');
  }

  // An agent's glow while it works: three soft bands just inside the screen edge, brightest at the
  // edge, breathing once per working loop. Plain strokes of the edge path, no gradients, so Bud's
  // firmware draws them as three rings.
  const GLOW_BANDS = [0.3, 0.16, 0.07];
  function accentGlow(b, pose, cfg, iw, ih, theme, t) {
    const pr = pose.fx.progress || 0;
    const accent = pr < 0.01 ? null : accentOf(cfg, theme, pose);
    if (!accent) return;
    const w = Math.max(2, Math.min(iw, ih) * 0.045);
    const breathe = 0.85 + 0.15 * U.osc(t, K.state('working').loop);
    b.save();
    b.lineWidth = w;
    for (let i = 0; i < GLOW_BANDS.length; i++) {
      edgePath(b, cfg, iw, ih, w * (i + 0.5));
      b.strokeStyle = U.css(accent, GLOW_BANDS[i] * pr * breathe);
      b.stroke();
    }
    b.restore();
  }

  function progressRing(b, pose, cfg, iw, ih, theme, t) {
    const pr = pose.fx.progress || 0;
    if (pr < 0.01) return;
    const lw = Math.max(1.2, Math.min(iw, ih) * 0.028);
    const per = perimeter(cfg.shape, iw - lw * 1.5, ih - lw * 1.5);
    const L = K.state('working').loop;
    const v = U.fract(t / L);
    const fill = U.easeInOut(U.clamp(v / 0.92));
    const fade = 1 - U.smoothstep(0.93, 1, v);
    const col = workingColor(cfg, theme, pose);
    b.save();
    b.lineCap = 'round';
    b.lineWidth = lw;
    edgePath(b, cfg, iw, ih, lw * 0.75);
    b.strokeStyle = U.css(col, 0.22 * pr);
    b.stroke();
    b.setLineDash([per * fill, per]);
    b.strokeStyle = U.css(col, pr * fade);
    b.stroke();
    b.restore();
  }

  function statusRing(b, pose, cfg, iw, ih, theme, t) {
    progressRing(b, pose, cfg, iw, ih, theme, t);
    const ring = pose.fx.ring || 0;
    const attn = pose.fx.attn || 0;
    if (ring < 0.01 && attn < 0.01) return;
    const lw = Math.max(1.2, Math.min(iw, ih) * 0.026);
    b.save();
    shapePath(b, cfg.shape, iw, ih, lw * 0.75);
    b.lineCap = 'round';
    if (ring > 0.01) {
      const col = K.tint(theme, 'recording');
      b.lineWidth = lw;
      b.strokeStyle = U.css(col, 0.3 * ring);
      b.stroke();
      const per = perimeter(cfg.shape, iw - lw * 1.5, ih - lw * 1.5);
      b.setLineDash([per * 0.2, per * 0.8]);
      b.lineDashOffset = -per * U.fract(t / K.state('recording').loop);
      b.strokeStyle = U.css(col, ring);
      b.stroke();
      b.setLineDash([]);
    }
    if (attn > 0.01) {
      const col = K.tint(theme, 'needsyou');
      const pulse = 0.5 + 0.5 * Math.sin((t * TAU) / 0.8);
      b.lineWidth = lw * (0.9 + 0.6 * pulse);
      b.strokeStyle = U.css(col, attn * (0.25 + 0.65 * pulse));
      b.stroke();
    }
    b.restore();
  }

  /** "save" and "complete" moves: the edge ring closes into a full circle (in the agent's accent, if
   * one is at work), then turns to the done color. */
  function transitionRing(b, fr, cfg, iw, ih, theme) {
    if (!fr.tr || (fr.tr.id !== 'save' && fr.tr.id !== 'complete')) return;
    const u = fr.u;
    const lw = Math.max(1.2, Math.min(iw, ih) * 0.03);
    const per = perimeter(cfg.shape, iw - lw * 1.5, ih - lw * 1.5);
    b.save();
    edgePath(b, cfg, iw, ih, lw * 0.75);
    b.lineCap = 'round';
    if (u < 0.55) {
      const prog = 0.2 + 0.8 * U.easeInOut(u / 0.5);
      b.setLineDash([per * prog, per]);
      b.lineWidth = lw;
      const col = fr.tr.id === 'save' ? K.tint(theme, 'recording') : workingColor(cfg, theme, fr.pose);
      b.strokeStyle = U.css(col, 1);
      b.stroke();
    } else {
      const v = (u - 0.55) / 0.45;
      b.lineWidth = lw * (1 + 1.5 * v);
      b.strokeStyle = U.css(K.tint(theme, 'done'), 1 - v);
      b.stroke();
    }
    b.restore();
  }

  function chrome(b, iw, ih, cfg, pose, pal, theme, stateAge, still) {
    const fs = Math.max(5, Math.round(iw * 0.075));
    const pad = Math.round(iw * 0.09);
    const bgL = cfg.oled ? 0 : U.luma(pal.bg);
    const fg = bgL > 0.55 ? [24, 22, 30] : [236, 236, 242];
    const ty = Math.round(ih * 0.075);
    b.save();
    b.textBaseline = 'middle';
    b.font = `700 ${fs}px "Nunito", ui-rounded, system-ui, sans-serif`;
    b.fillStyle = U.css(fg, 0.72);
    b.textAlign = 'left';
    b.fillText(cfg.name || '', pad, ty);
    const bw = fs * 1.7;
    const bh = fs * 0.82;
    const bx = iw - pad - bw;
    const by = ty - bh / 2;
    const low = pose.state === 'lowbattery';
    b.strokeStyle = U.css(fg, 0.72);
    b.lineWidth = Math.max(1, fs * 0.12);
    b.beginPath();
    U.rr(b, bx, by, bw, bh, bh * 0.25);
    b.stroke();
    b.fillStyle = low ? U.css(K.tint(theme, 'recording')) : U.css(fg, 0.72);
    b.fillRect(bx + bw * 0.12, by + bh * 0.22, bw * 0.76 * (low ? 0.18 : 0.72), bh * 0.56);
    let label = STATE_LINE[pose.state] || '';
    if (pose.state === 'recording') {
      // a sprite cannot know the elapsed time, so exported frames just say REC
      const s = Math.floor(stateAge);
      label = still ? 'REC' : `REC ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    } else if (pose.state === 'listening' || pose.state === 'thinking') {
      const n = still ? 1 + Math.floor(U.fract(pose.loopT / K.state(pose.state).loop) * 3) : 1 + (Math.floor(stateAge * 2.5) % 3);
      label += '.'.repeat(n);
    }
    b.font = `700 ${Math.round(fs * 1.1)}px "Nunito", ui-rounded, system-ui, sans-serif`;
    b.textAlign = 'center';
    b.fillStyle = U.css(fg, 0.88);
    b.fillText(label, iw / 2, Math.round(ih * 0.9));
    if (pose.tintAmt > 0.05) {
      b.fillStyle = U.css(pose.tint, pose.tintAmt);
      b.beginPath();
      b.arc(iw / 2, Math.round(ih * 0.82), Math.max(1.2, fs * 0.22), 0, TAU);
      b.fill();
    }
    b.restore();
  }

  /* -------------------------------------------------------- panel simulation */

  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const INKS = { white: [236, 246, 255], blue: [96, 200, 255], amber: [255, 186, 84] };
  const Q5 = new Uint8Array(256);
  const Q6 = new Uint8Array(256);
  for (let v = 0; v < 256; v++) {
    Q5[v] = Math.round((Math.round((v * 31) / 255) * 255) / 31);
    Q6[v] = Math.round((Math.round((v * 63) / 255) * 255) / 63);
  }
  K.DEPTHS = [
    { id: 'full', label: 'Full color', bits: 24 },
    { id: 'rgb565', label: '16-bit', bits: 16, note: 'RGB565, what most small color panels take' },
    { id: 'mono1', label: '1-bit', bits: 1, note: 'On or off pixels, like a cheap monochrome OLED' },
  ];
  K.MONO_INKS = INKS;

  /** Quantize a buffer in place: RGB565 banding, or ordered-dither 1-bit in an ink color. */
  function applyDepth(b, iw, ih, depth, ink) {
    if (depth !== 'rgb565' && depth !== 'mono1') return;
    let img;
    try {
      img = b.getImageData(0, 0, iw, ih);
    } catch (e) {
      return;
    }
    const d = img.data;
    if (depth === 'rgb565') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Q5[d[i]];
        d[i + 1] = Q6[d[i + 1]];
        d[i + 2] = Q5[d[i + 2]];
      }
    } else {
      const c = INKS[ink] || INKS.white;
      for (let y = 0; y < ih; y++) {
        const row = (y & 3) * 4;
        for (let x = 0; x < iw; x++) {
          const i = (y * iw + x) * 4;
          const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          const on = l > (BAYER4[row + (x & 3)] + 0.5) * 16;
          d[i] = on ? c[0] : 0;
          d[i + 1] = on ? c[1] : 0;
          d[i + 2] = on ? c[2] : 0;
        }
      }
    }
    b.putImageData(img, 0, 0);
  }

  /** Display brightness: scales every lit pixel down (OLED power drops with it). */
  function applyBrightness(b, iw, ih, level) {
    if (!(level < 0.995)) return;
    b.save();
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = `rgba(0,0,0,${(1 - clamp(level, 0, 1)).toFixed(3)})`;
    b.fillRect(0, 0, iw, ih);
    b.restore();
  }

  /* ---------------------------------------------------------------- painting */

  /** Resolve the Base + skins wrapper into what to draw: character, theme, accessories, ambience. */
  function resolve(cfg) {
    let charId = cfg.character;
    let theme = cfg.theme;
    let acc = cfg.acc || {};
    let ambient = cfg.ambient || null;
    const wrap = K.characters.get(charId);
    if (wrap && wrap.wrapper) {
      const r = wrap.resolve(cfg);
      charId = r.character;
      theme = r.theme;
      acc = r.acc || {};
      ambient = r.ambient || null;
    }
    const ch = K.characters.get(charId) || K.characters.list.find((c) => !c.wrapper);
    if (!K.themes.has(theme)) theme = 'classic';
    return { ch, theme, acc, ambient, pal: ch ? K.palette(ch.id, theme) : null };
  }

  /**
   * Draw one frame of screen content into `b` (iw x ih pixels): no bloom, no scaling.
   * fr = { pose, poseA, poseB, k, tr, u }; o = { loop (seconds, for loop-safe ambient),
   * still (sprite export: no drift, static REC label), stateAge }.
   */
  function paint(b, iw, ih, cfg, R, fr, t, o) {
    o = o || {};
    const { ch, theme, acc, ambient, pal } = R;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1;
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = cfg.oled ? '#000' : U.css(pal.bg);
    b.fillRect(0, 0, iw, ih);

    const lay = layout(iw, ih, cfg);
    const pose = fr.pose;
    accentGlow(b, pose, cfg, iw, ih, theme, t);
    // gaze: { x, y, amt } lets a page steer where the character looks (cursor follow)
    if (cfg.gaze && cfg.gaze.amt > 0.001 && pose.closed < 0.5) {
      const g = cfg.gaze;
      const a = clamp(g.amt, 0, 1) * (1 - pose.closed * 2);
      pose.lookX = U.lerp(pose.lookX, clamp(g.x, -1, 1), a);
      pose.lookY = U.lerp(pose.lookY, clamp(g.y, -1, 1), a);
    }
    const desat = pose.desat;
    const loop = o.loop || 0;
    const rate = (hz) => (loop ? Math.max(1, Math.round(hz * loop)) / loop : hz);
    const env = {
      t,
      theme,
      pal,
      accColors: K.accColors(theme),
      oled: cfg.oled,
      mono: theme === 'mono',
      lowRes: cfg.lowRes | 0,
      shape: cfg.shape,
      bounds: { x0: -lay.cx / lay.s, y0: -lay.cy / lay.s, x1: (iw - lay.cx) / lay.s, y1: (ih - lay.cy) / lay.s },
      rate,
      wave: (hz, ph) => Math.sin(TAU * (rate(hz) * t + (ph || 0))),
      // mono is a single-color panel: everything (accessories and effects too) goes gray
      c: (rgb, a) => U.css(theme === 'mono' ? U.gray(rgb) : desat > 0.01 ? U.desat(rgb, desat) : rgb, a == null ? 1 : a),
      acc: (ctx, slot, anchor) => K.Acc.drawSlot(ctx, slot, anchor, env, acc),
    };

    b.save();
    b.translate(lay.cx, lay.cy);
    b.scale(lay.s, lay.s);
    if (cfg.drift && !o.still) {
      const d = drift(t);
      let dx = d[0];
      let dy = d[1];
      if (cfg.lowRes) {
        dx = Math.round(dx * lay.s) / lay.s;
        dy = Math.round(dy * lay.s) / lay.s;
      }
      b.translate(dx, dy);
    }
    if (ambient) K.FX.ambient(b, ambient, t, env, 'back');
    b.save();
    ch.draw(b, pose, pal, env);
    b.restore();
    const anchors = ch.anchors ? ch.anchors(pose) : null;
    if (fr.poseA) K.FX.draw(b, fr.poseA, env, 1 - fr.k, anchors);
    K.FX.draw(b, fr.poseB || pose, env, fr.poseA ? fr.k : 1, anchors);
    if (fr.tr) K.FX.transition(b, fr, env, anchors);
    if (ambient) K.FX.ambient(b, ambient, t, env, 'front');
    b.restore();

    statusRing(b, pose, cfg, iw, ih, theme, t);
    if (fr.tr) transitionRing(b, fr, cfg, iw, ih, theme);
    if (lay.chrome) chrome(b, iw, ih, cfg, pose, pal, theme, o.stateAge || 0, o.still);
    if (pose.bright < 0.995) {
      b.fillStyle = `rgba(0,0,0,${(1 - pose.bright).toFixed(3)})`;
      b.fillRect(0, 0, iw, ih);
    }
  }

  /* ------------------------------------------------------------------- Screen */

  class Screen {
    constructor(host, opts) {
      this.host = host;
      this.opts = Object.assign({ fps: 60, bloom: true, metrics: false, onMetrics: null, quality: 1, manual: false }, opts || {});
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'kx-canvas';
      this.canvas.style.cssText = 'display:block;width:100%;height:100%';
      host.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.buf = document.createElement('canvas');
      this.bctx = this.buf.getContext('2d');
      this.cfg = {
        character: 'ember', base: 'bun', pack: 'lantern', theme: 'classic', acc: {}, state: 'idle',
        oled: true, lowRes: 0, drift: false, glow: true, grid: true, depth: 'full', ink: 'white', brightness: 1,
        variety: true, shape: { type: 'circle' }, stage: {}, chrome: false, name: '',
      };
      this.seed = Math.random() * 20;
      const now = performance.now() / 1000;
      this.cur = { state: 'idle', since: now - Math.random() * 12 };
      this.prev = null;
      this.trans = null;
      this.visible = true;
      this.last = 0;
      this.W = 0;
      this.H = 0;
      this.metrics = null;
      this._mT = 0;
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(host);
      this._io = new IntersectionObserver((entries) => {
        this.visible = entries[entries.length - 1].isIntersecting;
      });
      this._io.observe(host);
      this._resize();
      screens.add(this);
      ensureLoop();
    }

    set(patch) {
      if (!patch) return this;
      const st = patch.state;
      Object.assign(this.cfg, patch);
      if (st && st !== this.cur.state) {
        const now = performance.now() / 1000;
        if (!this.rendered) {
          // first state before anything was drawn: start mid-loop, no transition
          this.cur = { state: st, since: now - Math.random() * K.state(st).loop };
        } else {
          const tr = K.transitionFor(this.cur.state, st);
          this.prev = { state: this.cur.state, since: this.cur.since };
          this.trans = { tr, at: now };
          this.cur = { state: st, since: now + tr.dur * (tr.flash || 0) };
        }
      }
      this.last = 0;
      return this;
    }

    destroy() {
      screens.delete(this);
      this._ro.disconnect();
      this._io.disconnect();
      this.canvas.remove();
    }

    _resize() {
      const r = this.host.getBoundingClientRect();
      const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1) * (this.opts.quality || 1);
      const W = Math.max(1, Math.round(r.width * dpr));
      const H = Math.max(1, Math.round(r.height * dpr));
      if (W !== this.W || H !== this.H) {
        this.W = this.canvas.width = W;
        this.H = this.canvas.height = H;
        this.last = 0;
      }
    }

    _tick(now) {
      if (this.opts.manual || !this.visible || this.W < 2 || this.H < 2) return;
      if (now - this.last < 1000 / this.opts.fps - 2) return;
      this.last = now;
      this.render(now / 1000);
    }

    /** Poses for time t, including a running designed transition. */
    _poses(R, t) {
      const opts = { variety: this.cfg.variety !== false, seed: this.seed };
      const poseB = K.Pose.compute(R.ch, this.cur.state, Math.max(0, t - this.cur.since), R.pal, R.theme, opts);
      if (this.prev && this.trans) {
        const u = (t - this.trans.at) / this.trans.tr.dur;
        if (u < 1) {
          const poseA = K.Pose.compute(R.ch, this.prev.state, t - this.prev.since, R.pal, R.theme, opts);
          const tp = K.Pose.transitionPose(this.trans.tr, poseA, poseB, u);
          return { pose: tp.pose, poseA, poseB, k: tp.k, tr: this.trans.tr, u };
        }
        this.prev = null;
        this.trans = null;
      }
      return { pose: poseB, poseA: null, poseB, k: 1, tr: null, u: 1 };
    }

    render(t) {
      this.rendered = true;
      const cfg = this.cfg;
      const R = resolve(cfg);
      if (!R.ch) return;
      const W = this.W;
      const H = this.H;
      const lowRes = cfg.lowRes | 0;
      let iw = W;
      let ih = H;
      if (lowRes > 0) {
        iw = lowRes;
        ih = Math.max(1, Math.round((lowRes * H) / W));
      }
      // panel simulation reads pixels back, so it gets its own CPU-friendly buffer
      const sim = lowRes > 0 && (cfg.depth === 'rgb565' || cfg.depth === 'mono1');
      let buf = this.buf;
      let b = this.bctx;
      if (sim) {
        if (!this.simBuf) {
          this.simBuf = document.createElement('canvas');
          this.simCtx = this.simBuf.getContext('2d', { willReadFrequently: true });
        }
        buf = this.simBuf;
        b = this.simCtx;
      }
      if (buf.width !== iw || buf.height !== ih) {
        buf.width = iw;
        buf.height = ih;
      }

      const fr = this._poses(R, t);
      paint(b, iw, ih, cfg, R, fr, t, { stateAge: t - this.cur.since });
      if (sim) applyDepth(b, iw, ih, cfg.depth, cfg.ink);
      applyBrightness(b, iw, ih, cfg.brightness == null ? 1 : cfg.brightness);

      const c = this.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
      c.clearRect(0, 0, W, H);
      c.imageSmoothingEnabled = !lowRes || iw > W;
      c.imageSmoothingQuality = 'high';
      c.drawImage(buf, 0, 0, W, H);
      if (cfg.oled && cfg.glow && this.opts.bloom) this._bloom(c, W, H, 0.35 + 0.4 * fr.pose.glow);
      if (lowRes && cfg.grid && W / iw >= 3.2) this._grid(c, W, H, iw, ih);
      c.globalCompositeOperation = 'destination-in';
      shapePath(c, cfg.shape, W, H);
      c.fillStyle = '#000';
      c.fill();
      c.globalCompositeOperation = 'source-over';

      if (this.opts.metrics && t - this._mT > 0.4) {
        this._mT = t;
        this.metrics = this._measure(buf, lowRes);
        if (this.opts.onMetrics) this.opts.onMetrics(this.metrics);
      }
    }

    _bloom(c, W, H, amount) {
      if (!this._bl) this._bl = [0, 1, 2, 3].map(() => document.createElement('canvas'));
      let src = this.canvas;
      let w = W;
      let h = H;
      for (let i = 0; i < 4; i++) {
        w = Math.max(2, w >> 1);
        h = Math.max(2, h >> 1);
        const cv = this._bl[i];
        if (cv.width !== w || cv.height !== h) {
          cv.width = w;
          cv.height = h;
        }
        const x = cv.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.clearRect(0, 0, w, h);
        x.drawImage(src, 0, 0, w, h);
        src = cv;
      }
      c.save();
      c.globalCompositeOperation = 'screen';
      c.imageSmoothingEnabled = true;
      c.globalAlpha = clamp(amount * 0.3);
      c.drawImage(this._bl[1], 0, 0, W, H);
      c.globalAlpha = clamp(amount * 0.5);
      c.drawImage(this._bl[3], 0, 0, W, H);
      c.restore();
    }

    _grid(c, W, H, iw, ih) {
      const cw = W / iw;
      const ch = H / ih;
      const gw = Math.max(1, Math.round(cw * 0.14));
      c.fillStyle = 'rgba(0,0,0,0.32)';
      for (let i = 1; i < iw; i++) c.fillRect(Math.round(i * cw) - (gw >> 1), 0, gw, H);
      for (let j = 1; j < ih; j++) c.fillRect(0, Math.round(j * ch) - (gw >> 1), W, gw);
    }

    _measure(src, lowRes) {
      const iw = src.width;
      const ih = src.height;
      const mw = Math.min(iw, 120);
      const mh = Math.max(1, Math.round((ih * mw) / iw));
      if (!this._mc) {
        this._mc = document.createElement('canvas');
        this._mx = this._mc.getContext('2d', { willReadFrequently: true });
      }
      if (this._mc.width !== mw || this._mc.height !== mh) {
        this._mc.width = mw;
        this._mc.height = mh;
      }
      this._mx.imageSmoothingEnabled = true;
      this._mx.drawImage(src, 0, 0, mw, mh);
      let data;
      try {
        data = this._mx.getImageData(0, 0, mw, mh).data;
      } catch (e) {
        return null;
      }
      let n = 0;
      let lit = 0;
      let sum = 0;
      for (let y = 0; y < mh; y++) {
        for (let x = 0; x < mw; x++) {
          if (!inside(this.cfg.shape, x + 0.5, y + 0.5, mw, mh)) continue;
          const i = (y * mw + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const bl = data[i + 2];
          n++;
          if (r > 16 || g > 16 || bl > 16) lit++;
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * bl;
        }
      }
      return { lit: n ? lit / n : 0, level: n ? sum / (n * 255) : 0, res: lowRes ? [iw, ih] : null };
    }
  }

  K.Screen = Screen;
  K.ScreenUtil = { shapePath, layout, inside, perimeter, resolve, paint, applyDepth, applyBrightness };
})(window.Bud);

;
// lib/phones.js
/* Phone backs used for scale. All dimensions in millimeters, origin at the
 * phone's top-left corner as seen from the back.
 *
 * These are approximate 6.1-inch class outlines for visual scale only, not
 * measured specs. Adjust the numbers here if you want a specific model.
 */
(function (K) {
  'use strict';
  const U = K.util;

  K.registerPhone({
    id: 'iphone',
    label: 'iPhone-style',
    short: 'iPhone-style',
    w: 71.6,
    h: 147.6,
    t: 7.8,
    r: 10.6,
    note: 'Approximate 6.1-inch class outline, camera island top-left. For scale only.',
    camera: {
      island: { x: 3.6, y: 3.6, w: 35, h: 35, r: 8.6 },
      lenses: [{ x: 13, y: 13, r: 7 }, { x: 25.8, y: 25.8, r: 7 }],
      flash: { x: 28.4, y: 11, r: 2.4 },
      mic: { x: 11.2, y: 28.6, r: 0.8 },
    },
    // camera island plus a 2 mm margin
    keepOut: [{ x: 1.6, y: 1.6, w: 39, h: 39, r: 10.6 }],
    // as seen from the back: power on the left edge, volume on the right
    buttons: [
      { side: 'left', y: 37, h: 16 },
      { side: 'right', y: 24, h: 7 },
      { side: 'right', y: 36, h: 10 },
      { side: 'right', y: 49, h: 10 },
    ],
  });

  K.registerPhone({
    id: 'galaxy',
    label: 'Galaxy-style',
    short: 'Galaxy-style',
    w: 70.6,
    h: 147,
    t: 7.6,
    r: 9.2,
    note: 'Approximate 6.1-inch class outline, vertical camera strip. For scale only.',
    camera: {
      lenses: [{ x: 12.8, y: 12.8, r: 5.4 }, { x: 12.8, y: 25.6, r: 5.4 }, { x: 12.8, y: 38.4, r: 5.4 }],
      flash: { x: 23.6, y: 12.8, r: 1.8 },
    },
    // lens strip and flash, each plus a 2 mm margin
    keepOut: [
      { x: 5.4, y: 5.4, w: 14.8, h: 40.4, r: 7.4 },
      { x: 19.8, y: 9, w: 7.6, h: 7.6, r: 3.8 },
    ],
    buttons: [
      { side: 'left', y: 30, h: 22 },
      { side: 'left', y: 56, h: 11 },
    ],
  });

  K.PHONE_COLORS = [
    { id: 'black', label: 'Black', body: '#26272B', frame: '#3B3C41', island: '#2D2E33' },
    { id: 'white', label: 'White', body: '#EFEDE9', frame: '#D7D5D0', island: '#E6E4DF' },
    { id: 'blue', label: 'Pastel blue', body: '#C4D6EB', frame: '#ADC2DA', island: '#B9CDE4' },
    { id: 'pink', label: 'Pastel pink', body: '#F1D4D8', frame: '#DFBDC2', island: '#EACACF' },
  ];
  K.phoneColor = (id) => K.PHONE_COLORS.find((c) => c.id === id) || K.PHONE_COLORS[0];

  function lens(l, u, ring) {
    const r = l.r;
    return (
      `<circle cx="${l.x}" cy="${l.y}" r="${r}" fill="url(#${u}ring)"/>` +
      `<circle cx="${l.x}" cy="${l.y}" r="${r * (ring ? 0.8 : 0.84)}" fill="#0E0F14"/>` +
      `<circle cx="${l.x}" cy="${l.y}" r="${r * 0.56}" fill="url(#${u}glass)"/>` +
      `<circle cx="${l.x}" cy="${l.y}" r="${r * 0.22}" fill="#151a2c"/>` +
      `<ellipse cx="${l.x - r * 0.22}" cy="${l.y - r * 0.24}" rx="${r * 0.16}" ry="${r * 0.11}" fill="#fff" opacity=".45"/>`
    );
  }

  /** SVG markup for a phone back. viewBox is in mm with a small margin for the buttons. */
  K.phoneSvg = function (phone, colorId) {
    const col = K.phoneColor(colorId);
    const u = K.uid('ph');
    const body = U.rgb(col.body);
    const dark = U.luma(body) < 0.4;
    const pad = 1.6;
    const { w, h, r } = phone;
    let s = `<svg class="kx-phone-svg" viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
    s += `<defs>
      <linearGradient id="${u}b" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${U.hex(U.lighten(body, dark ? 0.06 : 0.25))}"/>
        <stop offset=".5" stop-color="${col.body}"/>
        <stop offset="1" stop-color="${U.hex(U.darken(body, dark ? 0.2 : 0.05))}"/>
      </linearGradient>
      <linearGradient id="${u}ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${dark ? '#6b6c72' : '#f6f6f7'}"/>
        <stop offset=".5" stop-color="${dark ? '#2c2d31' : '#b4b5bb'}"/>
        <stop offset="1" stop-color="${dark ? '#55565c' : '#e3e3e6'}"/>
      </linearGradient>
      <radialGradient id="${u}glass" cx=".35" cy=".3" r=".8">
        <stop offset="0" stop-color="#3a4a72"/>
        <stop offset=".6" stop-color="#151a2c"/>
        <stop offset="1" stop-color="#07080d"/>
      </radialGradient>
      <filter id="${u}is" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0.3" dy="0.6" stdDeviation="0.6" flood-opacity="${dark ? 0.6 : 0.22}"/></filter>
    </defs>`;
    (phone.buttons || []).forEach((b) => {
      const x = b.side === 'left' ? -0.9 : w - 0.4;
      s += `<rect x="${x}" y="${b.y}" width="1.3" height="${b.h}" rx="0.6" fill="${col.frame}"/>`;
    });
    s += `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="${col.frame}"/>`;
    s += `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" fill="url(#${u}b)"/>`;
    s += `<rect x="0.75" y="0.75" width="${w - 1.5}" height="${h - 1.5}" rx="${r - 0.75}" fill="none" stroke="#fff" stroke-opacity="${dark ? 0.06 : 0.35}" stroke-width="0.35"/>`;
    const cam = phone.camera || {};
    if (cam.island) {
      const i = cam.island;
      s += `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="${i.r}" fill="${col.island}" filter="url(#${u}is)"/>`;
      s += `<rect x="${i.x}" y="${i.y}" width="${i.w}" height="${i.h}" rx="${i.r}" fill="none" stroke="#fff" stroke-opacity="${dark ? 0.08 : 0.5}" stroke-width="0.3"/>`;
    }
    (cam.lenses || []).forEach((l) => (s += lens(l, u, !cam.island)));
    if (cam.flash) s += `<circle cx="${cam.flash.x}" cy="${cam.flash.y}" r="${cam.flash.r}" fill="#f4efe0" stroke="${dark ? '#55565c' : '#c9c9cc'}" stroke-width="0.35"/>`;
    if (cam.mic) s += `<circle cx="${cam.mic.x}" cy="${cam.mic.y}" r="${cam.mic.r}" fill="#0E0F14" opacity=".7"/>`;
    s += '</svg>';
    return s;
  };

  /** Distance (mm) from a device outline to the nearest keep-out zone. Negative means overlap. */
  K.phoneClearance = function (phone, dev) {
    let best = Infinity;
    (phone.keepOut || []).forEach((k) => {
      let d;
      if (dev.type === 'circle') {
        const r = dev.w / 2;
        const nx = U.clamp(dev.cx, k.x, k.x + k.w);
        const ny = U.clamp(dev.cy, k.y, k.y + k.h);
        d = Math.hypot(dev.cx - nx, dev.cy - ny) - r;
        if (dev.cx > k.x && dev.cx < k.x + k.w && dev.cy > k.y && dev.cy < k.y + k.h) d = -r;
      } else {
        const dx = Math.max(k.x - (dev.cx + dev.w / 2), dev.cx - dev.w / 2 - (k.x + k.w), 0);
        const dy = Math.max(k.y - (dev.cy + dev.h / 2), dev.cy - dev.h / 2 - (k.y + k.h), 0);
        d = dx > 0 || dy > 0 ? Math.hypot(dx, dy) : -Math.min(dev.w, dev.h) / 2;
      }
      best = Math.min(best, d);
    });
    return best;
  };
})(window.Bud);

;
// lib/forms.js
/* Form factors. One data object per form; add a new one by copying a block.
 *
 * Everything is in millimeters relative to the device center, as a function of
 * `s`, the size slider value (device width, or diameter for round forms):
 *   body(s)     -> outline: { type: 'circle' | 'rrect', w, h, r }
 *   screen(s)   -> active display: { type: 'circle' | 'rrect' | 'arch', x, y, w, h, r?, br? }
 *                  (r and br are fractions of the screen's shorter side)
 *   wordmark(s) -> { x, y, size } where the name is printed, or omit for none
 *   ring(s)     -> { outer, inner } diameters for a ring grip, optional
 *   stage       -> where the 100-unit character stage sits in the screen
 *   glass       -> 'face' (cover glass over the whole face) or 'window'
 *   profile     -> side view: { edge: top edge radius mm, dome: glass bulge mm }
 * Bezels, window sizes and radii here are exploration values, not specs.
 */
(function (K) {
  'use strict';

  // Card forms borrow the standard bank card proportions (ISO/IEC 7810 ID-1, 85.60 x 53.98 mm).
  const CARD = 85.6 / 53.98;
  K.CARD_RATIO = CARD;

  K.registerForm({
    id: 'round-full',
    label: 'Round, full screen',
    short: 'Round',
    group: 'Round',
    note: 'The whole face is the display. Biggest character, most lit pixels.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'circle', x: 0, y: 0, w: s - 2.8, h: s - 2.8 }),
    bezel: 0.6,
    glass: 'face',
    profile: { edge: 2.4, dome: 0.35 },
  });

  K.registerForm({
    id: 'round-porthole',
    label: 'Round, half screen (round window)',
    short: 'Porthole',
    group: 'Round',
    note: 'A smaller round window in a matte, fabric or colored shell. Less glass, more material, room for a name.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'circle', x: 0, y: -s * 0.07, w: s * 0.56, h: s * 0.56 }),
    wordmark: (s) => ({ x: 0, y: s * 0.33, size: s * 0.075 }),
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 2.2, dome: 0.15 },
  });

  K.registerForm({
    id: 'round-arch',
    label: 'Round, half screen (arch window)',
    short: 'Arch',
    group: 'Round',
    note: 'An arch-shaped window: the character peeks up from the sill, like a little doorway.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'arch', x: 0, y: -s * 0.06, w: s * 0.6, h: s * 0.48, br: 0.08 }),
    wordmark: (s) => ({ x: 0, y: s * 0.32, size: s * 0.075 }),
    stage: { align: 'bottom', scale: 1, dy: 4 },
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 2.2, dome: 0.15 },
  });

  K.registerForm({
    id: 'squircle-full',
    label: 'Rounded square, full screen',
    short: 'Squircle',
    group: 'Square',
    note: 'Rounded square with the whole face as display. Square pixels fill it with less waste.',
    body: (s) => ({ type: 'rrect', w: s, h: s, r: s * 0.3 }),
    screen: (s) => ({ type: 'rrect', x: 0, y: 0, w: s - 2.8, h: s - 2.8, r: (s * 0.3 - 1.4) / (s - 2.8) }),
    bezel: 0.6,
    glass: 'face',
    profile: { edge: 2.4, dome: 0.3 },
  });

  K.registerForm({
    id: 'card-window',
    label: 'Card with small round window',
    short: 'Card window',
    group: 'Card',
    note: 'Plaud-like card with a small round window. The rest of the face carries the name and material.',
    body: (s) => ({ type: 'rrect', w: s, h: s * CARD, r: s * 0.13 }),
    screen: (s) => ({ type: 'circle', x: 0, y: -s * CARD * 0.17, w: s * 0.52, h: s * 0.52 }),
    wordmark: (s) => ({ x: 0, y: s * CARD * 0.25, size: s * 0.085 }),
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 1.2, dome: 0.1 },
  });

  K.registerForm({
    id: 'card-full',
    label: 'Card, full screen',
    short: 'Card full',
    group: 'Card',
    note: 'Card with the whole face as display. Room for status text under the character.',
    body: (s) => ({ type: 'rrect', w: s, h: s * CARD, r: s * 0.13 }),
    screen: (s) => ({ type: 'rrect', x: 0, y: 0, w: s - 3, h: s * CARD - 3, r: (s * 0.13 - 1.5) / (s - 3) }),
    chrome: true,
    bezel: 0.6,
    glass: 'face',
    profile: { edge: 1.2, dome: 0.15 },
  });

  K.registerForm({
    id: 'round-ring',
    label: 'Round with ring grip',
    short: 'Ring grip',
    group: 'Round',
    note: 'A metal ring around the screen flips out as a phone grip or stand. A daily practical reason to exist.',
    body: (s) => ({ type: 'circle', w: s, h: s }),
    screen: (s) => ({ type: 'circle', x: 0, y: 0, w: s * 0.64, h: s * 0.64 }),
    ring: (s) => ({ outer: s, inner: s * 0.78 }),
    ringText: true,
    bezel: 0.7,
    glass: 'window',
    profile: { edge: 1.6, dome: 0.25, ring: true },
  });
})(window.Bud);

;
// lib/device.js
/* Device mockups: the shell (SVG), the live screen (canvas) and the side profile.
 *
 * DeviceView stacks three layers in a box sized in mm x px-per-mm:
 *   shell SVG (body, ring, screen recess)  ->  Screen canvas  ->  overlay SVG (glass glare, wordmark)
 */
(function (K) {
  'use strict';
  const U = K.util;
  const f = (n) => Math.round(n * 1000) / 1000;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* -------------------------------------------------------------------- paths */

  function rrPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    return `M ${f(x + r)} ${f(y)} H ${f(x + w - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V ${f(y + h - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)} H ${f(x + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)} V ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)} Z`;
  }
  function ellPath(cx, cy, rx, ry) {
    return `M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)} Z`;
  }
  function bodyPath(b) {
    return b.type === 'circle' ? ellPath(0, 0, b.w / 2, b.h / 2) : rrPath(-b.w / 2, -b.h / 2, b.w, b.h, b.r || 0);
  }
  function screenPath(sc, grow) {
    grow = grow || 0;
    const w = sc.w + 2 * grow;
    const h = sc.h + 2 * grow;
    const x = sc.x - w / 2;
    const y = sc.y - h / 2;
    const short = Math.min(sc.w, sc.h);
    if (sc.type === 'circle') return ellPath(sc.x, sc.y, w / 2, h / 2);
    if (sc.type === 'arch') {
      const r = Math.min(w / 2, h);
      const br = Math.max(0, (sc.br || 0) * short + grow);
      return `M ${f(x)} ${f(y + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)} V ${f(y + h - br)} A ${f(br)} ${f(br)} 0 0 1 ${f(x + w - br)} ${f(y + h)} H ${f(x + br)} A ${f(br)} ${f(br)} 0 0 1 ${f(x)} ${f(y + h - br)} Z`;
    }
    return rrPath(x, y, w, h, (sc.r || 0) * short + grow);
  }

  /* ----------------------------------------------------------------- geometry */

  function geometry(formOrId, size) {
    const form = typeof formOrId === 'string' ? K.forms.get(formOrId) || K.forms.list[0] : formOrId;
    const body = form.body(size);
    return {
      form,
      size,
      body,
      screen: form.screen(size),
      w: body.w,
      h: body.h,
      wordmark: form.wordmark ? form.wordmark(size) : null,
      ring: form.ring ? form.ring(size) : null,
      bezel: form.bezel == null ? 0.6 : form.bezel,
      pad: Math.max(3, body.w * 0.14),
    };
  }

  function screenShape(geo) {
    const sc = geo.screen;
    return { type: sc.type, r: sc.r || 0, br: sc.br || 0 };
  }

  function tones(hex, finish) {
    const c = U.rgb(hex || '#F4F1EC');
    const dark = U.luma(c) < 0.38;
    return {
      base: U.hex(c),
      lit: U.hex(U.lighten(c, finish === 'gloss' ? 0.32 : dark ? 0.1 : 0.18)),
      shade: U.hex(U.darken(c, finish === 'gloss' ? 0.14 : 0.1)),
      wall: U.hex(U.darken(c, dark ? 0.38 : 0.3)),
      ink: dark ? '#FFFFFF' : U.hex(U.darken(c, 0.66)),
      inkOpacity: dark ? 0.8 : 0.85,
      dark,
    };
  }

  function metalDefs(id, dark) {
    const stops = dark
      ? [[0, '#7c7d84'], [0.25, '#36373c'], [0.5, '#6e6f76'], [0.75, '#2b2c30'], [1, '#606167']]
      : [[0, '#fdfdfe'], [0.25, '#b9bac0'], [0.5, '#f3f3f5'], [0.75, '#a3a4ab'], [1, '#e9e9ec']];
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops.map((s) => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`;
  }

  /* ---------------------------------------------------------------- front SVG */

  function shellSvg(geo, o, u, extra) {
    const t = tones(o.shellColor, o.finish);
    const d = bodyPath(geo.body);
    const pad = geo.pad;
    const vb = `${f(-geo.w / 2 - pad)} ${f(-geo.h / 2 - pad)} ${f(geo.w + pad * 2)} ${f(geo.h + pad * 2)}`;
    const wall = Math.max(0.45, geo.w * 0.013);
    const shadow = o.shadow !== false;
    let s = `<svg class="kx-shell" viewBox="${vb}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>`;
    s += `<radialGradient id="${u}g" cx="34%" cy="24%" r="88%"><stop offset="0" stop-color="${t.lit}"/><stop offset=".55" stop-color="${t.base}"/><stop offset="1" stop-color="${t.shade}"/></radialGradient>`;
    s += `<linearGradient id="${u}rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${t.dark ? 0.3 : 0.9}"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${t.dark ? 0.55 : 0.24}"/></linearGradient>`;
    if (shadow) s += `<filter id="${u}sh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${f(geo.w * 0.03)}"/></filter>`;
    if (o.finish === 'fabric') {
      s += `<pattern id="${u}fab" width="0.9" height="0.9" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="0.9" height="0.34" fill="#000" fill-opacity="${t.dark ? 0.24 : 0.1}"/><rect y="0.45" width="0.45" height="0.45" fill="#fff" fill-opacity="${t.dark ? 0.07 : 0.16}"/></pattern>`;
    }
    if (o.finish === 'gloss') s += `<clipPath id="${u}cl"><path d="${d}"/></clipPath>`;
    if (geo.ring) {
      s += metalDefs(`${u}met`, t.dark);
      s += metalDefs(`${u}hin`, true);
    }
    s += '</defs>';
    if (shadow) s += `<path d="${d}" transform="translate(${f(geo.w * 0.015)} ${f(geo.w * 0.05)})" fill="#000" opacity="${o.shadowOpacity == null ? 0.34 : o.shadowOpacity}" filter="url(#${u}sh)"/>`;
    s += `<path d="${d}" transform="translate(0 ${f(wall)})" fill="${t.wall}"/>`;
    s += `<path d="${d}" fill="url(#${u}g)"/>`;
    if (o.finish === 'fabric') s += `<path d="${d}" fill="url(#${u}fab)"/>`;
    if (o.finish === 'gloss') {
      s += `<g clip-path="url(#${u}cl)"><ellipse cx="${f(-geo.w * 0.2)}" cy="${f(-geo.h * 0.32)}" rx="${f(geo.w * 0.44)}" ry="${f(geo.h * 0.15)}" transform="rotate(-24 ${f(-geo.w * 0.2)} ${f(-geo.h * 0.32)})" fill="#fff" opacity=".3"/></g>`;
    }
    s += `<path d="${d}" fill="none" stroke="url(#${u}rim)" stroke-width="${f(Math.max(0.3, geo.w * 0.012))}"/>`;
    if (geo.ring) s += ringSvg(geo, u);
    const recess = screenPath(geo.screen, geo.bezel);
    s += `<path d="${recess}" fill="#09090b"/>`;
    if (geo.form.glass === 'window') {
      s += `<path d="${recess}" fill="none" stroke="${t.dark ? '#000' : U.hex(U.darken(U.rgb(t.base), 0.35))}" stroke-opacity=".55" stroke-width="${f(Math.max(0.2, geo.bezel * 0.45))}"/>`;
    }
    if (extra) s += extra;
    s += '</svg>';
    return s;
  }

  function ringSvg(geo, u) {
    const R = geo.ring.outer / 2;
    const r = geo.ring.inner / 2;
    const band = R - r;
    let s = `<path d="${ellPath(0, 0, R, R)} ${ellPath(0, 0, r, r)}" fill="url(#${u}met)" fill-rule="evenodd"/>`;
    s += `<circle r="${f(R - 0.12)}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width=".25"/>`;
    s += `<circle r="${f(r + 0.12)}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".3"/>`;
    s += `<circle r="${f(r + band * 0.5)}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="${f(band * 0.22)}"/>`;
    const hw = R * 0.17;
    s += `<rect x="${f(-hw)}" y="${f(-R - 0.2)}" width="${f(hw * 2)}" height="${f(band + 0.6)}" rx="${f(band * 0.3)}" fill="url(#${u}hin)"/>`;
    s += `<line x1="${f(-hw * 0.7)}" x2="${f(hw * 0.7)}" y1="${f(-R + band * 0.5)}" y2="${f(-R + band * 0.5)}" stroke="#fff" stroke-opacity=".25" stroke-width=".25"/>`;
    return s;
  }

  function overlaySvg(geo, o, u) {
    const t = tones(o.shellColor, o.finish);
    const pad = geo.pad;
    const vb = `${f(-geo.w / 2 - pad)} ${f(-geo.h / 2 - pad)} ${f(geo.w + pad * 2)} ${f(geo.h + pad * 2)}`;
    const name = o.name ? esc(o.name) : '';
    let s = `<svg class="kx-overlay" viewBox="${vb}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>`;
    if (o.glare) {
      s += `<linearGradient id="${u}gl" x1="0" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".34" stop-color="#fff" stop-opacity=".07"/><stop offset=".35" stop-color="#fff" stop-opacity=".025"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
    }
    let arc = '';
    if (geo.ring && geo.form.ringText && name) {
      const rc = (geo.ring.outer + geo.ring.inner) / 4;
      const a0 = (150 * Math.PI) / 180;
      const a1 = (30 * Math.PI) / 180;
      const R10 = rc * 10;
      arc = `M ${f(R10 * Math.cos(a0))} ${f(R10 * Math.sin(a0))} A ${f(R10)} ${f(R10)} 0 0 0 ${f(R10 * Math.cos(a1))} ${f(R10 * Math.sin(a1))}`;
      s += `<path id="${u}arc" d="${arc}"/>`;
    }
    s += '</defs>';
    if (o.glare) {
      const gp = screenPath(geo.screen, geo.bezel);
      s += `<path d="${gp}" fill="url(#${u}gl)"/>`;
      s += `<path d="${gp}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="${f(Math.max(0.15, geo.w * 0.004))}"/>`;
    }
    const font = 'font-family="Nunito, ui-rounded, \'SF Pro Rounded\', system-ui, sans-serif" font-weight="800"';
    // Text is set in a 10x coordinate system (scale .1) so browsers do not clamp the tiny mm font size.
    if (geo.wordmark && name) {
      const wm = geo.wordmark;
      const tx = `x="${f(wm.x * 10)}" font-size="${f(wm.size * 10)}" ${font} text-anchor="middle" dominant-baseline="central" letter-spacing="${f(wm.size * 0.2)}" transform="scale(.1)"`;
      if (!t.dark) s += `<text ${tx} y="${f((wm.y + wm.size * 0.05) * 10)}" fill="#fff" opacity=".45">${name}</text>`;
      s += `<text ${tx} y="${f(wm.y * 10)}" fill="${t.ink}" opacity="${t.inkOpacity}">${name}</text>`;
    }
    if (arc) {
      const band = (geo.ring.outer - geo.ring.inner) / 2;
      s += `<text transform="scale(.1)" font-size="${f(band * 4.8)}" ${font} fill="${t.dark ? '#ffffff' : '#000000'}" opacity="${t.dark ? 0.5 : 0.4}" letter-spacing="${f(band * 0.8)}"><textPath href="#${u}arc" startOffset="50%" text-anchor="middle" dominant-baseline="central">${name}</textPath></text>`;
    }
    s += '</svg>';
    return s;
  }

  /** Static thumbnail: shell plus a tiny face glyph in the window. */
  function thumbSvg(formId, o) {
    o = Object.assign({ size: 44, shellColor: '#F4F1EC', finish: 'matte', accent: '#2FE0B5' }, o || {});
    const geo = geometry(formId, o.size);
    geo.pad = 1.5;
    const sc = geo.screen;
    const short = Math.min(sc.w, sc.h);
    const cy = sc.type === 'arch' ? sc.y + sc.h * 0.22 : sc.y;
    const ex = short * 0.16;
    const er = Math.max(0.6, short * 0.065);
    let extra = `<g fill="${o.accent}"><ellipse cx="${f(sc.x - ex)}" cy="${f(cy)}" rx="${f(er)}" ry="${f(er * 1.35)}"/><ellipse cx="${f(sc.x + ex)}" cy="${f(cy)}" rx="${f(er)}" ry="${f(er * 1.35)}"/></g>`;
    if (geo.wordmark) {
      const wm = geo.wordmark;
      extra += `<rect x="${f(wm.x - wm.size * 1.3)}" y="${f(wm.y - wm.size * 0.3)}" width="${f(wm.size * 2.6)}" height="${f(wm.size * 0.6)}" rx="${f(wm.size * 0.3)}" fill="${tones(o.shellColor).ink}" opacity=".35"/>`;
    }
    return shellSvg(geo, Object.assign({}, o, { shadow: false }), K.uid('t'), extra).replace('preserveAspectRatio="none"', 'preserveAspectRatio="xMidYMid meet"');
  }

  /* ------------------------------------------------------------- side profile */

  /**
   * Side profile on the phone back, true proportions.
   * o.view: 'full' (whole width) or 'detail' (magnified right edge). o.labels: dimension text on/off.
   */
  function sideSvg(formOrId, size, o) {
    o = Object.assign({ thickness: 4, phoneT: 7.8, labels: true, view: 'full', shellColor: '#F4F1EC', phoneColor: 'black' }, o || {});
    // Drawn in 0.1 mm units: browsers clamp tiny SVG font sizes, so text needs a bigger coordinate system.
    const z = (v) => f(v * 10);
    const geo = geometry(formOrId, size);
    const prof = geo.form.profile || {};
    const L = geo.w;
    const T = o.thickness;
    const e = U.clamp(prof.edge || 1.5, 0.3, T * 0.62);
    const dome = prof.dome || 0;
    const labels = o.labels;
    const detail = o.view === 'detail';
    const t = tones(o.shellColor, o.finish);
    const pc = K.phoneColor(o.phoneColor);
    const over = T > 5.0001;
    const sw = geo.form.glass === 'face' ? L - e * 1.4 : geo.screen.w + geo.bezel * 2;
    const sx0 = geo.screen.x - sw / 2;
    const sx1 = sx0 + sw;

    let vx;
    let vy;
    let vw;
    let vh;
    if (detail) {
      vx = L / 2 - 9;
      vw = 15.5;
      vy = -(Math.max(T, 6) + 1.8);
      vh = -vy + 2.4;
    } else {
      const sideM = labels ? 3 : 2;
      const right = labels ? 12 : 2;
      vx = -L / 2 - sideM;
      vw = L + sideM + right;
      vy = -(Math.max(T, 6) + (labels ? 1.6 : 0.8));
      vh = -vy + (labels ? 6.6 : 2.2);
    }
    const slabH = detail ? 2.4 : labels ? 2.2 : Math.min(o.phoneT, 2);
    let s = `<svg class="kx-side${over ? ' over' : ''}${detail ? ' detail' : ''}" viewBox="${z(vx)} ${z(vy)} ${z(vw)} ${z(vh)}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Side profile, ${T.toFixed(1)} millimeters thick">`;
    s += `<rect class="phone" x="${z(vx)}" y="0" width="${z(vw)}" height="${z(slabH)}" fill="${pc.body}"/>`;
    s += `<line x1="${z(vx)}" x2="${z(vx + vw)}" y1="0" y2="0" stroke="${pc.frame}" stroke-width="3.5"/>`;
    // device body (dome follows the glass)
    let d = `M ${z(-L / 2)} 0 V ${z(-T + e)} Q ${z(-L / 2)} ${z(-T)} ${z(-L / 2 + e)} ${z(-T)}`;
    if (dome > 0) d += ` H ${z(sx0)} Q ${z((sx0 + sx1) / 2)} ${z(-T - dome * 2)} ${z(sx1)} ${z(-T)}`;
    d += ` H ${z(L / 2 - e)} Q ${z(L / 2)} ${z(-T)} ${z(L / 2)} ${z(-T + e)} V 0 Z`;
    s += `<path d="${d}" fill="${t.base}" stroke="${t.wall}" stroke-width="${detail ? 1.4 : 2.5}"/>`;
    // glass band
    const gT = Math.min(0.7, T * 0.16);
    s += `<path d="M ${z(sx0)} ${z(-T + gT)} H ${z(sx1)} V ${z(-T)} ${dome > 0 ? `Q ${z((sx0 + sx1) / 2)} ${z(-T - dome * 2)} ${z(sx0)} ${z(-T)}` : `H ${z(sx0)}`} Z" fill="#111114" opacity=".9"/>`;
    if (prof.ring) {
      const band = (geo.ring.outer - geo.ring.inner) / 2;
      const rh = Math.max(0.6, T * 0.2);
      s += `<rect x="${z(-L / 2 + 0.2)}" y="${z(-T - 0.25)}" width="${z(band)}" height="${z(rh)}" rx="3" fill="#b9bac0"/>`;
      s += `<rect x="${z(L / 2 - band - 0.2)}" y="${z(-T - 0.25)}" width="${z(band)}" height="${z(rh)}" rx="3" fill="#b9bac0"/>`;
    }
    // 4 mm target and 5 mm limit for the first version (from the Oct 11 hardware discussion)
    s += `<line class="ref5" x1="${z(vx)}" x2="${z(vx + vw)}" y1="-40" y2="-40"/>`;
    s += `<line class="ref6" x1="${z(vx)}" x2="${z(vx + vw)}" y1="-50" y2="-50"/>`;
    if (labels) {
      const lx = L / 2 + (detail ? 2 : 3);
      const tick = detail ? 0.5 : 0.8;
      s += `<line class="dim" x1="${z(lx)}" x2="${z(lx)}" y1="0" y2="${z(-T)}"/>`;
      s += `<line class="dim" x1="${z(lx - tick)}" x2="${z(lx + tick)}" y1="0" y2="0"/><line class="dim" x1="${z(lx - tick)}" x2="${z(lx + tick)}" y1="${z(-T)}" y2="${z(-T)}"/>`;
      s += `<text class="lbl val${over ? ' bad' : ''}" x="${z(lx + (detail ? 0.8 : 1.2))}" y="${z(-T / 2 + (detail ? 0.45 : 0.75))}">${T.toFixed(1)} mm</text>`;
      if (detail) {
        s += `<text class="lbl" x="${z(vx + 0.6)}" y="${z(1.7)}">phone back</text>`;
      } else {
        const by = vh + vy - 1.2;
        s += `<line class="dim" x1="${z(-L / 2)}" x2="${z(L / 2)}" y1="${z(by)}" y2="${z(by)}"/>`;
        s += `<line class="dim" x1="${z(-L / 2)}" x2="${z(-L / 2)}" y1="${z(by - 0.8)}" y2="${z(by + 0.8)}"/><line class="dim" x1="${z(L / 2)}" x2="${z(L / 2)}" y1="${z(by - 0.8)}" y2="${z(by + 0.8)}"/>`;
        s += `<text class="lbl" x="0" y="${z(by - 0.7)}" text-anchor="middle" paint-order="stroke" stroke="var(--surface)" stroke-width="6">${f(L)} mm wide</text>`;
      }
    }
    s += '</svg>';
    return s;
  }

  /* --------------------------------------------------------------- DeviceView */

  class DeviceView {
    constructor(host, opts) {
      opts = opts || {};
      this.el = document.createElement('div');
      this.el.className = 'kx-device';
      this.shellEl = document.createElement('div');
      this.shellEl.className = 'kx-layer';
      this.screenEl = document.createElement('div');
      this.screenEl.className = 'kx-screen';
      this.overEl = document.createElement('div');
      this.overEl.className = 'kx-layer kx-over';
      this.el.append(this.shellEl, this.screenEl, this.overEl);
      host.appendChild(this.el);
      this.o = {};
      this.screen = opts.live === false ? null : new K.Screen(this.screenEl, opts.screenOpts || {});
      this.update(opts);
    }

    update(patch) {
      Object.assign(this.o, patch);
      const o = this.o;
      const geo = geometry(o.form || 'round-full', o.size || 44);
      this.geo = geo;
      const ppm = o.ppm || 3;
      this.el.style.width = `${f(geo.w * ppm)}px`;
      this.el.style.height = `${f(geo.h * ppm)}px`;
      const key = [geo.form.id, o.size, o.shellColor, o.finish, o.name, o.glare, o.shadow].join('|');
      if (key !== this._key) {
        this._key = key;
        const u = K.uid('d');
        this.shellEl.innerHTML = shellSvg(geo, o, u);
        this.overEl.innerHTML = overlaySvg(geo, o, u + 'o');
        const pl = (-geo.pad / geo.w) * 100;
        const pt = (-geo.pad / geo.h) * 100;
        const pw = ((geo.w + 2 * geo.pad) / geo.w) * 100;
        const ph = ((geo.h + 2 * geo.pad) / geo.h) * 100;
        [this.shellEl, this.overEl].forEach((el) => {
          el.style.left = `${pl}%`;
          el.style.top = `${pt}%`;
          el.style.width = `${pw}%`;
          el.style.height = `${ph}%`;
        });
        const sc = geo.screen;
        this.screenEl.style.left = `${((sc.x - sc.w / 2 + geo.w / 2) / geo.w) * 100}%`;
        this.screenEl.style.top = `${((sc.y - sc.h / 2 + geo.h / 2) / geo.h) * 100}%`;
        this.screenEl.style.width = `${(sc.w / geo.w) * 100}%`;
        this.screenEl.style.height = `${(sc.h / geo.h) * 100}%`;
      }
      if (this.screen) {
        this.screen.set(Object.assign({ shape: screenShape(geo), stage: geo.form.stage || {}, chrome: !!geo.form.chrome, name: o.name || '' }, o.screen || {}));
      }
      return this;
    }

    destroy() {
      if (this.screen) this.screen.destroy();
      this.el.remove();
    }
  }

  K.Device = { geometry, screenShape, screenPath, bodyPath, shellSvg, overlaySvg, thumbSvg, sideSvg, tones, DeviceView, esc };
})(window.Bud);

;
// lib/view3d.js
/* 3D view: the device on the phone back as a 3D model you can drag around.
 *
 * Uses three.js, loaded from cdnjs the first time 3D is opened (the rest of the explorer
 * stays offline-friendly). The body is the form outline extruded to the thickness slider
 * with the side profile's edge radius as a bevel; the face is the shell color, finish
 * and printed name; the screen is a live texture from a hidden Screen, so the character
 * keeps animating. Phone outlines are the same approximate ones as the 2D view.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const D = K.Device;
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.149.0/three.min.js';

  let loading = null;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = THREE_URL;
        s.async = true;
        s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error('three.js did not start')));
        s.onerror = () => {
          loading = null;
          reject(new Error('three.js could not be loaded'));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  // Camera presets: yaw/pitch in radians, distance as a multiple of the fit distance.
  const PRESETS = {
    angle: { label: '3/4', yaw: -0.62, pitch: 0.3, zoom: 0.62 },
    back: { label: 'Back', yaw: 0, pitch: 0, zoom: 0.95 },
    side: { label: 'Side', yaw: -1.52, pitch: 0.04, zoom: 0.5 },
    edge: { label: 'Edge close-up', yaw: -1.2, pitch: 0.14, zoom: 0.24 },
  };

  const FINISH = {
    matte: { roughness: 0.78, clearcoat: 0, sheen: 0 },
    fabric: { roughness: 0.95, clearcoat: 0, sheen: 1 },
    gloss: { roughness: 0.32, clearcoat: 0.7, sheen: 0 },
  };

  function roundedRect(THREE, x, y, w, h, r) {
    r = Math.max(0.01, Math.min(r, w / 2, h / 2));
    const s = new THREE.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  /** Body outline inset by the bevel (three.js grows the bevel back out). y is up in 3D. */
  function bodyShape(THREE, body, inset) {
    if (body.type === 'circle') {
      const s = new THREE.Shape();
      s.absarc(0, 0, body.w / 2 - inset, 0, Math.PI * 2, false);
      return s;
    }
    return roundedRect(THREE, -body.w / 2 + inset, -body.h / 2 + inset, body.w - 2 * inset, body.h - 2 * inset, (body.r || 0) - inset);
  }

  /** Screen outline (2D geometry is y-down, so y flips). */
  function screenShape(THREE, sc, grow) {
    const w = sc.w + 2 * grow;
    const h = sc.h + 2 * grow;
    const cx = sc.x;
    const cy = -sc.y;
    const short = Math.min(sc.w, sc.h);
    if (sc.type === 'circle') {
      const s = new THREE.Shape();
      s.absellipse(cx, cy, w / 2, h / 2, 0, Math.PI * 2, false, 0);
      return s;
    }
    if (sc.type === 'arch') {
      const r = Math.min(w / 2, h);
      const x0 = cx - w / 2;
      const y0 = cy - h / 2;
      const br = Math.max(0.01, (sc.br || 0) * short + grow);
      const s = new THREE.Shape();
      s.moveTo(x0 + br, y0);
      s.lineTo(x0 + w - br, y0);
      s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + br);
      s.lineTo(x0 + w, y0 + h - r);
      s.absarc(cx, y0 + h - r, r, 0, Math.PI, false);
      s.lineTo(x0, y0 + br);
      s.quadraticCurveTo(x0, y0, x0 + br, y0);
      return s;
    }
    return roundedRect(THREE, cx - w / 2, cy - h / 2, w, h, (sc.r || 0) * short + grow);
  }

  /** A soft studio environment for reflections (what three's RoomEnvironment does, inline). */
  function studio(THREE, renderer) {
    const room = new THREE.Scene();
    const box = new THREE.BoxGeometry(1, 1, 1);
    const walls = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: 0x24262b, side: THREE.BackSide }));
    walls.scale.set(30, 18, 30);
    room.add(walls);
    const panel = (x, y, z, sx, sy, sz, v) => {
      const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(v, v, v) }));
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      room.add(m);
    };
    panel(-7, 7, 6, 8, 0.3, 6, 4.5);
    panel(9, 3, 4, 0.3, 6, 7, 2.2);
    panel(0, 2, -14, 12, 6, 0.3, 1);
    panel(0, -8.8, 0, 14, 0.3, 14, 0.3);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tex = pmrem.fromScene(room, 0.035).texture;
    pmrem.dispose();
    return tex;
  }

  function disposeTree(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        ['map', 'emissiveMap', 'roughnessMap', 'bumpMap'].forEach((k) => {
          if (m[k] && m[k] !== obj.userData.keepTexture) m[k].dispose();
        });
        m.dispose();
      });
    });
  }

  class View3D {
    /** opts.controls: false turns off drag and wheel (for scroll-driven pages, which set the camera themselves). */
    constructor(host, opts) {
      this.host = host;
      this.opts = Object.assign({ controls: true }, opts || {});
      this.focus = 0; // camera target: 0 = the device, 1 = the middle of the phone
      this.el = document.createElement('div');
      this.el.className = 'v3d-canvas';
      host.appendChild(this.el);
      this.preset('angle', true);
      this.ready = false;
      this.active = false;
      this.o = null;
      this.keys = {};
      // hidden live screen that feeds the 3D screen texture
      this.srcHost = document.createElement('div');
      this.srcHost.setAttribute('aria-hidden', 'true');
      this.srcHost.style.cssText = 'position:fixed;left:-12000px;top:0;width:360px;height:360px;pointer-events:none;';
      document.body.appendChild(this.srcHost);
      this.screen = new K.Screen(this.srcHost, { manual: true, bloom: false });
    }

    /** Aim the camera directly: yaw/pitch in radians, zoom as a multiple of the fit distance. */
    setView(yaw, pitch, zoom, instant) {
      this.yawT = yaw;
      this.pitchT = pitch;
      this.zoomT = zoom;
      if (instant) {
        this.yaw = yaw;
        this.pitch = pitch;
        this.zoom = zoom;
      }
    }

    preset(name, instant) {
      const p = PRESETS[name] || PRESETS.angle;
      this.yawT = p.yaw;
      this.pitchT = p.pitch;
      this.zoomT = p.zoom;
      if (instant) {
        this.yaw = p.yaw;
        this.pitch = p.pitch;
        this.zoom = p.zoom;
      }
    }

    async start() {
      if (!this.ready) {
        const THREE = await loadThree();
        this.init(THREE);
        this.ready = true;
      }
      this.active = true;
      if (this.o) this.update(this.o);
      cancelAnimationFrame(this.raf);
      this.loop();
    }

    stop() {
      this.active = false;
      cancelAnimationFrame(this.raf);
    }

    init(THREE) {
      this.THREE = THREE;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.cssText = `display:block;width:100%;height:100%;touch-action:${this.opts.controls ? 'none' : 'pan-y'};`;
      this.el.appendChild(renderer.domElement);
      this.renderer = renderer;

      const scene = new THREE.Scene();
      scene.environment = studio(THREE, renderer);
      this.scene = scene;
      this.camera = new THREE.PerspectiveCamera(28, 1, 1, 5000);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x4a4e5a, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.5);
      key.position.set(-90, 120, 170);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      const sc = key.shadow.camera;
      sc.left = -110;
      sc.right = 110;
      sc.top = 110;
      sc.bottom = -110;
      sc.near = 10;
      sc.far = 600;
      key.shadow.bias = -0.0004;
      key.shadow.normalBias = 0.03;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xc8dcff, 0.55);
      rim.position.set(140, -50, 60);
      scene.add(rim);

      this.rig = new THREE.Group();
      scene.add(this.rig);
      this.phone = new THREE.Group();
      this.device = new THREE.Group();
      this.rig.add(this.phone, this.device);

      this.screenTex = new THREE.CanvasTexture(this.screen.canvas);
      this.screenTex.encoding = THREE.sRGBEncoding;
      this.screenTex.minFilter = THREE.LinearFilter;
      this.screenTex.generateMipmaps = false;
      this.texCanvasW = this.screen.canvas.width;

      if (this.opts.controls) this.bindControls();
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.el);
      this.resize();
    }

    resize() {
      if (!this.renderer) return;
      const r = this.el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      // shiftX moves the picture sideways (fraction of the width) without changing the perspective,
      // so a page can keep the phone clear of its captions
      const sx = this.shiftX || 0;
      const sy = this.shiftY || 0; // positive moves the picture down
      if (sx || sy) this.camera.setViewOffset(w, h, -sx * w, -sy * h, w, h);
      else this.camera.clearViewOffset();
      this.camera.updateProjectionMatrix();
    }

    bindControls() {
      const el = this.renderer.domElement;
      const pts = new Map();
      let pinch = 0;
      el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = Math.hypot(a.x - b.x, a.y - b.y);
        }
      });
      el.addEventListener('pointermove', (e) => {
        const p = pts.get(e.pointerId);
        if (!p) return;
        if (pts.size === 1) {
          this.yawT -= (e.clientX - p.x) * 0.0065;
          this.pitchT = U.clamp(this.pitchT + (e.clientY - p.y) * 0.0065, -1.45, 1.45);
        }
        p.x = e.clientX;
        p.y = e.clientY;
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (pinch) this.zoomT = U.clamp(this.zoomT * (pinch / d), 0.16, 2.2);
          pinch = d;
        }
      });
      const end = (e) => {
        pts.delete(e.pointerId);
        pinch = 0;
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener(
        'wheel',
        (e) => {
          e.preventDefault();
          this.zoomT = U.clamp(this.zoomT * Math.exp(e.deltaY * 0.0012), 0.16, 2.2);
        },
        { passive: false }
      );
      el.addEventListener('dblclick', () => this.preset('angle'));
    }

    /** o: { phone, phoneColor, form, size, thickness, shellColor, finish, name, place: {cx, cy}, screen } */
    update(o) {
      this.o = o;
      const geo = D.geometry(o.form, o.size);
      const sc = geo.screen;
      // keep the hidden screen's aspect equal to the screen's
      const hostW = 360;
      const hostH = Math.round((hostW * sc.h) / sc.w);
      if (this.srcHost.style.height !== `${hostH}px`) this.srcHost.style.height = `${hostH}px`;
      this.screen.set(Object.assign({}, o.screen, { shape: D.screenShape(geo), stage: geo.form.stage || {}, chrome: !!geo.form.chrome, name: o.name || '', glow: false }));
      if (!this.ready) return;
      const ph = K.phones.get(o.phone);
      const phoneKey = [o.phone, o.phoneColor].join('|');
      if (phoneKey !== this.keys.phone) {
        this.keys.phone = phoneKey;
        this.buildPhone(ph, o.phoneColor);
      }
      const devKey = [o.form, o.size, o.thickness, o.shellColor, o.finish, o.name].join('|');
      if (devKey !== this.keys.device) {
        this.keys.device = devKey;
        this.buildDevice(geo, o);
      }
      const pl = o.place || { cx: ph.w / 2, cy: ph.h / 2 };
      this.device.position.set(pl.cx - ph.w / 2, -(pl.cy - ph.h / 2), 0);
      this.target = { x: this.device.position.x, y: this.device.position.y, z: o.thickness / 2 };
      this.center = { x: 0, y: 0, z: o.thickness / 2 };
      this.fit = (ph.h * 0.62) / Math.tan(((this.camera.fov / 2) * Math.PI) / 180);
    }

    buildPhone(ph, colorId) {
      const THREE = this.THREE;
      disposeTree(this.phone);
      this.phone.clear();
      const col = K.phoneColor(colorId);
      const bev = 1;
      const shape = roundedRect(THREE, -ph.w / 2 + bev, -ph.h / 2 + bev, ph.w - 2 * bev, ph.h - 2 * bev, ph.r - bev);
      const g = new THREE.ExtrudeGeometry(shape, { depth: ph.t - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 24 });
      g.translate(0, 0, bev - ph.t);
      const backMat = new THREE.MeshPhysicalMaterial({ color: col.body, roughness: 0.55, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.35, envMapIntensity: 0.6 });
      const frameMat = new THREE.MeshStandardMaterial({ color: col.frame, roughness: 0.4, metalness: 0.55, envMapIntensity: 0.8 });
      const body = new THREE.Mesh(g, [backMat, frameMat]);
      body.receiveShadow = true;
      body.castShadow = true;
      this.phone.add(body);
      // display side of the phone, facing away
      const front = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.15, metalness: 0.1 }));
      front.rotation.y = Math.PI;
      front.position.z = -ph.t - 0.02;
      this.phone.add(front);
      // the phone's own display, inset from the edge; pages can light it with setFrontScreen()
      const inset = 1.7;
      const scrShape = roundedRect(THREE, -ph.w / 2 + inset, -ph.h / 2 + inset, ph.w - 2 * inset, ph.h - 2 * inset, ph.r - inset);
      this.frontMat = new THREE.MeshBasicMaterial({ color: 0x07080b });
      const display = new THREE.Mesh(new THREE.ShapeGeometry(scrShape, 24), this.frontMat);
      display.rotation.y = Math.PI;
      display.position.z = -ph.t - 0.06;
      this.phone.add(display);
      this.frontSize = { w: ph.w - 2 * inset, h: ph.h - 2 * inset };
      if (this.frontCanvas) this.setFrontScreen(this.frontCanvas);
      (ph.buttons || []).forEach((b) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, b.h, ph.t * 0.32), frameMat);
        m.position.set((b.side === 'left' ? -1 : 1) * (ph.w / 2 + 0.25), ph.h / 2 - (b.y + b.h / 2), -ph.t / 2);
        this.phone.add(m);
      });
      // the printed back (camera island, lenses) as a texture once the SVG rasterizes
      const svg = K.phoneSvg(ph, colorId).replace(/viewBox="[^"]*"/, `viewBox="0 0 ${ph.w} ${ph.h}" width="${Math.round(ph.w * 14)}" height="${Math.round(ph.h * 14)}"`);
      const img = new Image();
      img.onload = () => {
        if (this.keys.phone !== [ph.id, colorId].join('|')) return;
        const cv = document.createElement('canvas');
        cv.width = img.width;
        cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        const tex = new THREE.CanvasTexture(cv);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        tex.repeat.set(1 / ph.w, 1 / ph.h);
        tex.offset.set(0.5, 0.5);
        backMat.map = tex;
        backMat.color.set(0xffffff);
        backMat.needsUpdate = true;
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /** Light the phone's own display (its front) with a canvas, such as a lock screen. */
    setFrontScreen(canvas) {
      this.frontCanvas = canvas;
      if (!this.frontMat || !this.THREE) return;
      const THREE = this.THREE;
      let tex = this.frontMat.map;
      if (!tex || tex.image !== canvas) {
        if (tex) tex.dispose();
        tex = new THREE.CanvasTexture(canvas);
        tex.encoding = THREE.sRGBEncoding;
        tex.anisotropy = 4;
        // shape UVs are in mm, centered on the phone
        tex.repeat.set(1 / this.frontSize.w, 1 / this.frontSize.h);
        tex.offset.set(0.5, 0.5);
        this.frontMat.map = tex;
        this.frontMat.color.set(0xffffff);
        this.frontMat.needsUpdate = true;
      }
      tex.needsUpdate = true;
    }

    faceTexture(geo, o) {
      const THREE = this.THREE;
      const pxmm = 22;
      const W = geo.w;
      const H = geo.h;
      const cv = document.createElement('canvas');
      cv.width = Math.round(W * pxmm);
      cv.height = Math.round(H * pxmm);
      const c = cv.getContext('2d');
      const t = D.tones(o.shellColor, o.finish);
      c.fillStyle = t.base;
      c.fillRect(0, 0, cv.width, cv.height);
      if (o.finish === 'fabric') {
        const p = document.createElement('canvas');
        p.width = p.height = 16;
        const pc = p.getContext('2d');
        pc.strokeStyle = t.dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
        pc.lineWidth = 3;
        pc.beginPath();
        pc.moveTo(-4, 4);
        pc.lineTo(4, -4);
        pc.moveTo(0, 16);
        pc.lineTo(16, 0);
        pc.moveTo(12, 20);
        pc.lineTo(20, 12);
        pc.stroke();
        c.fillStyle = c.createPattern(p, 'repeat');
        c.fillRect(0, 0, cv.width, cv.height);
      }
      c.save();
      c.setTransform(pxmm, 0, 0, pxmm, (W / 2) * pxmm, (H / 2) * pxmm);
      c.fillStyle = '#060607';
      c.fill(new Path2D(D.screenPath(geo.screen, geo.bezel)));
      c.restore();
      if (geo.wordmark && o.name) {
        const wm = geo.wordmark;
        c.font = `800 ${Math.round(wm.size * pxmm)}px Nunito, ui-rounded, system-ui, sans-serif`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.globalAlpha = t.inkOpacity;
        c.fillStyle = t.ink;
        c.fillText(o.name, (wm.x + W / 2) * pxmm, (wm.y + H / 2) * pxmm);
        c.globalAlpha = 1;
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = 4;
      tex.repeat.set(1 / W, 1 / H);
      tex.offset.set(0.5, 0.5);
      return tex;
    }

    buildDevice(geo, o) {
      const THREE = this.THREE;
      disposeTree(this.device);
      this.device.clear();
      const T = o.thickness;
      const prof = geo.form.profile || {};
      const e = U.clamp(prof.edge || 1.5, 0.3, T * 0.45);
      const fin = FINISH[o.finish] || FINISH.matte;
      const shell = new THREE.Color(o.shellColor);
      const matProps = { roughness: fin.roughness, metalness: 0, clearcoat: fin.clearcoat, clearcoatRoughness: 0.18, sheen: fin.sheen, sheenRoughness: 0.75, sheenColor: shell.clone().lerp(new THREE.Color(0xffffff), 0.4) };
      const faceMat = new THREE.MeshPhysicalMaterial(Object.assign({ map: this.faceTexture(geo, o) }, matProps));
      const sideMat = new THREE.MeshPhysicalMaterial(Object.assign({ color: shell }, matProps));
      const g = new THREE.ExtrudeGeometry(bodyShape(THREE, geo.body, e), {
        depth: Math.max(0.05, T - 2 * e),
        bevelEnabled: true,
        bevelThickness: e,
        bevelSize: e,
        bevelSegments: 8,
        curveSegments: geo.body.type === 'circle' ? 96 : 40,
      });
      g.translate(0, 0, e);
      const body = new THREE.Mesh(g, [faceMat, sideMat]);
      body.castShadow = true;
      body.receiveShadow = true;
      this.device.add(body);

      // live screen
      const sc = geo.screen;
      const screenMat = new THREE.MeshBasicMaterial({ map: this.screenTex, transparent: true, toneMapped: false });
      const scr = new THREE.Mesh(new THREE.ShapeGeometry(screenShape(THREE, sc, 0), 64), screenMat);
      this.screenTex.repeat.set(1 / sc.w, 1 / sc.h);
      this.screenTex.offset.set(-(sc.x - sc.w / 2) / sc.w, -(-sc.y - sc.h / 2) / sc.h);
      scr.position.z = T + 0.03;
      this.device.add(scr);
      this.device.userData.keepTexture = this.screenTex;

      // cover glass for reflections
      const glass = new THREE.Mesh(
        new THREE.ShapeGeometry(screenShape(THREE, sc, geo.bezel), 64),
        new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, transparent: true, opacity: 0.14, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 })
      );
      glass.position.z = T + 0.07;
      this.device.add(glass);

      // flip-out ring for the ring grip
      if (geo.ring) {
        const R = geo.ring.outer / 2;
        const r = geo.ring.inner / 2;
        const ring = new THREE.Shape();
        ring.absarc(0, 0, R - 0.15, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, r, 0, Math.PI * 2, true);
        ring.holes.push(hole);
        const dark = D.tones(o.shellColor).dark;
        const metal = new THREE.MeshStandardMaterial({ color: dark ? 0x4a4b50 : 0xd9dade, metalness: 1, roughness: 0.3 });
        const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.25, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 3, curveSegments: 96 });
        const rm = new THREE.Mesh(rg, metal);
        rm.position.z = T - 0.05;
        rm.castShadow = true;
        this.device.add(rm);
        const hinge = new THREE.Mesh(new THREE.BoxGeometry(R * 0.34, (R - r) + 0.6, 0.9), metal);
        hinge.position.set(0, R - (R - r) / 2, T + 0.25);
        this.device.add(hinge);
      }
    }

    loop() {
      if (!this.active) return;
      this.raf = requestAnimationFrame(() => this.loop());
      if (!this.renderer || !this.target) return;
      const t = performance.now() / 1000;
      this.screen.render(t);
      if (this.screen.canvas.width !== this.texCanvasW) {
        // the source canvas was resized: a texture has to be re-created for the new size
        this.texCanvasW = this.screen.canvas.width;
        const old = this.screenTex;
        const tex = new this.THREE.CanvasTexture(this.screen.canvas);
        tex.encoding = old.encoding;
        tex.minFilter = old.minFilter;
        tex.generateMipmaps = false;
        tex.repeat.copy(old.repeat);
        tex.offset.copy(old.offset);
        this.device.traverse((m) => {
          if (m.material && m.material.map === old) m.material.map = tex;
        });
        this.device.userData.keepTexture = tex;
        this.screenTex = tex;
        old.dispose();
      }
      this.screenTex.needsUpdate = true;
      const k = 0.16;
      this.yaw += (this.yawT - this.yaw) * k;
      this.pitch += (this.pitchT - this.pitch) * k;
      this.zoom += (this.zoomT - this.zoom) * k;
      const dist = this.fit * this.zoom;
      const f = U.clamp(this.focus || 0);
      const c0 = this.center || this.target;
      const tg = { x: U.lerp(this.target.x, c0.x, f), y: U.lerp(this.target.y, c0.y, f), z: this.target.z };
      this.cur = this.cur || Object.assign({}, tg);
      this.cur.x += (tg.x - this.cur.x) * k;
      this.cur.y += (tg.y - this.cur.y) * k;
      this.cur.z += (tg.z - this.cur.z) * k;
      const cp = Math.cos(this.pitch);
      this.camera.position.set(this.cur.x + dist * cp * Math.sin(this.yaw), this.cur.y + dist * Math.sin(this.pitch), this.cur.z + dist * cp * Math.cos(this.yaw));
      this.camera.lookAt(this.cur.x, this.cur.y, this.cur.z);
      this.renderer.render(this.scene, this.camera);
    }
  }

  View3D.PRESETS = PRESETS;
  View3D.load = loadThree;
  K.View3D = View3D;
})(window.Bud);

;