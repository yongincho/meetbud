/* Lighthouse, held: a piece found at Portland Head Light, Cape Elizabeth (find 28: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, P, hold, paint } = K.AccKit;

  // Portland Head Light: a striped lighthouse, its lamp glowing.
  function lighthouse(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    const glow = 0.55 + sway(env, 2.4) * 0.25;
    const beam = ctx.createLinearGradient(0, -8, 7.4, -8);
    beam.addColorStop(0, env.c(C.light, 0.85 * glow + 0.1));
    beam.addColorStop(1, env.c(C.gold, 0));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(0, -7.9);
    ctx.lineTo(7.4, -10.6);
    ctx.lineTo(7.4, -5.2);
    ctx.closePath();
    ctx.fill();
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(-2.4, 5.6);
      ctx.lineTo(-1.6, -6);
      ctx.lineTo(1.6, -6);
      ctx.lineTo(2.4, 5.6);
      ctx.closePath();
    });
    ctx.save();
    ctx.clip();
    paint(ctx, env, P.red, () => {
      ctx.rect(-3, -3.6, 6, 2);
      ctx.rect(-3, 0.8, 6, 2);
    });
    ctx.restore();
    paint(ctx, env, U.rgb('#2B2D35'), () => {
      U.rr(ctx, -2.2, -6.6, 4.4, 1, 0.3);
      ctx.moveTo(-1.6, -9.2);
      ctx.lineTo(1.6, -9.2);
      ctx.lineTo(0, -11);
      ctx.closePath();
    });
    paint(ctx, env, C.light, () => ctx.rect(-1.2, -9.2, 2.4, 2.6), 0.6 + glow * 0.4);
    paint(ctx, env, U.rgb('#8C8F98'), () => U.rr(ctx, -4, 5, 8, 1.4, 0.6));
    ctx.restore();
  }

  K.registerFind(28, { id: 'lighthouse', label: 'Lighthouse', slot: 'item', place: { name: 'Portland Head Light', city: 'Cape Elizabeth', lat: 43.6231, lon: -70.2079, radius: 500 } }, lighthouse);
})(window.Bud);
