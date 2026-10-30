/* Newsboy cap, worn on the head: a piece found at Brooklyn Bridge, New York (find 32: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, begin, paint, ink, gleam } = K.AccKit;

  // Brooklyn Bridge: a gray newsboy cap with a little button on top.
  function newsboyCap(ctx, a, env) {
    const w = a.w;
    const cap = U.rgb('#7D8590');
    begin(ctx, a);
    ctx.translate(0, -w * 0.01);
    ctx.rotate(-0.06 + sway(env, 1.6) * 0.015);
    paint(ctx, env, U.darken(cap, 0.25), () => {
      ctx.moveTo(-w * 0.05, -w * 0.01);
      ctx.quadraticCurveTo(-w * 0.32, -w * 0.05, -w * 0.4, w * 0.03);
      ctx.quadraticCurveTo(-w * 0.24, w * 0.05, -w * 0.05, w * 0.02);
      ctx.closePath();
    });
    paint(ctx, env, cap, () => {
      ctx.moveTo(-w * 0.3, 0);
      ctx.bezierCurveTo(-w * 0.42, -w * 0.26, w * 0.36, -w * 0.32, w * 0.33, -w * 0.02);
      ctx.closePath();
    });
    ink(ctx, env, U.darken(cap, 0.18), Math.max(0.4, w * 0.012), () => {
      for (const k of [-0.16, 0, 0.16]) {
        ctx.moveTo(k * w, -w * 0.21);
        ctx.quadraticCurveTo(k * w * 1.3, -w * 0.1, k * w * 1.5, 0);
      }
    });
    paint(ctx, env, U.darken(cap, 0.3), () => ctx.arc(-w * 0.02, -w * 0.215, w * 0.03, 0, TAU));
    gleam(ctx, env, -w * 0.08, -w * 0.15, w * 0.08, w * 0.025, -0.3, 0.18);
    ctx.restore();
  }

  K.registerFind(32, { id: 'newsboyCap', label: 'Newsboy cap', slot: 'head', place: { name: 'Brooklyn Bridge', city: 'New York', lat: 40.7061, lon: -73.9969, radius: 1000 } }, newsboyCap);
})(window.Bud);
