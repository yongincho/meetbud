/* Beanie, worn on the head: built-in accessory 1 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { begin } = K.AccKit;

  function beanie(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const hw = w * 0.5;
    const cuffH = w * 0.2;
    const domeH = w * 0.5;
    begin(ctx, a);
    ctx.beginPath();
    ctx.moveTo(-hw * 0.94, -cuffH * 0.5);
    ctx.bezierCurveTo(-hw * 0.98, -cuffH - domeH * 1.1, hw * 0.98, -cuffH - domeH * 1.1, hw * 0.94, -cuffH * 0.5);
    ctx.closePath();
    ctx.fillStyle = env.c(col.hat);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = env.c(U.darken(col.hat, 0.2), 0.55);
    ctx.lineWidth = Math.max(0.6, w * 0.03);
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * hw * 0.26, -cuffH);
      ctx.quadraticCurveTo(i * hw * 0.2, -cuffH - domeH * 0.6, i * hw * 0.08, -cuffH - domeH);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = env.c(U.darken(col.hat, 0.1));
    ctx.beginPath();
    U.rr(ctx, -hw, -cuffH, hw * 2, cuffH, cuffH * 0.45);
    ctx.fill();
    ctx.strokeStyle = env.c(U.darken(col.hat, 0.3), 0.5);
    ctx.lineWidth = Math.max(0.5, w * 0.025);
    for (let i = -5; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(i * hw * 0.17, -cuffH * 0.8);
      ctx.lineTo(i * hw * 0.17, -cuffH * 0.2);
      ctx.stroke();
    }
    const py = -cuffH - domeH * 0.84 - w * 0.07;
    ctx.fillStyle = env.c(col.hat2);
    ctx.beginPath();
    ctx.arc(0, py, w * 0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(col.hat2, 0.12));
    ctx.beginPath();
    ctx.arc(w * 0.04, py + w * 0.05, w * 0.07, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(1, { id: 'beanie', label: 'Beanie', slot: 'head', kind: 'Hat' }, beanie);
})(window.Bud);
