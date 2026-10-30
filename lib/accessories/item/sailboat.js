/* Sailboat, held: a piece found at Charles River Esplanade, Boston (find 25: Boston and New England). */
(function (K) {
  'use strict';
  const { C, sway, P, hold, paint, ink } = K.AccKit;

  // The Esplanade: a little sailboat on the Charles.
  function sailboat(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.6);
    ctx.rotate(sway(env, 1.8) * 0.06);
    ink(ctx, env, P.woodDark, 0.5, () => {
      ctx.moveTo(0, 2.4);
      ctx.lineTo(0, -10);
    });
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(0.4, -9.6);
      ctx.quadraticCurveTo(5.4, -4, 5, 1.2);
      ctx.lineTo(0.4, 1.2);
      ctx.closePath();
    });
    paint(ctx, env, P.sea, () => {
      ctx.moveTo(-0.4, -7.4);
      ctx.quadraticCurveTo(-3.6, -3, -3.6, 1.2);
      ctx.lineTo(-0.4, 1.2);
      ctx.closePath();
    });
    paint(ctx, env, P.red, () => {
      ctx.moveTo(0.2, -10);
      ctx.lineTo(2.2, -9.4);
      ctx.lineTo(0.2, -8.8);
      ctx.closePath();
    });
    paint(ctx, env, P.red, () => {
      ctx.moveTo(-5.6, 2);
      ctx.lineTo(6, 2);
      ctx.lineTo(4.4, 4.6);
      ctx.lineTo(-4.2, 4.6);
      ctx.closePath();
    });
    paint(ctx, env, C.cup, () => ctx.rect(-5.2, 2.6, 10.8, 0.6));
    ink(ctx, env, P.sea, 0.6, () => {
      ctx.moveTo(-6, 5.6);
      for (let i = 0; i < 6; i++) ctx.quadraticCurveTo(-5 + i * 2, 4.8 + sway(env, 3, i) * 0.3, -4 + i * 2, 5.6);
    }, 0.8);
    ctx.restore();
  }

  K.registerFind(25, { id: 'sailboat', label: 'Sailboat', slot: 'item', place: { name: 'Charles River Esplanade', city: 'Boston', lat: 42.3573, lon: -71.0737, radius: 400 } }, sailboat);
})(window.Bud);
