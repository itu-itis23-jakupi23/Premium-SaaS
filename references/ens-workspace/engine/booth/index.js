/**
 * booth/index.js
 * ───────────────────────────────────────────────────────────────────────────
 * Public API for the professional Boothcraft booth generator.
 *
 * Usage:
 *
 *   import { createBooth, destroyBooth } from './booth/index.js';
 *
 *   const instance = createBooth(scene, {
 *     width:  6,
 *     depth:  3,
 *     height: 2.5,
 *     boothStyle:  'octanorm',
 *     accentWall:  'back',
 *     accentColor: 0x1b2d4f,
 *     fasciaColor: 0x1b2d4f,
 *     floorType:   'carpet',
 *     hasScreen:   true,
 *     hasLighting: true,
 *     hasFurniture: true,
 *     hasReceptionDesk: true,
 *     brandingText: 'TECHNOVA',
 *   });
 *
 *   // later, to tear down:
 *   instance.destroy();
 *
 * ───────────────────────────────────────────────────────────────────────────
 * Architecture:
 *   config.js    → resolveConfig(), getStructureProfile()
 *   materials.js → all MeshStandardMaterial factories
 *   structure.js → aluminum uprights + beams, returns spotlight anchors
 *   panels.js    → panel walls, fascia band, interior floor, branding
 *   lighting.js  → ambient + directional + warm spotlights
 *   furniture.js → reception desk, centre table, shelf unit
 * ───────────────────────────────────────────────────────────────────────────
 */

import { resolveConfig }                                          from './config.js';
import { buildStructure }                                         from './structure.js';
import { buildWall, buildFascia, buildInteriorFloor, buildBrandingWall } from './panels.js';
import { buildBoothLighting }                                     from './lighting.js';
import { buildFurnitureLayout }                                   from './furniture.js';

const THREE = () => window.THREE;

// ─── Disposal helpers ─────────────────────────────────────────────────────────

function disposeObject(obj) {
  obj?.traverse?.((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((m) => {
        m.map?.dispose?.();
        m.emissiveMap?.dispose?.();
        m.dispose?.();
      });
    } else if (child.material) {
      child.material.map?.dispose?.();
      child.material.emissiveMap?.dispose?.();
      child.material.dispose?.();
    }
  });
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Creates a complete, professional exhibition booth and adds it to `scene`.
 *
 * @param {THREE.Scene|THREE.Group} scene  - target to add booth into
 * @param {object}                  userConfig
 * @returns {{ root: THREE.Group, destroy: () => void, config: object }}
 */
export function createBooth(scene, userConfig = {}) {
  const T = THREE();
  if (!T) throw new Error('Three.js is not loaded (window.THREE missing).');

  const cfg = resolveConfig(userConfig);

  // All booth geometry lives inside this Group for clean disposal
  const root = new T.Group();
  root.name  = 'BoothRoot_Pro';

  // TextureLoader shared across all async texture loads
  const loader = T.TextureLoader ? new T.TextureLoader() : null;

  // ── 1. Aluminum structure (uprights + beams) ──
  //    Returns spotlight anchor positions for step 5.
  const spotAnchors = buildStructure(root, cfg);

  // ── 2. Panel walls ──
  //    Back wall (always closed), left + right side walls.
  buildWall(root, 'back',  cfg);
  buildWall(root, 'left',  cfg);
  buildWall(root, 'right', cfg);
  //    No front wall — open face for visitor entry.

  // ── 3. Fascia top band ──
  buildFascia(root, cfg);

  // ── 4. Interior floor ──
  buildInteriorFloor(root, cfg);

  // ── 5. Branding (back wall logo + optional LED screen) ──
  buildBrandingWall(root, cfg, loader);

  // ── 6. Furniture ──
  if (cfg.hasFurniture) {
    buildFurnitureLayout(root, cfg);
  }

  // Add the booth group to the scene/target
  scene.add(root);

  // ── 7. Lighting ──
  //    Added directly to scene (not root) so lights affect the whole scene
  //    and their position isn't offset by any group transform on root.
  let lightingHandle = null;
  if (cfg.hasLighting) {
    lightingHandle = buildBoothLighting(scene, cfg, spotAnchors);
  }

  // ─── Public instance ──────────────────────────────────────────────────────

  return {
    root,
    config: cfg,

    /**
     * Tear down: remove from scene, dispose all GPU resources, remove lights.
     */
    destroy() {
      if (lightingHandle) {
        lightingHandle.dispose();
        lightingHandle = null;
      }
      scene.remove(root);
      disposeObject(root);
    },

    /**
     * Re-render with updated config (partial update supported).
     * Equivalent to destroy + createBooth with merged config.
     */
    update(nextConfig = {}) {
      this.destroy();
      return createBooth(scene, { ...userConfig, ...nextConfig });
    },
  };
}

/**
 * Convenience wrapper — destroys an existing instance if present.
 * Useful for hot-reload / config panel in the editor.
 */
export function destroyBooth(instance) {
  instance?.destroy?.();
}
