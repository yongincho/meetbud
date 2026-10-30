/* Llama, held: a piece found at Machu Picchu, Cusco (find 106: the Americas). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { hold, paint, plushEyes } = K.AccKit;

  // Machu Picchu: a fluffy llama with a woven blanket.
  function llama(ctx, a, env) {
    hold(ctx, a, env, 2.2, 0.4);
    const wool = U.rgb('#F7EEDF');
    paint(ctx, env, wool, () => {
      for (const [x, y, r] of [[-2.8, 2.6, 2.2], [0, 2, 2.6], [2.8, 2.6, 2.2], [-1.4, 4, 2], [1.6, 4, 2]]) ctx.arc(x, y, r, 0, TAU);
      U.rr(ctx, -3.2, 4.6, 1.2, 2, 0.5);
      U.rr(ctx, 2, 4.6, 1.2, 2, 0.5);
    });
    paint(ctx, env, wool, () => {
      U.rr(ctx, 1.6, -5.8, 2.6, 8, 1.3);
      U.ellipse(ctx, 3.4, -6.6, 2.2, 1.9);
      U.ellipse(ctx, 2.2, -8.8, 0.5, 1.4, -0.2);
      U.ellipse(ctx, 4.2, -8.9, 0.5, 1.4, 0.2);
    });
    const stripes = [U.rgb('#E2433B'), U.rgb('#FFD84D'), U.rgb('#2BB3A3'), U.rgb('#9B6BD8')];
    stripes.forEach((col, i) => paint(ctx, env, col, () => ctx.rect(-2.4 + i * 1.2, 0.2, 1.2, 2.6)));
    plushEyes(ctx, env, 3.4, -6.9, 0.85, 0.35);
    paint(ctx, env, U.rgb('#E9D9C0'), () => U.ellipse(ctx, 3.6, -5.4, 1, 0.7));
    ctx.restore();
  }

  K.registerFind(106, { id: 'llama', label: 'Llama', slot: 'item', place: { name: 'Machu Picchu', city: 'Cusco', lat: -13.1638, lon: -72.5453, radius: 1000 } }, llama);
})(window.Bud);
