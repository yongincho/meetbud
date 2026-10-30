/* Campus pennants, held: found at Stanford and Berkeley. */
(function (K) {
  'use strict';
  const { TAU } = K.util;
  const { C, sway, star5, P, hold, paint, ink } = K.AccKit;

  // A campus pennant on a stick, in the school's colors (no letters, no crest).
  function pennant(main, trim) {
    return (ctx, a, env) => {
      hold(ctx, a, env, 1.8, 0.3);
      ink(ctx, env, C.stick, 0.9, () => {
        ctx.moveTo(-4.4, 6);
        ctx.lineTo(-4.4, -10.4);
      });
      paint(ctx, env, C.gold, () => ctx.arc(-4.4, -10.8, 0.75, 0, TAU));
      const f = sway(env, 3.2) * 0.6;
      ctx.beginPath();
      ctx.moveTo(-4, -10);
      ctx.quadraticCurveTo(0.8, -8.8 + f, 6.4, -6.8 + f * 1.4);
      ctx.quadraticCurveTo(0.8, -5.4 + f, -4, -3.4);
      ctx.closePath();
      ctx.fillStyle = env.c(main);
      ctx.fill();
      ctx.save();
      ctx.clip();
      paint(ctx, env, trim, () => ctx.rect(-4, -10.4, 1.5, 7.4));
      ink(ctx, env, trim, 0.4, () => {
        ctx.moveTo(-2.5, -9.6);
        ctx.quadraticCurveTo(1, -8.5 + f, 6.4, -6.8 + f * 1.4);
      }, 0.7);
      ctx.restore();
      paint(ctx, env, trim, () => star5(ctx, 1.2, -6.6 + f * 0.6, 1.15));
      ctx.restore();
    };
  }
  const stanfordPennant = pennant(P.cardinal, C.cup);
  const berkeleyPennant = pennant(P.berkeley, C.gold);

  K.registerFind(41, { id: 'stanfordPennant', label: 'Stanford pennant', slot: 'item', place: { name: 'Stanford Main Quad', city: 'Stanford', lat: 37.4268, lon: -122.1705, radius: 700 } }, stanfordPennant);
  K.registerFind(42, { id: 'berkeleyPennant', label: 'Berkeley pennant', slot: 'item', place: { name: 'Sather Tower', city: 'Berkeley', lat: 37.8721, lon: -122.2578, radius: 700 } }, berkeleyPennant);
})(window.Bud);
