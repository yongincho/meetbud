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
