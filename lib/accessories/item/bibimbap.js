/* Bibimbap, held: a piece found at Jeonju Hanok Village, Jeonju (find 70: Korea). */
(function (K) {
  'use strict';
  const U = K.util;
  const { TAU } = U;
  const { P, WHITE, hold, paint, steam } = K.AccKit;

  // Jeonju: bibimbap in a hot stone bowl, an egg in the middle.
  function bibimbap(ctx, a, env) {
    hold(ctx, a, env, 2, 0.3);
    steam(ctx, env, -4.6);
    paint(ctx, env, U.rgb('#3B3F48'), () => {
      ctx.moveTo(-5.8, -2.2);
      ctx.lineTo(5.8, -2.2);
      ctx.bezierCurveTo(5.4, 3.8, 3, 5, 0, 5);
      ctx.bezierCurveTo(-3, 5, -5.4, 3.8, -5.8, -2.2);
    });
    paint(ctx, env, U.rgb('#5A606C'), () => U.ellipse(ctx, 0, -2.2, 5.8, 1.6));
    const top = [P.leaf, U.rgb('#F28A3C'), U.rgb('#8A5A2B'), P.yellow, U.rgb('#C0392B')];
    top.forEach((col, i) => {
      const t = (i / top.length) * TAU;
      paint(ctx, env, col, () => U.ellipse(ctx, Math.cos(t) * 3, -2.2 + Math.sin(t) * 0.8, 1.6, 0.6, t * 0.2));
    });
    paint(ctx, env, WHITE, () => U.ellipse(ctx, 0, -2.4, 1.7, 0.75));
    paint(ctx, env, U.rgb('#FFB21F'), () => ctx.arc(0, -2.5, 0.55, 0, TAU));
    ctx.restore();
  }

  K.registerFind(70, { id: 'bibimbap', label: 'Bibimbap', kr: '비빔밥', slot: 'item', place: { name: 'Jeonju Hanok Village', city: 'Jeonju', lat: 35.8153, lon: 127.1517, radius: 800 } }, bibimbap);
})(window.Bud);
