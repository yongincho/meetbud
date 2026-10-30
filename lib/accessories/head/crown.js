/* Crown, worn on the head: built-in accessory 3 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin } = K.AccKit;

  function crown(ctx, a, env) {
    const w = a.w;
    const cw = w * 0.25;
    const ch = w * 0.27;
    begin(ctx, a);
    ctx.translate(0, -w * 0.02);
    ctx.beginPath();
    ctx.moveTo(-cw, 0);
    ctx.lineTo(-cw, -ch * 0.78);
    ctx.lineTo(-cw * 0.48, -ch * 0.36);
    ctx.lineTo(0, -ch);
    ctx.lineTo(cw * 0.48, -ch * 0.36);
    ctx.lineTo(cw, -ch * 0.78);
    ctx.lineTo(cw, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -ch, 0, 0);
    g.addColorStop(0, env.c(U.lighten(C.gold, 0.4)));
    g.addColorStop(1, env.c(U.darken(C.gold, 0.1)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = env.c(U.darken(C.gold, 0.22));
    ctx.fillRect(-cw, -ch * 0.24, cw * 2, ch * 0.24);
    ctx.fillStyle = env.c(C.gemRed);
    ctx.beginPath();
    ctx.arc(0, -ch * 0.12, w * 0.032, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(C.gemBlue);
    ctx.beginPath();
    ctx.arc(-cw * 0.62, -ch * 0.12, w * 0.024, 0, TAU);
    ctx.arc(cw * 0.62, -ch * 0.12, w * 0.024, 0, TAU);
    ctx.fill();
    ctx.fillStyle = env.c(U.lighten(C.gold, 0.55));
    [[-cw, -ch * 0.78], [0, -ch], [cw, -ch * 0.78]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, w * 0.028, 0, TAU);
      ctx.fill();
    });
    const tw = Math.max(0, sway(env, 2.2));
    if (tw > 0.05) {
      ctx.fillStyle = env.c(U.WHITE, 0.9 * tw);
      ctx.beginPath();
      U.star4(ctx, cw * 0.5, -ch * 0.66, w * 0.06 * tw);
      ctx.fill();
    }
    ctx.restore();
  }

  K.registerBuiltin(3, { id: 'crown', label: 'Crown', slot: 'head', kind: 'Hat' }, crown);
})(window.Bud);
