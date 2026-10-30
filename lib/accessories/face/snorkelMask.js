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
