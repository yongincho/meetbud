/* Beignet, held: a piece found at Jackson Square, New Orleans (find 50: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, hold, paint } = K.AccKit;

  // Jackson Square: a puffy beignet under a snow of powdered sugar.
  function beignet(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.12);
    paint(ctx, env, U.darken(P.crust, 0.18), () => {
      ctx.moveTo(-5.2, -1);
      ctx.quadraticCurveTo(-5.8, 4.6, -1, 4.6);
      ctx.quadraticCurveTo(3.6, 5.6, 5.2, 2.6);
      ctx.quadraticCurveTo(5.8, -2.4, 3.2, -3.6);
      ctx.quadraticCurveTo(-1, -4.6, -5.2, -1);
    });
    paint(ctx, env, P.crust, () => {
      ctx.moveTo(-4.8, -1.6);
      ctx.quadraticCurveTo(-5, 3.2, -1, 3.4);
      ctx.quadraticCurveTo(3.4, 4.2, 4.6, 1.6);
      ctx.quadraticCurveTo(5, -2.6, 2.8, -3.6);
      ctx.quadraticCurveTo(-1, -4.4, -4.8, -1.6);
    });
    ctx.fillStyle = env.c(WHITE, 0.95);
    for (let i = 0; i < 34; i++) {
      const x = -4 + U.hash(i) * 8;
      const y = -3.4 + U.hash(i + 40) * 4.4 + (x > 2 ? 0.6 : 0);
      ctx.beginPath();
      ctx.arc(x, y, 0.22 + U.hash(i + 9) * 0.32, 0, TAU);
      ctx.fill();
    }
    paint(ctx, env, WHITE, () => {
      U.ellipse(ctx, -1.6, -2.4, 1.6, 0.6, -0.3);
      U.ellipse(ctx, 1.8, -2.2, 1.4, 0.5, 0.2);
    }, 0.85);
    ctx.restore();
  }

  K.registerFind(50, { id: 'beignet', label: 'Beignet', slot: 'item', place: { name: 'Jackson Square', city: 'New Orleans', lat: 29.9575, lon: -90.063, radius: 400 } }, beignet);
})(window.Bud);
