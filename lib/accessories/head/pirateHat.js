/* Pirate hat, worn on the head: a piece found at Tampa Riverwalk, Tampa (find 55: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin, star5, P, paint, ink } = K.AccKit;

  // Tampa Riverwalk: a pirate captain's hat with a white plume (no skull).
  function pirateHat(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.rotate(0.04 + sway(env, 1.6) * 0.02);
    const sw = sway(env, 2.2) * 0.04;
    paint(ctx, env, U.rgb('#F7F3EC'), () => {
      ctx.moveTo(w * 0.05, -w * 0.3);
      ctx.bezierCurveTo(w * 0.28, -w * (0.62 + sw), w * 0.5, -w * 0.5, w * 0.42, -w * 0.32);
      ctx.bezierCurveTo(w * 0.3, -w * 0.42, w * 0.15, -w * 0.36, w * 0.05, -w * 0.3);
    });
    paint(ctx, env, P.ink, () => {
      ctx.moveTo(-w * 0.52, -w * 0.06);
      ctx.quadraticCurveTo(-w * 0.36, -w * 0.48, 0, -w * 0.4);
      ctx.quadraticCurveTo(w * 0.36, -w * 0.48, w * 0.52, -w * 0.06);
      ctx.quadraticCurveTo(0, w * 0.08, -w * 0.52, -w * 0.06);
      ctx.closePath();
    });
    ink(ctx, env, C.gold, Math.max(0.6, w * 0.03), () => {
      ctx.moveTo(-w * 0.52, -w * 0.06);
      ctx.quadraticCurveTo(-w * 0.36, -w * 0.48, 0, -w * 0.4);
      ctx.quadraticCurveTo(w * 0.36, -w * 0.48, w * 0.52, -w * 0.06);
    });
    paint(ctx, env, C.gold, () => star5(ctx, 0, -w * 0.2, w * 0.07));
    ctx.restore();
  }

  K.registerFind(55, { id: 'pirateHat', label: 'Pirate hat', slot: 'head', place: { name: 'Tampa Riverwalk', city: 'Tampa', lat: 27.9484, lon: -82.4619, radius: 1200 } }, pirateHat);
})(window.Bud);
