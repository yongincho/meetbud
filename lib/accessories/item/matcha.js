/* Matcha, held: a piece found at Arashiyama Bamboo Grove, Kyoto (find 71: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, paint, ink, steamingCup } = K.AccKit;

  // Arashiyama: a bowl of frothy matcha, its bamboo whisk leaning in.
  function matcha(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      ink(ctx, env, U.rgb('#E9D9B0'), 0.6, () => {
        ctx.moveTo(3.4, -6.6);
        ctx.lineTo(1.6, -2.6);
      });
      paint(ctx, env, U.rgb('#3E4F45'), () => {
        ctx.moveTo(-5.4, -3);
        ctx.lineTo(5.4, -3);
        ctx.bezierCurveTo(5.2, 3, 3, 4.6, 0, 4.6);
        ctx.bezierCurveTo(-3, 4.6, -5.2, 3, -5.4, -3);
      });
      paint(ctx, env, U.rgb('#2C3A32'), () => U.rr(ctx, -2, 4.2, 4, 1.2, 0.5));
      ink(ctx, env, U.rgb('#7D9A86'), 0.5, () => {
        ctx.moveTo(-5, -0.6);
        ctx.quadraticCurveTo(0, 0.6, 5, -0.6);
      }, 0.8);
    }, () => {
      paint(ctx, env, P.matcha, () => U.ellipse(ctx, 0, -3, 5.2, 1.1));
      paint(ctx, env, U.lighten(P.matcha, 0.3), () => U.ellipse(ctx, -0.8, -3.1, 2.4, 0.5));
    });
  }

  K.registerFind(71, { id: 'matcha', label: 'Matcha', slot: 'item', place: { name: 'Arashiyama Bamboo Grove', city: 'Kyoto', lat: 35.0167, lon: 135.6712, radius: 800 } }, matcha);
})(window.Bud);
