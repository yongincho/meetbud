// meetbud.app/app on a wide screen: Bud on the back of a phone beside the app, as the first web app
// had it. The app says what Bud shows (mobile/src/bud/web-device.web.ts: a "bud-face" event with the
// face's state, look, outfit and shell color), so this Bud thinks and talks with the chat and wears
// what Looks picks; a tap says hi. Bud's renderer (lib/, the files in window.BUD_LIB) loads only on
// a wide screen. tools/site.mjs puts this file, rig.css and the rig's markup on the app's page.
(function () {
  'use strict';
  var WIDE = window.matchMedia('(min-width: 960px)');
  var BUD_MM = 44, BUD_AT = { x: 35.8, y: 74 }; // where the landing page and the first web app put Bud
  var BASE = { oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: true };
  var started = false;

  function load(list, done) { // one after another, in order
    var i = 0;
    (function next() {
      if (i >= list.length) return done();
      var s = document.createElement('script');
      s.src = list[i++];
      s.onload = s.onerror = next;
      document.head.appendChild(s);
    })();
  }
  function start() {
    if (started || !WIDE.matches) return;
    started = true;
    load(window.BUD_LIB || [], build);
  }

  function build() {
    var K = window.Bud;
    var rig = document.getElementById('bud-rig');
    if (!K || !K.Screen || !K.phoneSvg || !rig) return;
    var box = rig.querySelector('.rig-phone'), art = rig.querySelector('.rig-art'), bud = rig.querySelector('.rig-bud');
    var screen = new K.Screen(bud.querySelector('.rig-screen'), { fps: 30, bloom: false });
    var cfgOf = function (look, outfit) {
      if (outfit) {
        var acc = {};
        ['head', 'face', 'neck', 'item'].forEach(function (s) { if (outfit[s]) acc[s] = outfit[s]; });
        return { character: 'eyes', theme: outfit.theme || 'classic', acc: acc, ambient: outfit.ambient || null };
      }
      return look && K.PACKS.some(function (p) { return p.id === look; })
        ? { character: 'skins', base: 'eyes', pack: look } : { character: 'eyes', theme: 'classic', acc: {}, ambient: null };
    };
    var worn = null, hello = 0;
    function show(d) {
      d = d || {};
      var key = JSON.stringify([d.look || '', d.outfit || null]);
      if (key !== worn) {
        worn = key;
        screen.set(Object.assign({}, BASE, cfgOf(d.look, d.outfit)));
      }
      if (!hello) screen.set({ state: d.state || 'idle' });
      if (d.shell) bud.style.setProperty('--shell', d.shell);
    }
    // the phone, in millimeters at its box's size, and Bud 44 mm across below the camera
    function draw() {
      var base = K.phones.get('iphone');
      if (!base || !box.clientWidth) return;
      var ppm = box.clientWidth / base.w, pad = 1.6; // phoneSvg's margin for the side buttons, in mm
      var phone = Object.assign({}, base, { h: box.clientHeight / ppm });
      art.innerHTML = K.phoneSvg(phone, 'black');
      Object.assign(art.firstElementChild.style, {
        left: -pad * ppm + 'px', top: -pad * ppm + 'px', width: (phone.w + pad * 2) * ppm + 'px', height: (phone.h + pad * 2) * ppm + 'px',
      });
      bud.style.setProperty('--bx', BUD_AT.x * ppm + 'px');
      bud.style.setProperty('--by', Math.min(BUD_AT.y, phone.h - BUD_MM / 2 - 6) * ppm + 'px');
      bud.style.setProperty('--d', BUD_MM * ppm + 'px');
    }
    document.body.classList.add('rig-on');
    draw();
    window.addEventListener('resize', draw);
    show(window.budFace || { state: 'idle' });
    window.addEventListener('bud-face', function (e) { show(e.detail); });
    bud.addEventListener('click', function () {
      clearTimeout(hello);
      screen.set({ state: 'hello' });
      hello = setTimeout(function () { hello = 0; show(window.budFace); }, 1800);
    });
  }

  if (WIDE.addEventListener) WIDE.addEventListener('change', start);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
