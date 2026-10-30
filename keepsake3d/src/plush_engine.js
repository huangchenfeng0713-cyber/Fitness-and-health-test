// plush_engine.js - a soft plush keychain on a nickel ball chain, hanging from a brass hook on a wooden stand.
//
// Two coupled simulation layers:
//
//  1. MECHANISM (XPBD, 960 Hz on 'high'): the plush's rigid core (6 DOF), the ball chain (closed loop of bead
//     particles: inextensible, bend-limited links, one clasp), the paper hang tag (rigid card), the hook / stand
//     colliders and the table.  The plush's cord loop and the tag's hole slide along the chain polyline
//     (nearest-point constraints tracked continuously along the loop).  Long-range tethers from the beads that
//     touch the hook keep the light chain from stretching under the 260x heavier plush.  Chain and tag collide
//     two-way with the plush through a voxel signed-distance field of its rest shape.
//
//  2. FLESH (lattice shape matching, FastLSM-style): a ~5 mm voxel lattice embeds every soft mesh by trilinear
//     interpolation.  Every lattice particle owns a 3x3x3 region; region sums use separable box filters,
//     rotations a warm-started polar decomposition, plus a small volume-preserving linear blend (bulge when
//     pinched).  The flesh is simulated in the core's local frame, so swinging / spinning is exact; only a
//     controllable fraction of the core's acceleration is fed back as inertia (soft lag, wobble after flicks).
//     It only runs while excited; at rest the meshes are untouched and cost nothing per vertex.
//
// The soft meshes live under `api.softRoot`, whose transform follows the core's rigid motion.  Their `position`
// / `normal` attributes hold the (deformed) shape in that local frame, i.e. the same frame as `restPosition`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const GRAV = 9.81;
const TAU = Math.PI * 2;

/** Tunable constants. Override with `opts.params = {...}`; live edits through `api.params` work for everything
 *  except the lattice / SDF resolution, chain geometry, tag size and stand geometry (fixed at creation). */
export function plushDefaults(quality = 'high') {
  const hi = quality !== 'low';
  return {
    // ---- flesh: lattice shape matching ----
    cellSize: hi ? 0.005 : 0.006,     // lattice cell edge (m)
    fleshHz: hi ? 120 : 60,           // fixed flesh step rate
    smFreq: 10.0,                     // dense stuffing retains its sewn outline
    anchorFreq: 7.0,                  // small local indentation, no whole-body rubber wobble
    attachPin: 0.9,                   // 0..1 extra pull around the cord loop (it carries the plush)
    volumeBeta: 0.025,                // cloth/filling barely bulges sideways under a finger
    jiggleDamping: 85,                // dissipate deformation instead of bouncing like rubber
    fleshInertia: 0.004,
    maxLocalDeviation: 0.0020,        // sewn fabric cannot be stretched into modelling clay
    polarIters: 1,                    // warm-started rotation extraction iterations per step
    meshEpsilon: 1e-4,                // m (L1): lattice cells deformed less than this keep their rest vertices
    sdfCell: hi ? 0.002 : 0.0025,     // collision SDF voxel (m)
    sdfInflate: 0.0006,               // short pile added for collisions / picking (m)
    // ---- mechanism (XPBD) ----
    mechSubsteps: hi ? 8 : 8,         // per flesh step (960 Hz high, 480 Hz low)
    mechIters: hi ? 3 : 2,
    plushMass: 0.020,                 // kg
    plushLinDamp: 4.0, plushAngDamp: 6.0,     // 1/s, air drag on the fluffy body
    twistStiffness: 1.0e-5,           // N*m/rad: the chain threaded through the cord turns the face back to the viewer
    twistDamping: 5e-6,
    beadRadius: 0.0012, beadPitch: 0.0032, chainLength: 0.110, beadMass: 6.5e-5,
    claspLength: 0.006, claspRadius: 0.0013, claspMass: 2.2e-4, claspSegment: 0.0034,
    bendMaxDeg: 75,                   // a ball-chain link bends at most this much
    chainDamp: 1.5,                   // 1/s
    hookFriction: 0.3, tableFriction: 0.6, floorDamping: 24,
    cordSlack: 0.0010, tagHoleSlack: 0.0004, attachMassScale: 0,
    tagMass: 0.0009, tagLinDamp: 1.2, tagAngDamp: 2.5, tagAlignDeg: 68,
    // ---- stand ----
    hookWire: 0.0015, hookArm: 0.0018, eyeRadius: 0.005, armBack: 0.032, armSide: 0.052, postRadius: 0.006,
    baseRadius: 0.034, baseHeight: 0.014, hangClearance: 0.10,
    // ---- interaction ----
    grabFreq: 4.0, grabZeta: 1.15, grabMaxForce: 0.45,
    grabSigma: 0.0075, maxStretch: 0.0020, stretchGain: 0.22,
    tagGrabStiffness: 160, tagGrabMaxForce: 0.12, maxReach: 0.32, rehangRadius: 0.04,
    flickGain: 0.22, flickMaxSpeed: 0.12, pokeSpeed: 0.03, jiggleGain: 0.035,
    pressGrabTime: 0.18, flickTime: 0.28, dragThresholdPx: 6,
    squeezeDepth: 0.075, squeezeRise: 0.28, fingerRadius: 0.0068, showFingers: false,
    petDrag: 0.10, petPress: 0.006, petSway: 0.012, petSigma: 0.008,
  };
}

/* ============================================================================================================
 * Small math helpers (row-major 3x3 in Float64Array(9))
 * ==========================================================================================================*/
function quatToMat(qx, qy, qz, qw, m) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  m[0] = 1 - (yy + zz); m[1] = xy - wz; m[2] = xz + wy;
  m[3] = xy + wz; m[4] = 1 - (xx + zz); m[5] = yz - wx;
  m[6] = xz - wy; m[7] = yz + wx; m[8] = 1 - (xx + yy);
}
function inv3(a, out) {   // returns det, writes the inverse into out (zeros if singular)
  const a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7], a8 = a[8];
  const c0 = a4 * a8 - a5 * a7, c1 = a5 * a6 - a3 * a8, c2 = a3 * a7 - a4 * a6;
  const det = a0 * c0 + a1 * c1 + a2 * c2;
  if (!(Math.abs(det) > 1e-300)) { out.fill(0); return 0; }
  const id = 1 / det;
  out[0] = c0 * id; out[1] = (a2 * a7 - a1 * a8) * id; out[2] = (a1 * a5 - a2 * a4) * id;
  out[3] = c1 * id; out[4] = (a0 * a8 - a2 * a6) * id; out[5] = (a2 * a3 - a0 * a5) * id;
  out[6] = c2 * id; out[7] = (a1 * a6 - a0 * a7) * id; out[8] = (a0 * a4 - a1 * a3) * id;
  return det;
}
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
function isIdentity(m) {
  const e = m.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(e[i] - (i % 5 === 0 ? 1 : 0)) > 1e-9) return false;
  return true;
}

// Euclidean distance transform (Felzenszwalb & Huttenlocher), squared distances in voxel units.
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
}
function edt3d(g, NX, NY, NZ) {
  const n = Math.max(NX, NY, NZ);
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const NXY = NX * NY;
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) {
    const b = NX * (j + NY * k);
    for (let i = 0; i < NX; i++) f[i] = g[b + i];
    edt1d(f, NX, d, v, z);
    for (let i = 0; i < NX; i++) g[b + i] = d[i];
  }
  for (let k = 0; k < NZ; k++) for (let i = 0; i < NX; i++) {
    const b = i + NXY * k;
    for (let j = 0; j < NY; j++) f[j] = g[b + NX * j];
    edt1d(f, NY, d, v, z);
    for (let j = 0; j < NY; j++) g[b + NX * j] = d[j];
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const b = i + NX * j;
    for (let k = 0; k < NZ; k++) f[k] = g[b + NXY * k];
    edt1d(f, NZ, d, v, z);
    for (let k = 0; k < NZ; k++) g[b + NXY * k] = d[k];
  }
}
// Sample points on triangles with spacing <= `spacing` and hand them to cb(x, y, z).
function sampleTriangles(pos, tri, spacing, cb) {
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const ux = pos[b] - ax, uy = pos[b + 1] - ay, uz = pos[b + 2] - az;
    const vx = pos[c] - ax, vy = pos[c + 1] - ay, vz = pos[c + 2] - az;
    const e = Math.max(Math.hypot(ux, uy, uz), Math.hypot(vx, vy, vz), Math.hypot(vx - ux, vy - uy, vz - uz));
    const n = Math.max(1, Math.ceil(e / spacing));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const s = i / n, r = j / n;
      cb(ax + ux * s + vx * r, ay + uy * s + vy * r, az + uz * s + vz * r);
    }
  }
}
// Flood the exterior (value 0 -> 2) of a voxel grid from its boundary; 1 = surface (wall).
function floodExterior(grid, NX, NY, NZ) {
  const NXY = NX * NY, stack = new Int32Array(grid.length);
  let sp = 0;
  const push = (i) => { if (grid[i] === 0) { grid[i] = 2; stack[sp++] = i; } };
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    if (i === 0 || j === 0 || k === 0 || i === NX - 1 || j === NY - 1 || k === NZ - 1) push(i + NX * j + NXY * k);
  }
  while (sp > 0) {
    const c = stack[--sp];
    const i = c % NX, j = ((c / NX) | 0) % NY, k = (c / NXY) | 0;
    if (i > 0) push(c - 1);
    if (i < NX - 1) push(c + 1);
    if (j > 0) push(c - NX);
    if (j < NY - 1) push(c + NX);
    if (k > 0) push(c - NXY);
    if (k < NZ - 1) push(c + NXY);
  }
}

/* ============================================================================================================
 * Rigid body (XPBD, Mueller et al. 2020 "Detailed rigid body simulation with XPBD")
 * ==========================================================================================================*/
class RB {
  constructor(mass, I) {
    this.m = mass; this.im = 1 / mass;
    this.Iib = new Float64Array(9); inv3(I, this.Iib);
    this.x = 0; this.y = 0; this.z = 0; this.qx = 0; this.qy = 0; this.qz = 0; this.qw = 1;
    this.vx = 0; this.vy = 0; this.vz = 0; this.wx = 0; this.wy = 0; this.wz = 0;
    this.px = 0; this.py = 0; this.pz = 0; this.pqx = 0; this.pqy = 0; this.pqz = 0; this.pqw = 1;
    this.R = new Float64Array(9); this.pR = new Float64Array(9); this.t = new Float64Array(3);
    this.updateR();
  }
  updateR() { quatToMat(this.qx, this.qy, this.qz, this.qw, this.R); }
  setPose(x, y, z, q) {
    this.x = this.px = x; this.y = this.py = y; this.z = this.pz = z;
    this.qx = this.pqx = q.x; this.qy = this.pqy = q.y; this.qz = this.pqz = q.z; this.qw = this.pqw = q.w;
    this.vx = this.vy = this.vz = this.wx = this.wy = this.wz = 0;
    this.updateR(); this.pR.set(this.R);
  }
  iiw(vx, vy, vz, out) {   // world inverse inertia * v
    const R = this.R, I = this.Iib;
    const bx = R[0] * vx + R[3] * vy + R[6] * vz, by = R[1] * vx + R[4] * vy + R[7] * vz, bz = R[2] * vx + R[5] * vy + R[8] * vz;
    const cx = I[0] * bx + I[1] * by + I[2] * bz, cy = I[3] * bx + I[4] * by + I[5] * bz, cz = I[6] * bx + I[7] * by + I[8] * bz;
    out[0] = R[0] * cx + R[1] * cy + R[2] * cz; out[1] = R[3] * cx + R[4] * cy + R[5] * cz; out[2] = R[6] * cx + R[7] * cy + R[8] * cz;
  }
  w(rx, ry, rz, nx, ny, nz) {   // generalized inverse mass of a point at offset r along n
    const cx = ry * nz - rz * ny, cy = rz * nx - rx * nz, cz = rx * ny - ry * nx;
    this.iiw(cx, cy, cz, this.t);
    return this.im + cx * this.t[0] + cy * this.t[1] + cz * this.t[2];
  }
  rotate(ax, ay, az) {   // q += 0.5 * [a, 0] * q
    const qx = this.qx, qy = this.qy, qz = this.qz, qw = this.qw;
    const nx = qx + 0.5 * (ax * qw + ay * qz - az * qy);
    const ny = qy + 0.5 * (-ax * qz + ay * qw + az * qx);
    const nz = qz + 0.5 * (ax * qy - ay * qx + az * qw);
    const nw = qw + 0.5 * (-ax * qx - ay * qy - az * qz);
    const l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
    this.qx = nx * l; this.qy = ny * l; this.qz = nz * l; this.qw = nw * l;
    this.updateR();
  }
  applyP(px, py, pz, rx, ry, rz) {   // positional impulse p applied at offset r
    const im = this.im;
    this.x += px * im; this.y += py * im; this.z += pz * im;
    const cx = ry * pz - rz * py, cy = rz * px - rx * pz, cz = rx * py - ry * px;
    this.iiw(cx, cy, cz, this.t);
    this.rotate(this.t[0], this.t[1], this.t[2]);
  }
  applyImpulse(jx, jy, jz, rx, ry, rz) {   // velocity-level impulse
    this.vx += jx * this.im; this.vy += jy * this.im; this.vz += jz * this.im;
    this.iiw(ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, this.t);
    this.wx += this.t[0]; this.wy += this.t[1]; this.wz += this.t[2];
  }
  integrate(h, linD, angD) {
    this.px = this.x; this.py = this.y; this.pz = this.z;
    this.pqx = this.qx; this.pqy = this.qy; this.pqz = this.qz; this.pqw = this.qw; this.pR.set(this.R);
    this.vy -= GRAV * h;
    const ld = Math.exp(-linD * h), ad = Math.exp(-angD * h);
    this.vx *= ld; this.vy *= ld; this.vz *= ld; this.wx *= ad; this.wy *= ad; this.wz *= ad;
    this.x += this.vx * h; this.y += this.vy * h; this.z += this.vz * h;
    this.rotate(this.wx * h, this.wy * h, this.wz * h);
  }
  finish(h, maxV, maxW) {
    const ih = 1 / h;
    this.vx = (this.x - this.px) * ih; this.vy = (this.y - this.py) * ih; this.vz = (this.z - this.pz) * ih;
    const ax = this.qx, ay = this.qy, az = this.qz, aw = this.qw;
    const bx = -this.pqx, by = -this.pqy, bz = -this.pqz, bw = this.pqw;
    const dx = aw * bx + ax * bw + ay * bz - az * by, dy = aw * by - ax * bz + ay * bw + az * bx;
    const dz = aw * bz + ax * by - ay * bx + az * bw, dw = aw * bw - ax * bx - ay * by - az * bz;
    const s = dw >= 0 ? 2 * ih : -2 * ih;
    this.wx = dx * s; this.wy = dy * s; this.wz = dz * s;
    const v = Math.hypot(this.vx, this.vy, this.vz);
    if (v > maxV) { const k = maxV / v; this.vx *= k; this.vy *= k; this.vz *= k; }
    const w = Math.hypot(this.wx, this.wy, this.wz);
    if (w > maxW) { const k = maxW / w; this.wx *= k; this.wy *= k; this.wz *= k; }
  }
  ok() {
    return Number.isFinite(this.x + this.y + this.z + this.qx + this.qy + this.qz + this.qw + this.vx + this.vy + this.vz + this.wx + this.wy + this.wz);
  }
}

/* ============================================================================================================
 * Placeholder plush (used when opts.softMeshes is absent) - same rest frame as the real asset
 * ==========================================================================================================*/
function buildPlaceholderPlush(own) {
  const white = own(new THREE.MeshPhysicalMaterial({ color: 0xf5f4ef, roughness: 0.93, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) }));
  const teal = own(new THREE.MeshStandardMaterial({ color: 0x67c9c8, roughness: 0.9 }));
  const cordMat = own(new THREE.MeshStandardMaterial({ color: 0xebebe6, roughness: 0.8 }));
  const parts = [];
  const head = new THREE.SphereGeometry(1, 48, 32); head.scale(0.0228, 0.022, 0.0142); head.translate(0, 0.081, 0.004); parts.push(head);
  const prof = [[0.0001, 0.0045], [0.0075, 0.0052], [0.0108, 0.0105], [0.0112, 0.024], [0.0112, 0.045], [0.0102, 0.056], [0.0092, 0.064], [0.0001, 0.066]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.LatheGeometry(prof, 40); body.scale(1, 1, 0.74); parts.push(body);
  for (const s of [-1, 1]) {
    const arm = new THREE.CapsuleGeometry(0.0042, 0.021, 6, 14); arm.rotateZ(s * 0.1); arm.translate(s * 0.0146, 0.038, 0); parts.push(arm);
    const leg = new THREE.CapsuleGeometry(0.0056, 0.008, 6, 14); leg.translate(s * 0.0054, 0.0095, 0); parts.push(leg);
  }
  for (const p of parts) p.deleteAttribute('uv');
  const bodyGeo = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  const collar = new THREE.CylinderGeometry(0.0106, 0.0118, 0.0062, 40, 1, false); collar.scale(1, 1, 0.8); collar.translate(0, 0.0555, 0.0005);
  const fs = new THREE.Shape();
  fs.moveTo(-0.0093, 0.1009); fs.lineTo(0.0093, 0.1009); fs.lineTo(0.0062, 0.1075); fs.lineTo(0.0036, 0.1148);
  fs.lineTo(0.0013, 0.1189); fs.lineTo(-0.0013, 0.1189); fs.lineTo(-0.0036, 0.1148); fs.lineTo(-0.0062, 0.1075); fs.closePath();
  const felt = new THREE.ExtrudeGeometry(fs, { depth: 0.0018, bevelEnabled: false, curveSegments: 1 }); felt.translate(0, 0, 0.0021);
  const cord = new THREE.TorusGeometry(0.0029, 0.00055, 8, 28); cord.rotateY(Math.PI / 2); cord.translate(0, 0.1158, 0.0008);
  const mk = (g, m, name) => { const o = new THREE.Mesh(g, m); o.name = name; o.castShadow = true; o.receiveShadow = true; own(g); return o; };
  return [mk(bodyGeo, white, 'plush_body'), mk(collar, teal, 'plush_collar'), mk(felt, teal, 'plush_felt'), mk(cord, cordMat, 'plush_cord')];
}

/* ============================================================================================================
 * Geometry builders for the hang tag, chain parts, stand
 * ==========================================================================================================*/
function buildTagGeometry(w, h, t, rc, holeX, holeY, holeD) {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x0 + rc, y0);
  shape.lineTo(x1 - rc, y0); shape.absarc(x1 - rc, y0 + rc, rc, -Math.PI / 2, 0, false);
  shape.lineTo(x1, y1 - rc); shape.absarc(x1 - rc, y1 - rc, rc, 0, Math.PI / 2, false);
  shape.lineTo(x0 + rc, y1); shape.absarc(x0 + rc, y1 - rc, rc, Math.PI / 2, Math.PI, false);
  shape.lineTo(x0, y0 + rc); shape.absarc(x0 + rc, y0 + rc, rc, Math.PI, Math.PI * 1.5, false);
  const hole = new THREE.Path();
  hole.absarc(x0 + holeX, y1 - holeY, holeD / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const ex = shape.extractPoints(6);
  const dedupe = (a) => { const o = []; for (const p of a) if (!o.length || o[o.length - 1].distanceTo(p) > 1e-7) o.push(p); if (o.length > 2 && o[0].distanceTo(o[o.length - 1]) < 1e-7) o.pop(); return o; };
  let outer = dedupe(ex.shape);
  let holes = ex.holes.map(dedupe);
  if (THREE.ShapeUtils.isClockWise(outer)) outer = outer.reverse();
  holes = holes.map((hp) => (THREE.ShapeUtils.isClockWise(hp) ? hp : hp.reverse()));
  const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
  const all = outer.concat(...holes);
  const pos = [], nrm = [], uv = [], idx = [];
  const push = (x, y, z, nx, ny, nz, u, v) => { pos.push(x, y, z); nrm.push(nx, ny, nz); uv.push(u, v); return pos.length / 3 - 1; };
  const fBase = 0; for (const p of all) push(p.x, p.y, t / 2, 0, 0, 1, (p.x - x0) / w, (p.y - y0) / h);
  const bBase = all.length; for (const p of all) push(p.x, p.y, -t / 2, 0, 0, -1, 1 - (p.x - x0) / w, (p.y - y0) / h);
  const ccwOf = (a, b, c) => { const A = all[a], B = all[b], C = all[c]; return (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) > 0; };
  for (const [a, b, c] of faces) { if (ccwOf(a, b, c)) idx.push(fBase + a, fBase + b, fBase + c); else idx.push(fBase + a, fBase + c, fBase + b); }
  const frontCount = idx.length;
  for (const [a, b, c] of faces) { if (ccwOf(a, b, c)) idx.push(bBase + a, bBase + c, bBase + b); else idx.push(bBase + a, bBase + b, bBase + c); }
  const backCount = idx.length - frontCount;
  const edgeStart = idx.length;
  for (const loop of [outer, ...holes]) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length];
      let nx = q.y - p.y, ny = -(q.x - p.x); const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const v0 = push(p.x, p.y, t / 2, nx, ny, 0, 0, 0), v1 = push(q.x, q.y, t / 2, nx, ny, 0, 1, 0);
      const v2 = push(q.x, q.y, -t / 2, nx, ny, 0, 1, 1), v3 = push(p.x, p.y, -t / 2, nx, ny, 0, 0, 1);
      idx.push(v0, v2, v1, v0, v3, v2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.addGroup(0, frontCount, 0); g.addGroup(frontCount, backCount, 1); g.addGroup(edgeStart, idx.length - edgeStart, 2);
  return g;
}
function placeholderTagTexture(back) {
  const W = 512, H = 668, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, W, H);
  if (!back) {
    g.fillStyle = '#6cc9c4'; g.fillRect(0, 0, W, 120); g.fillRect(0, H - 70, W, 70);
    g.fillStyle = '#f2c94c'; g.beginPath(); g.arc(380, 300, 70, 0, 7); g.fill();
    g.fillStyle = '#e88fb0'; g.beginPath(); g.arc(150, 430, 45, 0, 7); g.fill();
  } else {
    g.fillStyle = '#222'; for (let i = 0; i < 46; i++) { const x = 70 + i * 8, w = (i * 7) % 3 + 1; g.fillRect(x, 520, w * 2, 90); }
    g.fillStyle = '#999'; for (let i = 0; i < 8; i++) g.fillRect(60, 200 + i * 30, 380 - (i % 3) * 40, 10);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function woodTexture(seed = 5) {
  const W = 512, H = 256, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#a8784c'; g.fillRect(0, 0, W, H);
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 220; i++) {
    const y = r() * H, a = 0.04 + r() * 0.08;
    g.strokeStyle = r() < 0.55 ? `rgba(80,45,20,${a})` : `rgba(230,190,140,${a * 0.8})`;
    g.lineWidth = 0.6 + r() * 2; g.beginPath();
    const amp = 1 + r() * 5, f = 0.004 + r() * 0.01, ph = r() * 6.28;
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

/* ============================================================================================================
 * createPlush
 * ==========================================================================================================*/
export async function createPlush(ctx, opts = {}) {
  const quality = (opts.quality || ctx.quality) === 'low' ? 'low' : 'high';
  const P = plushDefaults(quality);
  if (opts.params) Object.assign(P, opts.params);

  const group = new THREE.Group(); group.name = 'plushKeychain';
  const softRoot = new THREE.Group(); softRoot.name = 'plushSoftRoot'; softRoot.matrixAutoUpdate = false;
  group.add(softRoot);
  const disposables = [];
  const own = (x) => { disposables.push(x); return x; };
  const onHint = typeof ctx.onHint === 'function' ? ctx.onHint : null;
  const onStroke = typeof opts.onStroke === 'function' ? opts.onStroke : null;

  /* ---------------------------------------------- soft meshes ---------------------------------------------- */
  let meshes = Array.isArray(opts.softMeshes) ? opts.softMeshes.filter((m) => m && m.isMesh) : [];
  const usingPlaceholder = meshes.length === 0;
  if (usingPlaceholder) meshes = buildPlaceholderPlush(own);

  const soft = meshes.map((m) => {
    m.updateWorldMatrix(true, false);
    let geo = m.geometry;
    if (!isIdentity(m.matrixWorld)) {   // bake any node transform into the geometry (rest frame)
      const mw = m.matrixWorld.clone();
      geo = geo.clone(); geo.applyMatrix4(mw);
      const rp = geo.getAttribute('restPosition');
      if (rp) { const v = new THREE.Vector3(); for (let i = 0; i < rp.count; i++) { v.fromBufferAttribute(rp, i).applyMatrix4(mw); rp.setXYZ(i, v.x, v.y, v.z); } }
      m.geometry = geo;
    }
    if (m.parent) m.parent.remove(m);
    m.position.set(0, 0, 0); m.quaternion.identity(); m.scale.set(1, 1, 1); m.updateMatrix();
    softRoot.add(m);
    let pa = geo.getAttribute('position');
    if (pa.isInterleavedBufferAttribute || !(pa.array instanceof Float32Array)) {
      const arr = new Float32Array(pa.count * 3);
      for (let i = 0; i < pa.count; i++) { arr[i * 3] = pa.getX(i); arr[i * 3 + 1] = pa.getY(i); arr[i * 3 + 2] = pa.getZ(i); }
      pa = new THREE.BufferAttribute(arr, 3); geo.setAttribute('position', pa);
    }
    pa.setUsage(THREE.DynamicDrawUsage);
    let ra = geo.getAttribute('restPosition');
    if (!ra || ra.count !== pa.count || ra.isInterleavedBufferAttribute) {
      ra = new THREE.BufferAttribute(new Float32Array(pa.array), 3); geo.setAttribute('restPosition', ra);
    }
    let na = geo.getAttribute('normal');
    if (!na || na.isInterleavedBufferAttribute || na.count !== pa.count) {
      na = new THREE.BufferAttribute(new Float32Array(pa.count * 3), 3); geo.setAttribute('normal', na);
    }
    na.setUsage(THREE.DynamicDrawUsage);
    const n = pa.count;
    let tri;
    if (geo.index) tri = Uint32Array.from(geo.index.array);
    else { tri = new Uint32Array(n - (n % 3)); for (let i = 0; i < tri.length; i++) tri[i] = i; }
    const name = (m.name || '').toLowerCase();
    return { mesh: m, geo, n, rest: ra.array, pos: pa.array, nrm: na.array, tri, name, pa, na,
      collider: !/felt|cord|label|tag/.test(name) };
  });
  if (!soft.some((s) => s.collider)) soft.forEach((s) => { s.collider = true; });

  // rest bounds and attach point
  const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  for (const s of soft) for (let i = 0; i < s.n; i++) for (let a = 0; a < 3; a++) {
    const v = s.rest[i * 3 + a]; if (v < bmin[a]) bmin[a] = v; if (v > bmax[a]) bmax[a] = v;
  }
  let attachRest;
  if (opts.attachPoint && opts.attachPoint.isVector3) attachRest = opts.attachPoint.clone();
  else {
    const cord = soft.find((s) => /cord/.test(s.name)) || soft.find((s) => /felt/.test(s.name));
    if (cord) {
      const b = new THREE.Box3().setFromArray(cord.rest);
      attachRest = new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y - (/cord/.test(cord.name) ? 0.0012 : 0), (b.min.z + b.max.z) / 2);
    } else attachRest = new THREE.Vector3((bmin[0] + bmax[0]) / 2, bmax[1], (bmin[2] + bmax[2]) / 2);
  }
  for (let a = 0; a < 3; a++) { const v = attachRest.getComponent(a); bmin[a] = Math.min(bmin[a], v); bmax[a] = Math.max(bmax[a], v); }

  /* ---------------------------------------------- lattice ---------------------------------------------- */
  const hL = P.cellSize;
  const LX0 = Math.floor(bmin[0] / hL) - 1, LY0 = Math.floor(bmin[1] / hL) - 1, LZ0 = Math.floor(bmin[2] / hL) - 1;
  const NCX = Math.floor(bmax[0] / hL) - LX0 + 2, NCY = Math.floor(bmax[1] / hL) - LY0 + 2, NCZ = Math.floor(bmax[2] / hL) - LZ0 + 2;
  const LO = [LX0 * hL, LY0 * hL, LZ0 * hL];
  const cells = new Uint8Array(NCX * NCY * NCZ);
  const markCell = (x, y, z) => {
    const i = Math.floor((x - LO[0]) / hL), j = Math.floor((y - LO[1]) / hL), k = Math.floor((z - LO[2]) / hL);
    if (i >= 1 && j >= 1 && k >= 1 && i < NCX - 1 && j < NCY - 1 && k < NCZ - 1) cells[i + NCX * (j + NCY * k)] = 1;
  };
  for (const s of soft) {
    sampleTriangles(s.rest, s.tri, hL * 0.45, markCell);
    for (let i = 0; i < s.n; i++) markCell(s.rest[i * 3], s.rest[i * 3 + 1], s.rest[i * 3 + 2]);
  }
  markCell(attachRest.x, attachRest.y, attachRest.z);
  floodExterior(cells, NCX, NCY, NCZ);
  const PX = NCX + 1, PY = NCY + 1, PZ = NCZ + 1, PXY = PX * PY, nSlots = PX * PY * PZ;
  const pidOfSlot = new Int32Array(nSlots).fill(-1);
  let nP = 0, nCells = 0;
  const cellMassCount = new Float64Array(nSlots);
  for (let k = 0; k < NCZ; k++) for (let j = 0; j < NCY; j++) for (let i = 0; i < NCX; i++) {
    if (cells[i + NCX * (j + NCY * k)] === 2) continue;
    nCells++;
    for (let c = 0; c < 8; c++) {
      const s = (i + (c & 1)) + PX * ((j + ((c >> 1) & 1)) + PY * (k + ((c >> 2) & 1)));
      if (pidOfSlot[s] < 0) pidOfSlot[s] = nP++;
      cellMassCount[s] += 0.125;
    }
  }
  const slotOf = new Int32Array(nP);
  const X0 = new Float64Array(nP * 3);           // rest positions relative to com0
  const XA = new Float64Array(nP * 3);           // absolute rest positions (= local frame)
  const mass = new Float64Array(nP);
  let massSum = 0;
  for (let s = 0; s < nSlots; s++) {
    const p = pidOfSlot[s]; if (p < 0) continue;
    slotOf[p] = s;
    const i = s % PX, j = ((s / PX) | 0) % PY, k = (s / PXY) | 0;
    XA[p * 3] = LO[0] + i * hL; XA[p * 3 + 1] = LO[1] + j * hL; XA[p * 3 + 2] = LO[2] + k * hL;
    mass[p] = cellMassCount[s]; massSum += mass[p];
  }
  const com0 = new THREE.Vector3();
  for (let p = 0; p < nP; p++) { mass[p] *= P.plushMass / massSum; com0.x += mass[p] * XA[p * 3]; com0.y += mass[p] * XA[p * 3 + 1]; com0.z += mass[p] * XA[p * 3 + 2]; }
  com0.multiplyScalar(1 / P.plushMass);
  const Ibody = new Float64Array(9);
  for (let p = 0; p < nP; p++) {
    const x = XA[p * 3] - com0.x, y = XA[p * 3 + 1] - com0.y, z = XA[p * 3 + 2] - com0.z, m = mass[p];
    X0[p * 3] = x; X0[p * 3 + 1] = y; X0[p * 3 + 2] = z;
    const r2 = x * x + y * y + z * z + hL * hL / 6;
    Ibody[0] += m * (r2 - x * x); Ibody[4] += m * (r2 - y * y); Ibody[8] += m * (r2 - z * z);
    Ibody[1] -= m * x * y; Ibody[2] -= m * x * z; Ibody[5] -= m * y * z;
  }
  Ibody[3] = Ibody[1]; Ibody[6] = Ibody[2]; Ibody[7] = Ibody[5];

  // ---- embedding of every mesh vertex + per-cell vertex / triangle lists for incremental updates ----
  for (const s of soft) {
    s.eIdx = new Int32Array(s.n * 8); s.eW = new Float32Array(s.n * 8);
    const cellMap = new Map(); s.vMC = new Int32Array(s.n);
    const mcCells = [];
    for (let v = 0; v < s.n; v++) {
      const gx = (s.rest[v * 3] - LO[0]) / hL, gy = (s.rest[v * 3 + 1] - LO[1]) / hL, gz = (s.rest[v * 3 + 2] - LO[2]) / hL;
      const i = clamp(Math.floor(gx), 1, NCX - 2), j = clamp(Math.floor(gy), 1, NCY - 2), k = clamp(Math.floor(gz), 1, NCZ - 2);
      const fx = clamp(gx - i, 0, 1), fy = clamp(gy - j, 0, 1), fz = clamp(gz - k, 0, 1);
      let wsum = 0;
      for (let c = 0; c < 8; c++) {
        const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
        const pid = pidOfSlot[(i + dx) + PX * ((j + dy) + PY * (k + dz))];
        const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
        s.eIdx[v * 8 + c] = pid >= 0 ? pid : 0;
        s.eW[v * 8 + c] = pid >= 0 ? w : 0;
        if (pid >= 0) wsum += w;
      }
      if (wsum > 0 && Math.abs(wsum - 1) > 1e-6) for (let c = 0; c < 8; c++) s.eW[v * 8 + c] /= wsum;
      const gc = i + NCX * (j + NCY * k);
      let mc = cellMap.get(gc);
      if (mc === undefined) { mc = mcCells.length; cellMap.set(gc, mc); mcCells.push(v); }
      s.vMC[v] = mc;
    }
    const nMC = mcCells.length; s.nMC = nMC;
    s.mcCorners = new Int32Array(nMC * 8);
    for (let mc = 0; mc < nMC; mc++) for (let c = 0; c < 8; c++) s.mcCorners[mc * 8 + c] = s.eW[mcCells[mc] * 8 + c] > -1 ? s.eIdx[mcCells[mc] * 8 + c] : 0;
    // CSR: vertices per mesh-cell
    const cntV = new Int32Array(nMC + 1);
    for (let v = 0; v < s.n; v++) cntV[s.vMC[v] + 1]++;
    for (let i = 0; i < nMC; i++) cntV[i + 1] += cntV[i];
    s.mcVStart = Int32Array.from(cntV); s.mcV = new Int32Array(s.n);
    const fillV = Int32Array.from(cntV);
    for (let v = 0; v < s.n; v++) s.mcV[fillV[s.vMC[v]]++] = v;
    // CSR: triangles per mesh-cell (a triangle is listed in every cell its corners live in)
    const nTri = s.tri.length / 3; s.nTri = nTri;
    const cntT = new Int32Array(nMC + 1);
    const triCells = new Int32Array(nTri * 3);
    for (let t = 0; t < nTri; t++) {
      const a = s.vMC[s.tri[t * 3]], b = s.vMC[s.tri[t * 3 + 1]], c = s.vMC[s.tri[t * 3 + 2]];
      triCells[t * 3] = a; triCells[t * 3 + 1] = b !== a ? b : -1; triCells[t * 3 + 2] = c !== a && c !== b ? c : -1;
      for (let q = 0; q < 3; q++) if (triCells[t * 3 + q] >= 0) cntT[triCells[t * 3 + q] + 1]++;
    }
    for (let i = 0; i < nMC; i++) cntT[i + 1] += cntT[i];
    s.mcTStart = Int32Array.from(cntT); s.mcT = new Int32Array(cntT[nMC]);
    const fillT = Int32Array.from(cntT);
    for (let t = 0; t < nTri; t++) for (let q = 0; q < 3; q++) { const mc = triCells[t * 3 + q]; if (mc >= 0) s.mcT[fillT[mc]++] = t; }
    s.mcActive = new Uint8Array(nMC); s.triStamp = new Uint32Array(nTri); s.triList = new Int32Array(nTri);
    s.triPend = new Uint8Array(nTri); s.pend = new Int32Array(nTri); s.nPend = 0;
    // welded normals: vertices sharing a rest position share a normal (no cracks at UV seams)
    const key = new Map(); s.canon = new Int32Array(s.n);
    for (let v = 0; v < s.n; v++) {
      const k = Math.round(s.rest[v * 3] * 1e7) + ',' + Math.round(s.rest[v * 3 + 1] * 1e7) + ',' + Math.round(s.rest[v * 3 + 2] * 1e7);
      let c = key.get(k); if (c === undefined) { c = key.size; key.set(k, c); } s.canon[v] = c;
    }
    s.nCanon = key.size;
    s.acc = new Float32Array(s.nCanon * 3); s.triN = new Float32Array(nTri * 3);
    s.triC = new Int32Array(s.tri.length); for (let i = 0; i < s.tri.length; i++) s.triC[i] = s.canon[s.tri[i]];
    s.restNrm = new Float32Array(s.n * 3);
    fullNormals(s, s.rest, s.restNrm);
    s.restAcc = Float32Array.from(s.acc); s.restTriN = Float32Array.from(s.triN);
    s.pos.set(s.rest); s.nrm.set(s.restNrm);
    s.pa.needsUpdate = true; s.na.needsUpdate = true;
    s.geo.computeBoundingSphere();
    s.restSphere = s.geo.boundingSphere.clone();
  }
  function triNormal(pos, tri, t, out, o) {
    const a = tri[t * 3] * 3, b = tri[t * 3 + 1] * 3, c = tri[t * 3 + 2] * 3;
    const ax = pos[a], ay = pos[a + 1], az = pos[a + 2];
    const ux = pos[b] - ax, uy = pos[b + 1] - ay, uz = pos[b + 2] - az;
    const vx = pos[c] - ax, vy = pos[c + 1] - ay, vz = pos[c + 2] - az;
    out[o] = uy * vz - uz * vy; out[o + 1] = uz * vx - ux * vz; out[o + 2] = ux * vy - uy * vx;
  }
  function writeNormal(s, v) {
    const k = s.canon[v] * 3, acc = s.acc;
    const x = acc[k], y = acc[k + 1], z = acc[k + 2], l = Math.sqrt(x * x + y * y + z * z);
    if (l > 0) { const il = 1 / l; s.nrm[v * 3] = x * il; s.nrm[v * 3 + 1] = y * il; s.nrm[v * 3 + 2] = z * il; }
  }
  function fullNormals(s, pos, out) {
    const acc = s.acc, triN = s.triN, triC = s.triC;
    acc.fill(0);
    for (let t = 0; t < s.nTri; t++) {
      triNormal(pos, s.tri, t, triN, t * 3);
      const nx = triN[t * 3], ny = triN[t * 3 + 1], nz = triN[t * 3 + 2];
      for (let q = 0; q < 3; q++) { const k = triC[t * 3 + q] * 3; acc[k] += nx; acc[k + 1] += ny; acc[k + 2] += nz; }
    }
    for (let v = 0; v < s.n; v++) {
      const k = s.canon[v] * 3, x = acc[k], y = acc[k + 1], z = acc[k + 2], l = Math.sqrt(x * x + y * y + z * z);
      if (l > 0) { out[v * 3] = x / l; out[v * 3 + 1] = y / l; out[v * 3 + 2] = z / l; } else { out[v * 3] = 0; out[v * 3 + 1] = 1; out[v * 3 + 2] = 0; }
    }
  }

  // ---- separable 3x3x3 box sums over the particle grid (FastLSM region summation) ----
  const bufA = new Float64Array(nSlots * 12), bufB = new Float64Array(nSlots * 12);
  function boxSum(src, dst, K) {   // result in dst, src is clobbered; boundary slots stay zero
    const sy = PX * K, sz = PXY * K;
    for (let z = 1; z < PZ - 1; z++) for (let y = 1; y < PY - 1; y++) {
      let s = (1 + PX * (y + PY * z)) * K;
      for (let x = 1; x < PX - 1; x++, s += K) for (let c = 0; c < K; c++) dst[s + c] = src[s - K + c] + src[s + c] + src[s + K + c];
    }
    for (let z = 1; z < PZ - 1; z++) for (let y = 1; y < PY - 1; y++) {
      let s = (1 + PX * (y + PY * z)) * K;
      for (let x = 1; x < PX - 1; x++, s += K) for (let c = 0; c < K; c++) src[s + c] = dst[s - sy + c] + dst[s + c] + dst[s + sy + c];
    }
    for (let z = 1; z < PZ - 1; z++) for (let y = 1; y < PY - 1; y++) {
      let s = (1 + PX * (y + PY * z)) * K;
      for (let x = 1; x < PX - 1; x++, s += K) for (let c = 0; c < K; c++) dst[s + c] = src[s - sz + c] + src[s + c] + src[s + sz + c];
    }
  }
  // region rest data
  const nReg = new Float64Array(nP), regM = new Float64Array(nP), regC0 = new Float64Array(nP * 3);
  const regAqqInv = new Float64Array(nP * 9), regLinOK = new Uint8Array(nP), regQ = new Float64Array(nP * 4);
  {
    const K = 11; const A = new Float64Array(nSlots * K), B = new Float64Array(nSlots * K);
    for (let p = 0; p < nP; p++) {
      const s = slotOf[p] * K, m = mass[p], x = X0[p * 3], y = X0[p * 3 + 1], z = X0[p * 3 + 2];
      A[s] = 1; A[s + 1] = m; A[s + 2] = m * x; A[s + 3] = m * y; A[s + 4] = m * z;
      A[s + 5] = m * x * x; A[s + 6] = m * x * y; A[s + 7] = m * x * z; A[s + 8] = m * y * y; A[s + 9] = m * y * z; A[s + 10] = m * z * z;
    }
    boxSum(A, B, K);
    const Aqq = new Float64Array(9), Ai = new Float64Array(9);
    for (let p = 0; p < nP; p++) {
      const s = slotOf[p] * K;
      nReg[p] = B[s]; const M = B[s + 1]; regM[p] = M;
      const cx = B[s + 2] / M, cy = B[s + 3] / M, cz = B[s + 4] / M;
      regC0[p * 3] = cx; regC0[p * 3 + 1] = cy; regC0[p * 3 + 2] = cz;
      Aqq[0] = B[s + 5] - M * cx * cx; Aqq[1] = B[s + 6] - M * cx * cy; Aqq[2] = B[s + 7] - M * cx * cz;
      Aqq[4] = B[s + 8] - M * cy * cy; Aqq[5] = B[s + 9] - M * cy * cz; Aqq[8] = B[s + 10] - M * cz * cz;
      Aqq[3] = Aqq[1]; Aqq[6] = Aqq[2]; Aqq[7] = Aqq[5];
      const tr = (Aqq[0] + Aqq[4] + Aqq[8]) / 3;
      const det = inv3(Aqq, Ai);
      if (tr > 0 && det / (tr * tr * tr) > 2e-3) { regLinOK[p] = 1; regAqqInv.set(Ai, p * 9); }
      regQ[p * 4 + 3] = 1;
    }
  }
  // extra pull to the rest shape around the cord loop (it carries the plush)
  const kappaW = new Float64Array(nP);
  for (let p = 0; p < nP; p++) {
    const dx = XA[p * 3] - attachRest.x, dy = XA[p * 3 + 1] - attachRest.y, dz = XA[p * 3 + 2] - attachRest.z;
    kappaW[p] = Math.exp(-(dx * dx + dy * dy + dz * dz) / (2 * 0.007 * 0.007));
  }

  /* ---------------------------------------------- SDF ---------------------------------------------- */
  const sdf = (() => {
    const h = P.sdfCell;
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (const s of soft) if (s.collider) for (let i = 0; i < s.n; i++) for (let a = 0; a < 3; a++) {
      const v = s.rest[i * 3 + a]; if (v < mn[a]) mn[a] = v; if (v > mx[a]) mx[a] = v;
    }
    const pad = 5;
    const O = [mn[0] - pad * h, mn[1] - pad * h, mn[2] - pad * h];
    const NX = Math.ceil((mx[0] - mn[0]) / h) + 2 * pad + 1, NY = Math.ceil((mx[1] - mn[1]) / h) + 2 * pad + 1, NZ = Math.ceil((mx[2] - mn[2]) / h) + 2 * pad + 1;
    const occ = new Uint8Array(NX * NY * NZ);
    const mark = (x, y, z) => {
      const i = Math.floor((x - O[0]) / h), j = Math.floor((y - O[1]) / h), k = Math.floor((z - O[2]) / h);
      if (i >= 0 && j >= 0 && k >= 0 && i < NX && j < NY && k < NZ) occ[i + NX * (j + NY * k)] = 1;
    };
    for (const s of soft) if (s.collider) sampleTriangles(s.rest, s.tri, h * 0.5, mark);
    floodExterior(occ, NX, NY, NZ);
    const dIn = new Float64Array(occ.length), dOut = new Float64Array(occ.length);
    for (let i = 0; i < occ.length; i++) { const inside = occ[i] !== 2; dIn[i] = inside ? 0 : 1e20; dOut[i] = inside ? 1e20 : 0; }
    edt3d(dIn, NX, NY, NZ); edt3d(dOut, NX, NY, NZ);
    const phi = new Float32Array(occ.length);
    for (let i = 0; i < occ.length; i++) {
      const inside = occ[i] !== 2;
      phi[i] = (inside ? -(Math.sqrt(dOut[i]) - 0.5) : (Math.sqrt(dIn[i]) - 0.5)) * h - P.sdfInflate;
    }
    return { h, NX, NY, NZ, ox: O[0] + 0.5 * h, oy: O[1] + 0.5 * h, oz: O[2] + 0.5 * h, phi,
      min: [mn[0] - 3 * h, mn[1] - 3 * h, mn[2] - 3 * h], max: [mx[0] + 3 * h, mx[1] + 3 * h, mx[2] + 3 * h] };
  })();
  const sdfGrad = new Float64Array(3);
  // Rest-frame signed distance (m) + normalised gradient into sdfGrad. Outside the box -> +1.
  function sdfSample(X, Y, Z, wantGrad) {
    if (X < sdf.min[0] || Y < sdf.min[1] || Z < sdf.min[2] || X > sdf.max[0] || Y > sdf.max[1] || Z > sdf.max[2]) return 1;
    const h = sdf.h, NX = sdf.NX, NXY = sdf.NX * sdf.NY;
    let gx = (X - sdf.ox) / h, gy = (Y - sdf.oy) / h, gz = (Z - sdf.oz) / h;
    gx = clamp(gx, 0, sdf.NX - 1.0001); gy = clamp(gy, 0, sdf.NY - 1.0001); gz = clamp(gz, 0, sdf.NZ - 1.0001);
    const i = gx | 0, j = gy | 0, k = gz | 0, fx = gx - i, fy = gy - j, fz = gz - k;
    const b = i + NX * j + NXY * k, ph = sdf.phi;
    const c000 = ph[b], c100 = ph[b + 1], c010 = ph[b + NX], c110 = ph[b + NX + 1];
    const c001 = ph[b + NXY], c101 = ph[b + NXY + 1], c011 = ph[b + NXY + NX], c111 = ph[b + NXY + NX + 1];
    const x00 = c000 + (c100 - c000) * fx, x10 = c010 + (c110 - c010) * fx, x01 = c001 + (c101 - c001) * fx, x11 = c011 + (c111 - c011) * fx;
    const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
    const val = y0 + (y1 - y0) * fz;
    if (wantGrad) {
      const dx0 = (c100 - c000) + ((c110 - c010) - (c100 - c000)) * fy, dx1 = (c101 - c001) + ((c111 - c011) - (c101 - c001)) * fy;
      let ddx = dx0 + (dx1 - dx0) * fz;
      const dy0 = x10 - x00, dy1 = x11 - x01; let ddy = dy0 + (dy1 - dy0) * fz;
      let ddz = y1 - y0;
      const l = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      if (l > 1e-12) { ddx /= l; ddy /= l; ddz /= l; } else { ddx = 0; ddy = 1; ddz = 0; }
      sdfGrad[0] = ddx; sdfGrad[1] = ddy; sdfGrad[2] = ddz;
    }
    return val;
  }
  // contact samples on the plush surface (rest, relative to com0), ~6 mm apart
  const plushSamples = (() => {
    const cell = 0.006, seen = new Set(), out = [];
    for (const s of soft) if (s.collider) for (let i = 0; i < s.n; i++) {
      const x = s.rest[i * 3], y = s.rest[i * 3 + 1], z = s.rest[i * 3 + 2];
      const k = Math.floor(x / cell) + ',' + Math.floor(y / cell) + ',' + Math.floor(z / cell);
      if (seen.has(k)) continue; seen.add(k);
      out.push(x - com0.x, y - com0.y, z - com0.z);
    }
    return Float64Array.from(out);
  })();
  const nPS = plushSamples.length / 3;
  let plushBoundR = 0;
  for (let i = 0; i < plushSamples.length; i += 3) plushBoundR = Math.max(plushBoundR, Math.hypot(plushSamples[i], plushSamples[i + 1], plushSamples[i + 2]));
  plushBoundR = Math.max(plushBoundR, Math.hypot(attachRest.x - com0.x, attachRest.y - com0.y, attachRest.z - com0.z)) + 0.004;
  const attachB = [attachRest.x - com0.x, attachRest.y - com0.y, attachRest.z - com0.z];   // body-frame attach offset
  const phiRest = new Float64Array(nP);   // rest signed distance of every lattice particle to the (fur) surface
  for (let p = 0; p < nP; p++) phiRest[p] = clamp(sdfSample(XA[p * 3], XA[p * 3 + 1], XA[p * 3 + 2], false), -0.03, 0.008);

  /* ---------------------------------------------- placement & stand ---------------------------------------------- */
  const standAngle = opts.standAngle || 0;
  const facing = opts.facing || 0;
  const UP = new THREE.Vector3(0, 1, 0);
  const FWD = new THREE.Vector3(Math.sin(standAngle), 0, Math.cos(standAngle));     // final arm leg points this way
  const SIDE = new THREE.Vector3().crossVectors(UP, FWD).normalize();               // eye axis = chain-loop plane normal
  const rT = P.hookWire + P.beadRadius, rB = 0.0017;
  // chain topology: segment 0 (beads 0-1) is the clasp
  const nNormal = Math.max(8, Math.round((P.chainLength - P.claspSegment) / P.beadPitch));
  const N = nNormal + 1;
  const segL = new Float64Array(N).fill(P.beadPitch); segL[0] = P.claspSegment;
  const cum = new Float64Array(N + 1); for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + segL[i];
  const chainTotal = cum[N];
  const Lst = (chainTotal - Math.PI * (rT + rB)) / 2;
  const Ls = Math.sqrt(Math.max(1e-8, Lst * Lst - (rT - rB) * (rT - rB)));
  const dropToAttach = Ls + rB;      // from the hook point down to the chain's lowest point
  let H;
  if (opts.hookPosition && opts.hookPosition.isVector3) H = opts.hookPosition.clone();
  else {
    const o = opts.origin && opts.origin.isVector3 ? opts.origin : new THREE.Vector3();
    H = new THREE.Vector3(o.x, o.y + P.hangClearance + (attachRest.y - bmin[1]) + dropToAttach, o.z);
  }
  const tableY = opts.origin && opts.origin.isVector3 ? opts.origin.y : 0;
  const ringC = H.clone().addScaledVector(UP, P.eyeRadius);
  // mount 'stand': wooden post back-left, brass arm runs sideways then forward into the hook.
  // mount 'wall':  a short brass J hook coming straight out of the wall plane z = wallZ (no stand).
  const wallMount = opts.mount === 'wall';
  const wallZ = Number.isFinite(opts.wallZ) ? opts.wallZ : H.z - 0.06;
  const postXZ = wallMount ? new THREE.Vector3(1e3, 0, 1e3) : H.clone().addScaledVector(FWD, -P.armBack).addScaledVector(SIDE, -P.armSide);
  // eye: phi=0 bottom (the chain rests there), 90 front, 180 top, 270 back (arm junction); wire runs 270 -> 610 deg
  const ringPoint = (phi, out = new THREE.Vector3()) => out.copy(ringC).addScaledVector(UP, -Math.cos(phi) * P.eyeRadius).addScaledVector(FWD, Math.sin(phi) * P.eyeRadius);
  const phiStart = Math.PI * 1.5, phiEnd = Math.PI * 1.5 + Math.PI * 2 * (300 / 360);
  const armPath = [], hookPath = [];
  {
    const y = ringC.y, bend = 0.007;
    const at = (side, back) => new THREE.Vector3(H.x, y, H.z).addScaledVector(SIDE, side).addScaledVector(FWD, -back);
    if (wallMount) {   // straight out of the wall (along FWD) into the J
      const back0 = Math.max(P.eyeRadius + 0.004, (H.z - wallZ) * FWD.z + (H.x - H.x) + 0.0005);
      for (let i = 0; i <= 5; i++) armPath.push(at(0, back0 + (P.eyeRadius - back0) * i / 5));
    } else {
      armPath.push(at(-P.armSide, P.armBack));
      for (let i = 1; i <= 3; i++) armPath.push(at(-P.armSide + (P.armSide - bend) * i / 3, P.armBack));
      for (let i = 1; i <= 5; i++) { const a = (i / 6) * Math.PI / 2; armPath.push(at(-bend + bend * Math.sin(a), P.armBack - bend + bend * Math.cos(a))); }
      const z0 = P.armBack - bend;
      for (let i = 0; i <= 3; i++) armPath.push(at(0, z0 + (P.eyeRadius - z0) * i / 3));
    }
    hookPath.push(...armPath);
    for (let i = 1; i <= 34; i++) hookPath.push(ringPoint(phiStart + (phiEnd - phiStart) * (i / 34)));
  }
  const tipBall = ringPoint(phiEnd), tipR = P.hookWire * 1.3;
  const postTop = ringC.y + 0.009, baseTop = tableY + P.baseHeight;
  // arm capsules [ax ay az dx dy dz il2 r]; the eye is an analytic torus; the post a vertical capsule
  const armCaps = [];
  for (let i = 0; i < armPath.length - 1; i++) {
    const a = armPath[i], d = armPath[i + 1].clone().sub(a);
    armCaps.push(a.x, a.y, a.z, d.x, d.y, d.z, 1 / Math.max(1e-12, d.lengthSq()), P.hookArm);
  }
  const CAP = new Float64Array(armCaps); const nArmCaps = CAP.length / 8;
  const armBound = new THREE.Sphere().setFromPoints(armPath); armBound.radius += P.hookArm;
  const eyeReach = P.eyeRadius + P.hookWire;      // torus outer radius
  const baseC = postXZ.clone();
  // probes: static points tested against the plush SDF (hook wire, arm, post)
  const probes = [];
  for (let i = 0; i < hookPath.length - 1; i++) {
    const a = hookPath[i], b = hookPath[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.0022));
    for (let k = 0; k < n; k++) { const p = a.clone().lerp(b, k / n); probes.push(p.x, p.y, p.z, i < armPath.length - 1 ? P.hookArm : P.hookWire); }
  }
  probes.push(tipBall.x, tipBall.y, tipBall.z, tipR);
  if (!wallMount) for (let y = baseTop + 0.004; y < postTop; y += 0.004) probes.push(postXZ.x, y, postXZ.z, P.postRadius);
  // box colliders (world space, e.g. the hutch boards) + horizontal resting surfaces
  const boxList = (Array.isArray(opts.colliders) ? opts.colliders : []).filter((b) => b && b.isBox3).map((b) => [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
  if (wallMount && !opts.exhibition) boxList.push([H.x - 0.12, Math.max(tableY, H.y - 0.3), wallZ - 0.012, H.x + 0.12, H.y + 0.15, wallZ]);   // the wall the hook comes out of
  const BOX = Float64Array.from(boxList.flat()); const nBox = BOX.length / 6;
  const supports = (Array.isArray(opts.supports) && opts.supports.length ? opts.supports : [{ y: tableY, min: { x: -1e3, y: -1e3 }, max: { x: 1e3, y: 1e3 } }])
    .map((s) => ({ y: s.y, x0: s.min.x, z0: s.min.y, x1: s.max.x, z1: s.max.y }));
  function floorUnder(x, z, y) {   // highest support below (or slightly above) the point
    let best = tableY;
    for (const s of supports) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1 && s.y <= y + 0.01 && s.y > best) best = s.y;
    return best;
  }
  const boxOut = new Float64Array(4);
  // point (radius r) vs all boxes: deepest penetration -> boxOut = [nx, ny, nz, depth]; returns depth (0 = free)
  function pointVsBoxes(x, y, z, r) {
    let best = 0;
    for (let b = 0; b < nBox; b++) {
      const k = b * 6;
      if (x < BOX[k] - r || y < BOX[k + 1] - r || z < BOX[k + 2] - r || x > BOX[k + 3] + r || y > BOX[k + 4] + r || z > BOX[k + 5] + r) continue;
      const d0 = x - (BOX[k] - r), d1 = (BOX[k + 3] + r) - x, d2 = y - (BOX[k + 1] - r), d3 = (BOX[k + 4] + r) - y, d4 = z - (BOX[k + 2] - r), d5 = (BOX[k + 5] + r) - z;
      let m = d0, nx = -1, ny = 0, nz = 0;
      if (d1 < m) { m = d1; nx = 1; ny = 0; nz = 0; }
      if (d2 < m) { m = d2; nx = 0; ny = -1; nz = 0; }
      if (d3 < m) { m = d3; nx = 0; ny = 1; nz = 0; }
      if (d4 < m) { m = d4; nx = 0; ny = 0; nz = -1; }
      if (d5 < m) { m = d5; nx = 0; ny = 0; nz = 1; }
      if (m > best) { best = m; boxOut[0] = nx; boxOut[1] = ny; boxOut[2] = nz; }
    }
    boxOut[3] = best;
    return best;
  }
  function sphereNearBoxes(x, y, z, r) {
    for (let b = 0; b < nBox; b++) {
      const k = b * 6;
      const dx = Math.max(BOX[k] - x, 0, x - BOX[k + 3]), dy = Math.max(BOX[k + 1] - y, 0, y - BOX[k + 4]), dz = Math.max(BOX[k + 2] - z, 0, z - BOX[k + 5]);
      if (dx * dx + dy * dy + dz * dz < r * r) return true;
    }
    return false;
  }
  const PROBE = Float64Array.from(probes); const nProbes = PROBE.length / 4;

  /* ---------------------------------------------- bodies & chain state ---------------------------------------------- */
  const core = new RB(P.plushMass, Ibody);
  const tw = opts.tagSize?.w ?? 0.0373, th = opts.tagSize?.h ?? 0.0486, tt = opts.tagSize?.t ?? 0.00035;
  const holeX = opts.tagHole?.x ?? 0.0054, holeY = opts.tagHole?.y ?? 0.0075, holeD = opts.tagHole?.d ?? 0.0032;
  const tagCorner = opts.tagCornerRadius ?? 0.0025;
  const tagI = new Float64Array([P.tagMass * (th * th + tt * tt) / 12, 0, 0, 0, P.tagMass * (tw * tw + tt * tt) / 12, 0, 0, 0, P.tagMass * (tw * tw + th * th) / 12]);
  const tag = new RB(P.tagMass, tagI);
  const holeL = [-tw / 2 + holeX, th / 2 - holeY, 0];
  const tagBoundR = Math.hypot(tw, th) / 2 + 0.001;
  const tagSamples = [];   // ~8 mm grid over the card (edges included)
  {
    const nx = Math.max(2, Math.ceil(tw / 0.008)), ny = Math.max(2, Math.ceil(th / 0.008));
    for (let i = 0; i <= nx; i++) for (let j = 0; j <= ny; j++) {
      const x = (i / nx - 0.5) * (tw - 0.0015), y = (j / ny - 0.5) * (th - 0.0015);
      if (Math.hypot(x - holeL[0], y - holeL[1]) < 0.0035) continue;
      tagSamples.push(x, y, 0);
    }
  }
  const TS = Float64Array.from(tagSamples); const nTS = TS.length / 3;

  const bx = new Float64Array(N * 3), bp = new Float64Array(N * 3), bv = new Float64Array(N * 3);
  const bim = new Float64Array(N).fill(1 / P.beadMass);
  bim[0] = bim[1] = 1 / (P.beadMass + P.claspMass / 2);
  let exhibitionPin = -1;
  const pinPosition = new THREE.Vector3();
  const bendMin = new Float64Array(N);
  const cosB = Math.cos(P.bendMaxDeg * Math.PI / 180);
  for (let i = 0; i < N; i++) { const L1 = segL[(i - 1 + N) % N], L2 = segL[i]; bendMin[i] = Math.sqrt(L1 * L1 + L2 * L2 + 2 * L1 * L2 * cosB); }
  const bcontact = new Uint8Array(N), bnear = new Uint8Array(N);
  const rb = P.beadRadius, minLink = 2 * rb + 0.0001;
  const trackP = { seg: 0, t: 0.5 }, trackT = { seg: 0, t: 0.5 };

  // render-interpolation snapshots (taken at flesh-step boundaries)
  const bxPrev = new Float64Array(N * 3);
  const corePrev = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }, tagPrev = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };

  // flesh state, local (rest) frame
  const fu = new Float64Array(nP * 3), fw = new Float64Array(nP * 3), fold = new Float64Array(nP * 3), fprev = new Float64Array(nP * 3);
  const localP = new Float64Array(nP * 3), pAct = new Uint8Array(nP);
  const lastCoreV = new Float64Array(3), accLP = new Float64Array(3);
  let fleshActive = false, fleshShown = false;   // shown = meshes currently carry a deformation
  let lastExcite = -1e9, simTime = 0, frameStamp = 1;

  /* ---------------------------------------------- visuals ---------------------------------------------- */
  const nickel = own(new THREE.MeshStandardMaterial({ color: 0xd4d6d8, metalness: 1, roughness: 0.2 }));
  const brass = own(new THREE.MeshStandardMaterial({ color: 0xcaa255, metalness: 1, roughness: 0.3 }));
  const woodTex = own(woodTexture(7));
  const wood = own(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.58, metalness: 0 }));
  const beadGeo = own(new THREE.SphereGeometry(rb, 14, 10));
  const beads = new THREE.InstancedMesh(beadGeo, nickel, N); beads.name = 'ballChainBeads';
  beads.instanceMatrix.setUsage(THREE.DynamicDrawUsage); beads.castShadow = true; beads.frustumCulled = false;
  const linkGeo = own(new THREE.CylinderGeometry(0.00028, 0.00028, 1, 6, 1, true));
  const links = new THREE.InstancedMesh(linkGeo, nickel, N); links.name = 'ballChainLinks';
  links.instanceMatrix.setUsage(THREE.DynamicDrawUsage); links.frustumCulled = false;
  const claspGeo = own(new THREE.LatheGeometry([[0, -0.003], [0.0009, -0.003], [0.00125, -0.0027], [P.claspRadius, -0.0021], [P.claspRadius, 0.0021], [0.00125, 0.0027], [0.0009, 0.003], [0, 0.003]].map(([r, y]) => new THREE.Vector2(r, y)), 18));
  const clasp = new THREE.Mesh(claspGeo, nickel); clasp.name = 'ballChainClasp'; clasp.castShadow = true;
  group.add(beads, links, clasp);

  const tagGeo = own(buildTagGeometry(tw, th, tt, tagCorner, holeX, holeY, holeD));
  const tagFrontTex = opts.tagTextures?.front || own(placeholderTagTexture(false));
  const tagBackTex = opts.tagTextures?.back || own(placeholderTagTexture(true));
  const tagMats = [
    own(new THREE.MeshStandardMaterial({ map: tagFrontTex, roughness: 0.55, alphaTest: 0.5 })),
    own(new THREE.MeshStandardMaterial({ map: tagBackTex, roughness: 0.6, alphaTest: 0.5 })),
    own(new THREE.MeshStandardMaterial({ color: 0xf2f0e8, roughness: 0.85 })),
  ];
  const tagMesh = new THREE.Mesh(tagGeo, tagMats); tagMesh.name = 'hangTag'; tagMesh.castShadow = true; tagMesh.receiveShadow = true;
  group.add(tagMesh);

  const stand = new THREE.Group(); stand.name = 'hookStand'; group.add(stand);
  {
    const hookCurve = new THREE.CatmullRomCurve3(hookPath, false, 'centripetal', 0.5);
    const hookTube = new THREE.Mesh(own(new THREE.TubeGeometry(hookCurve, 260, P.hookWire * 1.08, 12, false)), brass);
    const tip = new THREE.Mesh(own(new THREE.SphereGeometry(tipR, 14, 10)), brass); tip.position.copy(tipBall);
    const collar = new THREE.Mesh(own(new THREE.CylinderGeometry(0.0032, 0.0037, 0.004, 18)), brass);
    collar.position.copy(postXZ).setY(ringC.y).addScaledVector(SIDE, P.postRadius + 0.0015); collar.quaternion.setFromUnitVectors(UP, SIDE);
    const postH = postTop - baseTop;
    const post = new THREE.Mesh(own(new THREE.CylinderGeometry(P.postRadius, P.postRadius, postH, 28)), wood);
    post.position.set(postXZ.x, baseTop + postH / 2, postXZ.z);
    const cap = new THREE.Mesh(own(new THREE.SphereGeometry(P.postRadius, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)), wood);
    cap.position.set(postXZ.x, postTop, postXZ.z); cap.scale.set(1, 0.5, 1);
    const baseProf = [[0, 0], [P.baseRadius - 0.002, 0], [P.baseRadius, 0.002], [P.baseRadius, P.baseHeight - 0.003], [P.baseRadius - 0.003, P.baseHeight], [0, P.baseHeight]];
    const base = new THREE.Mesh(own(new THREE.LatheGeometry(baseProf.map(([r, y]) => new THREE.Vector2(r, y)), 56)), wood);
    base.position.set(baseC.x, tableY, baseC.z);
    for (const m of wallMount ? [hookTube, tip] : [hookTube, tip, collar, post, cap, base]) { m.castShadow = true; m.receiveShadow = true; stand.add(m); }
  }

  // squeeze fingertip ghosts
  const fingerMat = own(new THREE.MeshStandardMaterial({ color: 0xf1c7b0, roughness: 0.7, transparent: true, opacity: 0, depthWrite: false }));
  const fingerGeo = own(new THREE.CapsuleGeometry(1, 2.2, 8, 16));
  const fingers = [new THREE.Mesh(fingerGeo, fingerMat), new THREE.Mesh(fingerGeo, fingerMat)];
  for (const f of fingers) { f.visible = false; f.userData.noExport = true; f.renderOrder = 5; group.add(f); }

  // lattice debug (key L in the harness)
  let debugObj = null;
  function buildDebug() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nP * 3), 3));
    const edges = [];
    for (let p = 0; p < nP; p++) {
      const s = slotOf[p];
      for (const d of [1, PX, PXY]) { const q = pidOfSlot[s + d]; if (q >= 0) edges.push(p, q); }
    }
    g.setIndex(edges);
    const lines = new THREE.LineSegments(g, own(new THREE.LineBasicMaterial({ color: 0x2a9df4, transparent: true, opacity: 0.45, depthTest: false })));
    const pts = new THREE.Points(g, own(new THREE.PointsMaterial({ color: 0xff5a36, size: 3, sizeAttenuation: false, depthTest: false })));
    own(g);
    const o = new THREE.Group(); o.add(lines, pts); o.renderOrder = 10;
    lines.frustumCulled = false; pts.frustumCulled = false;
    o.traverse((x) => { x.userData.noExport = true; });
    return o;
  }

  /* ---------------------------------------------- chain helpers ---------------------------------------------- */
  const qT = Math.PI * rT / 2, qB = Math.PI * rB;
  const sBottom = qT + Lst + qB / 2;
  function loopPoint(s, out) {   // initial loop shape in the (SIDE, UP) plane through H
    s = ((s % chainTotal) + chainTotal) % chainTotal;
    let u, v;
    if (s < qT) { const a = Math.PI / 2 - s / rT; u = rT * Math.cos(a); v = rT * Math.sin(a); }
    else if ((s -= qT) < Lst) { const k = s / Lst; u = rT + (rB - rT) * k; v = -Ls * k; }
    else if ((s -= Lst) < qB) { const a = -s / rB; u = rB * Math.cos(a); v = -Ls + rB * Math.sin(a); }
    else if ((s -= qB) < Lst) { const k = s / Lst; u = -rB + (rB - rT) * k; v = -Ls + Ls * k; }
    else { s -= Lst; const a = Math.PI - s / rT; u = rT * Math.cos(a); v = rT * Math.sin(a); }
    return out.copy(H).addScaledVector(SIDE, u).addScaledVector(UP, v);
  }
  function arcDist(a, b) { const d = Math.abs(a - b) % chainTotal; return Math.min(d, chainTotal - d); }
  function segFromArc(s, tr) {
    s = ((s % chainTotal) + chainTotal) % chainTotal;
    let j = 0; while (j < N - 1 && cum[j + 1] <= s) j++;
    tr.seg = j; tr.t = clamp((s - cum[j]) / segL[j], 0, 1);
  }
  // continuous nearest-point tracking along the loop (never jumps strands)
  function track(px, py, pz, tr) {
    let j = tr.seg, t = 0;
    for (let it = 0; it < 6; it++) {
      const a = j * 3, b = ((j + 1) % N) * 3;
      const dx = bx[b] - bx[a], dy = bx[b + 1] - bx[a + 1], dz = bx[b + 2] - bx[a + 2];
      t = ((px - bx[a]) * dx + (py - bx[a + 1]) * dy + (pz - bx[a + 2]) * dz) / Math.max(1e-14, dx * dx + dy * dy + dz * dz);
      if (t < 0 && it < 5) { j = (j - 1 + N) % N; continue; }
      if (t > 1 && it < 5) { j = (j + 1) % N; continue; }
      break;
    }
    tr.seg = j; tr.t = clamp(t, 0, 1);
  }
  const tmp3 = new Float64Array(3);

  /* ---------------------------------------------- interaction state ---------------------------------------------- */
  let tool = 'hand';
  let gesture = null;          // active pointer gesture
  let squeeze = null;          // { X, N, far, T, rF, dMax, depth, held, cand, f1, f2, releasing, vis }
  const plushGrabs = [];       // one per finger: { b:[3] body offset, weights, target state }
  let hooked = true;           // false once the loop has been lifted off the hook (then it can fall / lie on the table)
  let grabBead = null;         // { i, lambda, target state }
  let grabTag = null;          // { l:[3] local point, lambda, target state }
  const furStrokes = [];
  let furStrokeVersion = 0;
  let sleeping = false, calm = 0, floorCalm = 0, acc = 0, offHook = 0;
  let tagTurn = null, tagFlipDirection = 1;
  const turnQ = new THREE.Quaternion(), turnError = new THREE.Quaternion();
  const turnHole = new THREE.Vector3(), turnTarget = new THREE.Vector3();
  // A brief hand-assisted turn: lift the hole along the chain before turning the
  // card. The same attachment, collision and gravity solver remains in charge.
  function stepTagTurn(h) {
    if (!tagTurn) return;
    const t = tagTurn.t += h;
    if (t > 1.8) { tagTurn = null; return; }
    const lift = clamp(t / .4, 0, 1), turn = clamp((t - .35) / .7, 0, 1);
    turnTarget.lerpVectors(tagTurn.hole, tagTurn.target, lift * lift * (3 - 2 * lift));
    turnQ.slerpQuaternions(tagTurn.from, tagTurn.to, turn * turn * (3 - 2 * turn));
    turnError.set(-tag.qx, -tag.qy, -tag.qz, tag.qw).premultiply(turnQ).normalize();
    const sign = turnError.w < 0 ? -1 : 1;
    tag.wx += clamp(600 * turnError.x * sign - 34 * tag.wx, -450, 450) * h;
    tag.wy += clamp(600 * turnError.y * sign - 34 * tag.wy, -450, 450) * h;
    tag.wz += clamp(600 * turnError.z * sign - 34 * tag.wz, -450, 450) * h;
    const R = tag.R;
    const rx = R[0] * holeL[0] + R[1] * holeL[1], ry = R[3] * holeL[0] + R[4] * holeL[1], rz = R[6] * holeL[0] + R[7] * holeL[1];
    const k = P.tagMass * 1600, c = P.tagMass * 72;
    turnHole.set(
      k * (turnTarget.x - tag.x - rx) - c * tag.vx,
      k * (turnTarget.y - tag.y - ry) - c * tag.vy + P.tagMass * GRAV,
      k * (turnTarget.z - tag.z - rz) - c * tag.vz).clampLength(0, .12);
    tag.applyImpulse(turnHole.x * h, turnHole.y * h, turnHole.z * h, 0, 0, 0);
  }
  const stats = { ms: 0, mechMs: 0, fleshMs: 0, skinMs: 0, steps: 0, particles: nP, cells: nCells, verts: soft.reduce((a, s) => a + s.n, 0),
    tris: soft.reduce((a, s) => a + s.nTri, 0), sleeping: false, fleshActive: false, fleshDev: 0, fleshRelV: 0, fleshResets: 0, mechResets: 0,
    beads: N, activeCells: 0 };

  /* ---------------------------------------------- state init ---------------------------------------------- */
  const qPlushInit = new THREE.Quaternion().setFromAxisAngle(UP, facing);
  function initState() {
    tagTurn = null; tagFlipDirection = 1;
    // chain: bead 0/1 (the clasp) partway down the +SIDE strand
    const sOff = qT + Lst * 0.42;
    const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      loopPoint(sOff + cum[i], v);
      bx[i * 3] = v.x; bx[i * 3 + 1] = v.y; bx[i * 3 + 2] = v.z;
    }
    if (opts.exhibition) {
      if (exhibitionPin >= 0) bim[exhibitionPin] = 1 / P.beadMass;
      exhibitionPin = 0;
      for (let i = 1; i < N; i++) if (bx[i * 3 + 1] > bx[exhibitionPin * 3 + 1]) exhibitionPin = i;
      pinPosition.fromArray(bx, exhibitionPin * 3); bim[exhibitionPin] = 0;
    }
    bp.set(bx); bv.fill(0); bxPrev.set(bx);
    // plush: cord loop at the bottom of the loop
    const A = loopPoint(sBottom, new THREE.Vector3());
    const rA = new THREE.Vector3(...attachB).applyQuaternion(qPlushInit);
    core.setPose(A.x - rA.x, A.y - rA.y, A.z - rA.z, qPlushInit);
    segFromArc(sBottom - sOff, trackP);
    // tag: hole a little further along the loop, card hanging behind the head (tilted until it clears it)
    const sHole = sBottom + 0.0036;
    segFromArc(sHole - sOff, trackT);
    const hole = loopPoint(sHole, new THREE.Vector3());
    const zt = FWD.clone().negate(), yt = UP.clone(), xt = new THREE.Vector3().crossVectors(yt, zt);
    const qBase = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xt, yt, zt));
    const phiIn = -Math.PI / 2 - Math.atan2(-holeL[1], -holeL[0]);
    const qIn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), phiIn);
    const hl = new THREE.Vector3(...holeL);
    const qTag = new THREE.Quaternion();
    for (let deg = 4; deg <= 84; deg += 4) {
      const qTilt = new THREE.Quaternion().setFromAxisAngle(SIDE, deg * Math.PI / 180);
      qTag.copy(qTilt).multiply(qBase).multiply(qIn);
      const c = hole.clone().sub(hl.clone().applyQuaternion(qTag));
      tag.setPose(c.x, c.y, c.z, qTag);
      if (tagClearOfPlush()) break;
    }
    releaseBead();
    gesture = null; squeeze = null; plushGrabs.length = 0; grabTag = null; hooked = true;
    lastExcite = -1e9;
    fleshToRest();
    snapshotPrev();
    fleshActive = false; fleshShown = true;   // forces one rest upload
  }
  function tagClearOfPlush() {
    const R = tag.R;
    for (let i = 0; i < nTS; i++) {
      const lx = TS[i * 3], ly = TS[i * 3 + 1];
      toRest(tag.x + R[0] * lx + R[1] * ly, tag.y + R[3] * lx + R[4] * ly, tag.z + R[6] * lx + R[7] * ly, tmp3);
      if (sdfSample(tmp3[0], tmp3[1], tmp3[2], false) < 0.0012) return false;
    }
    return true;
  }
  // world -> plush rest frame (absolute rest coordinates) using the simulated core
  function toRest(wx, wy, wz, out) {
    const R = core.R, dx = wx - core.x, dy = wy - core.y, dz = wz - core.z;
    out[0] = R[0] * dx + R[3] * dy + R[6] * dz + com0.x;
    out[1] = R[1] * dx + R[4] * dy + R[7] * dz + com0.y;
    out[2] = R[2] * dx + R[5] * dy + R[8] * dz + com0.z;
  }
  function fleshToRest() {
    fu.set(XA); fw.fill(0); fprev.set(XA);
    for (let p = 0; p < nP; p++) { regQ[p * 4] = 0; regQ[p * 4 + 1] = 0; regQ[p * 4 + 2] = 0; regQ[p * 4 + 3] = 1; }
    lastCoreV[0] = core.vx; lastCoreV[1] = core.vy; lastCoreV[2] = core.vz; accLP.fill(0);
    stats.fleshDev = 0; stats.fleshRelV = 0;
  }
  function snapshotPrev() {
    bxPrev.set(bx);
    corePrev.x = core.x; corePrev.y = core.y; corePrev.z = core.z; corePrev.qx = core.qx; corePrev.qy = core.qy; corePrev.qz = core.qz; corePrev.qw = core.qw;
    tagPrev.x = tag.x; tagPrev.y = tag.y; tagPrev.z = tag.z; tagPrev.qx = tag.qx; tagPrev.qy = tag.qy; tagPrev.qz = tag.qz; tagPrev.qw = tag.qw;
    if (fleshActive) fprev.set(fu);
  }

  /* ---------------------------------------------- mechanism ---------------------------------------------- */
  function integrateBeads(h) {
    const d = Math.exp(-P.chainDamp * h), gh = GRAV * h;
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      bp[o] = bx[o]; bp[o + 1] = bx[o + 1]; bp[o + 2] = bx[o + 2];
      if (i === exhibitionPin) { bv[o] = bv[o + 1] = bv[o + 2] = 0; continue; }
      bv[o] *= d; bv[o + 1] = (bv[o + 1] - gh) * d; bv[o + 2] *= d;
      bx[o] += bv[o] * h; bx[o + 1] += bv[o + 1] * h; bx[o + 2] += bv[o + 2] * h;
    }
  }
  function integratePlush(h) {
    let linD = P.plushLinDamp, angD = P.plushAngDamp;
    if (squeeze && !squeeze.releasing) { linD += 6; angD += 10; }
    if (floorContact && !plushGrabs.length) { linD += P.floorDamping * 0.5; angD += P.floorDamping; }
    const R = core.R;
    if (plushGrabs.length) {
      for (const g of plushGrabs) {   // one soft spring per finger, each acting at its own grabbed spot
        const b = g.b;
        const rx = R[0] * b[0] + R[1] * b[1] + R[2] * b[2], ry = R[3] * b[0] + R[4] * b[1] + R[5] * b[2], rz = R[6] * b[0] + R[7] * b[1] + R[8] * b[2];
        const pxw = core.x + rx, pyw = core.y + ry, pzw = core.z + rz;
        const vpx = core.vx + core.wy * rz - core.wz * ry, vpy = core.vy + core.wz * rx - core.wx * rz, vpz = core.vz + core.wx * ry - core.wy * rx;
        const sh = 1 / plushGrabs.length, w0 = TAU * P.grabFreq, k = P.plushMass * w0 * w0 * g.ramp * sh, c = 2 * P.grabZeta * P.plushMass * w0 * g.ramp * sh;
        let fx = k * (g.sx - pxw) + c * (g.svx - vpx), fy = k * (g.sy - pyw) + c * (g.svy - vpy), fz = k * (g.sz - pzw) + c * (g.svz - vpz);
        const fl = Math.hypot(fx, fy, fz), fm = P.grabMaxForce * sh;
        if (fl > fm) { const s = fm / fl; fx *= s; fy *= s; fz *= s; }
        core.applyImpulse(fx * h, fy * h, fz * h, rx, ry, rz);
      }
      angD += 2.5;
    } else if (P.twistStiffness > 0 && hooked) {
      // gentle twist return: the chain threaded through the cord loop prefers the face toward FWD (the viewer)
      const fzx = R[2], fzz = R[8], hl = Math.hypot(fzx, fzz);
      if (hl > 0.3) {
        const dx = Math.sin(facing), dz = Math.cos(facing);
        const err = Math.atan2(dz * fzx - dx * fzz, dx * fzx + dz * fzz);
        core.iiw(0, 1, 0, tmp3);
        const Iv = 1 / Math.max(1e-12, tmp3[1]);
        core.wy += (-P.twistStiffness * err - P.twistDamping * core.wy) / Iv * h;
      }
    }
    core.integrate(h, linD, angD);
  }
  function beadFriction(o, nx, ny, nz, depth, mu) {
    const dx = bx[o] - bp[o], dy = bx[o + 1] - bp[o + 1], dz = bx[o + 2] - bp[o + 2];
    const dn = dx * nx + dy * ny + dz * nz;
    const tx = dx - dn * nx, ty = dy - dn * ny, tz = dz - dn * nz;
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tl < 1e-12) return;
    const lim = mu * depth, k = tl <= lim ? 1 : lim / tl;
    bx[o] -= tx * k; bx[o + 1] -= ty * k; bx[o + 2] -= tz * k;
  }
  // bead vs table / base / eye (torus) / arm / tip / post.  record: store contacts + near flags.
  function beadCollideStatic(i, friction, record) {
    const o = i * 3;
    if (opts.exhibition) {
      if (i === exhibitionPin) pinPosition.toArray(bx, o);
      bcontact[i] = i === exhibitionPin ? 1 : 0; bnear[i] = bcontact[i];
      return;
    }
    let x = bx[o], y = bx[o + 1], z = bx[o + 2];
    let touched = 0, near = 0;
    const ty = tableY + rb;
    if (!opts.exhibition && y < ty + 0.002) {
      near = 1;
      if (y < ty) { const d = ty - y; bx[o + 1] = ty; y = ty; if (friction) { beadFriction(o, 0, 1, 0, d, P.tableFriction); x = bx[o]; z = bx[o + 2]; } touched = 2; }
    }
    // hutch boards / wall
    if (nBox && pointVsBoxes(x, y, z, rb + 0.002) > 0) {
      near = 1;
      const pen = boxOut[3] - 0.002;
      if (pen > 0) {
        bx[o] += boxOut[0] * pen; bx[o + 1] += boxOut[1] * pen; bx[o + 2] += boxOut[2] * pen;
        if (friction) beadFriction(o, boxOut[0], boxOut[1], boxOut[2], pen, P.tableFriction);
        x = bx[o]; y = bx[o + 1]; z = bx[o + 2]; if (!touched) touched = 2;
      }
    }
    // base disc
    const ddx = x - baseC.x, ddz = z - baseC.z, hd = Math.hypot(ddx, ddz);
    if (!opts.exhibition && hd < P.baseRadius + rb + 0.002 && y < baseTop + rb + 0.002) {
      near = 1;
      if (hd < P.baseRadius + rb && y < baseTop + rb) {
        const up = baseTop + rb - y, side = P.baseRadius + rb - hd;
        if (up < side) { bx[o + 1] = baseTop + rb; if (friction) beadFriction(o, 0, 1, 0, up, P.tableFriction); }
        else if (hd > 1e-9) { bx[o] += ddx / hd * side; bx[o + 2] += ddz / hd * side; }
        touched = 2; x = bx[o]; y = bx[o + 1]; z = bx[o + 2];
      }
    }
    // eye: closed torus around ringC, axis SIDE (only while the loop is on the hook)
    if (hooked) {
      const dx = x - ringC.x, dy = y - ringC.y, dz = z - ringC.z;
      const reach = eyeReach + rb + 0.002;
      if (dx * dx + dy * dy + dz * dz < reach * reach) {
        near = 1;
        const a = dx * SIDE.x + dy * SIDE.y + dz * SIDE.z;
        let px = dx - a * SIDE.x, py = dy - a * SIDE.y, pz = dz - a * SIDE.z;
        let pl = Math.sqrt(px * px + py * py + pz * pz);
        if (pl < 1e-9) { px = 0; py = -1; pz = 0; pl = 1; }
        const k = P.eyeRadius / pl;
        let ex = dx - px * k, ey = dy - py * k, ez = dz - pz * k;
        let d = Math.sqrt(ex * ex + ey * ey + ez * ez);
        const r = P.hookWire + rb;
        // swept guard: a bead may not end up on the other side of the wire than where this substep started
        {
          const qx = bp[o] - ringC.x, qy = bp[o + 1] - ringC.y, qz = bp[o + 2] - ringC.z;
          const a0 = qx * SIDE.x + qy * SIDE.y + qz * SIDE.z;
          let p0x = qx - a0 * SIDE.x, p0y = qy - a0 * SIDE.y, p0z = qz - a0 * SIDE.z; const l0 = Math.sqrt(p0x * p0x + p0y * p0y + p0z * p0z) || 1;
          const k0 = P.eyeRadius / l0;
          const n0x = qx - p0x * k0, n0y = qy - p0y * k0, n0z = qz - p0z * k0, nl = Math.sqrt(n0x * n0x + n0y * n0y + n0z * n0z);
          const sameArc = (px * p0x + py * p0y + pz * p0z) > 0.9 * pl * l0;   // both closest points on the same stretch of wire
          if (sameArc && nl > 0.6 * r && d < 3 * r && ex * n0x + ey * n0y + ez * n0z < 0) {
            const s = r / nl;   // put it back on its original side, touching the wire
            bx[o] = ringC.x + px * k + n0x * s; bx[o + 1] = ringC.y + py * k + n0y * s; bx[o + 2] = ringC.z + pz * k + n0z * s;
            ex = n0x * s; ey = n0y * s; ez = n0z * s; d = r;
            x = bx[o]; y = bx[o + 1]; z = bx[o + 2];
          }
        }
        if (d < r + 0.00006) {
          touched = 1;
          if (d < r) {
            if (d > 1e-9) { ex /= d; ey /= d; ez /= d; } else { ex = 0; ey = 1; ez = 0; }
            const pen = r - d;
            bx[o] += ex * pen; bx[o + 1] += ey * pen; bx[o + 2] += ez * pen;
            if (friction) beadFriction(o, ex, ey, ez, pen, P.hookFriction);
            x = bx[o]; y = bx[o + 1]; z = bx[o + 2];
          }
        }
        // tip ball
        let tx = x - tipBall.x, tyy = y - tipBall.y, tz = z - tipBall.z;
        const td = Math.sqrt(tx * tx + tyy * tyy + tz * tz), tr = tipR + rb;
        if (td < tr && td > 1e-9) { const pen = tr - td; bx[o] += tx / td * pen; bx[o + 1] += tyy / td * pen; bx[o + 2] += tz / td * pen; touched = 1; x = bx[o]; y = bx[o + 1]; z = bx[o + 2]; }
      }
    }
    // arm
    {
      const dx = x - armBound.center.x, dy = y - armBound.center.y, dz = z - armBound.center.z, r = armBound.radius + rb + 0.002;
      if (dx * dx + dy * dy + dz * dz < r * r) {
        near = 1;
        for (let c = 0; c < nArmCaps; c++) {
          const k = c * 8;
          let t = ((x - CAP[k]) * CAP[k + 3] + (y - CAP[k + 1]) * CAP[k + 4] + (z - CAP[k + 2]) * CAP[k + 5]) * CAP[k + 6];
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          let ex = x - (CAP[k] + CAP[k + 3] * t), ey = y - (CAP[k + 1] + CAP[k + 4] * t), ez = z - (CAP[k + 2] + CAP[k + 5] * t);
          const d = Math.sqrt(ex * ex + ey * ey + ez * ez), rr = CAP[k + 7] + rb;
          if (d < rr + 0.00006) {
            touched = 1;
            if (d < rr && d > 1e-9) {
              ex /= d; ey /= d; ez /= d; const pen = rr - d;
              bx[o] += ex * pen; bx[o + 1] += ey * pen; bx[o + 2] += ez * pen;
              if (friction) beadFriction(o, ex, ey, ez, pen, P.hookFriction);
              x = bx[o]; y = bx[o + 1]; z = bx[o + 2];
            }
          }
        }
      }
    }
    // post
    {
      let ex = x - postXZ.x, ez = z - postXZ.z; const d = Math.hypot(ex, ez), rr = P.postRadius + rb;
      if (d < rr + 0.002 && y > baseTop - rb && y < postTop + rr) {
        near = 1;
        if (d < rr && d > 1e-9) {
          ex /= d; ez /= d; const pen = rr - d;
          bx[o] += ex * pen; bx[o + 2] += ez * pen;
          if (friction) beadFriction(o, ex, 0, ez, pen, P.hookFriction);
          if (!touched) touched = 2;
        }
      }
    }
    if (record) { bcontact[i] = touched; bnear[i] = near; }
  }
  // Link wires vs the eye: the midpoint of every link near the eye must stay on the side of the wire it started the
  // substep on, at least a link radius away - otherwise a stretched link could let the wire slip between two beads.
  function linksVsEye() {
    if (opts.exhibition || !hooked) return;
    const rl = P.hookWire + 0.0004, Re = P.eyeRadius;
    for (let i = 0; i < N; i++) {
      const j = i === N - 1 ? 0 : i + 1;
      if (!bnear[i] && !bnear[j]) continue;
      const oi = i * 3, oj = j * 3;
      for (let sI = 1; sI <= 3; sI++) {
      const f = sI * 0.25, g = 1 - f;
      const mx = bx[oi] * g + bx[oj] * f - ringC.x, my = bx[oi + 1] * g + bx[oj + 1] * f - ringC.y, mz = bx[oi + 2] * g + bx[oj + 2] * f - ringC.z;
      const m0x = bp[oi] * g + bp[oj] * f - ringC.x, m0y = bp[oi + 1] * g + bp[oj + 1] * f - ringC.y, m0z = bp[oi + 2] * g + bp[oj + 2] * f - ringC.z;
      // closest circle points
      const a = mx * SIDE.x + my * SIDE.y + mz * SIDE.z;
      let px = mx - a * SIDE.x, py = my - a * SIDE.y, pz = mz - a * SIDE.z; let pl = Math.sqrt(px * px + py * py + pz * pz); if (pl < 1e-9) { px = 0; py = -1; pz = 0; pl = 1; }
      const qx = px * Re / pl, qy = py * Re / pl, qz = pz * Re / pl;
      let ex = mx - qx, ey = my - qy, ez = mz - qz; const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (d > 3 * rl) continue;
      const a0 = m0x * SIDE.x + m0y * SIDE.y + m0z * SIDE.z;
      let p0x = m0x - a0 * SIDE.x, p0y = m0y - a0 * SIDE.y, p0z = m0z - a0 * SIDE.z; const l0 = Math.sqrt(p0x * p0x + p0y * p0y + p0z * p0z) || 1;
      let nx = m0x - p0x * Re / l0, ny = m0y - p0y * Re / l0, nz = m0z - p0z * Re / l0; const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const sameArc = (px * p0x + py * p0y + pz * p0z) > 0.9 * pl * l0;
      const crossed = sameArc && nl > 1e-6 && ex * nx + ey * ny + ez * nz < 0;
      if (!crossed && d >= rl) continue;
      if (crossed || d < 1e-9) { nx /= nl || 1; ny /= nl || 1; nz /= nl || 1; } else { nx = ex / d; ny = ey / d; nz = ez / d; }
      // move the midpoint to q + n * rl (both beads equally)
      const dx = qx + nx * rl - mx, dy = qy + ny * rl - my, dz = qz + nz * rl - mz;
      bx[oi] += dx; bx[oi + 1] += dy; bx[oi + 2] += dz; bx[oj] += dx; bx[oj + 1] += dy; bx[oj + 2] += dz;
      }
    }
  }
  function chainDistances(rev) {
    for (let n = 0; n < N; n++) {
      const i = rev ? N - 1 - n : n, j = i === N - 1 ? 0 : i + 1;
      const oi = i * 3, oj = j * 3;
      const dx = bx[oj] - bx[oi], dy = bx[oj + 1] - bx[oi + 1], dz = bx[oj + 2] - bx[oi + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const L = segL[i];
      let C;
      if (d > L) C = d - L; else if (d < minLink) C = d - minLink; else continue;
      const wi = bim[i], wj = bim[j];
      if (wi + wj <= 0) continue;
      const s = C / ((wi + wj) * Math.max(d, 1e-9));
      bx[oi] += dx * s * wi; bx[oi + 1] += dy * s * wi; bx[oi + 2] += dz * s * wi;
      bx[oj] -= dx * s * wj; bx[oj + 1] -= dy * s * wj; bx[oj + 2] -= dz * s * wj;
    }
  }
  function chainBending() {
    for (let i = 0; i < N; i++) {
      const a = i === 0 ? N - 1 : i - 1, b = i === N - 1 ? 0 : i + 1;
      const oa = a * 3, ob = b * 3;
      const dx = bx[ob] - bx[oa], dy = bx[ob + 1] - bx[oa + 1], dz = bx[ob + 2] - bx[oa + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz), m = bendMin[i];
      if (d >= m) continue;
      const wa = bim[a], wb = bim[b];
      if (wa + wb <= 0) continue;
      const s = (d - m) / ((wa + wb) * Math.max(d, 1e-9));
      bx[oa] += dx * s * wa; bx[oa + 1] += dy * s * wa; bx[oa + 2] += dz * s * wa;
      bx[ob] -= dx * s * wb; bx[ob + 1] -= dy * s * wb; bx[ob + 2] -= dz * s * wb;
    }
  }
  // Opposite sides of the closed loop must not collapse into the same strand.
  // Adjacent beads are already separated by the link-length constraint.
  function separateBeads() {
    if (!opts.exhibition) return;
    const separation = 2 * rb + .0001;
    for (let i = 0; i < N; i++) for (let j = i + 2; j < N; j++) {
      if (i === 0 && j === N - 1) continue;
      const a = i * 3, b = j * 3;
      let x = bx[b] - bx[a], y = bx[b + 1] - bx[a + 1], z = bx[b + 2] - bx[a + 2];
      let d = Math.hypot(x, y, z);
      if (d >= separation || bim[i] + bim[j] === 0) continue;
      if (d < 1e-9) { x = 1e-9; y = z = 0; d = 1e-9; }
      const scale = (separation - d) / (d * (bim[i] + bim[j]));
      const wi = scale * bim[i], wj = scale * bim[j];
      bx[a] -= x * wi; bx[a + 1] -= y * wi; bx[a + 2] -= z * wi;
      bx[b] += x * wj; bx[b + 1] += y * wj; bx[b + 2] += z * wj;
    }
  }
  // plush cord loop / tag hole <-> nearest point on the chain (two-way, slides freely)
  function attachBody(body, lx, ly, lz, tr, slack) {
    const R = body.R;
    const rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz;
    const ax = body.x + rx, ay = body.y + ry, az = body.z + rz;
    track(ax, ay, az, tr);
    const j = tr.seg, k = (j + 1) % N, t = tr.t, oj = j * 3, ok = k * 3;
    const qx = bx[oj] + (bx[ok] - bx[oj]) * t, qy = bx[oj + 1] + (bx[ok + 1] - bx[oj + 1]) * t, qz = bx[oj + 2] + (bx[ok + 2] - bx[oj + 2]) * t;
    let dx = ax - qx, dy = ay - qy, dz = az - qz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d <= slack) return;
    dx /= d; dy /= d; dz /= d;
    const C = d - slack;
    const wb = body.w(rx, ry, rz, dx, dy, dz);
    // mass scaling: the chain point acts at most ~8x lighter than the body, so a heavy body moves itself
    // instead of stretching the light chain (the loss of momentum exactness is invisible here)
    const ms = P.attachMassScale, wc0 = (1 - t) * (1 - t) * bim[j] + t * t * bim[k], sc = ms > 0 && wc0 > ms * wb ? ms * wb / wc0 : 1;
    const wj = (1 - t) * (1 - t) * bim[j] * sc, wk = t * t * bim[k] * sc;
    const lam = C / (wb + wj + wk);
    body.applyP(-dx * lam, -dy * lam, -dz * lam, rx, ry, rz);
    const sj = (1 - t) * bim[j] * sc * lam, sk = t * bim[k] * sc * lam;
    bx[oj] += dx * sj; bx[oj + 1] += dy * sj; bx[oj + 2] += dz * sj;
    bx[ok] += dx * sk; bx[ok + 1] += dy * sk; bx[ok + 2] += dz * sk;
  }
  function separateTagPlush() {
    const R = core.R, T = tag.R;
    const rx = R[0] * attachB[0] + R[1] * attachB[1] + R[2] * attachB[2], ry = R[3] * attachB[0] + R[4] * attachB[1] + R[5] * attachB[2], rz = R[6] * attachB[0] + R[7] * attachB[1] + R[8] * attachB[2];
    const sx = T[0] * holeL[0] + T[1] * holeL[1], sy = T[3] * holeL[0] + T[4] * holeL[1], sz = T[6] * holeL[0] + T[7] * holeL[1];
    let dx = (tag.x + sx) - (core.x + rx), dy = (tag.y + sy) - (core.y + ry), dz = (tag.z + sz) - (core.z + rz);
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz), m = 0.0026;
    if (d >= m || d < 1e-9) return;
    dx /= d; dy /= d; dz /= d;
    const lam = (m - d) / (core.w(rx, ry, rz, dx, dy, dz) + tag.w(sx, sy, sz, dx, dy, dz));
    tag.applyP(dx * lam, dy * lam, dz * lam, sx, sy, sz);
    core.applyP(-dx * lam, -dy * lam, -dz * lam, rx, ry, rz);
  }
  function beadsVsPlush() {
    const ex2 = 0.011 * 0.011, bR = (plushBoundR + rb) * (plushBoundR + rb);
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      const rx = bx[o] - core.x, ry = bx[o + 1] - core.y, rz = bx[o + 2] - core.z;
      if (rx * rx + ry * ry + rz * rz > bR) continue;
      toRest(bx[o], bx[o + 1], bx[o + 2], tmp3);
      const X = tmp3[0], Y = tmp3[1], Z = tmp3[2];
      const ax = X - attachRest.x, ay = Y - attachRest.y, az = Z - attachRest.z;
      if (ax * ax + ay * ay + az * az < ex2) continue;   // beads threading the cord loop
      const phi = sdfSample(X, Y, Z, true);
      if (phi >= rb) continue;
      const R = core.R, gx = sdfGrad[0], gy = sdfGrad[1], gz = sdfGrad[2];
      const nx = R[0] * gx + R[1] * gy + R[2] * gz, ny = R[3] * gx + R[4] * gy + R[5] * gz, nz = R[6] * gx + R[7] * gy + R[8] * gz;
      const C = Math.min(rb - phi, 0.004);
      const wb = bim[i], wp = core.w(rx, ry, rz, nx, ny, nz);
      const lam = C / (wb + wp);
      bx[o] += nx * lam * wb; bx[o + 1] += ny * lam * wb; bx[o + 2] += nz * lam * wb;
      core.applyP(-nx * lam, -ny * lam, -nz * lam, rx, ry, rz);
    }
  }
  function tagVsPlush() {
    const dcx = tag.x - core.x, dcy = tag.y - core.y, dcz = tag.z - core.z, rr = plushBoundR + tagBoundR;
    if (dcx * dcx + dcy * dcy + dcz * dcz > rr * rr) return;
    const margin = 0.0005;
    for (let i = 0; i < nTS; i++) {
      const T = tag.R, lx = TS[i * 3], ly = TS[i * 3 + 1];
      const sx = T[0] * lx + T[1] * ly, sy = T[3] * lx + T[4] * ly, sz = T[6] * lx + T[7] * ly;
      const wx = tag.x + sx, wy = tag.y + sy, wz = tag.z + sz;
      toRest(wx, wy, wz, tmp3);
      const phi = sdfSample(tmp3[0], tmp3[1], tmp3[2], true);
      if (phi >= margin) continue;
      const R = core.R, gx = sdfGrad[0], gy = sdfGrad[1], gz = sdfGrad[2];
      const nx = R[0] * gx + R[1] * gy + R[2] * gz, ny = R[3] * gx + R[4] * gy + R[5] * gz, nz = R[6] * gx + R[7] * gy + R[8] * gz;
      const C = Math.min(margin - phi, 0.004);
      const rx = wx - core.x, ry = wy - core.y, rz = wz - core.z;
      const lam = C / (tag.w(sx, sy, sz, nx, ny, nz) + core.w(rx, ry, rz, nx, ny, nz));
      tag.applyP(nx * lam, ny * lam, nz * lam, sx, sy, sz);
      core.applyP(-nx * lam, -ny * lam, -nz * lam, rx, ry, rz);
    }
  }
  // the chain passes through the hole: the card can't turn edge-on to the chain
  function tagAlign() {
    if (!(P.tagAlignDeg < 89.9) || !hooked || tagFloor) return;   // lying on the table the chain simply kinks at the hole
    const cosAlign = Math.cos(P.tagAlignDeg * Math.PI / 180);
    const j = trackT.seg, k = (j + 1) % N, oj = j * 3, ok = k * 3;
    let tx = bx[ok] - bx[oj], ty = bx[ok + 1] - bx[oj + 1], tz = bx[ok + 2] - bx[oj + 2];
    const tl = Math.hypot(tx, ty, tz); if (tl < 1e-9) return;
    tx /= tl; ty /= tl; tz /= tl;
    const T = tag.R, nx = T[2], ny = T[5], nz = T[8];
    let c = nx * tx + ny * ty + nz * tz;
    if (c < 0) { tx = -tx; ty = -ty; tz = -tz; c = -c; }
    if (c >= cosAlign) return;
    let ax = ny * tz - nz * ty, ay = nz * tx - nx * tz, az = nx * ty - ny * tx;
    const al = Math.hypot(ax, ay, az); if (al < 1e-9) return;
    const ang = (Math.acos(clamp(c, -1, 1)) - Math.acos(cosAlign)) * 0.2;
    ax *= ang / al; ay *= ang / al; az *= ang / al;
    // rotate about the hole point (as a velocity-consistent position change)
    const hx = T[0] * holeL[0] + T[1] * holeL[1], hy = T[3] * holeL[0] + T[4] * holeL[1], hz = T[6] * holeL[0] + T[7] * holeL[1];
    const ox = tag.x + hx, oy = tag.y + hy, oz = tag.z + hz;
    tag.rotate(ax, ay, az);
    const T2 = tag.R;
    tag.x = ox - (T2[0] * holeL[0] + T2[1] * holeL[1]); tag.y = oy - (T2[3] * holeL[0] + T2[4] * holeL[1]); tag.z = oz - (T2[6] * holeL[0] + T2[7] * holeL[1]);
  }
  // position correction + static friction of a body point against a static surface (normal n, depth pen)
  function bodyContact(body, lx, ly, lz, nx, ny, nz, pen) {
    const R = body.R;
    let rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz;
    const lam = pen / body.w(rx, ry, rz, nx, ny, nz);
    body.applyP(nx * lam, ny * lam, nz * lam, rx, ry, rz);
    const R2 = body.R, pR = body.pR;
    rx = R2[0] * lx + R2[1] * ly + R2[2] * lz; ry = R2[3] * lx + R2[4] * ly + R2[5] * lz; rz = R2[6] * lx + R2[7] * ly + R2[8] * lz;
    const ox = body.px + pR[0] * lx + pR[1] * ly + pR[2] * lz, oy = body.py + pR[3] * lx + pR[4] * ly + pR[5] * lz, oz = body.pz + pR[6] * lx + pR[7] * ly + pR[8] * lz;
    const dx = body.x + rx - ox, dy = body.y + ry - oy, dz = body.z + rz - oz;
    const dn = dx * nx + dy * ny + dz * nz;
    let tx = dx - dn * nx, ty = dy - dn * ny, tz = dz - dn * nz;
    const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (tl > 1e-10) {
      const lim = P.tableFriction * pen, f = tl <= lim ? 1 : lim / tl;
      tx /= tl; ty /= tl; tz /= tl;
      const l2 = (tl * f) / body.w(rx, ry, rz, tx, ty, tz);
      body.applyP(-tx * l2, -ty * l2, -tz * l2, rx, ry, rz);
    }
  }
  // plush surface samples vs table and stand base
  let floorContact = 0;   // 1 while the toy rests on the table / base: a soft plush doesn't roll
  let tagFloor = 0;
  function plushVsFloor() {
    floorContact = 0;
    if (opts.exhibition) return;
    if (nBox && sphereNearBoxes(core.x, core.y, core.z, plushBoundR)) {
      for (let i = 0; i < nPS; i++) {
        const lx = plushSamples[i * 3], ly = plushSamples[i * 3 + 1], lz = plushSamples[i * 3 + 2], R = core.R;
        const wx = core.x + R[0] * lx + R[1] * ly + R[2] * lz, wy = core.y + R[3] * lx + R[4] * ly + R[5] * lz, wz = core.z + R[6] * lx + R[7] * ly + R[8] * lz;
        if (pointVsBoxes(wx, wy, wz, 0.0004) > 0) { bodyContact(core, lx, ly, lz, boxOut[0], boxOut[1], boxOut[2], boxOut[3]); if (boxOut[1] > 0.7) floorContact = 1; }
      }
    }
    const low = Math.max(baseTop, tableY) + 0.003;
    if (core.y - plushBoundR > low) return;
    const nearBase = Math.hypot(core.x - baseC.x, core.z - baseC.z) < plushBoundR + P.baseRadius;
    for (let i = 0; i < nPS; i++) {
      const lx = plushSamples[i * 3], ly = plushSamples[i * 3 + 1], lz = plushSamples[i * 3 + 2], R = core.R;
      const wx = core.x + R[0] * lx + R[1] * ly + R[2] * lz, wy = core.y + R[3] * lx + R[4] * ly + R[5] * lz, wz = core.z + R[6] * lx + R[7] * ly + R[8] * lz;
      if (wy > low) continue;
      let nx = 0, ny = 0, nz = 0, pen = 0;
      if (wy < tableY) { ny = 1; pen = tableY - wy; }
      if (nearBase) {
        const ddx = wx - baseC.x, ddz = wz - baseC.z, hd = Math.hypot(ddx, ddz);
        if (hd < P.baseRadius && wy < baseTop && wy > tableY - 0.01) {
          const up = baseTop - wy, side = P.baseRadius - hd;
          if (up < side) { if (up > pen) { nx = 0; ny = 1; nz = 0; pen = up; } }
          else if (side > pen && hd > 1e-9) { nx = ddx / hd; ny = 0; nz = ddz / hd; pen = side; }
        }
      }
      if (pen > 0) { bodyContact(core, lx, ly, lz, nx, ny, nz, pen); floorContact = 1; }
    }
  }
  // tag samples vs table, base, eye, arm, post
  function tagVsStatic() {
    if (opts.exhibition) return;
    const nearFloor = !opts.exhibition && tag.y - tagBoundR < Math.max(baseTop, tableY) + 0.003;
    tagFloor = nearFloor ? 1 : 0;
    const nearEye = (tag.x - ringC.x) ** 2 + (tag.y - ringC.y) ** 2 + (tag.z - ringC.z) ** 2 < (tagBoundR + eyeReach + 0.002) ** 2;
    const nearArm = (tag.x - armBound.center.x) ** 2 + (tag.y - armBound.center.y) ** 2 + (tag.z - armBound.center.z) ** 2 < (tagBoundR + armBound.radius) ** 2;
    const nearPost = Math.hypot(tag.x - postXZ.x, tag.z - postXZ.z) < tagBoundR + P.postRadius + 0.002;
    if (nBox && sphereNearBoxes(tag.x, tag.y, tag.z, tagBoundR)) {
      for (let i = 0; i < nTS; i++) {
        const lx = TS[i * 3], ly = TS[i * 3 + 1], T = tag.R;
        const wx = tag.x + T[0] * lx + T[1] * ly, wy = tag.y + T[3] * lx + T[4] * ly, wz = tag.z + T[6] * lx + T[7] * ly;
        if (pointVsBoxes(wx, wy, wz, 0.0003) > 0) { bodyContact(tag, lx, ly, 0, boxOut[0], boxOut[1], boxOut[2], boxOut[3]); if (boxOut[1] > 0.7) tagFloor = 1; }
      }
    }
    if (!nearFloor && !nearEye && !nearArm && !nearPost) return;
    const rad = 0.0003;
    for (let i = 0; i < nTS; i++) {
      const lx = TS[i * 3], ly = TS[i * 3 + 1], T = tag.R;
      const wx = tag.x + T[0] * lx + T[1] * ly, wy = tag.y + T[3] * lx + T[4] * ly, wz = tag.z + T[6] * lx + T[7] * ly;
      let nx = 0, ny = 0, nz = 0, pen = 0;
      if (nearFloor) {
        if (wy < tableY + rad) { ny = 1; pen = tableY + rad - wy; }
        const ddx = wx - baseC.x, ddz = wz - baseC.z, hd = Math.hypot(ddx, ddz);
        if (hd < P.baseRadius + rad && wy < baseTop + rad && wy > tableY - 0.01) {
          const up = baseTop + rad - wy, side = P.baseRadius + rad - hd;
          if (up < side) { if (up > pen) { nx = 0; ny = 1; nz = 0; pen = up; } }
          else if (side > pen && hd > 1e-9) { nx = ddx / hd; ny = 0; nz = ddz / hd; pen = side; }
        }
      }
      if (nearEye) {
        const dx = wx - ringC.x, dy = wy - ringC.y, dz = wz - ringC.z;
        const a = dx * SIDE.x + dy * SIDE.y + dz * SIDE.z;
        let px = dx - a * SIDE.x, py = dy - a * SIDE.y, pz = dz - a * SIDE.z, pl = Math.sqrt(px * px + py * py + pz * pz);
        if (pl < 1e-9) { px = 0; py = -1; pz = 0; pl = 1; }
        const k = P.eyeRadius / pl, ex = dx - px * k, ey = dy - py * k, ez = dz - pz * k;
        const d = Math.sqrt(ex * ex + ey * ey + ez * ez), r = P.hookWire + rad;
        if (d < r && d > 1e-9 && r - d > pen) { nx = ex / d; ny = ey / d; nz = ez / d; pen = r - d; }
      }
      if (nearArm) {
        for (let c = 0; c < nArmCaps; c++) {
          const k = c * 8;
          let t = ((wx - CAP[k]) * CAP[k + 3] + (wy - CAP[k + 1]) * CAP[k + 4] + (wz - CAP[k + 2]) * CAP[k + 5]) * CAP[k + 6];
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const dx = wx - (CAP[k] + CAP[k + 3] * t), dy = wy - (CAP[k + 1] + CAP[k + 4] * t), dz = wz - (CAP[k + 2] + CAP[k + 5] * t);
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz), r = CAP[k + 7] + rad;
          if (d < r && d > 1e-9 && r - d > pen) { nx = dx / d; ny = dy / d; nz = dz / d; pen = r - d; }
        }
      }
      if (nearPost) {
        const ex = wx - postXZ.x, ez = wz - postXZ.z, d = Math.hypot(ex, ez), r = P.postRadius + rad;
        if (d < r && d > 1e-9 && wy > baseTop && wy < postTop && r - d > pen) { nx = ex / d; ny = 0; nz = ez / d; pen = r - d; }
      }
      if (pen > 0) bodyContact(tag, lx, ly, 0, nx, ny, nz, pen);
    }
  }
  // hook wire / post points pushing the plush (via its SDF)
  function probesVsPlush() {
    if (opts.exhibition) return;
    const bR = plushBoundR + 0.007;
    for (let i = 0; i < nProbes; i++) {
      const k = i * 4, px = PROBE[k], py = PROBE[k + 1], pz = PROBE[k + 2], pr = PROBE[k + 3];
      const dx = px - core.x, dy = py - core.y, dz = pz - core.z;
      if (dx * dx + dy * dy + dz * dz > bR * bR) continue;
      toRest(px, py, pz, tmp3);
      const ax = tmp3[0] - attachRest.x, ay = tmp3[1] - attachRest.y, az = tmp3[2] - attachRest.z;
      if (ax * ax + ay * ay + az * az < 0.006 * 0.006) continue;
      const phi = sdfSample(tmp3[0], tmp3[1], tmp3[2], true);
      if (phi >= pr) continue;
      const R = core.R, gx = sdfGrad[0], gy = sdfGrad[1], gz = sdfGrad[2];
      const nx = R[0] * gx + R[1] * gy + R[2] * gz, ny = R[3] * gx + R[4] * gy + R[5] * gz, nz = R[6] * gx + R[7] * gy + R[8] * gz;
      const C = Math.min(pr - phi, 0.004);
      const lam = C / core.w(dx, dy, dz, nx, ny, nz);
      core.applyP(-nx * lam, -ny * lam, -nz * lam, dx, dy, dz);
    }
  }
  // Long-range tethers: nothing hanging from the chain may be farther from a supporting bead than the chain allows.
  // The cord loop / tag hole slide freely, so their farthest reach is half the loop (the apex of the V); using the
  // tracked position instead would feed back (the projection slides them up the strand, shortening the limit...).
  const anchors = new Float64Array((N + 1) * 4); let nAnch = 0;
  function gatherAnchors() {
    nAnch = 0;
    for (let i = 0; i < N; i++) if (bcontact[i] === 1) {
      const o = i * 3, k = nAnch * 4; anchors[k] = bx[o]; anchors[k + 1] = bx[o + 1]; anchors[k + 2] = bx[o + 2]; anchors[k + 3] = cum[i]; nAnch++;
    }
    if (grabBead) { const o = grabBead.i * 3, k = nAnch * 4; anchors[k] = bx[o]; anchors[k + 1] = bx[o + 1]; anchors[k + 2] = bx[o + 2]; anchors[k + 3] = cum[grabBead.i]; nAnch++; }
  }
  function tetherBody(body, lx, ly, lz, slack) {
    const L = chainTotal * 0.5 + slack;
    for (let a = 0; a < nAnch; a++) {
      const k = a * 4, R = body.R;
      const rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz;
      let dx = body.x + rx - anchors[k], dy = body.y + ry - anchors[k + 1], dz = body.z + rz - anchors[k + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= L) continue;
      dx /= d; dy /= d; dz /= d;
      const lam = (d - L) / body.w(rx, ry, rz, dx, dy, dz);
      body.applyP(-dx * lam, -dy * lam, -dz * lam, rx, ry, rz);
    }
  }
  function tethers() {
    gatherAnchors();
    if (!nAnch) return;
    tetherBody(core, attachB[0], attachB[1], attachB[2], P.cordSlack + 0.0003);
    if (!grabTag) tetherBody(tag, holeL[0], holeL[1], 0, P.tagHoleSlack + 0.0003);
    if (grabBead) {   // the grabbed bead itself stays within reach of the hook contacts (beads don't slide)
      const o = grabBead.i * 3;
      for (let a = 0; a < nAnch; a++) {
        const k = a * 4; if (anchors[k + 3] === cum[grabBead.i]) continue;
        const dx = bx[o] - anchors[k], dy = bx[o + 1] - anchors[k + 1], dz = bx[o + 2] - anchors[k + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz), L = arcDist(cum[grabBead.i], anchors[k + 3]) + 0.0003;
        if (d > L) { const s = (d - L) / d; bx[o] -= dx * s; bx[o + 1] -= dy * s; bx[o + 2] -= dz * s; }
      }
    }
  }
  function grabConstraints(h) {
    if (grabBead) {
      // the grabbed bead is kinematic: it sits on the (speed-limited) target, clamped to what the chain can
      // reach from the beads resting on the hook - so the light chain in between never has to stretch
      const g = grabBead, o = g.i * 3;
      let tx = g.sx, ty = g.sy, tz = g.sz;
      for (let i = 0; i < N; i++) {
        if (bcontact[i] !== 1 || i === g.i) continue;
        const a = i * 3, dx = tx - bx[a], dy = ty - bx[a + 1], dz = tz - bx[a + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const L = arcDist(cum[g.i], cum[i]) * 0.97;
        if (d > L) { const s = L / d; tx = bx[a] + dx * s; ty = bx[a + 1] + dy * s; tz = bx[a + 2] + dz * s; }
      }
      // never move more than ~1 m/s worth per substep (no whip-through), and don't let the target run away
      let mx = tx - bp[o], my = ty - bp[o + 1], mz = tz - bp[o + 2]; const ml = Math.hypot(mx, my, mz), lim = 1.0 * h;
      if (ml > lim) { mx *= lim / ml; my *= lim / ml; mz *= lim / ml; }
      bx[o] = bp[o] + mx; bx[o + 1] = bp[o + 1] + my; bx[o + 2] = bp[o + 2] + mz;
      const bk = Math.hypot(g.sx - bx[o], g.sy - bx[o + 1], g.sz - bx[o + 2]);
      if (bk > 0.004) { const s = 0.004 / bk; g.sx = bx[o] + (g.sx - bx[o]) * s; g.sy = bx[o + 1] + (g.sy - bx[o + 1]) * s; g.sz = bx[o + 2] + (g.sz - bx[o + 2]) * s; }
    }
    if (grabTag) {
      const g = grabTag, T = tag.R;
      const sx = T[0] * g.l[0] + T[1] * g.l[1] + T[2] * g.l[2], sy = T[3] * g.l[0] + T[4] * g.l[1] + T[5] * g.l[2], sz = T[6] * g.l[0] + T[7] * g.l[1] + T[8] * g.l[2];
      let dx = tag.x + sx - g.sx, dy = tag.y + sy - g.sy, dz = tag.z + sz - g.sz; const C = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (C > 1e-9) {
        dx /= C; dy /= C; dz /= C;
        const at = 1 / (P.tagGrabStiffness * g.ramp + 1e-9) / (h * h), w = tag.w(sx, sy, sz, dx, dy, dz);
        let dl = (-C - at * g.lambda) / (w + at);
        const lmax = P.tagGrabMaxForce * h * h;
        if (Math.abs(g.lambda + dl) > lmax) dl = Math.sign(g.lambda + dl) * lmax - g.lambda;
        g.lambda += dl;
        tag.applyP(dx * dl, dy * dl, dz * dl, sx, sy, sz);
      }
    }
  }
  function mechStep(h) {
    integrateBeads(h);
    integratePlush(h);
    stepTagTurn(h);
    tag.integrate(h, P.tagLinDamp, P.tagAngDamp);
    if (grabBead) grabBead.lambda = 0;
    if (grabTag) grabTag.lambda = 0;
    for (let i = 0; i < N; i++) beadCollideStatic(i, false, true);
    for (let it = 0; it < P.mechIters; it++) {
      chainDistances(0); chainDistances(1); chainDistances(0);
      chainBending();
      separateBeads();
      grabConstraints(h);
      attachBody(core, attachB[0], attachB[1], attachB[2], trackP, P.cordSlack);
      attachBody(tag, holeL[0], holeL[1], 0, trackT, P.tagHoleSlack);
      separateTagPlush();
      beadsVsPlush();
      tagVsPlush();
      if (it === 0 && !tagTurn && !grabTag) tagAlign();
      for (let i = 0; i < N; i++) if (bnear[i]) beadCollideStatic(i, false, false);
      linksVsEye();
    }
    probesVsPlush();
    plushVsFloor();
    tagVsStatic();
    tethers();
    chainDistances(1); chainDistances(0);
    for (let i = 0; i < N; i++) if (bnear[i]) beadCollideStatic(i, true, false);
    linksVsEye();
    for (let i = 0; i < N; i++) if (bnear[i]) beadCollideStatic(i, false, false);
    // velocities
    const ih = 1 / h, vmax = 4, vEye = 0.8 * (P.hookWire + rb) / h;   // a bead touching the eye can't cross the wire in one substep
    for (let i = 0; i < N; i++) {
      const o = i * 3;
      let vx = (bx[o] - bp[o]) * ih, vy = (bx[o + 1] - bp[o + 1]) * ih, vz = (bx[o + 2] - bp[o + 2]) * ih;
      const v = Math.sqrt(vx * vx + vy * vy + vz * vz), vm = bcontact[i] === 1 ? vEye : vmax;
      if (v > vm) { const s = vm / v; vx *= s; vy *= s; vz *= s; }
      bv[o] = vx; bv[o + 1] = vy; bv[o + 2] = vz;
    }
    core.finish(h, 3, 40);
    if (floorContact && !plushGrabs.length && Math.hypot(core.vx, core.vy, core.vz) < 0.004 && Math.hypot(core.wx, core.wy, core.wz) < 0.25) {
      // stiction: a soft toy resting on the table stays put instead of creeping
      core.x = core.px; core.y = core.py; core.z = core.pz; core.qx = core.pqx; core.qy = core.pqy; core.qz = core.pqz; core.qw = core.pqw; core.updateR();
      core.vx = core.vy = core.vz = core.wx = core.wy = core.wz = 0;
    }
    tag.finish(h, 4, 120);
    if (grabTag) {   // damp the dragged card toward the pointer's motion
      const k = 1 - Math.exp(-8 * h);
      tag.vx += (grabTag.svx - tag.vx) * k; tag.vy += (grabTag.svy - tag.vy) * k; tag.vz += (grabTag.svz - tag.vz) * k;
      tag.wx *= 1 - k; tag.wy *= 1 - k; tag.wz *= 1 - k;
    }
  }

  /* ---------------------------------------------- flesh (lattice shape matching, local frame) ---------------------------------------------- */
  const Apq = new Float64Array(9), Rr = new Float64Array(9), Tm = new Float64Array(9);
  function fleshStep(h) {
    const R = core.R, cx0 = com0.x, cy0 = com0.y, cz0 = com0.z;
    // a fraction of the core's acceleration is felt by the flesh (low-passed, rotated into the local frame)
    const ih = 1 / h;
    const ax = (core.vx - lastCoreV[0]) * ih, ay = (core.vy - lastCoreV[1]) * ih, az = (core.vz - lastCoreV[2]) * ih;
    lastCoreV[0] = core.vx; lastCoreV[1] = core.vy; lastCoreV[2] = core.vz;
    const lp = 1 - Math.exp(-h / 0.02);
    accLP[0] += (ax - accLP[0]) * lp; accLP[1] += (ay - accLP[1]) * lp; accLP[2] += (az - accLP[2]) * lp;
    const kI = P.fleshInertia * h;
    const dvx = -(R[0] * accLP[0] + R[3] * accLP[1] + R[6] * accLP[2]) * kI;
    const dvy = -(R[1] * accLP[0] + R[4] * accLP[1] + R[7] * accLP[2]) * kI;
    const dvz = -(R[2] * accLP[0] + R[5] * accLP[1] + R[8] * accLP[2]) * kI;
    const relD = Math.exp(-P.jiggleDamping * h);
    // 1. predict
    for (let o = 0; o < nP * 3; o += 3) {
      const vx = fw[o] * relD + dvx, vy = fw[o + 1] * relD + dvy, vz = fw[o + 2] * relD + dvz;
      fold[o] = fu[o]; fold[o + 1] = fu[o + 1]; fold[o + 2] = fu[o + 2];
      fu[o] += vx * h; fu[o + 1] += vy * h; fu[o + 2] += vz * h;
    }
    // 2. region sums  S1 = sum m p~ , S2 = sum m p~ X0~^T   (p~ relative to com0)
    bufA.fill(0);
    for (let p = 0, o = 0; p < nP; p++, o += 3) {
      const s = slotOf[p] * 12, m = mass[p];
      const px = (fu[o] - cx0) * m, py = (fu[o + 1] - cy0) * m, pz = (fu[o + 2] - cz0) * m;
      const X = X0[o], Y = X0[o + 1], Z = X0[o + 2];
      bufA[s] = px; bufA[s + 1] = py; bufA[s + 2] = pz;
      bufA[s + 3] = px * X; bufA[s + 4] = px * Y; bufA[s + 5] = px * Z;
      bufA[s + 6] = py * X; bufA[s + 7] = py * Y; bufA[s + 8] = py * Z;
      bufA[s + 9] = pz * X; bufA[s + 10] = pz * Y; bufA[s + 11] = pz * Z;
    }
    boxSum(bufA, bufB, 12);
    // 3. per-region optimal transform
    bufA.fill(0);
    const beta = P.volumeBeta, iters = P.polarIters;
    for (let p = 0; p < nP; p++) {
      const s = slotOf[p] * 12, M = regM[p], iM = 1 / M;
      const c0x = regC0[p * 3], c0y = regC0[p * 3 + 1], c0z = regC0[p * 3 + 2];
      const ccx = bufB[s] * iM, ccy = bufB[s + 1] * iM, ccz = bufB[s + 2] * iM;
      Apq[0] = bufB[s + 3] - M * ccx * c0x; Apq[1] = bufB[s + 4] - M * ccx * c0y; Apq[2] = bufB[s + 5] - M * ccx * c0z;
      Apq[3] = bufB[s + 6] - M * ccy * c0x; Apq[4] = bufB[s + 7] - M * ccy * c0y; Apq[5] = bufB[s + 8] - M * ccy * c0z;
      Apq[6] = bufB[s + 9] - M * ccz * c0x; Apq[7] = bufB[s + 10] - M * ccz * c0y; Apq[8] = bufB[s + 11] - M * ccz * c0z;
      extractRotation(Apq, regQ, p * 4, iters, Rr);
      let T = Rr;
      if (beta > 0 && regLinOK[p]) {
        const Ai = regAqqInv, q = p * 9;
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) Tm[r * 3 + c] = Apq[r * 3] * Ai[q + c] + Apq[r * 3 + 1] * Ai[q + 3 + c] + Apq[r * 3 + 2] * Ai[q + 6 + c];
        const det = Tm[0] * (Tm[4] * Tm[8] - Tm[5] * Tm[7]) - Tm[1] * (Tm[3] * Tm[8] - Tm[5] * Tm[6]) + Tm[2] * (Tm[3] * Tm[7] - Tm[4] * Tm[6]);
        if (det > 0.05 && det < 20) {
          const sc = 1 / Math.cbrt(det);
          for (let i = 0; i < 9; i++) Tm[i] = beta * Tm[i] * sc + (1 - beta) * Rr[i];
          T = Tm;
        }
      }
      bufA[s] = T[0]; bufA[s + 1] = T[1]; bufA[s + 2] = T[2]; bufA[s + 3] = T[3]; bufA[s + 4] = T[4]; bufA[s + 5] = T[5];
      bufA[s + 6] = T[6]; bufA[s + 7] = T[7]; bufA[s + 8] = T[8];
      bufA[s + 9] = ccx - (T[0] * c0x + T[1] * c0y + T[2] * c0z);
      bufA[s + 10] = ccy - (T[3] * c0x + T[4] * c0y + T[5] * c0z);
      bufA[s + 11] = ccz - (T[6] * c0x + T[7] * c0y + T[8] * c0z);
    }
    boxSum(bufA, bufB, 12);
    // 4. goals: average of the overlapping regions, blended with the rest shape
    const w = TAU * P.smFreq * h, alpha = Math.min(1, w * w);
    const wa = TAU * P.anchorFreq * h, kBase = Math.min(1, wa * wa / alpha), pin = P.attachPin;
    for (let p = 0, o = 0; p < nP; p++, o += 3) {
      const s = slotOf[p] * 12, inv = 1 / nReg[p];
      const X = X0[o], Y = X0[o + 1], Z = X0[o + 2];
      const gx = (bufB[s] * X + bufB[s + 1] * Y + bufB[s + 2] * Z + bufB[s + 9]) * inv;
      const gy = (bufB[s + 3] * X + bufB[s + 4] * Y + bufB[s + 5] * Z + bufB[s + 10]) * inv;
      const gz = (bufB[s + 6] * X + bufB[s + 7] * Y + bufB[s + 8] * Z + bufB[s + 11]) * inv;
      const k = kBase + (1 - kBase) * pin * kappaW[p];
      const tx = cx0 + gx + (X - gx) * k, ty = cy0 + gy + (Y - gy) * k, tz = cz0 + gz + (Z - gz) * k;
      fu[o] += (tx - fu[o]) * alpha; fu[o + 1] += (ty - fu[o + 1]) * alpha; fu[o + 2] += (tz - fu[o + 2]) * alpha;
    }
    // 5. interaction constraints (local frame)
    for (const g of plushGrabs) {
      if (!g.weights) continue;
      const b = g.b;
      const prx = core.x + R[0] * b[0] + R[1] * b[1] + R[2] * b[2], pry = core.y + R[3] * b[0] + R[4] * b[1] + R[5] * b[2], prz = core.z + R[6] * b[0] + R[7] * b[1] + R[8] * b[2];
      const wx = g.sx - prx, wy = g.sy - pry, wz = g.sz - prz;
      let sx = R[0] * wx + R[3] * wy + R[6] * wz, sy = R[1] * wx + R[4] * wy + R[7] * wz, sz = R[2] * wx + R[5] * wy + R[8] * wz;
      const sl = Math.hypot(sx, sy, sz), ms = P.maxStretch * g.ramp;
      if (sl > ms) { const f = ms / sl; sx *= f; sy *= f; sz *= f; }
      const gain = P.stretchGain, W = g.weights;
      for (let i = 0; i < W.length; i += 2) {
        const o = W[i] * 3, wgt = W[i + 1] * gain;
        fu[o] += (XA[o] + sx - fu[o]) * wgt; fu[o + 1] += (XA[o + 1] + sy - fu[o + 1]) * wgt; fu[o + 2] += (XA[o + 2] + sz - fu[o + 2]) * wgt;
      }
    }
    if (squeeze && squeeze.depth > 1e-5) {
      const sq = squeeze, r = sq.rF, r2 = r * r, C = sq.cand;
      for (let f = 0; f < 2; f++) {
        const F = f === 0 ? sq.f1 : sq.f2;
        for (let i = 0; i < C.length; i++) {
          const o = C[i] * 3;
          const dx = fu[o] - F[0], dy = fu[o + 1] - F[1], dz = fu[o + 2] - F[2], d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= r2 || d2 < 1e-18) continue;
          const k = r / Math.sqrt(d2);
          fu[o] = F[0] + dx * k; fu[o + 1] = F[1] + dy * k; fu[o + 2] = F[2] + dz * k;
        }
      }
    }
    const floorY = floorUnder(core.x, core.z, core.y);
    if (core.y - plushBoundR < floorY + 0.01) {   // the resting surface under the toy, in the local frame
      const nx = R[3], ny = R[4], nz = R[5];        // R^T * (0,1,0)
      // local point u is above the table iff  n . (u - com0) >= tableY - core.y   (n = R^T up); each lattice particle
      // keeps its rest distance to the (fur) surface, so it is the visible surface that rests on the table
      const lim = (floorY - core.y) + (nx * cx0 + ny * cy0 + nz * cz0);
      for (let p = 0, o = 0; p < nP; p++, o += 3) {
        const d = nx * fu[o] + ny * fu[o + 1] + nz * fu[o + 2] - (lim - phiRest[p]);
        if (d < 0) { fu[o] -= nx * d; fu[o + 1] -= ny * d; fu[o + 2] -= nz * d; }
      }
    }
    // 6. The fabric envelope limits every interaction, including collisions and
    // two simultaneous grabs. This also prevents a sewn label drifting away
    // when the pointer is pulled a long way beyond the toy.
    let maxDev = 0, maxRelV = 0, sum = 0;
    for (let o = 0; o < nP * 3; o += 3) {
      const ex = fu[o] - XA[o], ey = fu[o + 1] - XA[o + 1], ez = fu[o + 2] - XA[o + 2];
      const extension = Math.hypot(ex, ey, ez);
      if (extension > P.maxLocalDeviation) {
        const limit = P.maxLocalDeviation / extension;
        fu[o] = XA[o] + ex * limit;
        fu[o + 1] = XA[o + 1] + ey * limit;
        fu[o + 2] = XA[o + 2] + ez * limit;
      }
      const vx = (fu[o] - fold[o]) * ih, vy = (fu[o + 1] - fold[o + 1]) * ih, vz = (fu[o + 2] - fold[o + 2]) * ih;
      fw[o] = vx; fw[o + 1] = vy; fw[o + 2] = vz;
      const dx = fu[o] - XA[o], dy = fu[o + 1] - XA[o + 1], dz = fu[o + 2] - XA[o + 2];
      const dev = dx * dx + dy * dy + dz * dz; if (dev > maxDev) maxDev = dev;
      const rv = vx * vx + vy * vy + vz * vz; if (rv > maxRelV) maxRelV = rv;
      sum += fu[o] + fu[o + 1] + fu[o + 2] + vx;
    }
    stats.fleshDev = Math.sqrt(maxDev); stats.fleshRelV = Math.sqrt(maxRelV);
    if (!Number.isFinite(sum) || stats.fleshDev > 0.05) { fleshToRest(); stats.fleshResets++; }
  }
  // Mueller et al. 2016, "A robust method to extract the rotational part of deformations" (warm started)
  function extractRotation(A, Q, o, iters, Rout) {
    let qx = Q[o], qy = Q[o + 1], qz = Q[o + 2], qw = Q[o + 3];
    for (let it = 0; it < iters; it++) {
      quatToMat(qx, qy, qz, qw, Rout);
      const r = Rout;
      let wx = (r[3] * A[6] - r[6] * A[3]) + (r[4] * A[7] - r[7] * A[4]) + (r[5] * A[8] - r[8] * A[5]);
      let wy = (r[6] * A[0] - r[0] * A[6]) + (r[7] * A[1] - r[1] * A[7]) + (r[8] * A[2] - r[2] * A[8]);
      let wz = (r[0] * A[3] - r[3] * A[0]) + (r[1] * A[4] - r[4] * A[1]) + (r[2] * A[5] - r[5] * A[2]);
      const den = Math.abs(r[0] * A[0] + r[3] * A[3] + r[6] * A[6] + r[1] * A[1] + r[4] * A[4] + r[7] * A[7] + r[2] * A[2] + r[5] * A[5] + r[8] * A[8]) + 1e-20;
      wx /= den; wy /= den; wz /= den;
      const w = Math.sqrt(wx * wx + wy * wy + wz * wz);
      if (!(w > 1e-9)) break;
      const ha = 0.5 * Math.min(w, 2.5), sn = Math.sin(ha) / w;
      const ax = wx * sn, ay = wy * sn, az = wz * sn, aw = Math.cos(ha);
      const nx = aw * qx + ax * qw + ay * qz - az * qy, ny = aw * qy - ax * qz + ay * qw + az * qx;
      const nz = aw * qz + ax * qy - ay * qx + az * qw, nw = aw * qw - ax * qx - ay * qy - az * qz;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz + nw * nw);
      qx = nx * l; qy = ny * l; qz = nz * l; qw = nw * l;
    }
    if (!Number.isFinite(qx + qy + qz + qw)) { qx = 0; qy = 0; qz = 0; qw = 1; }
    Q[o] = qx; Q[o + 1] = qy; Q[o + 2] = qz; Q[o + 3] = qw;
    quatToMat(qx, qy, qz, qw, Rout);
  }

  /* ---------------------------------------------- stepping ---------------------------------------------- */
  function simOk() {
    if (!core.ok() || !tag.ok()) return false;
    if (Math.abs(core.x - H.x) > 1 || Math.abs(core.y - H.y) > 1 || Math.abs(core.z - H.z) > 1) return false;
    for (let i = 0; i < N * 3; i++) if (!Number.isFinite(bx[i])) return false;
    return Math.abs(tag.x - H.x) < 1 && Math.abs(tag.y - H.y) < 1 && Math.abs(tag.z - H.z) < 1;
  }
  function stepOnce() {
    const hF = 1 / P.fleshHz, nSub = Math.max(1, P.mechSubsteps | 0), hM = hF / nSub;
    snapshotPrev();
    const v0x = core.vx, v0y = core.vy, v0z = core.vz;
    const t0 = performance.now();
    for (let i = 0; i < nSub; i++) { advanceTargets(hM); mechStep(hM); if (P._probe) P._probe(i); }
    if (!simOk()) { stats.mechResets++; initState(); preroll(0.8); return; }
    const t1 = performance.now();
    stats.mechMs += t1 - t0;
    simTime += hF;
    if (squeeze) updateSqueezeDepth(hF);
    // a sharp jolt of the core (yank, collision, flick) wakes the flesh
    const jolt = Math.hypot(core.vx - v0x, core.vy - v0y, core.vz - v0z) / hF;
    if (jolt > 6) lastExcite = simTime;
    const wantFlesh = !opts.exhibition && (simTime - lastExcite < 1.0 || stats.fleshDev > 2e-5 || stats.fleshRelV > 4e-4);
    if (wantFlesh && !fleshActive) { fleshToRest(); fleshActive = true; }
    if (fleshActive) {
      fleshStep(hF);
      if (!wantFlesh) fleshActive = false;
    }
    stats.fleshMs += performance.now() - t1;
  }
  function preroll(seconds) {
    const keep = { plushLinDamp: P.plushLinDamp, plushAngDamp: P.plushAngDamp, tagLinDamp: P.tagLinDamp, tagAngDamp: P.tagAngDamp, chainDamp: P.chainDamp };
    Object.assign(P, { plushLinDamp: 6, plushAngDamp: 8, tagLinDamp: 8, tagAngDamp: 10, chainDamp: 12 });
    const hF = 1 / P.fleshHz, steps = Math.ceil(seconds / hF);
    for (let s = 0; s < steps; s++) {
      if (s === Math.floor(steps * 0.7)) Object.assign(P, keep);
      for (let i = 0; i < P.mechSubsteps; i++) mechStep(hF / P.mechSubsteps);
    }
    Object.assign(P, keep);
    core.vx = core.vy = core.vz = core.wx = core.wy = core.wz = 0; tag.vx = tag.vy = tag.vz = tag.wx = tag.wy = tag.wz = 0; bv.fill(0);
    fleshToRest(); fleshActive = false;
    snapshotPrev();
  }

  /* ---------------------------------------------- render sync ---------------------------------------------- */
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  const rCore = { x: 0, y: 0, z: 0, q: new THREE.Quaternion(), R: new Float64Array(9) };
  const bxR = new Float64Array(N * 3);
  function lerpPose(a, b, t, outPos, outQ) {
    outPos.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    let bxq = b.qx, byq = b.qy, bzq = b.qz, bwq = b.qw;
    if (a.qx * bxq + a.qy * byq + a.qz * bzq + a.qw * bwq < 0) { bxq = -bxq; byq = -byq; bzq = -bzq; bwq = -bwq; }
    outQ.set(a.qx + (bxq - a.qx) * t, a.qy + (byq - a.qy) * t, a.qz + (bzq - a.qz) * t, a.qw + (bwq - a.qw) * t).normalize();
  }
  function syncVisuals(alpha) {
    const t0 = performance.now();
    // core pose -> softRoot (the soft meshes carry only the local deformation)
    lerpPose(corePrev, core, alpha, _v, rCore.q);
    rCore.x = _v.x; rCore.y = _v.y; rCore.z = _v.z;
    quatToMat(rCore.q.x, rCore.q.y, rCore.q.z, rCore.q.w, rCore.R);
    const R = rCore.R;
    _v2.set(R[0] * com0.x + R[1] * com0.y + R[2] * com0.z, R[3] * com0.x + R[4] * com0.y + R[5] * com0.z, R[6] * com0.x + R[7] * com0.y + R[8] * com0.z);
    softRoot.matrix.compose(_v.sub(_v2), rCore.q, _s);
    softRoot.matrixWorldNeedsUpdate = true;
    if (fleshActive) {
      let maxL = 0;
      for (let o = 0; o < nP * 3; o += 3) {
        const x = fprev[o] + (fu[o] - fprev[o]) * alpha, y = fprev[o + 1] + (fu[o + 1] - fprev[o + 1]) * alpha, z = fprev[o + 2] + (fu[o + 2] - fprev[o + 2]) * alpha;
        localP[o] = x; localP[o + 1] = y; localP[o + 2] = z;
        const d = Math.abs(x - XA[o]) + Math.abs(y - XA[o + 1]) + Math.abs(z - XA[o + 2]);
        pAct[o / 3] = d > (pAct[o / 3] ? P.meshEpsilon * 0.25 : P.meshEpsilon) ? 1 : 0;   // hysteresis: no on/off popping
        if (d > maxL) maxL = d;
      }
      if (maxL > 2e-5) { updateMeshes(maxL); fleshShown = true; }
      else if (fleshShown) restoreRest();
    } else if (fleshShown) restoreRest();
    if (debugObj && debugObj.visible) {
      const arr = debugObj.children[0].geometry.attributes.position;
      const src = fleshActive ? localP : XA;
      for (let i = 0; i < nP * 3; i++) arr.array[i] = src[i];
      arr.needsUpdate = true;
    }
    // chain
    for (let i = 0; i < N * 3; i++) bxR[i] = bxPrev[i] + (bx[i] - bxPrev[i]) * alpha;
    for (let i = 0; i < N; i++) {
      _v.set(bxR[i * 3], bxR[i * 3 + 1], bxR[i * 3 + 2]);
      _m4.makeTranslation(_v.x, _v.y, _v.z); beads.setMatrixAt(i, _m4);
      const j = (i + 1) % N;
      _v2.set(bxR[j * 3] - _v.x, bxR[j * 3 + 1] - _v.y, bxR[j * 3 + 2] - _v.z);
      const L = _v2.length();
      if (L > 1e-9) _q.setFromUnitVectors(UP, _v2.multiplyScalar(1 / L)); else _q.identity();
      if (i === 0) {   // the clasp spans beads 0-1
        clasp.position.set(_v.x + _v2.x * L * 0.5, _v.y + _v2.y * L * 0.5, _v.z + _v2.z * L * 0.5); clasp.quaternion.copy(_q);
        _m4.makeScale(0, 0, 0);
      } else {
        _m4.compose(_v.set(_v.x + _v2.x * L * 0.5, _v.y + _v2.y * L * 0.5, _v.z + _v2.z * L * 0.5), _q, _v2.set(1, L, 1));
      }
      links.setMatrixAt(i, _m4);
    }
    beads.instanceMatrix.needsUpdate = true; links.instanceMatrix.needsUpdate = true;
    lerpPose(tagPrev, tag, alpha, tagMesh.position, tagMesh.quaternion);
    updateFingerVisuals();
    stats.skinMs += performance.now() - t0;
  }
  // Incremental mesh update: only lattice cells whose corners are deformed (plus cells that just relaxed) are
  // re-skinned; triangle normals are updated incrementally into the welded per-vertex accumulators.
  function updateMeshes(maxL) {
    frameStamp = (frameStamp + 1) >>> 0;
    let active = 0;
    for (const s of soft) {
      const pos = s.pos, rest = s.rest, I = s.eIdx, W = s.eW, MC = s.mcCorners;
      let nList = 0;
      for (let c = 0; c < s.nMC; c++) {
        const k8 = c * 8;
        const act = pAct[MC[k8]] | pAct[MC[k8 + 1]] | pAct[MC[k8 + 2]] | pAct[MC[k8 + 3]] | pAct[MC[k8 + 4]] | pAct[MC[k8 + 5]] | pAct[MC[k8 + 6]] | pAct[MC[k8 + 7]];
        if (!act && !s.mcActive[c]) continue;
        s.mcActive[c] = act; active += act;
        const v1 = s.mcVStart[c + 1];
        if (act) {
          for (let iv = s.mcVStart[c]; iv < v1; iv++) {
            const v = s.mcV[iv], k = v * 8, o = v * 3;
            let x = 0, y = 0, z = 0;
            for (let q = 0; q < 8; q++) { const wq = W[k + q], p = I[k + q] * 3; x += wq * localP[p]; y += wq * localP[p + 1]; z += wq * localP[p + 2]; }
            pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
          }
        } else {
          for (let iv = s.mcVStart[c]; iv < v1; iv++) { const o = s.mcV[iv] * 3; pos[o] = rest[o]; pos[o + 1] = rest[o + 1]; pos[o + 2] = rest[o + 2]; }
        }
        const t1 = s.mcTStart[c + 1];
        for (let it = s.mcTStart[c]; it < t1; it++) { const t = s.mcT[it]; if (s.triStamp[t] !== frameStamp) { s.triStamp[t] = frameStamp; s.triList[nList++] = t; } }
      }
      // When most of the body is moving, refresh normals every other frame (positions stay per frame); triangles
      // touched on a skipped frame are remembered so their normals catch up on the next one.
      const skipNormals = false;   // (half-rate normals flickered under a single lamp - always refresh)
      if (skipNormals || s.nPend) {
        for (let i = 0; i < nList; i++) { const t = s.triList[i]; if (!s.triPend[t]) { s.triPend[t] = 1; s.pend[s.nPend++] = t; } }
        if (skipNormals) { s.pa.needsUpdate = true; continue; }
        for (let i = 0; i < s.nPend; i++) { s.triPend[s.pend[i]] = 0; s.triList[i] = s.pend[i]; }
        nList = s.nPend; s.nPend = 0;
      }
      if (!nList) continue;
      const tn0 = performance.now();
      const acc = s.acc, triN = s.triN, triC = s.triC, tri = s.tri;
      for (let i = 0; i < nList; i++) {
        const t = s.triList[i], o = t * 3;
        const ox = triN[o], oy = triN[o + 1], oz = triN[o + 2];
        triNormal(pos, tri, t, triN, o);
        const dx = triN[o] - ox, dy = triN[o + 1] - oy, dz = triN[o + 2] - oz;
        for (let q = 0; q < 3; q++) { const k = triC[o + q] * 3; acc[k] += dx; acc[k + 1] += dy; acc[k + 2] += dz; }
      }
      for (let i = 0; i < nList; i++) { const o = s.triList[i] * 3; writeNormal(s, tri[o]); writeNormal(s, tri[o + 1]); writeNormal(s, tri[o + 2]); }
      stats.normalMs += performance.now() - tn0;
      s.pa.needsUpdate = true; s.na.needsUpdate = true;
      const bs = s.geo.boundingSphere || (s.geo.boundingSphere = new THREE.Sphere());
      bs.center.copy(s.restSphere.center); bs.radius = s.restSphere.radius + maxL + 0.002;
    }
    stats.activeCells = active;
  }
  function restoreRest() {
    for (const s of soft) {
      s.pos.set(s.rest); s.nrm.set(s.restNrm); s.acc.set(s.restAcc); s.triN.set(s.restTriN); s.mcActive.fill(0);
      s.triPend.fill(0); s.nPend = 0;
      s.pa.needsUpdate = true; s.na.needsUpdate = true;
      if (s.geo.boundingSphere) s.geo.boundingSphere.copy(s.restSphere);
    }
    fleshShown = false; stats.activeCells = 0;
  }

  /* ---------------------------------------------- picking ---------------------------------------------- */
  const _inv = new THREE.Matrix4(), _ray = new THREE.Ray(), _camDir = new THREE.Vector3();
  function localRay(info) {
    group.updateWorldMatrix(true, false);
    _inv.copy(group.matrixWorld).invert();
    _ray.copy(info.raycaster.ray).applyMatrix4(_inv);
    _ray.direction.normalize();
    return _ray;
  }
  function cameraDir() {
    ctx.camera.getWorldDirection(_camDir);
    return _camDir.transformDirection(_inv).normalize();
  }
  function pickBeads(ray) {
    let best = null; const pr = rb + 0.0011, o = ray.origin, d = ray.direction;
    for (let i = 0; i < N; i++) {
      if (i === exhibitionPin) continue;
      const cx = bxR[i * 3] - o.x, cy = bxR[i * 3 + 1] - o.y, cz = bxR[i * 3 + 2] - o.z;
      const t = cx * d.x + cy * d.y + cz * d.z; if (t < 0) continue;
      const q2 = cx * cx + cy * cy + cz * cz - t * t; const r = i <= 1 ? pr + 0.0008 : pr;
      if (q2 > r * r) continue;
      const th2 = t - Math.sqrt(Math.max(0, r * r - q2));
      if (!best || th2 < best.t) best = { type: 'bead', i, t: th2 };
    }
    return best;
  }
  function pickTag(ray) {
    _q.copy(tagMesh.quaternion).invert();
    const o = _v.copy(ray.origin).sub(tagMesh.position).applyQuaternion(_q), d = _v2.copy(ray.direction).applyQuaternion(_q);
    const m = 0.0008, lo = [-tw / 2 - m, -th / 2 - m, -tt / 2 - m], hi = [tw / 2 + m, th / 2 + m, tt / 2 + m];
    let t0 = -Infinity, t1 = Infinity;
    const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z];
    for (let a = 0; a < 3; a++) {
      if (Math.abs(da[a]) < 1e-12) { if (oa[a] < lo[a] || oa[a] > hi[a]) return null; continue; }
      let ta = (lo[a] - oa[a]) / da[a], tb = (hi[a] - oa[a]) / da[a]; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) return null;
    }
    if (t1 < 0) return null;
    const t = Math.max(t0, 0);
    return { type: 'tag', t, local: [o.x + d.x * t, o.y + d.y * t, Math.max(-tt / 2, Math.min(tt / 2, o.z + d.z * t))] };
  }
  // sphere-trace the rest-shape SDF in the rendered core frame
  function pickPlush(ray) {
    const R = rCore.R, ox = ray.origin.x - rCore.x, oy = ray.origin.y - rCore.y, oz = ray.origin.z - rCore.z;
    const dX = ray.direction.x, dY = ray.direction.y, dZ = ray.direction.z;
    const tc = ox * dX + oy * dY + oz * dZ, c2 = ox * ox + oy * oy + oz * oz - tc * tc;
    if (c2 > plushBoundR * plushBoundR) return null;
    const Ox = R[0] * ox + R[3] * oy + R[6] * oz + com0.x, Oy = R[1] * ox + R[4] * oy + R[7] * oz + com0.y, Oz = R[2] * ox + R[5] * oy + R[8] * oz + com0.z;
    const Dx = R[0] * dX + R[3] * dY + R[6] * dZ, Dy = R[1] * dX + R[4] * dY + R[7] * dZ, Dz = R[2] * dX + R[5] * dY + R[8] * dZ;
    let t = Math.max(0, -tc - plushBoundR), tEnd = -tc + plushBoundR;
    const O3 = [Ox, Oy, Oz], D3 = [Dx, Dy, Dz];
    for (let a = 0; a < 3; a++) {   // clip to the SDF box
      const lo = sdf.min[a] + 1e-6, hi = sdf.max[a] - 1e-6;
      if (Math.abs(D3[a]) < 1e-12) { if (O3[a] < lo || O3[a] > hi) return null; continue; }
      let ta = (lo - O3[a]) / D3[a], tb = (hi - O3[a]) / D3[a]; if (ta > tb) { const s = ta; ta = tb; tb = s; }
      if (ta > t) t = ta;
      if (tb < tEnd) tEnd = tb;
    }
    for (let it = 0; it < 160 && t <= tEnd; it++) {
      const X = Ox + Dx * t, Y = Oy + Dy * t, Z = Oz + Dz * t;
      const phi = sdfSample(X, Y, Z, false);
      if (phi < 0.00025) {
        sdfSample(X, Y, Z, true);
        return { type: 'plush', t, X: new THREE.Vector3(X, Y, Z), N: new THREE.Vector3(sdfGrad[0], sdfGrad[1], sdfGrad[2]) };
      }
      t += clamp(phi * 0.9, 0.0003, 0.006);
    }
    return null;
  }
  function pickAll(ray) {
    const a = pickBeads(ray), b = pickTag(ray), c = pickPlush(ray);
    let best = null, bt = Infinity;
    for (const h of [a, b, c]) { if (!h) continue; const t2 = h.type === 'bead' ? h.t - 0.002 : h.t; if (t2 < bt) { best = h; bt = t2; } }
    return best;
  }
  // current world position of a rest-frame material point (rigid core + flesh deformation)
  function restToWorld(X, out) {
    let lx = X.x, ly = X.y, lz = X.z;
    if (fleshActive) {
      const gx = (X.x - LO[0]) / hL, gy = (X.y - LO[1]) / hL, gz = (X.z - LO[2]) / hL;
      const i = clamp(Math.floor(gx), 1, NCX - 2), j = clamp(Math.floor(gy), 1, NCY - 2), k = clamp(Math.floor(gz), 1, NCZ - 2);
      const fx = clamp(gx - i, 0, 1), fy = clamp(gy - j, 0, 1), fz = clamp(gz - k, 0, 1);
      let sx = 0, sy = 0, sz = 0, ws = 0;
      for (let c = 0; c < 8; c++) {
        const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
        const p = pidOfSlot[(i + dx) + PX * ((j + dy) + PY * (k + dz))]; if (p < 0) continue;
        const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz), o = p * 3;
        sx += w * (fu[o] - XA[o]); sy += w * (fu[o + 1] - XA[o + 1]); sz += w * (fu[o + 2] - XA[o + 2]); ws += w;
      }
      if (ws > 1e-6) { lx += sx / ws; ly += sy / ws; lz += sz / ws; }
    }
    const R = core.R; lx -= com0.x; ly -= com0.y; lz -= com0.z;
    return out.set(core.x + R[0] * lx + R[1] * ly + R[2] * lz, core.y + R[3] * lx + R[4] * ly + R[5] * lz, core.z + R[6] * lx + R[7] * ly + R[8] * lz);
  }
  function gaussianWeights(X, sigma) {
    const out = [], c2 = (2.5 * sigma) ** 2;
    for (let p = 0; p < nP; p++) {
      const dx = XA[p * 3] - X.x, dy = XA[p * 3 + 1] - X.y, dz = XA[p * 3 + 2] - X.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < c2) out.push(p, Math.exp(-d2 / (2 * sigma * sigma)));
    }
    return out;
  }
  const toLocalDir = (v) => { const R = core.R; return [R[0] * v.x + R[3] * v.y + R[6] * v.z, R[1] * v.x + R[4] * v.y + R[7] * v.z, R[2] * v.x + R[5] * v.y + R[8] * v.z]; };

  /* ---------------------------------------------- gestures ---------------------------------------------- */
  const planeHit = (ray, g, out) => {
    const n = g.pn, den = ray.direction.dot(n);
    if (Math.abs(den) < 1e-6) return null;
    const t = g.pp.clone().sub(ray.origin).dot(n) / den;
    if (t < 0) return null;
    out.copy(ray.origin).addScaledVector(ray.direction, t);
    const d = out.distanceTo(H);   // keep targets within reach of the hook
    if (d > P.maxReach) out.sub(H).multiplyScalar(P.maxReach / d).add(H);
    if (out.y < tableY + 0.003) out.y = tableY + 0.003;
    return out;
  };
  function newTarget(obj, p) { obj.tx = p.x; obj.ty = p.y; obj.tz = p.z; obj.sx = p.x; obj.sy = p.y; obj.sz = p.z; obj.svx = obj.svy = obj.svz = 0; obj.ramp = 0; }
  // smoothed, speed-limited targets for all grabs (advanced every mechanism substep)
  function advanceTargets(h) {
    for (let gi = -2; gi < plushGrabs.length; gi++) {
      const g = gi === -2 ? grabBead : gi === -1 ? grabTag : plushGrabs[gi];
      if (!g) continue;
      g.ramp = Math.min(1, g.ramp + h / 0.08);
      const dx = g.tx - g.sx, dy = g.ty - g.sy, dz = g.tz - g.sz;
      const maxStep = (gi >= 0 ? 0.40 : 0.30) * h, k = 1 - Math.exp(-h / 0.05);
      let mx = dx * k, my = dy * k, mz = dz * k; const ml = Math.hypot(mx, my, mz);
      if (ml > maxStep) { mx *= maxStep / ml; my *= maxStep / ml; mz *= maxStep / ml; }
      g.sx += mx; g.sy += my; g.sz += mz;
      const a = 1 - Math.exp(-h / 0.03);
      g.svx += (mx / h - g.svx) * a; g.svy += (my / h - g.svy) * a; g.svz += (mz / h - g.svz) * a;
    }
  }
  function releaseBead() { if (grabBead) { bim[grabBead.i] = grabBead.im; grabBead = null; } }
  function excite() { lastExcite = simTime; wake(); }
  function wake() { if (sleeping) { sleeping = false; acc = 0; } calm = 0; floorCalm = 0; }
  function ensureFlesh() { if (!fleshActive) { fleshToRest(); fleshActive = true; } }
  function addPlushGrab(X, W, local = true) {
    const g = { b: [X.x - com0.x, X.y - com0.y, X.z - com0.z], weights: local ? gaussianWeights(X, P.grabSigma) : null };
    newTarget(g, W);
    plushGrabs.push(g); ensureFlesh(); excite();
    return g;
  }
  function removePlushGrab(g) { const i = plushGrabs.indexOf(g); if (i >= 0) plushGrabs.splice(i, 1); }
  function startSqueeze(hit) {
    const X = hit.X.clone(), Nn = hit.N.clone().normalize();
    // far side along -N through the rest-shape SDF
    let t = 0.001, far = null;
    for (let it = 0; it < 200 && t < 0.12; it++) {
      const p = X.clone().addScaledVector(Nn, -t);
      const phi = sdfSample(p.x, p.y, p.z, false);
      if (phi > 0 && t > 0.003) { far = p; break; }
      t += Math.max(Math.abs(phi), 0.0004);
    }
    if (!far) far = X.clone().addScaledVector(Nn, -0.03);
    const T = Math.max(0.006, X.distanceTo(far));
    const rF = Math.min(P.fingerRadius, Math.max(0.0035, 0.42 * T));
    const dMax = P.squeezeDepth * T;
    const cand = [], reach = rF + dMax + hL * 1.5;
    const ab = far.clone().sub(X), abl2 = Math.max(1e-12, ab.lengthSq()), q = new THREE.Vector3();
    for (let p = 0; p < nP; p++) {
      q.set(XA[p * 3] - X.x, XA[p * 3 + 1] - X.y, XA[p * 3 + 2] - X.z);
      const tt2 = clamp(q.dot(ab) / abl2, -0.3, 1.3);
      if (q.addScaledVector(ab, -tt2).length() < reach) cand.push(p);
    }
    squeeze = { X, N: Nn, far, T, rF, dMax, depth: 0, held: 0, cand: Int32Array.from(cand), f1: [0, 0, 0], f2: [0, 0, 0], releasing: false, vis: 0,
      manual: false, target: 0, lastInput: simTime };
    placeFingers();
    ensureFlesh(); excite();
    return squeeze;
  }
  function placeFingers() {
    const s = squeeze; if (!s) return;
    const off = s.rF - s.depth;
    s.f1[0] = s.X.x + s.N.x * off; s.f1[1] = s.X.y + s.N.y * off; s.f1[2] = s.X.z + s.N.z * off;
    s.f2[0] = s.far.x - s.N.x * off; s.f2[1] = s.far.y - s.N.y * off; s.f2[2] = s.far.z - s.N.z * off;
  }
  function updateSqueezeDepth(h) {
    const s = squeeze;
    if (s.releasing) {
      s.depth -= h * s.dMax / 0.06;     // fingers leave quickly, the plush springs back on its own
      s.vis = Math.max(0, s.vis - h / 0.25);
      if (s.depth <= 0) { s.depth = 0; if (s.vis <= 0) squeeze = null; }
    } else if (s.manual) {   // pinch / wheel: depth follows the requested amount (clamped to 60 % of the thickness)
      s.depth += (clamp(s.target, 0, s.dMax) - s.depth) * (1 - Math.exp(-h / 0.06));
      s.vis = Math.min(1, s.vis + h / 0.15);
      if (s.wheel && simTime - s.lastInput > 0.7) s.target *= Math.exp(-h / 0.25);   // wheel squeeze lets go by itself
      if (s.wheel && s.target < 0.02 * s.dMax && simTime - s.lastInput > 0.7) s.releasing = true;
    } else {
      s.held += h;
      s.depth = s.dMax * (1 - Math.exp(-s.held / P.squeezeRise));
      s.vis = Math.min(1, s.vis + h / 0.15);
    }
    if (squeeze) placeFingers();
    lastExcite = simTime;
  }
  function endSqueeze() { if (squeeze) { squeeze.releasing = true; excite(); } }
  function updateFingerVisuals() {
    const s = squeeze;
    const show = !!(s && P.showFingers && s.vis > 0.01);
    fingers[0].visible = fingers[1].visible = show;
    if (!show) return;
    fingerMat.opacity = 0.32 * s.vis;
    const R = rCore.R;
    for (let f = 0; f < 2; f++) {
      const L = f === 0 ? s.f1 : s.f2, sign = f === 0 ? 1 : -1;
      const lx = L[0] - com0.x, ly = L[1] - com0.y, lz = L[2] - com0.z;
      const m = fingers[f];
      m.position.set(rCore.x + R[0] * lx + R[1] * ly + R[2] * lz, rCore.y + R[3] * lx + R[4] * ly + R[5] * lz, rCore.z + R[6] * lx + R[7] * ly + R[8] * lz);
      _v.set(s.N.x * sign, s.N.y * sign, s.N.z * sign);
      _v2.set(R[0] * _v.x + R[1] * _v.y + R[2] * _v.z, R[3] * _v.x + R[4] * _v.y + R[5] * _v.z, R[6] * _v.x + R[7] * _v.y + R[8] * _v.z);
      m.quaternion.setFromUnitVectors(UP, _v2);
      m.scale.setScalar(s.rF * 0.92);
      m.position.addScaledVector(_v2, s.rF * 1.1);   // the capsule extends outward like a fingertip
    }
  }
  function applyFlick(hit, vel) {
    const sp = vel.length();
    if (!(sp > 1e-6)) return;
    const v = vel.clone().multiplyScalar(Math.min(sp * P.flickGain, P.flickMaxSpeed) / sp);
    const W = restToWorld(hit.X, new THREE.Vector3());
    const rx = W.x - core.x, ry = W.y - core.y, rz = W.z - core.z;
    const n = v.clone().normalize();
    const J = v.length() / core.w(rx, ry, rz, n.x, n.y, n.z);   // the hit point gets exactly |v| along n
    core.applyImpulse(n.x * J, n.y * J, n.z * J, rx, ry, rz);
    ensureFlesh();
    const vl = toLocalDir(v), Wt = gaussianWeights(hit.X, 0.009), g = P.jiggleGain;
    for (let i = 0; i < Wt.length; i += 2) { const o = Wt[i] * 3, w = Wt[i + 1] * g; fw[o] += vl[0] * w; fw[o + 1] += vl[1] * w; fw[o + 2] += vl[2] * w; }
    excite();
  }
  let lastPet = null;
  function petAt(ray, time) {
    const hit = pickPlush(ray);
    if (!hit) { lastPet = null; return; }
    const W = restToWorld(hit.X, new THREE.Vector3());
    if (lastPet) {
      const dt = Math.max(1 / 240, time - lastPet.time);
      const d = W.clone().sub(lastPet.W);
      const R = core.R, Nw = new THREE.Vector3(R[0] * hit.N.x + R[1] * hit.N.y + R[2] * hit.N.z, R[3] * hit.N.x + R[4] * hit.N.y + R[5] * hit.N.z, R[6] * hit.N.x + R[7] * hit.N.y + R[8] * hit.N.z);
      d.addScaledVector(Nw, -d.dot(Nw));
      const dl = d.length();
      if (dl > 0.0002) {
        const dir = d.multiplyScalar(1 / dl), speed = dl / dt, s = clamp(speed / 0.25, 0.08, 1);
        ensureFlesh();
        const dl3 = toLocalDir(dir), Wt = gaussianWeights(hit.X, P.petSigma);
        const nl = hit.N;   // rest normal == local normal
        for (let i = 0; i < Wt.length; i += 2) {
          const o = Wt[i] * 3, w = Wt[i + 1] * s;
          fw[o] += (dl3[0] * P.petDrag - nl.x * P.petPress) * w; fw[o + 1] += (dl3[1] * P.petDrag - nl.y * P.petPress) * w; fw[o + 2] += (dl3[2] * P.petDrag - nl.z * P.petPress) * w;
        }
        // soft sway of the whole toy
        const J = P.plushMass * P.petSway * s;
        core.applyImpulse(dir.x * J, dir.y * J, dir.z * J, (W.x - core.x) * 0.5, (W.y - core.y) * 0.5, (W.z - core.z) * 0.5);
        // stroke in the rest frame: direction mapped back through the core rotation, projected on the tangent plane
        const rd = new THREE.Vector3(dl3[0], dl3[1], dl3[2]);
        rd.addScaledVector(hit.N, -rd.dot(hit.N)).normalize();
        if (onStroke) { try { onStroke(hit.X.clone(), rd.clone(), s); } catch (e) { console.error(e); } }
        const last = furStrokes[furStrokes.length - 1];
        if (!last || last.p.distanceTo(hit.X) > 0.002) {
          furStrokes.push({ p: hit.X.clone(), d: rd.clone(), s, t: time });
          if (furStrokes.length > 32) furStrokes.shift();
          furStrokeVersion++;
        }
        excite();
      }
    }
    lastPet = { W, time };
  }
  function endGesture(info, cancelled) {
    const g = gesture; if (!g) return;
    const t = info ? info.time : g.t0 + 1;
    const quick = t - g.t0 < P.flickTime;
    if (g.kind === 'pending' && !cancelled) {
      applyFlick(g.hit, cameraDir().clone().multiplyScalar(P.pokeSpeed / P.flickGain));   // tap = poke along the view
    } else if (g.kind === 'grab' || g.kind === 'pet') {
      plushGrabs.length = 0; lastPet = null;
      // A grab already carries momentum; adding a second release impulse caused launches.
      if (g.kind === 'pet' && quick && !cancelled) { const v = swipeVelocity(g); if (v.length() > 0.45) applyFlick(g.hit, v); }
      const speed = Math.hypot(core.vx, core.vy, core.vz);
      if (speed > .25) { const k = .25 / speed; core.vx *= k; core.vy *= k; core.vz *= k; }
      excite();
    } else if (g.kind === 'two' || g.kind === 'rsq') {
      endSqueeze(); plushGrabs.length = 0; excite();
    } else if (g.kind === 'bead') { releaseBead(); excite(); }
    else if (g.kind === 'tag') { grabTag = null; excite(); }
    gesture = null;
    if (!hooked && !cancelled) tryRehang();
  }
  // ---- off / on the hook ----
  function attachWorld(out) {
    const R = core.R; return out.set(core.x + R[0] * attachB[0] + R[1] * attachB[1] + R[2] * attachB[2], core.y + R[3] * attachB[0] + R[4] * attachB[1] + R[5] * attachB[2], core.z + R[6] * attachB[0] + R[7] * attachB[1] + R[8] * attachB[2]);
  }
  function checkUnhook() {   // lifting the loop / the toy clearly above the eye takes it off the hook
    if (opts.exhibition || !hooked || !gesture) return;
    let y = -1;
    if (grabBead) y = bx[grabBead.i * 3 + 1];
    else if (plushGrabs.length) y = attachWorld(_v).y;
    else if (grabTag) { const T = tag.R; y = tag.y + T[3] * holeL[0] + T[4] * holeL[1]; }
    if (y > ringC.y + P.eyeRadius + (grabBead ? 0.004 : 0.012)) { hooked = false; hint('从挂钩上取下来了——松手它会掉到桌上；把珠链拿回挂钩附近松手就能挂回去。'); }
  }
  function tryRehang() {   // snap-assist: release the chain (or the toy's cord loop) near the eye -> it hangs again
    // distance measured across the screen (the user can't judge depth), plus a looser depth tolerance
    const cd = cameraDir(), dist = (x, y, z) => {
      const dx = x - ringC.x, dy = y - ringC.y, dz = z - ringC.z, a = dx * cd.x + dy * cd.y + dz * cd.z;
      return Math.max(Math.hypot(dx - a * cd.x, dy - a * cd.y, dz - a * cd.z), Math.abs(a) * 0.25);
    };
    let best = Infinity;
    for (let i = 0; i < N; i++) best = Math.min(best, dist(bx[i * 3], bx[i * 3 + 1], bx[i * 3 + 2]));
    attachWorld(_v); best = Math.min(best, dist(_v.x, _v.y, _v.z));
    if (awayFromHook && best < P.rehangRadius) { initState(); preroll(0.5); wake(); syncVisuals(1); hint('挂回去了。'); }
  }
  const _rc = new THREE.Raycaster(), _ndc = new THREE.Vector2();
  let awayFromHook = false;
  // ---- one-finger classification: tap / swipe / stroke / grab ----
  function screenRay(cx, cy) {   // camera ray through a client position, in group space
    const r = ctx.domElement ? ctx.domElement.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    _rc.setFromCamera(_ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), ctx.camera);
    return localRay({ raycaster: _rc });
  }
  function startTwo(g, f2) {   // second finger on the plush: each finger holds its own spot (bend / twist), pinching squeezes
    plushGrabs.length = 0; lastPet = null;
    const h1 = g.lastHit || g.hit;
    g.ga = addPlushGrab(h1.X, restToWorld(h1.X, new THREE.Vector3()));
    if (g.lastP) { g.ga.tx = g.lastP.x; g.ga.ty = g.lastP.y; g.ga.tz = g.lastP.z; }
    f2.hit.W = restToWorld(f2.hit.X, new THREE.Vector3());
    f2.pp = f2.hit.W.clone(); f2.pn = g.pn;
    f2.grab = addPlushGrab(f2.hit.X, f2.hit.W);
    g.f2 = f2; g.kind = 'two';
    g.d0 = Math.max(20, Math.hypot(f2.x - (g.cx ?? g.x0), f2.y - (g.cy ?? g.y0)));
  }
  function updatePinch(g) {
    const d = Math.hypot(g.f2.x - g.cx, g.f2.y - g.cy), pinch = clamp((1 - d / g.d0) / 0.5, 0, 1);
    if (pinch > 0.05 && (!squeeze || squeeze.releasing)) {
      const hit = pickPlush(screenRay((g.f2.x + g.cx) / 2, (g.f2.y + g.cy) / 2)) || g.f2.hit;
      startSqueeze(hit).manual = true;
    }
    if (squeeze && squeeze.manual && !squeeze.releasing) { squeeze.target = pinch * squeeze.dMax; squeeze.lastInput = simTime; }
  }
  function swipeVelocity(g) {
    const S = g.samples, n = S.length;
    if (n < 2) return new THREE.Vector3();
    const last = S[n - 1]; let first = S[0];
    for (let i = n - 1; i >= 0; i--) { first = S[i]; if (last.t - S[i].t > 0.09) break; }
    const dt = Math.max(1 / 120, last.t - first.t);
    return last.p.clone().sub(first.p).multiplyScalar(1 / dt);
  }
  function hint(t) { if (onHint) { try { onHint(t); } catch (e) { /* ignore */ } } }

  /* ---------------------------------------------- API ---------------------------------------------- */
  const _tgt = new THREE.Vector3();
  const api = {
    group, softRoot,
    get softMeshes() { return soft.map((s) => s.mesh); },
    furStrokes,
    get furStrokeVersion() { return furStrokeVersion; },
    params: P,
    stats,
    focus: { target: new THREE.Vector3(), distance: 0.4 },
    hook: { position: H.clone(), stand },
    chain: { beads, links, clasp, count: N },
    tagMesh,
    get tool() { return tool; },
    /** v2: there are no tools any more - kept as a harmless no-op for older shells. */
    setTool(name) { tool = name; },
    get hooked() { return hooked; },
    pointerDown(info) {
      tagTurn = null;
      if (gesture) {   // a second finger on the plush turns the gesture into a two-finger one (pinch / bend / twist)
        if (gesture.kind === 'pending' || gesture.kind === 'pet' || gesture.kind === 'grab') {
          const hit = pickPlush(localRay(info));
          if (!hit) return false;
          startTwo(gesture, { id: info.pointerId, x: info.clientX, y: info.clientY, hit });
          wake(); excite();
          return true;
        }
        return false;
      }
      const btn = info.pointerType === 'mouse' ? (info.button ?? 0) : 0;
      if (btn === 1) return false;
      const ray = localRay(info);
      const hit = pickAll(ray);
      if (!hit) return false;
      if (btn === 2 && hit.type !== 'plush') return false;
      wake();
      const pn = cameraDir().clone();
      const g = { pointerId: info.pointerId, t0: info.time, simT0: simTime, x0: info.clientX, y0: info.clientY, cx: info.clientX, cy: info.clientY, samples: [], moved: false, kind: null, pn };
      gesture = g;
      if (hit.type === 'bead') {
        const i = hit.i, p = new THREE.Vector3(bx[i * 3], bx[i * 3 + 1], bx[i * 3 + 2]);
        g.kind = 'bead'; g.pp = p.clone();
        grabBead = { i, im: bim[i] }; bim[i] = 0; newTarget(grabBead, p);
      } else if (hit.type === 'tag') {
        const l = hit.local, T = tag.R;
        const p = new THREE.Vector3(tag.x + T[0] * l[0] + T[1] * l[1] + T[2] * l[2], tag.y + T[3] * l[0] + T[4] * l[1] + T[5] * l[2], tag.z + T[6] * l[0] + T[7] * l[1] + T[8] * l[2]);
        g.kind = 'tag'; g.pp = p.clone();
        grabTag = { l, lambda: 0 }; newTarget(grabTag, p);
      } else {
        hit.W = restToWorld(hit.X, new THREE.Vector3());
        g.hit = hit; g.pp = hit.W.clone();
        if (btn === 2) { g.kind = 'rsq'; startSqueeze(hit); }   // right-drag: squeeze (grows while held), dragging bends
        else g.kind = 'pending';
      }
      g.samples.push({ t: info.time, p: g.pp.clone() });
      excite();
      return true;
    },
    pointerMove(info) {
      const g = gesture;
      if (!g) return;
      const ray = localRay(info);
      if (g.f2 && info.pointerId === g.f2.id) {   // second finger
        g.f2.x = info.clientX; g.f2.y = info.clientY;
        const p = planeHit(ray, g.f2, _tgt);
        if (p && g.f2.grab) { g.f2.grab.tx = p.x; g.f2.grab.ty = p.y; g.f2.grab.tz = p.z; }
        updatePinch(g); excite();
        return;
      }
      if (info.pointerId !== g.pointerId) return;
      g.cx = info.clientX; g.cy = info.clientY;
      if (Math.hypot(info.clientX - g.x0, info.clientY - g.y0) > P.dragThresholdPx) g.moved = true;
      const p = planeHit(ray, g, _tgt);
      if (p) { g.samples.push({ t: info.time, p: p.clone() }); if (g.samples.length > 24) g.samples.shift(); g.lastP = p.clone(); }
      if (g.kind === 'pending' && g.moved) {
        // pressed still for a moment, or the finger already left the toy -> grab & pull; otherwise slide = stroke
        const onToy = pickPlush(ray);
        if (simTime - g.simT0 > P.pressGrabTime || !onToy) { g.kind = 'grab'; addPlushGrab(g.hit.X, g.pp); }
        else { g.kind = 'pet'; lastPet = null; petAt(screenRay(g.x0, g.y0), g.t0); }
      }
      if (g.kind === 'pet') {
        const h = pickPlush(ray);
        if (h) { petAt(ray, info.time); g.lastHit = h; g.miss = 0; }
        else if (++g.miss >= 2) {   // slid off the silhouette = pulling the spot under the finger away from the surface
          const X = (g.lastHit || g.hit).X;
          const W = restToWorld(X, new THREE.Vector3());
          g.kind = 'grab'; g.hit = { X, N: (g.lastHit || g.hit).N, W }; g.pp = W.clone(); lastPet = null;
          const gr = addPlushGrab(X, W); if (p) { gr.tx = p.x; gr.ty = p.y; gr.tz = p.z; }
        }
        excite();
        return;
      }
      if (!p) return;
      if (g.kind === 'grab' && plushGrabs[0]) { plushGrabs[0].tx = p.x; plushGrabs[0].ty = p.y; plushGrabs[0].tz = p.z; }
      else if (g.kind === 'two' && g.ga) { g.ga.tx = p.x; g.ga.ty = p.y; g.ga.tz = p.z; updatePinch(g); }
      else if (g.kind === 'bead' && grabBead) { grabBead.tx = p.x; grabBead.ty = p.y; grabBead.tz = p.z; }
      else if (g.kind === 'tag' && grabTag) { grabTag.tx = p.x; grabTag.ty = p.y; grabTag.tz = p.z; }
      else if (g.kind === 'rsq') {
        if (g.moved && !plushGrabs.length) addPlushGrab(g.hit.X, g.pp);   // right-drag bends the pinched spot
        if (plushGrabs[0]) { plushGrabs[0].tx = p.x; plushGrabs[0].ty = p.y; plushGrabs[0].tz = p.z; }
      }
      excite();
    },
    pointerUp(info) {
      const g = gesture; if (!g) return;
      if (info.cancelled) { endGesture(info, true); return; }
      if (g.f2 && (info.pointerId === g.f2.id || info.pointerId === g.pointerId)) {
        // one of two fingers lifted: let go of the pinch, the remaining finger keeps holding its spot
        endSqueeze();
        const keepSecond = info.pointerId === g.pointerId;
        const keep = keepSecond ? g.f2.grab : g.ga;
        plushGrabs.length = 0; if (keep) plushGrabs.push(keep);
        if (keepSecond) { g.pointerId = g.f2.id; g.cx = g.f2.x; g.cy = g.f2.y; g.hit = g.f2.hit; g.pp = g.f2.pp; }
        g.f2 = null; g.kind = 'grab'; g.t0 = -1e9; excite();
        return;
      }
      if (info.pointerId !== g.pointerId) return;
      endGesture(info, false);
    },
    /** v2 desktop fallback: wheel over the toy = pinch amount. Returns true when it used the wheel. */
    wheel(info, deltaY) {
      const hit = pickPlush(localRay(info));
      if (!hit) return false;
      wake();
      if (!squeeze || squeeze.releasing || !squeeze.wheel) { if (gesture) return true; startSqueeze(hit); squeeze.manual = true; squeeze.wheel = true; }
      squeeze.target = clamp(squeeze.target + Math.sign(deltaY || 0) * 0.18 * squeeze.dMax, 0, squeeze.dMax);
      squeeze.lastInput = simTime; excite();
      return true;
    },
    hoverCursor(info) {
      if (gesture) return 'grabbing';
      return pickAll(localRay(info)) ? 'grab' : null;
    },
    update(dt) {
      if (!(dt > 0)) dt = 0;
      dt = Math.min(dt, 0.1);
      const t0 = performance.now();
      stats.mechMs = 0; stats.fleshMs = 0; stats.skinMs = 0; stats.normalMs = 0; stats.steps = 0;
      checkUnhook();
      if (gesture || squeeze || grabBead || grabTag || tagTurn || plushGrabs.length) wake();
      if (!sleeping) {
        const hF = 1 / P.fleshHz;
        acc += dt;
        let n = 0;
        while (acc >= hF && n < (opts.exhibition ? 12 : 4)) { stepOnce(); acc -= hF; n++; }
        if (acc >= hF) acc = hF * 0.999;
        stats.steps = n;
        // if the loop ever leaves the hook without being lifted off (it shouldn't), treat it as taken off
        let onHook = false; for (let i = 0; i < N; i++) if (bcontact[i] === 1) { onHook = true; break; }
        offHook = onHook || gesture || !hooked ? 0 : offHook + dt;
        if (!opts.exhibition && offHook > 2.0) { offHook = 0; hooked = false; }
        if (!hooked && !awayFromHook) {
          let near = Infinity; for (let i = 0; i < N; i++) near = Math.min(near, Math.hypot(bx[i * 3] - ringC.x, bx[i * 3 + 1] - ringC.y, bx[i * 3 + 2] - ringC.z));
          if (near > P.rehangRadius * 2.2) awayFromHook = true;
        }
        if (hooked) awayFromHook = false;
        syncVisuals(clamp(acc / hF, 0, 1));
        let maxB = 0; for (let i = 0; i < N * 3; i += 3) maxB = Math.max(maxB, bv[i] * bv[i] + bv[i + 1] * bv[i + 1] + bv[i + 2] * bv[i + 2]);
        const busy = gesture || squeeze || tagTurn || (fleshActive && stats.fleshRelV > 2e-3) || maxB > 4e-6 || Math.hypot(core.vx, core.vy, core.vz) > 1.5e-3 || Math.hypot(core.wx, core.wy, core.wz) > 0.03
          || Math.hypot(tag.vx, tag.vy, tag.vz) > 3e-3 || Math.hypot(tag.wx, tag.wy, tag.wz) > 0.08;
        calm = busy ? 0 : calm + dt;
        // A supported toy may rest even if lightweight beads retain solver noise.
        const grounded = !hooked && floorContact && tagFloor && !gesture && !squeeze && !grabTag && !grabBead && !plushGrabs.length;
        floorCalm = grounded && Math.hypot(core.vx, core.vy, core.vz) < .025 && Math.hypot(core.wx, core.wy, core.wz) < .8 ? floorCalm + dt : 0;
        if (calm > 1.0 || floorCalm > 1.2) {
          sleeping = true;
          fleshToRest(); fleshActive = false; acc = 0;
          bv.fill(0); core.vx = core.vy = core.vz = core.wx = core.wy = core.wz = 0; tag.vx = tag.vy = tag.vz = tag.wx = tag.wy = tag.wz = 0;
          snapshotPrev(); syncVisuals(1);
        }
      }
      stats.sleeping = sleeping; stats.fleshActive = fleshActive;
      if (hooked) { api.focus.target.copy(hangingFocus.target); api.focus.distance=hangingFocus.distance; }
      else { group.updateWorldMatrix(true,false);api.focus.target.set(core.x,core.y,core.z).applyMatrix4(group.matrixWorld);api.focus.distance=.28; }
      stats.ms = performance.now() - t0;
    },
    reset() {
      lastPet = null;
      initState(); preroll(1.6); wake(); syncVisuals(1);
    },
    /** Programmatic flick: rest-frame point on the plush, world velocity (m/s) the point should get. */
    poke(restPoint, worldVelocity) { wake(); applyFlick({ X: restPoint.clone() }, worldVelocity.clone().multiplyScalar(1 / P.flickGain)); },
    setLatticeVisible(v) {
      if (v && !debugObj) { debugObj = buildDebug(); softRoot.add(debugObj); }
      if (debugObj) debugObj.visible = !!v;
      wake(); syncVisuals(1);
    },
    get latticeVisible() { return !!(debugObj && debugObj.visible); },
    setTagTextures(t = {}) {
      if (t.front) { tagMats[0].map = t.front; tagMats[0].needsUpdate = true; }
      if (t.back) { tagMats[1].map = t.back; tagMats[1].needsUpdate = true; }
    },
    // Exhibition gestures use the mechanism without re-skinning 160k triangles.
    nudge(velocity) {
      const v = velocity.clone();
      group.updateWorldMatrix(true, false);
      const length = Math.min(.12, v.length());
      v.transformDirection(_inv.copy(group.matrixWorld).invert()).multiplyScalar(length);
      core.vx = clamp(core.vx + v.x, -.18, .18);
      core.vy = clamp(core.vy + v.y, -.18, .18);
      core.vz = clamp(core.vz + v.z, -.18, .18);
      tag.vx += v.x * .6; tag.vy += v.y * .6; tag.vz += v.z * .6;
      wake();
    },
    turnTag() {
      if (!opts.exhibition || gesture) return false;
      const from = new THREE.Quaternion(tag.qx, tag.qy, tag.qz, tag.qw);
      const hole = new THREE.Vector3(...holeL).applyQuaternion(from).add(new THREE.Vector3(tag.x, tag.y, tag.z));
      const to = from.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...holeL).normalize(), Math.PI * tagFlipDirection));
      tagFlipDirection *= -1;
      tagTurn = {t: 0, from, to, hole, target: H.clone().add(new THREE.Vector3(.035, -.025, -.012))};
      wake(); return true;
    },
    cancelInteraction() { endGesture(null, true); tagTurn = null; },
    get tagTurning() { return !!tagTurn; },
    get isGrabbed() { return !!(gesture || squeeze || grabBead || grabTag || plushGrabs.length); },
    get isSleeping() { return sleeping; },
    exportObject() { return group; },
    dispose() {
      if (group.parent) group.parent.remove(group);
      for (const d of disposables) { try { d.dispose(); } catch (e) { /* ignore */ } }
      beads.dispose(); links.dispose();
    },
    /** internals for tests / tuning (not part of the contract) */
    _debug: { core, tag, bx, bv, bim, bcontact, H, com0, attachRest, sdf, sdfSample, nP, N, fu, fw, XA, X0, initState, mechStep, preroll,
      get exhibitionPin() { return exhibitionPin; }, get trackP() { return trackP; }, get trackT() { return trackT; }, get gesture() { return gesture; }, get squeeze() { return squeeze; },
      get fleshActive() { return fleshActive; }, get simTime() { return simTime; }, plushBoundR, ringC, postXZ },
  };

  initState();
  preroll(1.6);
  syncVisuals(1);
  {   // camera framing: the whole keychain from the eye down to the plush's feet
    const R = core.R, l = new THREE.Vector3((bmin[0] + bmax[0]) / 2, bmin[1], (bmin[2] + bmax[2]) / 2).sub(com0);
    const feetY = core.y + R[3] * l.x + R[4] * l.y + R[5] * l.z;
    const top = ringC.y + P.eyeRadius + 0.004, span = top - feetY;
    api.focus.target.set(H.x - P.armSide * 0.15, (top + feetY) / 2, H.z);
    group.updateWorldMatrix(true, false);
    api.focus.target.applyMatrix4(group.matrixWorld);
    api.focus.distance = Math.max(0.26, span * 2.3);
    if (!Number.isFinite(api.focus.distance) || !Number.isFinite(api.focus.target.x + api.focus.target.y + api.focus.target.z)) {
      api.focus.target.set(H.x, H.y - 0.09, H.z); api.focus.distance = 0.4;
    }
  }
  const hangingFocus={target:api.focus.target.clone(),distance:api.focus.distance};
  ctx.scene.add(group);
  return api;
}
