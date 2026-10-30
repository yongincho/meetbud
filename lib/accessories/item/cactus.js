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
