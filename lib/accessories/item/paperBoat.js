/* Paper boat, held: a piece found at Cheonggye Plaza, Seoul (find 62: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { C, sway, P, hold, paint, ink } = K.AccKit;

  // Cheonggyecheon: a folded paper boat, bobbing on the stream.
  function paperBoat(ctx, a, env) {
    hold(ctx, a, env, 1.8, 0.6);
    ctx.rotate(sway(env, 1.8) * 0.08);
    paint(ctx, env, P.sea, () => U.ellipse(ctx, 0, 4.8, 6.4, 1.2), 0.5);
    paint(ctx, env, U.rgb('#BFE2F5'), () => {
      ctx.moveTo(-6, 0.4);
      ctx.lineTo(6, 0.4);
      ctx.lineTo(4, 4.2);
      ctx.lineTo(-4, 4.2);
      ctx.closePath();
    });
    paint(ctx, env, C.cup, () => {
      ctx.moveTo(-3, 0.6);
      ctx.lineTo(0, -6);
      ctx.lineTo(3, 0.6);
      ctx.closePath();
    });
    paint(ctx, env, U.rgb('#E3EEF7'), () => {
      ctx.moveTo(0, -6);
      ctx.lineTo(3, 0.6);
      ctx.lineTo(0.6, 0.6);
      ctx.closePath();
    });
    ink(ctx, env, U.rgb('#8FB8D8'), 0.3, () => {
      ctx.moveTo(-6, 0.4);
      ctx.lineTo(-3, 0.6);
      ctx.moveTo(6, 0.4);
      ctx.lineTo(3, 0.6);
    });
    ctx.restore();
  }

  K.registerFind(62, { id: 'paperBoat', label: 'Paper boat', kr: '종이배', slot: 'item', place: { name: 'Cheonggye Plaza', city: 'Seoul', lat: 37.5692, lon: 126.9778, radius: 450 } }, paperBoat);
})(window.Bud);
