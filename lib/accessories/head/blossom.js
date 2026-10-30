/* Blossom, worn on the head: built-in accessory 9 (its outfit code). */
(function (K) {
  'use strict';
  const { sway, begin, flower } = K.AccKit;

  function blossom(ctx, a, env) {
    const w = a.w;
    begin(ctx, a);
    flower(ctx, w * 0.3, -w * 0.06, w * 0.2, env, 0.3 + sway(env, 1.2) * 0.08);
    flower(ctx, w * 0.12, -w * 0.18, w * 0.13, env, 1.1);
    ctx.restore();
  }

  K.registerBuiltin(9, { id: 'blossom', label: 'Blossom', kr: '벚꽃', slot: 'head', kind: 'Flower (spring)' }, blossom);
})(window.Bud);
