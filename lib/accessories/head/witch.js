/* Witch hat, worn on the head: built-in accessory 10 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  function witch(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    const sw = sway(env, 1.6) * w * 0.04;
    ctx.fillStyle = env.c(C.witch);
    ctx.beginPath();
    U.ellipse(ctx, 0, -w * 0.02, w * 0.72, w * 0.12);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -w * 0.06);
    ctx.quadraticCurveTo(-w * 0.12, -w * 0.5, w * 0.05 + sw, -w * 0.8);
    ctx.quadraticCurveTo(w * 0.32 + sw, -w * 0.86, w * 0.42 + sw, -w * 0.7);
    ctx.quadraticCurveTo(w * 0.22, -w * 0.62, w * 0.18, -w * 0.4);
    ctx.lineTo(w * 0.32, -w * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(C.witchBand);
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -w * 0.1);
    ctx.lineTo(w * 0.3, -w * 0.1);
    ctx.lineTo(w * 0.27, -w * 0.2);
    ctx.lineTo(-w * 0.26, -w * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(10, { id: 'witch', label: 'Witch hat', slot: 'head', kind: 'Hat (Halloween)', seasonal: true }, witch);
})(window.Bud);
