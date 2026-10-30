/* Balloon, held: built-in accessory 17 (its outfit code). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, begin } = K.AccKit;

  function balloon(ctx, a, env) {
    const col = env.accColors;
    const s = a.w || 1;
    begin(ctx, a);
    ctx.scale(s, s);
    const bx = -4 + 1.5 * sway(env, 1.2);
    const by = -22 + 1.2 * sway(env, 1.7, 1);
    ctx.strokeStyle = env.c(U.WHITE, 0.55);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(bx + 3, by * 0.45, bx, by + 7.4);
    ctx.stroke();
    const g = ctx.createRadialGradient(bx - 2, by - 2.6, 0.5, bx, by, 7.5);
    g.addColorStop(0, env.c(U.lighten(col.hat, 0.5)));
    g.addColorStop(1, env.c(col.hat));
    ctx.fillStyle = g;
    ctx.beginPath();
    U.ellipse(ctx, bx, by, 5.4, 6.5);
    ctx.fill();
    ctx.fillStyle = env.c(col.hat);
    ctx.beginPath();
    ctx.moveTo(bx, by + 6.2);
    ctx.lineTo(bx - 1.2, by + 7.7);
    ctx.lineTo(bx + 1.2, by + 7.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = env.c(U.WHITE, 0.7);
    ctx.beginPath();
    U.ellipse(ctx, bx - 2.1, by - 2.8, 1.2, 1.9, 0.5);
    ctx.fill();
    ctx.restore();
  }

  K.registerBuiltin(17, { id: 'balloon', label: 'Balloon', slot: 'item', kind: 'Held item' }, balloon);
})(window.Bud);
