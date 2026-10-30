/* Crimson scarf, worn at the neck: a piece found at Harvard Yard, Cambridge (find 14). */
(function (K) {
  'use strict';
  const { C, scarf } = K.AccKit;

  // Harvard Yard: a crimson and white scarf (the scarf, in the school's colors).
  function crimsonScarf(ctx, a, env) {
    const e = Object.create(env);
    e.accColors = Object.assign({}, env.accColors, { scarf: C.crimson, scarf2: C.cup });
    scarf(ctx, a, e);
  }

  K.registerFind(14, { id: 'crimsonScarf', label: 'Crimson scarf', slot: 'neck', place: { name: 'Harvard Yard', city: 'Cambridge', lat: 42.3744, lon: -71.1169, radius: 600 } }, crimsonScarf);
})(window.Bud);
