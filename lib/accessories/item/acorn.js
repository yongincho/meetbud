/* Acorn, held: a piece found at Bethesda Terrace, Central Park, New York (find 35: New York). */
(function (K) {
  'use strict';
  const U = K.util;
  const { hold, paint, ink, gleam } = K.AccKit;

  // Central Park: an acorn, for the squirrels.
  function acorn(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    paint(ctx, env, U.rgb('#C98B4E'), () => {
      ctx.moveTo(-3.8, -1.4);
      ctx.bezierCurveTo(-4, 4, -1, 6.4, 0, 6.6);
      ctx.bezierCurveTo(1, 6.4, 4, 4, 3.8, -1.4);
      ctx.closePath();
    });
    gleam(ctx, env, -1.6, 1.6, 0.6, 2, 0.2, 0.3);
    paint(ctx, env, U.rgb('#7A5230'), () => {
      ctx.moveTo(-4.6, -0.6);
      ctx.bezierCurveTo(-4.8, -5, 4.8, -5, 4.6, -0.6);
      ctx.quadraticCurveTo(0, 0.6, -4.6, -0.6);
    });
    ink(ctx, env, U.rgb('#5A3A20'), 0.3, () => {
      for (let i = -3; i <= 3; i++) {
        ctx.moveTo(i * 1.2 - 0.6, -3.6);
        ctx.lineTo(i * 1.2 + 0.6, -0.4);
        ctx.moveTo(i * 1.2 + 0.6, -3.6);
        ctx.lineTo(i * 1.2 - 0.6, -0.4);
      }
    }, 0.7);
    ink(ctx, env, U.rgb('#5A3A20'), 0.7, () => {
      ctx.moveTo(0, -3.8);
      ctx.quadraticCurveTo(0.4, -5.2, 1.4, -5.6);
    });
    ctx.restore();
  }

  K.registerFind(35, { id: 'acorn', label: 'Acorn', slot: 'item', place: { name: 'Bethesda Terrace, Central Park', city: 'New York', lat: 40.7742, lon: -73.9711, radius: 800 } }, acorn);
})(window.Bud);
