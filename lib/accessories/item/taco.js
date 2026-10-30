/* Taco, held: a piece found at South Congress, Austin (find 51: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint } = K.AccKit;

  // South Congress: a taco, lettuce and tomato peeking out.
  function taco(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.35);
    paint(ctx, env, P.leaf, () => {
      for (let i = 0; i < 7; i++) U.ellipse(ctx, -4.4 + i * 1.5, -2.6 + Math.abs(i - 3) * 0.45, 1.1, 0.9);
    });
    paint(ctx, env, P.sauce, () => {
      for (const x of [-2.6, 0.2, 2.8]) ctx.arc(x, -2.4, 0.8, 0, TAU);
    });
    paint(ctx, env, P.cheese, () => {
      for (const x of [-1.2, 1.4]) U.rr(ctx, x - 0.9, -3.2, 1.8, 0.5, 0.2);
    });
    paint(ctx, env, U.rgb('#F2C14E'), () => {
      ctx.moveTo(-6, -1.6);
      ctx.bezierCurveTo(-6, 6, 6, 6, 6, -1.6);
      ctx.quadraticCurveTo(0, 1.4, -6, -1.6);
    });
    ctx.fillStyle = env.c(U.rgb('#D9973F'), 0.7);
    for (const [x, y] of [[-3.6, 1.6], [-1, 3.4], [2, 3.2], [3.8, 1.2], [0.4, 1.8]]) {
      ctx.beginPath();
      ctx.arc(x, y, 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerFind(51, { id: 'taco', label: 'Taco', slot: 'item', place: { name: 'South Congress', city: 'Austin', lat: 30.2487, lon: -97.75, radius: 900 } }, taco);
})(window.Bud);
