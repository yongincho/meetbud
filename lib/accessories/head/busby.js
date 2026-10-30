/* Guard hat, worn on the head: a piece found at Buckingham Palace, London (find 7). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  // Buckingham Palace: the guards' tall bearskin hat, with a red plume.
  function busby(ctx, a, env) {
    const w = a.w;
    const bw = w * 0.21;
    const bh = w * 0.64;
    begin(ctx, a);
    ctx.translate(0, -w * 0.01);
    ctx.rotate(sway(env, 1.5) * 0.015);
    ctx.fillStyle = env.c(C.busby);
    ctx.beginPath();
    ctx.moveTo(-bw, 0);
    ctx.bezierCurveTo(-bw * 1.2, -bh * 0.62, -bw * 0.78, -bh, 0, -bh);
    ctx.bezierCurveTo(bw * 0.78, -bh, bw * 1.2, -bh * 0.62, bw, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = env.c(U.WHITE, 0.16); // a soft rim, so it shows on dark themes too
    ctx.lineWidth = w * 0.018;
    ctx.stroke();
    ctx.fillStyle = env.c(U.lighten(C.busby, 0.12), 0.8);
    ctx.beginPath();
    for (const [x, y] of [[-0.45, 0.25], [0.3, 0.42], [-0.15, 0.62], [0.45, 0.75], [-0.5, 0.82]]) U.ellipse(ctx, bw * x, -bh * y, w * 0.03, w * 0.045);
    ctx.fill();
    ctx.strokeStyle = env.c(C.gold);
    ctx.lineWidth = w * 0.028;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.95, -w * 0.035);
    ctx.quadraticCurveTo(0, w * 0.02, bw * 0.95, -w * 0.035);
    ctx.stroke();
    ctx.fillStyle = env.c(C.plume);
    ctx.beginPath();
    U.ellipse(ctx, -bw * 1.02, -bh * 0.55, w * 0.04, w * 0.12, -0.1);
    ctx.fill();
    ctx.restore();
  }

  K.registerFind(7, { id: 'busby', label: 'Guard hat', slot: 'head', place: { name: 'Buckingham Palace', city: 'London', lat: 51.5014, lon: -0.1419, radius: 700 } }, busby);
})(window.Bud);
