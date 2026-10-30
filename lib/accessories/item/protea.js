/* Protea, held: a piece found at Kirstenbosch Garden, Cape Town (find 102: Africa). */
(function (K) {
  'use strict';
  const U = K.util;
  const { P, hold, paint, ink } = K.AccKit;

  // Kirstenbosch: a king protea.
  function protea(ctx, a, env) {
    hold(ctx, a, env, 2, 0.35);
    ink(ctx, env, P.leafDark, 0.7, () => {
      ctx.moveTo(0, 6.4);
      ctx.lineTo(0, 0);
    });
    paint(ctx, env, P.leaf, () => {
      U.ellipse(ctx, -1.8, 4.4, 1.8, 0.6, -0.5);
      U.ellipse(ctx, 1.8, 3.4, 1.8, 0.6, 0.5);
    });
    const pink = U.rgb('#F28AB2');
    for (let i = 0; i < 9; i++) {
      const t = -Math.PI + (i / 8) * Math.PI;
      ctx.save();
      ctx.translate(0, -1);
      ctx.rotate(t + Math.PI / 2);
      paint(ctx, env, i % 2 ? pink : U.darken(pink, 0.12), () => {
        ctx.moveTo(-0.9, 0);
        ctx.quadraticCurveTo(-0.8, -4, 0, -5.4);
        ctx.quadraticCurveTo(0.8, -4, 0.9, 0);
        ctx.closePath();
      });
      ctx.restore();
    }
    paint(ctx, env, U.rgb('#FBE7EF'), () => U.ellipse(ctx, 0, -2.4, 2.2, 2.6));
    ink(ctx, env, U.rgb('#E7B8C9'), 0.25, () => {
      for (const x of [-1, 0, 1]) {
        ctx.moveTo(x * 0.8, -0.2);
        ctx.lineTo(x * 1.4, -4.4);
      }
    });
    ctx.restore();
  }

  K.registerFind(102, { id: 'protea', label: 'Protea', slot: 'item', place: { name: 'Kirstenbosch Garden', city: 'Cape Town', lat: -33.9866, lon: 18.4313, radius: 1000 } }, protea);
})(window.Bud);
