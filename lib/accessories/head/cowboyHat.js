/* Cowboy hat, worn on the head: a piece found at Fort Worth Stockyards, Fort Worth (find 40: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, begin, paint, gleam } = K.AccKit;

  // Fort Worth Stockyards: a brown cowboy hat with its brim curled up.
  function cowboyHat(ctx, a, env) {
    const w = a.w;
    const hat = U.rgb('#9A6235');
    begin(ctx, a);
    ctx.rotate(-0.05 + sway(env, 1.6) * 0.02);
    paint(ctx, env, U.darken(hat, 0.15), () => {
      ctx.moveTo(-w * 0.55, -w * 0.12);
      ctx.quadraticCurveTo(-w * 0.45, w * 0.03, 0, w * 0.02);
      ctx.quadraticCurveTo(w * 0.45, w * 0.03, w * 0.55, -w * 0.12);
      ctx.quadraticCurveTo(w * 0.42, -w * 0.02, 0, -w * 0.04);
      ctx.quadraticCurveTo(-w * 0.42, -w * 0.02, -w * 0.55, -w * 0.12);
      ctx.closePath();
    });
    paint(ctx, env, hat, () => {
      ctx.moveTo(-w * 0.24, -w * 0.04);
      ctx.bezierCurveTo(-w * 0.28, -w * 0.36, -w * 0.08, -w * 0.32, 0, -w * 0.26);
      ctx.bezierCurveTo(w * 0.08, -w * 0.32, w * 0.28, -w * 0.36, w * 0.24, -w * 0.04);
      ctx.closePath();
    });
    paint(ctx, env, U.rgb('#3B2A1E'), () => ctx.rect(-w * 0.245, -w * 0.11, w * 0.49, w * 0.05));
    paint(ctx, env, C.steel, () => ctx.arc(w * 0.12, -w * 0.085, w * 0.025, 0, TAU));
    gleam(ctx, env, -w * 0.12, -w * 0.24, w * 0.06, w * 0.03, -0.4, 0.2);
    ctx.restore();
  }

  K.registerFind(40, { id: 'cowboyHat', label: 'Cowboy hat', slot: 'head', place: { name: 'Fort Worth Stockyards', city: 'Fort Worth', lat: 32.7903, lon: -97.3461, radius: 700 } }, cowboyHat);
})(window.Bud);
