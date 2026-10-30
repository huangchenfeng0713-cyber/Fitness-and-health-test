# keepsake3d — module contract (shared by all contributors)

Goal: an interactive, physically-plausible 3D keepsake viewer for two real objects the owner received from
someone important: (1) a white plush keychain with a ball chain + paper hang tag, (2) a Tokyo Skytree metal
fridge magnet still in its retail packaging (OPP header bag → folded backing card → clear blister → magnet).
Fidelity and "feel" matter more than feature count.

## Runtime
- three.js r170 (`three@0.170.0`, installed in `node_modules/three`). No build step, plain ES modules.
- Pages use this import map:
  ```html
  <script type="importmap">{ "imports": {
    "three": "/node_modules/three/build/three.module.js",
    "three/addons/": "/node_modules/three/examples/jsm/" } }</script>
  ```
- Dev server (already running): http://localhost:8765/ serves `D:\29522\keepsake3d`.
- Units: **metres**, **Y up**. The table top is the plane **y = 0**.
- No network resources other than the files in this folder.

## Module API
Each module is an ES module exporting an async factory:

```js
export async function createXxx(ctx, opts = {}) { ...; return api; }
// ctx = { THREE, scene, camera, renderer, domElement, assetsBase: '/assets/', quality: 'high'|'low',
//         onHint?: (text) => void }   // onHint: short Chinese UI hint for the current step
```

The returned `api`:
| member | meaning |
|---|---|
| `group` | `THREE.Group` holding everything the module made; the module adds it to `ctx.scene` itself |
| `update(dt, t)` | called every frame; `dt` seconds (module must clamp/substep; tab switches can give big dt) |
| `pointerDown(info) → boolean` | return `true` to capture this pointer; the shell then disables camera orbit until `pointerUp` |
| `pointerMove(info)` | called on every move; `info.captured` is true when this module owns the pointer |
| `pointerUp(info)` | end of a gesture |
| `reset()` | back to the initial state |
| `focus` | `{ target: THREE.Vector3, distance: number }` — good camera framing for this object |
| `dispose()` | free GPU resources |

`info = { raycaster, ndc, clientX, clientY, pointerId, pointerType: 'mouse'|'touch'|'pen', button, time, shiftKey, ctrlKey, altKey, captured, dblclick }`
(`raycaster` is already set from the pointer and the camera; `time` is seconds.)

Modules must not create renderers, cameras, orbit controls or window-level listeners (test harness pages may).
Each module gets its own test page in `dev/` that sets up renderer + camera + OrbitControls + a RoomEnvironment
PMREM environment + a simple wooden table at y=0, and forwards pointer events per the contract above.

## Assets
- `assets/magnet_spec.json` — measured dimensions (from the owner's photos, calibrated with an ID-1 card) and texture mapping for magnet / blister / card / bag.
- `assets/tex/*.png` — textures extracted from the photos (some are placeholders and will be replaced in place with the same file name and mapping).

## v2 changes (owner feedback) — pointer model
- **No tool buttons any more.** Interaction is purely gesture based, wherever the object is touched.
- The shell now forwards **every pointer** (multi-touch). `pointerDown(info)` is called for each new pointer; return true
  to capture that pointer. `info.pointers` = array of `{pointerId, clientX, clientY, raycaster}` for all pointers currently
  captured by *this* module (incl. the new one), so a module can detect a second finger on the same object.
- Mouse fallbacks for two-finger gestures (desktop): **right-button drag** = the two-finger gesture (pinch / bend / squeeze),
  **wheel over an object** = pinch amount (only if the module returns true from `wheel(info, deltaY)`; otherwise the camera zooms).
- `info.button` is 0/1/2; touch pointers have button 0.
- Pointers not captured by any module drive the camera (OrbitControls).
- Scene lighting is now a dark room with a movable desk lamp (shell-owned). Materials must look right under a single warm/white
  spot-ish light + very dim ambient; do not add your own lights.
