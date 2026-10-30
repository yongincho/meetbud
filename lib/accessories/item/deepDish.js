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
