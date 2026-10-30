/* Cherry branch, held: a piece found at Tidal Basin, Washington (find 46: across the US). */
(function (K) {
  'use strict';
  const U = K.util;
  const { sway, flower, hold, ink } = K.AccKit;

  // The Tidal Basin: a cherry branch in bloom.
  function cherryBranch(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, U.rgb('#6B4423'), 0.7, () => {
      ctx.moveTo(-1, 6.4);
      ctx.quadraticCurveTo(0, 0, 3.4, -8.4);
      ctx.moveTo(0.6, -1);
      ctx.quadraticCurveTo(-2.4, -3.6, -4.2, -6);
    });
    for (const [x, y, r] of [[3.4, -8.4, 1.6], [1.4, -4, 1.4], [-4.2, -6, 1.5], [-1.6, -3.2, 1.1], [0.4, 1.4, 1.2]]) {
      flower(ctx, x, y, r, env, x + sway(env, 1.4, y) * 0.1);
    }
    ctx.restore();
  }

  K.registerFind(46, { id: 'cherryBranch', label: 'Cherry branch', slot: 'item', place: { name: 'Tidal Basin', city: 'Washington', lat: 38.884, lon: -77.0385, radius: 800 } }, cherryBranch);
})(window.Bud);
