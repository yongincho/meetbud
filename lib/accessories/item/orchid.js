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
