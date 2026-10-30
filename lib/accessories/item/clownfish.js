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
