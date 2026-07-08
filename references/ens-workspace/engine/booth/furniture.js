/**
 * booth/furniture.js
 * Minimal but structured furniture system using simple MeshStandard primitives.
 *
 * Layout zones (centre = world origin, front face = +Z):
 *   frontZone   z ≈ depth/2 - 0.6          (reception, podium)
 *   centerZone  z ≈ 0                       (meeting table, chairs)
 *   backZone    z ≈ -(depth/2) + 0.5        (shelving, storage, display)
 *
 * All pieces are inset from walls by a comfortable 0.12 m clearance.
 */

import { deskMat, deskTopMat, furnitureMat } from './materials.js';

const THREE = () => window.THREE;

// ─── Primitive helpers ────────────────────────────────────────────────────────

function box(w, h, d, mat, cast = true) {
  const T = THREE();
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

function cyl(r, h, mat, segs = 16) {
  const T = THREE();
  const mesh = new T.Mesh(new T.CylinderGeometry(r, r, h, segs), mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

/**
 * L-shaped reception desk in the front zone.
 * Body: dark veneer panels; top: light corian surface.
 */
function buildReceptionDesk(frontZ) {
  const T = THREE();
  const group = new T.Group();
  group.name = 'ReceptionDesk';

  const bodyMat = deskMat();
  const topMat  = deskTopMat();

  // Main counter (horizontal)
  const mainW = 1.8, mainD = 0.55, mainH = 1.02;
  const body  = box(mainW, mainH, mainD, bodyMat);
  body.position.set(0, mainH / 2, 0);
  group.add(body);

  // Counter top slab (slightly overhanging)
  const top = box(mainW + 0.04, 0.04, mainD + 0.06, topMat);
  top.position.set(0, mainH + 0.02, 0);
  group.add(top);

  // Return wing (side L-piece)
  const wingW = 0.55, wingD = 0.9;
  const wing  = box(wingW, mainH, wingD, bodyMat);
  wing.position.set((mainW + wingW) / 2 - wingW, mainH / 2, (wingD - mainD) / 2);
  group.add(wing);

  const wingTop = box(wingW + 0.04, 0.04, wingD + 0.04, topMat);
  wingTop.position.set((mainW + wingW) / 2 - wingW, mainH + 0.02, (wingD - mainD) / 2);
  group.add(wingTop);

  // Front branding strip — accent colour flush on front face
  const strip = box(mainW, 0.12, 0.01, new (THREE()).MeshStandardMaterial({
    color: 0x1b2d4f, roughness: 0.3, metalness: 0.1,
  }));
  strip.position.set(0, mainH - 0.08, mainD / 2 + 0.005);
  group.add(strip);

  // Position desk in front zone, centred
  group.position.set(-0.45, 0, frontZ - mainD / 2 - 0.15);
  return group;
}

/**
 * Round meeting table + 4 stools for centre zone.
 */
function buildCenterTable(centerZ) {
  const T = THREE();
  const group = new T.Group();
  group.name = 'CenterTable';

  const tableMat  = deskTopMat();
  const legMat    = furnitureMat(0x8a9aaa);
  const stoolMat  = furnitureMat(0xd4cfc8);

  // Table top (round)
  const tableTop = cyl(0.55, 0.04, tableMat, 32);
  tableTop.position.set(0, 0.76, 0);
  group.add(tableTop);

  // Table leg (single central pedestal)
  const leg = cyl(0.06, 0.72, legMat, 12);
  leg.position.set(0, 0.36, 0);
  group.add(leg);

  // Base disk
  const base = cyl(0.28, 0.04, legMat, 12);
  base.position.set(0, 0.02, 0);
  group.add(base);

  // 4 stools evenly around table
  const stoolR = 0.9;
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const sx  = Math.cos(ang) * stoolR;
    const sz  = Math.sin(ang) * stoolR;

    // Seat
    const seat = cyl(0.19, 0.04, stoolMat, 16);
    seat.position.set(sx, 0.68, sz);

    // Leg
    const sLeg = cyl(0.028, 0.64, legMat, 8);
    sLeg.position.set(sx, 0.34, sz);

    // Foot ring
    const foot = cyl(0.10, 0.025, legMat, 8);
    foot.position.set(sx, 0.025, sz);

    group.add(seat, sLeg, foot);
  }

  group.position.set(0.4, 0, centerZ);
  return group;
}

/**
 * Wall-mounted shelf display unit — back zone.
 * Three shelves stacked vertically against the back wall.
 */
function buildShelfUnit(backZ) {
  const T = THREE();
  const group = new T.Group();
  group.name = 'ShelfUnit';

  const bodyMat  = furnitureMat(0x2a1f14);
  const shelfMat = deskTopMat();

  // Back panel
  const back = box(1.2, 1.6, 0.04, bodyMat);
  back.position.set(0, 0.8, 0);
  group.add(back);

  // Side panels
  [-0.6, 0.6].forEach((sx) => {
    const side = box(0.04, 1.6, 0.35, bodyMat);
    side.position.set(sx, 0.8, 0.155);
    group.add(side);
  });

  // Three shelves
  [0.38, 0.82, 1.26].forEach((sy) => {
    const shelf = box(1.12, 0.028, 0.34, shelfMat);
    shelf.position.set(0, sy, 0.16);
    group.add(shelf);
  });

  // Small display objects on shelves (cylinder placeholders)
  const objMat = furnitureMat(0xc8c0b0);
  [0.38, 0.82, 1.26].forEach((sy, i) => {
    for (let j = 0; j < 3; j++) {
      const obj = cyl(0.04 - j * 0.008, 0.08 + j * 0.04, objMat, 8);
      obj.position.set(-0.32 + j * 0.32, sy + 0.054, 0.16);
      group.add(obj);
    }
  });

  group.position.set(-0.5, 0, backZ + 0.18);
  return group;
}

// ─── Layout builder ───────────────────────────────────────────────────────────

/**
 * Adds furniture to the booth root according to the layout zone system.
 *
 * Zone definitions (relative to booth depth `d`):
 *   frontZone  → z = d/2 - 0.55
 *   centerZone → z = 0
 *   backZone   → z = -(d/2) + 0.45
 */
export function buildFurnitureLayout(root, cfg) {
  const { depth, hasReceptionDesk, hasCenterTable, hasShelfUnit } = cfg;
  const hd = depth / 2;

  if (hasReceptionDesk) {
    root.add(buildReceptionDesk(hd - 0.55));
  }
  if (hasCenterTable) {
    root.add(buildCenterTable(0));
  }
  if (hasShelfUnit) {
    root.add(buildShelfUnit(-hd + 0.45));
  }
}
