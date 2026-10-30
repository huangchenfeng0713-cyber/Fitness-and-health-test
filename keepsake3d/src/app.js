// Keepsake viewer shell: scene, lighting, camera framing, UI, pointer routing between the two modules.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createFur } from './fur_strands.js';
import { createCabinet } from './cabinet.js';

// Single-file builds inline every asset into window.__ASSETS__ (path -> data URL).
const INLINE = window.__ASSETS__ || null;
if (INLINE) {
  THREE.DefaultLoadingManager.setURLModifier((url) => {
    const k = url.replace(/^.*?assets\//, '');
    return INLINE[k] || url;
  });
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (url, o) => {
    const k = String(url).replace(/^.*?assets\//, '');
    return INLINE[k] ? nativeFetch(INLINE[k], o) : nativeFetch(url, o);
  };
}
const ASSETS = './assets/';

const $ = (s) => document.querySelector(s);
const canvas = $('#c');
const coarse = matchMedia('(pointer: coarse)').matches;
const small = Math.min(innerWidth, innerHeight) < 820;
const quality = coarse && small ? 'low' : 'high';

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.03;   // driven by the lamp (light bouncing around a dark room)

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.005, 20);
camera.position.set(0, 0.30, 0.62);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.07;
controls.maxDistance = 1.4;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 0.07, 0);
controls.zoomToCursor = true;

// ---------- lighting: a dark room lit only by a desk lamp ----------
const LAMP_COLORS = { white: new THREE.Color(0xf3f6ff), warm: new THREE.Color(0xffdcae) };
const LAMP_SPOTS = [   // fixed places on the desk (x, z) in front of the hutch where the lamp can stand
  { name: '左侧', x: -0.43, z: -0.02 }, { name: '左前', x: -0.41, z: 0.23 },
  { name: '右前', x: 0.41, z: 0.23 }, { name: '右侧', x: 0.43, z: -0.02 },
];
const lamp = { on: true, level: 0.75, color: 'warm', spot: 2, aim: new THREE.Vector3(-0.035, 0.2, -0.2), aimGoal: new THREE.Vector3(-0.035, 0.2, -0.2) };
const ambient = new THREE.HemisphereLight(0x9aa4b8, 0x2a2018, 0.0);   // bounce light from table/walls, follows the lamp
scene.add(ambient);
const lampRig = new THREE.Group(); lampRig.name = 'desk_lamp'; scene.add(lampRig);
const lampMetal = new THREE.MeshStandardMaterial({ color: 0x2b2d31, metalness: 0.75, roughness: 0.35 });
const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.014, 48), lampMetal);
lampBase.position.y = 0.007; lampBase.castShadow = true; lampBase.receiveShadow = true;
const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.46, 16), lampMetal);
lampPost.position.y = 0.244; lampPost.castShadow = true;
const lampKnuckle = new THREE.Mesh(new THREE.SphereGeometry(0.011, 20, 12), lampMetal);
lampKnuckle.position.y = 0.475;
const lampArm = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 12), lampMetal); lampArm.castShadow = true;
const shade = new THREE.Group();
const shadeOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.052, 0.07, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x1f2124, metalness: 0.6, roughness: 0.4, side: THREE.DoubleSide }));
shadeOuter.rotation.x = -Math.PI / 2; shadeOuter.castShadow = true;
const shadeInnerMat = new THREE.MeshStandardMaterial({ color: 0xf2efe8, emissive: 0xffd9a8, emissiveIntensity: 0, roughness: 0.6, side: THREE.BackSide });
const shadeInner = new THREE.Mesh(new THREE.CylinderGeometry(0.0178, 0.0515, 0.069, 48, 1, true), shadeInnerMat);
shadeInner.rotation.x = -Math.PI / 2;
const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d8, emissiveIntensity: 0 });
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 24, 16), bulbMat); bulb.position.z = -0.012;
shade.add(shadeOuter, shadeInner, bulb);
lampRig.add(lampBase, lampPost, lampKnuckle, lampArm, shade);
const lampSwitch = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0xb8b2a6, metalness: 0.3, roughness: 0.5 }));
lampSwitch.position.set(0.032, 0.017, 0.02); lampRig.add(lampSwitch);
const spot = new THREE.SpotLight(0xffffff, 0, 0, THREE.MathUtils.degToRad(42), 0.75, 1.6);
spot.castShadow = true;
spot.shadow.mapSize.set(quality === 'low' ? 1024 : 2048, quality === 'low' ? 1024 : 2048);
spot.shadow.camera.near = 0.02; spot.shadow.camera.far = 2.0;
spot.shadow.bias = -0.00015; spot.shadow.normalBias = 0.0007; spot.shadow.radius = 6;
shade.add(spot); spot.position.set(0, 0, 0.005);
scene.add(spot.target);
const glow = new THREE.PointLight(0xffffff, 0, 0.6, 2);   // light escaping around the shade, lights the lamp itself
shade.add(glow); glow.position.set(0, 0, -0.03);
const lampDir = new THREE.Vector3(), shadePos = new THREE.Vector3(), knuckle = new THREE.Vector3();
function placeLamp() {
  const s = LAMP_SPOTS[lamp.spot];
  lampRig.position.set(s.x, 0, s.z);
  // head: reach 0.13 m from the knuckle toward the aim point, shade looks at it
  knuckle.set(s.x, 0.475, s.z);
  lampDir.copy(lamp.aim).sub(knuckle); lampDir.y = 0; const h = lampDir.length() || 1; lampDir.multiplyScalar(1 / h);
  shadePos.copy(knuckle).addScaledVector(lampDir, Math.min(0.13, h * 0.5)); shadePos.y = 0.455;
  shade.position.copy(shadePos).sub(lampRig.position);
  shade.lookAt(lamp.aim);
  const a = knuckle.clone().sub(lampRig.position), b = shade.position.clone();
  lampArm.position.copy(a).add(b).multiplyScalar(0.5);
  lampArm.scale.set(1, a.distanceTo(b), 1);
  lampArm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  spot.target.position.copy(lamp.aim);
}
function applyLamp() {
  const c = LAMP_COLORS[lamp.color];
  const k = lamp.on ? lamp.level : 0;
  spot.color.copy(c); glow.color.copy(c);
  spot.intensity = k * 3.4;
  glow.intensity = k * 0.05;
  ambient.color.copy(c).lerp(new THREE.Color(0x8090a8), 0.5);
  ambient.intensity = k * 0.32;
  scene.environmentIntensity = k * 0.16;
  bulbMat.emissive.copy(c); bulbMat.emissiveIntensity = k * 6;
  shadeInnerMat.emissive.copy(c); shadeInnerMat.emissiveIntensity = k * 0.9;
  renderer.toneMappingExposure = 1.0;
  document.querySelectorAll('[data-lamp-color]').forEach((b) => b.classList.toggle('on', b.dataset.lampColor === lamp.color));
  const sw = $('#lampOn'); if (sw) { sw.classList.toggle('on', lamp.on); sw.querySelector('span').textContent = lamp.on ? '关灯' : '开灯'; }
  document.querySelectorAll('[data-lamp-spot]').forEach((b) => b.classList.toggle('on', +b.dataset.lampSpot === lamp.spot));
}
placeLamp(); applyLamp();

// ---------- table ----------
function woodTexture() {
  const W = 1024, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#b78a5c'; g.fillRect(0, 0, W, H);
  let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    const y = r() * H, a = 0.03 + r() * 0.07, w = 0.6 + r() * 2.2;
    g.strokeStyle = r() < 0.5 ? `rgba(90,55,25,${a})` : `rgba(235,200,150,${a * 0.8})`;
    g.lineWidth = w; g.beginPath();
    const amp = 2 + r() * 8, f = 0.002 + r() * 0.006, ph = r() * 6.28;
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1) * amp * 0.25);
    g.stroke();
  }
  for (let i = 0; i < 4; i++) {   // a few faint knots with rings, not blotches
    const x = r() * W, y = r() * H, rx = 4 + r() * 6;
    for (let k = 4; k >= 1; k--) {
      g.strokeStyle = `rgba(95,55,25,${0.05 + 0.03 * (4 - k)})`; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(x, y, rx * k * 1.9, rx * k * 0.55, 0, 0, 6.29); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const tableMat = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, metalness: 0 });
const table = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.028, 0.56), tableMat);
table.position.y = -0.014;
table.receiveShadow = true;
table.name = 'table';
scene.add(table);
// dark floor far below so light spilling over the table edge lands somewhere
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ color: 0x15130f, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.74; floor.receiveShadow = true;
scene.add(floor);

// ---------- display hutch (part of the desk) ----------
const cabinet = createCabinet(scene);
const cabinetRay = new THREE.Raycaster(), cabinetTarget = new THREE.Vector3(), cabinetDirection = new THREE.Vector3();
const cabinetMeshes=[];cabinet.group.traverse(o=>{if(o.isMesh)cabinetMeshes.push(o);});
function revealKeepsake() {
  for(const mesh of cabinetMeshes)mesh.visible=true;
  if(view!=='plush'||!modules.plush?.__body||camera.position.distanceTo(controls.target)>.7)return;
  modules.plush.__body.localToWorld(cabinetTarget.set(0,.065,0));
  cabinetDirection.copy(cabinetTarget).sub(camera.position);
  cabinetRay.set(camera.position,cabinetDirection.clone().normalize());
  cabinetRay.far=Math.max(0,cabinetDirection.length()-.012);
  for(const hit of cabinetRay.intersectObject(cabinet.group,true))hit.object.visible=false;
}
// warm display-cabinet downlights in each bay (separate switch from the desk lamp)
const cabLights = [];
for (const x of [-0.31, -0.035, 0.27]) {
  const l = new THREE.SpotLight(0xffe2bd, 0, 0.6, THREE.MathUtils.degToRad(62), 0.9, 1.8);
  l.position.set(x, 0.43, -0.135); l.target.position.set(x, 0.0, -0.21);
  scene.add(l, l.target); cabLights.push(l);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.008), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe2bd, emissiveIntensity: 0 }));
  strip.position.set(x, 0.4385, -0.13); scene.add(strip); l.userData.strip = strip;
}
let cabOn = false;
function applyCabLights() {
  for (const l of cabLights) { l.intensity = cabOn ? 0.55 : 0; l.userData.strip.material.emissiveIntensity = cabOn ? 2.2 : 0; }
  const b = document.querySelector('#cabOn'); if (b) { b.classList.toggle('on', cabOn); b.querySelector('span').textContent = cabOn ? '关柜灯' : '开柜灯'; }
}
applyCabLights();

// ---------- hint / UI ----------
const hintEl = $('#hint');
function closeObjectMenu() { $('#bottom').hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); }
$('#btnMenu').addEventListener('click', () => {
  const open = $('#bottom').hidden; $('#bottom').hidden = !open;
  $('#btnMenu').setAttribute('aria-expanded', String(open));
  $('#lampPanel').hidden = true; $('#info').hidden = true;
});
const touchUI = matchMedia('(pointer: coarse)').matches;
const hints = { plush: '', magnet: '', all: touchUI ? '直接用手指碰它们。拖空白处转视角，双指在空白处缩放。' : '直接用鼠标碰它们。拖空白处转视角，滚轮缩放。' };
let view = 'plush';
function showHint() { hintEl.textContent = hints[view] || ''; hintEl.style.opacity = hintEl.textContent ? 1 : 0; }
const plushIntro = touchUI
  ? '碰哪里就动哪里：点一下拨它，按住拖拽，轻轻滑过是抚摸；两根手指放在它身上可以捏、弯。'
  : '碰哪里就动哪里：点一下拨它，按住拖拽，轻轻滑过是抚摸；按住右键拖动或在它身上滚轮可以捏、弯。';

const ctxBase = { THREE, scene, camera, renderer, domElement: canvas, assetsBase: ASSETS, quality };
const modules = {};

// ---------- plush ----------
async function loadPlush() {
  const gltf = await new GLTFLoader().loadAsync(ASSETS + 'plush.glb');
  const meta = await (await fetch(ASSETS + 'plush_meta.json')).json();
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const m of meshes) {
    m.castShadow = true; m.receiveShadow = true;
    const map = m.material.map;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); }
    m.updateMatrixWorld(true);
    m.geometry.applyMatrix4(m.matrixWorld);   // bake node transforms, the engine works in the rest frame
    m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix();
    m.geometry.setAttribute('restPosition', m.geometry.attributes.position.clone());
  }
  const body = meshes.find((m) => m.name.includes('plush_body')) || meshes[0];
  const maskTex = await new THREE.TextureLoader().loadAsync(ASSETS + 'tex/plush_masks.png').catch(() => null);
  if (maskTex) { maskTex.flipY = false; maskTex.colorSpace = THREE.NoColorSpace; }
  let seam = null;
  if (meta.seam_u8_b64) {
    const raw = atob(meta.seam_u8_b64);
    if (raw.length === body.geometry.attributes.position.count) { seam = new Float32Array(raw.length); for (let i = 0; i < raw.length; i++) seam[i] = raw.charCodeAt(i) / 255; }
  }
  const fur = createFur(body, { shells: quality === 'low' ? 8 : 16, maskMap: maskTex, seam });
  const tl = new THREE.TextureLoader();
  const [tf, tb] = await Promise.all([tl.loadAsync(ASSETS + 'tex/tag_front.png'), tl.loadAsync(ASSETS + 'tex/tag_back.png')]);
  for (const t of [tf, tb]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy()); }
  let api = null;
  try {
    const mod = await import('./plush_engine.js');
    api = await mod.createPlush({ ...ctxBase, onHint: (t) => { hints.plush = t; if (view === 'plush') showHint(); } }, {
      softMeshes: meshes, attachPoint: new THREE.Vector3(...meta.attach_point_m), tagTextures: { front: tf, back: tb },
      tagSize: { w: 0.0373, h: 0.0486, t: 0.00035 }, tagHole: { x: 0.0054, y: 0.0075, d: 0.0032 },
      hookPosition: cabinet.hook.clone(), origin: new THREE.Vector3(cabinet.hook.x, 0, cabinet.hook.z), quality,
      mount: 'wall', wallZ: cabinet.wallZ, colliders: cabinet.colliders, supports: cabinet.supports,
      onStroke: (p, d, s) => fur.stroke(p, d, s),
    });
  } catch (err) {
    console.error('plush engine unavailable, static display', err);
    const g = new THREE.Group(); meshes.forEach((m) => g.add(m)); g.position.set(-0.13, 0.08, 0); scene.add(g);
    api = { group: g, update() {}, pointerDown() { return false; }, pointerMove() {}, pointerUp() {}, reset() {}, focus: { target: new THREE.Vector3(-0.13, 0.13, 0), distance: 0.32 } };
  }
  // the fur shells must live next to the body mesh (same transform)
  body.parent ? body.parent.add(fur.group) : api.group.add(fur.group);
  fur.group.position.copy(body.position); fur.group.quaternion.copy(body.quaternion); fur.group.scale.copy(body.scale);
  api.__fur = fur; api.__body = body;
  // the fur shells sit in front of the body's own shadow-map depth -> cast from back faces to avoid self-shadow acne
  for (const m of meshes) { if (m.material) m.material.shadowSide = THREE.BackSide; }
  modules.plush = api;
}

// ---------- magnet ----------
async function loadMagnet() {
  try {
    const mod = await import('./magnet_scene.js');
    modules.magnet = await mod.createMagnetScene({ ...ctxBase, onHint: (t) => { hints.magnet = t; if (view === 'magnet') showHint(); } }, { origin: new THREE.Vector3(0.14, 0, -0.01), quality,
      fridge: { enabled: false }, magneticSurfaces: cabinet.magnetic, colliders: cabinet.colliders, supports: cabinet.supports,
      area: { minX: -0.44, maxX: 0.44, minZ: -0.27, maxZ: 0.27 } });
    if (modules.magnet) modules.magnet.focusFridge = cabinet.focusPanel;
  } catch (err) {
    console.error('magnet scene unavailable', err);
  }
}

// ---------- camera framing ----------
const framings = {
  all: { target: new THREE.Vector3(0, 0.17, -0.08), dir: new THREE.Vector3(0, 0.32, 1), dist: 1.05 },
};
const fallbackFocus = {
  plush: { target: new THREE.Vector3(-0.035, 0.22, -0.2), distance: 0.40 },
  magnet: { target: new THREE.Vector3(0.14, 0.01, 0.09), distance: 0.36 },
};
function framingFor(v) {
  if (v === 'all') return framings.all;
  const m = modules[v];
  let f = m && m.focus;
  const ok = f && f.target && Number.isFinite(f.target.x + f.target.y + f.target.z) && Number.isFinite(f.distance) && f.distance > 0;
  if (!ok) f = fallbackFocus[v];
  return { target: f.target.clone(), dir: v === 'plush' ? new THREE.Vector3(0.08, 0.12, 1) : new THREE.Vector3(0, 0.95, 0.75), dist: f.distance };
}
let tween = null;
function flyTo(v, instant = false) {
  const f = framingFor(v);
  const toPos = f.target.clone().add(f.dir.clone().normalize().multiplyScalar(f.dist * Math.max(1, 0.85 / camera.aspect)));
  if (instant) { controls.target.copy(f.target); camera.position.copy(toPos); controls.update(); return; }
  tween = { t: 0, dur: 0.9, fromT: controls.target.clone(), toT: f.target, fromP: camera.position.clone(), toP: toPos };
}
function setView(v, moveCamera = true) {
  view = v;
  document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  $('#magtools').hidden = v !== 'magnet';
  atFridge = false; $('#btnFridge span').textContent = '看铁板';
  if (v === 'plush' && !hints.plush) hints.plush = plushIntro;
  showHint();
  if (moveCamera) flyTo(v);
  lamp.aimGoal.copy(framingFor(v).target);
}
document.querySelectorAll('#views button').forEach((b) => b.addEventListener('click', () => { setView(b.dataset.view); closeObjectMenu(); }));
// lamp controls
$('#lampOn').addEventListener('click', () => { lamp.on = !lamp.on; applyLamp(); });
$('#cabOn').addEventListener('click', () => { cabOn = !cabOn; applyCabLights(); });
$('#lampLevel').addEventListener('input', (e) => { lamp.level = +e.target.value / 100; if (!lamp.on) lamp.on = true; applyLamp(); });
document.querySelectorAll('[data-lamp-color]').forEach((b) => b.addEventListener('click', () => { lamp.color = b.dataset.lampColor; applyLamp(); }));
document.querySelectorAll('[data-lamp-spot]').forEach((b) => b.addEventListener('click', () => { lamp.spot = +b.dataset.lampSpot; placeLamp(); applyLamp(); }));
$('#btnLamp').addEventListener('click', () => { closeObjectMenu(); $('#lampPanel').hidden = !$('#lampPanel').hidden; $('#info').hidden = true; });
$('#btnRepack').addEventListener('click', () => { modules.magnet?.reset(); if (atFridge) toggleFridge(); });
let atFridge = false;
function toggleFridge() {
  const m = modules.magnet;
  const f = atFridge ? null : m?.focusFridge;
  atFridge = !atFridge && !!f;
  $('#btnFridge span').textContent = atFridge ? '看桌面' : '看铁板';
  if (!atFridge) { flyTo('magnet'); lamp.aimGoal.copy(framingFor('magnet').target); return; }
  lamp.aimGoal.copy(f.target);
  const toPos = f.target.clone().add(new THREE.Vector3(0.05, 0.12, 1).normalize().multiplyScalar(f.distance));
  tween = { t: 0, dur: 0.9, fromT: controls.target.clone(), toT: f.target.clone(), fromP: camera.position.clone(), toP: toPos };
}
$('#btnFridge').addEventListener('click', toggleFridge);
$('#btnInfo').addEventListener('click', () => { closeObjectMenu(); $('#info').hidden = !$('#info').hidden; $('#lampPanel').hidden = true; });
$('#btnCenter').addEventListener('click', () => { flyTo(view); closeObjectMenu(); });

const dims = [
  ['毛绒挂件（头顶到脚）', '≈ 100 mm'], ['· 头部 宽 × 高 × 厚', '≈ 45.5 × 44.8 × 16.5 mm'], ['· 身体 宽 × 厚', '≈ 24.5 × 8.8 mm'],
  ['· 头顶毛毡（晴空塔塔尖）', '18.6 × 18.1 mm'], ['· 吊牌', '37.3 × 48.6 mm'], ['· 珠链', '珠径 ≈ 2.4 mm'],
  ['冰箱贴', '50.3 × 49.8 × ≈3 mm'], ['· 透明吸塑壳', '58 × 77.5 mm'], ['· 折叠纸卡（单面）', '68 × 95.5 mm'],
  ['· OPP 外袋（含挂头）', '76 × 137 mm'],
];
$('#dims').innerHTML = dims.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');

// ---------- export ----------
async function exportGLB(which, part = null) {
  const m = modules[which]; if (!m) return null;
  const src = part === 'body' && m.softRoot ? m.softRoot : part === 'item' && m.debug?.bodies?.magnet ? m.debug.bodies.magnet.root : (m.exportObject ? m.exportObject() : m.group);
  // modules keep live (sometimes circular) references in userData; clone with a minimal copy
  const saved = [];
  src.traverse((o) => {
    saved.push([o, o.userData]);
    const invisibleMaterial = o.material && (Array.isArray(o.material) ? o.material.every(m => m.visible === false) : o.material.visible === false);
    o.userData = { isFur: !!o.userData?.isFur, noExport: !!o.userData?.noExport || !!invisibleMaterial };
  });
  let clone;
  try { clone = src.clone(true); } finally { for (const [o, u] of saved) o.userData = u; }
  if (part === 'item' || part === 'body') { clone.position.set(0,0,0); clone.quaternion.identity(); clone.scale.set(1,1,1); clone.matrixAutoUpdate=true;clone.updateMatrix(); }
  const drop = [];
  const exportMaterials=new Map();
  // Omit unused instances rather than exporting their zero scale or a ghost at the origin.
  clone.traverse((o) => {
    if (!o.isInstancedMesh) return;
    const mtx = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    o.instanceMatrix = o.instanceMatrix.clone();
    let kept=0;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, mtx); mtx.decompose(p, q, s);
      if (![...mtx.elements, q.x, q.y, q.z, q.w].every(Number.isFinite) || Math.abs(s.x*s.y*s.z)<1e-20) continue;
      o.setMatrixAt(kept++,mtx);
    }
    o.count=kept;if(!kept)o.visible=false;
  });
  clone.traverse((o) => {
    if (o.userData?.isFur || o.userData?.noExport || o.isLight || o.type === 'LineSegments') drop.push(o);
    if (o.isMesh && o.geometry) {
      const g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      o.geometry = g;
      const standard = (material) => {
        if(!material.userData?.fresnel)return material;
        if(exportMaterials.has(material))return exportMaterials.get(material);
        const clear=new THREE.MeshPhysicalMaterial({color:0xffffff,transparent:true,opacity:.02,depthWrite:false,
          side:THREE.DoubleSide,roughness:.2,metalness:0,specularIntensity:.05,
          normalMap:material.normalMap,normalScale:material.normalScale?.clone()});
        exportMaterials.set(material,clear);return clear;
      };
      o.material=Array.isArray(o.material)?o.material.map(standard):standard(o.material);
    }
  });
  drop.forEach((o) => o.parent && o.parent.remove(o));
  let bakedFur;
  if(which === 'plush' && m.__fur?.bake) {
    bakedFur=m.__fur.bake();
    (part==='body'?clone:clone.getObjectByName('plushSoftRoot')||clone).add(bakedFur);
  }
  const exporter = new GLTFExporter();
  try { return await exporter.parseAsync(clone, { binary: true, onlyVisible: true }); }
  finally { if(bakedFur){bakedFur.geometry.dispose();bakedFur.material.dispose();} for(const material of exportMaterials.values())material.dispose(); }
}
$('#btnExport').addEventListener('click', async () => {
  const which = view === 'magnet' ? 'magnet' : 'plush';
  const glb = await exportGLB(which);
  if (!glb) return;
  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = which === 'plush' ? '毛绒挂件.glb' : '冰箱贴.glb';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

// ---------- pointer routing ----------
// Every pointer is offered to the modules; a module may hold several pointers at once (two-finger pinch / bend).
const ndc = new THREE.Vector2();
const captured = new Map();                 // pointerId -> module
const pointerState = new Map();             // pointerId -> {clientX, clientY, raycaster}
const cameraPointers = new Set(), ignoredPointers = new Set();
let lastDown = { t: 0, x: 0, y: 0 };
function rayFor(x, y, rc = new THREE.Raycaster()) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  rc.setFromCamera(ndc, camera);
  return rc;
}
function pointersOf(m) {
  const out = [];
  for (const [id, mm] of captured) if (mm === m) { const s = pointerState.get(id); if (s) out.push({ pointerId: id, ...s }); }
  return out;
}
function info(e, extra = {}) {
  const raycaster = rayFor(e.clientX, e.clientY);
  return { raycaster, ndc: ndc.clone(), clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType,
    button: e.button, buttons: e.buttons, time: performance.now() / 1000, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
    captured: false, dblclick: false, pointers: [], ...extra };
}
function ordered() {
  const list = [];
  for (const m of captured.values()) if (!list.includes(m)) list.push(m);     // a module already being touched gets the next finger first
  if (view !== 'all' && modules[view] && !list.includes(modules[view])) list.push(modules[view]);
  for (const k of ['plush', 'magnet']) if (modules[k] && !list.includes(modules[k])) list.push(modules[k]);
  return list;
}
function hitsLamp(rc) {
  return rc.intersectObjects([lampSwitch, lampBase, shade], true).length > 0;
}
window.addEventListener('pointerdown', (e) => {
  if (e.target !== canvas) return;
  closeObjectMenu(); $('#lampPanel').hidden = true; $('#info').hidden = true;
  // A gesture belongs to either the camera or an object until all fingers lift.
  if (cameraPointers.size) { cameraPointers.add(e.pointerId); return; }
  const now = performance.now();
  const dbl = !captured.size && e.button === 0 && now - lastDown.t < 320 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 24;
  if (e.button === 0) lastDown = { t: now, x: e.clientX, y: e.clientY };
  const inf = info(e, { dblclick: dbl });
  pointerState.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, raycaster: inf.raycaster });
  for (const m of ordered()) {
    let took = false;
    inf.pointers = [...pointersOf(m), { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, raycaster: inf.raycaster }];
    try { took = m.pointerDown(inf); } catch (err) { console.error(err); }
    if (took) {
      captured.set(e.pointerId, m);
      tween = null; // keep the ray plane fixed for the entire gesture
      // Flush residual orbit inertia without shifting the gesture's camera.
      const pose = camera.position.clone(), look = controls.target.clone();
      controls.enableDamping = false; controls.update();
      camera.position.copy(pose); controls.target.copy(look); controls.update();
      controls.enabled = false;
      e.stopPropagation();
      try { canvas.setPointerCapture?.(e.pointerId); } catch (_) { /* synthetic pointers */ }
      // touching an object in the overview focuses it
      if (view === 'all') setView(m === modules.plush ? 'plush' : 'magnet', false);
      return;
    }
  }
  pointerState.delete(e.pointerId);
  if (captured.size) { ignoredPointers.add(e.pointerId); e.stopPropagation(); return; }
  // the lamp itself: tap the base / switch / shade to toggle it
  if (e.button === 0 && hitsLamp(inf.raycaster)) { lamp.on = !lamp.on; applyLamp(); ignoredPointers.add(e.pointerId); e.stopPropagation(); }
  else cameraPointers.add(e.pointerId);
}, { capture: true });
canvas.addEventListener('wheel', (e) => {
  const inf = info(e, { pointerId: -1, pointerType: 'mouse' });
  for (const m of ordered()) {
    let took = false;
    try { took = !!m.wheel?.(inf, e.deltaY); } catch (err) { console.error(err); }
    if (took) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  }
}, { capture: true, passive: false });
window.addEventListener('pointermove', (e) => {
  if (ignoredPointers.has(e.pointerId)) { e.stopPropagation(); return; }
  const m = captured.get(e.pointerId);
  if (m) {
    e.stopPropagation();
    const inf = info(e, { captured: true });
    pointerState.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY, raycaster: inf.raycaster });
    inf.pointers = pointersOf(m);
    m.pointerMove(inf);
    return;
  }
  if (e.target !== canvas || e.buttons) return;
  const inf = info(e);
  let cursor = '';
  for (const mm of ordered()) {
    try { mm.pointerMove(inf); } catch (err) { /* ignore */ }
    const c = mm.hoverCursor?.(inf);
    if (c && !cursor) cursor = c;
  }
  canvas.style.cursor = cursor;
}, { capture: true });
function up(e) {
  cameraPointers.delete(e.pointerId);
  if (ignoredPointers.delete(e.pointerId)) { e.stopPropagation(); return; }
  const m = captured.get(e.pointerId);
  if (!m) return;
  e.stopPropagation();
  const inf = info(e, { captured: true, cancelled: e.type === 'pointercancel' });
  inf.pointers = pointersOf(m);          // still includes the lifted pointer
  captured.delete(e.pointerId);
  pointerState.delete(e.pointerId);
  try { m.pointerUp(inf); } catch (err) { console.error(err); }
  if (!captured.size) { controls.enabled = true; controls.enableDamping = true; }
}
window.addEventListener('pointerup', up, { capture: true });
window.addEventListener('pointercancel', up, { capture: true });
canvas.addEventListener('lostpointercapture', (e) => {
  if (captured.has(e.pointerId)) up({ ...pointerState.get(e.pointerId), pointerId:e.pointerId, type:'pointercancel', stopPropagation(){} });
});
function cancelTouches() {
  for (const [id,s] of [...pointerState]) up({ ...s, pointerId:id, type:'pointercancel', stopPropagation(){} });
  cameraPointers.clear(); ignoredPointers.clear(); controls.enabled = true; controls.enableDamping = true;
}
addEventListener('blur', cancelTouches);
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelTouches(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

addEventListener('resize', () => {
  cancelTouches();
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
});

// ---------- main loop ----------
const clock = new THREE.Clock();
const gLocal = new THREE.Vector3();
let simTime = 0;
let lastMagnetStage = null, reframeMagnet = false;
function frame() {
  tick(Math.min(clock.getDelta(), 0.1));
  renderer.render(scene, camera);
}
function tick(dt) {
  simTime += dt;
  const t = simTime;
  if (tween) {
    tween.t += dt / tween.dur;
    const k = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3);
    controls.target.lerpVectors(tween.fromT, tween.toT, k);
    camera.position.lerpVectors(tween.fromP, tween.toP, k);
    if (tween.t >= 1) tween = null;
  }
  if (lamp.aim.distanceToSquared(lamp.aimGoal) > 1e-8) { lamp.aim.lerp(lamp.aimGoal, 1 - Math.exp(-dt * 3.5)); placeLamp(); }
  for (const k in modules) { try { modules[k].update(dt, t); } catch (err) { console.error(err); } }
  if (modules.magnet && lastMagnetStage !== modules.magnet.stage) {
    lastMagnetStage = modules.magnet.stage; reframeMagnet = true;
  }
  else if (reframeMagnet && !captured.size) {
    reframeMagnet = false;
    if (view === 'magnet' && !atFridge) { flyTo('magnet'); lamp.aimGoal.copy(framingFor('magnet').target); }
  }
  const p = modules.plush;
  if (p?.__fur) {
    // gravity in the body's local frame for the fur droop
    gLocal.set(0, -1, 0);
    if (p.__body.parent) { const q = p.__body.getWorldQuaternion(new THREE.Quaternion()).invert(); gLocal.applyQuaternion(q); }
    p.__fur.update(dt, gLocal);
  }
  controls.update();
  revealKeepsake();
}

// Test hooks (used for automated checks when the page runs in a background tab where rAF is throttled).
const testHooks = {
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); renderer.render(scene, camera); },
  async snap(name = 'snap.jpg', q = 0.88) {
    renderer.render(scene, camera);
    const url = renderer.domElement.toDataURL('image/jpeg', q);
    await fetch('http://127.0.0.1:8766/save?name=' + encodeURIComponent(name), { method: 'POST', body: url });
    return name;
  },
  // synthetic pointer gesture in canvas pixel coordinates; frames are stepped between moves
  // two simultaneous touch pointers: paths a and b (same length), stepped together
  async gesture2(a, b, { stepsPerMove = 2 } = {}) {
    const r = canvas.getBoundingClientRect();
    const mk = (type, id, [x, y]) => new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: id, pointerType: 'touch', isPrimary: id === 81, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
    canvas.dispatchEvent(mk('pointerdown', 81, a[0])); this.step(1);
    canvas.dispatchEvent(mk('pointerdown', 82, b[0])); this.step(1);
    for (let i = 1; i < a.length; i++) { window.dispatchEvent(mk('pointermove', 81, a[i])); window.dispatchEvent(mk('pointermove', 82, b[i])); this.step(stepsPerMove); }
    window.dispatchEvent(mk('pointerup', 82, b[b.length - 1])); window.dispatchEvent(mk('pointerup', 81, a[a.length - 1]));
    this.step(1);
  },
  lamp: (o) => { Object.assign(lamp, o); placeLamp(); applyLamp(); },
  cab: (on) => { cabOn = on; applyCabLights(); },
  async gesture(points, { stepsPerMove = 2, pointerType = 'mouse', holdFrames = 0, button = 0 } = {}) {
    const r = canvas.getBoundingClientRect();
    const mk = (type, [x, y]) => new PointerEvent(type, { clientX: r.left + x, clientY: r.top + y, pointerId: 77, pointerType, bubbles: true, cancelable: true, button, buttons: type === 'pointerup' ? 0 : (button === 2 ? 2 : 1) });
    canvas.dispatchEvent(mk('pointerdown', points[0]));
    for (let i = 0; i < holdFrames; i++) this.step(1);
    for (const p of points.slice(1)) { window.dispatchEvent(mk('pointermove', p)); this.step(stepsPerMove); }
    window.dispatchEvent(mk('pointerup', points[points.length - 1]));
    this.step(1);
  },
  view: (v) => { setView(v); tween = null; flyTo(v, true); },
  async saveGLB(which, name, part = null) {
    const glb = await exportGLB(which, part);
    const bytes=new Uint8Array(glb),parts=[];
    for(let i=0;i<bytes.length;i+=32768)parts.push(String.fromCharCode(...bytes.subarray(i,i+32768)));
    const b64 = btoa(parts.join(''));
    await fetch('http://127.0.0.1:8876/save?name=' + encodeURIComponent(name), { method: 'POST', body: 'data:model/gltf-binary;base64,' + b64 });
    return glb.byteLength;
  },
};

(async () => {
  const t0 = performance.now();
  const timed = (name, p) => p.then((r) => { console.log(`[load] ${name} ${(performance.now() - t0).toFixed(0)} ms`); return r; });
  await Promise.all([timed('plush', loadPlush().catch((e) => console.error(e))), timed('magnet', loadMagnet())]);
  setView('plush');
  flyTo('plush', true);
  hints.plush = plushIntro; showHint();
  // compile every material before the first frame so interaction never stutters on first use
  const tc = performance.now();
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
  console.log(`[load] shaders ${(performance.now() - tc).toFixed(0)} ms, total ${(performance.now() - t0).toFixed(0)} ms`);
  renderer.setAnimationLoop(frame);
  requestAnimationFrame(() => $('#loading').classList.add('done'));
  window.__app = { scene, camera, controls, modules, renderer, ...testHooks };
})();
