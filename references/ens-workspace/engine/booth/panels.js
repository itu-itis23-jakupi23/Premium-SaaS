/**
 * booth/panels.js
 * Panel system — three types:
 *   'default'  → white/cream MeshStandard
 *   'accent'   → deep color (usually back wall)
 *   'graphic'  → loads a texture image
 *
 * Public API:
 *   createPanel({ width, height, x, z, rotY, type, color, textureUrl })
 *   buildWall(root, side, cfg)          → fills one wall with panels
 *   buildFascia(root, cfg)              → top banner band all around
 *   buildInteriorFloor(root, cfg)       → raised booth floor
 *   buildBrandingWall(root, cfg, loader) → logo + optional LED screen
 */

import { getStructureProfile } from './config.js';
import { defaultPanelMat, accentPanelMat, fasciaMat, floorMat, screenMat, screenBezelMat } from './materials.js';

const THREE = () => window.THREE;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function box(w, h, d, mat) {
  const T = THREE();
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function plane(w, h, mat) {
  const T = THREE();
  const mesh = new T.Mesh(new T.PlaneGeometry(w, h), mat);
  mesh.receiveShadow = true;
  return mesh;
}

function loadTexture(loader, url, onLoad) {
  if (!url || !loader) { onLoad(null); return; }
  loader.load(url, onLoad, undefined, () => onLoad(null));
}

// ─── Panel factory ───────────────────────────────────────────────────────────

/**
 * Creates a single rectangular panel mesh.
 *
 * @param {object} opts
 * @param {number}  opts.width
 * @param {number}  opts.height
 * @param {number}  [opts.thickness=0.006]
 * @param {number}  opts.x
 * @param {number}  opts.y  - centre Y
 * @param {number}  opts.z
 * @param {number}  [opts.rotY=0]
 * @param {'default'|'accent'|'graphic'} [opts.type='default']
 * @param {number}  [opts.color]
 * @param {THREE.Texture|null} [opts.map]
 */
export function createPanel(opts) {
  const T = THREE();
  const {
    width, height,
    thickness = 0.006,
    x = 0, y, z,
    rotY = 0,
    type = 'default',
    color,
    map = null,
  } = opts;

  let mat;
  if (type === 'accent') {
    mat = accentPanelMat(color);
  } else {
    mat = defaultPanelMat(color, map);
  }

  const mesh = new T.Mesh(new T.BoxGeometry(width, height, thickness), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  return mesh;
}

// ─── Wall builder ─────────────────────────────────────────────────────────────

/**
 * Fills a single wall face with tiled panels according to the panel-module grid.
 * Panels are placed flush against the structural beams.
 *
 * @param {THREE.Group} root
 * @param {'back'|'left'|'right'} side
 * @param {object} cfg  - resolved config
 */
export function buildWall(root, side, cfg) {
  const { width, depth, height, accentWall, accentColor, panelColor, boothStyle } = cfg;
  const profile  = getStructureProfile(boothStyle);
  const isAccent = side === accentWall;

  // Geometry of this wall face
  const span = (side === 'back') ? width : depth;
  const hw   = width / 2;
  const hd   = depth / 2;

  const beamH = profile.beamH;
  const usableH  = height - beamH * 2;    // between bottom and top rail
  const panelGap = 0.003;                 // air gap between panels

  // Section count: how many full panels fit
  const sectionW   = profile.panelW + profile.beamD;
  const sectionCount = Math.floor(span / sectionW);
  const actualSpan   = sectionCount * sectionW;
  const leftover     = span - actualSpan;

  const type = isAccent ? 'accent' : 'default';
  const color = isAccent ? accentColor : panelColor;

  // Wall-local → world transform helpers
  let setPos;
  let rotY;
  if (side === 'back') {
    rotY   = 0;
    setPos = (panelX, panelY) => ({
      x: panelX - span / 2 + leftover / 2,
      y: panelY,
      z: -hd,
    });
  } else if (side === 'left') {
    rotY   = Math.PI / 2;
    setPos = (panelX, panelY) => ({
      x: -hw,
      y: panelY,
      z: panelX - span / 2 + leftover / 2,
    });
  } else { // right
    rotY   = -Math.PI / 2;
    setPos = (panelX, panelY) => ({
      x:  hw,
      y:  panelY,
      z: -(panelX - span / 2 + leftover / 2),
    });
  }

  // Tile panels vertically too when booth is tall
  const panelRows = usableH > 1.2 ? 2 : 1;
  const rowH      = usableH / panelRows;

  for (let col = 0; col < sectionCount; col++) {
    const centreX = col * sectionW + sectionW / 2;

    for (let row = 0; row < panelRows; row++) {
      const centreY = beamH + row * rowH + rowH / 2;
      const pos = setPos(centreX, centreY);

      const panel = createPanel({
        width:  profile.panelW - panelGap,
        height: rowH - panelGap,
        x: pos.x,
        y: pos.y,
        z: pos.z,
        rotY,
        type,
        color,
      });
      panel.name = `Panel_${side}_c${col}_r${row}`;
      panel.userData = {
        isBoothPanel: true,
        panelType: 'slab',
        wallSide: side,
        sectionIndex: col,
        rowIndex: row,
        dims: { width: profile.panelW, height: rowH, depth: profile.panelT },
        baseColor: color,
      };
      root.add(panel);
    }
  }
}

// ─── Fascia (top banner) ──────────────────────────────────────────────────────

/**
 * Adds a continuous fascia band around the top perimeter.
 * Slightly proud of the panels, giving that "header band" look.
 */
export function buildFascia(root, cfg) {
  const { width, depth, height, fasciaColor, fasciaHeight } = cfg;
  const hw = width / 2;
  const hd = depth / 2;
  const proud = 0.012;   // how far it protrudes past the panel face
  const thickness = 0.022;
  const mat = fasciaMat(fasciaColor);
  const yPos = height - fasciaHeight / 2;

  const segments = [
    // back
    { w: width + proud * 2, d: thickness, x: 0,   z: -hd - proud / 2 },
    // left
    { w: thickness, d: depth + proud * 2, x: -hw - proud / 2, z: 0 },
    // right
    { w: thickness, d: depth + proud * 2, x:  hw + proud / 2, z: 0 },
    // front partial (left half — keeps open face visible)
    { w: width * 0.3, d: thickness, x: -hw + width * 0.15, z: hd + proud / 2 },
    { w: width * 0.3, d: thickness, x:  hw - width * 0.15, z: hd + proud / 2 },
  ];

  segments.forEach(({ w, d, x, z }) => {
    const T = THREE();
    const mesh = new T.Mesh(
      new T.BoxGeometry(w, fasciaHeight, d),
      mat,
    );
    mesh.position.set(x, yPos, z);
    mesh.castShadow = true;
    root.add(mesh);
  });
}

// ─── Interior floor ──────────────────────────────────────────────────────────

/**
 * A slightly elevated plane inside the booth footprint.
 * Different material from the world floor creates a clear "this is our space" read.
 */
export function buildInteriorFloor(root, cfg) {
  const { width, depth, floorType, floorColor, floorElevation } = cfg;
  const mat   = floorMat(floorType, floorColor);
  const floor = plane(width - 0.02, depth - 0.02, mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorElevation, 0);
  floor.receiveShadow = true;
  root.add(floor);
}

// ─── Branding / LED screen ────────────────────────────────────────────────────

/**
 * Mounts a logo plane + optional LED screen on the accent (back) wall.
 * Both are centred, vertically stacked.
 *
 * Uses a TextureLoader so textures load asynchronously and the rest of
 * the booth renders immediately without waiting.
 */
export function buildBrandingWall(root, cfg, loader = null) {
  const {
    width, depth, height,
    hasScreen, screenWidth, screenHeight,
    brandingLogoUrl, brandingText,
    fasciaHeight,
  } = cfg;

  const T = THREE();
  if (!T) return;

  const hd     = depth / 2;
  const wallZ  = -hd + 0.01;          // just in front of back wall panels
  const usableH = height - fasciaHeight - 0.15;
  const logoH   = 0.22;
  const gap     = 0.08;

  // ── LED Screen ──
  if (hasScreen) {
    const sw = Math.min(screenWidth, width * 0.72);
    const sh = Math.min(screenHeight, usableH * 0.5);
    const sy = fasciaHeight / 2 + sh / 2 + 0.1;

    // Bezel
    const bezel = new T.Mesh(
      new T.BoxGeometry(sw + 0.04, sh + 0.03, 0.028),
      screenBezelMat(),
    );
    bezel.position.set(0, height - sy, wallZ + 0.012);
    bezel.castShadow = false;
    root.add(bezel);

    // Screen surface (emissive)
    const screenMesh = new T.Mesh(
      new T.BoxGeometry(sw, sh, 0.01),
      screenMat(null),
    );
    screenMesh.position.set(0, height - sy, wallZ + 0.026);
    root.add(screenMesh);
  }

  // ── Company name text rendered to canvas ──
  if (brandingText) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width  = 1024;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, 1024, 192);
      ctx.fillStyle = 'rgba(255,255,255,0)';
      ctx.fillRect(0, 0, 1024, 192);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 88px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.letterSpacing = '6px';
      ctx.fillText(String(brandingText).toUpperCase(), 512, 96);

      const tex  = new T.CanvasTexture(canvas);
      const texW = Math.min(width * 0.65, 3.2);
      const texH = texW * (192 / 1024);

      const textY = hasScreen
        ? height - fasciaHeight - 0.1 - texH / 2
        : height / 2 + 0.15;

      const textMesh = new T.Mesh(
        new T.PlaneGeometry(texW, texH),
        new T.MeshStandardMaterial({
          map: tex,
          transparent: true,
          alphaTest: 0.01,
          roughness: 0.55,
          metalness: 0,
        }),
      );
      textMesh.position.set(0, textY, wallZ + 0.008);
      root.add(textMesh);
    } catch (_) { /* canvas unavailable in some contexts */ }
  }

  // ── Logo image (async) ──
  if (brandingLogoUrl && loader) {
    loader.load(brandingLogoUrl, (tex) => {
      const aspect = tex.image.width / tex.image.height;
      const lw     = Math.min(width * 0.4, 2.4);
      const lh     = lw / aspect;
      const ly     = height * 0.38;

      const logoMesh = new T.Mesh(
        new T.PlaneGeometry(lw, lh),
        new T.MeshStandardMaterial({
          map: tex, transparent: true, alphaTest: 0.01,
          roughness: 0.55, metalness: 0,
        }),
      );
      logoMesh.position.set(0, ly, wallZ + 0.008);
      root.add(logoMesh);
    }, undefined, () => {/* load error — silently skip */});
  }
}
