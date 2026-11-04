/* The hero's phone in 3D (three.js): a phone with Bud on its back, lit by a soft studio room, with
 * Bud's live face (lib's K.Screen, rendered by hand each frame) as the glowing screen under glass.
 * On load the phone turns from its front to its back, then floats and leans toward the pointer;
 * a tap on Bud plays the hero's little exchange (window.budHero.tap). Sizes are in millimeters.
 * If WebGL or three.js isn't there, the page keeps its photo (the .phone-photo fallback). */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUD, buildBud, light } from './bud3d.js?v=1';

const K = window.Bud;
const host = document.getElementById('phone3d');
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

// the phone, about an iPhone 15 (71.6 x 147.6 x 7.8 mm), and Bud below its camera (bud3d.js)
const PHONE = { w: 71.6, h: 147.6, d: 7.8, r: 11.6, bevel: 1.6 };
const BUD_Y = -6;

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
// a rounded rectangle slab, centered, `d` deep along z
function slab(w, h, r, d, bevel, mats) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.5, r - bevel)), {
    depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 10, curveSegments: 40,
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  return new THREE.Mesh(g, mats);
}

// A dark studio with softboxes, for the reflections: deep blacks on glass and lenses, bright strips on
// metal (an evenly lit room turns every glossy surface gray).
function studio() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(600, 48, 24), new THREE.MeshBasicMaterial({ color: 0x15171c, side: THREE.BackSide })));
  const box = (w, h, x, y, z, k, tint = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
  };
  box(520, 160, 40, 420, 160, 3.0);            // overhead softbox
  box(140, 520, 430, 60, 220, 2.2);            // a strip on the right
  box(140, 460, -440, 0, 160, 1.0, 0xdbe8ff);  // a cool fill on the left
  box(560, 220, 0, -60, 480, 0.55, 0xfff1e0);  // warm bounce from the front
  box(900, 300, 0, -480, 0, 0.35, 0xfff6ec);   // the floor's glow
  return s;
}

// The real phone: "iPhone 18 Pro Max – High Quality 3D Model" by Pro Animator on Sketchfab, CC BY 4.0
// (credited in the page's footer), slimmed for the web (no ground plane or logo, 512 px textures,
// meshopt geometry) and recolored here. Returns it scaled to millimeters, centered, its back toward
// +z, with where Bud goes and a ray test for the back glass's height there.
const IPHONE_H = 163.4; // a 17 or 18 Pro Max's height, mm
async function loadPhone() {
  const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(new URL('models/iphone.glb', import.meta.url).href);
  const root = gltf.scene;
  // its source scene stands the phone up on a floor, tilted a little; undo that
  const body = root.getObjectByName('Object_7_0');
  if (body) { body.position.set(0, 0, 0); body.quaternion.identity(); }
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  const k = IPHONE_H / size.y;
  root.position.sub(mid);
  const group = new THREE.Group();
  group.add(root);
  group.scale.setScalar(k);
  // a light silver-blue frame and a frosted back, for the page's sky (it comes in burgundy)
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    const m = o.material;
    const set = (hex, metal, rough, env = 1) => { m.color.set(hex); m.metalness = metal; m.roughness = rough; m.envMapIntensity = env; m.needsUpdate = true; };
    if (m.name === '17ProMax_color') set(0xc3d2e1, 0.72, 0.3, 1.05);
    else if (m.name === '17ProMax_color2') set(0xb2c8de, 0.05, 0.52, 0.95);
    else if (m.name === '17ProMax_color3') set(0x8d9cad, 0.6, 0.38);
    else if (m.name === '17ProMax_Black2.001') set(0x1b1e24, 0.6, 0.45);
    else if (m.name === '17ProMax_Black2') set(0x040507, 0.1, 0.1, 0.55);
    else if (m.name === '17ProMax_glass') { set(0x080a0e, 0, 0.04, 0.9); m.transparent = true; m.opacity = 0.32; } // the lens covers: clear, so the lenses show
  });
  group.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const backZ = (x, y) => {
    ray.set(new THREE.Vector3(x, y, 300), new THREE.Vector3(0, 0, -1));
    const hit = ray.intersectObject(group, true)[0];
    return hit ? hit.point.z : (size.z * k) / 2;
  };
  return { group, w: size.x * k, h: size.y * k, budY: -0.06 * size.y * k, backZ };
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 700 ? 1.6 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // a bright room for the metal; glass and lenses take only a little of it (envMapIntensity)
  light(THREE, renderer, scene, RoomEnvironment);

  const camera = new THREE.PerspectiveCamera(20, 1, 10, 2000);
  camera.position.set(0, 0, 520);

  /* ------------------------------------------------------------- materials */
  // frosted color glass with a thin glossy coat (soft highlights), and a satin anodized frame
  const glassBack = new THREE.MeshPhysicalMaterial({ color: 0xaecbe6, roughness: 0.58, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.1, envMapIntensity: 0.9 });
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0xc2d5e6, roughness: 0.34, metalness: 0.65, envMapIntensity: 1.0 });
  const front = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.5 });
  const bump = new THREE.MeshPhysicalMaterial({ color: 0xbad3e8, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 });
  const ringMetal = new THREE.MeshPhysicalMaterial({ color: 0xc9d6e2, roughness: 0.14, metalness: 1, envMapIntensity: 1.2 });
  const lensGlass = new THREE.MeshPhysicalMaterial({ color: 0x05070b, roughness: 0.03, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.35 });

  /* ------------------------------------------------------------- the phone */
  // The real phone is a 3D model (models/iphone.glb, loaded below); this drawn one stands in if it
  // can't load.
  const phone = new THREE.Group();
  const drawn = new THREE.Group();
  phone.add(drawn);
  const body = slab(PHONE.w, PHONE.h, PHONE.r, PHONE.d, PHONE.bevel, [glassBack, frameMat]);
  body.rotation.y = Math.PI; // the extrude's +z cap is the back, facing the camera at rest
  drawn.add(body);
  // the screen side: black glass just above the front cap
  const scr = new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(PHONE.w - 2.2, PHONE.h - 2.2, PHONE.r - 1.1), 40), front);
  scr.position.z = -PHONE.d / 2 - 0.02; scr.rotation.y = Math.PI;
  drawn.add(scr);
  // side buttons
  for (const [x, y, h] of [[-1, 38, 6], [-1, 25, 12], [-1, 10, 12], [1, 22, 18]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 3.2), frameMat);
    b.position.set(x * (PHONE.w / 2 + 0.3), y, 0);
    drawn.add(b);
  }
  // the camera: a raised square with two lenses and a flash
  const back = PHONE.d / 2;
  const cam = slab(28.5, 28.5, 7.2, 1.6, 0.5, [bump, bump]);
  cam.position.set(-PHONE.w / 2 + 6 + 14.25, PHONE.h / 2 - 6 - 14.25, back + 0.6);
  drawn.add(cam);
  for (const [dx, dy] of [[-6.4, 6.4], [6.4, -6.4]]) {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.9, 5.9, 1.4, 64), ringMetal);
    ring.rotation.x = Math.PI / 2; ring.position.set(cam.position.x + dx, cam.position.y + dy, back + 1.9);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(4.6, 64), lensGlass);
    lens.position.set(ring.position.x, ring.position.y, back + 2.62);
    const inner = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.4, 48), new THREE.MeshPhysicalMaterial({ color: 0x1b2433, roughness: 0.1, metalness: 0.6 }));
    inner.position.set(lens.position.x, lens.position.y, back + 2.64);
    drawn.add(ring, lens, inner);
  }
  const flash = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), new THREE.MeshPhysicalMaterial({ color: 0xf3efe2, roughness: 0.25, clearcoat: 1 }));
  flash.position.set(cam.position.x + 6.6, cam.position.y + 6.4, back + 1.42);
  drawn.add(flash);
  const dims = { w: PHONE.w, h: PHONE.h }; // the phone shown (the model's, once it loads)

  /* ------------------------------------------------------------- Bud (bud3d.js) */
  const R = BUD.r;
  // the screen: the live face glows under glossy glass
  const faceHost = document.createElement('div');
  // (a 512 px face drawn out of sight: inside a box of no size, so it never widens the page)
  faceHost.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;z-index:-1';
  const faceEl = document.createElement('div');
  faceEl.style.cssText = 'width:512px;height:512px';
  faceHost.appendChild(faceEl);
  document.body.appendChild(faceHost);
  const face = new K.Screen(faceEl, { fps: 60, bloom: true, manual: true });
  face.set({ character: 'eyes', base: 'eyes', pack: 'lantern', theme: 'classic', acc: {}, ambient: null, state: 'hello',
    oled: true, glow: true, grid: false, drift: false, shape: { type: 'circle' }, stage: {}, variety: !REDUCED });
  const tex = new THREE.CanvasTexture(face.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // the face is light, not lit: no tone mapping on it, and only a faint reflection over it
  const screenMat = new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1,
    roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 0.18 });
  screenMat.toneMapped = false;
  const { group: bud, shell, screen } = buildBud(THREE, screenMat);
  bud.position.set(0, BUD_Y, back);
  phone.add(bud);
  // where Bud sits on the glass: a soft contact shadow, a little toward the lower left
  const cc = document.createElement('canvas'); cc.width = cc.height = 256;
  const cg = cc.getContext('2d');
  const cgr = cg.createRadialGradient(124, 132, 92, 126, 130, 120);
  cgr.addColorStop(0, 'rgba(20,32,48,0.42)'); cgr.addColorStop(1, 'rgba(20,32,48,0)');
  cg.fillStyle = cgr; cg.fillRect(0, 0, 256, 256);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(R * 2.42, R * 2.42),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc), transparent: true, depthWrite: false }));
  contact.position.set(0, BUD_Y, back + 0.06);
  phone.add(contact);

  // a soft shadow under it all, as a blurred disc (no ground plane to fight the page's sky)
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const sg = sc.getContext('2d');
  const grad = sg.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(40,52,70,0.38)'); grad.addColorStop(1, 'rgba(40,52,70,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.scale.set(150, 26, 1);
  shadow.position.set(-6, -PHONE.h / 2 - 22, -40);
  scene.add(shadow);

  const rig = new THREE.Group();
  rig.add(phone);
  scene.add(rig);

  // the real phone, when it loads in time (the photo shows until then); Bud on its back glass
  const model = await Promise.race([loadPhone(), new Promise((r) => setTimeout(() => r(null), 5000))]).catch((e) => { console.warn('phone model', e); return null; });
  if (model) {
    drawn.visible = false;
    phone.add(model.group);
    dims.w = model.w; dims.h = model.h;
    const z = model.backZ(0, model.budY);
    bud.position.set(0, model.budY, z);
    contact.position.set(0, model.budY, z + 0.06);
    shadow.position.y = -dims.h / 2 - 22;
  }

  /* ------------------------------------------------------------- size, motion */
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // fit the phone's height with a little room
    const fit = (dims.h * 1.22) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    camera.position.z = Math.max(fit, (dims.w * 1.75) / (2 * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  let px = 0, py = 0;
  addEventListener('pointermove', (e) => { px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });

  // tap Bud: the hero's exchange (next.js owns the words)
  const ray = new THREE.Raycaster();
  renderer.domElement.addEventListener('click', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    if (ray.intersectObjects([screen, shell], false).length) window.budHero?.tap?.();
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    renderer.domElement.style.cursor = ray.intersectObjects([screen, shell], false).length ? 'pointer' : '';
  });

  const t0 = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 4);
  let visible = true;
  new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; }).observe(host);
  let gx = 0, gy = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) return;
    const t = (now - t0) / 1000;
    // the turn from the front to the back, over the first 1.8 s
    const turn = REDUCED ? 1 : ease(Math.min(1, Math.max(0, (t - 0.25) / 1.8)));
    gx += (px - gx) * 0.05; gy += (py - gy) * 0.05;
    const sway = REDUCED ? 0 : Math.sin(t * 0.55) * 0.07;
    rig.rotation.y = (1 - turn) * Math.PI - 0.32 + sway + gx * 0.18;
    rig.rotation.x = 0.08 + gy * 0.1 + (REDUCED ? 0 : Math.sin(t * 0.4) * 0.025);
    rig.rotation.z = -0.07;
    rig.position.y = REDUCED ? 0 : Math.sin(t * 0.8) * 2.2;
    shadow.material.opacity = 0.8 + Math.sin(t * 0.8) * 0.12;
    face.cfg.gaze = { x: gx * 0.9, y: gy * 0.6, amt: turn };
    // (a face that fails to draw leaves the screen as it was; the phone still shows)
    try { face.render(now / 1000); tex.needsUpdate = true; } catch (e) { /* the face library didn't load whole */ }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  setTimeout(() => face.set({ state: 'idle' }), 3200);
  window.budHero = Object.assign(window.budHero || {}, { screen: face });
  host.classList.add('on');
}

try {
  const gl = document.createElement('canvas').getContext('webgl2');
  if (gl && host) start().catch((e) => console.warn('3D hero unavailable', e));
} catch (e) {
  console.warn('3D hero unavailable', e);
}
