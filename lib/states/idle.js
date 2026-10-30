/* Idle: state 0, the number Bluetooth sends. */
(function (K) {
  'use strict';
  const { osc, blink } = K.util;
  const { saccade } = K.StateKit;

  K.registerState(0, { id: 'idle', label: 'Idle', group: 'Conversation', key: '1', loop: 6.0, hint: 'Breathing, blinking, quick glances.' }, {
    base(p, tt, L, x) {
      const b = osc(tt, L, 2);
      p.sy = 1 + 0.028 * b;
      p.sx = 1 - 0.018 * b;
      p.y = -1.4 * osc(tt, L, 2, 0.15);
      p.eyeOpen = blink(x, [1.3, 4.4, 4.68]);
      const [lx, ly] = saccade(x, [[1.9, -0.55, 0.1], [2.55, -0.62, 0.04], [3.3, 0, 0], [4.95, 0.5, -0.12], [5.6, 0, 0]]);
      p.lookX = lx + 0.025 * osc(tt, L, 11);
      p.lookY = ly + 0.02 * osc(tt, L, 7, 0.3);
      p.mouthCurve = 0.45;
    },
  });
})(window.Bud);
