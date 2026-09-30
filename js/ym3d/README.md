# YM3D — shared 3D library (website + HyperFrames video)

User feedback (2026-09-30): "我希望各种特性用3d立体效果来表达" — every YOUMAGIC feature must read as a real 3D, 立体 scene, not flat 2D graphics. One library, reused by the website (interactive: drag/scroll) and the video (deterministic: timeline-driven).

## Module contract (MUST)
- ES modules in `website/js/ym3d/`, **no import statements**. `THREE` (r170) is passed in: `createX(THREE, opts)`.
  - Website: `import * as THREE from 'three'` (import map → `vendor/three.module.min.js`).
  - Video: `import * as THREE from './assets/js/three/three.module.min.js'` inside a sub-composition `<script type="module">`; the library is copied to `video/assets/js/ym3d/`.
- Every factory returns `{ object3d, update(params), dispose() }` (plus optional extras documented in the file header).
- `update(params)` is a pure function of `params` (incl. `t` seconds): **no clocks, no Math.random** (use `rng(seed)` from stage.mjs), no internal rAF loops, no async work after creation. Same params → same pixels. Geometry/material creation happens in `createX`; `update` only mutates transforms/uniforms/instance matrices (no per-frame allocation).
- Use `stage.mjs` (`createStage`, `BRAND`, `rng`, `ease`, `seg`, `heatColor`, `glowTexture`) — do not create a second renderer inside a component.
- Addons (TextGeometry, FontLoader, RoundedBoxGeometry, etc.) import from 'three' and cannot be used directly; if you need one, re-implement the few lines you need inside your module with injected THREE.
- Glow: no EffectComposer/postprocessing. Use emissive materials + additive-blended halo meshes/sprites (`glowTexture`) + fresnel rim shaders.
- Performance: 60 fps at 1440×900 on an Apple M-series laptop; the video renders 1920×1080 at dpr 1 (macro skin shots in 01-dilemma / 11-results at dpr 1.5, see below). Keep draw calls reasonable (InstancedMesh for repeated items).
- Header comment in each file documents every opt and update param.

## Palette & look
Dark stage (#07070c), violet #8a5cf0 rim light, mint #43e6a8 accents, cool #7fd4ff cooling, brand heat scale (heatColor), energy bands 低 #3fbf7f / 中 #f2a44b / 较高 #e27ab8 / 高 #b0283e, product = brushed silver shell + dark navy panel + violet rim light (see `website/assets/img/device.webp`, `handpiece.webp` and brochure renders `…/scratchpad/hi/da-1.png`, `da-2.png`). Premium, cinematic, Apple-keynote-grade product lighting; scientific precision for tissue.

## Compliance
Mechanism / tissue visuals are 原理示意 simulations — the host page/frame shows the label; do not bake numbers other than those in `website/js/data.js`. Energy matrix must follow `lib.js` rules exactly (density = (15+20·lv)·t/4, allowed cells, bands).

## Demo pages
Each component gets `website/fx3d/<name>.html` (import map for three, OrbitControls-free: implement a tiny drag-to-orbit yourself or use sliders), with a live view + sliders + a `?t=` / hash state for screenshots.

## Components (status after adversarial QA, 2026-09-30)
All factories: `createX(THREE, opts) → { object3d, update(params), dispose(), … }`. Every numeric param is optional; NaN / ±Infinity are treated as missing (defaults apply), so a bad tween value never blanks a frame. Full opts/params live in each file header.

| file | factory | units / suggested camera (`stage.orbit`) | key params |
|---|---|---|---|
| `device.mjs` | `createDevice` (YM5-G1 console) | metres, floor origin; `{target:[0,.64,0], radius:3.9, azimuth:-.55, elevation:.16}`, fov 30 | `t, turntable, explode, screen:'logo'/'treatment'/'activate'/'boot'/'off', screenValues{level,pulse,cooling,…}, rimGlow, float, highlight, tipInsert, electrodeGlow, cooling` — anchors via `anchor(name, out)` |
| | `createHandpiece` / `createTip` | metres, axis +Y, tip up | `tipInsert, enablePressed, buttonPress, electrodeGlow, cooling, highlight` / `electrodeGlow, cooling, spin` |
| `skincube.mjs` | `createSkinCube` | 1 unit = 1 cm, 4×4 cm block; `{target:[0,-.85,0], radius:14.5, azimuth:.62, elevation:.4}`, fov 30 | `t, tip, tipPress, current, heat, cool, contraction, week(0–12), wrinkle, cutaway, fibreFill, xray, explode, rotate, pad, stainMode, highlight` — opts `fibreRadial` / `fibreSegments` `{typeI, typeIII}` raise fibre tessellation for macro shots (defaults 6/5 × 36/24 = website look) |
| `dataviz.mjs` | `createEnergyMatrix3D, createPulseTrain3D, createLoadCurve3D, createDigits3D, createShieldRings3D, createLock54, createParticleNumber, createMedallions` | each returns `view` (orbit params) + `anchors`; `projectAnchors(THREE, anchors, camera, w, h)` for DOM labels | `reveal` 0–1 build-in on most; see header per factory |
| `gate.mjs` | `createGateMorph` (清华园二校门 → YM5 design-lineage transition) | metres, SAME frame as `createDevice` (doorway floor centre = device origin); `cameraAt(u)` → wide gate → frontal morph → device hero, fov 30 | `u` (whole sequence) or `purple, ignite, morph, reveal`, `t`; extras `sequence(u)`, `deviceBlend(p)`, `placeDevice(obj)`, `bindDevice(device)`, `curves`, anchors |

Host rules learned in QA:
- **Fonts:** await `document.fonts.load('600 40px Montserrat')` (and 500) BEFORE creating dataviz components — their axis labels are canvas textures; a console warning fires if you forget. The device screen / skin block use system fonts only.
- **Screen truth:** `createDevice` draws a grey “超出能量表 · 已锁定” readout if a `screenValues` level/pulse pair is outside the IFU table (lib.js `isAllowed`) — only animate through allowed pairs.
- **Compliance:** skin block heat stays in the dermis (“皮肤浅中层产热”); label the bottom strip 肌肉层, never “SMAS”; no mm / °C. `createMedallions` with hospital seals = professional edition only (审查办法第十一条).
- **Performance (M-series, 1440×900, dpr 1, GPU-synced):** device ≈2–3 ms, handpiece/tip ≈1.7 ms, dataviz 1.4–2.5 ms each, skin block ≈11 ms (≈17 ms with `xray`+`explode`); cap the skin block at dpr ≤1.5 on retina. Its procedural cut-face / skin patterns are band-limited (fwidth); video macro shots that fill the frame (01-dilemma, 11-results) additionally render the stage at dpr 1.5 (≈1.5–1.8× the GL cost).
- **Gate → device (`gate.mjs`):** create the device first and pass `deviceDims: device.dims`; `gate.placeDevice(device.object3d)` then `gate.bindDevice(device)` (scan-in shader chained onto the device's own materials; at `reveal = 1` the frame is pixel-identical to the unbound device — `unbindDevice()` after the handoff to drop the shader cost). Per frame: `gate.update(gate.sequence(u))`, `device.update({ rimGlow, screen } from gate.deviceBlend(s))`, scale the host key / violet rim by `deviceBlend(s).stageKey / .stageRim` (white stone must not be lit lavender at the start; both are 1 at the end), `stage.orbit(gate.cameraAt(u))`; keep the device at turntable/explode/float 0 during the handoff. Plaque 清華園 uses a Kai face (Kaiti SC / STKaiti / KaiTi…) — `await document.fonts.load('bold 100px "Kaiti SC"')` before creating. Only text baked: the plaque. ≈5–8 ms/frame incl. device at 1440×900.
- **QA harness:** `website/fx3d/_qa.html` puts every component on one `createStage` and exposes `window.QA.add/show/render/perf/shot` (FNV hash of the framebuffer). Driver: `…/scratchpad/qa/aq.mjs shots|det|perf|eval`.
