/* Sunglasses, worn on the face: built-in accessory 11 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, begin, lensSize } = K.AccKit;

  function sunglasses(ctx, a, env) {
    const col = env.accColors;
    const [lw, lh] = lensSize(a);
    begin(ctx, a);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const fw = Math.max(0.8, Math.min(lw, lh) * 0.16);
    for (let s = -1; s <= 1; s += 2) {
      const cx = s * a.dx;
      ctx.beginPath();
      ctx.moveTo(cx - lw, -lh * 0.85);
      ctx.lineTo(cx + lw, -lh * 0.85);
      ctx.quadraticCurveTo(cx + lw * 1.04, lh * 0.55, cx + lw * 0.45, lh);
      ctx.lineTo(cx - lw * 0.45, lh);
      ctx.quadraticCurveTo(cx - lw * 1.04, lh * 0.55, cx - lw, -lh * 0.85);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -lh, 0, lh);
      g.addColorStop(0, env.c(C.lens, 0.94));
      g.addColorStop(1, env.c(U.mix(C.lens, col.hat, 0.35), 0.82));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = env.c(col.hat);
      ctx.lineWidth = fw;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = env.c(U.WHITE, 0.32);
      ctx.lineWidth = fw * 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.62, lh * 0.55);
      ctx.lineTo(cx - lw * 0.02, -lh * 0.75);
      ctx.stroke();
      ctx.lineWidth = fw * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx - lw * 0.22, lh * 0.7);
      ctx.lineTo(cx + lw * 0.3, -lh * 0.5);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = env.c(col.hat);
    ctx.lineWidth = fw;
    ctx.beginPath();
    ctx.moveTo(-a.dx + lw * 0.95, -lh * 0.62);
    ctx.quadraticCurveTo(0, -lh * 0.95, a.dx - lw * 0.95, -lh * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  K.registerBuiltin(11, { id: 'sunglasses', label: 'Sunglasses', slot: 'face', kind: 'Glasses' }, sunglasses);
})(window.Bud);
