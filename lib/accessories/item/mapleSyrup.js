/* Maple syrup, held: a piece found at Château Frontenac, Quebec City (find 103: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, hold, paint, ink, gleam } = K.AccKit;

  // Château Frontenac: a jug of maple syrup with a red leaf on the label.
  function mapleSyrup(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    paint(ctx, env, U.rgb('#C46A1A'), () => {
      ctx.moveTo(-1.2, -6.2);
      ctx.lineTo(1.2, -6.2);
      ctx.lineTo(1.4, -4);
      ctx.bezierCurveTo(4.6, -3.2, 4.8, -1, 4.8, 1);
      ctx.lineTo(4.8, 5.4);
      ctx.lineTo(-4.8, 5.4);
      ctx.lineTo(-4.8, 1);
      ctx.bezierCurveTo(-4.8, -1, -4.6, -3.2, -1.4, -4);
      ctx.closePath();
    }, 0.92);
    ink(ctx, env, U.rgb('#C46A1A'), 0.9, () => ctx.arc(4.4, -0.6, 1.8, -1.6, 1.4), 0.92);
    paint(ctx, env, C.cup, () => U.rr(ctx, -3.8, -0.4, 7.6, 4.4, 0.6));
    ctx.fillStyle = env.c(U.rgb('#D7263D'));
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? 0.75 : 1.7;
      const t = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i) ctx.lineTo(rad * Math.cos(t), 1.8 + rad * Math.sin(t));
      else ctx.moveTo(rad * Math.cos(t), 1.8 + rad * Math.sin(t));
    }
    ctx.closePath();
    ctx.fill();
    paint(ctx, env, U.rgb('#D7263D'), () => ctx.rect(-0.15, 1.8, 0.3, 1.4));
    paint(ctx, env, U.rgb('#2B2D35'), () => U.rr(ctx, -1.4, -7, 2.8, 1.2, 0.4));
    gleam(ctx, env, -3.4, -1.6, 0.5, 1.6, 0.2, 0.3);
    ctx.restore();
  }

  K.registerFind(103, { id: 'mapleSyrup', label: 'Maple syrup', slot: 'item', place: { name: 'Château Frontenac', city: 'Quebec City', lat: 46.8116, lon: -71.205, radius: 500 } }, mapleSyrup);
})(window.Bud);
