# Phase 2 — Optimización de Activos 3D

## Files added
- `assets/js/asset-manager.js` — GLB pipeline (GLTFLoader + DRACOLoader, cache, LOD)
- `assets/models/uav.glb` — drone (108 KB, ~14k tris, Draco-compressed)
- `assets/models/ugv.glb` — ground robot (57 KB, ~18k tris, Draco-compressed)
- `assets/models/turbine.glb` — wind turbine (10 KB, ~500 tris, Draco-compressed)

## Files modified
- `index.html` — loads GLTFLoader, DRACOLoader, asset-manager.js before xr-engine.js
- `assets/js/xr-engine.js` — UAS/UGV agents and turbines use GLB; procedural fallback intact

## GLB optimization done before integration
Original models you provided were inspected and optimized with `gltf-transform`:

| Model    | Before    | After    | Reduction |
|----------|-----------|----------|-----------|
| uav      | 16.14 MB  | 108 KB   | -99.3%    |
| ugv      | 1.40 MB   | 57 KB    | -96%      |
| turbine  | 84 KB     | 10 KB    | -88%      |

Pipeline applied: `dedup → instance → palette → flatten → join → weld → simplify (error 0.5%) → texture compress (WebP) → meshopt → draco`.

The original `uav.glb` had 124 meshes, 45 materials and 430k triangles — a raw CAD export.
Now: 10 meshes, ~14k tris, Draco-compressed geometry. Acceptable for Quest 3 budget.

## LOD strategy (per-agent)
`AssetManager.getLOD(type, maxDim)` returns a `THREE.LOD` with 3 levels:

| Level | Distance | Content |
|-------|----------|---------|
| 0     | 0–15     | Full GLB, full material (metalness/roughness/emissive) |
| 1     | 15–40    | Same geometry, simplified material (no metalness, weak emissive) |
| 2     | 40+      | Single bounding box at the same scale |

`WebGLRenderer.render()` calls `LOD.update(camera)` automatically each frame.

## Lazy loading
Models are NOT loaded at page load. They load the first time the user presses
`3D/AR` (`enterXR()`). This keeps the login fast and avoids paying the bandwidth
cost for users who never enter 3D.

On first 3D entry the user sees toasts: `Models 1/3`, `Models 2/3`, `Models 3/3`,
then `3D MODELS LOADED`.

If a model fails to load (network error, corrupted file), the agent falls back
to its procedural geometry — the scene never breaks.

## Caching
`AssetManager._models[type]` holds the source scene. `get(type)` clones
geometry + re-clones materials (so per-instance highlights don't bleed).
The Draco decoder is loaded from `gstatic.com/draco/versioned/decoders/1.5.6/`
and cached by the browser after first use.

## What still uses procedural geometry
- Humanoids (HUM-XX) — no GLB provided; old chassis+head still drawn
- LLM-01, VISION-02 — sphere+ring procedural placeholder
- OPS-HUMAN — same as humanoid
- All scene props: roads, buildings, racks, trees, pier, sea plane, etc.

## Tunables
- `DRACO_DECODER_PATH` in `asset-manager.js` — change to a local mirror if
  you want fully-offline GitHub Pages.
- LOD distances `0, 15, 40` in `AssetManager.getLOD()` — adjust if your
  scene scale changes.
- `maxDim` passed to `get()`/`getLOD()`:
  - UAV: 1.2 units
  - UGV: 1.5 units
  - Turbine: 12 units

## Not in Phase 2 (deferred to Phase 4)
- `InstancedMesh` / `BatchedMesh` — current agent count (25 max) doesn't
  justify the complexity overhead and would conflict with the per-agent
  `AnimationMixer` planned for Phase 4
- FPS-based circuit breaker for LOD (mentioned in earlier proposal as
  optional). Will be added in Phase 4 alongside frame profiling.
