/**
 * booth/lighting.js
 * Layered exhibition lighting:
 *
 *   Layer 1 — AmbientLight       (fill, very low)
 *   Layer 2 — HemisphereLight    (sky/ground gradient, soft)
 *   Layer 3 — DirectionalLight   (soft sun, shadows)
 *   Layer 4 — SpotLights         (warm 3500K track spots on top beams)
 *
 * The spotlight approach matches how real exhibition halls work:
 * track lighting mounted at booth-top height angled ~35° downward,
 * creating pools of warm light on the floor and accent wall.
 *
 * Public API:
 *   buildBoothLighting(scene, cfg, spotAnchors)   → { dispose() }
 *   addSpotlight(scene, x, y, z, targetX, targetY, targetZ, cfg)
 */

const THREE = () => window.THREE;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSpotHelper(light, scene) {
  // Only enabled in dev; tree-shaken in production
  if (typeof window !== 'undefined' && window.__BOOTH_DEBUG__) {
    const T = THREE();
    scene.add(new T.SpotLightHelper(light));
  }
}

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * Adds a single spotlight to the scene.
 * Returns the light + its target so the caller can dispose both.
 *
 * @param {THREE.Scene} scene
 * @param {number} x, y, z        - light position
 * @param {number} tx, ty, tz     - aim target (world coords)
 * @param {object} cfg            - resolved booth config
 */
export function addSpotlight(scene, x, y, z, tx, ty, tz, cfg) {
  const T = THREE();

  const light = new T.SpotLight(
    cfg.spotlightColor,
    cfg.spotlightIntensity,
    cfg.height * 3.5,          // range (falloff distance)
    cfg.spotlightAngle,
    cfg.spotlightPenumbra,
    1.8,                        // decay — physically based
  );
  light.position.set(x, y, z);
  light.castShadow = false;     // spot shadows are expensive; key shadow from directional

  const target = new T.Object3D();
  target.position.set(tx, ty, tz);
  scene.add(target);
  light.target = target;
  scene.add(light);

  makeSpotHelper(light, scene);
  return { light, target };
}

/**
 * Builds the complete layered lighting rig for the booth.
 *
 * @param {THREE.Scene} scene
 * @param {object}      cfg          - resolved config
 * @param {Array}       spotAnchors  - [{x,y,z}] positions from structure.js
 * @returns {{ dispose: () => void }}
 */
export function buildBoothLighting(scene, cfg, spotAnchors = []) {
  const T = THREE();
  const created = [];

  // ── Layer 1: Ambient fill ──
  const ambient = new T.AmbientLight(0xffffff, 0.18);
  scene.add(ambient);
  created.push(ambient);

  // ── Layer 2: Hemisphere (sky=cool, ground=dark) ──
  const hemi = new T.HemisphereLight(0xddeeff, 0x111318, 0.38);
  scene.add(hemi);
  created.push(hemi);

  // ── Layer 3: Key directional (soft shadows) ──
  const key = new T.DirectionalLight(0xfff8f0, 1.55);
  key.position.set(cfg.width * 0.8, cfg.height * 2.2, cfg.depth * 1.2);
  key.castShadow = true;
  key.shadow.mapSize.width  = 2048;
  key.shadow.mapSize.height = 2048;
  key.shadow.bias        = -0.0003;
  key.shadow.normalBias  = 0.02;
  key.shadow.radius      = 3;
  const frustum = Math.max(cfg.width, cfg.depth) * 1.1;
  key.shadow.camera.left   = -frustum;
  key.shadow.camera.right  =  frustum;
  key.shadow.camera.top    =  frustum;
  key.shadow.camera.bottom = -frustum;
  key.shadow.camera.near   = 0.5;
  key.shadow.camera.far    = cfg.height * 6;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key);
  created.push(key);

  // ── Layer 4: Warm spotlights on top beams ──
  if (cfg.hasLighting && spotAnchors.length) {
    // target Y: floor level so they pool on the ground
    const ty = 0;

    spotAnchors.forEach(({ x, y, z }) => {
      // angle each spot slightly inward toward booth centre
      const tx = x * 0.4;
      const tz = z + (z < 0 ? cfg.depth * 0.45 : -cfg.depth * 0.45);
      const spot = addSpotlight(scene, x, y, z, tx, ty, tz, cfg);
      created.push(spot.light, spot.target);
    });

    // Two accent spots aimed at back wall face for drama
    const backZ = -(cfg.depth / 2) + 0.2;
    const accentPositions = [
      { x: -cfg.width * 0.22, y: cfg.height - 0.08, z: 0 },
      { x:  cfg.width * 0.22, y: cfg.height - 0.08, z: 0 },
    ];
    accentPositions.forEach(({ x, y, z }) => {
      const accentSpot = addSpotlight(
        scene, x, y, z,
        x * 0.6, cfg.height * 0.4, backZ,
        { ...cfg, spotlightIntensity: cfg.spotlightIntensity * 0.7, spotlightAngle: 0.28 },
      );
      created.push(accentSpot.light, accentSpot.target);
    });
  }

  // ── Rim light (cool blue from behind — separates booth from dark bg) ──
  const rim = new T.DirectionalLight(0x88bbff, 0.52);
  rim.position.set(-cfg.width, cfg.height, -cfg.depth * 1.5);
  scene.add(rim);
  created.push(rim);

  return {
    dispose() {
      created.forEach((obj) => {
        scene.remove(obj);
        obj.dispose?.();
      });
      created.length = 0;
    },
  };
}
