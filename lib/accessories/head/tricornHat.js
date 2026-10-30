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
