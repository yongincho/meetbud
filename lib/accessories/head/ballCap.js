/* Ball cap, worn on the head: a piece found at Fenway Park, Boston (find 11). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  // Fenway Park: a ball cap, brim forward.
  function ballCap(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(0, -w * 0.01);
    ctx.rotate(-0.05 + sway(env, 1.6) * 0.015);
    ctx.fillStyle = env.c(U.darken(C.cap, 0.18));
    ctx.beginPath();
    ctx.moveTo(w * 0.05, -w * 0.02);
    ctx.quadraticCurveTo(w * 0.36, -w * 0.07, w * 0.44, w * 0.02);
    ctx.quadraticCurveTo(w * 0.3, w * 0.04, w * 0.05, w * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.cap);
    ctx.beginPath();
    ctx.moveTo(-w * 0.27, 0);
    ctx.bezierCurveTo(-w * 0.27, -w * 0.31, w * 0.27, -w * 0.31, w * 0.27, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(C.cap, 0.25));
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.23);
    ctx.lineTo(0, 0);
    ctx.moveTo(-w * 0.14, -w * 0.2);
    ctx.quadraticCurveTo(-w * 0.12, -w * 0.08, -w * 0.13, 0);
    ctx.moveTo(w * 0.14, -w * 0.2);
    ctx.quadraticCurveTo(w * 0.12, -w * 0.08, w * 0.13, 0);
    ctx.stroke();
    ctx.fillStyle = env.c(U.WHITE, 0.9);
    ctx.beginPath();
    ctx.arc(0, -w * 0.235, w * 0.025, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.16);
    ctx.beginPath();
    U.ellipse(ctx, -w * 0.1, -w * 0.16, w * 0.07, w * 0.03, -0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(11, { id: 'ballCap', label: 'Ball cap', slot: 'head', place: { name: 'Fenway Park', city: 'Boston', lat: 42.3467, lon: -71.0972, radius: 500 } }, ballCap);
})(window.Bud);
