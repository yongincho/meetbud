/* Tulip, held: a piece found at Keukenhof, Lisse (find 86: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, P, hold, paint, ink } = K.AccKit;

  // Keukenhof: a red tulip.
  function tulip(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.rotate(sway(env, 1.4) * 0.05);
    ink(ctx, env, P.leafDark, 0.6, () => {
      ctx.moveTo(0, 6.4);
      ctx.lineTo(0, -3);
    });
    paint(ctx, env, P.leaf, () => {
      ctx.moveTo(0, 5.6);
      ctx.quadraticCurveTo(-4.4, 2, -3.2, -2.4);
      ctx.quadraticCurveTo(-1.4, 1.4, 0, 3.4);
      ctx.moveTo(0, 4.6);
      ctx.quadraticCurveTo(3.6, 2.6, 3.4, -1.2);
      ctx.quadraticCurveTo(1.6, 1.2, 0, 2.6);
    });
    const red = U.rgb('#E8402E');
    paint(ctx, env, red, () => {
      ctx.moveTo(-3, -6.6);
      ctx.lineTo(-1.5, -4.8);
      ctx.lineTo(0, -7.4);
      ctx.lineTo(1.5, -4.8);
      ctx.lineTo(3, -6.6);
      ctx.bezierCurveTo(3.4, -2.6, 2.4, -1.8, 0, -1.8);
      ctx.bezierCurveTo(-2.4, -1.8, -3.4, -2.6, -3, -6.6);
    });
    paint(ctx, env, U.lighten(red, 0.25), () => U.ellipse(ctx, -1, -4.4, 0.6, 1.6, 0.2), 0.7);
    ctx.restore();
  }

  K.registerFind(86, { id: 'tulip', label: 'Tulip', slot: 'item', place: { name: 'Keukenhof', city: 'Lisse', lat: 52.2706, lon: 4.5468, radius: 800 } }, tulip);
})(window.Bud);
