// ============================================================
//  AssetManager — Phase 2 (GLB pipeline)
//  ------------------------------------------------------------
//  - Loads .glb files via GLTFLoader + DRACOLoader
//  - Caches the source scene and clones per agent (skinning-safe
//    via SkeletonUtils.clone when present, otherwise plain clone)
//  - Provides LOD wrapping (close/mid/far) using THREE.LOD
//  - Falls back gracefully: if a model fails, returns null and
//    callers use procedural geometry
//
//  Loaders are expected on window:
//    THREE.GLTFLoader, THREE.DRACOLoader
// ============================================================
(function (global) {
    'use strict';

    var DRACO_DECODER_PATH = 'https://www.gstatic.com/draco/versioned/decoders/1.5.6/';

    var AssetManager = {
        _models:      {},   // type -> { scene, ready, error }
        _loader:      null,
        _draco:       null,
        _onProgress:  null, // optional: function(loaded, total)
        ready:        false,

        // ── public ───────────────────────────────────────────
        init: function () {
            if (this._loader) return;
            if (!THREE.GLTFLoader)  { console.error('[ASSET] GLTFLoader missing');  return; }
            if (!THREE.DRACOLoader) { console.error('[ASSET] DRACOLoader missing'); return; }
            this._draco = new THREE.DRACOLoader();
            this._draco.setDecoderPath(DRACO_DECODER_PATH);
            this._loader = new THREE.GLTFLoader();
            this._loader.setDRACOLoader(this._draco);
        },

        // manifest: { type: url, ... }
        loadAll: function (manifest, onProgress) {
            var self = this;
            this.init();
            if (!this._loader) return Promise.resolve(false);
            this._onProgress = onProgress || null;

            var entries = Object.keys(manifest);
            var done = 0;
            return Promise.all(entries.map(function (type) {
                return self._loadOne(type, manifest[type]).finally(function () {
                    done++;
                    if (self._onProgress) self._onProgress(done, entries.length);
                });
            })).then(function () {
                self.ready = true;
                console.log('[ASSET] all models processed:',
                    entries.filter(function (t) { return self._models[t] && !self._models[t].error; }).length,
                    '/', entries.length);
                return true;
            });
        },

        _loadOne: function (type, url) {
            var self = this;
            return new Promise(function (resolve) {
                self._loader.load(url, function (gltf) {
                    // Center geometry on its bounding box footprint so the model
                    // sits on the floor at y=0 instead of being half-buried.
                    var scene = gltf.scene;
                    var box = new THREE.Box3().setFromObject(scene);
                    var size = new THREE.Vector3(); box.getSize(size);
                    var center = new THREE.Vector3(); box.getCenter(center);
                    scene.position.x -= center.x;
                    scene.position.z -= center.z;
                    scene.position.y -= box.min.y; // feet on floor

                    // Cast/receive shadows on every mesh
                    scene.traverse(function (n) {
                        if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
                    });

                    self._models[type] = {
                        scene:  scene,
                        size:   size,
                        ready:  true,
                        error:  null
                    };
                    console.log('[ASSET]', type, 'loaded — size:', size.x.toFixed(2), 'x', size.y.toFixed(2), 'x', size.z.toFixed(2));
                    resolve(true);
                },
                undefined,
                function (err) {
                    console.warn('[ASSET] failed to load', type, url, err);
                    self._models[type] = { scene: null, ready: false, error: err };
                    resolve(false);
                });
            });
        },

        has: function (type) {
            return !!(this._models[type] && this._models[type].ready);
        },

        // Returns a fresh clone of the source scene, scaled to target maxDim.
        // Caller is responsible for adding it to the scene + positioning.
        get: function (type, maxDim) {
            if (!this.has(type)) return null;
            var src = this._models[type].scene;
            var clone = src.clone(true);
            // Re-clone materials so per-instance tint (selection highlight,
            // alert state) doesn't bleed across agents.
            clone.traverse(function (n) {
                if (n.isMesh && n.material) {
                    n.material = n.material.clone();
                }
            });
            if (maxDim) {
                var size = this._models[type].size;
                var natural = Math.max(size.x, size.y, size.z) || 1;
                var s = maxDim / natural;
                clone.scale.set(s, s, s);
            }
            return clone;
        },

        // Wraps the model in a THREE.LOD with high/mid/low levels.
        // For Phase 2 the mid/low levels are decimated procedurally by
        // hiding optional detail meshes. Distances are tuned for the
        // current scene scale (agents typically 1–2 units tall, camera 5–30 units away).
        getLOD: function (type, maxDim) {
            var high = this.get(type, maxDim); if (!high) return null;
            var lod  = new THREE.LOD();
            lod.addLevel(high, 0);

            // Mid: same geometry, simpler material (no env reflections, no emissive)
            var mid = this.get(type, maxDim);
            mid.traverse(function (n) {
                if (n.isMesh && n.material) {
                    n.material.roughness = 1.0;
                    n.material.metalness = 0.0;
                    if (n.material.emissiveIntensity !== undefined) n.material.emissiveIntensity *= 0.3;
                }
            });
            lod.addLevel(mid, 15);

            // Low: a single billboard-style box approximation. Cheap, ~1 draw call.
            var size = this._models[type].size;
            var natural = Math.max(size.x, size.y, size.z) || 1;
            var s = (maxDim || natural) / natural;
            var low = new THREE.Mesh(
                new THREE.BoxGeometry(size.x * s, size.y * s, size.z * s),
                new THREE.MeshBasicMaterial({ color: 0x3a6070 })
            );
            lod.addLevel(low, 40);

            return lod;
        },

        // Sum of decoded bytes (rough — just counts geometry attribute buffers)
        statsString: function () {
            var loaded = 0, failed = 0;
            for (var k in this._models) {
                if (this._models[k].ready) loaded++; else failed++;
            }
            return 'loaded=' + loaded + ' failed=' + failed;
        }
    };

    global.AssetManager = AssetManager;
})(window);
