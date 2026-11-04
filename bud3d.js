/* Bud in 3D (three.js), shared by the hero (hero3d.js) and by the picture of Bud the rest of the page
 * uses (tools/bud-3d.html renders img/bud-3d.webp from this): the metal shell, the side buttons and
 * the screen, and the studio light they are shown in. Sizes are in millimeters; Bud faces +z. */

export const BUD = { r: 27, d: 9.5, screen: 0.905 };

/** The room and lights the hero uses: a bright room for the metal, a key, a rim and a warm glow. */
export function light(THREE, renderer, scene, RoomEnvironment) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(140, 180, 260);
  const rim = new THREE.DirectionalLight(0xdfeaff, 0.9);
  rim.position.set(-220, 60, -120);
  // a warm light close to the top right corner: glossy surfaces fall off softly across their length
  const glow = new THREE.PointLight(0xfff4ea, 26000, 0, 2);
  glow.position.set(70, 120, 90);
  scene.add(key, rim, glow, new THREE.HemisphereLight(0xf4f7ff, 0xe9dccb, 0.45));
}

/** Bud: returns { group, shell, screen }. `screenMat` is the screen's material (the live face, or black). */
export function buildBud(THREE, screenMat) {
  const R = BUD.r, D = BUD.d;
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, roughness: 0.24, metalness: 1, envMapIntensity: 1.1 });
  // the talk button's color: press it to talk, like a walkie-talkie's
  const talk = new THREE.MeshPhysicalMaterial({ color: 0xff6a3d, roughness: 0.34, metalness: 0.05, clearcoat: 0.9, clearcoatRoughness: 0.18, envMapIntensity: 0.7 });
  const group = new THREE.Group();
  // the profile: flat on the phone, a softly curved side, a rounded lip up to the glass
  const prof = [];
  prof.push(new THREE.Vector2(0.01, 0));
  prof.push(new THREE.Vector2(R - 2.2, 0));
  for (let i = 0; i <= 12; i++) { const a = -Math.PI / 2 + (i / 12) * (Math.PI / 2); prof.push(new THREE.Vector2(R - 2.2 + 2.2 * Math.cos(a), 2.2 + 2.2 * Math.sin(a))); }
  prof.push(new THREE.Vector2(R, D - 2.4));
  for (let i = 0; i <= 14; i++) { const a = (i / 14) * (Math.PI / 2); prof.push(new THREE.Vector2(R - 2.4 + 2.4 * Math.cos(a), D - 2.4 + 2.4 * Math.sin(a))); }
  prof.push(new THREE.Vector2(R * BUD.screen + 0.3, D));
  prof.push(new THREE.Vector2(R * BUD.screen, D - 0.25));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 128), metal);
  shell.rotation.x = Math.PI / 2;
  group.add(shell);
  // its side buttons, well apart: the long colored talk button above, a small metal one below
  for (const [a, len, rad, mat] of [[0.42, 9.2, 1.35, talk], [-0.4, 4.4, 1.1, metal]]) {
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len - rad * 2, 8, 20), mat);
    b.position.set(Math.cos(a) * (R + 0.15), Math.sin(a) * (R + 0.15), D * 0.52);
    b.rotation.z = a;
    group.add(b);
  }
  // the screen, just under the lip
  const screen = new THREE.Mesh(new THREE.CircleGeometry(R * BUD.screen, 96), screenMat);
  screen.position.z = D - 0.24;
  group.add(screen);
  return { group, shell, screen };
}
