/* Double-decker, held: a piece found at Tower Bridge, London (find 82: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, P, hold, paint } = K.AccKit;

  // Tower Bridge: a red double-decker bus.
  function bus(ctx, a, env) {
    hold(ctx, a, env, 2.6, 0.25);
    paint(ctx, env, U.rgb('#D7263D'), () => U.rr(ctx, -6.8, -7, 13.6, 11.4, 1.6));
    paint(ctx, env, U.rgb('#BFE2F5'), () => {
      for (const x of [-5.8, -2.8, 0.2, 3.2]) {
        U.rr(ctx, x, -6, 2.4, 2.4, 0.4);
        U.rr(ctx, x, -1.4, 2.4, 2.4, 0.4);
      }
    });
    paint(ctx, env, C.cup, () => ctx.rect(-6.8, -3.2, 13.6, 0.6));
    paint(ctx, env, P.ink, () => {
      ctx.arc(-3.8, 4.4, 1.4, 0, TAU);
      ctx.arc(3.8, 4.4, 1.4, 0, TAU);
    });
    paint(ctx, env, C.steel, () => {
      ctx.arc(-3.8, 4.4, 0.5, 0, TAU);
      ctx.arc(3.8, 4.4, 0.5, 0, TAU);
    });
    paint(ctx, env, P.yellow, () => ctx.arc(6.1, 2.6, 0.45, 0, TAU));
    ctx.restore();
  }

  K.registerFind(82, { id: 'bus', label: 'Double-decker', slot: 'item', place: { name: 'Tower Bridge', city: 'London', lat: 51.5055, lon: -0.0754, radius: 500 } }, bus);
})(window.Bud);
