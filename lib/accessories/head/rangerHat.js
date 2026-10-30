/* Ranger hat, worn on the head: a piece found at Yosemite Valley, Yosemite (find 39: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, begin, paint, ink, gleam } = K.AccKit;

  // Yosemite: a park ranger's hat, pinched on top, with a brown band.
  function rangerHat(ctx, a, env) {
    const w = a.w;
    const felt = U.rgb('#C9A36A');
    begin(ctx, a);
    ctx.rotate(sway(env, 1.6) * 0.015);
    paint(ctx, env, U.darken(felt, 0.12), () => U.ellipse(ctx, 0, -w * 0.02, w * 0.52, w * 0.08));
    paint(ctx, env, felt, () => {
      ctx.moveTo(-w * 0.2, -w * 0.04);
      ctx.lineTo(-w * 0.17, -w * 0.3);
      ctx.lineTo(-w * 0.06, -w * 0.36);
      ctx.lineTo(0, -w * 0.31);
      ctx.lineTo(w * 0.06, -w * 0.36);
      ctx.lineTo(w * 0.17, -w * 0.3);
      ctx.lineTo(w * 0.2, -w * 0.04);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(felt, 0.22), Math.max(0.4, w * 0.012), () => {
      ctx.moveTo(0, -w * 0.31);
      ctx.lineTo(0, -w * 0.18);
    });
    paint(ctx, env, U.rgb('#6B4423'), () => ctx.rect(-w * 0.2, -w * 0.11, w * 0.4, w * 0.06));
    gleam(ctx, env, -w * 0.25, -w * 0.05, w * 0.12, w * 0.02, 0, 0.2);
    ctx.restore();
  }

  K.registerFind(39, { id: 'rangerHat', label: 'Ranger hat', slot: 'head', place: { name: 'Yosemite Valley', city: 'Yosemite', lat: 37.7487, lon: -119.5872, radius: 1500 } }, rangerHat);
})(window.Bud);
