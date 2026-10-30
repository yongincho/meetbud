/* School scarves, worn at the neck: the knit scarf in a school's colors, found at Princeton, Yale and Columbia. */
(function (K) {
  'use strict';
  const { C, scarf, P } = K.AccKit;

  // School scarves, in the school's colors (a plain knit scarf, no crest).
  function schoolScarf(main, stripe) {
    return (ctx, a, env) => {
      const e = Object.create(env);
      e.accColors = Object.assign({}, env.accColors, { scarf: main, scarf2: stripe });
      scarf(ctx, a, e);
    };
  }
  const princetonScarf = schoolScarf(P.orange, P.ink);
  const yaleScarf = schoolScarf(P.yale, C.cup);
  const columbiaScarf = schoolScarf(P.columbia, C.cup);

  K.registerFind(31, { id: 'princetonScarf', label: 'Princeton scarf', slot: 'neck', place: { name: 'Nassau Hall', city: 'Princeton', lat: 40.3487, lon: -74.6594, radius: 700 } }, princetonScarf);
  K.registerFind(30, { id: 'yaleScarf', label: 'Yale scarf', slot: 'neck', place: { name: 'Yale Old Campus', city: 'New Haven', lat: 41.3086, lon: -72.9286, radius: 600 } }, yaleScarf);
  K.registerFind(38, { id: 'columbiaScarf', label: 'Columbia scarf', slot: 'neck', place: { name: 'Low Memorial Library', city: 'New York', lat: 40.8083, lon: -73.9619, radius: 500 } }, columbiaScarf);
})(window.Bud);
