/* Manatee, held: a piece found at Blue Spring State Park, Orange City (find 57: Florida). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, gleam, plushEyes } = K.AccKit;

  // Blue Spring: a gentle manatee.
  function manatee(ctx, a, env) {
    hold(ctx, a, env, 1.6, 0.5);
    const skin = U.rgb('#9AA3AE');
    ctx.rotate(-0.15);
    paint(ctx, env, skin, () => {
      U.ellipse(ctx, 0, 0, 5.4, 3.4);
      U.ellipse(ctx, 5.6, 1.2, 2.2, 1.8);
      U.ellipse(ctx, -0.6, 3.2, 1.6, 0.7, 0.5);
    });
    paint(ctx, env, U.lighten(skin, 0.25), () => U.ellipse(ctx, -4.4, 0.4, 2.2, 1.9));
    plushEyes(ctx, env, -3.6, -1.2, 0.01, 0.38);
    paint(ctx, env, U.darken(skin, 0.2), () => {
      ctx.arc(-5.6, 0.2, 0.2, 0, TAU);
      ctx.arc(-5.1, 0.8, 0.2, 0, TAU);
    });
    gleam(ctx, env, 0, -2, 2.6, 0.6, 0, 0.25);
    ctx.restore();
  }

  K.registerFind(57, { id: 'manatee', label: 'Manatee', slot: 'item', place: { name: 'Blue Spring State Park', city: 'Orange City', lat: 28.9481, lon: -81.34, radius: 1200 } }, manatee);
})(window.Bud);
