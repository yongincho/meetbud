/* Laurel wreath, worn on the head: a piece found at Colosseum, Rome (find 89: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, begin, P, paint, ink } = K.AccKit;

  // The Colosseum: a laurel wreath, leaves meeting at the front.
  function laurelWreath(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    ctx.translate(0, -w * 0.04);
    for (const s of [-1, 1]) {
      ink(ctx, env, P.leafDark, Math.max(0.4, w * 0.015), () => {
        ctx.moveTo(s * w * 0.04, w * 0.02);
        ctx.quadraticCurveTo(s * w * 0.38, -w * 0.02, s * w * 0.4, -w * 0.22);
      });
      for (let i = 0; i < 6; i++) {
        const u = i / 5;
        const x = s * w * (0.08 + 0.32 * u);
        const y = w * (0.01 - 0.2 * u * u);
        const rot = s * (0.4 + u * 0.9) + sway(env, 2, i) * 0.04;
        paint(ctx, env, i % 2 ? P.leaf : P.leafDark, () => U.ellipse(ctx, x, y - w * 0.04, w * 0.035, w * 0.075, rot));
      }
    }
    paint(ctx, env, C.gold, () => U.ellipse(ctx, 0, w * 0.02, w * 0.045, w * 0.03));
    ctx.restore();
  }

  K.registerFind(89, { id: 'laurelWreath', label: 'Laurel wreath', slot: 'head', place: { name: 'Colosseum', city: 'Rome', lat: 41.8903, lon: 12.4922, radius: 500 } }, laurelWreath);
})(window.Bud);
