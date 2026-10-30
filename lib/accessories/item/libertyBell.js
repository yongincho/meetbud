/* Liberty Bell, held: a piece found at Liberty Bell Center, Philadelphia (find 47: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink, gleam } = K.AccKit;

  // The Liberty Bell: a bronze bell hung from its yoke, crack and all.
  function libertyBell(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.3);
    paint(ctx, env, P.woodDark, () => U.rr(ctx, -5.4, -9.4, 10.8, 1.8, 0.7));
    ctx.translate(0, -7.6);
    ctx.rotate(sway(env, 1.6) * 0.08);
    paint(ctx, env, P.bronze, () => {
      ctx.arc(0, 0.6, 1, Math.PI, 0);
      ctx.moveTo(-2.6, 1.6);
      ctx.bezierCurveTo(-2.8, -0.4, 2.8, -0.4, 2.6, 1.6);
      ctx.bezierCurveTo(3, 5, 3.6, 8.6, 5.4, 10.4);
      ctx.quadraticCurveTo(5.8, 11.6, 4.6, 11.8);
      ctx.lineTo(-4.6, 11.8);
      ctx.quadraticCurveTo(-5.8, 11.6, -5.4, 10.4);
      ctx.bezierCurveTo(-3.6, 8.6, -3, 5, -2.6, 1.6);
    });
    paint(ctx, env, U.darken(P.bronze, 0.22), () => {
      ctx.rect(-3.1, 4, 6.2, 0.55);
      U.rr(ctx, -5.6, 10.6, 11.2, 1.2, 0.5);
    });
    ink(ctx, env, U.rgb('#3B2412'), 0.4, () => {
      ctx.moveTo(-0.6, 11.6);
      ctx.lineTo(0, 9.6);
      ctx.lineTo(-0.5, 8.2);
      ctx.lineTo(0.3, 6.4);
      ctx.lineTo(-0.1, 4.8);
    });
    gleam(ctx, env, -1.6, 5.6, 0.5, 2.6, 0.2, 0.35);
    ctx.restore();
  }

  K.registerFind(47, { id: 'libertyBell', label: 'Liberty Bell', slot: 'item', place: { name: 'Liberty Bell Center', city: 'Philadelphia', lat: 39.9497, lon: -75.1502, radius: 400 } }, libertyBell);
})(window.Bud);
