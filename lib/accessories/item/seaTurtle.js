/* Sea turtle, held: a piece found at New England Aquarium, Boston (find 22: Boston and New England). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { sway, hold, paint, ink, gleam, plushEyes } = K.AccKit;

  // The New England Aquarium: a green sea turtle, paddling.
  function seaTurtle(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.5);
    const skin = U.rgb('#9BCB7A');
    const p = sway(env, 2.4) * 0.25;
    paint(ctx, env, skin, () => {
      U.ellipse(ctx, -4.4, -2.8, 2.4, 1, -0.6 + p);
      U.ellipse(ctx, 4.4, -2.8, 2.4, 1, 0.6 - p);
      U.ellipse(ctx, -3.6, 3.6, 1.8, 0.8, 0.6 - p);
      U.ellipse(ctx, 3.6, 3.6, 1.8, 0.8, -0.6 + p);
      U.ellipse(ctx, 0, -6, 1.8, 1.9);
    });
    plushEyes(ctx, env, 0, -6.4, 0.8, 0.35);
    paint(ctx, env, U.rgb('#3F8F5A'), () => U.ellipse(ctx, 0, 0.4, 4.4, 5));
    ink(ctx, env, U.rgb('#2C6B43'), 0.35, () => {
      ctx.moveTo(-1.4, -2.6);
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * TAU - Math.PI / 2;
        ctx.lineTo(1.6 * Math.cos(t), 0.2 + 2 * Math.sin(t));
      }
      ctx.closePath();
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * TAU - Math.PI / 2;
        ctx.moveTo(1.6 * Math.cos(t), 0.2 + 2 * Math.sin(t));
        ctx.lineTo(4 * Math.cos(t), 0.4 + 4.6 * Math.sin(t));
      }
    });
    gleam(ctx, env, -1.6, -2, 1.2, 0.7, -0.5, 0.25);
    ctx.restore();
  }

  K.registerFind(22, { id: 'seaTurtle', label: 'Sea turtle', slot: 'item', place: { name: 'New England Aquarium', city: 'Boston', lat: 42.3592, lon: -71.0494, radius: 300 } }, seaTurtle);
})(window.Bud);
