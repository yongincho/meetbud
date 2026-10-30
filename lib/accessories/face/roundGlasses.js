/* Round glasses, worn on the face: built-in accessory 12 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, begin } = K.AccKit;

  function roundGlasses(ctx, a, env) {
    const r = Math.min(Math.max(a.rx, a.ry) * 1.05 + 1.5, a.dx - 1);
    begin(ctx, a);
    const fw = Math.max(0.7, r * 0.1);
    ctx.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      ctx.fillStyle = env.c(U.WHITE, 0.05);
      ctx.beginPath();
      ctx.arc(cx, 0, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = env.c(U.WHITE, 0.28);
      ctx.lineWidth = fw * 0.9;
      ctx.beginPath();
      ctx.arc(cx, 0, r * 0.72, -2.5, -1.75);
      ctx.stroke();
      ctx.strokeStyle = env.c(C.gold);
      ctx.lineWidth = fw;
      ctx.beginPath();
      ctx.arc(cx, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-a.dx + r, -r * 0.18);
    ctx.quadraticCurveTo(0, -r * 0.42, a.dx - r, -r * 0.18);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(12, { id: 'roundGlasses', label: 'Round glasses', slot: 'face', kind: 'Glasses' }, roundGlasses);
})(window.Bud);
