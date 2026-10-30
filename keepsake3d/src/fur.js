// Shell-based fur for the plush. The shells share the base mesh's geometry, so whatever deforms the base
// (the soft-body engine rewrites position/normal every frame) deforms the fur too.
//
// Petting: strokes add a per-vertex "flow" vector (rest frame) that bends the fur tips along the stroke and
// slowly relaxes back. Printed areas (ink mask) get short fur so the prints stay crisp like on the real toy.
import * as THREE from 'three';

function makeStrandTexture(size = 256, seed = 7) {
  // clumped strand field: value = strand "height" threshold per cell (0..1); clumps make it look like minky pile
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const data = new Uint8Array(size * size * 4);
  const clumps = [];
  for (let i = 0; i < 220; i++) clumps.push([rnd() * size, rnd() * size, 3 + rnd() * 6]);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let c = 0;
      for (const [cx, cy, r] of clumps) {
        let dx = Math.abs(x - cx); dx = Math.min(dx, size - dx);
        let dy = Math.abs(y - cy); dy = Math.min(dy, size - dy);
        const d = Math.sqrt(dx * dx + dy * dy) / r;
        if (d < 1) c = Math.max(c, 1 - d * d);
      }
      const h = Math.min(1, 0.45 + 0.55 * Math.sqrt(rnd()) * (0.7 + 0.3 * c));
      const i = (y * size + x) * 4;
      data[i] = h * 255; data[i + 1] = rnd() * 255; data[i + 2] = rnd() * 255; data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createFur(baseMesh, opts = {}) {
  const shells = opts.shells ?? 16;
  const furLength = opts.furLength ?? 0.00135;        // short minky pile, metres
  const strandScale = opts.strandScale ?? 2.3;          // strand texture repeats per UV unit
  const geo = baseMesh.geometry;
  const n = geo.attributes.position.count;
  const rest = geo.attributes.restPosition ? geo.attributes.restPosition.array : geo.attributes.position.array.slice();
  if (!geo.attributes.restPosition) geo.setAttribute('restPosition', new THREE.BufferAttribute(rest, 3));
  const flow = new Float32Array(n * 3);
  const flowAttr = new THREE.BufferAttribute(flow, 3);
  flowAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('furFlow', flowAttr);
  if (!geo.attributes.furSeam) geo.setAttribute('furSeam', new THREE.BufferAttribute(opts.seam ?? new Float32Array(n), 1));

  const strand = makeStrandTexture();
  const shared = {
    uFurLen: { value: furLength },
    uStrand: { value: strand },
    uStrandScale: { value: strandScale },
    uMask: { value: opts.maskMap ?? null },
    uHasMask: { value: opts.maskMap ? 1 : 0 },
    uGravity: { value: new THREE.Vector3(0, -1, 0) },
    uWind: { value: new THREE.Vector3() },
  };

  const baseMap = baseMesh.material.map;
  const group = new THREE.Group();
  const mats = [];
  for (let i = 1; i <= shells; i++) {
    const h = i / shells;
    // opaque shells with alpha-to-coverage (MSAA): soft fibre edges without any see-through / sorting artefacts.
    // Velvet-like response: no specular lobe at all, only diffuse + a broad sheen from fibre scattering.
    const m = new THREE.MeshPhysicalMaterial({ map: baseMap, roughness: 1.0, metalness: 0, specularIntensity: 0,
      sheen: 1.0, sheenRoughness: 0.75, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 1.0 });
    // An opaque cutout keeps the canvas alpha valid on browsers whose default
    // framebuffer does not preserve MSAA coverage across the shell draws.
    m.alphaToCoverage = false;
    m.userData.shell = h;
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shared, { uShell: { value: h } });
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute vec3 furFlow;
          attribute float furSeam;
          uniform sampler2D uStrand; uniform float uStrandScale;
          varying float vSeam;
          uniform float uShell; uniform float uFurLen; uniform vec3 uGravity; uniform vec3 uWind;
          uniform sampler2D uMask; uniform float uHasMask;
          varying float vShell; varying float vInk;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float ink = 0.0;
          #ifdef USE_MAP
            if (uHasMask > 0.5) ink = texture2D(uMask, vMapUv).r;
          #endif
          vInk = ink;
          vSeam = furSeam;
          // fur is short where printed and pinched flat along the sewn side seam
          float len = uFurLen * mix(1.0, 0.18, ink) * mix(1.0, 0.3, furSeam);
          vec3 nrm = normalize(objectNormal);
          // flow (petting) and gravity bend the tips; bend grows with height^2 like a cantilever;
          // a slowly varying direction field makes the pile lie in little tufts like real minky
          vec2 tuft = texture2D(uStrand, vMapUv * uStrandScale * 0.18).gb * 2.0 - 1.0;
          vec3 tdir = normalize(cross(nrm, vec3(0.37, 0.81, 0.45))) * tuft.x + normalize(cross(nrm, vec3(0.8, -0.2, 0.55))) * tuft.y;
          vec3 bend = furFlow * 1.6 + uGravity * 0.35 + uWind + tdir * 0.3;
          bend -= nrm * dot(bend, nrm);
          float hh = uShell * uShell;
          transformed += nrm * (uShell * len) + bend * (hh * len);
          vShell = uShell;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform sampler2D uStrand; uniform float uStrandScale; varying float vShell; varying float vInk; varying float vSeam;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          {
            vec4 st = texture2D(uStrand, vMapUv * vec2(uStrandScale * 2.0, uStrandScale * 1.07));
            float thresh = vShell * (0.92 + 0.08 * st.g);
            // soft coverage (alpha-to-coverage) instead of a hard cut: distant fur reads as a soft halo
            float a = smoothstep(thresh - 0.14, thresh + 0.02, st.r) * (1.0 - 0.1 * vShell);
            a = mix(1.0, a, smoothstep(0.0, 0.35, vShell));   // lower pile is dense and opaque
            if (a < 0.55) discard;
            diffuseColor.a = 1.0;
            // self-shadowing: roots darker, tips lighter; prints keep their colour
            float ao = mix(0.80, 1.0, pow(vShell, 0.6));
            diffuseColor.rgb *= mix(ao, 1.0, vInk * 0.7) * (0.93 + 0.1 * st.b) * (1.0 - 0.28 * vSeam);
          }`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          {
            // fabric: almost no glossy reflection, plus a soft fuzz rim (light scattered by fibre tips)
            reflectedLight.directSpecular *= 0.35;   // what is left is the sheen lobe
            reflectedLight.indirectSpecular *= 0.0;
          }`);
    };
    m.customProgramCacheKey = () => 'fur-shell';
    mats.push(m);
    const s = new THREE.Mesh(geo, m);
    s.renderOrder = 0;
    s.castShadow = false;
    s.receiveShadow = true;
    s.frustumCulled = false;
    s.userData.isFur = true;
    group.add(s);
  }
  // base: soft sheen fabric
  const bm = baseMesh.material;
  const fabric = new THREE.MeshPhysicalMaterial({ map: bm.map, roughness: 1.0, metalness: 0, specularIntensity: 0, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xf4f2ee), envMapIntensity: 1.0 });
  fabric.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float furSeam; varying float vSeam;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vSeam = furSeam;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying float vSeam;`).replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb *= 0.82 * (1.0 - 0.45 * vSeam);`).replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      reflectedLight.indirectSpecular *= 0.0;`);
  };
  baseMesh.material = fabric;

  // ---- petting flow on the CPU (rest frame), with a coarse spatial hash for speed ----
  const cell = 0.004;
  const hash = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${Math.floor(rest[i * 3] / cell)},${Math.floor(rest[i * 3 + 1] / cell)},${Math.floor(rest[i * 3 + 2] / cell)}`;
    let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(i);
  }
  let active = false;
  function stroke(p, d, strength = 1, radius = 0.007) {
    const r2 = radius * radius;
    const c = Math.ceil(radius / cell);
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
    for (let x = cx - c; x <= cx + c; x++) for (let y = cy - c; y <= cy + c; y++) for (let z = cz - c; z <= cz + c; z++) {
      const a = hash.get(`${x},${y},${z}`); if (!a) continue;
      for (const i of a) {
        const dx = rest[i * 3] - p.x, dy = rest[i * 3 + 1] - p.y, dz = rest[i * 3 + 2] - p.z;
        const q = dx * dx + dy * dy + dz * dz; if (q > r2) continue;
        const w = strength * Math.exp(-3 * q / r2);
        flow[i * 3] += (d.x - flow[i * 3]) * w; flow[i * 3 + 1] += (d.y - flow[i * 3 + 1]) * w; flow[i * 3 + 2] += (d.z - flow[i * 3 + 2]) * w;
      }
    }
    active = true;
  }
  let acc = 0;
  function update(dt, gravityLocal) {
    if (gravityLocal) shared.uGravity.value.copy(gravityLocal);
    if (!active) return;
    acc += dt;
    if (acc < 1 / 30) return;   // relax + upload at 30 Hz
    const k = Math.exp(-acc / 7.0);     // fur slowly stands back up (~7 s)
    acc = 0;
    let mx = 0;
    for (let i = 0; i < flow.length; i++) { flow[i] *= k; const a = Math.abs(flow[i]); if (a > mx) mx = a; }
    flowAttr.needsUpdate = true;
    if (mx < 0.002) { flow.fill(0); active = false; }
  }
  function setShellCount(c) { group.children.forEach((m, i) => { m.visible = i < c; }); }
  function setWind(v) { shared.uWind.value.copy(v); }
  return { group, stroke, update, setShellCount, setWind, materials: mats };
}
