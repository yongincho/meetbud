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
