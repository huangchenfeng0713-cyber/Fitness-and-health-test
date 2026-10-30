// ============================================================================
// magnet_scene.js — keepsake3d module
// Tokyo Skytree "Sorakara-chan" metal fridge magnet, still in its retail packaging,
// with a tactile, layer-by-layer unpacking flow:
//
//   OPP header bag ── peel the bottom flap ──► slide the folded card out
//   ──► swing the card open around its bottom fold ──► lift the PET blister out
//   ──► pop the magnet out ──► flip / carry / stick it on the fridge door.
//
// three.js r170, plain ES module, no build step. Units: metres, Y up. The table is
// the plane y = 0 of this module's group (all internal maths is group-local, so the
// shell may move the group). API: see CONTRACT.md.
//
// Every body uses an "art frame": x right, y up the artwork (tower / card top /
// bag header), z out of the front face, origin on the back face. Lying face-up on
// the table the art frame is rotated by -90° about X (front up, art-top away from
// the viewer); on the fridge door the art frame is world-aligned.
// ============================================================================

const MM = 0.001;
const PI = Math.PI;
const HALF_PI = PI / 2;

/** Tunable constants (override any of them with `opts.tunables`). */
export const MAGNET_SCENE_TUNABLES = Object.freeze({
  // gestures
  dragStartPx: 4,            // movement before a press turns into a drag
  tapMaxPx: 9,               // max movement of a tap
  tapMaxTime: 0.5,           // s, max duration of a tap
  dblClickTime: 0.3,         // s, double-click window (tap actions wait this long)
  holdToLift: 0.22,          // s, press-and-hold lifts a loose item without moving
  // carrying / dropping
  liftHeight: 0.014,         // m, lift while dragging
  followRate: 22,            // 1/s, carried item follows the pointer
  liftRate: 14,              // 1/s
  tiltPerSpeed: 0.5,         // rad per m/s, lean while carried
  maxTilt: 0.12,             // rad
  gravity: 2.4,              // m/s², deliberately gentle
  restitution: 0.3,          // bounce
  settleSpeed: 0.028,        // m/s, below this the item stops bouncing
  wobbleK: 240,              // landing wobble spring
  wobbleC: 12,               // landing wobble damping
  landingWobble: 0.0005,     // m of edge travel per m/s of impact
  flipTime: 0.52,            // s
  flipArc: 0.006,            // m, extra rise during a flip
  hopTime: 0.55,             // s, automatic "put it aside" hops
  hopArc: 0.026,             // m
  // unpacking
  flapCommit: 0.42,          // peel fraction that completes on release (else it re-sticks)
  peelTime: 0.7,             // s, tap-to-peel
  slideMargin: 0.003,        // m, card is free once its top edge is this far past the mouth
  slideTime: 0.9,            // s, tap-to-slide-out
  hingeCommit: 1.25,         // rad, opening angle that completes on release
  openTime: 0.8,             // s, tap-to-open
  popDistance: 0.006,        // m of drag before the magnet pops out of the blister
  // bag film
  filmSlope: 0.95,           // how steeply the OPP film tents over the contents
  crinkleSealed: 0.00006,    // m, wrinkle amplitude while taut over the card
  crinkleEmpty: 0.0007,      // m, wrinkle amplitude of the empty bag
  // fridge
  snapDistance: 0.02,        // m, magnet back edge within this of the door → snap
  releaseDistance: 0.035,    // m, pull the pointer this far in front of the door → detach
  snapTime: 0.17,            // s, ease-in "pull" onto the door
  thunkAmp: 0.0006,          // m, rebound of the impact
  fridgeFollow: 16,          // 1/s, sliding on the door (a little friction)
  // misc
  resetTime: 1.1,            // s, animated repack (0 = instant)
  shadowOpacity: 0.42,       // contact-shadow strength
});

const HINTS = {
  sealed: '拖动（或轻点）袋子底部的封口贴，把它撕开',
  flapOpen: '顺着袋子的方向把卡纸拖出来（或轻点卡纸）',
  cardOut: '拖动卡纸的上沿，绕底部折痕把它翻开（或轻点卡纸）',
  cardOpen: '把透明泡壳从卡纸上拿起来（拖动或轻点泡壳）',
  blisterFree: '拖动（或轻点）泡壳里的冰箱贴，把它取出来',
  magnetFree: '捏住边缘拿起冰箱贴，拖向后面的铁板可以吸住；双指轻弯，松手回弹。双击可翻面。',
  onFridge: '冰箱贴已吸住铁板：拖动可以移动，拖离铁板就能拿下来。',
  flipBlocked: '先把泡壳拿下来，再给卡纸翻面',
  fridgeFlip: '先把冰箱贴从冰箱门上取下来，再翻面',
  closeFlipped: '把卡纸翻回内页朝上，才能合上',
  peelFirst: '先撕开袋子底部的封口贴',
};

// ---------------------------------------------------------------------------
// small helpers (no THREE needed)
// ---------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOutSine = (t) => -(Math.cos(PI * t) - 1) / 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polyArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[i], r = p[(i + 1) % n];
    a += q[0] * r[1] - r[0] * q[1];
  }
  return a * 0.5;
}
function ensureCCW(p) { if (polyArea(p) < 0) p.reverse(); return p; }
function polyBounds(p) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of p) {
    if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
  }
  return { minX, minY, maxX, maxY };
}
function resampleClosed(p, step) {
  const n = p.length, L = [0];
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n];
    L.push(L[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = L[n], m = Math.max(12, Math.round(total / step)), out = [];
  let seg = 0;
  for (let k = 0; k < m; k++) {
    const s = (k * total) / m;
    while (seg < n - 1 && L[seg + 1] < s) seg++;
    const a = p[seg], b = p[(seg + 1) % n];
    const t = (s - L[seg]) / Math.max(1e-12, L[seg + 1] - L[seg]);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
function smoothClosed(p, iters, lam) {
  let a = p.map((q) => [q[0], q[1]]);
  for (let it = 0; it < iters; it++) {
    const n = a.length, b = new Array(n);
    for (let i = 0; i < n; i++) {
      const pr = a[(i - 1 + n) % n], c = a[i], nx = a[(i + 1) % n];
      b[i] = [c[0] + lam * ((pr[0] + nx[0]) * 0.5 - c[0]), c[1] + lam * ((pr[1] + nx[1]) * 0.5 - c[1])];
    }
    a = b;
  }
  return a;
}
/** outward unit normals of a CCW polygon, interleaved [nx0, ny0, nx1, ...] */
function vertexNormals2D(p) {
  const n = p.length, out = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e2x = c[0] - b[0], e2y = c[1] - b[1];
    const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
    let nx = e1y / l1 + e2y / l2, ny = -e1x / l1 - e2x / l2;
    const l = Math.hypot(nx, ny) || 1;
    out[i * 2] = nx / l; out[i * 2 + 1] = ny / l;
  }
  return out;
}
function circlePoly(cx, cy, r, seg) {
  const out = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * PI * 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return out;
}
function roundedRectPoly(cx, cy, w, h, r, segPerCorner) {
  const out = [], hw = w / 2, hh = h / 2;
  const corners = [[hw - r, -hh + r, -HALF_PI], [hw - r, hh - r, 0], [-hw + r, hh - r, HALF_PI], [-hw + r, -hh + r, PI]];
  for (const [x, y, a0] of corners) {
    for (let k = 0; k <= segPerCorner; k++) {
      const a = a0 + (k / segPerCorner) * HALF_PI;
      out.push([cx + x + Math.cos(a) * r, cy + y + Math.sin(a) * r]);
    }
  }
  return out; // CCW
}

/** Signed distance field of a closed polygon on a regular grid (negative inside). */
function computeSDF(poly, x0, y0, nx, ny, h, band) {
  const d = new Float32Array(nx * ny).fill(band);
  const n = poly.length;
  for (let s = 0; s < n; s++) {
    const ax = poly[s][0], ay = poly[s][1], bx = poly[(s + 1) % n][0], by = poly[(s + 1) % n][1];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - band - x0) / h));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx) + band - x0) / h));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - band - y0) / h));
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by) + band - y0) / h));
    const ex = bx - ax, ey = by - ay, ee = ex * ex + ey * ey || 1e-18;
    for (let j = j0; j <= j1; j++) {
      const py = y0 + j * h;
      for (let i = i0; i <= i1; i++) {
        const px = x0 + i * h;
        let t = ((px - ax) * ex + (py - ay) * ey) / ee;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + ex * t - px, qy = ay + ey * t - py;
        const dd = Math.sqrt(qx * qx + qy * qy), k = j * nx + i;
        if (dd < d[k]) d[k] = dd;
      }
    }
  }
  const xs = [];
  for (let j = 0; j < ny; j++) {
    const py = y0 + j * h;
    xs.length = 0;
    for (let s = 0; s < n; s++) {
      const a = poly[s], b = poly[(s + 1) % n];
      if ((a[1] <= py && b[1] > py) || (b[1] <= py && a[1] > py)) xs.push(a[0] + ((py - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((u, v) => u - v);
    for (let q = 0; q + 1 < xs.length; q += 2) {
      const i0 = Math.max(0, Math.ceil((xs[q] - x0) / h)), i1 = Math.min(nx - 1, Math.floor((xs[q + 1] - x0) / h));
      for (let i = i0; i <= i1; i++) d[j * nx + i] = -d[j * nx + i];
    }
  }
  return d;
}

/** Marching squares: iso-contours of a grid field as closed polylines. */
function marchingSquares(f, nx, ny, x0, y0, h, iso) {
  const pts = new Map(), adj = new Map();
  const edgePoint = (i, j, dir) => {
    const key = (j * nx + i) * 2 + dir;
    if (!pts.has(key)) {
      const a = f[j * nx + i], b = dir === 0 ? f[j * nx + i + 1] : f[(j + 1) * nx + i];
      const t = clamp((iso - a) / (b - a), 0, 1);
      pts.set(key, dir === 0 ? [x0 + (i + t) * h, y0 + j * h] : [x0 + i * h, y0 + (j + t) * h]);
    }
    return key;
  };
  const link = (k1, k2) => {
    if (!adj.has(k1)) adj.set(k1, []);
    if (!adj.has(k2)) adj.set(k2, []);
    adj.get(k1).push(k2); adj.get(k2).push(k1);
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const v0 = f[j * nx + i], v1 = f[j * nx + i + 1], v2 = f[(j + 1) * nx + i + 1], v3 = f[(j + 1) * nx + i];
      let c = 0;
      if (v0 < iso) c |= 1; if (v1 < iso) c |= 2; if (v2 < iso) c |= 4; if (v3 < iso) c |= 8;
      if (c === 0 || c === 15) continue;
      const E = (e) => (e === 0 ? edgePoint(i, j, 0) : e === 1 ? edgePoint(i + 1, j, 1) : e === 2 ? edgePoint(i, j + 1, 0) : edgePoint(i, j, 1));
      switch (c) {
        case 1: case 14: link(E(3), E(0)); break;
        case 2: case 13: link(E(0), E(1)); break;
        case 3: case 12: link(E(3), E(1)); break;
        case 4: case 11: link(E(1), E(2)); break;
        case 6: case 9: link(E(0), E(2)); break;
        case 7: case 8: link(E(3), E(2)); break;
        case 5: case 10: {
          const centerIn = (v0 + v1 + v2 + v3) * 0.25 < iso;
          if ((c === 5) === centerIn) { link(E(3), E(2)); link(E(0), E(1)); } else { link(E(3), E(0)); link(E(1), E(2)); }
          break;
        }
      }
    }
  }
  const loops = [], seen = new Set();
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    const loop = [];
    let prev = -1, cur = start;
    while (cur !== undefined && !seen.has(cur)) {
      seen.add(cur); loop.push(pts.get(cur));
      const nb = adj.get(cur);
      const next = nb[0] !== prev ? nb[0] : nb[1];
      prev = cur; cur = next;
    }
    if (loop.length > 3) loops.push(loop);
  }
  return loops;
}

function bilinear(f, nx, ny, fx, fy, outside) {
  if (fx < 0 || fy < 0 || fx > nx - 1 || fy > ny - 1) return outside;
  let i = Math.floor(fx), j = Math.floor(fy);
  if (i >= nx - 1) i = nx - 2; if (j >= ny - 1) j = ny - 2;
  const tx = fx - i, ty = fy - j, k = j * nx + i;
  return (f[k] * (1 - tx) + f[k + 1] * tx) * (1 - ty) + (f[k + nx] * (1 - tx) + f[k + nx + 1] * tx) * ty;
}

/** max-plus "cone" dilation: F[p] = max_q F[q] - k |p - q| (chamfer, two passes) */
function coneDilate(F, nx, ny, h, k) {
  const a = k * h, b = k * h * Math.SQRT2;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const q = j * nx + i; let v = F[q];
      if (i > 0 && F[q - 1] - a > v) v = F[q - 1] - a;
      if (j > 0) {
        if (F[q - nx] - a > v) v = F[q - nx] - a;
        if (i > 0 && F[q - nx - 1] - b > v) v = F[q - nx - 1] - b;
        if (i < nx - 1 && F[q - nx + 1] - b > v) v = F[q - nx + 1] - b;
      }
      F[q] = v;
    }
  }
  for (let j = ny - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const q = j * nx + i; let v = F[q];
      if (i < nx - 1 && F[q + 1] - a > v) v = F[q + 1] - a;
      if (j < ny - 1) {
        if (F[q + nx] - a > v) v = F[q + nx] - a;
        if (i < nx - 1 && F[q + nx + 1] - b > v) v = F[q + nx + 1] - b;
        if (i > 0 && F[q + nx - 1] - b > v) v = F[q + nx - 1] - b;
      }
      F[q] = v;
    }
  }
}

/** 2D oriented box overlap (separating axis theorem). Boxes: {x, z, c, s, hx, hz}. */
function obbOverlap(A, B) {
  // A axes: (c, -s) and (s, c) [three.js yaw]
  const ax1x = A.c, ax1z = -A.s, ax2x = A.s, ax2z = A.c;
  const bx1x = B.c, bx1z = -B.s, bx2x = B.s, bx2z = B.c;
  const dx = B.x - A.x, dz = B.z - A.z;
  const axes = [ax1x, ax1z, ax2x, ax2z, bx1x, bx1z, bx2x, bx2z];
  for (let k = 0; k < 8; k += 2) {
    const lx = axes[k], lz = axes[k + 1];
    const ra = A.hx * Math.abs(ax1x * lx + ax1z * lz) + A.hz * Math.abs(ax2x * lx + ax2z * lz);
    const rb = B.hx * Math.abs(bx1x * lx + bx1z * lz) + B.hz * Math.abs(bx2x * lx + bx2z * lz);
    if (Math.abs(dx * lx + dz * lz) > ra + rb) return false;
  }
  return true;
}

// ============================================================================
// factory
// ============================================================================
export async function createMagnetScene(ctx, opts = {}) {
  const THREE = ctx.THREE;
  if (!THREE) throw new Error('createMagnetScene: ctx.THREE is required');
  const T = Object.assign({}, MAGNET_SCENE_TUNABLES, opts.tunables || {});
  const assetsBase = ctx.assetsBase || '/assets/';
  const lowQ = ctx.quality === 'low';
  const onHint = typeof ctx.onHint === 'function' ? ctx.onHint : null;
  const onEvent = typeof opts.onEvent === 'function' ? opts.onEvent : null;
  const maxAniso = Math.min(8, (ctx.renderer && ctx.renderer.capabilities && ctx.renderer.capabilities.getMaxAnisotropy && ctx.renderer.capabilities.getMaxAnisotropy()) || 4);

  // ---- temporaries (reused; nothing is allocated per frame) ----
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
  const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _q4 = new THREE.Quaternion();
  const _m1 = new THREE.Matrix4(), _groupInv = new THREE.Matrix4();
  const _ptr = new THREE.Vector3(); // pointer position handed to state changes (never a scratch temp)
  const _e1 = new THREE.Euler();
  const _rayL = new THREE.Ray(), _rayC = new THREE.Ray();
  const _hits = [];
  const AX_X = new THREE.Vector3(1, 0, 0), AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1);
  const Q_ART = new THREE.Quaternion().setFromAxisAngle(AX_X, -HALF_PI);
  const Q_ART_INV = Q_ART.clone().invert();

  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  const group = new THREE.Group();
  group.name = 'magnetScene';
  if (opts.position) {
    const p = opts.position;
    if (Array.isArray(p)) group.position.set(p[0] || 0, p[1] || 0, p[2] || 0); else group.position.copy(p);
  }
  ctx.scene.add(group);

  // ==========================================================================
  // assets
  // ==========================================================================
  const texLoader = new THREE.TextureLoader();
  async function loadTexture(rel) {
    try {
      const t = await texLoader.loadAsync(assetsBase + rel);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      return track(t);
    } catch (err) {
      console.warn('[magnet_scene] could not load texture', rel, err);
      const t = new THREE.DataTexture(new Uint8Array([232, 232, 232, 255]), 1, 1);
      t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      return track(t);
    }
  }
  const specRes = await fetch(assetsBase + 'magnet_spec.json');
  if (!specRes.ok) throw new Error('magnet_scene: cannot load magnet_spec.json (' + specRes.status + ')');
  const spec = await specRes.json();
  const SM = spec.magnet, SC = spec.card, SB = spec.blister, SG = spec.bag;
  const [texMagF, texMagB, texCardF, texCardB, texCardIF, texCardIB, texHeader] = await Promise.all([
    loadTexture(SM.front_texture.file), loadTexture(SM.back_texture.file),
    loadTexture(SC.front_outside_texture.file), loadTexture(SC.back_outside_texture.file),
    loadTexture(SC.inside_front_texture.file), loadTexture(SC.inside_back_texture.file),
    loadTexture(SG.header_front_texture.file),
  ]);
  const imgW = (t, d) => (t.image && t.image.width) || d;
  const imgH = (t, d) => (t.image && t.image.height) || d;

  // ==========================================================================
  // dimensions (metres)
  // ==========================================================================
  const magScale = Number.isFinite(opts.magnetScale) ? opts.magnetScale : 1;
  const thk = SM.thickness_mm;
  const zSheet = thk.magnet_sheet * MM;                 // rubber magnet sheet: z ∈ [0, zSheet]
  const zBodyTop = zSheet + thk.metal_body * MM;        // die-cast body top (rim plane)
  const domeH = thk.epoxy_dome * MM;                    // epoxy dome (in the clearcoat normal map)
  const zArt = zBodyTop + Math.min(0.06 * MM, domeH);   // flat print/epoxy plane just above the rim
  const rimW = SM.rim_mm * MM;
  const sheetInset = SM.magnet_sheet_inset_mm * MM;
  const edgeR = Math.min(0.3 * MM, rimW * 0.55);        // rounded front edge of the metal body

  const cardW = SC.panel_mm[0] * MM, cardH = SC.panel_mm[1] * MM, cardT = SC.thickness_mm * MM;
  const flT = SB.sheet_thickness_mm * MM;
  // card art frame: x centred, y from the fold (0) to the top (cardH), z from the back panel's outer face
  const zBackIn = cardT, zFrontIn = cardT + flT, zFrontOut = 2 * cardT + flT;
  const zHinge = zFrontOut / 2;                         // fold axis (between the panels)
  const bubbleH = SB.bubble.height_mm * MM;
  const zBubbleTop = zBackIn + bubbleH;
  const magC = opts.magnetCenter
    ? [opts.magnetCenter[0] - cardW / 2, opts.magnetCenter[1]]
    : [SC.magnet_center_in_front_panel_m[0] - cardW / 2, SC.magnet_center_in_front_panel_m[1]];
  const peekR = (SC.peek_hole.diameter_mm * MM) / 2;
  const peekC = [cardW / 2 - SC.peek_hole.center_in_back_panel_from_top_left_mm[0] * MM,
    cardH - SC.peek_hole.center_in_back_panel_from_top_left_mm[1] * MM]; // read from behind → mirror x
  const peekCx = peekC[0] - 0 /* already centred */;

  const flangeW = SB.flange_mm[0] * MM, flangeH = SB.flange_mm[1] * MM, flangeR = SB.flange_corner_radius_mm * MM;

  const bagW = SG.size_mm[0] * MM, bagL = SG.size_mm[1] * MM;
  const headerH = SG.header_height_mm * MM, sealH = SG.seal_band_mm * MM, flapL = SG.bottom_flap_mm * MM;
  const yTop = bagL / 2, yBottom = -bagL / 2;
  const yHeaderBottom = yTop - headerH, ySealBottom = yHeaderBottom - sealH;
  const cardTopGap = 2 * MM;
  const cardFoldY0 = ySealBottom - cardTopGap - cardH;   // card fold (art y) inside the bag at slide 0
  const zCardInBag = 0.045 * MM;
  const sFree = ySealBottom - cardTopGap - yBottom + T.slideMargin;
  const zFilmBase = 0.06 * MM;

  // layout (group-local). Defaults match the keepsake app: table 0.92 × 0.56 m centred on the
  // origin, plush stand at x ≈ -0.13 (so loose items stay at x > -0.06), package at opts.origin.
  const toArr = (p, d) => (p ? (Array.isArray(p) ? p : [p.x, p.y, p.z]) : d);
  const origin = toArr(opts.origin, [0.12, 0, 0.02]);
  const tableB = Object.assign({ minX: -0.06, maxX: 0.46, minZ: -0.28, maxZ: 0.28 }, opts.table || {}, opts.area || {});
  const F = Object.assign({ enabled: true, x: 0.22, z: -0.24, width: 0.3, height: 0.4, below: 0, depth: 0.04, handle: true }, opts.fridge || {});
  const pkg = Object.assign({ x: origin[0], z: origin[2], yaw: 0 }, opts.package || {});

  // ==========================================================================
  // magnet outline, signed distance field, offset contours
  // ==========================================================================
  let outline = SM.outline_m.map((p) => [p[0] * magScale, p[1] * magScale]);
  ensureCCW(outline);
  outline = ensureCCW(smoothClosed(resampleClosed(outline, (lowQ ? 0.45 : 0.3) * MM), 2, 0.45));
  const ob = polyBounds(outline);
  const magHalfX = Math.max(-ob.minX, ob.maxX), magHalfY = Math.max(-ob.minY, ob.maxY);

  const sdfH = (lowQ ? 0.3 : 0.18) * MM, sdfBand = 6 * MM, sdfPad = 5 * MM;
  const sdfX0 = ob.minX - sdfPad, sdfY0 = ob.minY - sdfPad;
  const sdfNX = Math.ceil((ob.maxX - ob.minX + 2 * sdfPad) / sdfH) + 1;
  const sdfNY = Math.ceil((ob.maxY - ob.minY + 2 * sdfPad) / sdfH) + 1;
  const sdf = computeSDF(outline, sdfX0, sdfY0, sdfNX, sdfNY, sdfH, sdfBand);
  const sdfAt = (x, y) => bilinear(sdf, sdfNX, sdfNY, (x - sdfX0) / sdfH, (y - sdfY0) / sdfH, sdfBand);
  function contourAt(iso, step, smoothIters = 1) {
    const loops = marchingSquares(sdf, sdfNX, sdfNY, sdfX0, sdfY0, sdfH, iso);
    let best = null, ba = 0;
    for (const l of loops) { const a = Math.abs(polyArea(l)); if (a > ba) { ba = a; best = l; } }
    if (!best) return outline.map((q) => [q[0], q[1]]);
    return ensureCCW(smoothClosed(resampleClosed(best, step), smoothIters, 0.5));
  }
  const innerRim = contourAt(-rimW, 0.3 * MM);
  const sheetC = contourAt(-sheetInset, 0.3 * MM);
  const bubbleBase = ensureCCW(smoothClosed(contourAt(SB.bubble.base_offset_mm * MM, 0.35 * MM), 3, 0.5));

  // texture mapping of the magnet (spec: ppm, centre pixel = outline bbox centre)
  const fW = imgW(texMagF, 1548), fH = imgH(texMagF, 1535), bW = imgW(texMagB, 1548), bH = imgH(texMagB, 1535);
  const fppm = SM.front_texture.ppm / magScale, bppm = SM.back_texture.ppm / magScale;
  const fcx = SM.front_texture.center_px[0], fcy = SM.front_texture.center_px[1];
  const bcx = SM.back_texture.center_px[0], bcy = SM.back_texture.center_px[1];
  const uvMagFront = (x, y) => [(fcx + (x / MM) * fppm) / fW, 1 - (fcy - (y / MM) * fppm) / fH];
  const uvMagBack = (x, y) => [(bcx - (x / MM) * bppm) / bW, 1 - (bcy - (y / MM) * bppm) / bH];

  // ==========================================================================
  // geometry builder
  // ==========================================================================
  class GB {
    constructor(withColor = 0) { this.p = []; this.n = []; this.uv = []; this.c = withColor ? [] : null; this.cs = withColor; this.i = []; this.groups = []; this.gs = 0; this.gm = -1; }
    vert(x, y, z, nx, ny, nz, u = 0, v = 0) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, v); return this.p.length / 3 - 1; }
    tri(a, b, c) { this.i.push(a, b, c); }
    quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
    mat(m) { this.close(); this.gs = this.i.length; this.gm = m; }
    close() { if (this.gm >= 0 && this.i.length > this.gs) this.groups.push([this.gs, this.i.length - this.gs, this.gm]); this.gm = -1; }
    build() {
      this.close();
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      if (this.c) g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, this.cs));
      g.setIndex(this.i);
      for (const [s, c, m] of this.groups) g.addGroup(s, c, m);
      g.computeBoundingBox(); g.computeBoundingSphere();
      return track(g);
    }
  }
  function triangulate(outer, holes) {
    const o = outer.map((p) => new THREE.Vector2(p[0], p[1]));
    const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p[0], p[1])));
    const faces = THREE.ShapeUtils.triangulateShape(o, hs);
    const verts = outer.concat(...holes), idx = [];
    for (const f of faces) {
      const a = verts[f[0]], b = verts[f[1]], c = verts[f[2]];
      const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (cr >= 0) idx.push(f[0], f[1], f[2]); else idx.push(f[0], f[2], f[1]);
    }
    return { verts, idx };
  }
  function addFace(gb, outer, holes, z, up, uvFn) {
    const { verts, idx } = triangulate(outer, holes);
    const base = gb.p.length / 3, nz = up ? 1 : -1;
    for (const v of verts) { const uv = uvFn ? uvFn(v[0], v[1]) : [0, 0]; gb.vert(v[0], v[1], z, 0, 0, nz, uv[0], uv[1]); }
    const midpoints = new Map();
    const mid = (a,b) => {
      const key = a < b ? a+':'+b : b+':'+a;
      if (midpoints.has(key)) return midpoints.get(key);
      const x=(gb.p[a*3]+gb.p[b*3])/2,y=(gb.p[a*3+1]+gb.p[b*3+1])/2;
      const uv=uvFn?uvFn(x,y):[0,0]; const m=gb.vert(x,y,z,0,0,nz,uv[0],uv[1]);midpoints.set(key,m);return m;
    };
    const split = (a,b,c,n) => {
      if (!n) { up?gb.tri(a,b,c):gb.tri(a,c,b); return; }
      const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);
      split(a,ab,ca,n-1);split(ab,b,bc,n-1);split(ca,bc,c,n-1);split(ab,bc,ca,n-1);
    };
    for (let k=0;k<idx.length;k+=3) split(base+idx[k],base+idx[k+1],base+idx[k+2],lowQ?1:2);
  }
  /** vertical wall along a CCW ring; isHole → faces into the hole */
  function addWall(gb, ring, z0, z1, isHole, sharpCos = 0.75) {
    const n = ring.length, sn = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = ring[i], b = ring[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      sn[i * 2] = (isHole ? -dy : dy) / l; sn[i * 2 + 1] = (isHole ? dx : -dx) / l;
    }
    const vn = (i, j) => { // normal at the shared vertex between segment i and j, smoothed if the corner is soft
      const ax = sn[i * 2], ay = sn[i * 2 + 1], bx = sn[j * 2], by = sn[j * 2 + 1];
      if (ax * bx + ay * by < sharpCos) return [ax, ay];
      const x = ax + bx, y = ay + by, l = Math.hypot(x, y) || 1; return [x / l, y / l];
    };
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = ring[i], b = ring[j];
      const na = vn(i, (i - 1 + n) % n), nb = vn(i, j);
      const v0 = gb.vert(a[0], a[1], z0, na[0], na[1], 0), v1 = gb.vert(b[0], b[1], z0, nb[0], nb[1], 0);
      const v2 = gb.vert(b[0], b[1], z1, nb[0], nb[1], 0), v3 = gb.vert(a[0], a[1], z1, na[0], na[1], 0);
      if (!isHole) gb.quad(v0, v1, v2, v3); else gb.quad(v0, v3, v2, v1);
    }
  }
  function buildSlab(outer, holes, z0, z1, uvTop, uvBottom, sharpCos) {
    const gb = new GB();
    gb.mat(0); addFace(gb, outer, holes, z1, true, uvTop);
    gb.mat(1); addFace(gb, outer, holes, z0, false, uvBottom);
    gb.mat(2); addWall(gb, outer, z0, z1, false, sharpCos); for (const h of holes) addWall(gb, h, z0, z1, true, sharpCos);
    return gb.build();
  }

  // ==========================================================================
  // procedural textures
  // ==========================================================================
  function dataTex(data, w, h, { srgb = false, repeat = false, mip = true } = {}) {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.generateMipmaps = mip;
    t.anisotropy = maxAniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.needsUpdate = true;
    return track(t);
  }
  /** epoxy dome normal map in the front texture's UV space (from the outline SDF) */
  function bakeDomeNormal() {
    const N = lowQ ? 256 : 512, data = new Uint8Array(N * N * 4);
    const x0 = (-fcx / fppm) * MM, x1 = ((fW - fcx) / fppm) * MM;
    const y0 = (-(fH - fcy) / fppm) * MM, y1 = (fcy / fppm) * MM;
    const w = 1.5 * MM, e2 = sdfH;
    for (let j = 0; j < N; j++) {
      const y = y0 + ((j + 0.5) / N) * (y1 - y0);
      for (let i = 0; i < N; i++) {
        const x = x0 + ((i + 0.5) / N) * (x1 - x0);
        let nx = 0, ny = 0, nz = 1;
        const e = -sdfAt(x, y) - rimW;
        if (e > -0.1 * MM && e < w) {
          const gx = (sdfAt(x + e2, y) - sdfAt(x - e2, y)) / (2 * e2), gy = (sdfAt(x, y + e2) - sdfAt(x, y - e2)) / (2 * e2);
          const ee = Math.max(0, e), s = ((2 * domeH) / w) * (1 - ee / w);
          nx = s * gx; ny = s * gy; const l = Math.hypot(nx, ny, 1); nx /= l; ny /= l; nz = 1 / l;
        }
        const k = (j * N + i) * 4;
        data[k] = Math.round((nx * 0.5 + 0.5) * 255); data[k + 1] = Math.round((ny * 0.5 + 0.5) * 255);
        data[k + 2] = Math.round((nz * 0.5 + 0.5) * 255); data[k + 3] = 255;
      }
    }
    return dataTex(data, N, N);
  }
  /** tileable wrinkle normal map (integer wave vectors → seamless) */
  function makeWrinkleNormal(size, seed, strength) {
    const rnd = mulberry32(seed), waves = [];
    for (let k = 0; k < 9; k++) {
      const a = rnd() * PI * 2, f = 1 + Math.floor(rnd() * 5);
      waves.push([Math.round(Math.cos(a) * f) || 1, Math.round(Math.sin(a) * f), rnd() * PI * 2, 0.4 + rnd()]);
    }
    const hgt = new Float32Array(size * size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      let h = 0;
      for (const [kx, ky, ph, am] of waves) h += am * Math.sin((2 * PI * (kx * i + ky * j)) / size + ph);
      // creases: sharpen the ridges a little
      hgt[j * size + i] = Math.sign(h) * Math.pow(Math.abs(h), 0.7);
    }
    const data = new Uint8Array(size * size * 4);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const hx = hgt[j * size + ((i + 1) % size)] - hgt[j * size + ((i - 1 + size) % size)];
      const hy = hgt[((j + 1) % size) * size + i] - hgt[((j - 1 + size) % size) * size + i];
      let nx = -hx * strength, ny = -hy * strength, nz = 1; const l = Math.hypot(nx, ny, nz);
      const k = (j * size + i) * 4;
      data[k] = ((nx / l) * 0.5 + 0.5) * 255; data[k + 1] = ((ny / l) * 0.5 + 0.5) * 255; data[k + 2] = ((nz / l) * 0.5 + 0.5) * 255; data[k + 3] = 255;
    }
    return dataTex(data, size, size, { repeat: true });
  }
  /** OPP film haze + side seams (alpha encodes how much the film hides what's behind) */
  function makeFilmTexture() {
    const w = 64, h = 128, data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w, v = (j + 0.5) / h;
      const seam = Math.max(1 - smoothstep(0.0, 0.03, Math.min(u, 1 - u)), 0.7 * (1 - smoothstep(0, 0.02, v)));
      const c = lerp(14, 236, seam), a = lerp(0.055, 0.34, seam);
      const k = (j * w + i) * 4; data[k] = data[k + 1] = data[k + 2] = c; data[k + 3] = Math.round(a * 255);
    }
    return dataTex(data, w, h, { srgb: true });
  }
  /** heat-seal band: serrated striations */
  function makeSealTextures() {
    const w = 512, h = 16, col = new Uint8Array(w * h * 4), nor = new Uint8Array(w * h * 4);
    const period = 6;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const ph = ((i % period) / period) * PI * 2;
      const tri = Math.abs(((i % period) / period) * 2 - 1); // triangle wave (serration)
      const edge = Math.min(j, h - 1 - j) < 1 ? 1 : 0;
      const k = (j * w + i) * 4;
      const c = lerp(150, 225, tri);
      col[k] = c; col[k + 1] = c; col[k + 2] = c + 4; col[k + 3] = Math.round((0.16 + 0.22 * (1 - tri) + 0.2 * edge) * 255);
      const nx = Math.cos(ph) * 0.55, l = Math.hypot(nx, 1);
      nor[k] = ((nx / l) * 0.5 + 0.5) * 255; nor[k + 1] = 128; nor[k + 2] = ((1 / l) * 0.5 + 0.5) * 255; nor[k + 3] = 255;
    }
    return { map: dataTex(col, w, h, { srgb: true }), normal: dataTex(nor, w, h) };
  }
  /** soft contact shadow sprite from a polygon (drawn with canvas blur) */
  function makeBlobTexture(polys, extentX, extentY, blurM) {
    const S = 256, cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const g = cv.getContext('2d');
    const sx = S / extentX, sy = S / extentY, off = 4000;
    g.fillStyle = '#000';
    g.shadowColor = 'rgba(0,0,0,1)';
    g.shadowBlur = Math.max(2, blurM * sx);
    g.shadowOffsetX = off;
    g.beginPath();
    for (const poly of polys) {
      poly.forEach((p, i) => {
        const x = S / 2 + p[0] * sx - off, y = S / 2 - p[1] * sy;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.closePath();
    }
    g.fill();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return track(t);
  }

  // ==========================================================================
  // materials
  // ==========================================================================
  /** thin transparent film (OPP / PET): additive specular, background × (1 − α) with Fresnel */
  function makeFilmMaterial({ alpha = 0.06, fresnel = 0.6, roughness = 0.05, ior = 1.5, map = null, normalMap = null, normalScale = 0.15, vertexColors = false, color = 0xffffff, envIntensity = 1, specular = 1 }) {
    const m = new THREE.MeshPhysicalMaterial({
      color, roughness, metalness: 0, ior, specularIntensity: specular, transparent: true, opacity: alpha,
      depthWrite: false, side: THREE.DoubleSide, map, normalMap, vertexColors, envMapIntensity: envIntensity,
    });
    if (normalMap) m.normalScale.set(normalScale, normalScale);
    m.blending = THREE.CustomBlending;
    m.blendEquation = THREE.AddEquation;
    m.blendSrc = THREE.OneFactor;
    m.blendDst = THREE.OneMinusSrcAlphaFactor;
    m.userData.fresnel = { value: fresnel };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uFilmFresnel = m.userData.fresnel;
      sh.fragmentShader = 'uniform float uFilmFresnel;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
        float filmNV = abs( dot( normalize( normal ), normalize( vViewPosition ) ) );
        float filmF = pow( 1.0 - filmNV, 5.0 );
        float filmA = clamp( diffuseColor.a + ( 1.0 - diffuseColor.a ) * filmF * uFilmFresnel, 0.0, 1.0 );
        gl_FragColor = vec4( outgoingLight - totalDiffuse * ( 1.0 - diffuseColor.a ), filmA );`);
    };
    m.customProgramCacheKey = () => 'keepsake-film';
    return track(m);
  }

  const domeNormal = bakeDomeNormal();
  const matRim = track(new THREE.MeshPhysicalMaterial({ color: 0xdfe0e3, metalness: 1, roughness: 0.22 }));
  // printed art under an epoxy dome: the print itself has (almost) no specular, the clearcoat
  // carries the gloss; env reflection is kept moderate so the colours stay vivid
  const matArt = track(new THREE.MeshPhysicalMaterial({
    map: texMagF, roughness: 0.55, metalness: 0, specularIntensity: 0.15, envMapIntensity: 0.75,
    clearcoat: 0.9, clearcoatRoughness: 0.035, clearcoatNormalMap: domeNormal,
  }));
  const matSheet = track(new THREE.MeshStandardMaterial({ map: texMagB, roughness: 0.84, metalness: 0 }));
  const matSheetSide = track(new THREE.MeshStandardMaterial({ color: 0x2b2421, roughness: 0.9 }));

  // alphaTest: the die-cut window / peek hole are cut in the geometry AND keyed by the texture alpha
  const matCardFront = track(new THREE.MeshPhysicalMaterial({ map: texCardF, roughness: 0.52, clearcoat: 0.28, clearcoatRoughness: 0.32, alphaTest: 0.5 }));
  const matCardFrontIn = track(new THREE.MeshStandardMaterial({ map: texCardIF, roughness: 0.86, alphaTest: 0.5 }));
  const matCardBack = track(new THREE.MeshPhysicalMaterial({ map: texCardB, roughness: 0.58, clearcoat: 0.18, clearcoatRoughness: 0.38 }));
  const matCardBackIn = track(new THREE.MeshStandardMaterial({ map: texCardIB, roughness: 0.86, alphaTest: 0.5 }));
  const matPaperEdge = track(new THREE.MeshStandardMaterial({ color: 0xe6e2d9, roughness: 0.93 }));
  const matHinge = track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }));

  // clear PET: almost no haze, thin crisp specular edges (low roughness, modest Fresnel opacity)
  const matPET = makeFilmMaterial({ alpha: 0.015, fresnel: 0.26, roughness: 0.04, ior: 1.57, envIntensity: 0.24, specular: 0.8 });
  // OPP: flat and glossy; only a very soft, long-wave surface undulation in the normal map
  const wrinkleN = makeWrinkleNormal(128, 11, 0.9);
  wrinkleN.repeat.set(0.7, 0.9);
  const filmTex = makeFilmTexture();
  const matFilmFront = makeFilmMaterial({ alpha: 1, fresnel: 0.28, roughness: 0.06, map: filmTex, normalMap: wrinkleN, normalScale: 0.025, envIntensity: 0.3, specular: 0.75 });
  const matFilmBack = makeFilmMaterial({ alpha: 1, fresnel: 0.25, roughness: 0.04, map: filmTex, envIntensity: 0.5, specular: 0.7 });
  const sealTex = makeSealTextures();
  const matSeal = makeFilmMaterial({ alpha: 1, fresnel: 0.5, roughness: 0.12, map: sealTex.map, normalMap: sealTex.normal, normalScale: 0.6 });
  const matFlap = makeFilmMaterial({ alpha: 1, fresnel: 0.3, roughness: 0.06, vertexColors: true, envIntensity: 0.4 });
  const matHeader = track(new THREE.MeshPhysicalMaterial({ map: texHeader, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.1, alphaTest: 0.5 }));
  const matHeaderBack = track(new THREE.MeshPhysicalMaterial({ map: texHeader, roughness: 0.34, clearcoat: 0.5, clearcoatRoughness: 0.12, alphaTest: 0.5 }));
  matHeaderBack.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.93 ), 0.62 );');
  };
  matHeaderBack.customProgramCacheKey = () => 'keepsake-header-back';
  const matHeaderEdge = track(new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.5 }));

  const matFridge = track(new THREE.MeshPhysicalMaterial({ color: 0xf1f1ef, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }));
  const matChrome = track(new THREE.MeshPhysicalMaterial({ color: 0xe8e8ea, metalness: 1, roughness: 0.12 }));
  const matCabinet = track(new THREE.MeshPhysicalMaterial({ color: 0xdcdcda, roughness: 0.35, clearcoat: 0.5, clearcoatRoughness: 0.2 }));
  const matGasket = track(new THREE.MeshStandardMaterial({ color: 0x2c2c2e, roughness: 0.85 }));
  const matProxy = track(new THREE.MeshBasicMaterial({ visible: false }));
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));

  // ==========================================================================
  // bodies
  // ==========================================================================
  function makeBody(name) {
    const root = new THREE.Group(); root.name = name;
    const fpw = [];
    for (let i = 0; i < 4; i++) fpw.push({ x: 0, z: 0, c: 1, s: 0, hx: 0, hz: 0 });
    return {
      name, root, loose: false, state: 'rest', x: 0, y: 0, z: 0, psi: 0, flipped: false, flipA: 0, flipFrom: 0, flipTo: 0, flipT: 1,
      base: 0, vy: 0, support: null, supTmp: null, tx: 0, tz: 0, vx: 0, vz: 0,
      tiltX: 0, tiltZ: 0, wX: 0, wZ: 0, tgtTX: 0, tgtTZ: 0, liftScale: 1,
      zMin: 0, zMax: 0, hw: 0, halfLen: 0, fps: [], fpw, ax0: 0, ax1: 0, az0: 0, az1: 0,
      anim: null, blendT: 1, blendDur: 0.15, blendP: new THREE.Vector3(), blendQ: new THREE.Quaternion(),
      shadow: null, shadowAlpha: 1, fr: null, proxies: [],
    };
  }
  const bag = makeBody('bag'), card = makeBody('card'), blister = makeBody('blister'), magnet = makeBody('magnet');
  const BODIES = [bag, card, blister, magnet];
  const pickables = [];
  function addProxy(parent, body, part, cx, cy, cz, sx, sy, sz) {
    const m = new THREE.Mesh(boxGeo, matProxy);
    m.position.set(cx, cy, cz); m.scale.set(sx, sy, sz);
    m.userData.pick = { body, part };
    parent.add(m); pickables.push(m); body.proxies.push(m);
    return m;
  }
  const transparentMeshes = []; // { mesh, local: Vector3 } for height-based render ordering
  function regTransparent(mesh, x, y, z) { transparentMeshes.push({ mesh, local: new THREE.Vector3(x, y, z) }); }

  // --------------------------------------------------------------------------
  // magnet
  // --------------------------------------------------------------------------
  {
    const ring0 = outline, nrm = vertexNormals2D(ring0), n = ring0.length;
    const metal = new GB();
    const rings = [[0, zSheet, 1, 0], [0, zBodyTop - edgeR, 1, 0]];
    const K = lowQ ? 2 : 4;
    for (let k = 1; k <= K; k++) {
      const a = (k / K) * HALF_PI;
      rings.push([edgeR * (1 - Math.cos(a)), zBodyTop - edgeR + edgeR * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
    const starts = [];
    for (const [d, z, ch, cv] of rings) {
      starts.push(metal.p.length / 3);
      for (let i = 0; i < n; i++) {
        const nx = nrm[i * 2], ny = nrm[i * 2 + 1];
        metal.vert(ring0[i][0] - nx * d, ring0[i][1] - ny * d, z, nx * ch, ny * ch, cv);
      }
    }
    for (let r = 0; r + 1 < rings.length; r++) {
      const A = starts[r], B = starts[r + 1];
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; metal.quad(A + i, A + j, B + j, B + i); }
    }
    const ringR = ring0.map((p, i) => [p[0] - nrm[i * 2] * edgeR, p[1] - nrm[i * 2 + 1] * edgeR]);
    addFace(metal, ringR, [innerRim], zBodyTop, true, null);   // flat rim top
    addFace(metal, ring0, [sheetC], zSheet, false, null);       // exposed back of the body around the sheet
    const art = new GB(); addFace(art, innerRim, [], zArt, true, uvMagFront);
    const sb = new GB(); addFace(sb, sheetC, [], 0, false, uvMagBack);
    const ss = new GB(); addWall(ss, sheetC, 0, zSheet, false, 0.5);
    const meshes = [
      new THREE.Mesh(metal.build(), matRim), new THREE.Mesh(art.build(), matArt),
      new THREE.Mesh(sb.build(), matSheet), new THREE.Mesh(ss.build(), matSheetSide),
    ];
    for (const m of meshes) { m.castShadow = true; m.receiveShadow = true; magnet.root.add(m); }
    magnet.meshes = meshes;
    // pick proxy: a decimated prism of the outline
    const dec = resampleClosed(outline, 1.2 * MM);
    const shape = new THREE.Shape(dec.map((p) => new THREE.Vector2(p[0], p[1])));
    const pg = track(new THREE.ExtrudeGeometry(shape, { depth: zArt, bevelEnabled: false, curveSegments: 1 }));
    const pm = new THREE.Mesh(pg, matProxy); pm.userData.pick = { body: magnet, part: 'magnet' };
    magnet.root.add(pm); pickables.push(pm); magnet.proxies.push(pm);
  }

  // --------------------------------------------------------------------------
  // blister (clear PET): rounded-rect flange + bubble following the magnet
  // --------------------------------------------------------------------------
  const blisterProfile = []; // [δ inward from the base contour, height] in metres (outer surface)
  let bubbleBox = null;
  {
    const W = (SB.bubble.base_offset_mm - SB.bubble.top_offset_mm) * MM;
    const Hh = bubbleH, rt = Math.min(SB.bubble.top_edge_radius_mm * MM, W * 0.95, Hh * 0.4), rb = 0.35 * MM;
    const prof = []; // [δ, h, nδ, nh] ; normal expressed as (component along +δ, component along +h)
    const nb = lowQ ? 2 : 4, nt = lowQ ? 3 : 7;
    for (let k = 0; k <= nb; k++) { const a = (k / nb) * HALF_PI; prof.push([-rb + rb * Math.sin(a), rb - rb * Math.cos(a), -Math.sin(a), Math.cos(a)]); }
    { // straight (drafted) wall
      const d0 = 0, h0 = rb, d1 = W - rt, h1 = Hh - rt, dl = Math.hypot(d1 - d0, h1 - h0);
      prof.push([lerp(d0, d1, 0.5), lerp(h0, h1, 0.5), -(h1 - h0) / dl, (d1 - d0) / dl]);
    }
    for (let k = 0; k <= nt; k++) { const a = (k / nt) * HALF_PI; prof.push([W - rt * Math.cos(a), Hh - rt + rt * Math.sin(a), -Math.cos(a), Math.sin(a)]); }
    for (const p of prof) blisterProfile.push([p[0], p[1]]);
    const zMid = (h) => flT / 2 + (h / Hh) * (Hh - flT);
    const C0 = bubbleBase, nrm = vertexNormals2D(C0), n = C0.length;
    const gb = new GB();
    const starts = [];
    for (const [d, h, nd, nh] of prof) {
      starts.push(gb.p.length / 3);
      for (let i = 0; i < n; i++) {
        const nx = nrm[i * 2], ny = nrm[i * 2 + 1];
        gb.vert(C0[i][0] - nx * d, C0[i][1] - ny * d, zMid(h), -nx * nd, -ny * nd, nh);
      }
    }
    for (let r = 0; r + 1 < prof.length; r++) {
      const A = starts[r], B = starts[r + 1];
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; gb.quad(A + i, A + j, B + j, B + i); }
    }
    const last = prof[prof.length - 1][0];
    const top = C0.map((p, i) => [p[0] - nrm[i * 2] * last, p[1] - nrm[i * 2 + 1] * last]);
    addFace(gb, top, [], zMid(Hh), true, null);
    const first = prof[0][0];
    const hole = C0.map((p, i) => [p[0] - nrm[i * 2] * first, p[1] - nrm[i * 2 + 1] * first]);
    const rect = roundedRectPoly(0, 0, flangeW, flangeH, flangeR, lowQ ? 3 : 6);
    addFace(gb, rect, [hole], zMid(0), true, null);
    addWall(gb, rect, 0, flT, false, 0.7);
    const mesh = new THREE.Mesh(gb.build(), matPET);
    mesh.renderOrder = 2;
    blister.root.add(mesh);
    blister.mesh = mesh;
    regTransparent(mesh, 0, 0, Hh * 0.5);
    const bb = polyBounds(C0);
    bubbleBox = bb;
    addProxy(blister.root, blister, 'flange', 0, 0, flT / 2, flangeW, flangeH, flT * 2);
    addProxy(blister.root, blister, 'bubble', (bb.minX + bb.maxX) / 2, (bb.minY + bb.maxY) / 2, Hh / 2, bb.maxX - bb.minX, bb.maxY - bb.minY, Hh);
  }
  function bubbleOuterHeight(d) { // outer bubble height above the flange bottom for SDF distance d
    const δ = SB.bubble.base_offset_mm * MM - d, P = blisterProfile;
    if (δ <= P[0][0]) return 0;
    if (δ >= P[P.length - 1][0]) return bubbleH;
    for (let k = 1; k < P.length; k++) {
      if (δ <= P[k][0]) { const t = (δ - P[k - 1][0]) / Math.max(1e-9, P[k][0] - P[k - 1][0]); return lerp(P[k - 1][1], P[k][1], t); }
    }
    return bubbleH;
  }

  // --------------------------------------------------------------------------
  // folded backing card: two panels hinged at the bottom fold
  // --------------------------------------------------------------------------
  card.frontPivot = new THREE.Group(); card.backPivot = new THREE.Group();
  card.frontPivot.position.set(0, 0, zHinge); card.backPivot.position.set(0, 0, zHinge);
  card.root.add(card.backPivot, card.frontPivot);
  const windowPoly = ensureCCW(smoothClosed(resampleClosed(SC.window_polygon_m.map((p) => [p[0] - cardW / 2, p[1]]), 0.35 * MM), 3, 0.5));
  const windowBox = polyBounds(windowPoly);
  let hingeColorFront = [0.72, 0.85, 0.87];
  try { // sample the front print right at the fold for the bent paper strip
    const img = texCardF.image, cv = document.createElement('canvas'); cv.width = 32; cv.height = 4;
    const g2 = cv.getContext('2d'); g2.drawImage(img, 0, img.height - 6, img.width, 6, 0, 0, 32, 4);
    const d = g2.getImageData(0, 0, 32, 4).data; let r = 0, gg = 0, b = 0, c = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; c++; }
    if (c) hingeColorFront = [r / c / 255, gg / c / 255, b / c / 255].map((v) => Math.pow(v, 2.2));
  } catch (e) { /* keep default */ }
  {
    const rect = [[-cardW / 2, 0], [cardW / 2, 0], [cardW / 2, cardH], [-cardW / 2, cardH]];
    const u = (x) => (x + cardW / 2) / cardW, v = (y) => y / cardH;
    const fg = buildSlab(rect, [windowPoly], zFrontIn - zHinge, zFrontOut - zHinge,
      (x, y) => [u(x), v(y)], (x, y) => [1 - u(x), v(y)], 0.6);
    const peek = ensureCCW(circlePoly(peekCx, peekC[1], peekR, lowQ ? 40 : 72));
    const bg = buildSlab(rect, [peek], -zHinge, zBackIn - zHinge,
      (x, y) => [u(x), v(y)], (x, y) => [1 - u(x), v(y)], 0.6);
    const fm = new THREE.Mesh(fg, [matCardFront, matCardFrontIn, matPaperEdge]);
    const bm = new THREE.Mesh(bg, [matCardBackIn, matCardBack, track(matPaperEdge.clone())]); // own material → own bend uniforms
    for (const m of [fm, bm]) { m.castShadow = true; m.receiveShadow = true; }
    card.frontPivot.add(fm); card.backPivot.add(bm);
    addProxy(card.frontPivot, card, 'front', 0, cardH / 2, (zFrontIn + zFrontOut) / 2 - zHinge, cardW, cardH, Math.max(cardT, 0.6 * MM));
    addProxy(card.backPivot, card, 'back', 0, cardH / 2, zBackIn / 2 - zHinge, cardW, cardH, Math.max(cardT, 0.6 * MM));
    // the paper bent around the fold (rebuilt when the hinge moves)
    const N = 12, verts = (N + 1) * 4;
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    hg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
    const col = new Float32Array(verts * 3);
    for (let k = 0; k <= N; k++) {
      const t = k / N, c0 = [lerp(0.86, hingeColorFront[0], t), lerp(0.86, hingeColorFront[1], t), lerp(0.85, hingeColorFront[2], t)];
      for (let s = 0; s < 2; s++) { col.set(c0, ((k * 4) + s) * 3); col.set([0.86, 0.86, 0.85], ((k * 4) + 2 + s) * 3); }
    }
    hg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const idx = [];
    for (let k = 0; k < N; k++) {
      const a = k * 4, b = (k + 1) * 4;
      idx.push(a, a + 1, b + 1, a, b + 1, b);           // outer surface
      idx.push(a + 2, b + 2, b + 3, a + 2, b + 3, a + 3); // inner surface
    }
    hg.setIndex(idx);
    track(hg);
    card.hingeGeo = hg; card.hingeN = N;
    const hm = new THREE.Mesh(hg, matHinge); hm.castShadow = true; hm.receiveShadow = true; hm.frustumCulled = false;
    card.root.add(hm);
  }
  function updateHingeStrip(fa, ba) {
    const g = card.hingeGeo, N = card.hingeN, P = g.attributes.position.array, Nn = g.attributes.normal.array;
    const aB = -HALF_PI + ba, span = Math.max(0, PI + ba - fa);
    const Ro = zHinge, Ri = zHinge - zBackIn;
    for (let k = 0; k <= N; k++) {
      const a = aB - (span * k) / N, c = Math.cos(a), s = Math.sin(a);
      for (let q = 0; q < 4; q++) {
        const outer = q < 2, x = (q % 2 === 0 ? -1 : 1) * (cardW / 2), R = outer ? Ro : Ri, o = (k * 4 + q) * 3;
        P[o] = x; P[o + 1] = c * R; P[o + 2] = zHinge + s * R;
        Nn[o] = 0; Nn[o + 1] = outer ? c : -c; Nn[o + 2] = outer ? s : -s;
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
  }

  // --------------------------------------------------------------------------
  // OPP header bag
  // --------------------------------------------------------------------------
  bag.tilt = new THREE.Group(); bag.tilt.position.set(0, yTop, 0);
  bag.content = new THREE.Group(); bag.content.position.set(0, -yTop, 0);
  bag.root.add(bag.tilt); bag.tilt.add(bag.content);
  {
    // printed header with the hang hole
    const rect = [[-bagW / 2, yHeaderBottom], [bagW / 2, yHeaderBottom], [bagW / 2, yTop], [-bagW / 2, yTop]];
    const hh = SG.hang_hole;
    const holeX = Number.isFinite(hh.center_from_left_mm) ? hh.center_from_left_mm * MM - bagW / 2 : 0;
    const hole = ensureCCW(circlePoly(holeX, yTop - hh.center_from_top_mm * MM, (hh.diameter_mm * MM) / 2, lowQ ? 32 : 56));
    const uvH = (x, y) => [(x + bagW / 2) / bagW, (y - yHeaderBottom) / headerH];
    const hg = buildSlab(rect, [hole], 0.02 * MM, 0.14 * MM, uvH, uvH, 0.6);
    const hm = new THREE.Mesh(hg, [matHeader, matHeaderBack, matHeaderEdge]);
    hm.castShadow = true; hm.receiveShadow = true;
    bag.content.add(hm);
    // heat-seal band
    const sg = new GB();
    const a = sg.vert(-bagW / 2, ySealBottom, 0.09 * MM, 0, 0, 1, 0, 0), b = sg.vert(bagW / 2, ySealBottom, 0.09 * MM, 0, 0, 1, 1, 0);
    const c = sg.vert(bagW / 2, yHeaderBottom, 0.09 * MM, 0, 0, 1, 1, 1), d = sg.vert(-bagW / 2, yHeaderBottom, 0.09 * MM, 0, 0, 1, 0, 1);
    sg.quad(a, b, c, d);
    const sm = new THREE.Mesh(sg.build(), matSeal);
    bag.content.add(sm); regTransparent(sm, 0, (ySealBottom + yHeaderBottom) / 2, 0.09 * MM);
  }
  // film grids
  const film = {};
  {
    const step = (lowQ ? 2.0 : 1.0) * MM;
    const nx = Math.round(bagW / step) + 1, ny = Math.round((ySealBottom - yBottom) / step) + 1;
    const cnt = nx * ny, pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), uv = new Float32Array(cnt * 2);
    const crA = new Float32Array(cnt), crB = new Float32Array(cnt), puff = new Float32Array(cnt), env = new Float32Array(cnt), envB = new Float32Array(cnt);
    const edgeAmp = new Float32Array(cnt);
    // OPP is mostly flat: long, soft undulations everywhere + a few elongated puckers that run
    // inward from the side seams and the heat seal (where the film was gathered when sealed)
    const rnd = mulberry32(5), waves = [];
    for (let k = 0; k < 5; k++) {
      const ang = rnd() * PI, wl = (16 + rnd() * 28) * MM;
      waves.push([Math.cos(ang) * 2 * PI / wl, Math.sin(ang) * 2 * PI / wl, rnd() * PI * 2, rnd() * PI * 2, 0.5 + rnd()]);
    }
    let ampSum = 0; for (const w of waves) ampSum += w[4];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = -bagW / 2 + (i / (nx - 1)) * bagW, y = yBottom + (j / (ny - 1)) * (ySealBottom - yBottom);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = zFilmBase; nor[k * 3 + 2] = 1;
      uv[k * 2] = i / (nx - 1); uv[k * 2 + 1] = j / (ny - 1);
      let a = 0, b = 0;
      for (const [kx, ky, p1, p2, am] of waves) { a += am * Math.sin(kx * x + ky * y + p1); b += am * Math.sin(kx * x + ky * y + p2); }
      const dSide = bagW / 2 - Math.abs(x), dSeal = ySealBottom - y;
      const sideF = 1 - smoothstep(0, 8 * MM, dSide), sealF = 1 - smoothstep(0, 10 * MM, dSeal);
      const pk1 = sideF * Math.sin((2 * PI * y) / (8.5 * MM) + 2.2 * Math.sin(y / (14 * MM)) + (x > 0 ? 1.3 : 0)) * (0.6 + 0.4 * Math.sin(y / (9 * MM)))
        + sealF * Math.sin((2 * PI * x) / (7.5 * MM) + 1.8 * Math.sin(x / (12 * MM)));
      const pk2 = sideF * Math.sin((2 * PI * y) / (8.5 * MM) + 2.2 * Math.sin(y / (14 * MM)) + (x > 0 ? 2.9 : 1.6))
        + sealF * Math.sin((2 * PI * x) / (7.5 * MM) + 1.8 * Math.sin(x / (12 * MM)) + 1.9);
      crA[k] = 0.55 * (a / ampSum) + 0.8 * pk1; crB[k] = 0.55 * (b / ampSum) + 0.8 * pk2;
      edgeAmp[k] = 0.25 + 0.75 * Math.max(sideF, sealF);
      puff[k] = 0.5 + 0.5 * Math.sin(x * 70 + 1.3) * Math.cos(y * 38 + 0.4);
      env[k] = smoothstep(0, 2.6 * MM, dSide) * smoothstep(0, 2.2 * MM, dSeal);
      envB[k] = smoothstep(0, 3 * MM, y - yBottom);
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx + 1, d = a + nx; idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx); track(g);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, (yBottom + ySealBottom) / 2, 2 * MM), bagL * 0.6);
    const fm = new THREE.Mesh(g, matFilmFront); fm.frustumCulled = false;
    bag.content.add(fm); regTransparent(fm, 0, (yBottom + ySealBottom) / 2, 2.4 * MM);
    Object.assign(film, { nx, ny, pos, nor, crA, crB, puff, env, envB, edgeAmp, geo: g, mesh: fm });
    // back film (flat)
    const bgm = new GB();
    const q0 = bgm.vert(-bagW / 2, yBottom, 0.02 * MM, 0, 0, 1, 0, 0), q1 = bgm.vert(bagW / 2, yBottom, 0.02 * MM, 0, 0, 1, 1, 0);
    const q2 = bgm.vert(bagW / 2, ySealBottom, 0.02 * MM, 0, 0, 1, 1, 1), q3 = bgm.vert(-bagW / 2, ySealBottom, 0.02 * MM, 0, 0, 1, 0, 1);
    bgm.quad(q0, q1, q2, q3);
    const bm = new THREE.Mesh(bgm.build(), matFilmBack);
    bag.content.add(bm); regTransparent(bm, 0, (yBottom + ySealBottom) / 2, 0.02 * MM);
  }
  // card-content height field (card art frame) for the film drape
  const drape = {};
  {
    const h = (lowQ ? 0.8 : 0.5) * MM;
    const x0 = -bagW / 2 - 2 * MM, y0 = -20 * MM, nx = Math.ceil((bagW + 4 * MM) / h) + 1, ny = Math.ceil((cardH + 36 * MM) / h) + 1;
    const Fd = new Float32Array(nx * ny);
    const top = zCardInBag + zFrontOut + 0.03 * MM;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + i * h, y = y0 + j * h; let v = 0;
      if (Math.abs(x) <= cardW / 2 && y >= 0 && y <= cardH) {
        v = top;
        const bh = bubbleOuterHeight(sdfAt(x - magC[0], y - magC[1]));
        if (bh > 0) v = Math.max(v, zCardInBag + zBackIn + bh + 0.03 * MM);
      }
      Fd[j * nx + i] = v;
    }
    coneDilate(Fd, nx, ny, h, T.filmSlope);
    Object.assign(drape, { h, x0, y0, nx, ny, F: Fd });
  }
  const sampleDrape = (x, y) => bilinear(drape.F, drape.nx, drape.ny, (x - drape.x0) / drape.h, (y - drape.y0) / drape.h, 0);
  // bottom flap (self-adhesive), a strip bent around the bag's bottom end
  const flap = {};
  {
    const NF = lowQ ? 8 : 14, cols = 3, cnt = (NF + 1) * cols;
    const pos = new Float32Array(cnt * 3), nor = new Float32Array(cnt * 3), col = new Float32Array(cnt * 4);
    for (let k = 0; k <= NF; k++) {
      const s = (k / NF) * flapL, sMM = s / MM;
      const glue = smoothstep(5, 6.5, sMM) * (1 - smoothstep(15, 16.5, sMM));
      for (let c = 0; c < cols; c++) {
        const o = (k * cols + c) * 4;
        col[o] = col[o + 1] = col[o + 2] = lerp(0.05, 0.7, glue); col[o + 3] = lerp(0.05, 0.15, glue) + (k === NF ? 0.06 : 0);
      }
    }
    const idx = [];
    for (let k = 0; k < NF; k++) for (let c = 0; c < cols - 1; c++) {
      const a = k * cols + c, b = a + 1, d = a + cols, e = d + 1; idx.push(a, b, e, a, e, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.setIndex(idx); track(g);
    const m = new THREE.Mesh(g, matFlap); m.frustumCulled = false;
    bag.content.add(m); regTransparent(m, 0, yBottom, -0.5 * MM);
    Object.assign(flap, { NF, cols, pos, nor, geo: g, mesh: m, regIndex: transparentMeshes.length - 1 });
  }
  function updateFlapGeometry() {
    const th = S.flapTheta, NF = flap.NF, cols = flap.cols, P = flap.pos, Nn = flap.nor;
    const curl = 0.035 / MM * Math.sin(th) * (bag.flipped ? 0.6 : 1); // rad per metre
    // face-down bag: the opened flap hangs from the top of the bag down onto the table
    const droop = bag.flipped ? Math.asin(clamp(bag.zMax / flapL, 0, 0.9)) * smoothstep(0.6 * PI, PI, th) : 0;
    let y = yBottom, z = 0.008 * MM, ang = th + droop;
    const ds = flapL / NF;
    for (let k = 0; k <= NF; k++) {
      if (k > 0) { const a = ang + curl * ds * 0.5; y += Math.cos(a) * ds; z -= Math.sin(a) * ds; ang += curl * ds; }
      const ny = -Math.sin(ang), nz = -Math.cos(ang); // normal (perpendicular to the strip), sign irrelevant (double sided)
      for (let c = 0; c < cols; c++) {
        const o = (k * cols + c) * 3, x = (-0.5 + c / (cols - 1)) * (bagW - 0.8 * MM);
        P[o] = x; P[o + 1] = y; P[o + 2] = z; Nn[o] = 0; Nn[o + 1] = ny; Nn[o + 2] = -nz;
      }
    }
    flap.geo.attributes.position.needsUpdate = true; flap.geo.attributes.normal.needsUpdate = true;
    // render-order reference point follows the strip
    transparentMeshes[flap.regIndex].local.set(0, P[(Math.floor(NF / 2) * cols + 1) * 3 + 1], P[(Math.floor(NF / 2) * cols + 1) * 3 + 2]);
  }
  // pick proxies: the bag body (height follows the contents) and the opened flap (thin, on the table)
  bag.proxy = addProxy(bag.content, bag, 'bag', 0, 0, 2.5 * MM, bagW, bagL, 5 * MM);
  bag.flapProxy = addProxy(bag.content, bag, 'flap', 0, yBottom - flapL / 2, 0.2 * MM, bagW, flapL, 0.4 * MM);
  bag.flapProxy.userData.pick.off = true;
  function fitBagProxy() {
    const h = Math.max(0.6 * MM, bag.zMax);
    bag.proxy.scale.z = h; bag.proxy.position.z = h / 2;
  }

  // --------------------------------------------------------------------------
  // fridge door (vertical glossy panel at the back edge of the table)
  // --------------------------------------------------------------------------
  const fridge = { group: null, mesh: null, baseZ: F.z, thunkT: -1 };
  let doorX0 = 0, doorX1 = 0, doorY0 = 0, doorY1 = 0;
  if (F.enabled) {
    const gr = new THREE.Group(); gr.name = 'fridgeDoor';
    const H = F.height + F.below, W = F.width, D = F.depth, bev = 0.008, r = 0.02;
    const shape = new THREE.Shape();
    const hw = W / 2 - bev, hh = H / 2 - bev, rr = Math.min(r, hw, hh);
    shape.moveTo(-hw + rr, -hh); shape.lineTo(hw - rr, -hh); shape.quadraticCurveTo(hw, -hh, hw, -hh + rr);
    shape.lineTo(hw, hh - rr); shape.quadraticCurveTo(hw, hh, hw - rr, hh); shape.lineTo(-hw + rr, hh);
    shape.quadraticCurveTo(-hw, hh, -hw, hh - rr); shape.lineTo(-hw, -hh + rr); shape.quadraticCurveTo(-hw, -hh, -hw + rr, -hh);
    const geo = track(new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, D - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: lowQ ? 2 : 5, curveSegments: lowQ ? 4 : 10 }));
    geo.translate(0, 0, -(D - bev));
    const door = new THREE.Mesh(geo, matFridge);
    door.position.set(0, -F.below + H / 2, 0);
    door.receiveShadow = true; door.castShadow = true;
    gr.add(door);
    let handleX = null;
    if (F.handle) {
      handleX = W / 2 - 0.05;
      const len = Math.min(0.28, F.height * 0.6);
      const bar = new THREE.Mesh(track(new THREE.CylinderGeometry(0.0065, 0.0065, len, 24)), matChrome);
      bar.position.set(handleX, F.height - 0.06 - len / 2, 0.026); bar.castShadow = true;
      gr.add(bar);
      for (const sy of [-1, 1]) {
        const st = new THREE.Mesh(track(new THREE.CylinderGeometry(0.0045, 0.0055, 0.026, 16)), matChrome);
        st.rotation.x = HALF_PI; st.position.set(handleX, bar.position.y + sy * (len / 2 - 0.02), 0.013); st.castShadow = true;
        gr.add(st);
      }
    }
    // cabinet behind the door + dark gasket gap, so the panel reads as a (compact) fridge
    const cabD = 0.03;
    const cab = new THREE.Mesh(track(new THREE.BoxGeometry(W + 0.01, H + 0.008, cabD)), matCabinet);
    cab.position.set(0, -F.below + H / 2 + 0.004, -D - 0.004 - cabD / 2);
    cab.castShadow = true; cab.receiveShadow = true;
    const gasket = new THREE.Mesh(track(new THREE.BoxGeometry(W - 0.006, H - 0.006, 0.006)), matGasket);
    gasket.position.set(0, -F.below + H / 2, -D - 0.001);
    gr.add(cab, gasket);
    gr.position.set(F.x, 0, F.z);
    group.add(gr);
    fridge.group = gr; fridge.mesh = door;
    doorX0 = F.x - W / 2 + 0.014 + magHalfX;
    doorX1 = F.x + (handleX !== null ? handleX - 0.03 : W / 2 - 0.014) - magHalfX;
    doorY0 = magHalfY + 0.3 * MM;
    doorY1 = F.height - 0.014 - magHalfY;
  }

  // --------------------------------------------------------------------------
  // contact shadows (soft blobs)
  // --------------------------------------------------------------------------
  {
    const mk = (body, polys, ex, ey, blur, alpha) => {
      const tex = makeBlobTexture(polys, ex, ey, blur);
      const m = new THREE.Mesh(track(new THREE.PlaneGeometry(1, 1)), track(new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false,
      })));
      m.renderOrder = 1; m.frustumCulled = false; m.visible = false;
      m.userData.noExport = true;
      group.add(m);
      body.shadow = { mesh: m, ex, ey, alpha };
    };
    const pad = 1.45;
    mk(magnet, [outline], (ob.maxX - ob.minX) * pad, (ob.maxY - ob.minY) * pad, 1.6 * MM, 0.55);
    mk(card, [[[-cardW / 2, -cardH / 2], [cardW / 2, -cardH / 2], [cardW / 2, cardH / 2], [-cardW / 2, cardH / 2]]], cardW * 1.3, cardH * 1.3, 2.5 * MM, 0.5);
    mk(blister, [roundedRectPoly(0, 0, flangeW * 0.92, flangeH * 0.92, flangeR, 4)], flangeW * 1.35, flangeH * 1.35, 3 * MM, 0.14);
    mk(bag, [[[-bagW / 2, -bagL / 2], [bagW / 2, -bagL / 2], [bagW / 2, bagL / 2], [-bagW / 2, bagL / 2]]], bagW * 1.3, bagL * 1.2, 3 * MM, 0.12);
  }

  // ==========================================================================
  // elastic bending (vertex deformation in the shader)
  // A body bends cylindrically: across direction P (in its art frame), about an axis along D,
  // with curvature k (1/m) around a centre C. Curvature is limited per body (paperboard ~28°
  // curl over the panel, PET ~8°, the die-cast magnet ~1.5°) and springs back when released.
  // Each mesh owns its material(s), so per-mesh uniforms are set in mesh-local coordinates.
  // ==========================================================================
  // contact response per material: restitution e, gravity scale g, ground friction (1/s), release glide
  const MATRESP = {
    magnet: { e: 0.34, g: 1.8, fric: 9, glide: 0.5 },
    blister: { e: 0.24, g: 1.0, fric: 12, glide: 0.3 },
    card: { e: 0.1, g: 0.8, fric: 16, glide: 0.15 },
    bag: { e: 0.05, g: 0.6, fric: 18, glide: 0.1 },
  };
  const BEND = {
    bag: { theta: 0.35, K: 150, C: 10 },
    card: { theta: 0.49, K: 170, C: 9 },
    blister: { theta: 0.14, K: 600, C: 24 },
    magnet: { theta: 0.026, K: 2600, C: 95 },
  };
  const bendMeshes = []; // { mesh, body, mats[] }
  const BEND_VS_DECL = 'uniform vec3 uBendC;\nuniform vec3 uBendD;\nuniform float uBendK;\n';
  const BEND_VS_NORMAL = `#include <beginnormal_vertex>
    vec3 bendPos = position;
    if ( abs( uBendK ) > 1e-4 ) {
      vec3 bD = uBendD; vec3 bP = vec3( -bD.y, bD.x, 0.0 );
      vec3 rel = position - uBendC;
      float bu = dot( rel, bP ), bz = rel.z, ba = dot( rel, bD );
      float bR = 1.0 / uBendK, th = bu * uBendK, s = sin( th ), c = cos( th );
      bendPos = uBendC + bD * ba + bP * ( ( bR - bz ) * s ) + vec3( 0.0, 0.0, bR - ( bR - bz ) * c );
      float on = dot( objectNormal, bP ), oz = objectNormal.z, od = dot( objectNormal, bD );
      objectNormal = bD * od + bP * ( on * c - oz * s ) + vec3( 0.0, 0.0, on * s + oz * c );
    }`;
  function makeBendable(m) {
    if (m.userData.bend) return m.userData.bend;
    const u = { uBendC: { value: new THREE.Vector3() }, uBendD: { value: new THREE.Vector3(0, 1, 0) }, uBendK: { value: 0 } };
    m.userData.bend = u;
    const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey();
    m.onBeforeCompile = (sh, r) => {
      prev.call(m, sh, r);
      Object.assign(sh.uniforms, u);
      sh.vertexShader = BEND_VS_DECL + sh.vertexShader
        .replace('#include <beginnormal_vertex>', BEND_VS_NORMAL)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed = bendPos;');
    };
    m.customProgramCacheKey = () => prevKey + '|bend';
    m.needsUpdate = true;
    return u;
  }
  for (const b of BODIES) {
    b.bend = { k: 0, kv: 0, target: 0, active: false, C: new THREE.Vector3(), D: new THREE.Vector3(0, 1, 0), kMax: 1, art: null };
    b.root.traverse((o) => {
      if (!o.isMesh || o.material === matProxy) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(makeBendable);
      bendMeshes.push({ mesh: o, body: b, mats });
    });
  }
  // art-frame boxes used to derive the curvature limit for a chosen bend direction
  const artBox = (b) => {
    if (b === magnet) return [ob.minX, ob.maxX, ob.minY, ob.maxY];
    if (b === blister) return [-flangeW / 2, flangeW / 2, -flangeH / 2, flangeH / 2];
    if (b === card) return [-cardW / 2, cardW / 2, S.cardOpen || S.hingePhi > 1e-3 ? -cardH : 0, cardH];
    return [-bagW / 2, bagW / 2, yBottom, yTop];
  };
  /** start/adjust a bend on body b: centre (art frame), across-direction px,py (art frame) */
  function setBendFrame(b, cx, cy, cz, px, py) {
    const l = Math.hypot(px, py) || 1; px /= l; py /= l;
    const bd = b.bend; bd.C.set(cx, cy, cz); bd.D.set(py, -px, 0); // D ⟂ P, and P = (-D.y, D.x)
    const [x0, x1, y0, y1] = artBox(b);
    let half = 0;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) half = Math.max(half, Math.abs((x - cx) * px + (y - cy) * py));
    bd.kMax = BEND[b.name].theta / Math.max(0.01, half);
  }
  function stepBend(b, dt) {
    const bd = b.bend, p = BEND[b.name];
    if (bd.active) { bd.k += (bd.target - bd.k) * (1 - Math.exp(-22 * dt)); bd.kv = 0; }
    else if (bd.k !== 0 || bd.kv !== 0) {
      bd.kv += (-p.K * bd.k - p.C * bd.kv) * dt; bd.k += bd.kv * dt;
      if (Math.abs(bd.k) < 1e-3 && Math.abs(bd.kv) < 1e-2) { bd.k = 0; bd.kv = 0; }
    }
    bd.k = clamp(bd.k, -bd.kMax * 1.15, bd.kMax * 1.15);
  }
  /** owner of the deformation for meshes of body b (contents bend with their container; the metal stays rigid) */
  function bendOwner(b) {
    if (b === magnet) return magnet;
    if (b === blister && S.blisterInCard) return S.cardInBag ? bag : card;
    if (b === card && S.cardInBag) return bag;
    return b;
  }
  function updateBendUniforms() {
    for (let i = 0; i < bendMeshes.length; i++) {
      const e = bendMeshes[i], own = bendOwner(e.body), bd = own.bend;
      let k = (e.body === magnet && S.magnetInBlister) ? 0 : bd.k;
      if (own === card && S.hingePhi > 1e-3 && S.hingePhi < PI - 1e-3) k = 0; // no bending mid-swing
      if (Math.abs(k) < 1e-4) { if (e.mats[0].uBendK.value !== 0) for (const u of e.mats) u.uBendK.value = 0; continue; }
      // root art frame → mesh local
      _m1.copy(e.mesh.matrixWorld).invert().multiply(own.root.matrixWorld);
      _v1.copy(bd.C).applyMatrix4(_m1);
      _v2.copy(bd.D).transformDirection(_m1);
      _v3.set(0, 0, 1).transformDirection(_m1);
      const kk = _v3.z < 0 ? -k : k;
      for (const u of e.mats) { u.uBendC.value.copy(_v1); u.uBendD.value.copy(_v2); u.uBendK.value = kk; }
    }
  }

  // ==========================================================================
  // state
  // ==========================================================================
  const S = {};
  function initialState() {
    Object.assign(S, {
      flapTheta: 0, flapOpen: false,
      slide: 0, cardInBag: true,
      hingePhi: 0, cardOpen: false, cardMoving: null,
      blisterInCard: true, magnetInBlister: true, magnetOnFridge: false,
      emptyT: 0, fill: 1, flutter: 0, filmDirty: true, popNudge: 0,
    });
  }
  initialState();
  const anims = { flap: null, slide: null, hinge: null }; // parameter tweens
  let resetAnim = null;
  let now = 0;
  let pendingTap = null;
  let transientHint = null, transientUntil = 0, lastHint = '';
  let cursorState = '';
  let lastPointerType = 'mouse';
  let doorThunkT = -1;

  const G = { // active gesture
    active: false, id: -1, kind: '', started: false, x0: 0, y0: 0, t0: 0, hit: null, body: null,
    rayW: new THREE.Ray(), offX: 0, offZ: 0, grabDY: 0,
    p0: 0, s0: 0, theta0: 0, phi0: 0, ptr0: 0, hingeR: 0, popX0: 0, popZ0: 0, popY: 0, offFX: 0, offFY: 0,
  };
  let lastDown = { t: -10, x: 0, y: 0, target: null };

  // ==========================================================================
  // body extents / footprints / support
  // ==========================================================================
  function fp(cx, cz, hx, hz, top) { return { cx, cz, hx, hz, top }; }
  function computeExtents(b) {
    let f = [];
    if (b === magnet) {
      b.zMin = 0; b.zMax = zArt; b.hw = magHalfX; b.halfLen = magHalfY;
      f = [fp(0, 0, magHalfX, magHalfY, zArt)];
    } else if (b === blister) {
      b.zMin = 0; b.zMax = bubbleH; b.hw = flangeW / 2; b.halfLen = flangeH / 2;
      const bb = bubbleBox, bcx = (bb.minX + bb.maxX) / 2, bcz = -(bb.minY + bb.maxY) / 2;
      f = b.flipped ? [fp(0, 0, flangeW / 2, flangeH / 2, bubbleH)]
        : [fp(0, 0, flangeW / 2, flangeH / 2, flT), fp(bcx, bcz, (bb.maxX - bb.minX) / 2, (bb.maxY - bb.minY) / 2, bubbleH)];
    } else if (b === card) {
      b.hw = cardW / 2;
      const winCx = (windowBox.minX + windowBox.maxX) / 2, winCz = -(windowBox.minY + windowBox.maxY) / 2;
      const winHx = (windowBox.maxX - windowBox.minX) / 2, winHz = (windowBox.maxY - windowBox.minY) / 2;
      if (!S.cardOpen && S.hingePhi < 1e-4) {
        b.zMin = 0; b.zMax = S.blisterInCard ? zBubbleTop : zFrontOut; b.halfLen = cardH / 2;
        f = b.flipped || !S.blisterInCard ? [fp(0, -cardH / 2, cardW / 2, cardH / 2, b.zMax)]
          : [fp(0, -cardH / 2, cardW / 2, cardH / 2, zFrontOut), fp(winCx, winCz, winHx, winHz, zBubbleTop)];
      } else {
        const movedFront = S.cardMoving !== 'back';
        b.zMin = movedFront ? 0 : zFrontIn; b.zMax = movedFront ? cardT : zFrontOut;
        if (S.blisterInCard) { b.zMin = Math.min(b.zMin, zBackIn); b.zMax = Math.max(b.zMax, zBubbleTop); }
        b.halfLen = cardH;
        const h = b.zMax - b.zMin;
        const insidesUp = movedFront ? !b.flipped : b.flipped;
        if (S.blisterInCard && insidesUp) {
          f = [fp(0, -cardH / 2, cardW / 2, cardH / 2, cardT), fp(0, cardH / 2, cardW / 2, cardH / 2, cardT), fp(winCx, winCz, winHx, winHz, h)];
        } else {
          f = [fp(0, -cardH / 2, cardW / 2, cardH / 2, h), fp(0, cardH / 2, cardW / 2, cardH / 2, h)];
        }
      }
    } else if (b === bag) {
      b.zMin = 0; b.hw = bagW / 2; b.halfLen = bagL / 2;
      if (S.cardInBag) {
        b.zMax = zCardInBag + zBubbleTop + 0.1 * MM;
        const fold = cardFoldY0 - S.slide;
        f = b.flipped ? [fp(0, 0, bagW / 2, bagL / 2, b.zMax)]
          : [fp(0, 0, bagW / 2, bagL / 2, 0.2 * MM), fp(0, -(fold + cardH / 2), cardW / 2, cardH / 2, zCardInBag + zFrontOut + 0.1 * MM),
            fp(magC[0], -(fold + magC[1]), magHalfX + 2 * MM, magHalfY + 2 * MM, b.zMax)];
      } else {
        b.zMax = 1.0 * MM;
        f = [fp(0, 0, bagW / 2, bagL / 2, b.zMax)];
      }
      fitBagProxy();
    }
    b.fps = f;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const q of f) { x0 = Math.min(x0, q.cx - q.hx); x1 = Math.max(x1, q.cx + q.hx); z0 = Math.min(z0, q.cz - q.hz); z1 = Math.max(z1, q.cz + q.hz); }
    b.ax0 = x0; b.ax1 = x1; b.az0 = z0; b.az1 = z1;
  }
  function computeFpw(b, x, z) {
    const c = Math.cos(b.psi), s = Math.sin(b.psi), m = b.flipped ? -1 : 1;
    for (let i = 0; i < b.fps.length && i < 4; i++) {
      const q = b.fps[i], w = b.fpw[i], cx = q.cx * m;
      w.x = x + cx * c + q.cz * s; w.z = z - cx * s + q.cz * c; w.c = c; w.s = s;
      w.hx = Math.max(0, q.hx - 0.4 * MM); w.hz = Math.max(0, q.hz - 0.4 * MM);
    }
  }
  function belowAt(b, a) { const c = Math.cos(a), s = Math.abs(Math.sin(a)); return b.hw * s - Math.min(b.zMin * c, b.zMax * c); }
  function dropDependents() { /* physics decides what rests on what */ }
  /** keep a placement target inside the free desk area; returns false if the spot hits a fixed board */
  function clampTarget(b) {
    let x0 = b.ax0, x1 = b.ax1; if (b.flipped) { const t = -x1; x1 = -x0; x0 = t; }
    const z0 = b.az0, z1 = b.az1, c = Math.cos(b.psi), s = Math.sin(b.psi);
    let ex0 = Infinity, ex1 = -Infinity, ez0 = Infinity, ez1 = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = k & 1 ? x1 : x0, z = k & 2 ? z1 : z0, wx = x * c + z * s, wz = -x * s + z * c;
      if (wx < ex0) ex0 = wx; if (wx > ex1) ex1 = wx; if (wz < ez0) ez0 = wz; if (wz > ez1) ez1 = wz;
    }
    b.tx = clamp(b.tx, tableB.minX - ex0, tableB.maxX - ex1);
    b.tz = clamp(b.tz, tableB.minZ - ez0, tableB.maxZ - ez1);
    for (let i = 0; i < PH.boxes.length; i++) {
      const bx = PH.boxes[i];
      if (bx.wall || bx.max.y < 0.004) continue;
      if (b.tx + ex1 > bx.min.x && b.tx + ex0 < bx.max.x && b.tz + ez1 > bx.min.z && b.tz + ez0 < bx.max.z) return false;
    }
    return true;
  }

  // ==========================================================================
  // rigid-body physics (Rapier). Every loose item is a 6-DOF dynamic body whose colliders
  // follow its real shape and thickness; nested stages (card in bag, blister in card, magnet
  // in blister) are colliders of their container until they are taken out.
  // ==========================================================================
  const MATP = {
    magnet: { density: 7000, friction: 0.65, restitution: 0.08 },  // slight, well-damped rebound
    blister: { density: 1380, friction: 0.35, restitution: 0.22 }, // PET
    card: { density: 720, friction: 0.55, restitution: 0.06 },     // paperboard
    bag: { density: 900, friction: 0.6, restitution: 0.03 },       // OPP film
  };
  const BIT = { bag: 1, card: 2, blister: 4, magnet: 8 }, STATIC_BIT = 16;
  const RAD = { bag: 0.085, card: 0.105, blister: 0.052, magnet: 0.036 };
  const noCollide = []; // [bodyA, bodyB] pairs that ignore each other until they have separated
  function groupsFor(b) {
    let mask = 0xffff;
    for (const [a, c] of noCollide) { if (a === b) mask &= ~BIT[c.name]; if (c === b) mask &= ~BIT[a.name]; }
    return (BIT[b.name] << 16) | mask;
  }
  function applyGroups(b) { if (!b.rb) return; const g = groupsFor(b); for (let i = 0; i < b.rb.numColliders(); i++) b.rb.collider(i).setCollisionGroups(g); }
  function excludePair(a, c) { noCollide.push([a, c]); applyGroups(a); applyGroups(c); }
  function updateExclusions() {
    for (let i = noCollide.length - 1; i >= 0; i--) {
      const [a, c] = noCollide[i];
      if (!a.loose || !c.loose) continue;
      const r = (a === card || c === card) && S.cardOpen ? 0.15 : RAD[a.name] + RAD[c.name];
      if (a.root.position.distanceTo(c.root.position) > r) { noCollide.splice(i, 1); applyGroups(a); applyGroups(c); }
    }
  }

  // collider shapes (art frame), precomputed once
  function clipBand(poly, y0, y1) {
    const clip = (pts, keep, inter) => {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const A = pts[i], B = pts[(i + 1) % pts.length], ia = keep(A), ib = keep(B);
        if (ia) out.push(A);
        if (ia !== ib) out.push(inter(A, B));
      }
      return out;
    };
    const atY = (y) => (A, B) => { const t = (y - A[1]) / (B[1] - A[1]); return [A[0] + (B[0] - A[0]) * t, y]; };
    return clip(clip(poly, (p) => p[1] >= y0, atY(y0)), (p) => p[1] <= y1, atY(y1));
  }
  const hullPts = (poly2d, zs) => { const out = []; for (const p of poly2d) for (const z of zs) out.push(p[0], p[1], z); return out; };
  // magnet: the cloud + tower outline cut into horizontal bands, each a convex prism of the real thickness
  const magnetHulls = [];
  {
    const bands = 9, coarse = resampleClosed(outline, 0.8 * MM);
    for (let k = 0; k < bands; k++) {
      const y0 = ob.minY + ((ob.maxY - ob.minY) * k) / bands, y1 = ob.minY + ((ob.maxY - ob.minY) * (k + 1)) / bands;
      const piece = clipBand(coarse, y0 - 0.05 * MM, y1 + 0.05 * MM);
      if (piece.length >= 3 && Math.abs(polyArea(piece)) > 1e-6) magnetHulls.push(hullPts(piece, [0, zArt]));
    }
  }
  // blister bubble: base contour on the flange, top contour at the bubble height
  const bubbleHull = (() => {
    const base = resampleClosed(bubbleBase, 2 * MM), nrm = vertexNormals2D(base);
    const W = (SB.bubble.base_offset_mm - SB.bubble.top_offset_mm) * MM, out = hullPts(base, [0]);
    for (let i = 0; i < base.length; i++) out.push(base[i][0] - nrm[i * 2] * W, base[i][1] - nrm[i * 2 + 1] * W, bubbleH);
    return out;
  })();

  const PH = { world: null, acc: 0, h: 1 / 240, boxes: [], surfaces: [] };
  const RAPIER = opts.RAPIER || (await import('../node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs')).default;
  await RAPIER.init();
  PH.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  PH.world.timestep = PH.h;
  try { PH.world.lengthUnit = 0.05; } catch (e) { /* older builds */ }
  try { PH.world.numSolverIterations = 8; } catch (e) { /* older builds */ }
  const STATIC_GROUPS = (STATIC_BIT << 16) | 0xffff;
  function addStaticBox(min, max, friction = 0.55, restitution = 0.06) {
    const d = RAPIER.ColliderDesc.cuboid((max.x - min.x) / 2, (max.y - min.y) / 2, (max.z - min.z) / 2)
      .setTranslation((max.x + min.x) / 2, (max.y + min.y) / 2, (max.z + min.z) / 2)
      .setFriction(friction).setRestitution(restitution).setCollisionGroups(STATIC_GROUPS);
    const c = PH.world.createCollider(d);
    const e = { min: min.clone(), max: max.clone(), collider: c };
    PH.boxes.push(e);
    return e;
  }
  group.updateMatrixWorld(true);
  _groupInv.copy(group.matrixWorld).invert();
  const toLocal = (v) => new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(_groupInv);
  {
    const V3 = THREE.Vector3;
    // supports: thin slabs whose top is the support plane (table, shelves, hutch top …)
    const supports = opts.supports && opts.supports.length ? opts.supports
      : [{ name: 'table', y: 0, min: { x: tableB.minX - 0.05, y: tableB.minZ - 0.05 }, max: { x: tableB.maxX + 0.05, y: tableB.maxZ + 0.05 } }];
    for (const sp of supports) {
      const a = toLocal({ x: sp.min.x, y: sp.y, z: sp.min.y }), c = toLocal({ x: sp.max.x, y: sp.y, z: sp.max.y });
      addStaticBox(new V3(Math.min(a.x, c.x), a.y - 0.02, Math.min(a.z, c.z)), new V3(Math.max(a.x, c.x), a.y, Math.max(a.z, c.z)), 0.55, 0.06).support = true;
    }
    // fixed boards
    for (const bx of opts.colliders || []) addStaticBox(toLocal(bx.min), toLocal(bx.max), 0.5, 0.06);
    // invisible walls around the free area so nothing is thrown off the desk
    const H = 0.8, t = 0.02;
    addStaticBox(new V3(tableB.minX - t, -0.05, tableB.minZ - t), new V3(tableB.minX, H, tableB.maxZ + t)).wall = true;
    addStaticBox(new V3(tableB.maxX, -0.05, tableB.minZ - t), new V3(tableB.maxX + t, H, tableB.maxZ + t)).wall = true;
    addStaticBox(new V3(tableB.minX - t, -0.05, tableB.minZ - t), new V3(tableB.maxX + t, H, tableB.minZ)).wall = true;
    addStaticBox(new V3(tableB.minX - t, -0.05, tableB.maxZ), new V3(tableB.maxX + t, H, tableB.maxZ + t)).wall = true;
    if (F.enabled) {
      const H2 = F.height + F.below;
      addStaticBox(new V3(F.x - F.width / 2, -F.below, F.z - F.depth - 0.03), new V3(F.x + F.width / 2, -F.below + H2, F.z), 0.6, 0.1);
    }
    // magnetic surfaces (steel panel / fridge door): a grippy slab right behind the face
    const list = (opts.magneticSurfaces || []).map((m) => ({ name: m.name, c: toLocal(m.center), n: new V3(m.normal.x, m.normal.y, m.normal.z).normalize(), w: m.width, h: m.height }));
    if (F.enabled && !list.length) list.push({ name: 'fridge', c: new V3(F.x, F.height / 2, F.z), n: new V3(0, 0, 1), w: F.width - 0.03, h: F.height - 0.03 });
    for (const sf of list) {
      sf.u = new V3(0, 1, 0).cross(sf.n).normalize(); sf.v = sf.n.clone().cross(sf.u).normalize();
      const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(sf.u, sf.v, sf.n));
      const d = RAPIER.ColliderDesc.cuboid(sf.w / 2, sf.h / 2, 0.003).setTranslation(sf.c.x - sf.n.x * 0.003, sf.c.y - sf.n.y * 0.003, sf.c.z - sf.n.z * 0.003)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setFriction(0.75).setRestitution(0.05).setCollisionGroups(STATIC_GROUPS);
      sf.collider = PH.world.createCollider(d);
      PH.surfaces.push(sf);
    }
  }
  const SURF_HANDLES = new Set(PH.surfaces.map((s) => s.collider.handle));
  const WALL_HANDLES = new Set(PH.boxes.filter(b => b.wall).map(b => b.collider.handle));

  function addHull(b, pts, mat, density, dx, dy, dz) {
    const arr = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i += 3) { arr[i] = pts[i] + dx; arr[i + 1] = pts[i + 1] + dy; arr[i + 2] = pts[i + 2] + dz; }
    const d = RAPIER.ColliderDesc.convexHull(arr);
    if (!d) return;
    d.setDensity(density).setFriction(mat.friction).setRestitution(mat.restitution).setCollisionGroups(groupsFor(b));
    PH.world.createCollider(d, b.rb);
  }
  function addBox(b, x0, x1, y0, y1, z0, z1, mat, density) {
    const zc = (z0 + z1) / 2, hz = Math.max(0.6 * MM, z1 - z0) / 2;
    const d = RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, hz).setTranslation((x0 + x1) / 2, (y0 + y1) / 2, zc)
      .setDensity(density).setFriction(mat.friction).setRestitution(mat.restitution).setCollisionGroups(groupsFor(b));
    PH.world.createCollider(d, b.rb);
  }
  /** (re)build the colliders of a body for its current unpacking stage */
  function buildColliders(b) {
    const rb = b.rb; if (!rb) return;
    for (let i = rb.numColliders() - 1; i >= 0; i--) PH.world.removeCollider(rb.collider(i), false);
    const addMagnet = (dx, dy, dz) => { for (const h of magnetHulls) addHull(b, h, MATP.magnet, MATP.magnet.density, dx, dy, dz); };
    const addBlister = (dx, dy, dz) => {
      addBox(b, dx - flangeW / 2, dx + flangeW / 2, dy - flangeH / 2, dy + flangeH / 2, dz, dz + flT, MATP.blister, MATP.blister.density);
      addHull(b, bubbleHull, MATP.blister, 60, dx, dy, dz); // hollow shell → light
      if (S.magnetInBlister) addMagnet(dx, dy, dz);
    };
    const addCard = (dx, dy, dz) => {
      const W2 = cardW / 2;
      if (!S.cardOpen && S.hingePhi < 1e-4) addBox(b, dx - W2, dx + W2, dy, dy + cardH, dz, dz + zFrontOut, MATP.card, MATP.card.density);
      else {
        const movedFront = S.cardMoving !== 'back';
        const z0 = movedFront ? 0 : zFrontIn, z1 = movedFront ? cardT : zFrontOut;
        addBox(b, dx - W2, dx + W2, dy, dy + cardH, dz + z0, dz + z1, MATP.card, MATP.card.density);
        if (S.cardOpen) addBox(b, dx - W2, dx + W2, dy - cardH, dy, dz + z0, dz + z1, MATP.card, MATP.card.density);
      }
      if (S.blisterInCard) addBlister(dx + magC[0], dy + magC[1], dz + zBackIn);
    };
    if (b === magnet) addMagnet(0, 0, 0);
    else if (b === blister) addBlister(0, 0, 0);
    else if (b === card) addCard(0, 0, 0);
    else if (b === bag) {
      addBox(b, -bagW / 2, bagW / 2, yBottom, yTop, 0, 0.3 * MM, MATP.bag, MATP.bag.density);
      if (S.cardInBag) addCard(0, cardFoldY0 - S.slide, zCardInBag);
      b.builtSlide = S.slide;
    }
    rb.recomputeMassPropertiesFromColliders();
    rb.wakeUp();
  }
  function createRB(b) {
    const p = b.root.position, q = b.root.quaternion;
    const d = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setLinearDamping(0.12).setAngularDamping(0.45).setCcdEnabled(true).setCanSleep(true);
    b.rb = PH.world.createRigidBody(d);
    buildColliders(b);
  }
  function removeRB(b) { if (b.rb) { PH.world.removeRigidBody(b.rb); b.rb = null; } }
  function setKinematic(b, on) { if (b.rb) b.rb.setBodyType(on ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, true); }
  /** rigid body pose → art frame of the body; derived yaw / flip for helpers */
  function syncFromRB(b) {
    const t = b.rb.translation(), r = b.rb.rotation();
    b.root.position.set(t.x, t.y, t.z); b.root.quaternion.set(r.x, r.y, r.z, r.w);
    b.x = t.x; b.y = t.y; b.z = t.z;
    _v1.set(0, 0, 1).applyQuaternion(b.root.quaternion); b.flipped = _v1.y < 0; b.upness = Math.abs(_v1.y);
    _v2.set(0, 1, 0).applyQuaternion(b.root.quaternion); b.psi = Math.atan2(-_v2.x, -_v2.z);
    b.flipA = b.flipped ? PI : 0;
    const lv = b.rb.linvel(); b.vx = lv.x; b.vy = lv.y; b.vz = lv.z;
    b.base = groundAt(b.x, b.z, b.rb, Math.max(0.001, b.y - 0.001));
    if (b.state === 'dyn' || b.state === 'rest' || b.state === 'fall') b.state = b.rb.isSleeping() ? 'rest' : 'dyn';
  }
  const _phRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  /** height of whatever lies below (x, z), ignoring one body */
  function groundAt(x, z, excludeRb, fromY = 1.2) {
    _phRay.origin.x = x; _phRay.origin.y = fromY; _phRay.origin.z = z; _phRay.dir.x = 0; _phRay.dir.y = -1; _phRay.dir.z = 0;
    const hit = PH.world.castRay(_phRay, fromY + 0.5, true, undefined, undefined, undefined, excludeRb || undefined);
    return hit ? fromY - hit.timeOfImpact : 0;
  }
  function makeLoose(b) {
    group.updateMatrixWorld(true);
    const par = b === card ? bag : b === blister ? card : b === magnet ? blister : null;
    group.attach(b.root);
    b.loose = true; b.state = 'dyn';
    computeExtents(b);
    createRB(b);
    if (par && par.rb) b.rb.setLinvel(par.rb.linvel(), true);
    if (par && par.rb) { buildColliders(par); excludePair(b, par); }
    syncFromRB(b);
    b.base = groundAt(b.x, b.z, b.rb);
  }

  // grabbing: a soft, gravity-compensated spring at the grabbed point (not the centre), so an
  // item held by an edge pivots and hangs, can be tipped over, slid, flipped and thrown
  const HOLD = { body: null, local: new THREE.Vector3(), target: new THREE.Vector3(), raw: new THREE.Vector3(), grabH: 0, planeY: 0, mode: 'free' };
  const HOLD_W = 20, HOLD_Z = 1.1, HOLD_AMAX = 35;
  function beginHold(b, point) {
    if (!b || !b.rb || b.state === 'anim') return;
    if (HOLD.body && HOLD.body !== b) releaseHold(false);
    setKinematic(b, false);
    HOLD.body = b; b.state = 'held';
    b.root.updateMatrix(); _m1.copy(b.root.matrix).invert();
    HOLD.local.copy(point).applyMatrix4(_m1);
    const g = groundAt(point.x, point.z, b.rb, point.y + 0.002);
    HOLD.grabH = clamp(point.y - g, 0, 0.03);
    HOLD.planeY = point.y + T.liftHeight;
    HOLD.target.copy(point); HOLD.raw.copy(point); HOLD.raw.y += T.liftHeight;
    b.rb.setAngularDamping(4.5); b.rb.setLinearDamping(0.6); b.rb.wakeUp();
    G.kind = 'move'; G.body = b;
    emit('pickup', b.name);
  }
  function releaseHold(throwIt = true) {
    const b = HOLD.body; HOLD.body = null;
    if (!b || !b.rb) return;
    b.state = 'dyn';
    b.rb.setAngularDamping(0.45); b.rb.setLinearDamping(0.12);
    const v = b.rb.linvel(), sp = Math.hypot(v.x, v.y, v.z), cap = throwIt ? 0.35 : 0.05;
    if (sp > cap) b.rb.setLinvel({ x: v.x * cap / sp, y: v.y * cap / sp, z: v.z * cap / sp }, true);
    emit('drop', b.name);
  }
  /** where the held point should go: over whatever the pointer is on (table, shelf, hutch top,
   *  another item), lifted a little; on the steel panel the magnet slides along the face */
  function updateHoldTarget() {
    const b = HOLD.body; if (!b) return;
    _phRay.origin.x = _rayL.origin.x; _phRay.origin.y = _rayL.origin.y; _phRay.origin.z = _rayL.origin.z;
    _phRay.dir.x = _rayL.direction.x; _phRay.dir.y = _rayL.direction.y; _phRay.dir.z = _rayL.direction.z;
    const hit = PH.world.castRayAndGetNormal(_phRay, 5, true, undefined, undefined, undefined, b.rb, c => !WALL_HANDLES.has(c.handle));
    HOLD.mode = 'free';
    if (hit) {
      const t = hit.timeOfImpact, n = hit.normal;
      const hx = _rayL.origin.x + _rayL.direction.x * t, hy = _rayL.origin.y + _rayL.direction.y * t, hz = _rayL.origin.z + _rayL.direction.z * t;
      if (b === magnet && SURF_HANDLES.has(hit.collider.handle)) {
        HOLD.mode = 'surface';
        const off = Math.max(0, HOLD.local.z) + 0.4 * MM;
        HOLD.raw.set(hx + n.x * off, hy + n.y * off, hz + n.z * off);
        HOLD.planeY = HOLD.raw.y;
        return;
      }
      if (n.y > 0.6) HOLD.planeY = hy + HOLD.grabH + T.liftHeight;
    }
    if (intersectY(_rayL, HOLD.planeY, _v1)) HOLD.raw.copy(_v1);
    HOLD.raw.x = clamp(HOLD.raw.x, tableB.minX + 0.01, tableB.maxX - 0.01);
    HOLD.raw.z = clamp(HOLD.raw.z, tableB.minZ + 0.01, tableB.maxZ - 0.01);
    HOLD.raw.y = clamp(HOLD.raw.y, 0.004, 0.65);
  }
  const _phV = { x: 0, y: 0, z: 0 }, _phP = { x: 0, y: 0, z: 0 };
  function applyHold(h) {
    const b = HOLD.body; if (!b || !b.rb) return;
    const rb = b.rb, m = rb.mass();
    HOLD.target.lerp(HOLD.raw, 1 - Math.exp(-24 * h)); // smoothed pointer target → no jitter
    const t = rb.translation(), r = rb.rotation();
    _q1.set(r.x, r.y, r.z, r.w);
    _v1.copy(HOLD.local).applyQuaternion(_q1); _v1.x += t.x; _v1.y += t.y; _v1.z += t.z; // grabbed point
    const com = rb.worldCom(), lv = rb.linvel(), av = rb.angvel();
    _v3.set(_v1.x - com.x, _v1.y - com.y, _v1.z - com.z);
    _v4.set(av.x, av.y, av.z).cross(_v3); _v4.x += lv.x; _v4.y += lv.y; _v4.z += lv.z; // its velocity
    const freq=HOLD.mode==='surface'?35:HOLD_W;
    _v2.copy(HOLD.target).sub(_v1).multiplyScalar(freq * freq).addScaledVector(_v4, -2 * HOLD_Z * freq);
    _v2.y += 9.81; // carry the weight at the grabbed point: it still pivots there
    const a = _v2.length(),limit=HOLD.mode==='surface'?60:HOLD_AMAX; if (a > limit) _v2.multiplyScalar(limit / a);
    _phV.x = _v2.x * m * h; _phV.y = _v2.y * m * h; _phV.z = _v2.z * m * h;
    _phP.x = _v1.x; _phP.y = _v1.y; _phP.z = _v1.z;
    rb.applyImpulseAtPoint(_phV, _phP, true);
  }

  // magnetism: attraction at points of the rubber sheet toward steel, falling off with distance
  const MAG_PTS = [[0, -8], [-14, -12], [14, -12], [-9, 4], [9, 2], [1.7, 16]].map(([x, y]) => [x * MM * magScale, y * MM * magScale]);
  const MAG_F = 1.6;      // N at contact (the magnet weighs ≈ 0.25 N)
  const MAG_RANGE = 0.03; // m
  let magStuck = false;
  function applyMagnetism(h) {
    if (!magnet.rb || !magnet.loose || !PH.surfaces.length || magnet.state === 'anim') return;
    const rb = magnet.rb; if (rb.isSleeping()) return;
    const t = rb.translation(), r = rb.rotation();
    _q1.set(r.x, r.y, r.z, r.w);
    _v3.set(0, 0, -1).applyQuaternion(_q1); // rubber-sheet side
    const frontNormal = _v3.clone().negate();
    let close = 0;
    for (const sf of PH.surfaces) {
      // A thin magnet rotates to put its rubber back against the steel. Forces
      // at its sampled points provide attraction; this bounded torque supplies
      // the missing normal alignment of the magnetic sheet.
      _v2.set(t.x,t.y,t.z).sub(sf.c);
      const centerDistance = _v2.dot(sf.n);
      if (centerDistance > -.004 && centerDistance < .035 && Math.abs(_v2.dot(sf.u)) < sf.w/2 && Math.abs(_v2.dot(sf.v)) < sf.h/2) {
        const axis = new THREE.Vector3().crossVectors(frontNormal,sf.n);
        const sine = axis.length(), cosine = clamp(frontNormal.dot(sf.n),-1,1);
        const angle = Math.atan2(sine,cosine);
        if (sine > 1e-5) axis.multiplyScalar(1/sine); else axis.copy(sf.u);
        const av=rb.angvel(), normalSpin=av.x*sf.n.x+av.y*sf.n.y+av.z*sf.n.z;
        const inertia=rb.mass()*(magHalfX*magHalfX+magHalfY*magHalfY)/6;
        const strength=(HOLD.body===magnet&&HOLD.mode==='surface')?1:Math.max(0,1-centerDistance/.035);
        const torque=new THREE.Vector3(axis.x*angle*900-60*(av.x-normalSpin*sf.n.x),axis.y*angle*900-60*(av.y-normalSpin*sf.n.y),axis.z*angle*900-60*(av.z-normalSpin*sf.n.z)).multiplyScalar(inertia*strength);
        if(torque.length()>.004)torque.setLength(.004);
        rb.applyTorqueImpulse({x:torque.x*h,y:torque.y*h,z:torque.z*h},true);
      }
      const align = -_v3.dot(sf.n), s = 0.2 + 0.8 * Math.max(0, align);
      for (const [x, y] of MAG_PTS) {
        _v1.set(x, y, 0).applyQuaternion(_q1); _v1.x += t.x; _v1.y += t.y; _v1.z += t.z;
        _v2.copy(_v1).sub(sf.c);
        const d = _v2.dot(sf.n), uu = _v2.dot(sf.u), vv = _v2.dot(sf.v);
        if (d < -0.004 || d > MAG_RANGE || Math.abs(uu) > sf.w / 2 + 0.004 || Math.abs(vv) > sf.h / 2 + 0.004) continue;
        const q = Math.max(0, d) / 0.004, f = (MAG_F / MAG_PTS.length) * s / ((1 + q * q) * (1 + q * q));
        _phV.x = -sf.n.x * f * h; _phV.y = -sf.n.y * f * h; _phV.z = -sf.n.z * f * h;
        _phP.x = _v1.x; _phP.y = _v1.y; _phP.z = _v1.z;
        rb.applyImpulseAtPoint(_phV, _phP, true);
        if (d < 1.2 * MM && align > 0.85) close++;
      }
    }
    const stuck = close >= 4;
    if (stuck && !magStuck) { emit('magnetSnap'); haptic(22); if (fridge.group) doorThunkT = 0; }
    if (!stuck && magStuck) emit('magnetRelease');
    magStuck = stuck;
    S.magnetOnFridge = stuck;
  }

  // The shader bends the visible magnet, while Rapier hulls remain rigid.
  // Project that same deformed surface against the tabletop after each CCD step.
  const contactSamples = [];
  for (const [x,y] of resampleClosed(outline, .6*MM)) for(const z of [0,zArt]) contactSamples.push([x,y,z]);
  for(let x=ob.minX;x<=ob.maxX;x+=.003) for(let y=ob.minY;y<=ob.maxY;y+=.003) if(sdfAt(x,y)<0) contactSamples.push([x,y,0],[x,y,zArt]);
  const tableContact = PH.boxes.find(b=>b.support && Math.abs(b.max.y)<.001);
  let magnetContactCalm = 0;
  function resolveMagnetTable() {
    const b=magnet,rb=b.rb,box=tableContact;
    if(!b.loose || !rb || !box || ['anim','flip','reset'].includes(b.state)) { magnetContactCalm=0; return; }
    if(rb.isSleeping() && !b.bend.active && Math.abs(b.bend.k)<1e-4) return;
    const t=rb.translation(); if(t.y > .08) { magnetContactCalm=0; return; }
    const r=rb.rotation(),bd=b.bend,k=bd.k;
    _q1.set(r.x,r.y,r.z,r.w); let lift=0,clearance=Infinity;
    for(const [x,y,z] of contactSamples) {
      _v1.set(x,y,z);
      if(Math.abs(k)>1e-4) {
        const px=-bd.D.y,py=bd.D.x,dx=x-bd.C.x,dy=y-bd.C.y;
        const u=dx*px+dy*py,a=dx*bd.D.x+dy*bd.D.y,R=1/k,bz=z-bd.C.z;
        const w=(R-bz)*Math.sin(u*k);
        _v1.set(bd.C.x+bd.D.x*a+px*w,bd.C.y+bd.D.y*a+py*w,bd.C.z+R-(R-bz)*Math.cos(u*k));
      }
      _v1.applyQuaternion(_q1).add(t);
      if(_v1.x>=box.min.x && _v1.x<=box.max.x && _v1.z>=box.min.z && _v1.z<=box.max.z) { clearance=Math.min(clearance,_v1.y-box.max.y); lift=Math.max(lift,box.max.y+.00015-_v1.y); }
    }
    if(lift>1e-6) {
      rb.setTranslation({x:t.x,y:t.y+lift,z:t.z},false);
      const v=rb.linvel();if(v.y<0) rb.setLinvel({x:v.x,y:0,z:v.z},false);
    }
    // Contact projection also needs tangential friction: otherwise a thin, tilted
    // edge keeps rocking in the tiny gap above its rigid collision hull.
    if(HOLD.body!==b && !bd.active && clearance<.0004) {
      const v=rb.linvel(),w=rb.angvel();
      if(Math.hypot(v.x,v.y,v.z)<.05) {
        const linear=Math.exp(-6*PH.h),angular=Math.exp(-10*PH.h);
        rb.setLinvel({x:v.x*linear,y:v.y,z:v.z*linear},false);
        rb.setAngvel({x:w.x*angular,y:w.y*angular,z:w.z*angular},false);
      }
    }
    const v=rb.linvel(),w=rb.angvel();
    const still=HOLD.body!==b && !bd.active && Math.abs(k)<1e-4 && clearance<.0004 && Math.hypot(v.x,v.y,v.z)<.008 && Math.hypot(w.x,w.y,w.z)<.18;
    magnetContactCalm=still?magnetContactCalm+PH.h:0;
    if(magnetContactCalm>.6) rb.sleep();
  }
  function physicsStep(dt) {
    updateExclusions();
    PH.acc = Math.min(PH.acc + dt, 0.05);
    let n = 0;
    while (PH.acc >= PH.h && n < 12) {
      applyHold(PH.h);
      applyMagnetism(PH.h);
      PH.world.step();
      resolveMagnetTable();
      PH.acc -= PH.h; n++;
    }
    for (let i = 0; i < BODIES.length; i++) {
      const b = BODIES[i];
      if (b.loose && b.rb && !['anim', 'flip', 'reset'].includes(b.state)) syncFromRB(b);
    }
  }

  // Explicit poses are used only for the initial layout and short assisted unpack/flip actions.
  // Free objects always receive their pose from Rapier.
  function composePose(b) {
    b.root.position.set(b.x, b.y, b.z);
    b.root.quaternion.setFromAxisAngle(AX_Y, b.psi)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AX_X, -HALF_PI))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AX_Y, b.flipA));
    b.root.updateMatrix();
  }
  function setBodyPose(b, p, q) {
    b.root.position.copy(p); b.root.quaternion.copy(q); b.root.updateMatrix();
    if (b.rb) {
      b.rb.setTranslation(p, true); b.rb.setRotation(q, true);
      b.rb.setNextKinematicTranslation(p); b.rb.setNextKinematicRotation(q);
    }
    b.x = p.x; b.y = p.y; b.z = p.z;
  }
  function stepBody(b, dt) {
    const a = b.anim; if (!a || (b.state !== 'anim' && b.state !== 'flip')) return;
    a.t = Math.min(1, a.t + dt / a.dur);
    const e = easeInOutCubic(a.t);
    const p = a.p0.clone().lerp(a.p1, e); p.y += Math.sin(PI * a.t) * a.h;
    const q = a.q0.clone().slerp(a.q1, e);
    setBodyPose(b, p, q);
    if (a.t >= 1) {
      b.anim = null; b.state = 'dyn'; setKinematic(b, false);
      b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true); b.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      syncFromRB(b); if (a.done) a.done();
    }
  }

  // ==========================================================================
  // unpacking actions
  // ==========================================================================
  function animParam(name, to, dur, done) {
    const from = name === 'flap' ? S.flapTheta : name === 'slide' ? S.slide : S.hingePhi;
    anims[name] = { from, to, t: 0, dur: Math.max(0.05, dur * Math.min(1, Math.abs(to - from) / (name === 'slide' ? sFree : PI) + 0.25)), done };
  }
  function setFlap(th) {
    S.flapTheta = clamp(th, 0, PI);
    updateFlapGeometry();
    // face-up the flap is under the bag: lift the bottom end so it can swing out
    const a = bag.flipped ? 0 : Math.asin(clamp((flapL * Math.sin(S.flapTheta) * 1.08) / bagL, 0, 0.5));
    bag.tilt.rotation.x = -a;
    bag.flapProxy.userData.pick.off = S.flapTheta < PI * 0.85;
    S.filmDirty = true;
  }
  function finishFlap() {
    if (S.flapTheta >= PI - 1e-3 && !S.flapOpen) { S.flapOpen = true; S.filmDirty = true; emit('flapOpen'); }
    else if (S.flapTheta <= 1e-3) { S.flapOpen = false; }
    setKinematic(bag, false);
  }
  function setSlide(s) {
    S.slide = Math.max(0, s);
    card.root.position.set(0, cardFoldY0 - S.slide, zCardInBag);
    S.filmDirty = true;
  }
  function releaseCard(dragging, ptrIn) {
    if (!S.cardInBag) return;
    const ptr = ptrIn ? _ptr.copy(ptrIn) : null;
    S.cardInBag = false;
    anims.slide = null;
    makeLoose(card);
    computeExtents(bag);
    S.emptyT = 0;
    if (dragging && ptr) {
      beginHold(card, ptr);
    }
    setKinematic(bag, false);
    emit('cardFree');
  }
  function phiMax() {
    if (S.cardMoving === 'back' && S.blisterInCard) return PI + Math.asin(clamp((zBubbleTop - zFrontOut) / cardH, 0, 0.3));
    return PI;
  }
  function beginOpening() {
    if (S.cardOpen || S.hingePhi > 1e-4) return;
    S.cardMoving = card.flipped ? 'back' : 'front';
    setKinematic(card, true);
    if (S.blisterInCard) {
      group.updateMatrixWorld(true);
      (S.cardMoving === 'front' ? card.backPivot : card.frontPivot).attach(blister.root);
    }
    dropDependents(card);
  }
  function applyHinge() {
    let fa = 0, ba = 0;
    if (S.cardMoving === 'front') fa = S.hingePhi; else if (S.cardMoving === 'back') ba = -S.hingePhi;
    card.frontPivot.rotation.x = fa; card.backPivot.rotation.x = ba;
    updateHingeStrip(fa, ba);
  }
  function setHinge(phi) { S.hingePhi = clamp(phi, 0, phiMax()); applyHinge(); }
  function finishHinge() {
    if (S.hingePhi >= PI - 1e-3) {
      if (!S.cardOpen) { S.cardOpen = true; computeExtents(card); card.state = card.loose ? 'fall' : card.state; emit('cardOpen'); }
    } else if (S.hingePhi <= 1e-4) {
      S.hingePhi = 0;
      if (S.cardOpen || S.cardMoving) {
        S.cardOpen = false; S.cardMoving = null;
        if (S.blisterInCard && blister.root.parent !== card.root) { group.updateMatrixWorld(true); card.root.attach(blister.root); }
        applyHinge(); computeExtents(card); emit('cardClose');
      }
    }
    if (card.rb) { buildColliders(card); setKinematic(card, false); }
  }
  function detachBlister() {
    if (!S.blisterInCard) return;
    S.blisterInCard = false;
    makeLoose(blister);
    computeExtents(card);
    if (card.loose && card.state === 'rest') { card.state = 'fall'; card.vy = 0; }
    emit('blisterFree');
  }
  function isBubbleDown() { return blister.root.matrixWorld.elements[9] < 0; }
  function freeSpot(b, nearX, nearZ, avoid) {
    const r = Math.max(b.ax1 - b.ax0, b.az1 - b.az0) * 0.5 + (avoid ? Math.max(avoid.ax1 - avoid.ax0, avoid.az1 - avoid.az0) * 0.5 : 0) + 10 * MM;
    const angs = [0, PI, -HALF_PI * 0.6, HALF_PI, PI + HALF_PI * 0.6, -HALF_PI, PI * 0.25, PI * 0.75];
    const sx = b.x, sz = b.z;
    let fallback = null;
    for (const a of angs) {
      b.tx = nearX + Math.cos(a) * r; b.tz = nearZ + Math.sin(a) * r;
      const tx0 = b.tx, tz0 = b.tz; clampTarget(b);
      if (Math.abs(b.tx - tx0) > 1e-4 || Math.abs(b.tz - tz0) > 1e-4) { if (!fallback) fallback = [b.tx, b.tz]; continue; }
      computeFpw(b, b.tx, b.tz);
      let clear = true;
      for (const o of BODIES) {
        if (o === b || !o.loose || o.state === 'fridge') continue;
        computeFpw(o, o.x, o.z);
        for (let p = 0; p < o.fps.length && clear; p++) for (let q = 0; q < b.fps.length; q++) if (obbOverlap(o.fpw[p], b.fpw[q])) { clear = false; break; }
        if (!clear) break;
      }
      if (clear) { b.x = sx; b.z = sz; return [b.tx, b.tz]; }
      if (!fallback) fallback = [b.tx, b.tz];
    }
    b.x = sx; b.z = sz;
    return fallback || [sx, sz];
  }
  function hopTo(b, x, z, h, dur, done) {
    if (HOLD.body === b) releaseHold(false);
    const p0 = b.root.position.clone(), q0 = b.root.quaternion.clone();
    const ground = groundAt(x, z, b.rb, Math.max(0.001, p0.y + 0.05));
    const q1 = new THREE.Quaternion().setFromAxisAngle(AX_Y, b.psi)
      .multiply(new THREE.Quaternion().setFromAxisAngle(AX_X, -HALF_PI))
      .multiply(new THREE.Quaternion().setFromAxisAngle(AX_Y, b.flipped ? PI : 0));
    b.anim = { t: 0, dur: dur || T.hopTime, p0, q0, q1,
      p1: new THREE.Vector3(x, ground + belowAt(b, b.flipped ? PI : 0) + 0.001, z),
      h: h === undefined ? T.hopArc : h, done };
    setKinematic(b, true);
    b.state = 'anim'; b.support = null;
  }
  function doPop(dragging, ptrIn) {
    if (!S.magnetInBlister) return;
    const ptr = ptrIn ? _ptr.copy(ptrIn) : null;
    group.updateMatrixWorld(true);
    const openingUp = isBubbleDown();
    S.magnetInBlister = false; S.popNudge = 0;
    makeLoose(magnet);
    blister.wX += 2.5; blister.wZ -= 1.5;
    if (openingUp) {
      if (dragging && ptr) { startCarry(magnet, ptr); magnet.y += 1.5 * MM; }
      else { const [x, z] = freeSpot(magnet, blister.x, blister.z, blister); hopTo(magnet, x, z, 0.03); }
    } else {
      // bubble up: the magnet stays on the table, the blister is lifted off and put aside
      const [x, z] = freeSpot(blister, magnet.x, magnet.z, magnet);
      hopTo(blister, x, z, 0.022);
      if (dragging && ptr) startCarry(magnet, ptr); else { magnet.state = 'fall'; magnet.vy = 0; }
    }
    emit('magnetPop'); haptic(14);
  }
  function startCarry(b, ptr) {
    beginHold(b, ptr);
  }
  function doFlip(b) {
    if (!b || resetAnim) return;
    if (b === magnet && b.state === 'fridge') { showTransient(HINTS.fridgeFlip); b.wX += 4; return; }
    if (b === card && (S.cardOpen || S.hingePhi > 1e-4) && S.blisterInCard) { showTransient(HINTS.flipBlocked); card.wZ += 2.5; return; }
    if (b === card && anims.hinge) return;
    if (b === bag && (anims.flap || anims.slide || (S.flapTheta > 1e-3 && S.flapTheta < PI - 1e-3))) return;
    if (!b.loose || !b.rb || b.state === 'anim' || b.state === 'flip') return;
    if (HOLD.body === b) releaseHold(false);
    const p0 = b.root.position.clone(), q0 = b.root.quaternion.clone();
    const q1 = q0.clone().multiply(new THREE.Quaternion().setFromAxisAngle(AX_Y, PI));
    const nextFlip = !b.flipped;
    const y1 = b.base + belowAt(b, nextFlip ? PI : 0) + 0.001;
    b.anim = { t: 0, dur: T.flipTime, p0, q0, q1, p1: new THREE.Vector3(b.x, y1, b.z), h: b.hw + T.flipArc };
    b.state = 'flip'; setKinematic(b, true);
    computeExtents(b);
    if (b === bag) setFlap(S.flapTheta);
    emit('flip', b.name);
  }

  // tap actions ---------------------------------------------------------------
  const tapPeel = () => { if (!S.flapOpen && !anims.flap) { setKinematic(bag, true); animParam('flap', PI, T.peelTime, finishFlap); } };
  const tapSlide = () => {
    if (!S.cardInBag || anims.slide) return;
    setKinematic(bag, true);
    animParam('slide', sFree + 2 * MM, T.slideTime, () => releaseCard(false));
  };
  const tapOpen = () => {
    if (S.cardInBag || anims.hinge || card.state === 'flip') return;
    if (!S.cardOpen) { beginOpening(); animParam('hinge', phiMax(), T.openTime, finishHinge); }
  };
  const tapLift = () => {
    if (!S.blisterInCard || !S.cardOpen) return;
    detachBlister();
    const [x, z] = freeSpot(blister, card.x, card.z, card);
    hopTo(blister, x, z, 0.03);
  };
  const tapPop = () => doPop(false, null);

  // ==========================================================================
  // pointer handling
  // ==========================================================================
  function rayToGroup() { _rayL.copy(G.rayW).applyMatrix4(_groupInv); }
  function intersectY(ray, y, out) {
    const dy = ray.direction.y; if (Math.abs(dy) < 1e-7) return false;
    const t = (y - ray.origin.y) / dy; if (t < 0) return false;
    out.copy(ray.direction).multiplyScalar(t).add(ray.origin); return true;
  }
  function intersectZ(ray, z, out) {
    const dz = ray.direction.z; if (Math.abs(dz) < 1e-7) return false;
    const t = (z - ray.origin.z) / dz; if (t < 0) return false;
    out.copy(ray.direction).multiplyScalar(t).add(ray.origin); return true;
  }
  function topLevel(b) {
    if (b === magnet && S.magnetInBlister) return topLevel(blister);
    if (b === blister && S.blisterInCard) return topLevel(card);
    if (b === card && S.cardInBag) return bag;
    return b;
  }
  /** bag-art-frame y of the pointer (on the table plane under the bag) */
  function pointerBagY() {
    rayToGroup();
    if (!intersectY(_rayL, bag.base + 1 * MM, _v1)) return null;
    _m1.copy(bag.root.matrix).invert();
    _v1.applyMatrix4(_m1);
    return _v1.y;
  }
  function rayPick(raycaster) {
    _hits.length = 0;
    raycaster.intersectObjects(pickables, false, _hits);
    let w = 0;
    for (let i = 0; i < _hits.length; i++) if (!_hits[i].object.userData.pick.off) _hits[w++] = _hits[i];
    _hits.length = w;
    return w;
  }
  function resolveHit(raycaster) {
    group.updateMatrixWorld(true);
    if (!rayPick(raycaster)) return null;
    let magHit = null;
    for (const h of _hits) if (h.object.userData.pick.body === magnet) { magHit = h; break; }
    const h0 = _hits[0];
    const P = h0.object.userData.pick;
    const point = h0.point.clone().applyMatrix4(_groupInv);
    const r = { body: P.body, part: P.part, point, kind: 'move', tap: null, flipBody: topLevel(P.body), target: topLevel(P.body).name };
    if (magHit && S.magnetOnFridge) {
      return { body: magnet, part: 'magnet', point: magHit.point.clone().applyMatrix4(_groupInv), kind: 'move', tap: null, flipBody: magnet, target: 'magnet' };
    }
    if (magHit && S.magnetInBlister && !S.blisterInCard) {
      return { body: magnet, part: 'magnet', point: magHit.point.clone().applyMatrix4(_groupInv), kind: 'pop', tap: tapPop, flipBody: blister, target: 'blister' };
    }
    const owner = topLevel(P.body);
    if (owner === bag) {
      const lp = h0.point.clone(); bag.content.worldToLocal(lp);
      if (!S.flapOpen) {
        if (lp.y < yBottom + flapL + 6 * MM && lp.y > yBottom - flapL - 2 * MM) { r.kind = 'peel'; r.tap = tapPeel; r.body = bag; }
        else { r.kind = 'move'; r.body = bag; r.tap = () => showTransient(HINTS.peelFirst); }
      } else if (S.cardInBag) {
        const fold = cardFoldY0 - S.slide;
        if (P.body !== bag || (Math.abs(lp.x) < cardW / 2 + 1 * MM && lp.y > fold - 1 * MM && lp.y < fold + cardH + 1 * MM)) { r.kind = 'slide'; r.tap = tapSlide; r.body = card; }
        else { r.kind = 'move'; r.body = bag; }
      } else { r.kind = 'move'; r.body = bag; }
      r.flipBody = bag;
      return r;
    }
    if (owner === card) {
      r.flipBody = card;
      const inBlister = P.body === blister || P.body === magnet;
      if (inBlister && S.cardOpen && S.blisterInCard) { r.kind = 'liftBlister'; r.tap = tapLift; r.body = blister; return r; }
      const lp = h0.point.clone(); card.root.worldToLocal(lp);
      if (!S.cardOpen && S.hingePhi < 1e-4) {
        const topPart = card.flipped ? 'back' : 'front';
        if ((P.part === topPart || inBlister) && lp.y > cardH * 0.62) r.kind = 'hinge'; else r.kind = 'move';
        r.tap = tapOpen; r.body = card;
      } else {
        const movedPart = S.cardMoving === 'back' ? 'back' : 'front';
        const insidesUp = S.cardMoving === 'back' ? card.flipped : !card.flipped;
        if (P.part === movedPart && lp.y < -cardH * 0.62 && !anims.hinge) {
          r.kind = insidesUp ? 'hinge' : 'move';
          if (!insidesUp) r.tap = () => showTransient(HINTS.closeFlipped);
        } else r.kind = 'move';
        r.body = card;
      }
      return r;
    }
    r.body = owner; r.kind = 'move'; r.flipBody = owner;
    return r;
  }

  function startGesture() {
    G.started = true;
    const h = G.hit;
    rayToGroup();
    switch (G.kind) {
      case 'move': {
        const b = h.body;
        if (!b.loose || b.state === 'anim' || b.state === 'flip') { G.kind = 'none'; break; }
        _v1.copy(h.point);
        startCarry(b, _v1);
        break;
      }
      case 'peel': { anims.flap = null; setKinematic(bag, true); G.p0 = pointerBagY() ?? 0; G.theta0 = S.flapTheta; break; }
      case 'slide': { anims.slide = null; setKinematic(bag, true); G.p0 = pointerBagY() ?? 0; G.s0 = S.slide; break; }
      case 'hinge': {
        anims.hinge = null;
        beginOpening();
        group.updateMatrixWorld(true);
        _v1.copy(h.point).applyMatrix4(group.matrixWorld); card.root.worldToLocal(_v1);
        // grabbed point in the moving panel's own frame (undo the current hinge angle)
        G.hingeR = Math.max(10 * MM, Math.hypot(_v1.y, _v1.z - zHinge));
        G.hingeX = _v1.x;
        G.phi0 = S.hingePhi;
        G.hingeClosing = S.hingePhi > HALF_PI;
        const hp = hingePointer(S.hingePhi);
        G.ptrLast = hp.arc; G.ptr0 = hingeCombined(hp);
        break;
      }
      case 'liftBlister': {
        detachBlister();
        startCarry(blister, h.point);
        break;
      }
      case 'pop': { G.popX0 = h.point.x; G.popZ0 = h.point.z; G.popY = h.point.y; break; }
      default: break;
    }
  }
  /** Hinge angle that puts the grabbed point of the moving panel closest to the pointer ray.
   *  The grabbed point travels on a circle (radius hingeR) around the fold axis; we search that
   *  arc for the smallest angular distance to the ray, with a slight bias toward `prefer` so the
   *  panel never jumps between two equally good solutions. Works for any camera angle. */
  // Hinge drag mapping. Two estimates of the panel angle from the pointer:
  //  • arc:  the angle whose grabbed point (on a circle of radius hingeR around the fold) lies
  //          closest to the pointer ray, searched locally around the previous value (no jumps);
  //  • pull: the pointer's hit on the card plane, read as "where along the card the edge is
  //          being pulled to" (acos(y / R)) — this is what a straight drag toward/away from the
  //          viewer means, even though a lifting edge first moves the other way on screen.
  // While opening the larger one wins, while closing the smaller one.
  const HS = { prefer: 0, sign: 1, arc: 0, pull: 0, hasPull: false };
  function hingeScore(phi) {
    const o = _rayC.origin, d = _rayC.direction, R = G.hingeR;
    const ex = G.hingeX - o.x, ey = R * Math.cos(phi) - o.y, ez = zHinge + HS.sign * R * Math.sin(phi) - o.z;
    const l = Math.hypot(ex, ey, ez) || 1;
    return Math.acos(clamp((ex * d.x + ey * d.y + ez * d.z) / l, -1, 1)) + 0.01 * Math.abs(phi - HS.prefer);
  }
  function hingePointer(prefer) {
    _m1.copy(card.root.matrixWorld).invert();
    _rayC.copy(G.rayW).applyMatrix4(_m1);
    HS.prefer = prefer; HS.sign = S.cardMoving === 'back' ? -1 : 1;
    const top = phiMax() + 0.05, N = 24;
    const lo0 = Math.max(0, prefer - 0.45), hi0 = Math.min(top, prefer + 0.45);
    let best = prefer, bestS = Infinity;
    for (let k = 0; k <= N; k++) { const phi = lo0 + (k / N) * (hi0 - lo0), s = hingeScore(phi); if (s < bestS) { bestS = s; best = phi; } }
    const st = (hi0 - lo0) / N;
    let lo = Math.max(lo0, best - st), hi = Math.min(hi0, best + st);
    for (let it = 0; it < 14; it++) {
      const m1 = hi - (hi - lo) * 0.618, m2 = lo + (hi - lo) * 0.618;
      if (hingeScore(m1) < hingeScore(m2)) hi = m2; else lo = m1;
    }
    HS.arc = (lo + hi) * 0.5;
    HS.prefer = HS.arc; HS.residual = hingeScore(HS.arc); // pure angular miss of the pointer ray
    HS.hasPull = false;
    const o = _rayC.origin, d = _rayC.direction;
    if (Math.abs(d.z) > 1e-7) {
      const t = (zHinge - o.z) / d.z;
      if (t > 0) { HS.pull = Math.acos(clamp((o.y + d.y * t) / G.hingeR, -1, 1)); HS.hasPull = true; }
    }
    return HS;
  }
  function hingeCombined(h) {
    if (!h.hasPull) return h.arc;
    const ext = G.hingeClosing ? Math.min(h.arc, h.pull) : Math.max(h.arc, h.pull);
    const w = smoothstep(0.025, 0.07, h.residual); // pointer clearly off the edge's path → "pull"
    return h.arc + (ext - h.arc) * w;
  }
  function updateGesture() {
    if (!G.active || !G.started) return;
    rayToGroup();
    switch (G.kind) {
      case 'move': {
        updateHoldTarget();
        break;
      }
      case 'peel': {
        const py = pointerBagY(); if (py === null) break;
        const tip = yBottom + flapL * Math.cos(G.theta0) + (py - G.p0);
        setFlap(Math.acos(clamp((tip - yBottom) / flapL, -1, 1)));
        break;
      }
      case 'slide': {
        const py = pointerBagY(); if (py === null) break;
        setSlide(G.s0 + (G.p0 - py));
        computeExtents(bag);
        if (S.slide >= sFree) {
          rayToGroup();
          group.updateMatrixWorld(true);
          card.root.getWorldPosition(_v2); _v2.applyMatrix4(_groupInv);
          if (intersectY(_rayL, _v2.y + zFrontOut, _v1)) releaseCard(true, _v1);
          else releaseCard(false);
        }
        break;
      }
      case 'hinge': {
        const hp = hingePointer(G.ptrLast);
        G.ptrLast = hp.arc;
        const target = G.phi0 + (hingeCombined(hp) - G.ptr0);
        setHinge(S.hingePhi + clamp(target - S.hingePhi, -0.3, 0.3)); // never jump, at most swing fast
        break;
      }
      case 'pop': {
        if (!S.magnetInBlister) break;
        if (!intersectY(_rayL, G.popY, _v1)) break;
        const d = Math.hypot(_v1.x - G.popX0, _v1.z - G.popZ0);
        S.popNudge = clamp(d / T.popDistance, 0, 1);
        if (d > T.popDistance) doPop(true, _v1);
        break;
      }
      default: break;
    }
  }
  function endGesture() {
    switch (G.kind) {
      case 'move': {
        releaseHold(true);
        break;
      }
      case 'peel': {
        if (S.flapTheta >= T.flapCommit * PI) animParam('flap', PI, T.peelTime * 0.6, finishFlap);
        else animParam('flap', 0, 0.35, finishFlap);
        break;
      }
      case 'slide': setKinematic(bag, false); break;
      case 'hinge': {
        // commit in the direction the gesture was going once it is past the threshold
        const open = G.hingeClosing ? S.hingePhi > phiMax() - T.hingeCommit : S.hingePhi > T.hingeCommit;
        if (open) animParam('hinge', phiMax(), T.openTime * 0.6, finishHinge);
        else animParam('hinge', 0, 0.4, finishHinge);
        break;
      }
      case 'pop': S.popNudge = 0; break;
      case 'fridge': break;
      default: break;
    }
  }

  // ---- bending gestures: two fingers on one item, right-mouse drag, or wheel over an item ----
  const bendRays = new Map(); // pointerId → world Ray (two-finger bend)
  function bendable(b) { return b && b.loose && b.state !== 'fridge' && b.state !== 'anim' && b.state !== 'flip' && !resetAnim; }
  /** art-frame point of a world ray on the body's mid plane */
  function rayToArt(b, rayW, out) {
    _m1.copy(b.root.matrixWorld).invert();
    _rayC.copy(rayW).applyMatrix4(_m1);
    return intersectZ(_rayC, midZ(b), out);
  }
  function midZ(b) { return (b.zMin + b.zMax) * 0.5; }
  function beginTwoFingerBend(b, id1, ray1, id2, ray2) {
    bendRays.clear(); bendRays.set(id1, ray1.clone()); bendRays.set(id2, ray2.clone());
    if (!rayToArt(b, ray1, _v3) || !rayToArt(b, ray2, _v4)) return false;
    const d = Math.hypot(_v4.x - _v3.x, _v4.y - _v3.y);
    if (d < 4 * MM) return false;
    setBendFrame(b, (_v3.x + _v4.x) / 2, (_v3.y + _v4.y) / 2, midZ(b), _v4.x - _v3.x, _v4.y - _v3.y);
    G.bendD0 = d; G.bendK0 = b.bend.k; b.bend.active = true; b.bend.target = b.bend.k;
    return true;
  }
  function updateBend() {
    const b = G.body; if (!b || !b.bend.active) return;
    if (G.kind === 'bend2') {
      if(HOLD.body===b) { rayToGroup(); updateHoldTarget(); }
      let i = 0;
      for (const r of bendRays.values()) { if (!rayToArt(b, r, i === 0 ? _v3 : _v4)) return; i++; }
      const d = Math.hypot(_v4.x - _v3.x, _v4.y - _v3.y);
      b.bend.target = clamp(G.bendK0 + ((G.bendD0 - d) / G.bendD0) * 5 * b.bend.kMax, -b.bend.kMax, b.bend.kMax);
    }
  }
  function endBend() {
    if (G.body && G.body.bend) G.body.bend.active = false;
    bendRays.clear();
  }
  function wheel(info, deltaY) {
    if (resetAnim || G.active || !info || !info.raycaster) return false;
    _groupInv.copy(group.matrixWorld).invert();
    const hit = resolveHit(info.raycaster);
    if (!hit || !bendable(hit.flipBody)) return false;
    const b = hit.flipBody;
    _v1.copy(hit.point); _m1.copy(b.root.matrix).invert(); _v1.applyMatrix4(_m1);
    if (Math.abs(b.bend.k) < 0.05 * b.bend.kMax) setBendFrame(b, _v1.x, _v1.y, midZ(b), 1, 0);
    b.bend.k = clamp(b.bend.k + clamp(-deltaY, -300, 300) / 100 * 0.45 * b.bend.kMax, -b.bend.kMax, b.bend.kMax);
    b.bend.kv = 0;
    return true;
  }

  function pointerDown(info) {
    if (resetAnim) return false;
    _groupInv.copy(group.matrixWorld).invert();
    if (G.active) {
      // a second finger on the same item turns the gesture into a bend
      if (info.pointerId === G.id || G.kind === 'bend2' || G.kind === 'bendMouse') return false;
      const hit2 = resolveHit(info.raycaster);
      const b = G.hit && G.hit.flipBody;
      if (!hit2 || hit2.flipBody !== b || !bendable(b)) return false;
      // finish whatever the first finger was doing, gently
      if (G.started) { updateGesture(); if(G.kind==='move') releaseHold(false); else endGesture(); }
      if (b.state === 'drag') { b.state = 'fall'; b.vy = 0; }
      pendingTap = null;
      if (!beginTwoFingerBend(b, G.id, G.rayW, info.pointerId, info.raycaster.ray)) return false;
      if(rayToArt(b,G.rayW,_v3)) { _v3.applyMatrix4(b.root.matrix); beginHold(b,_v3); HOLD.raw.copy(HOLD.target); }
      G.kind = 'bend2'; G.body = b; G.started = true; G.id2 = info.pointerId;
      return true;
    }
    const btn = info.button === undefined ? 0 : info.button;
    if (btn !== 0 && btn !== 2) return false;
    const hit = resolveHit(info.raycaster);
    if (!hit) return false;
    if (btn === 2) { // desktop fallback for the two-finger bend: right-drag up/down
      const b = hit.flipBody; if (!bendable(b)) return false;
      _v1.copy(hit.point); _m1.copy(b.root.matrix).invert(); _v1.applyMatrix4(_m1);
      setBendFrame(b, _v1.x, _v1.y, midZ(b), 1, 0);
      b.bend.active = true; b.bend.target = b.bend.k; G.bendK0 = b.bend.k;
      G.active = true; G.id = info.pointerId; G.id2 = -1; G.kind = 'bendMouse'; G.started = true; G.body = b; G.hit = hit;
      G.x0 = info.clientX; G.y0 = info.clientY; G.rayW.copy(info.raycaster.ray);
      setCursor('grabbing');
      return true;
    }
    lastPointerType = info.pointerType || 'mouse';
    const tme = Number.isFinite(info.time) ? info.time : performance.now() / 1000;
    const dbl = !!info.dblclick || (tme - lastDown.t < T.dblClickTime && Math.hypot(info.clientX - lastDown.x, info.clientY - lastDown.y) < 16 && lastDown.target === hit.target);
    lastDown = { t: dbl ? -10 : tme, x: info.clientX, y: info.clientY, target: hit.target };
    G.active = true; G.id = info.pointerId; G.started = false; G.x0 = info.clientX; G.y0 = info.clientY; G.t0 = tme; G.downAt = now;
    G.hit = hit; G.kind = hit.kind; G.body = hit.body;
    G.rayW.copy(info.raycaster.ray);
    if (dbl) { pendingTap = null; doFlip(hit.flipBody); G.kind = 'consumed'; }
    setCursor('grabbing');
    return true;
  }
  function pointerMove(info) {
    if (G.active && G.kind === 'bend2' && bendRays.has(info.pointerId)) {
      bendRays.get(info.pointerId).copy(info.raycaster.ray);
      if (info.pointerId === G.id) G.rayW.copy(info.raycaster.ray);
      return;
    }
    if (!G.active || info.pointerId !== G.id) { if (!G.active) hover(info); return; }
    G.rayW.copy(info.raycaster.ray);
    if (G.kind === 'bendMouse') {
      const b = G.body;
      b.bend.target = clamp(G.bendK0 + ((G.y0 - info.clientY) / 110) * b.bend.kMax, -b.bend.kMax, b.bend.kMax);
      return;
    }
    if (G.kind === 'consumed') return;
    if (!G.started && Math.hypot(info.clientX - G.x0, info.clientY - G.y0) > T.dragStartPx) { _groupInv.copy(group.matrixWorld).invert(); startGesture(); }
  }
  function pointerUp(info) {
    if (!G.active) return;
    if (info.cancelled) {
      pendingTap = null; endBend();
      if (G.started && G.kind !== 'move') endGesture();
      releaseHold(false); G.active = false; G.started = false; G.kind = ''; setCursor(''); return;
    }
    if (G.kind === 'bend2') {
      if (!bendRays.has(info.pointerId) && info.pointerId !== G.id && info.pointerId !== G.id2) return;
      // Keep the remaining finger's contact, so bending can flow directly into dragging.
      const other = info.pointerId === G.id ? G.id2 : G.id;
      const remainingRay = bendRays.get(other)?.clone(), b=G.body;
      endBend();
      G.id = other; G.id2 = -1;
      if(remainingRay && rayToArt(b,remainingRay,_v3)) {
        G.rayW.copy(remainingRay); _v3.applyMatrix4(b.root.matrix); beginHold(b,_v3); HOLD.raw.copy(HOLD.target); G.started=true;
      } else { releaseHold(false); G.kind='consumed'; }
      return;
    }
    if (info.pointerId !== undefined && info.pointerId !== G.id) return;
    if (G.kind === 'bendMouse') { endBend(); G.active = false; G.kind = ''; setCursor(cursorFor(info)); return; }
    if (info.raycaster) G.rayW.copy(info.raycaster.ray);
    const tme = Number.isFinite(info.time) ? info.time : performance.now() / 1000;
    if (G.kind !== 'consumed') {
      if (info.dblclick) { pendingTap = null; doFlip(G.hit.flipBody); }
      else if (G.started) { _groupInv.copy(group.matrixWorld).invert(); updateGesture(); endGesture(); }
      else if (tme - G.t0 < T.tapMaxTime + 0.5 && Math.hypot(info.clientX - G.x0, info.clientY - G.y0) <= T.tapMaxPx && G.hit.tap) {
        pendingTap = { fn: G.hit.tap, at: now + T.dblClickTime };
      }
    }
    G.active = false; G.started = false; G.kind = '';
    setCursor(cursorFor(info));
  }
  function cursorFor(info) {
    if (!info || !info.raycaster) return '';
    return rayPick(info.raycaster) ? 'grab' : '';
  }
  function hover(info) { if (!G.active && info && info.raycaster) setCursor(cursorFor(info)); }
  function setCursor(c) {
    if (opts.cursor === false || !ctx.domElement || !ctx.domElement.style) return;
    if (c !== cursorState) { cursorState = c; ctx.domElement.style.cursor = c; }
  }

  // ==========================================================================
  // film drape
  // ==========================================================================
  function updateFilm() {
    const fl = film, P = fl.pos, N = fl.nor, nx = fl.nx, ny = fl.ny;
    const fold = cardFoldY0 - S.slide, fill = S.cardInBag ? S.fill : S.fill * 0;
    const ampE = lerp(T.crinkleSealed, T.crinkleEmpty, S.emptyT), cp = Math.cos(S.flutter), sp = Math.sin(S.flutter);
    const open = S.flapTheta > 0.2 ? 1 : 0;
    for (let k = 0, cnt = nx * ny; k < cnt; k++) {
      const x = P[k * 3], y = P[k * 3 + 1];
      let h = 0;
      if (fill > 0) h = sampleDrape(x, y - fold) * fill;
      const loose = 1 - smoothstep(0.15 * MM, 0.9 * MM, h);
      const e = fl.env[k] * lerp(fl.envB[k], 1, open);
      const ea = lerp(fl.edgeAmp[k], 1, S.emptyT * 0.45);
      const cr = (fl.crA[k] * cp + fl.crB[k] * sp) * lerp(T.crinkleSealed, ampE, loose) * ea;
      const z = zFilmBase + (h + Math.max(0, cr + ampE * 0.6 * ea) * (0.35 + 0.65 * loose) + S.emptyT * fl.puff[k] * 0.3 * MM) * e;
      P[k * 3 + 2] = z;
    }
    // normals from the height grid
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i, il = i > 0 ? k - 1 : k, ir = i < nx - 1 ? k + 1 : k, jd = j > 0 ? k - nx : k, ju = j < ny - 1 ? k + nx : k;
      const dx = P[ir * 3] - P[il * 3], dzx = P[ir * 3 + 2] - P[il * 3 + 2];
      const dy = P[ju * 3 + 1] - P[jd * 3 + 1], dzy = P[ju * 3 + 2] - P[jd * 3 + 2];
      let a = -dzx * dy, b = -dx * dzy, c = dx * dy; const l = Math.hypot(a, b, c) || 1;
      N[k * 3] = a / l; N[k * 3 + 1] = b / l; N[k * 3 + 2] = c / l;
    }
    fl.geo.attributes.position.needsUpdate = true; fl.geo.attributes.normal.needsUpdate = true;
  }

  // ==========================================================================
  // shadows, render order, hints
  // ==========================================================================
  function updateShadow(b) {
    const sh = b.shadow; if (!sh) return;
    const m = sh.mesh;
    let show = false, alpha = 0, sx = 1, sy = 1;
    if (resetAnim) { m.visible = false; return; }
    if (b === magnet && b.state === 'fridge' && b.fr) {
      const fr = b.fr, e = fr.snapT;
      m.position.set(fr.x, fr.y - 0.8 * MM, F.z + 0.05 * MM);
      _q1.set(0, 0, 0, 1); m.quaternion.copy(_q1);
      m.scale.set(sh.ex * 1.02, sh.ey * 1.02, 1);
      m.material.opacity = T.shadowOpacity * sh.alpha * 0.8 * e;
      m.visible = e > 0.02;
      return;
    }
    if (b.loose && b.state !== 'fridge') {
      show = true;
      const lift = Math.max(0, b.y - (b.base + belowAt(b, b.flipA)));
      alpha = T.shadowOpacity * sh.alpha * Math.exp(-lift / 0.022);
      sx = sy = 1 + lift * 6;
      const cx = (b.ax0 + b.ax1) * 0.5 * (b.flipped ? -1 : 1), cz = (b.az0 + b.az1) * 0.5, c = Math.cos(b.psi), s = Math.sin(b.psi);
      m.position.set(b.x + cx * c + cz * s, b.base + 0.06 * MM, b.z - cx * s + cz * c);
      _q1.setFromAxisAngle(AX_Y, b.psi); _q2.setFromAxisAngle(AX_X, -HALF_PI); m.quaternion.copy(_q1).multiply(_q2);
      let ex = sh.ex, ey = sh.ey;
      if (b === card && (S.cardOpen || S.hingePhi > 1e-3)) ey = sh.ey * (1 + Math.min(1, S.hingePhi / PI));
      if (b === blister && b.flipped) alpha *= 0.8;
      m.scale.set(ex * sx * (b.flipped && b === magnet ? -1 : 1), ey * sy, 1);
    } else if (b === card && S.cardInBag) {
      show = true;
      _v1.set(0, cardH / 2, 0); card.root.localToWorld(_v1); _v1.applyMatrix4(_groupInv);
      m.position.set(_v1.x, bag.base + 0.07 * MM, _v1.z);
      const lift = Math.max(0, bag.y - (bag.base + belowAt(bag, bag.flipA)));
      alpha = T.shadowOpacity * sh.alpha * Math.exp(-lift / 0.022);
      sx = 1 + lift * 6;
      _q1.setFromAxisAngle(AX_Y, bag.psi); _q2.setFromAxisAngle(AX_X, -HALF_PI); m.quaternion.copy(_q1).multiply(_q2);
      m.scale.set(sh.ex * sx, sh.ey * sx, 1);
    }
    m.visible = show && alpha > 0.003;
    m.material.opacity = alpha;
  }
  function updateRenderOrder() {
    for (let i = 0; i < transparentMeshes.length; i++) {
      const t = transparentMeshes[i];
      _v1.copy(t.local).applyMatrix4(t.mesh.matrixWorld).applyMatrix4(_groupInv);
      t.mesh.renderOrder = 10 + Math.round(clamp(_v1.y, -0.01, 0.2) / (0.15 * MM));
    }
  }
  function stageName() {
    if (S.magnetOnFridge) return 'onFridge';
    if (!S.magnetInBlister) return 'magnetFree';
    if (!S.blisterInCard) return 'blisterFree';
    if (S.cardOpen) return 'cardOpen';
    if (!S.cardInBag) return 'cardOut';
    if (S.flapOpen) return 'flapOpen';
    return 'sealed';
  }
  function showTransient(text) { transientHint = text; transientUntil = now + 2.6; updateHint(); }
  function updateHint() {
    let h = HINTS[stageName()];
    if (transientHint && now < transientUntil) h = transientHint; else transientHint = null;
    if (h !== lastHint) { lastHint = h; if (onHint) { try { onHint(h); } catch (e) { console.warn(e); } } }
  }
  function emit(name, data) { if (onEvent) { try { onEvent(name, data); } catch (e) { console.warn(e); } } }
  function haptic(ms) {
    if (opts.haptics === false || lastPointerType !== 'touch') return;
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ }
  }

  // ==========================================================================
  // packed layout, reset
  // ==========================================================================
  group.add(bag.root);
  bag.content.add(card.root);
  card.root.add(blister.root);
  blister.root.add(magnet.root);
  const packed = new Map();
  function setPackedHierarchy() {
    group.add(bag.root);
    bag.content.add(card.root);
    card.root.add(blister.root);
    blister.root.add(magnet.root);
    card.root.position.set(0, cardFoldY0, zCardInBag); card.root.quaternion.identity();
    blister.root.position.set(magC[0], magC[1], zBackIn); blister.root.quaternion.identity();
    magnet.root.position.set(0, 0, 0); magnet.root.quaternion.identity();
    card.frontPivot.rotation.set(0, 0, 0); card.backPivot.rotation.set(0, 0, 0);
    bag.tilt.rotation.set(0, 0, 0);
  }
  function hardReset() {
    releaseHold(false);
    for (const b of BODIES) removeRB(b);
    noCollide.length = 0; PH.acc = 0; magStuck = false;
    resetAnim = null;
    for (const k of Object.keys(anims)) anims[k] = null;
    initialState();
    setPackedHierarchy();
    for (const b of BODIES) {
      b.state = 'rest'; b.loose = false; b.flipped = false; b.flipA = 0; b.psi = 0; b.vy = 0; b.support = null; b.anim = null;
      if (b.bend) { b.bend.k = 0; b.bend.kv = 0; b.bend.active = false; }
      b.tiltX = b.tiltZ = b.wX = b.wZ = 0; b.vx = b.vz = 0; b.blendT = 1; if (b.fr) { b.fr.snapT = 1; b.fr.thunkT = -1; }
    }
    bag.loose = true; bag.x = bag.tx = pkg.x; bag.z = bag.tz = pkg.z; bag.psi = pkg.yaw;
    for (const b of BODIES) computeExtents(b);
    bag.base = 0; bag.y = belowAt(bag, 0);
    setFlap(0); setSlide(0); applyHinge();
    if (fridge.group) fridge.group.position.z = F.z;
    doorThunkT = -1;
    composePose(bag, 1);
    createRB(bag);
    group.updateMatrixWorld(true);
    S.filmDirty = true; updateFilm();
    pendingTap = null; transientHint = null;
    G.active = false; G.started = false; G.kind = '';
    updateHint();
  }
  hardReset();
  for (const b of BODIES) {
    b.root.updateMatrixWorld(true);
    _m1.copy(group.matrixWorld).invert().multiply(b.root.matrixWorld);
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    _m1.decompose(p, q, s);
    packed.set(b, { p, q });
  }

  function reset() {
    pendingTap = null; transientHint = null;
    endBend();
    releaseHold(false);
    for (const b of BODIES) if (b.bend) { b.bend.k = 0; b.bend.kv = 0; b.bend.active = false; }
    updateBendUniforms();
    G.active = false; G.started = false; G.kind = '';
    const already = stageName() === 'sealed' && S.flapTheta < 1e-3 && !bag.flipped && Math.hypot(bag.x - pkg.x, bag.z - pkg.z) < 1e-4 && bag.state === 'rest';
    if (!(T.resetTime > 0) || opts.animateReset === false || already) { hardReset(); emit('reset'); return; }
    group.updateMatrixWorld(true);
    const items = [];
    const order = [magnet, blister, card, bag];
    for (const b of order) {
      if (b.root.parent !== group) group.attach(b.root);
      const pk = packed.get(b);
      items.push({ b, p0: b.root.position.clone(), q0: b.root.quaternion.clone(), p1: pk.p, q1: pk.q });
      b.state = 'reset'; b.loose = false;
      removeRB(b);
    }
    resetAnim = { t: 0, items, phi0: S.hingePhi, theta0: S.flapTheta, empty0: S.emptyT };
    for (const k of Object.keys(anims)) anims[k] = null;
    emit('resetStart');
  }
  function stepReset(dt) {
    const R = resetAnim;
    R.t = Math.min(1, R.t + dt / T.resetTime);
    const win = { magnet: [0.0, 0.6], blister: [0.04, 0.62], card: [0.1, 0.68], bag: [0.0, 0.5] };
    for (const it of R.items) {
      const [a, b] = win[it.b.name];
      const e = easeInOutCubic(clamp((R.t - a) / (b - a), 0, 1));
      const dist = it.p0.distanceTo(it.p1);
      it.b.root.position.lerpVectors(it.p0, it.p1, e);
      it.b.root.position.y += Math.sin(PI * e) * Math.min(0.04, dist * 0.35);
      it.b.root.quaternion.slerpQuaternions(it.q0, it.q1, e);
    }
    S.hingePhi = R.phi0 * (1 - easeInOutCubic(clamp((R.t - 0.1) / 0.5, 0, 1)));
    applyHinge();
    const ef = easeInOutCubic(clamp((R.t - 0.68) / 0.3, 0, 1));
    S.flapTheta = R.theta0 * (1 - ef); updateFlapGeometry();
    S.fill = smoothstep(0.45, 0.75, R.t); S.cardInBag = true; S.slide = 0; S.emptyT = R.empty0 * (1 - S.fill);
    S.filmDirty = true;
    if (R.t >= 1) { hardReset(); emit('reset'); }
  }

  // ==========================================================================
  // per-frame update
  // ==========================================================================
  // camera framings: the package (first view) and the fridge door (after unpacking)
  const focus = { target: new THREE.Vector3(), distance: opts.focusDistance || 0.36 };
  const focusLocal = new THREE.Vector3(pkg.x, 0.004, pkg.z);
  const focusFridge = { target: new THREE.Vector3(), distance: 0.42 };
  const focusFridgeLocal = new THREE.Vector3(F.x - 0.02, Math.min(0.15, F.height * 0.38), F.z + 0.04);
  function update(dt, t) {
    dt = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0.016;
    now = Number.isFinite(t) ? t : now + dt;
    group.updateMatrixWorld(true);
    _groupInv.copy(group.matrixWorld).invert();
    focusLocal.set(pkg.x + (S.cardInBag ? 0 : 0.025), 0.004, pkg.z + (S.cardInBag ? 0 : 0.09));
    focus.distance = S.cardInBag ? (opts.focusDistance || 0.36) : 0.60;
    focus.target.copy(focusLocal).applyMatrix4(group.matrixWorld);
    focusFridge.target.copy(focusFridgeLocal).applyMatrix4(group.matrixWorld);

    if (resetAnim) {
      stepReset(dt);
      if (S.filmDirty) { updateFilm(); S.filmDirty = false; }
      for (const b of BODIES) updateShadow(b);
      updateHint();
      return;
    }
    if (pendingTap && now >= pendingTap.at) { const f = pendingTap.fn; pendingTap = null; f(); }
    // press-and-hold lifts a loose item
    if (G.active && !G.started && G.kind === 'move' && now - G.downAt > T.holdToLift && G.body && G.body.loose && G.body.state !== 'fridge') startGesture();

    updateGesture();
    updateBend();

    // parameter tweens
    if (anims.flap) { const a = anims.flap; a.t = Math.min(1, a.t + dt / a.dur); setFlap(lerp(a.from, a.to, easeInOutCubic(a.t))); if (a.t >= 1) { anims.flap = null; if (a.done) a.done(); } }
    if (anims.slide) {
      const a = anims.slide; a.t = Math.min(1, a.t + dt / a.dur); setSlide(lerp(a.from, a.to, easeInOutSine(a.t))); computeExtents(bag);
      if (a.t >= 1) { anims.slide = null; if (a.done) a.done(); }
    }
    if (anims.hinge) { const a = anims.hinge; a.t = Math.min(1, a.t + dt / a.dur); setHinge(lerp(a.from, a.to, easeInOutCubic(a.t))); if (a.t >= 1) { anims.hinge = null; if (a.done) a.done(); } }
    if (S.cardOpen && !anims.hinge && !(G.active && G.kind === 'hinge')) {
      const pm = phiMax(); if (Math.abs(S.hingePhi - pm) > 1e-5) setHinge(S.hingePhi + (pm - S.hingePhi) * (1 - Math.exp(-10 * dt)));
    }

    // bodies (sub-stepped)
    for (const b of BODIES) {
      if (b.loose) stepBody(b, dt);
      // Stable elastic return even when a tab resumes with a long frame.
      const count = Math.max(1, Math.ceil(dt * 120));
      for (let i = 0; i < count; i++) stepBend(b, dt / count);
    }
    physicsStep(dt);

    // magnet sitting in the blister: drop onto the bubble's inside when the bubble points down
    if (S.magnetInBlister) {
      const down = isBubbleDown();
      const zIn = down ? Math.max(0, bubbleH - flT - zArt) : 0;
      magnet.root.position.z += (zIn + (down ? 0.6 : 0.25) * MM * S.popNudge - magnet.root.position.z) * (1 - Math.exp(-25 * dt));
    }
    // empty bag relaxes into crinkles
    if (!S.cardInBag && S.emptyT < 1) { S.emptyT = Math.min(1, S.emptyT + dt / 0.7); S.filmDirty = true; }
    if (bag.state === 'drag' || bag.state === 'flip') { S.flutter += dt * (2 + Math.hypot(bag.vx, bag.vz) * 40); S.filmDirty = true; }
    if (S.filmDirty) { updateFilm(); S.filmDirty = false; }

    // fridge door "thunk"
    if (fridge.group) {
      if (doorThunkT >= 0) {
        doorThunkT += dt;
        fridge.group.position.z = F.z - 0.35 * MM * Math.exp(-doorThunkT / 0.07) * Math.cos(2 * PI * 15 * doorThunkT);
        if (doorThunkT > 0.6) { doorThunkT = -1; fridge.group.position.z = F.z; }
      }
    }

    group.updateMatrixWorld(true);
    updateBendUniforms();
    for (let i = 0; i < BODIES.length; i++) updateShadow(BODIES[i]);
    updateRenderOrder();
    updateHint();
  }

  function dispose() {
    setCursor('');
    group.removeFromParent();
    for (const d of disposables) { try { d.dispose(); } catch (e) { /* ignore */ } }
    disposables.length = 0;
    PH.world.free();
  }

  // debug helpers (used by dev/magnet_test.html for automated checks)
  function debugPoint(name) {
    group.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    switch (name) {
      case 'flap': bag.content.localToWorld(v.set(bagW * 0.2, S.flapOpen ? yBottom - flapL * 0.5 : yBottom + flapL * 0.45, 1 * MM)); break;
      case 'bagHeader': bag.content.localToWorld(v.set(bagW * 0.3, yHeaderBottom + headerH * 0.35, 0.15 * MM)); break;
      case 'bagBody': bag.content.localToWorld(v.set(-bagW / 2 + 1.5 * MM, (yBottom + ySealBottom) * 0.5, 0.2 * MM)); break;
      case 'card': card.root.localToWorld(v.set(-cardW * 0.3, cardH * 0.22, card.flipped ? 0 : zFrontOut)); break;
      case 'cardTop': {
        if (S.cardOpen) card.root.localToWorld(v.set(-cardW * 0.25, -cardH * 0.85, card.flipped ? 0 : cardT));
        else card.root.localToWorld(v.set(-cardW * 0.25, cardH * 0.88, card.flipped ? 0 : zFrontOut));
        break;
      }
      case 'blister': blister.root.localToWorld(v.set(0, -flangeH / 2 + 4 * MM, blister.flipped ? bubbleH : flT)); break;
      case 'magnet': magnet.root.localToWorld(v.set(-6 * MM, -10 * MM, zArt)); break;
      case 'fridge': v.set(F.x - 0.08, 0.12, F.z).applyMatrix4(group.matrixWorld); break;
      case 'tableFront': v.set(pkg.x - 0.12, 0, Math.min(tableB.maxZ - 0.04, pkg.z + 0.16)).applyMatrix4(group.matrixWorld); break;
      default: return null;
    }
    return v;
  }

  group.updateMatrixWorld(true);
  focus.target.copy(focusLocal).applyMatrix4(group.matrixWorld);
  focusFridge.target.copy(focusFridgeLocal).applyMatrix4(group.matrixWorld);

  const api = {
    group,
    focus,
    focusFridge,
    update,
    pointerDown,
    pointerMove,
    pointerUp,
    wheel,
    reset,
    dispose,
    get stage() { return stageName(); },
    tunables: T,
    debug: {
      state: S,
      bodies: { bag, card, blister, magnet },
      point: debugPoint,
      hint: () => lastHint,
      physics: PH, hold: HOLD, gesture: G,
    },
  };
  return api;
}
