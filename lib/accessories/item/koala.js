/* Koala, held: a piece found at Lone Pine Koala Sanctuary, Brisbane (find 96: Oceania). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, gleam, plushEyes, blush } = K.AccKit;

  // Lone Pine: a koala with big fluffy ears.
  function koala(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    const fur = U.rgb('#A3A8B3');
    paint(ctx, env, fur, () => U.ellipse(ctx, 0, 2.8, 4.2, 3.6));
    paint(ctx, env, U.lighten(fur, 0.4), () => U.ellipse(ctx, 0, 3.4, 2.6, 2.4));
    for (const s of [-1, 1]) {
      paint(ctx, env, fur, () => ctx.arc(s * 4, -4.8, 2.6, 0, TAU));
      paint(ctx, env, U.lighten(fur, 0.55), () => ctx.arc(s * 4.1, -4.6, 1.5, 0, TAU));
    }
    paint(ctx, env, fur, () => U.ellipse(ctx, 0, -3, 4.4, 3.8));
    plushEyes(ctx, env, 0, -3.6, 2.2, 0.55);
    paint(ctx, env, U.rgb('#3A3D45'), () => U.ellipse(ctx, 0, -2.2, 1.1, 1.5));
    gleam(ctx, env, -0.3, -2.9, 0.3, 0.5, 0, 0.5);
    blush(ctx, env, 0, -1.6, 3, 0.6);
    ctx.restore();
  }

  K.registerFind(96, { id: 'koala', label: 'Koala', slot: 'item', place: { name: 'Lone Pine Koala Sanctuary', city: 'Brisbane', lat: -27.534, lon: 152.9688, radius: 600 } }, koala);
})(window.Bud);
