// Display hutch built into the back of the desk: open cubbies, a linen wall with a brass hook for the plush,
// and a steel panel that magnets stick to. Exposes colliders / support surfaces / mount points for the modules.
import * as THREE from 'three';

export const CAB = {
  x0: -0.46, x1: 0.46, zBack: -0.28, zFront: -0.11, height: 0.46,
  side: 0.018, back: 0.010, top: 0.020,
  div1: -0.17, div2: 0.10,                 // divider centre lines
  leftShelfY: 0.22, shelfT: 0.016,
  rightBaseY: 0.145,                        // top of the small closed cabinet in the right bay
  hook: new THREE.Vector3(-0.035, 0.305, -0.205),
};

function woodTex(seed, base = '#8a5a35') {
  const W = 512, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, W, H);
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const y = r() * H; g.strokeStyle = r() < 0.55 ? `rgba(50,28,12,${0.04 + r() * 0.08})` : `rgba(220,170,120,${0.03 + r() * 0.05})`;
    g.lineWidth = 0.6 + r() * 1.8; g.beginPath();
    const amp = 1 + r() * 5, f = 0.004 + r() * 0.01, ph = r() * 6.3;
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
function linenTex() {
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d'); g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < W; i += 2) {
    g.fillStyle = `rgba(90,80,65,${0.05 + Math.random() * 0.06})`; g.fillRect(i, 0, 1, W);
    g.fillStyle = `rgba(255,250,240,${0.04 + Math.random() * 0.05})`; g.fillRect(0, i, W, 1);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6);
  return t;
}
function brushedTex() {
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, W, W);
  for (let i = 0; i < 1600; i++) { const y = Math.random() * W; g.fillStyle = `rgba(${Math.random() < 0.5 ? 255 : 0},${Math.random() < 0.5 ? 255 : 0},128,0.06)`; g.fillRect(0, y, W, 0.8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createCabinet(scene) {
  const C = CAB;
  const group = new THREE.Group(); group.name = 'display_hutch';
  const wood = new THREE.MeshStandardMaterial({ map: woodTex(7), roughness: 0.55, metalness: 0 });
  const woodEnd = new THREE.MeshStandardMaterial({ map: woodTex(11, '#7a4d2c'), roughness: 0.6, metalness: 0 });
  const linen = new THREE.MeshStandardMaterial({ map: linenTex(), roughness: 0.95 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xe9e6e0, metalness: 0.35, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.5, roughnessMap: brushedTex() });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: 0.28 });
  const colliders = [];
  function box(x0, y0, z0, x1, y1, z1, mat, collide = true) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true; m.receiveShadow = true; group.add(m);
    if (collide) colliders.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)));
    return m;
  }
  const { x0, x1, zBack: zb, zFront: zf, height: H, side: S, back: B, top: T } = C;
  // carcass
  box(x0, 0, zb, x0 + S, H, zf, woodEnd);                 // left side
  box(x1 - S, 0, zb, x1, H, zf, woodEnd);                 // right side
  box(x0, H - T, zb, x1, H, zf + 0.012, wood);            // top board (slight overhang, a display surface too)
  box(x0 + S, 0, zb, x1 - S, H - T, zb + B, wood);        // back
  box(C.div1 - S / 2, 0, zb + B, C.div1 + S / 2, H - T, zf, woodEnd);
  box(C.div2 - S / 2, 0, zb + B, C.div2 + S / 2, H - T, zf, woodEnd);
  // left bay: two open cubbies
  box(x0 + S, C.leftShelfY - C.shelfT, zb + B, C.div1 - S / 2, C.leftShelfY, zf, wood);
  // middle bay: linen-covered wall + brass hook
  const lw = box(C.div1 + S / 2, 0.012, zb + B, C.div2 - S / 2, H - T - 0.012, zb + B + 0.004, linen, false);
  lw.name = 'linen_wall';
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 32), brass);
  plate.rotation.x = Math.PI / 2; plate.position.set(C.hook.x, C.hook.y + 0.004, zb + B + 0.006); group.add(plate);
  // right bay: small closed cabinet with a door, steel magnet panel above
  box(C.div2 + S / 2, 0, zb + B, x1 - S, C.rightBaseY, zf, wood);
  const door = new THREE.Mesh(new THREE.BoxGeometry(x1 - S - (C.div2 + S / 2) - 0.006, C.rightBaseY - 0.010, 0.004), woodEnd);
  door.position.set((C.div2 + S / 2 + x1 - S) / 2, C.rightBaseY / 2, zf + 0.002); door.castShadow = door.receiveShadow = true; group.add(door);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 20, 14), brass);
  knob.position.set(x1 - S - 0.03, C.rightBaseY * 0.55, zf + 0.008); group.add(knob);
  const steelX0 = C.div2 + S / 2 + 0.008, steelX1 = x1 - S - 0.008, steelY0 = C.rightBaseY + 0.010, steelY1 = H - T - 0.010;
  const steelZ = zb + B + 0.003;
  box(steelX0, steelY0, zb + B, steelX1, steelY1, steelZ, steel, false).name = 'steel_panel';
  // slim brass edge on the top board front
  box(x0, H - T - 0.002, zf + 0.010, x1, H - T, zf + 0.013, brass, false);
  scene.add(group);

  const supports = [   // horizontal surfaces things can rest on: {y, box: Box2 in x/z}
    { name: 'table', y: 0, min: new THREE.Vector2(-0.46, -0.28), max: new THREE.Vector2(0.46, 0.28) },
    { name: 'left_shelf', y: C.leftShelfY, min: new THREE.Vector2(x0 + S, zb + B), max: new THREE.Vector2(C.div1 - S / 2, zf) },
    { name: 'right_cabinet_top', y: C.rightBaseY, min: new THREE.Vector2(C.div2 + S / 2, zb + B), max: new THREE.Vector2(x1 - S, zf) },
    { name: 'hutch_top', y: H, min: new THREE.Vector2(x0, zb), max: new THREE.Vector2(x1, zf + 0.012) },
  ];
  const magnetic = [{ name: 'steel_panel', center: new THREE.Vector3((steelX0 + steelX1) / 2, (steelY0 + steelY1) / 2, steelZ), normal: new THREE.Vector3(0, 0, 1),
    width: steelX1 - steelX0, height: steelY1 - steelY0 }];
  const focusPanel = { target: new THREE.Vector3((steelX0 + steelX1) / 2, (steelY0 + steelY1) / 2, steelZ + 0.02), distance: 0.42 };
  return { group, colliders, supports, magnetic, hook: C.hook.clone(), wallZ: zb + B + 0.004, focusPanel };
}
