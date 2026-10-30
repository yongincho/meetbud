/* Party hat, worn on the head: built-in accessory 2 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function partyHat(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const bw = w * 0.21;
    const hh = w * 0.58;
    begin(ctx, a);
    ctx.translate(w * 0.17, 0);
    ctx.rotate(0.24 + sway(env, 1.8) * 0.03);
    ctx.beginPath();
    ctx.moveTo(-bw, 0);
    ctx.lineTo(0, -hh);
    ctx.lineTo(bw, 0);
    ctx.quadraticCurveTo(0, bw * 0.35, -bw, 0);
    ctx.closePath();
    ctx.fillStyle = env.c(col.hat);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = env.c(col.hat2, 0.95);
    ctx.lineWidth = w * 0.055;
    for (let i = 0; i < 5; i++) {
      const y = -hh * (0.08 + 0.21 * i);
      ctx.beginPath();
      ctx.moveTo(-bw, y + bw * 0.45);
      ctx.lineTo(bw, y - bw * 0.35);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = env.c(C.gold);
    ctx.beginPath();
    ctx.arc(0, -hh, w * 0.075, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.6);
    ctx.beginPath();
    ctx.arc(-w * 0.02, -hh - w * 0.025, w * 0.025, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(2, { id: 'partyHat', label: 'Party hat', slot: 'head', kind: 'Hat' }, partyHat);
})(window.Bud);
