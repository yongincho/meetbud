/* Gat, worn on the head: built-in accessory 8 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function gat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.lineWidth = Math.max(0.6, w * 0.035);
    ctx.fillStyle = env.c(C.gat, 0.9);
    ctx.strokeStyle = env.c(C.gatEdge, 0.85);
    ctx.beginPath();
    U.ellipse(ctx, 0, -w * 0.02, w * 0.78, w * 0.12);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w * 0.25, -w * 0.06);
    ctx.lineTo(-w * 0.23, -w * 0.42);
    ctx.quadraticCurveTo(0, -w * 0.5, w * 0.23, -w * 0.42);
    ctx.lineTo(w * 0.25, -w * 0.06);
    ctx.quadraticCurveTo(0, w * 0.02, -w * 0.25, -w * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = env.c(C.gatEdge, 0.5);
    ctx.beginPath();
    ctx.moveTo(-w * 0.24, -w * 0.13);
    ctx.quadraticCurveTo(0, -w * 0.08, w * 0.24, -w * 0.13);
    ctx.stroke();
    // beaded chin string (갓끈) hanging off the far side of the brim
    ctx.fillStyle = env.c(C.bead);
    for (let i = 0; i < 6; i++) {
      const u = i / 5;
      ctx.beginPath();
      ctx.arc(-w * (0.6 + 0.08 * u), w * (0.06 + 0.42 * u) + sway(env, 2, i) * 0.15, w * 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerBuiltin(8, { id: 'gat', label: 'Gat', kr: '갓', slot: 'head', kind: 'Hat (Korean traditional)' }, gat);
})(window.Bud);
