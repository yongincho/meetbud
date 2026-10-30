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
