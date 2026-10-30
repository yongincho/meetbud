/* Chai, held: a piece found at Taj Mahal, Agra (find 81: Asia). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, paint, gleam, steamingCup } = K.AccKit;

  // The Taj Mahal: chai in a little clay cup.
  function chai(ctx, a, env) {
    steamingCup(ctx, a, env, () => {
      paint(ctx, env, P.clay, () => {
        ctx.moveTo(-3.8, -3.4);
        ctx.lineTo(3.8, -3.4);
        ctx.lineTo(2.6, 5.4);
        ctx.lineTo(-2.6, 5.4);
        ctx.closePath();
      });
      paint(ctx, env, U.darken(P.clay, 0.2), () => ctx.rect(-3.6, -1.8, 7.2, 0.6));
      gleam(ctx, env, -1.8, 1.4, 0.5, 2.4, 0.15, 0.25);
    }, () => {
      paint(ctx, env, U.rgb('#C98F5A'), () => U.ellipse(ctx, 0, -3.4, 3.7, 0.8));
      paint(ctx, env, U.rgb('#E3B985'), () => U.ellipse(ctx, -0.6, -3.5, 1.6, 0.35));
    });
  }

  K.registerFind(81, { id: 'chai', label: 'Chai', slot: 'item', place: { name: 'Taj Mahal', city: 'Agra', lat: 27.175, lon: 78.0421, radius: 800 } }, chai);
})(window.Bud);
