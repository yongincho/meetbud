/* Dolphin, held: a piece found at Clearwater Beach, Clearwater (find 52: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, sway, P, WHITE, hold, paint } = K.AccKit;

  // Clearwater Beach: a dolphin leaping out of a splash.
  function dolphin(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.6);
    const body = U.rgb('#6FA3D8');
    ctx.rotate(-0.3);
    paint(ctx, env, body, () => {
      ctx.moveTo(-6, 2.4);
      ctx.bezierCurveTo(-5.4, -3.4, 0, -6, 4.4, -3.4);
      ctx.quadraticCurveTo(6.4, -2.8, 6.8, -1.8);
      ctx.quadraticCurveTo(5.4, -1.6, 4.4, -1.2);
      ctx.bezierCurveTo(1, -1.2, -2.4, 0.6, -4, 3.6);
      ctx.closePath();
      ctx.moveTo(-0.6, -4.4);
      ctx.quadraticCurveTo(0.2, -7.2, 2, -7.6);
      ctx.quadraticCurveTo(1.4, -5.6, 1.6, -4.4);
      ctx.closePath();
      ctx.moveTo(-5.2, 2.4);
      ctx.quadraticCurveTo(-7.6, 3.4, -8, 5.6);
      ctx.quadraticCurveTo(-6, 4.2, -4.8, 4.6);
      ctx.quadraticCurveTo(-4.4, 5.8, -2.6, 6.6);
      ctx.quadraticCurveTo(-3.4, 4.6, -4, 3.4);
      ctx.closePath();
    });
    paint(ctx, env, U.lighten(body, 0.55), () => {
      ctx.moveTo(-3.6, 2.6);
      ctx.bezierCurveTo(-2, -0.6, 1.6, -1.4, 4.6, -1.3);
      ctx.bezierCurveTo(1.4, -0.4, -1.6, 0.8, -3.6, 2.6);
    });
    paint(ctx, env, C.lens, () => ctx.arc(3.2, -3.4, 0.45, 0, TAU));
    paint(ctx, env, WHITE, () => ctx.arc(3.05, -3.6, 0.15, 0, TAU));
    ctx.rotate(0.3);
    paint(ctx, env, P.sea, () => {
      for (const [x, y, r] of [[-5.6, 6.4, 0.7], [-2.2, 6.8, 0.55], [-7.4, 5.6, 0.45], [0.2, 6.2, 0.4]]) ctx.arc(x, y + sway(env, 3, x) * 0.3, r, 0, TAU);
    }, 0.85);
    ctx.restore();
  }

  K.registerFind(52, { id: 'dolphin', label: 'Dolphin', slot: 'item', place: { name: 'Clearwater Beach', city: 'Clearwater', lat: 27.9772, lon: -82.8289, radius: 1000 } }, dolphin);
})(window.Bud);
