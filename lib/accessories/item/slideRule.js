/* Slide rule, held: a piece found at MIT Killian Court, Cambridge (find 23: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, ink } = K.AccKit;

  // MIT: a slide rule, its middle strip pulled out a little.
  function slideRule(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(-0.55);
    paint(ctx, env, U.rgb('#F3EDD9'), () => U.rr(ctx, -7, -2, 14, 4, 0.6));
    paint(ctx, env, U.rgb('#E3D9BC'), () => ctx.rect(-5.6, -0.7, 14, 1.4));
    ink(ctx, env, P.ink, 0.18, () => {
      for (let i = 0; i <= 26; i++) {
        const x = -6.6 + i * 0.5;
        ctx.moveTo(x, -2);
        ctx.lineTo(x, i % 5 ? -1.4 : -1);
        ctx.moveTo(x + 1.4, 0.7);
        ctx.lineTo(x + 1.4, i % 5 ? 0.3 : 0);
      }
    }, 0.7);
    paint(ctx, env, P.glass, () => U.rr(ctx, 0.4, -2.4, 1.6, 4.8, 0.3), 0.55);
    ink(ctx, env, P.red, 0.25, () => {
      ctx.moveTo(1.2, -2.4);
      ctx.lineTo(1.2, 2.4);
    });
    ctx.restore();
  }

  K.registerFind(23, { id: 'slideRule', label: 'Slide rule', slot: 'item', place: { name: 'MIT Killian Court', city: 'Cambridge', lat: 42.3588, lon: -71.0915, radius: 600 } }, slideRule);
})(window.Bud);
