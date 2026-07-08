import { createParametricFurniture, isParametricFurniture } from '/static/workspace/furniture/furniture.js?v=20260412-room-system';

const THREE_REF = () => window.THREE;
const MOVETECH_SIGN = {
  WIDTH: 2.65,
  HEIGHT: 0.38,
  THICKNESS: 0.018,
  BASE_COLOR: '#f6f7fb',
  ACCENT_COLOR: '#2c6fde',
  ACCENT_SECONDARY: '#14213d',
  TAG_TEXT: 'movetech',
  TAG_BG: '#2c6fde',
  TAG_TEXT_COLOR: '#ffffff',
  TEXT_COLOR: '#14213d',
};
const imageCache = new Map();
const glbAssetCache = new Map();
let furnitureShadowTexture = null;

function createCarpetTexture(baseColor) {
  const THREE = THREE_REF();
  if (!THREE) return null;
  try {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const r = (baseColor >> 16) & 0xff;
    const g = (baseColor >> 8) & 0xff;
    const b = baseColor & 0xff;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 1.5 + Math.random() * 3.5;
      const angle = Math.random() * Math.PI;
      const vary = (Math.random() - 0.5) * 30;
      ctx.strokeStyle = `rgba(${Math.max(0, Math.min(255, r + vary))},${Math.max(0, Math.min(255, g + vary))},${Math.max(0, Math.min(255, b + vary))},0.55)`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  } catch (_) {
    return null;
  }
}

export function getPalette(boothStyle = 'octanorm') {
  if (boothStyle === 'maxima') {
    return {
      floor: 0xdfe7ef,
      carpet: 0x2e3540,
      wall: 0xf2eeea,
      frame: 0x5d6a77,
      shellFrame: 0x788694,
      shellColumn: 0x5f6b77,
      fascia: 0xcdd6e0,
      text: 0x3e4a57,
    };
  }
  if (boothStyle === 'custom') {
    return {
      floor: 0xdfe7ef,
      carpet: 0x343b44,
      wall: 0xf2eeea,
      frame: 0x60707e,
      shellFrame: 0x7b8a98,
      shellColumn: 0x62707d,
      fascia: 0xd0dae4,
      text: 0x414d5b,
    };
  }
  return {
    floor: 0xdfe7ef,
    carpet: 0x313840,
    wall: 0xf2eeea,
    frame: 0x5f6f7d,
    shellFrame: 0x7a8896,
    shellColumn: 0x62707d,
    fascia: 0xcfd8e2,
    text: 0x404c59,
  };
}

const APPLICATION_STRUCT = Object.freeze({
  UPRIGHT_DIAM: 0.045,
  PANEL_MODULE: 1.0,
  SUNTA_W: 0.945,
  SUNTA_T: 0.006,
  RAIL_H: 0.07,
  RAIL_T: 0.02,
  WALL_THICKNESS: 0.05,
});

export function getSystemProfile(boothStyle = 'octanorm') {
  const base = {
    panelModule: APPLICATION_STRUCT.PANEL_MODULE,
    panelWidth: APPLICATION_STRUCT.SUNTA_W,
    panelThickness: APPLICATION_STRUCT.SUNTA_T,
    railHeight: APPLICATION_STRUCT.RAIL_H,
    railDepth: APPLICATION_STRUCT.RAIL_T,
    wallThickness: APPLICATION_STRUCT.WALL_THICKNESS,
    uprightShape: 'octagon',
    uprightWidth: APPLICATION_STRUCT.UPRIGHT_DIAM,
    uprightDepth: APPLICATION_STRUCT.UPRIGHT_DIAM,
    uprightSegments: 8,
    supportInset: 0.005,
    closedBandHeight: 0.11,
    closedBandDepth: 0.12,
    closedBandOffset: 0,
    closedBandSpanPadding: 0.05,
    fasciaRailHeight: 0.07,
    fasciaRailDepth: 0.02,
    fasciaBodyHeight: 0.11,
    fasciaBodyDepth: 0.006,
    fasciaFrameBump: 0.02,
    fasciaSignGap: 0.012,
    fasciaSignScale: 0.44,
    fasciaPanelColor: 0xf1f5fa,
    fasciaRailColor: 0x8d97a4,
    addContinuousFrame: false,
    solidFrameInset: 0.01,
    solidTopCapHeight: 0.02,
    solidTopCapDepth: 0.035,
  };
  if (boothStyle === 'maxima') {
    return {
      ...base,
      panelWidth: 0.9,
      panelThickness: 0.012,
      railHeight: 0.094,
      railDepth: 0.055,
      wallThickness: 0.08,
      uprightShape: 'box',
      uprightWidth: 0.08,
      uprightDepth: 0.08,
      uprightSegments: 4,
      supportInset: 0.012,
      closedBandHeight: 0.16,
      closedBandDepth: 0.18,
      closedBandOffset: 0.02,
      closedBandSpanPadding: 0.08,
      fasciaRailHeight: 0.09,
      fasciaRailDepth: 0.05,
      fasciaBodyHeight: 0.145,
      fasciaBodyDepth: 0.018,
      fasciaFrameBump: 0.016,
      fasciaSignGap: 0.016,
      fasciaSignScale: 0.54,
      fasciaPanelColor: 0xf3f5f9,
      fasciaRailColor: 0x92a0ad,
      addContinuousFrame: true,
      solidFrameInset: 0.02,
      solidTopCapHeight: 0.04,
      solidTopCapDepth: 0.065,
    };
  }
  return base;
}

export function createStructureLayout(dims = {}) {
  const width = Math.max(2, Number(dims.width) || 6);
  const depth = Math.max(2, Number(dims.depth) || 3);
  const height = Math.max(2.2, Number(dims.height) || 2.48);
  const thickness = 0.08;
  const radius = 0.05;

  return {
    panels: [
      {
        id: 'panel-back',
        side: 'back',
        width,
        height,
        thickness,
        position: { x: 0, y: height / 2, z: -depth / 2 },
        rotation: { x: 0, y: 0, z: 0 },
      },
      {
        id: 'panel-left',
        side: 'left',
        width: depth,
        height,
        thickness,
        position: { x: -width / 2, y: height / 2, z: 0 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      },
      {
        id: 'panel-right',
        side: 'right',
        width: depth,
        height,
        thickness,
        position: { x: width / 2, y: height / 2, z: 0 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 },
      },
    ],
    columns: [
      { id: 'column-1', radius, height, position: { x: -width / 2, y: height / 2, z: -depth / 2 } },
      { id: 'column-2', radius, height, position: { x: width / 2, y: height / 2, z: -depth / 2 } },
      { id: 'column-3', radius, height, position: { x: -width / 2, y: height / 2, z: depth / 2 } },
      { id: 'column-4', radius, height, position: { x: width / 2, y: height / 2, z: depth / 2 } },
    ],
  };
}

export function unmountBooth(target) {
  const THREE = THREE_REF();
  const root = target?.boothRoot || target?.getObjectByName?.('BoothRoot') || target?.userData?.boothRoot;
  if (!THREE || !root) return;
  while (root.children.length) {
    const child = root.children[0];
    root.remove(child);
    if (child.geometry) child.geometry.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  }
}

function makeBox(width, height, depth, color, options = {}) {
  const THREE = THREE_REF();
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.62,
    metalness: options.metalness ?? 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  return mesh;
}

export function getShellColors(palette, boothStyle = 'octanorm') {
  return {
    panel: palette.wall,
    rail: palette.shellFrame || palette.fascia,
    upright: palette.shellColumn || (boothStyle === 'maxima' ? 0xaeb9c5 : 0xcfd4da),
  };
}

function addClosedSideBand(root, side, dims, palette, boothStyle = 'octanorm') {
  const systemProfile = getSystemProfile(boothStyle);
  const span = side === 'back' || side === 'front'
    ? dims.width + systemProfile.closedBandSpanPadding
    : dims.depth + systemProfile.closedBandSpanPadding;
  const band = makeBox(span, systemProfile.closedBandHeight, systemProfile.closedBandDepth, palette.fascia, {
    roughness: 0.48,
    metalness: 0.08,
  });
  const y = dims.height - (systemProfile.closedBandHeight / 2) - 0.03;
  const offset = systemProfile.closedBandOffset;

  if (side === 'back') {
    band.position.set(0, y, -dims.depth / 2 + offset);
  } else if (side === 'front') {
    band.position.set(0, y, dims.depth / 2 - offset);
  } else if (side === 'left') {
    band.rotation.y = Math.PI / 2;
    band.position.set(-dims.width / 2 + offset, y, 0);
  } else if (side === 'right') {
    band.rotation.y = Math.PI / 2;
    band.position.set(dims.width / 2 - offset, y, 0);
  }

  band.renderOrder = 5;
  root.add(band);
}

function addCornerSupport(root, color, x, z, height, boothStyle = 'octanorm') {
  const THREE = THREE_REF();
  const systemProfile = getSystemProfile(boothStyle);
  const geometry = systemProfile.uprightShape === 'box'
    ? new THREE.BoxGeometry(systemProfile.uprightWidth, height, systemProfile.uprightDepth)
    : new THREE.CylinderGeometry(
      systemProfile.uprightWidth / 2,
      systemProfile.uprightWidth / 2,
      height,
      systemProfile.uprightSegments
    );
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: boothStyle === 'maxima' ? 0.42 : 0.48,
    metalness: boothStyle === 'maxima' ? 0.38 : 0.32,
  });
  const post = new THREE.Mesh(geometry, material);
  post.position.set(x, height / 2, z);
  post.castShadow = true;
  post.receiveShadow = true;
  root.add(post);
  return post;
}

function addApplicationPanelWall(root, side, span, position, rotationY, axis, height, shellColors, boothStyle = 'octanorm') {
  const THREE = THREE_REF();
  const systemProfile = getSystemProfile(boothStyle);
  const sectionCount = Math.max(1, Math.floor(span / systemProfile.panelModule));
  const sectionWidth = span / sectionCount;
  const panelWidth = Math.max(0.25, sectionWidth - (systemProfile.panelModule - systemProfile.panelWidth));
  const panelHeight = Math.max(0.2, height - (2 * systemProfile.railHeight));
  const faceOffset = axis === 'z' ? systemProfile.panelThickness / 2 : 0;
  const supportFaceOffset = (systemProfile.panelThickness / 2) + (systemProfile.uprightDepth / 2) - (boothStyle === 'maxima' ? 0.008 : 0.002);
  const wallGroup = new THREE.Group();
  wallGroup.name = `${side[0].toUpperCase()}${side.slice(1)}Wall`;

  const place = (mesh, offset, faceOffset = 0) => {
    if (axis === 'x') {
      mesh.position.set(position.x - span / 2 + offset, mesh.position.y, position.z + faceOffset);
    } else {
      mesh.position.set(position.x + faceOffset, mesh.position.y, position.z - span / 2 + offset);
    }
    mesh.rotation.y = rotationY;
    wallGroup.add(mesh);
  };

  for (let index = 0; index < sectionCount; index += 1) {
    const center = (index * sectionWidth) + (sectionWidth / 2);

    const panel = makeBox(panelWidth, panelHeight, systemProfile.panelThickness, shellColors.panel, {
      roughness: 0.38,
      metalness: 0.02,
    });
    panel.position.y = height / 2;
    place(panel, center);
    panel.name = `BoothSlab_${side}_${index}`;
    panel.userData = {
      isBoothPanel: true, panelType: 'slab',
      wallSide: side, sectionIndex: index,
      dims: { width: panelWidth, height: panelHeight, depth: systemProfile.panelThickness },
      baseColor: shellColors.panel,
    };

    const topRail = makeBox(panelWidth, systemProfile.railHeight, systemProfile.railDepth, shellColors.rail, {
      roughness: 0.46,
      metalness: 0.28,
    });
    topRail.position.y = height - (systemProfile.railHeight / 2);
    place(topRail, center, faceOffset);
    topRail.userData = {
      isBoothPanel: true, panelType: 'rail', railPos: 'top',
      wallSide: side, sectionIndex: index,
      dims: { width: panelWidth, height: systemProfile.railHeight, depth: systemProfile.railDepth },
      baseColor: shellColors.rail,
    };

    const bottomRail = makeBox(panelWidth, systemProfile.railHeight, systemProfile.railDepth, shellColors.rail, {
      roughness: 0.46,
      metalness: 0.28,
    });
    bottomRail.position.y = systemProfile.railHeight / 2;
    place(bottomRail, center, faceOffset);
    bottomRail.userData = {
      isBoothPanel: true, panelType: 'rail', railPos: 'bottom',
      wallSide: side, sectionIndex: index,
      dims: { width: panelWidth, height: systemProfile.railHeight, depth: systemProfile.railDepth },
      baseColor: shellColors.rail,
    };
  }

  for (let index = 0; index <= sectionCount; index += 1) {
    const beamOffset = index * sectionWidth;
    const support = addCornerSupport(
      wallGroup,
      shellColors.upright,
      0,
      0,
      height,
      boothStyle
    );
    if (axis === 'x') {
      support.position.set(
        position.x - span / 2 + beamOffset,
        height / 2,
        position.z + supportFaceOffset
      );
    } else {
      support.position.set(
        position.x + supportFaceOffset,
        height / 2,
        position.z - span / 2 + beamOffset
      );
    }
    support.userData = {
      isBoothPanel: true, panelType: 'upright',
      wallSide: side, uprightIndex: index,
      dims: { width: systemProfile.uprightWidth, height, depth: systemProfile.uprightDepth },
      baseColor: shellColors.upright,
    };
  }

  if (systemProfile.addContinuousFrame) {
    const beamHeight = Math.max(systemProfile.railHeight * 0.54, 0.04);
    const topBeam = makeBox(span + 0.04, beamHeight, systemProfile.railDepth, shellColors.rail, {
      roughness: 0.44,
      metalness: 0.3,
    });
    topBeam.position.y = height - (beamHeight / 2);
    place(topBeam, span / 2, faceOffset);

    const bottomBeam = makeBox(span + 0.04, beamHeight, systemProfile.railDepth, shellColors.rail, {
      roughness: 0.44,
      metalness: 0.3,
    });
    bottomBeam.position.y = beamHeight / 2;
    place(bottomBeam, span / 2, faceOffset);
  }

  root.add(wallGroup);
  return wallGroup;
}

function addSolidWall(root, name, width, height, depth, shellColors, position, axis = 'x', boothStyle = 'octanorm') {
  const THREE = THREE_REF();
  const systemProfile = getSystemProfile(boothStyle);
  const wallGroup = new THREE.Group();
  wallGroup.name = name;
  wallGroup.position.set(position.x, position.y, position.z);

  const span = axis === 'x' ? width : depth;
  const panelHeight = Math.max(0.2, height - (2 * systemProfile.railHeight));
  const panelSpan = Math.max(0.25, span - systemProfile.uprightWidth - systemProfile.solidFrameInset);
  const panel = axis === 'x'
    ? makeBox(panelSpan, panelHeight, systemProfile.panelThickness, shellColors.panel, {
      roughness: 0.38,
      metalness: 0.02,
    })
    : makeBox(systemProfile.panelThickness, panelHeight, panelSpan, shellColors.panel, {
      roughness: 0.38,
      metalness: 0.02,
    });
  wallGroup.add(panel);

  const topBeam = axis === 'x'
    ? makeBox(width, systemProfile.railHeight, systemProfile.railDepth, shellColors.rail, {
      roughness: 0.44,
      metalness: 0.28,
    })
    : makeBox(systemProfile.railDepth, systemProfile.railHeight, depth, shellColors.rail, {
      roughness: 0.44,
      metalness: 0.28,
    });
  topBeam.position.y = (height / 2) - (systemProfile.railHeight / 2);
  wallGroup.add(topBeam);

  const bottomBeam = axis === 'x'
    ? makeBox(width, systemProfile.railHeight, systemProfile.railDepth, shellColors.rail, {
      roughness: 0.44,
      metalness: 0.28,
    })
    : makeBox(systemProfile.railDepth, systemProfile.railHeight, depth, shellColors.rail, {
      roughness: 0.44,
      metalness: 0.28,
    });
  bottomBeam.position.y = -(height / 2) + (systemProfile.railHeight / 2);
  wallGroup.add(bottomBeam);

  const leftPost = axis === 'x'
    ? makeBox(systemProfile.uprightWidth, height, systemProfile.uprightDepth, shellColors.upright, {
      roughness: boothStyle === 'maxima' ? 0.42 : 0.48,
      metalness: boothStyle === 'maxima' ? 0.38 : 0.32,
    })
    : makeBox(systemProfile.uprightDepth, height, systemProfile.uprightWidth, shellColors.upright, {
      roughness: boothStyle === 'maxima' ? 0.42 : 0.48,
      metalness: boothStyle === 'maxima' ? 0.38 : 0.32,
    });
  const rightPost = leftPost.clone();

  if (axis === 'x') {
    leftPost.position.x = -(width / 2) + (systemProfile.uprightWidth / 2);
    rightPost.position.x = (width / 2) - (systemProfile.uprightWidth / 2);
  } else {
    leftPost.position.z = -(depth / 2) + (systemProfile.uprightWidth / 2);
    rightPost.position.z = (depth / 2) - (systemProfile.uprightWidth / 2);
  }
  wallGroup.add(leftPost);
  wallGroup.add(rightPost);

  if (systemProfile.addContinuousFrame) {
    const topCap = axis === 'x'
      ? makeBox(width + 0.02, systemProfile.solidTopCapHeight, systemProfile.solidTopCapDepth, shellColors.upright, {
        roughness: 0.42,
        metalness: 0.34,
      })
      : makeBox(systemProfile.solidTopCapDepth, systemProfile.solidTopCapHeight, depth + 0.02, shellColors.upright, {
        roughness: 0.42,
        metalness: 0.34,
      });
    topCap.position.y = (height / 2) - (systemProfile.solidTopCapHeight / 2);
    wallGroup.add(topCap);
  }

  root.add(wallGroup);
  return wallGroup;
}

function addPanelModeShell(root, dims, openSides, shellColors, boothStyle = 'octanorm') {
  const systemProfile = getSystemProfile(boothStyle);
  if (!openSides.back) {
    addApplicationPanelWall(
      root,
      'back',
      dims.width,
      { x: 0, z: -dims.depth / 2 },
      0,
      'x',
      dims.height,
      shellColors,
      boothStyle
    );
  }
  if (!openSides.front) {
    addApplicationPanelWall(
      root,
      'front',
      dims.width,
      { x: 0, z: dims.depth / 2 },
      0,
      'x',
      dims.height,
      shellColors,
      boothStyle
    );
  }
  if (!openSides.left) {
    addApplicationPanelWall(
      root,
      'left',
      dims.depth,
      { x: -dims.width / 2, z: 0 },
      Math.PI / 2,
      'z',
      dims.height,
      shellColors,
      boothStyle
    );
  }
  if (!openSides.right) {
    addApplicationPanelWall(
      root,
      'right',
      dims.depth,
      { x: dims.width / 2, z: 0 },
      Math.PI / 2,
      'z',
      dims.height,
      shellColors,
      boothStyle
    );
  }

  const supportOffset = (systemProfile.uprightWidth / 2) + systemProfile.supportInset;
  if (openSides.front && openSides.left && !openSides.right) {
    addCornerSupport(root, shellColors.upright, -dims.width / 2 + supportOffset, dims.depth / 2 - supportOffset, dims.height, boothStyle);
  }
  if (openSides.front && !openSides.left && openSides.right) {
    addCornerSupport(root, shellColors.upright, dims.width / 2 - supportOffset, dims.depth / 2 - supportOffset, dims.height, boothStyle);
  }
  if ((openSides.front && openSides.left && openSides.right) || (!openSides.front && openSides.left && openSides.right)) {
    addCornerSupport(root, shellColors.upright, -dims.width / 2 + supportOffset, dims.depth / 2 - supportOffset, dims.height, boothStyle);
    addCornerSupport(root, shellColors.upright, dims.width / 2 - supportOffset, dims.depth / 2 - supportOffset, dims.height, boothStyle);
  }
  if (openSides.back && openSides.left && !openSides.right) {
    addCornerSupport(root, shellColors.upright, -dims.width / 2 + supportOffset, -dims.depth / 2 + supportOffset, dims.height, boothStyle);
  }
  if (openSides.back && !openSides.left && openSides.right) {
    addCornerSupport(root, shellColors.upright, dims.width / 2 - supportOffset, -dims.depth / 2 + supportOffset, dims.height, boothStyle);
  }
  if (openSides.back && openSides.left && openSides.right) {
    addCornerSupport(root, shellColors.upright, -dims.width / 2 + supportOffset, -dims.depth / 2 + supportOffset, dims.height, boothStyle);
    addCornerSupport(root, shellColors.upright, dims.width / 2 - supportOffset, -dims.depth / 2 + supportOffset, dims.height, boothStyle);
  }
}

function getYekpareEndWallConfig(width, openLeft, openRight, thickness) {
  let span = width;
  let x = 0;
  if (!openLeft && !openRight) {
    span = width - (2 * thickness);
  } else if (!openLeft) {
    span = width - thickness;
    x = thickness / 2;
  } else if (!openRight) {
    span = width - thickness;
    x = -thickness / 2;
  }
  return {
    span: Math.max(thickness, span),
    x,
  };
}

function getYekpareSideWallConfig(depth, openFront, openBack, thickness) {
  if (openFront && openBack) {
    return { span: depth, z: 0 };
  }
  if (!openBack) {
    return {
      span: Math.max(thickness, depth - thickness),
      z: -thickness / 2,
    };
  }
  return {
    span: Math.max(thickness, depth - thickness),
    z: thickness / 2,
  };
}

function addYekpareModeShell(root, dims, openSides, shellColors, boothStyle = 'octanorm') {
  const systemProfile = getSystemProfile(boothStyle);
  const thickness = systemProfile.wallThickness;
  const backWall = getYekpareEndWallConfig(dims.width, openSides.left, openSides.right, thickness);
  const frontWall = getYekpareEndWallConfig(dims.width, openSides.left, openSides.right, thickness);
  const sideWall = getYekpareSideWallConfig(dims.depth, openSides.front, openSides.back, thickness);

  if (!openSides.back) {
    addSolidWall(
      root,
      'BackWall',
      backWall.span,
      dims.height,
      thickness,
      shellColors,
      { x: backWall.x, y: dims.height / 2, z: -dims.depth / 2 + thickness / 2 },
      'x',
      boothStyle
    );
  }
  if (!openSides.left) {
    addSolidWall(
      root,
      'LeftWall',
      thickness,
      dims.height,
      sideWall.span,
      shellColors,
      { x: -dims.width / 2 + thickness / 2, y: dims.height / 2, z: sideWall.z },
      'z',
      boothStyle
    );
  }
  if (!openSides.right) {
    addSolidWall(
      root,
      'RightWall',
      thickness,
      dims.height,
      sideWall.span,
      shellColors,
      { x: dims.width / 2 - thickness / 2, y: dims.height / 2, z: sideWall.z },
      'z',
      boothStyle
    );
  }
  if (!openSides.front) {
    addSolidWall(
      root,
      'FrontWall',
      frontWall.span,
      dims.height,
      thickness,
      shellColors,
      { x: frontWall.x, y: dims.height / 2, z: dims.depth / 2 - thickness / 2 },
      'x',
      boothStyle
    );
  }

  const supportOffset = (thickness / 2) + (systemProfile.uprightWidth / 2) - (boothStyle === 'maxima' ? 0.004 : 0.01);
  if (openSides.front && openSides.left) {
    addCornerSupport(root, shellColors.upright, -dims.width / 2 + supportOffset, dims.depth / 2 - supportOffset, dims.height, boothStyle);
  }
  if (openSides.front && openSides.right) {
    addCornerSupport(root, shellColors.upright, dims.width / 2 - supportOffset, dims.depth / 2 - supportOffset, dims.height, boothStyle);
  }
  if (openSides.left) {
    addCornerSupport(root, shellColors.upright, -dims.width / 2 + supportOffset, -dims.depth / 2 + supportOffset, dims.height, boothStyle);
  }
  if (openSides.right) {
    addCornerSupport(root, shellColors.upright, dims.width / 2 - supportOffset, -dims.depth / 2 + supportOffset, dims.height, boothStyle);
  }
}

function toCssColor(value, fallback = '#ffffff') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `#${value.toString(16).padStart(6, '0')}`;
  }
  return fallback;
}

function createOvalBoardGeometry(width, height, depth) {
  const THREE = THREE_REF();
  const radius = Math.max(height / 2, 0.001);
  const straight = Math.max(width - height, 0);
  const halfStraight = straight / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfStraight, radius);
  shape.lineTo(halfStraight, radius);
  shape.absarc(halfStraight, 0, radius, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(-halfStraight, -radius);
  shape.absarc(-halfStraight, 0, radius, -Math.PI / 2, Math.PI / 2, true);
  return new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 24,
  }).translate(0, 0, -depth / 2);
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, height / 2, width / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawMovetechIcon(ctx, centerX, centerY, size) {
  const outerRadius = size / 2;
  const innerRadius = outerRadius * 0.55;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(-Math.PI / 12);
  ctx.lineWidth = size * 0.12;
  ctx.strokeStyle = MOVETECH_SIGN.ACCENT_COLOR;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i;
    const px = Math.cos(angle) * outerRadius;
    const py = Math.sin(angle) * outerRadius;
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
  ctx.stroke();
  ctx.lineWidth = size * 0.08;
  ctx.strokeStyle = MOVETECH_SIGN.ACCENT_SECONDARY;
  ctx.beginPath();
  ctx.arc(0, 0, innerRadius, Math.PI / 6, Math.PI + Math.PI / 6);
  ctx.stroke();
  ctx.restore();
}

function drawMovetechFasciaTexture(ctx, canvasWidth, canvasHeight, nameText) {
  const label = (nameText || 'movetech').trim() || 'movetech';
  ctx.fillStyle = MOVETECH_SIGN.BASE_COLOR;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const tagWidth = canvasWidth * 0.16;
  const tagHeight = canvasHeight * 0.4;
  const tagX = canvasWidth * 0.05;
  const tagY = (canvasHeight - tagHeight) / 2;

  ctx.save();
  ctx.fillStyle = 'rgba(17, 23, 35, 0.08)';
  drawRoundedRect(ctx, tagX + 4, tagY + 4, tagWidth, tagHeight, tagHeight * 0.45);
  ctx.fill();

  ctx.fillStyle = MOVETECH_SIGN.TAG_BG;
  drawRoundedRect(ctx, tagX, tagY, tagWidth, tagHeight, tagHeight * 0.45);
  ctx.fill();

  ctx.fillStyle = MOVETECH_SIGN.TAG_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${Math.floor(tagHeight * 0.55)}px 'Segoe UI', Arial`;
  ctx.fillText(MOVETECH_SIGN.TAG_TEXT, tagX + tagWidth / 2, tagY + tagHeight / 2);

  const iconSize = canvasHeight * 0.55;
  const iconX = tagX + tagWidth + canvasWidth * 0.07 + iconSize / 2;
  drawMovetechIcon(ctx, iconX, canvasHeight / 2, iconSize);

  const textX = iconX + (iconSize * 0.65);
  const textWidth = canvasWidth - textX - canvasWidth * 0.07;
  let fontSize = canvasHeight * 0.45;
  ctx.fillStyle = MOVETECH_SIGN.TEXT_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fontSize}px 'Segoe UI', Arial`;
  while (ctx.measureText(label).width > textWidth && fontSize > canvasHeight * 0.2) {
    fontSize -= 2;
    ctx.font = `600 ${fontSize}px 'Segoe UI', Arial`;
  }
  ctx.fillText(label, textX, canvasHeight / 2);
  ctx.restore();
}

function drawStandardFasciaTexture(ctx, canvasWidth, canvasHeight, text, palette, showBranding = true) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = '#f7fafc';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.strokeStyle = '#8d9aa8';
  ctx.lineWidth = 16;
  ctx.strokeRect(20, 20, canvasWidth - 40, canvasHeight - 40);
  if (!showBranding) return;
  let fontSize = canvasHeight * 0.46;
  ctx.fillStyle = toCssColor(palette.text, '#3f4b58');
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.floor(fontSize)}px 'Segoe UI', Arial`;
  const targetWidth = canvasWidth * 0.86;
  while (ctx.measureText(text || 'Company Name').width > targetWidth && fontSize > canvasHeight * 0.18) {
    fontSize -= 4;
    ctx.font = `700 ${Math.floor(fontSize)}px 'Segoe UI', Arial`;
  }
  ctx.fillText(text || 'Company Name', canvasWidth / 2, canvasHeight / 2);
}

function buildSignTexture({ option, text, palette, branding, showBranding = true }) {
  const THREE = THREE_REF();
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = option === 'custom' ? 360 : 320;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;

  const draw = (image = null) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showBranding && option !== 'custom') {
      drawStandardFasciaTexture(ctx, canvas.width, canvas.height, text, palette, false);
      texture.needsUpdate = true;
      return;
    }

    if (option === 'custom' && !image && branding.mode !== 'logo' && showBranding) {
      drawMovetechFasciaTexture(ctx, canvas.width, canvas.height, text);
      texture.needsUpdate = true;
      return;
    }

    if (option !== 'custom') {
      // Draw the fascia body once, then let the branding pass render text/logo.
      drawStandardFasciaTexture(ctx, canvas.width, canvas.height, text, palette, false);
      if (!showBranding) {
        texture.needsUpdate = true;
        return;
      }
    } else {
      ctx.fillStyle = MOVETECH_SIGN.BASE_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const wantsLogo = (branding.mode === 'logo' || branding.mode === 'logo_text') && image;
    const wantsText = showBranding && (branding.mode === 'text' || branding.mode === 'logo_text' || !wantsLogo);
    const paddingX = canvas.width * 0.08;
    const contentHeight = canvas.height * 0.58;
    let textStartX = canvas.width / 2;

    if (wantsLogo) {
      const maxLogoWidth = branding.mode === 'logo_text' ? canvas.width * 0.22 : canvas.width * 0.52;
      const maxLogoHeight = contentHeight;
      const ratio = Math.min(maxLogoWidth / image.width, maxLogoHeight / image.height);
      const logoWidth = image.width * ratio;
      const logoHeight = image.height * ratio;
      const logoX = branding.mode === 'logo_text'
        ? paddingX
        : (canvas.width - logoWidth) / 2;
      const logoY = (canvas.height - logoHeight) / 2;
      ctx.drawImage(image, logoX, logoY, logoWidth, logoHeight);
      textStartX = logoX + logoWidth + (canvas.width * 0.05);
    }

    if (wantsText) {
      let fontSize = option === 'custom' ? canvas.height * 0.34 : canvas.height * 0.42;
      ctx.fillStyle = option === 'custom' ? MOVETECH_SIGN.TEXT_COLOR : toCssColor(palette.text, '#4b5563');
      ctx.textBaseline = 'middle';
      ctx.textAlign = wantsLogo && branding.mode === 'logo_text' ? 'left' : 'center';
      ctx.font = `600 ${Math.floor(fontSize)}px 'Segoe UI', Arial`;
      const targetWidth = wantsLogo && branding.mode === 'logo_text'
        ? canvas.width - textStartX - paddingX
        : canvas.width - (paddingX * 2);
      while (ctx.measureText(text || 'Company Name').width > targetWidth && fontSize > canvas.height * 0.18) {
        fontSize -= 4;
        ctx.font = `600 ${Math.floor(fontSize)}px 'Segoe UI', Arial`;
      }
      ctx.fillText(text || 'Company Name', wantsLogo && branding.mode === 'logo_text' ? textStartX : canvas.width / 2, canvas.height / 2);
    }

    texture.needsUpdate = true;
  };

  draw();

  if ((branding.mode === 'logo' || branding.mode === 'logo_text') && branding.logoUrl) {
    const src = branding.logoUrl;
    let cached = imageCache.get(src);
    if (!cached) {
      cached = new Image();
      cached.decoding = 'async';
      cached.src = src;
      imageCache.set(src, cached);
    }
    if (cached.complete && cached.naturalWidth > 0) {
      draw(cached);
    } else {
      cached.onload = () => draw(cached);
      cached.onerror = () => draw();
    }
  }

  return texture;
}

function addOpenSideFascia(root, side, dims, palette, text, option = 'classic', branding = {}, boothStyle = 'octanorm') {
  const THREE = THREE_REF();
  if (!THREE) return;
  const systemProfile = getSystemProfile(boothStyle);
  const RAIL_H = systemProfile.fasciaRailHeight;
  const RAIL_T = systemProfile.fasciaRailDepth;
  const MDF_H = systemProfile.fasciaBodyHeight;
  const MDF_T = systemProfile.fasciaBodyDepth;
  const SIGN_W = 2.0;
  const SIGN_H = 0.30;
  const SIGN_T = 0.018;
  const Z_BUMP = systemProfile.fasciaFrameBump;

  let span = 0;
  let cx = 0;
  let cz = 0;
  let axis = 'x';
  let nx = 0;
  let nz = 0;

  if (side === 'front') {
    span = dims.width;
    cx = 0;
    cz = dims.depth / 2;
    axis = 'x';
    nz = 1;
  } else if (side === 'left') {
    span = dims.depth;
    cx = -dims.width / 2;
    cz = 0;
    axis = 'z';
    nx = -1;
  } else if (side === 'right') {
    span = dims.depth;
    cx = dims.width / 2;
    cz = 0;
    axis = 'z';
    nx = 1;
  } else if (side === 'back') {
    span = dims.width;
    cx = 0;
    cz = -dims.depth / 2;
    axis = 'x';
    nz = -1;
  } else {
    return;
  }

  const rot = axis === 'x' ? 0 : Math.PI / 2;
  const fasciaStructureOffset = (RAIL_T / 2) + Z_BUMP;
  const railColor = systemProfile.fasciaRailColor;
  const panelColor = systemProfile.fasciaPanelColor;
  const boardColor = option === 'custom' ? MOVETECH_SIGN.BASE_COLOR : 0xf5f6f8;
  const showFullBranding = side === 'front' || branding.scope === 'all_visible';
  const fasciaBranding = showFullBranding
    ? branding
    : { ...branding, mode: 'text' };

  const topRail = makeBox(span + 0.04, RAIL_H, RAIL_T, railColor, { roughness: 0.44, metalness: 0.3 });
  topRail.position.set(cx + (nx * fasciaStructureOffset), dims.height - (RAIL_H / 2), cz + (nz * fasciaStructureOffset));
  topRail.rotation.y = rot;
  topRail.renderOrder = 6;
  root.add(topRail);

  const mdfY = dims.height - RAIL_H - (MDF_H / 2);
  const fasciaBody = makeBox(span + 0.04, MDF_H, MDF_T, panelColor, { roughness: 0.38, metalness: 0.02 });
  fasciaBody.position.set(cx + (nx * fasciaStructureOffset), mdfY, cz + (nz * fasciaStructureOffset));
  fasciaBody.rotation.y = rot;
  fasciaBody.renderOrder = 6;
  root.add(fasciaBody);

  const bottomRail = makeBox(span + 0.04, RAIL_H, RAIL_T, railColor, { roughness: 0.44, metalness: 0.3 });
  bottomRail.position.set(cx + (nx * fasciaStructureOffset), mdfY - (MDF_H / 2) - (RAIL_H / 2), cz + (nz * fasciaStructureOffset));
  bottomRail.rotation.y = rot;
  bottomRail.renderOrder = 6;
  root.add(bottomRail);

  let signWidth = Math.min(Math.max(span * systemProfile.fasciaSignScale, 1.8), boothStyle === 'maxima' ? 3.2 : 2.8);
  let signHeight = SIGN_H;
  let signThickness = SIGN_T;
  if (option === 'full') {
    signWidth = Math.max(0.6, span);
  } else if (option === 'custom') {
    signWidth = Math.min(MOVETECH_SIGN.WIDTH, Math.max(span - 0.2, 0.6));
    signHeight = MOVETECH_SIGN.HEIGHT;
    signThickness = MOVETECH_SIGN.THICKNESS;
  }

  const plateOffset = fasciaStructureOffset + (MDF_T / 2) + (signThickness / 2) + systemProfile.fasciaSignGap;
  const plateGeometry = option === 'custom'
    ? createOvalBoardGeometry(signWidth, signHeight, signThickness)
    : new THREE.BoxGeometry(signWidth, signHeight, signThickness);
  const signPlate = new THREE.Mesh(
    plateGeometry,
    new THREE.MeshStandardMaterial({
      color: boardColor,
      roughness: 0.64,
      metalness: 0,
    })
  );
  signPlate.castShadow = true;
  signPlate.receiveShadow = true;
  signPlate.position.set(cx + (nx * plateOffset), mdfY, cz + (nz * plateOffset));
  signPlate.rotation.y = rot;
  signPlate.renderOrder = 7;
  root.add(signPlate);

  const texture = buildSignTexture({
    option,
    text,
    palette,
    branding: fasciaBranding,
    showBranding: true,
  });
  if (texture) {
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(signWidth * 0.98, signHeight * 0.9),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    const textPlaneOffset = plateOffset + (signThickness / 2) + systemProfile.fasciaSignGap;
    face.position.set(cx + (nx * textPlaneOffset), mdfY, cz + (nz * textPlaneOffset));
    face.rotation.y = rot;
    face.renderOrder = 8;
    root.add(face);
  }
}

function addBoothFloor(root, dims, palette) {
  const THREE = THREE_REF();
  const carpetTex = createCarpetTexture(palette.carpet);
  if (carpetTex) {
    carpetTex.repeat.set(
      Math.max(2, Math.ceil(dims.width * 1.5)),
      Math.max(1, Math.ceil(dims.depth * 1.5))
    );
  }
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(dims.width, dims.depth),
    new THREE.MeshStandardMaterial({
      color: carpetTex ? 0xffffff : palette.carpet,
      map: carpetTex || null,
      roughness: 0.96,
      metalness: 0.01,
      side: THREE.DoubleSide,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.004, 0);
  floor.receiveShadow = true;
  floor.castShadow = false;
  floor.name = 'BoothFloor';
  root.add(floor);
}

export function mountBooth(target, config = {}) {
  const THREE = THREE_REF();
  const scene = target?.scene || target;
  const boothRoot = target?.boothRoot || scene?.getObjectByName?.('BoothRoot');
  if (!THREE || !scene || !boothRoot) return null;

  unmountBooth(target);

  const dims = {
    width: Math.max(2, Number(config?.dims?.width) || 6),
    depth: Math.max(2, Number(config?.dims?.depth) || 3),
    height: Math.max(2.2, Number(config?.dims?.height) || 2.48),
  };
  const openSides = {
    front: Boolean(config?.booth?.openSides?.front),
    back: Boolean(config?.booth?.openSides?.back),
    left: Boolean(config?.booth?.openSides?.left),
    right: Boolean(config?.booth?.openSides?.right),
  };
  const boothStyle = String(config?.booth?.boothStyle || 'octanorm').toLowerCase();
  const buildMode = String(config?.booth?.buildMode || config?.booth?.mode || 'panel').toLowerCase() === 'yekpare'
    ? 'yekpare'
    : 'panel';
  const palette = getPalette(boothStyle);
  const shellColors = getShellColors(palette, boothStyle);
  const signage = config?.signage || config?.booth || {};
  const signageEnabled = signage.enabled !== false;
  const signageText = signage.text || config?.booth?.fasciaText || 'Company Name';
  const fasciaOption = (signage.option || config?.booth?.fasciaOption || 'classic').toString().toLowerCase();
  const branding = {
    mode: config?.branding?.mode || config?.booth?.branding?.mode || 'text',
    scope: config?.branding?.scope || config?.booth?.branding?.scope || 'front',
      logoUrl: config?.branding?.logoUrl || config?.booth?.branding?.logoUrl || null,
  };

  addBoothFloor(boothRoot, dims, palette);

  if (buildMode === 'yekpare') {
    addYekpareModeShell(boothRoot, dims, openSides, shellColors, boothStyle);
  } else {
    addPanelModeShell(boothRoot, dims, openSides, shellColors, boothStyle);
  }

  ['back', 'left', 'right', 'front'].forEach((side) => {
    if (!openSides[side]) {
      addClosedSideBand(boothRoot, side, dims, palette, boothStyle);
    }
  });

  if (signageEnabled) {
    ['front', 'left', 'right', 'back'].forEach((side) => {
      if (openSides[side]) {
        addOpenSideFascia(boothRoot, side, dims, palette, signageText, fasciaOption, branding, boothStyle);
      }
    });
  }

  return boothRoot;
}

function disposeObject3D(root) {
  if (!root) return;
  root.traverse?.((child) => {
    if (child.geometry) child.geometry.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        material?.map?.dispose?.();
        material?.dispose?.();
      });
    } else if (child.material) {
      child.material.map?.dispose?.();
      child.material.dispose?.();
    }
  });
}

function createPlaceholderFurnitureMesh(model) {
  const THREE = THREE_REF();
  const size = model.size || { width: 1, depth: 1, height: 1 };
  const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
  const material = new THREE.MeshStandardMaterial({
    color: model.color || '#aeb8c4',
    roughness: 0.82,
    metalness: 0.04,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function getFurnitureShadowTexture() {
  const THREE = THREE_REF();
  if (!THREE) return null;
  if (furnitureShadowTexture) return furnitureShadowTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(128, 128, 22, 128, 128, 118);
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.42)');
  gradient.addColorStop(0.45, 'rgba(15, 23, 42, 0.2)');
  gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  furnitureShadowTexture = new THREE.CanvasTexture(canvas);
  furnitureShadowTexture.needsUpdate = true;
  return furnitureShadowTexture;
}

function createFurnitureShadowMesh(size) {
  const THREE = THREE_REF();
  const shadowTexture = getFurnitureShadowTexture();
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(
      Math.max(0.55, (Number(size?.width) || 1) * 1.22),
      Math.max(0.55, (Number(size?.depth) || 1) * 1.22)
    ),
    new THREE.MeshBasicMaterial({
      map: shadowTexture || null,
      color: 0x0f172a,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  shadow.renderOrder = 0;
  shadow.name = 'FurnitureShadow';
  shadow.raycast = () => {};
  return shadow;
}

function createFurniturePickMesh(model) {
  const THREE = THREE_REF();
  const size = model.size || { width: 1, depth: 1, height: 1 };
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.width, size.height, size.depth),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  mesh.position.y = (Number(size.height) || 1) / 2;
  mesh.name = 'FurniturePickMesh';
  return mesh;
}

function createFurnitureRoot(model) {
  const THREE = THREE_REF();
  const root = new THREE.Group();
  const size = model.size || { width: 1, depth: 1, height: 1 };
  const isLight = String(model?.objectKind || '').trim().toLowerCase() === 'light';
  const isWallMounted = Boolean(model.wallMounted || model.wall_mounted || model.shape === 'wall_shelf');
  const contentOffsetY = (Number(size.height) || 1) / 2 * (isLight ? -1 : 1);
  const shadowMesh = createFurnitureShadowMesh(size);
  const placeholder = createPlaceholderFurnitureMesh(model);
  placeholder.position.y = contentOffsetY;
  placeholder.name = 'FurniturePlaceholder';
  const pickMesh = createFurniturePickMesh(model);
  pickMesh.position.y = contentOffsetY;
  if (isLight || isWallMounted) shadowMesh.visible = false;
  root.add(shadowMesh);
  root.add(placeholder);
  root.add(pickMesh);
  root.userData.shadowMesh = shadowMesh;
  root.userData.placeholder = placeholder;
  root.userData.pickMesh = pickMesh;
  return root;
}

function attachParametricFurniture(root, model) {
  if (!root || !isParametricFurniture(model)) return false;
  const content = createParametricFurniture(model);
  if (!content) return false;

  content.name = 'FurnitureParametric';
  root.userData.loadedContent = content;
  root.userData.placeholder.visible = false;
  if (model.wallMounted && root.userData?.shadowMesh) {
    root.userData.shadowMesh.visible = false;
  }
  if (String(model.objectKind || '').trim().toLowerCase() === 'light' && root.userData?.shadowMesh) {
    root.userData.shadowMesh.visible = false;
  }
  root.add(content);
  return true;
}

function createTextObjectTexture(item) {
  const THREE = THREE_REF();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `700 ${Math.max(24, Number(item.fontSize) || 40)}px "Segoe UI", Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = String(item.color || '#4b5563');
  ctx.fillText(item.text || 'Text', canvas.width / 2, canvas.height / 2);
  texture.needsUpdate = true;
  return texture;
}

function createTextObjectMesh(item) {
  const THREE = THREE_REF();
  const width = Math.max(0.8, Number(item.width) || 1.8);
  const height = Math.max(0.2, Number(item.height) || 0.48);
  const texture = createTextObjectTexture(item);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function applySiteObjectPose(mesh, item) {
  const position = item.position || {};
  const rotation = item.rotation || {};
  mesh.position.set(
    Number(position.x) || 0,
    Number(position.y) || 1.45,
    Number(position.z) || 0
  );
  mesh.rotation.set(
    Number(rotation.x) || 0,
    Number(rotation.y) || 0,
    Number(rotation.z) || 0
  );
  const scale = Number(item.scale) || 1;
  mesh.scale.setScalar(scale);
}

function applyModelPose(mesh, model) {
  const position = model.position || {};
  const rotation = model.rotation || {};
  mesh.position.set(
    Number(position.x) || 0,
    Number(position.y) || 0,
    Number(position.z) || 0
  );
  mesh.rotation.set(Number(rotation.x) || 0, Number(rotation.y) || 0, Number(rotation.z) || 0);
  const scale = Number(model.scale) || 1;
  mesh.scale.setScalar(scale);
}

function setPickMeshSize(pickMesh, size) {
  const THREE = THREE_REF();
  if (!pickMesh || !THREE) return;
  pickMesh.geometry?.dispose?.();
  pickMesh.geometry = new THREE.BoxGeometry(
    Math.max(0.05, Number(size.width) || 0.05),
    Math.max(0.05, Number(size.height) || 0.05),
    Math.max(0.05, Number(size.depth) || 0.05)
  );
  pickMesh.position.y = (Number(size.height) || 0.05) / 2;
}

function setFurnitureShadowSize(shadowMesh, size) {
  const THREE = THREE_REF();
  if (!shadowMesh || !THREE) return;
  const width = Math.max(0.55, (Number(size?.width) || 1) * 1.22);
  const depth = Math.max(0.55, (Number(size?.depth) || 1) * 1.22);
  shadowMesh.geometry?.dispose?.();
  shadowMesh.geometry = new THREE.PlaneGeometry(width, depth);
  const area = width * depth;
  if (shadowMesh.material) {
    shadowMesh.material.opacity = Math.max(0.26, Math.min(0.42, 0.2 + (area * 0.045)));
  }
}

function setFurnitureSupportVisuals(root, size) {
  if (!root) return;
  setPickMeshSize(root.userData?.pickMesh || null, size);
  setFurnitureShadowSize(root.userData?.shadowMesh || null, size);
}

function cloneCachedScene(scene) {
  const clone = scene.clone(true);
  const sourceMeshes = [];
  const clonedMeshes = [];
  scene.traverse((child) => {
    if (child.isMesh) sourceMeshes.push(child);
  });
  clone.traverse((child) => {
    if (child.isMesh) clonedMeshes.push(child);
  });
  clonedMeshes.forEach((mesh, index) => {
    const source = sourceMeshes[index];
    if (!source) return;
    if (source.geometry) mesh.geometry = source.geometry.clone();
    if (Array.isArray(source.material)) {
      mesh.material = source.material.map((material) => {
        const next = material.clone();
        Object.keys(next).forEach((key) => {
          if (next[key]?.isTexture) {
            next[key] = next[key].clone();
            next[key].needsUpdate = true;
          }
        });
        return next;
      });
    } else if (source.material) {
      const next = source.material.clone();
      Object.keys(next).forEach((key) => {
        if (next[key]?.isTexture) {
          next[key] = next[key].clone();
          next[key].needsUpdate = true;
        }
      });
      mesh.material = next;
    }
  });
  return clone;
}

function loadGlbAsset(glbUrl, onReady, onError) {
  const THREE = THREE_REF();
  if (!glbUrl || !THREE?.GLTFLoader) {
    onError?.();
    return;
  }

  const cached = glbAssetCache.get(glbUrl);
  if (cached?.status === 'ready') {
    onReady(cloneCachedScene(cached.scene), { ...cached.size });
    return;
  }
  if (cached?.status === 'pending') {
    cached.listeners.push({ onReady, onError });
    return;
  }

  const pending = { status: 'pending', listeners: [{ onReady, onError }] };
  glbAssetCache.set(glbUrl, pending);

  const loader = new THREE.GLTFLoader();
  loader.load(
    glbUrl,
    (gltf) => {
      const source = gltf.scene;
      if (!source) {
        pending.listeners.forEach((listener) => listener.onError?.());
        glbAssetCache.delete(glbUrl);
        return;
      }
      const box = new THREE.Box3().setFromObject(source);
      const size = new THREE.Vector3();
      box.getSize(size);
      glbAssetCache.set(glbUrl, {
        status: 'ready',
        scene: source,
        size: {
          width: Number(size.x) || 1,
          height: Number(size.y) || 1,
          depth: Number(size.z) || 1,
        },
      });
      pending.listeners.forEach((listener) => listener.onReady(cloneCachedScene(source), {
        width: Number(size.x) || 1,
        height: Number(size.y) || 1,
        depth: Number(size.z) || 1,
      }));
    },
    undefined,
    () => {
      pending.listeners.forEach((listener) => listener.onError?.());
      glbAssetCache.delete(glbUrl);
    }
  );
}

function tryLoadGlb(runtime, root, model) {
  const THREE = THREE_REF();
  const glbUrl = model.glb_url || model.glbUrl;
  if (!glbUrl || !THREE?.GLTFLoader) return;

  const placeholder = root.userData?.placeholder || null;
  const pickMesh = root.userData?.pickMesh || null;
  loadGlbAsset(
    glbUrl,
    (loaded, sourceSize) => {
      if (!root.parent || root.userData?.glbUrl !== glbUrl) return;
      loaded.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      const target = model.size || { width: 1, height: 1, depth: 1 };
      const scale = Math.min(
        (Number(target.width) || 1) / Math.max(Number(sourceSize.width) || 1, 0.001),
        (Number(target.height) || 1) / Math.max(Number(sourceSize.height) || 1, 0.001),
        (Number(target.depth) || 1) / Math.max(Number(sourceSize.depth) || 1, 0.001)
      );
      loaded.scale.setScalar(scale);
      loaded.updateMatrixWorld(true);

      const box = new THREE.Box3().setFromObject(loaded);
      const centerX = (box.min.x + box.max.x) / 2;
      const centerZ = (box.min.z + box.max.z) / 2;
      const minY = box.min.y;
      loaded.position.x -= centerX;
      loaded.position.y -= minY;
      loaded.position.z -= centerZ;
      loaded.updateMatrixWorld(true);

      const actualBox = new THREE.Box3().setFromObject(loaded);
      const actualSize = new THREE.Vector3();
      actualBox.getSize(actualSize);
      const nextSize = {
        width: Math.max(0.05, Number(actualSize.x) || Number(target.width) || 1),
        height: Math.max(0.05, Number(actualSize.y) || Number(target.height) || 1),
        depth: Math.max(0.05, Number(actualSize.z) || Number(target.depth) || 1),
      };
      model.size = nextSize;
      setFurnitureSupportVisuals(root, nextSize);
      if (placeholder) {
        placeholder.visible = false;
      }

      if (root.userData?.loadedContent) {
        root.remove(root.userData.loadedContent);
        disposeObject3D(root.userData.loadedContent);
      }
      root.userData.loadedContent = loaded;
      root.add(loaded);
    },
    () => {
      if (placeholder) placeholder.visible = true;
    }
  );
}

function legacyPosition(model, dims) {
  const width = Number(dims?.width) || 6;
  const depth = Number(dims?.depth) || 3;
  const x = Number(model.x);
  const y = Number(model.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: (-width / 2) + ((x / 100) * width),
    y: 0,
    z: (depth / 2) - ((y / 100) * depth),
  };
}

export async function renderFurniture(runtime, payload = {}) {
  const THREE = THREE_REF();
  if (!THREE || !runtime?.furnitureRoot) return [];

  const models = Array.isArray(payload.models) ? payload.models : [];
  const dims = payload.dims || {};
  const root = runtime.furnitureRoot;

  while (root.children.length) {
    const child = root.children[0];
    root.remove(child);
    disposeObject3D(child);
  }

  const rendered = [];
  models.forEach((model) => {
    const mesh = createFurnitureRoot(model);
    const worldPosition = model.position || legacyPosition(model, dims);
    model.position = {
      x: Number(worldPosition.x) || 0,
      y: Number(worldPosition.y) || 0,
      z: Number(worldPosition.z) || 0,
    };
    applyModelPose(mesh, model);
    const objectType = String(model.objectKind || '').trim().toLowerCase() === 'light' ? 'light' : 'furniture';
    Object.assign(mesh.userData, {
      id: model.id,
      asset_id: model.asset_id,
      type: objectType,
      catalogType: model.type || 'asset',
      objectKind: model.objectKind || objectType,
      lightType: model.lightType || model.light_type || null,
      railPosition: Number.isFinite(Number(model.railPosition)) ? Number(model.railPosition) : null,
      wallMounted: Boolean(model.wallMounted || model.wall_mounted || model.shape === 'wall_shelf'),
      wallId: model.wallId || model.wall_id || null,
      code: model.code || model.asset_id || null,
      name: model.name || 'Furniture',
      price: Number(model.price || 0),
      glbUrl: model.glb_url || model.glbUrl || null,
    });
    root.add(mesh);
    if (!attachParametricFurniture(mesh, model)) {
      tryLoadGlb(runtime, mesh, model);
    }
    rendered.push(mesh);
  });

  return rendered;
}

export function renderSiteObjects(runtime, payload = {}) {
  const THREE = THREE_REF();
  if (!THREE || !runtime?.siteObjectRoot) return [];

  const siteObjects = Array.isArray(payload.siteObjects) ? payload.siteObjects : [];
  const root = runtime.siteObjectRoot;

  while (root.children.length) {
    const child = root.children[0];
    root.remove(child);
    if (child.geometry) child.geometry.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        material?.map?.dispose?.();
        material?.dispose?.();
      });
    } else if (child.material) {
      child.material.map?.dispose?.();
      child.material.dispose?.();
    }
  }

  const rendered = [];
  siteObjects.forEach((item) => {
    if ((item.type || 'text') !== 'text') return;
    const mesh = createTextObjectMesh(item);
    applySiteObjectPose(mesh, item);
    mesh.userData = {
      id: item.id,
      type: 'text',
    };
    root.add(mesh);
    rendered.push(mesh);
  });

  return rendered;
}
