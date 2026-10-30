/* Scarf, worn at the neck: built-in accessory 13 (its outfit code). The kit draws it
 * (K.AccKit.scarf), since the school and tartan scarves wear it too. */
(function (K) {
  'use strict';
  const { scarf } = K.AccKit;

  K.registerBuiltin(13, { id: 'scarf', label: 'Scarf', slot: 'neck', kind: 'Scarf' }, scarf);
})(window.Bud);
