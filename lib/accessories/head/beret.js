/* Beret, worn on the head: a piece found at Eiffel Tower, Paris (find 2). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Eiffel Tower: a red beret, worn at an angle.
  function beret(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(w * 0.04, -w * 0.03);
    ctx.rotate(-0.16 + sway(env, 1.6) * 0.02);
    ctx.fillStyle = env.c(U.darken(C.beret, 0.3));
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, w * 0.28, w * 0.06);
    ctx.fill();
    ctx.fillStyle = env.c(C.beret);
    ctx.beginPath();
    U.ellipse(ctx, w * 0.03, -w * 0.075, w * 0.37, w * 0.12);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.2);
    ctx.beginPath();
    U.ellipse(ctx, -w * 0.1, -w * 0.13, w * 0.14, w * 0.032, -0.08);
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.beret, 0.22));
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.03, -w * 0.19);
    ctx.lineTo(w * 0.06, -w * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  K.registerFind(2, { id: 'beret', label: 'Beret', slot: 'head', place: { name: 'Eiffel Tower', city: 'Paris', lat: 48.8584, lon: 2.2945, radius: 800 } }, beret);
})(window.Bud);
