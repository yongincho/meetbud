/* Guitar, held: a piece found at Lower Broadway, Nashville (find 48: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, hold, paint, ink } = K.AccKit;

  // Lower Broadway, Nashville: an acoustic guitar.
  function guitar(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    ctx.rotate(0.45);
    const body = U.rgb('#D9973F');
    paint(ctx, env, P.woodDark, () => {
      U.rr(ctx, -0.6, -11, 1.2, 8, 0.4);
      U.rr(ctx, -1, -12.6, 2, 2, 0.5);
    });
    paint(ctx, env, body, () => {
      ctx.arc(0, -1.6, 2.6, 0, TAU);
      ctx.arc(0, 2.6, 3.4, 0, TAU);
    });
    paint(ctx, env, U.darken(body, 0.18), () => ctx.arc(0, 2.6, 3.4, 0.2, Math.PI - 0.2), 0.5);
    paint(ctx, env, U.rgb('#2B1A10'), () => ctx.arc(0, 0.2, 1.05, 0, TAU));
    paint(ctx, env, P.woodDark, () => U.rr(ctx, -1.4, 3.6, 2.8, 0.6, 0.3));
    ink(ctx, env, U.rgb('#F2EAD6'), 0.12, () => {
      for (const x of [-0.3, 0, 0.3]) {
        ctx.moveTo(x, -11);
        ctx.lineTo(x, 3.8);
      }
    }, 0.8);
    ctx.restore();
  }

  K.registerFind(48, { id: 'guitar', label: 'Guitar', slot: 'item', place: { name: 'Lower Broadway', city: 'Nashville', lat: 36.1614, lon: -86.7761, radius: 600 } }, guitar);
})(window.Bud);
