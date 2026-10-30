/* Headphones, worn on the head: built-in accessory 6 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin } = K.AccKit;

  function headphones(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const ear = a.ear || [w * 0.56, w * 0.42];
    begin(ctx, a);
    if (ear[2]) ctx.translate(ear[2], 0); // cups centered on the body even when the hat anchor is off-center
    ctx.translate(0, Math.max(0, sway(env, 4.4)) * w * 0.012); // nodding to the beat
    ctx.lineCap = 'round';
    ctx.strokeStyle = env.c(C.phones);
    ctx.lineWidth = w * 0.06;
    ctx.beginPath();
    ctx.moveTo(-ear[0], ear[1] - w * 0.1);
    ctx.bezierCurveTo(-ear[0] * 1.02, -w * 0.4, ear[0] * 1.02, -w * 0.4, ear[0], ear[1] - w * 0.1);
    ctx.stroke();
    ctx.strokeStyle = env.c(col.hat);
    ctx.lineWidth = w * 0.028;
    ctx.beginPath();
    ctx.moveTo(-ear[0] * 0.62, -w * 0.17);
    ctx.bezierCurveTo(-ear[0] * 0.3, -w * 0.29, ear[0] * 0.3, -w * 0.29, ear[0] * 0.62, -w * 0.17);
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * ear[0], ear[1]);
      ctx.fillStyle = env.c(C.phones);
      ctx.beginPath();
      U.rr(ctx, -w * 0.085, -w * 0.16, w * 0.17, w * 0.32, w * 0.075);
      ctx.fill();
      ctx.fillStyle = env.c(col.hat);
      ctx.beginPath();
      U.rr(ctx, -s * w * 0.035 - w * 0.04, -w * 0.12, w * 0.08, w * 0.24, w * 0.04);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  K.registerBuiltin(6, { id: 'headphones', label: 'Headphones', slot: 'head', kind: 'Audio' }, headphones);
})(window.Bud);
