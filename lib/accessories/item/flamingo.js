/* Flamingo, held: a piece found at South Beach, Miami Beach (find 16). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // South Beach: a pink flamingo on one leg.
  function flamingo(ctx, a, env) {
    const s = a.w || 1;
    begin(ctx, a);
    ctx.translate(0, sway(env, 1.8) * 0.4);
    ctx.scale(s, s);
    ctx.strokeStyle = env.c(U.darken(C.flamingo, 0.15));
    ctx.lineWidth = 0.55;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.6, 1);
    ctx.lineTo(0.6, 7);
    ctx.moveTo(0.6, 3.6);
    ctx.lineTo(2.2, 2.4);
    ctx.lineTo(1, 2);
    ctx.stroke();
    ctx.fillStyle = env.c(C.flamingo);
    ctx.beginPath();
    U.ellipse(ctx, 1.4, -0.4, 3.8, 2.3, -0.25);
    ctx.fill();
    ctx.strokeStyle = env.c(C.flamingo);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(-1.6, -1);
    ctx.bezierCurveTo(-3.6, -3.6, -0.4, -5.6, -2, -8.4);
    ctx.stroke();
    ctx.fillStyle = env.c(C.flamingo);
    ctx.beginPath();
    ctx.arc(-2.1, -8.8, 1.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(C.lens);
    ctx.beginPath();
    ctx.moveTo(-3.2, -8.9);
    ctx.lineTo(-4.6, -7.6);
    ctx.lineTo(-3.4, -8.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.flamingo, 0.2));
    ctx.beginPath();
    U.ellipse(ctx, 2.8, -0.6, 1.6, 0.9, -0.3);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(16, { id: 'flamingo', label: 'Flamingo', slot: 'item', place: { name: 'South Beach', city: 'Miami Beach', lat: 25.781, lon: -80.13, radius: 1500 } }, flamingo);
})(window.Bud);
