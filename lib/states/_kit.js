/* The states' kit: the list the state files join, and the motion helpers they share.
 *
 * Each state is one file, lib/states/<id>.js, that registers its K.STATES entry with its number
 * (the first 15 are what Bluetooth sends; the moods follow), its base() motion and Bud's own eye
 * touches (eyes(), which lib/characters/eyes.js calls). lib/pose.js runs them. Copy _template.js
 * to add one, then run node tools/lib-files.mjs.
 */
(function (K) {
  'use strict';
  const U = K.util;
  const { smoothstep } = U;

  // group: how the explorer arranges the buttons. key: keyboard shortcut.
  K.STATES = [];
  const byId = Object.create(null);
  const parts = Object.create(null);
  K.state = (id) => byId[id] || K.STATES[0];

  /**
   * A state: number is its place in K.STATES, def its entry ({ id, label, group, key, loop, hint }),
   * own its base(p, tt, L, x) (motion at state-time tt, x = tt within the loop of L seconds) and
   * eyes(p, e, tt, L) (Bud's touches to its pose, e = p.ex).
   */
  K.registerState = function (number, def, own) {
    K.addRanked(K.STATES, def, number);
    byId[def.id] = def;
    parts[def.id] = own;
    return def;
  };
  const NONE = Object.freeze({});
  /** What a state's file adds to the engine: { base, eyes }, either one may be missing. */
  K.stateParts = (id) => parts[id] || NONE;

  /** Quick eye darts with holds in between, like real eyes. pts: [[time, lookX, lookY], ...] */
  function saccade(x, pts) {
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < pts.length; i++) {
      const [t0, tx, ty] = pts[i];
      if (x < t0) break;
      const k = smoothstep(t0, t0 + 0.09, x);
      cx += (tx - cx) * k;
      cy += (ty - cy) * k;
    }
    return [cx, cy];
  }

  K.StateKit = { saccade };
})(window.Bud);
