/**
 * booth/structure.js
 * Aluminum frame system: uprights (vertical posts) + horizontal beams.
 * Follows the Octanorm/Maxima grid — everything snaps to panel-module boundaries.
 *
 * Coordinate convention (same as rest of engine):
 *   X = width axis,  Y = up,  Z = depth axis
 *   booth centred at world origin; front opening faces +Z
 */

import { getStructureProfile } from './config.js';
import { aluminumMat } from './materials.js';

const THREE = () => window.THREE;

// ─── Low-level primitives ────────────────────────────────────────────────────

function makeBox(w, h, d, mat, shadow = true) {
  const T = THREE();
  const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  mesh.castShadow = shadow;
  mesh.receiveShadow = shadow;
  return mesh;
}

/**
 * Vertical upright post.
 * For Octanorm: octagonal cross-section (approximated as cylinder with 8 segments).
 * For Maxima:   square box profile.
 */
function makeUpright(height, profile, mat) {
  const T = THREE();
  let geo;
  if (profile.uprightShape === 'octagon') {
    geo = new T.CylinderGeometry(
      profile.uprightW / 2,
      profile.uprightW / 2,
      height,
      8,          // 8 sides ≈ octagonal Octanorm post
    );
  } else {
    geo = new T.BoxGeometry(profile.uprightW, height, profile.uprightD);
  }
  const mesh = new T.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ─── Horizontal beam helpers ─────────────────────────────────────────────────

/** Beam running along X axis (for front/back walls). */
function xBeam(length, profile, mat, yPos, zPos) {
  const beam = makeBox(length, profile.beamH, profile.beamD, mat);
  beam.position.set(0, yPos, zPos);
  return beam;
}

/** Beam running along Z axis (for side walls). */
function zBeam(length, profile, mat, xPos, yPos) {
  const beam = makeBox(profile.beamD, profile.beamH, length, mat);
  beam.position.set(xPos, yPos, 0);
  return beam;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Builds the complete aluminum skeleton and adds it to `root`.
 *
 * Uprights: one at each corner + intermediate posts every ~panelW metres
 * Beams:    top + bottom rail along each wall, plus mid-height on tall booths
 *
 * Returns an array of world-space spotlight anchor positions {x, y, z}
 * that the lighting module uses to position spots.
 */
export function buildStructure(root, cfg) {
  const T = THREE();
  if (!T) return [];

  const { width, depth, height, boothStyle } = cfg;
  const profile = getStructureProfile(boothStyle);
  const mat     = aluminumMat(boothStyle === 'maxima' ? 0x7a8896 : 0x9aabb8);

  const hw = width  / 2;
  const hd = depth  / 2;

  // ── Corner uprights ──
  const corners = [
    [-hw, -hd],
    [ hw, -hd],
    [-hw,  hd],
    [ hw,  hd],
  ];
  corners.forEach(([cx, cz]) => {
    const post = makeUpright(height, profile, mat);
    post.position.set(cx, height / 2, cz);
    root.add(post);
  });

  // ── Intermediate uprights (panel-module spacing) ──
  const spotAnchors = [];

  function addIntermediatePosts(axis, fixedCoord, span) {
    const step = profile.panelW + profile.beamD;
    let pos = -span / 2 + step;
    while (pos < span / 2 - 0.01) {
      const post = makeUpright(height, profile, mat);
      if (axis === 'x') {
        post.position.set(pos, height / 2, fixedCoord);
        // collect spotlight anchors along back wall top
        if (fixedCoord < 0) {
          spotAnchors.push({ x: pos, y: height - 0.05, z: fixedCoord + 0.15 });
        }
      } else {
        post.position.set(fixedCoord, height / 2, pos);
      }
      root.add(post);
      pos += step;
    }
  }

  addIntermediatePosts('x', -hd, width);   // back wall
  addIntermediatePosts('x',  hd, width);   // front wall
  addIntermediatePosts('z', -hw, depth);   // left wall
  addIntermediatePosts('z',  hw, depth);   // right wall

  // Add corner anchors for spotlights
  spotAnchors.push({ x: -hw + 0.2, y: height - 0.05, z: -hd + 0.2 });
  spotAnchors.push({ x:  hw - 0.2, y: height - 0.05, z: -hd + 0.2 });

  // ── Horizontal beams ──

  // Top rail
  root.add(xBeam(width, profile, mat,  height - profile.beamH / 2,  -hd)); // back top
  root.add(xBeam(width, profile, mat,  height - profile.beamH / 2,   hd)); // front top (open face)
  root.add(zBeam(depth, profile, mat, -hw, height - profile.beamH / 2));   // left top
  root.add(zBeam(depth, profile, mat,  hw, height - profile.beamH / 2));   // right top

  // Bottom rail
  root.add(xBeam(width, profile, mat, profile.beamH / 2, -hd));
  root.add(xBeam(width, profile, mat, profile.beamH / 2,  hd));
  root.add(zBeam(depth, profile, mat, -hw, profile.beamH / 2));
  root.add(zBeam(depth, profile, mat,  hw, profile.beamH / 2));

  // Mid-height rail (on panels taller than 2.3 m)
  if (height > 2.3) {
    const midY = height / 2;
    root.add(xBeam(width, profile, mat, midY, -hd));
    root.add(zBeam(depth, profile, mat, -hw,  midY));
    root.add(zBeam(depth, profile, mat,  hw,  midY));
  }

  return spotAnchors;
}
