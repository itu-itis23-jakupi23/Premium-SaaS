import { createWallShelf } from '/static/js/furniture/wall_shelf.js?v=20260412-room-system';

const THREE_REF = () => window.THREE || null;

const MATERIAL_PRESETS = Object.freeze({
  softWhite: Object.freeze({ color: 0xf6f2ec, roughness: 0.92, metalness: 0.02 }),
  laminateWhite: Object.freeze({ color: 0xf3eee7, roughness: 0.9, metalness: 0.02 }),
  ivoryWhite: Object.freeze({ color: 0xece2d4, roughness: 0.9, metalness: 0.02 }),
  warmBeige: Object.freeze({ color: 0xd8c6b2, roughness: 0.88, metalness: 0.03 }),
  taupeGray: Object.freeze({ color: 0xd6cdc2, roughness: 0.86, metalness: 0.04 }),
  softGray: Object.freeze({ color: 0xe0e5eb, roughness: 0.88, metalness: 0.04 }),
  chrome: Object.freeze({ color: 0xbec6cf, roughness: 0.28, metalness: 0.82 }),
  brushedSteel: Object.freeze({ color: 0x9ca5af, roughness: 0.34, metalness: 0.72 }),
  graphiteMetal: Object.freeze({ color: 0x4b4f56, roughness: 0.5, metalness: 0.46 }),
  oakWood: Object.freeze({ color: 0xbb936c, roughness: 0.82, metalness: 0.04 }),
  walnutWood: Object.freeze({ color: 0x5c4335, roughness: 0.84, metalness: 0.04 }),
  matteBlack: Object.freeze({ color: 0x212428, roughness: 0.82, metalness: 0.08 }),
  smokeGlass: Object.freeze({ color: 0xa9b1b9, roughness: 0.14, metalness: 0.18, transparent: true, opacity: 0.55, depthWrite: false }),
  clearGlass: Object.freeze({ color: 0xf0f5fa, roughness: 0.08, metalness: 0.06, transparent: true, opacity: 0.38, depthWrite: false }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createMaterial(input, overrides = {}) {
  const THREE = THREE_REF();
  const base = input && typeof input === 'object' && !Array.isArray(input)
    ? input
    : { color: input };
  return new THREE.MeshStandardMaterial({
    color: base.color ?? 0xffffff,
    roughness: base.roughness ?? 0.92,
    metalness: base.metalness ?? 0.02,
    transparent: base.transparent ?? false,
    opacity: base.opacity ?? 1,
    depthWrite: base.depthWrite ?? true,
    ...overrides,
  });
}

function createEmissiveMaterial(color = 0xfff4cf, emissiveIntensity = 1.4, opacity = 1) {
  const THREE = THREE_REF();
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity,
    roughness: 0.3,
    metalness: 0.08,
    transparent: opacity < 1,
    opacity,
  });
}

function createMesh(geometry, material) {
  const THREE = THREE_REF();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createLine(points = [], color = 0xd5dde6) {
  const THREE = THREE_REF();
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color });
  return new THREE.Line(geometry, material);
}

function getSizeMeters(item = {}) {
  const dimensions = item.dimensions && typeof item.dimensions === 'object' ? item.dimensions : {};
  const size = item.size && typeof item.size === 'object' ? item.size : {};
  const width = Number(size.width) || (Number(dimensions.width ?? dimensions.diameter) || 100) / 100;
  const depth = Number(size.depth) || (Number(dimensions.depth ?? dimensions.width ?? dimensions.diameter) || 100) / 100;
  const height = Number(size.height) || (Number(dimensions.height) || 100) / 100;
  return {
    width: Math.max(0.05, width),
    depth: Math.max(0.05, depth),
    height: Math.max(0.05, height),
  };
}

function createFurnitureGroup(item = {}) {
  const THREE = THREE_REF();
  if (!THREE) return null;
  const group = new THREE.Group();
  const railPosition = Number(item.railPosition ?? item.rail_position);
  group.userData = {
    code: String(item.code || item.id || item.asset_id || '').trim(),
    name: String(item.name || 'Furniture').trim(),
    price: Number(item.price || 0),
    railPosition: Number.isFinite(railPosition) ? railPosition : 0.5,
  };
  return group;
}

function getMaterialPreset(name) {
  return MATERIAL_PRESETS[name] || MATERIAL_PRESETS.softWhite;
}

function resolveFurniturePalette(item = {}) {
  const code = String(item.code || item.id || item.asset_id || '').trim().toUpperCase();
  const shape = String(item.shape || '').trim().toLowerCase();
  const palette = {
    top: getMaterialPreset('softWhite'),
    base: getMaterialPreset('softGray'),
    legs: getMaterialPreset('softGray'),
    apron: getMaterialPreset('softGray'),
    shell: getMaterialPreset('softWhite'),
    shelf: getMaterialPreset('softGray'),
    accent: getMaterialPreset('taupeGray'),
    panel: getMaterialPreset('taupeGray'),
    seat: getMaterialPreset('softWhite'),
    frame: getMaterialPreset('brushedSteel'),
  };

  if (shape === 'round_table') {
    palette.top = getMaterialPreset('softWhite');
    palette.base = getMaterialPreset('graphiteMetal');
  } else if (shape === 'rect_table') {
    palette.top = getMaterialPreset('softWhite');
    palette.legs = getMaterialPreset('brushedSteel');
    palette.apron = getMaterialPreset('brushedSteel');
  } else if (shape === 'box') {
    palette.shell = getMaterialPreset('laminateWhite');
    palette.shelf = getMaterialPreset('softGray');
  } else if (shape === 'counter') {
    palette.shell = getMaterialPreset('softWhite');
    palette.accent = getMaterialPreset('taupeGray');
    palette.panel = getMaterialPreset('taupeGray');
  } else if (shape === 'shelf') {
    palette.shell = getMaterialPreset('laminateWhite');
    palette.shelf = getMaterialPreset('softWhite');
    palette.accent = getMaterialPreset('softGray');
  } else if (shape === 'chair') {
    palette.seat = getMaterialPreset('softWhite');
    palette.frame = getMaterialPreset('brushedSteel');
  } else if (shape === 'bar_stool') {
    palette.seat = getMaterialPreset('softWhite');
    palette.frame = getMaterialPreset('chrome');
  }

  switch (code) {
    case '103':
      palette.top = getMaterialPreset('laminateWhite');
      palette.base = getMaterialPreset('graphiteMetal');
      break;
    case '105':
      palette.top = getMaterialPreset('warmBeige');
      palette.base = getMaterialPreset('chrome');
      break;
    case '107':
      palette.top = getMaterialPreset('laminateWhite');
      palette.base = getMaterialPreset('graphiteMetal');
      break;
    case '110':
      palette.top = getMaterialPreset('smokeGlass');
      palette.base = getMaterialPreset('chrome');
      break;
    case '111':
      palette.top = getMaterialPreset('ivoryWhite');
      palette.legs = getMaterialPreset('walnutWood');
      palette.apron = getMaterialPreset('walnutWood');
      break;
    case '112':
    case '113':
      palette.top = getMaterialPreset('laminateWhite');
      palette.legs = getMaterialPreset('laminateWhite');
      palette.apron = getMaterialPreset('softWhite');
      break;
    case '149':
      palette.seat = getMaterialPreset('softWhite');
      palette.frame = getMaterialPreset('oakWood');
      break;
    case '201':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.shelf = getMaterialPreset('clearGlass');
      break;
    case '205':
    case '206':
    case '406':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.shelf = getMaterialPreset('clearGlass');
      break;
    case '208':
    case '209':
      palette.shell = getMaterialPreset('softWhite');
      palette.accent = getMaterialPreset('taupeGray');
      palette.panel = getMaterialPreset('taupeGray');
      break;
    case '211':
      palette.top = getMaterialPreset('matteBlack');
      palette.legs = getMaterialPreset('brushedSteel');
      palette.apron = getMaterialPreset('brushedSteel');
      break;
    case '212':
      palette.top = getMaterialPreset('laminateWhite');
      palette.legs = getMaterialPreset('chrome');
      palette.apron = getMaterialPreset('chrome');
      break;
    case '213':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.shelf = getMaterialPreset('softWhite');
      palette.accent = getMaterialPreset('softGray');
      break;
    case '215':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.accent = getMaterialPreset('softWhite');
      palette.panel = getMaterialPreset('softWhite');
      break;
    case '216':
    case '217':
    case '218':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.shelf = getMaterialPreset('softWhite');
      break;
    case '250-B':
      palette.seat = getMaterialPreset('laminateWhite');
      palette.frame = getMaterialPreset('graphiteMetal');
      break;
    case '255-B':
      palette.seat = getMaterialPreset('softWhite');
      palette.frame = getMaterialPreset('chrome');
      break;
    case '307':
      palette.seat = getMaterialPreset('matteBlack');
      palette.frame = getMaterialPreset('chrome');
      break;
    case '309':
      palette.seat = getMaterialPreset('matteBlack');
      palette.frame = getMaterialPreset('chrome');
      break;
    case '458':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.accent = getMaterialPreset('softWhite');
      palette.panel = getMaterialPreset('softWhite');
      break;
    case '461':
      palette.shell = getMaterialPreset('laminateWhite');
      palette.accent = getMaterialPreset('taupeGray');
      palette.panel = getMaterialPreset('taupeGray');
      break;
    case '508':
      palette.top = getMaterialPreset('laminateWhite');
      palette.legs = getMaterialPreset('laminateWhite');
      palette.apron = getMaterialPreset('laminateWhite');
      break;
    case '513':
      palette.seat = getMaterialPreset('matteBlack');
      palette.frame = getMaterialPreset('graphiteMetal');
      break;
    default:
      break;
  }

  return palette;
}

function addBox(group, width, height, depth, yCenter, material, position = {}) {
  const THREE = THREE_REF();
  const mesh = createMesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );
  mesh.position.set(
    Number(position.x) || 0,
    Number(yCenter) || 0,
    Number(position.z) || 0
  );
  group.add(mesh);
  return mesh;
}

function addCylinder(group, radiusTop, radiusBottom, height, segments, yCenter, material) {
  const THREE = THREE_REF();
  const mesh = createMesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material
  );
  mesh.position.y = Number(yCenter) || 0;
  group.add(mesh);
  return mesh;
}

function buildRoundTable(item = {}) {
  const size = getSizeMeters(item);
  const diameter = Math.max(0.2, Math.min(size.width, size.depth));
  const radius = diameter / 2;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const mainMaterial = createMaterial(palette.top);
  const accentMaterial = createMaterial(palette.base);
  const topThickness = clamp(height * 0.05, 0.025, 0.055);
  const baseThickness = clamp(height * 0.035, 0.02, 0.035);
  const stemHeight = Math.max(0.08, height - topThickness - baseThickness);

  addCylinder(group, radius, radius, topThickness, 20, height - (topThickness / 2), mainMaterial);
  addCylinder(group, radius * 0.13, radius * 0.16, stemHeight, 14, baseThickness + (stemHeight / 2), accentMaterial);
  addCylinder(group, radius * 0.34, radius * 0.4, baseThickness, 16, baseThickness / 2, accentMaterial);

  return group;
}

function buildRectTable(item = {}) {
  const size = getSizeMeters(item);
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const mainMaterial = createMaterial(palette.top);
  const accentMaterial = createMaterial(palette.legs);
  const apronMaterial = createMaterial(palette.apron);
  const topThickness = clamp(height * 0.06, 0.022, 0.05);
  const legWidth = clamp(Math.min(width, depth) * 0.09, 0.028, 0.06);
  const legHeight = Math.max(0.08, height - topThickness);
  const insetX = Math.max(legWidth * 0.75, Math.min(width * 0.12, 0.11));
  const insetZ = Math.max(legWidth * 0.75, Math.min(depth * 0.12, 0.11));

  addBox(group, width, topThickness, depth, height - (topThickness / 2), mainMaterial);

  [
    { x: -(width / 2) + insetX, z: -(depth / 2) + insetZ },
    { x: (width / 2) - insetX, z: -(depth / 2) + insetZ },
    { x: -(width / 2) + insetX, z: (depth / 2) - insetZ },
    { x: (width / 2) - insetX, z: (depth / 2) - insetZ },
  ].forEach((corner) => {
    addBox(group, legWidth, legHeight, legWidth, legHeight / 2, accentMaterial, corner);
  });

  if (height >= 0.7) {
    const apronHeight = clamp(height * 0.055, 0.032, 0.05);
    const apronY = height - topThickness - (apronHeight / 2);
    addBox(group, Math.max(0.08, width - (insetX * 1.2)), apronHeight, legWidth * 0.8, apronY, apronMaterial, { z: -(depth / 2) + insetZ });
    addBox(group, Math.max(0.08, width - (insetX * 1.2)), apronHeight, legWidth * 0.8, apronY, apronMaterial, { z: (depth / 2) - insetZ });
  }

  return group;
}

function buildBox(item = {}) {
  const size = getSizeMeters(item);
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const shellMaterial = createMaterial(palette.shell);
  const shelfMaterial = createMaterial(palette.shelf);
  const wall = clamp(Math.min(width, depth, height) * 0.06, 0.018, 0.05);
  const innerWidth = Math.max(0.05, width - (wall * 2));
  const innerDepth = Math.max(0.05, depth - wall);

  addBox(group, width, wall, depth, wall / 2, shellMaterial);
  addBox(group, width, wall, depth, height - (wall / 2), shellMaterial);
  addBox(group, wall, height - (wall * 2), depth, height / 2, shellMaterial, { x: -(width / 2) + (wall / 2) });
  addBox(group, wall, height - (wall * 2), depth, height / 2, shellMaterial, { x: (width / 2) - (wall / 2) });
  addBox(group, innerWidth, Math.max(0.05, height - (wall * 2)), wall, height / 2, shellMaterial, { z: -(depth / 2) + (wall / 2) });

  let shelfCount = 0;
  if (height >= 1.75) shelfCount = 3;
  else if (height >= 1.15) shelfCount = 2;
  else if (height >= 0.65) shelfCount = 1;

  for (let index = 1; index <= shelfCount; index += 1) {
    const shelfY = (height / (shelfCount + 1)) * index;
    addBox(group, innerWidth, wall * 0.9, innerDepth, shelfY, shelfMaterial);
  }

  return group;
}

function buildCounter(item = {}) {
  const size = getSizeMeters(item);
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const shellMaterial = createMaterial(palette.shell);
  const accentMaterial = createMaterial(palette.accent);
  const panelMaterial = createMaterial(palette.panel);
  const topThickness = clamp(height * 0.055, 0.028, 0.055);
  const bodyHeight = Math.max(0.08, height - topThickness);
  const toeHeight = clamp(height * 0.08, 0.045, 0.075);
  const toeInset = clamp(Math.min(width, depth) * 0.08, 0.03, 0.06);
  const capWidth = width + clamp(width * 0.04, 0.015, 0.04);
  const capDepth = depth + clamp(depth * 0.04, 0.015, 0.04);

  addBox(group, width, bodyHeight, depth, bodyHeight / 2, shellMaterial);
  addBox(group, capWidth, topThickness, capDepth, height - (topThickness / 2), accentMaterial);
  addBox(
    group,
    Math.max(0.05, width - (toeInset * 2)),
    toeHeight,
    Math.max(0.05, depth - (toeInset * 2)),
    toeHeight / 2,
    accentMaterial
  );

  const panelBandHeight = clamp(height * 0.12, 0.07, 0.12);
  addBox(
    group,
    Math.max(0.05, width - (toeInset * 1.2)),
    panelBandHeight,
    0.018,
    bodyHeight - (panelBandHeight / 2) - (topThickness * 0.2),
    panelMaterial,
    { z: (depth / 2) - 0.012 }
  );

  return group;
}

function buildShelf(item = {}) {
  const size = getSizeMeters(item);
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const shellMaterial = createMaterial(palette.shell);
  const accentMaterial = createMaterial(palette.shelf);
  const detailMaterial = createMaterial(palette.accent);
  const wall = clamp(Math.min(width, depth, height) * 0.055, 0.016, 0.04);
  const toeHeight = clamp(height * 0.035, 0.018, 0.035);
  const shelfWidth = Math.max(0.05, width - (wall * 2));
  const shelfDepth = Math.max(0.05, depth - (wall * 0.8));
  const usableHeight = Math.max(0.12, height - toeHeight - (wall * 2));

  addBox(group, width, toeHeight, depth, toeHeight / 2, detailMaterial);
  addBox(group, wall, height - toeHeight, depth, toeHeight + ((height - toeHeight) / 2), shellMaterial, { x: -(width / 2) + (wall / 2) });
  addBox(group, wall, height - toeHeight, depth, toeHeight + ((height - toeHeight) / 2), shellMaterial, { x: (width / 2) - (wall / 2) });
  addBox(group, width, wall, depth, height - (wall / 2), shellMaterial);
  addBox(group, width, wall, depth, toeHeight + (wall / 2), shellMaterial);
  addBox(group, shelfWidth, Math.max(0.012, wall * 0.9), wall, height / 2, detailMaterial, { z: -(depth / 2) + (wall / 2) });

  const shelfCount = height >= 1.75 ? 4 : (height >= 1.15 ? 3 : 2);
  for (let index = 1; index <= shelfCount; index += 1) {
    const shelfY = toeHeight + ((usableHeight / (shelfCount + 1)) * index);
    addBox(group, shelfWidth, Math.max(0.012, wall * 0.85), shelfDepth, shelfY, accentMaterial);
  }

  return group;
}

function buildChair(item = {}) {
  const size = getSizeMeters(item);
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const frameMaterial = createMaterial(palette.frame);
  const seatMaterial = createMaterial(palette.seat);
  const seatHeight = clamp(height * 0.56, 0.42, Math.max(0.42, height - 0.18));
  const seatThickness = clamp(height * 0.055, 0.02, 0.04);
  const legWidth = clamp(Math.min(width, depth) * 0.09, 0.018, 0.04);
  const insetX = Math.max(legWidth * 0.8, Math.min(width * 0.14, 0.08));
  const insetZ = Math.max(legWidth * 0.8, Math.min(depth * 0.14, 0.08));
  const legHeight = Math.max(0.06, seatHeight - seatThickness);
  const seatWidth = Math.max(0.08, width - (insetX * 0.75));
  const seatDepth = Math.max(0.08, depth - (insetZ * 0.9));
  const backHeight = Math.max(0.12, height - seatHeight);
  const backThickness = clamp(depth * 0.08, 0.018, 0.032);

  addBox(group, seatWidth, seatThickness, seatDepth, seatHeight - (seatThickness / 2), seatMaterial);
  [
    { x: -(width / 2) + insetX, z: -(depth / 2) + insetZ },
    { x: (width / 2) - insetX, z: -(depth / 2) + insetZ },
    { x: -(width / 2) + insetX, z: (depth / 2) - insetZ },
    { x: (width / 2) - insetX, z: (depth / 2) - insetZ },
  ].forEach((corner) => {
    addBox(group, legWidth, legHeight, legWidth, legHeight / 2, frameMaterial, corner);
  });

  addBox(
    group,
    Math.max(0.08, seatWidth - (legWidth * 0.8)),
    backHeight,
    backThickness,
    seatHeight + (backHeight / 2) - (seatThickness * 0.35),
    seatMaterial,
    { z: -(depth / 2) + (backThickness / 2) + (legWidth * 0.35) }
  );

  return group;
}

function buildBarStool(item = {}) {
  const size = getSizeMeters(item);
  const width = size.width;
  const depth = size.depth;
  const height = size.height;
  const group = createFurnitureGroup(item);
  if (!group) return null;

  const palette = resolveFurniturePalette(item);
  const frameMaterial = createMaterial(palette.frame);
  const seatMaterial = createMaterial(palette.seat);
  const seatHeight = clamp(height * 0.74, 0.68, Math.max(0.68, height - 0.16));
  const seatThickness = clamp(height * 0.05, 0.022, 0.04);
  const legWidth = clamp(Math.min(width, depth) * 0.085, 0.018, 0.035);
  const insetX = Math.max(legWidth * 0.85, Math.min(width * 0.16, 0.07));
  const insetZ = Math.max(legWidth * 0.85, Math.min(depth * 0.16, 0.07));
  const legHeight = Math.max(0.08, seatHeight - seatThickness);
  const seatWidth = Math.max(0.08, width - (insetX * 0.55));
  const seatDepth = Math.max(0.08, depth - (insetZ * 0.55));

  addBox(group, seatWidth, seatThickness, seatDepth, seatHeight - (seatThickness / 2), seatMaterial);
  [
    { x: -(width / 2) + insetX, z: -(depth / 2) + insetZ },
    { x: (width / 2) - insetX, z: -(depth / 2) + insetZ },
    { x: -(width / 2) + insetX, z: (depth / 2) - insetZ },
    { x: (width / 2) - insetX, z: (depth / 2) - insetZ },
  ].forEach((corner) => {
    addBox(group, legWidth, legHeight, legWidth, legHeight / 2, frameMaterial, corner);
  });

  addCylinder(group, Math.max(0.06, Math.min(width, depth) * 0.34), Math.max(0.06, Math.min(width, depth) * 0.34), legWidth, 18, seatHeight * 0.42, frameMaterial);

  if (height >= 0.95) {
    const backHeight = Math.max(0.12, height - seatHeight + (seatThickness * 0.4));
    addBox(
      group,
      Math.max(0.08, seatWidth - (legWidth * 0.9)),
      backHeight,
      clamp(depth * 0.08, 0.018, 0.03),
      seatHeight + (backHeight / 2) - (seatThickness * 0.35),
      seatMaterial,
      { z: -(depth / 2) + 0.03 }
    );
  }

  return group;
}

function createShadowConfig(light, mapSize = 512) {
  if (!light?.shadow) return;
  light.castShadow = true;
  const safeMapSize = Math.max(256, Math.min(1024, Number(mapSize) || 512));
  light.shadow.mapSize.width = safeMapSize;
  light.shadow.mapSize.height = safeMapSize;
  light.shadow.bias = -0.00018;
  if (light.shadow.camera) {
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 10;
  }
}

function applyRailLightUserData(group, item = {}, lightType = 'spot') {
  const railPosition = Number(item.railPosition ?? item.rail_position);
  group.userData = {
    ...group.userData,
    type: 'light',
    lightType,
    railPosition: Number.isFinite(railPosition) ? railPosition : 0.5,
  };
  return group;
}

function addRailClampAssembly(group, size, clampMaterial, hardwareMaterial) {
  const clampWidth = clamp(size.width * 0.65, 0.09, 0.16);
  const clampDepth = clamp(size.depth * 0.42, 0.05, 0.11);
  const topPlateHeight = clamp(size.height * 0.08, 0.014, 0.024);
  const jawHeight = clamp(size.height * 0.12, 0.024, 0.04);
  const neckHeight = clamp(size.height * 0.16, 0.035, 0.06);

  addBox(group, clampWidth, topPlateHeight, clampDepth, -(topPlateHeight / 2), clampMaterial);
  addBox(
    group,
    clampWidth * 0.6,
    jawHeight,
    topPlateHeight * 1.2,
    -(topPlateHeight + (jawHeight / 2)),
    hardwareMaterial,
    { z: (clampDepth / 2) - (topPlateHeight * 0.6) }
  );
  addBox(
    group,
    topPlateHeight * 1.7,
    neckHeight,
    topPlateHeight * 1.7,
    -(topPlateHeight + (neckHeight / 2)),
    hardwareMaterial,
    { z: -(clampDepth * 0.12) }
  );
  addBox(
    group,
    clampWidth * 0.24,
    topPlateHeight * 0.7,
    clampDepth * 0.72,
    -(topPlateHeight * 1.35),
    hardwareMaterial
  );

  return {
    mountY: -(topPlateHeight + neckHeight),
    guideStartY: -(topPlateHeight + (neckHeight * 0.35)),
  };
}

function addBeamGuide(group, start, end, color = 0xffecad) {
  const guide = createLine([start, end], color);
  if (guide.material) {
    guide.material.transparent = true;
    guide.material.opacity = 0.46;
    guide.material.depthWrite = false;
  }
  guide.userData.isHelperLine = true;
  group.add(guide);
  return guide;
}

function attachSpotLightSource(group, config = {}) {
  const THREE = THREE_REF();
  if (!THREE || !group) return null;
  const light = new THREE.SpotLight(
    0xffffff,
    Number(config.intensity) || 1,
    Number(config.distance) || 7,
    Number(config.angle) || (Math.PI / 6),
    Number(config.penumbra) || 0.3,
    Number(config.decay) || 1.1
  );
  const lightPosition = config.position || { x: 0, y: -0.18, z: -0.16 };
  const targetPosition = config.target || { x: 0, y: -1.05, z: -1.2 };
  light.position.set(
    Number(lightPosition.x) || 0,
    Number(lightPosition.y) || 0,
    Number(lightPosition.z) || 0
  );
  light.castShadow = true;
  const target = new THREE.Object3D();
  target.position.set(
    Number(targetPosition.x) || 0,
    Number(targetPosition.y) || 0,
    Number(targetPosition.z) || 0
  );
  light.target = target;
  createShadowConfig(light, config.shadowMapSize || 512);
  if (light.shadow) {
    light.shadow.focus = Number(config.shadowFocus) || 0.82;
  }
  group.add(target);
  group.add(light);
  group.userData.light = light;
  group.userData.lightTarget = target;
  return light;
}

export function buildSpotLightModel(item = {}) {
  const THREE = THREE_REF();
  if (!THREE) return null;
  const size = getSizeMeters(item);
  const group = createFurnitureGroup(item);
  if (!group) return null;
  applyRailLightUserData(group, item, 'spot');

  const clampMaterial = createMaterial({ color: 0xaeb7c1, roughness: 0.34, metalness: 0.72 });
  const hardwareMaterial = createMaterial({ color: 0x5b6470, roughness: 0.48, metalness: 0.44 });
  const housingMaterial = createMaterial({ color: 0x262b31, roughness: 0.56, metalness: 0.38 });
  const trimMaterial = createMaterial({ color: 0x15181c, roughness: 0.5, metalness: 0.22 });
  const emitterMaterial = createEmissiveMaterial(0xfff0c6, 1.7, 0.96);
  const mount = addRailClampAssembly(group, size, clampMaterial, hardwareMaterial);

  const armLength = clamp(size.height * 0.18, 0.05, 0.085);
  const arm = createMesh(
    new THREE.CylinderGeometry(0.008, 0.01, armLength, 10),
    hardwareMaterial
  );
  arm.position.set(0, mount.mountY - (armLength / 2), -0.018);
  arm.rotation.z = Math.PI / 7;
  group.add(arm);

  const headY = mount.mountY - armLength - 0.028;
  const headZ = -clamp(size.depth * 0.34, 0.055, 0.085);
  const bodyRadius = clamp(Math.min(size.width, size.depth) * 0.18, 0.028, 0.048);
  const bodyLength = clamp(size.height * 0.38, 0.11, 0.18);

  addBox(group, 0.012, 0.048, 0.01, headY, hardwareMaterial, { x: -0.028, z: headZ + 0.01 });
  addBox(group, 0.012, 0.048, 0.01, headY, hardwareMaterial, { x: 0.028, z: headZ + 0.01 });

  const housing = createMesh(
    new THREE.CylinderGeometry(bodyRadius * 0.92, bodyRadius, bodyLength, 18),
    housingMaterial
  );
  housing.rotation.x = Math.PI / 2;
  housing.position.set(0, headY, headZ);
  group.add(housing);

  const rearCap = createMesh(
    new THREE.CylinderGeometry(bodyRadius * 0.7, bodyRadius * 0.7, 0.016, 18),
    trimMaterial
  );
  rearCap.rotation.x = Math.PI / 2;
  rearCap.position.set(0, headY, headZ + (bodyLength / 2) - 0.005);
  group.add(rearCap);

  const lensRing = createMesh(
    new THREE.CylinderGeometry(bodyRadius * 0.84, bodyRadius * 0.84, 0.014, 18),
    trimMaterial
  );
  lensRing.rotation.x = Math.PI / 2;
  lensRing.position.set(0, headY, headZ - (bodyLength / 2) + 0.002);
  group.add(lensRing);

  const lens = createMesh(
    new THREE.CylinderGeometry(bodyRadius * 0.7, bodyRadius * 0.7, 0.01, 18),
    emitterMaterial
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, headY, headZ - (bodyLength / 2) - 0.006);
  group.add(lens);

  addBeamGuide(
    group,
    new THREE.Vector3(0, headY, headZ - (bodyLength / 2) - 0.012),
    new THREE.Vector3(0, headY - 0.45, headZ - 0.46)
  );

  attachSpotLightSource(group, {
    intensity: 1.35,
    distance: 7.5,
    angle: Math.PI / 6,
    penumbra: 0.3,
    position: { x: 0, y: headY - 0.004, z: headZ - (bodyLength / 2) - 0.012 },
    target: { x: 0, y: headY - 1.0, z: headZ - 1.25 },
    shadowMapSize: 1024,
    shadowFocus: 0.9,
  });

  return group;
}

export function buildFloodLightModel(item = {}) {
  const THREE = THREE_REF();
  if (!THREE) return null;
  const size = getSizeMeters(item);
  const group = createFurnitureGroup(item);
  if (!group) return null;
  applyRailLightUserData(group, item, 'flood');

  const clampMaterial = createMaterial({ color: 0xaeb7c1, roughness: 0.34, metalness: 0.72 });
  const hardwareMaterial = createMaterial({ color: 0x606873, roughness: 0.46, metalness: 0.42 });
  const housingMaterial = createMaterial({ color: 0x2e343c, roughness: 0.54, metalness: 0.34 });
  const frameMaterial = createMaterial({ color: 0x1b2026, roughness: 0.48, metalness: 0.2 });
  const emitterMaterial = createEmissiveMaterial(0xfff3d2, 1.45, 0.92);
  const mount = addRailClampAssembly(group, size, clampMaterial, hardwareMaterial);

  const yokeDrop = clamp(size.height * 0.22, 0.06, 0.1);
  const bodyY = mount.mountY - yokeDrop - 0.032;
  const bodyZ = -clamp(size.depth * 0.28, 0.04, 0.07);
  const bodyWidth = clamp(size.width * 0.72, 0.12, 0.18);
  const bodyHeight = clamp(size.height * 0.32, 0.07, 0.11);
  const bodyDepth = clamp(size.depth * 0.34, 0.045, 0.075);

  addBox(group, 0.012, yokeDrop, 0.01, mount.mountY - (yokeDrop / 2), hardwareMaterial, { x: -((bodyWidth / 2) - 0.016), z: bodyZ + 0.012 });
  addBox(group, 0.012, yokeDrop, 0.01, mount.mountY - (yokeDrop / 2), hardwareMaterial, { x: (bodyWidth / 2) - 0.016, z: bodyZ + 0.012 });

  addBox(group, bodyWidth, bodyHeight, bodyDepth, bodyY, housingMaterial, { z: bodyZ });
  addBox(group, bodyWidth * 0.86, bodyHeight * 0.74, 0.012, bodyY, emitterMaterial, { z: bodyZ - (bodyDepth / 2) - 0.008 });
  addBox(group, bodyWidth * 0.92, bodyHeight * 0.82, 0.01, bodyY, frameMaterial, { z: bodyZ - (bodyDepth / 2) + 0.002 });
  addBox(group, bodyWidth * 0.78, 0.012, 0.016, bodyY + (bodyHeight / 2) - 0.01, frameMaterial, { z: bodyZ });

  addBeamGuide(
    group,
    new THREE.Vector3(0, bodyY, bodyZ - (bodyDepth / 2) - 0.012),
    new THREE.Vector3(0, bodyY - 0.42, bodyZ - 0.42)
  );

  attachSpotLightSource(group, {
    intensity: 1.15,
    distance: 7,
    angle: Math.PI / 4.5,
    penumbra: 0.34,
    position: { x: 0, y: bodyY, z: bodyZ - (bodyDepth / 2) - 0.016 },
    target: { x: 0, y: bodyY - 0.95, z: bodyZ - 1.05 },
    shadowMapSize: 768,
    shadowFocus: 0.74,
  });

  return group;
}

export function buildFasciaLightModel(item = {}) {
  const THREE = THREE_REF();
  if (!THREE) return null;
  const size = getSizeMeters(item);
  const group = createFurnitureGroup(item);
  if (!group) return null;
  applyRailLightUserData(group, item, 'fascia');

  const bracketMaterial = createMaterial({ color: 0xb1bac4, roughness: 0.34, metalness: 0.74 });
  const housingMaterial = createMaterial({ color: 0xdee5ec, roughness: 0.58, metalness: 0.18 });
  const trimMaterial = createMaterial({ color: 0x8c97a2, roughness: 0.42, metalness: 0.48 });
  const emitterMaterial = createEmissiveMaterial(0xfff4d7, 1.2, 0.9);

  const bodyWidth = clamp(size.width, 0.24, 0.42);
  const bodyHeight = clamp(size.height * 0.28, 0.034, 0.05);
  const bodyDepth = clamp(size.depth * 0.52, 0.055, 0.08);
  const bracketInset = clamp(bodyWidth * 0.34, 0.08, 0.14);
  const bracketDrop = clamp(size.height * 0.18, 0.03, 0.045);
  const bodyY = -(bodyHeight + bracketDrop);
  const bodyZ = -clamp(size.depth * 0.12, 0.016, 0.03);

  addBox(group, bodyWidth * 0.18, 0.018, bodyDepth * 0.82, -0.009, bracketMaterial, { x: -bracketInset });
  addBox(group, bodyWidth * 0.18, 0.018, bodyDepth * 0.82, -0.009, bracketMaterial, { x: bracketInset });
  addBox(group, 0.012, bracketDrop, 0.012, -(0.018 + (bracketDrop / 2)), bracketMaterial, { x: -bracketInset });
  addBox(group, 0.012, bracketDrop, 0.012, -(0.018 + (bracketDrop / 2)), bracketMaterial, { x: bracketInset });
  addBox(group, bodyWidth, bodyHeight, bodyDepth, bodyY, housingMaterial, { z: bodyZ });
  addBox(group, bodyWidth * 0.9, bodyHeight * 0.42, bodyDepth * 0.62, bodyY - (bodyHeight * 0.12), emitterMaterial, { z: bodyZ - 0.004 });
  addBox(group, bodyWidth * 0.98, 0.01, bodyDepth * 0.88, bodyY + (bodyHeight / 2) - 0.004, trimMaterial, { z: bodyZ });

  addBeamGuide(
    group,
    new THREE.Vector3(0, bodyY - 0.01, bodyZ - 0.02),
    new THREE.Vector3(0, bodyY - 0.35, bodyZ - 0.36)
  );

  attachSpotLightSource(group, {
    intensity: 0.88,
    distance: 6.2,
    angle: Math.PI / 5,
    penumbra: 0.36,
    position: { x: 0, y: bodyY - 0.012, z: bodyZ - 0.02 },
    target: { x: 0, y: bodyY - 0.84, z: bodyZ - 0.92 },
    shadowMapSize: 512,
    shadowFocus: 0.7,
  });

  return group;
}

export function buildRailLight(type = 'spot', item = {}) {
  const normalizedType = String(type || 'spot').trim().toLowerCase();
  if (normalizedType === 'flood') return buildFloodLightModel(item);
  if (normalizedType === 'fascia') return buildFasciaLightModel(item);
  return buildSpotLightModel(item);
}

export function isParametricFurniture(item = {}) {
  const type = String(item.type || '').trim().toLowerCase();
  const shape = String(item.shape || '').trim().toLowerCase();
  const objectKind = String(item.objectKind || item.object_kind || '').trim().toLowerCase();
  return type === 'parametric' || type === 'light' || shape === 'rail_light' || shape === 'wall_shelf' || objectKind === 'light';
}

export function createParametricFurniture(item = {}) {
  if (!isParametricFurniture(item)) return null;
  const shape = String(item.shape || '').trim().toLowerCase();
  if (shape === 'round_table') return buildRoundTable(item);
  if (shape === 'rect_table') return buildRectTable(item);
  if (shape === 'counter') return buildCounter(item);
  if (shape === 'shelf') return buildShelf(item);
  if (shape === 'wall_shelf') return createWallShelf(item);
  if (shape === 'chair') return buildChair(item);
  if (shape === 'bar_stool') return buildBarStool(item);
  if (shape === 'rail_light') return buildRailLight(item.lightType || item.light_type || 'spot', item);
  if (shape === 'box') return buildBox(item);
  return null;
}
