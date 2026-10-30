/* Cat ears, worn on the head: built-in accessory 4 (its outfit code). */
(function (K) {
  'use strict';
  const { C, sway, begin } = K.AccKit;

  function catEars(ctx, a, env) {
    const col = env.accColors;
    const w = a.w;
    const ew = w * 0.17;
    const eh = w * 0.3;
    begin(ctx, a);
    const twitch = Math.max(0, sway(env, 1.3)) ** 6; // a quick flick now and then
    ctx.strokeStyle = env.c(col.hat2, 0.9);
    ctx.lineWidth = w * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, w * 0.08);
    ctx.quadraticCurveTo(0, -w * 0.13, w * 0.44, w * 0.08);
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
      ctx.save();
      ctx.translate(s * w * 0.32, 0);
      ctx.rotate(s * (0.3 + (s > 0 ? 0.16 * twitch : 0)));
      ctx.beginPath();
      ctx.moveTo(-ew, 0);
      ctx.quadraticCurveTo(-ew * 0.55, -eh * 0.75, 0, -eh);
      ctx.quadraticCurveTo(ew * 0.55, -eh * 0.75, ew, 0);
      ctx.closePath();
      ctx.fillStyle = env.c(col.hat2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-ew * 0.55, -eh * 0.08);
      ctx.quadraticCurveTo(-ew * 0.3, -eh * 0.58, 0, -eh * 0.76);
      ctx.quadraticCurveTo(ew * 0.3, -eh * 0.58, ew * 0.55, -eh * 0.08);
      ctx.closePath();
      ctx.fillStyle = env.c(C.earPink);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  K.registerBuiltin(4, { id: 'catEars', label: 'Cat ears', slot: 'head', kind: 'Ears' }, catEars);
})(window.Bud);
