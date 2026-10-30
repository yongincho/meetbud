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
