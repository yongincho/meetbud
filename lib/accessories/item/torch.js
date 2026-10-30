/* Torch, held: a piece found at Statue of Liberty, New York (find 3). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Statue of Liberty: her torch, flame flickering.
  function torch(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 2) * 0.3);
    ctx.scale(s, s);
    const f = 1 + sway(env, 7, 0.4) * 0.07;
    const glow = ctx.createRadialGradient(0, -8, 0.4, 0, -8, 5 * f);
    glow.addColorStop(0, env.c(C.light, 0.9));
    glow.addColorStop(1, env.c(C.gold, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -8, 5 * f, 0, TAU);
    ctx.fill();
    for (const [k, col] of [[1, C.flame], [0.6, C.light]]) {
      ctx.fillStyle = env.c(col);
      ctx.beginPath();
      ctx.moveTo(sway(env, 5) * 0.4 * k, -5.4 - 6.6 * k * f);
      ctx.bezierCurveTo(2.6 * k, -8.6, 2.4 * k, -6, 0, -5.4);
      ctx.bezierCurveTo(-2.4 * k, -6, -2.6 * k, -8.6, sway(env, 5) * 0.4 * k, -5.4 - 6.6 * k * f);
      ctx.fill();
    }
    ctx.fillStyle = env.c(C.copper);
    ctx.beginPath();
    ctx.moveTo(-3.1, -5.6);
    ctx.lineTo(3.1, -5.6);
    ctx.lineTo(1.7, -2.6);
    ctx.lineTo(-1.7, -2.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.copper, 0.18));
    ctx.beginPath();
    U.rr(ctx, -3.3, -6.1, 6.6, 0.9, 0.4);
    U.rr(ctx, -0.9, -2.8, 1.8, 8.8, 0.6);
    ctx.fill();
    ctx.fillStyle = env.c(U.lighten(C.copper, 0.25));
    ctx.beginPath();
    U.rr(ctx, -1.2, 0.2, 2.4, 0.7, 0.3);
    U.rr(ctx, -1.2, 3.2, 2.4, 0.7, 0.3);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(3, { id: 'torch', label: 'Torch', slot: 'item', place: { name: 'Statue of Liberty', city: 'New York', lat: 40.6892, lon: -74.0445, radius: 3000 } }, torch);
})(window.Bud);
