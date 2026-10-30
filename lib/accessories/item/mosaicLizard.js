/* Mosaic lizard, held: a piece found at Park Güell, Barcelona (find 92: Europe). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { C, hold, paint } = K.AccKit;

  // Park Güell: a little lizard in mosaic tiles.
  function mosaicLizard(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ctx.rotate(-0.4);
    const tiles = [U.rgb('#2BB3A3'), U.rgb('#FFD84D'), U.rgb('#4A8FE7'), U.rgb('#F28A3C'), U.rgb('#7FD1AE')];
    ctx.beginPath();
    U.ellipse(ctx, 0, 0, 5, 2);
    U.ellipse(ctx, 5.4, -0.4, 2, 1.5);
    ctx.moveTo(-4.6, -0.6);
    ctx.quadraticCurveTo(-8, 0, -7.4, 3.4);
    ctx.quadraticCurveTo(-7, 0.8, -4.6, 0.8);
    for (const [x, s] of [[-2.4, 1], [2.4, 1], [-2.4, -1], [2.4, -1]]) U.ellipse(ctx, x, s * 2.4, 0.7, 1.4, s * 0.4);
    ctx.fillStyle = env.c(tiles[0]);
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 40; i++) {
      paint(ctx, env, tiles[i % tiles.length], () => ctx.rect(-8 + (i % 10) * 1.6, -3.4 + Math.floor(i / 10) * 1.7, 1.4, 1.5));
    }
    ctx.restore();
    paint(ctx, env, C.lens, () => ctx.arc(6.2, -1, 0.4, 0, TAU));
    ctx.restore();
  }

  K.registerFind(92, { id: 'mosaicLizard', label: 'Mosaic lizard', slot: 'item', place: { name: 'Park Güell', city: 'Barcelona', lat: 41.4139, lon: 2.1526, radius: 600 } }, mosaicLizard);
})(window.Bud);
