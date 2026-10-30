/* Bunny ears, worn on the head: built-in accessory 5 (its outfit code). */
(function (K) {
  'use strict';
  const { C, sway, begin } = K.AccKit;

  function bunnyEars(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const ew = w * 0.1;
    const eh = w * 0.5;
    begin(ctx, a);
    const sw = sway(env, 1.1);
    ctx.strokeStyle = env.c(col.hat2, 0.9);
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, w * 0.08);
    ctx.quadraticCurveTo(0, -w * 0.13, w * 0.44, w * 0.08);
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * w * 0.18, -w * 0.02);
      ctx.rotate(s * 0.14 + (s > 0 ? 0.32 + 0.06 * sw : 0.02 * sw));
      ctx.beginPath();
      ctx.moveTo(-ew, 0);
      ctx.bezierCurveTo(-ew * 1.35, -eh * 0.6, -ew * 0.8, -eh, 0, -eh);
      ctx.bezierCurveTo(ew * 0.8, -eh, ew * 1.35, -eh * 0.6, ew, 0);
      ctx.closePath();
      ctx.fillStyle = env.c(col.hat2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-ew * 0.42, -eh * 0.12);
      ctx.bezierCurveTo(-ew * 0.72, -eh * 0.6, -ew * 0.4, -eh * 0.86, 0, -eh * 0.86);
      ctx.bezierCurveTo(ew * 0.4, -eh * 0.86, ew * 0.72, -eh * 0.6, ew * 0.42, -eh * 0.12);
      ctx.closePath();
      ctx.fillStyle = env.c(C.earPink);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  K.registerBuiltin(5, { id: 'bunnyEars', label: 'Bunny ears', slot: 'head', kind: 'Ears' }, bunnyEars);
})(window.Bud);
