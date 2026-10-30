/* Edelweiss, worn on the head: a piece found at Zermatt (find 88: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin, P, paint } = K.AccKit;

  // Zermatt: edelweiss, two woolly white stars tucked over one ear.
  function edelweissFlower(ctx, x, y, r, env, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      paint(ctx, env, U.rgb('#F3F1E6'), () => U.ellipse(ctx, 0, -r * 0.6, r * 0.24, r * 0.55));
      paint(ctx, env, U.rgb('#C9D3B6'), () => U.ellipse(ctx, 0, -r * 0.92, r * 0.1, r * 0.16), 0.8);
    }
    paint(ctx, env, U.rgb('#E9C84E'), () => ctx.arc(0, 0, r * 0.28, 0, TAU));
    ctx.restore();
  }
  function edelweiss(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    paint(ctx, env, P.leafDark, () => U.ellipse(ctx, w * 0.36, -w * 0.02, w * 0.04, w * 0.1, 0.9));
    edelweissFlower(ctx, w * 0.3, -w * 0.08, w * 0.17, env, 0.2 + sway(env, 1.2) * 0.06);
    edelweissFlower(ctx, w * 0.12, -w * 0.17, w * 0.11, env, 0.8);
    ctx.restore();
  }

  K.registerFind(88, { id: 'edelweiss', label: 'Edelweiss', slot: 'head', place: { name: 'Zermatt', city: 'Zermatt', lat: 46.019, lon: 7.7496, radius: 1500 } }, edelweiss);
})(window.Bud);
