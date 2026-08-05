import { chromium } from '@playwright/test';

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5174';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(`${baseUrl}/booth-render.html?renderer=alignment-check`, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  window.postMessage({
    type: 'boothUpdate',
    w: 6,
    d: 3,
    h: 2.7,
    name: 'ANCHORED FASCIA QA',
    open: 'front,back,left,right',
    fasciaEnabled: true,
    panelOverrides: {
      'fascia-front': {
        brandText: 'ANCHORED FASCIA QA',
        brandColor: '#24364b',
        brandScale: 0.2,
      },
    },
    placedItems: [{
      id: 'alignment-chair',
      catalogId: 'sedef-149',
      name: 'Plastic chair',
      sku: '149',
      qty: 1,
      w: 0.55,
      d: 0.55,
      h: 0.85,
      x: 1.2,
      z: 1.2,
      rotationY: 0,
      kind: 'furniture',
      modelUrl: '/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/149%20PLASTIK%20HARE%20SANDALYE%20-%20PLASTIC%20CHAIR.glb',
    }],
  }, '*');
});
await page.waitForFunction(() => window.__glbVisibleItems?.has('alignment-chair'), null, { timeout: 15_000 });
await page.waitForFunction(() => window.__shellOccluderCount === 4);

const assertPhysicalBounds = async (expected, context) => {
  const bounds = await page.evaluate(() => window.__glbPhysicalBounds?.get('alignment-chair'));
  if (!bounds) throw new Error(`Missing physical GLB bounds in ${context}`);
  for (const [field, value] of Object.entries(expected)) {
    if (Math.abs(bounds[field] - value) > 0.015) {
      throw new Error(`Furniture scale mismatch in ${context}: ${JSON.stringify(bounds)}`);
    }
  }
  return bounds;
};

await assertPhysicalBounds({ width: 0.55, depth: 0.55, height: 0.85 }, 'workspace edit');

const fasciaChecks = await page.evaluate(() => {
  const requiredSides = ['front', 'back', 'left', 'right'];
  const fasciaBodies = new Set(
    faces
      .map(face => String(face.partId || ''))
      .filter(id => requiredSides.some(side => id === `fascia-${side}-body`)),
  );
  const signFace = faces.find(face => face.partId === 'fascia-front-text-face');
  const mountedSignSides = new Set(
    faces
      .map(face => String(face.partId || ''))
      .filter(id => requiredSides.some(side => id === `fascia-${side}-text-face`))
      .map(id => id.replace('fascia-', '').replace('-text-face', '')),
  );
  const duplicateMountedGraphics = faces.some(face => requiredSides
    .some(side => face.partId === `fascia-${side}-graphic-face`));
  const textNode = [...document.querySelectorAll('text')]
    .find(node => node.textContent === 'ANCHORED FASCIA QA');
  const projected = signFace?.pts.map(project).filter(Boolean) || [];
  const bounds = projected.length === 4 ? {
    minX: Math.min(...projected.map(point => point.x)),
    maxX: Math.max(...projected.map(point => point.x)),
    minY: Math.min(...projected.map(point => point.y)),
    maxY: Math.max(...projected.map(point => point.y)),
  } : null;
  const textBounds = textNode?.getBBox();
  const textInsidePlate = Boolean(bounds && textBounds
    && textBounds.x >= bounds.minX - 2
    && textBounds.x + textBounds.width <= bounds.maxX + 2
    && textBounds.y >= bounds.minY - 2
    && textBounds.y + textBounds.height <= bounds.maxY + 2);
  return {
    fasciaBodies: [...fasciaBodies],
    mountedSignSides: [...mountedSignSides],
    wallsVisible,
    duplicateMountedGraphics,
    signLabel: signFace?.signLabel,
    textInsidePlate,
  };
});
if (fasciaChecks.fasciaBodies.length !== 4
  || fasciaChecks.mountedSignSides.length !== 4
  || Object.values(fasciaChecks.wallsVisible).some(Boolean)
  || fasciaChecks.duplicateMountedGraphics
  || fasciaChecks.signLabel !== 'ANCHORED FASCIA QA'
  || !fasciaChecks.textInsidePlate) {
  throw new Error(`Fascia anchoring failed: ${JSON.stringify(fasciaChecks)}`);
}

const placementChecks = await page.evaluate(() => {
  const rotated = window.rotatedFootprint(0.6, 1.2, 90);
  return {
    rotated,
    supportCollision: window.checkItemCollision('alignment-chair', 0, 1.5, 0.55, 0.55, 0),
  };
});
if (Math.abs(placementChecks.rotated.w - 1.2) > 0.001 || Math.abs(placementChecks.rotated.d - 0.6) > 0.001) {
  throw new Error(`Rotation-aware footprint failed: ${JSON.stringify(placementChecks)}`);
}
if (!placementChecks.supportCollision) {
  throw new Error(`Expected support collision: ${JSON.stringify(placementChecks)}`);
}

const carpet = page.locator('[data-pid="carpet"]');
await carpet.click({ position: { x: 520, y: 120 } });
await page.waitForFunction(() => {
  const card = document.getElementById('sel-card');
  const label = document.getElementById('sel-label');
  const selectedCarpet = document.querySelector('[data-pid="carpet"]');
  return selectedKey === 'carpet'
    && card?.style.display === 'block'
    && label?.textContent?.includes('Carpet')
    && selectedCarpet?.getAttribute('stroke') === '#2f7df6';
});
if (process.env.RENDERER_CARPET_SCREENSHOT_PATH) {
  await page.screenshot({ path: process.env.RENDERER_CARPET_SCREENSHOT_PATH, fullPage: true });
}

await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  rooms: [{
    id: 'room-check',
    name: 'Storage room',
    x: 4.5,
    z: 1.5,
    width: 2,
    depth: 2,
    hasDoor: true,
    doorSide: 'left',
    doorWidth: 0.7,
    doorPosition: 'left',
    doorSwing: 'left-in',
    doorOpen: false,
    designImageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==',
    designImageName: 'room-wall.gif',
    designOpacity: 0.6,
    designWall: 'right',
    designFit: 'contain',
  }],
}, '*'));
await page.waitForFunction(() => rooms.some(room => room.id === 'room-check'));
const roomWallGeometry = await page.evaluate(() => {
  const wall = faces.find(face => face.partId === 'room-check-back');
  return wall ? {
    maxY: Math.max(...wall.pts.map(point => point[1])),
    boothWallHeight: BH,
    fill: wall.fill,
  } : null;
});
if (!roomWallGeometry || Math.abs(roomWallGeometry.maxY - roomWallGeometry.boothWallHeight) > 0.001) {
  throw new Error(`Room wall height does not match booth walls: ${JSON.stringify(roomWallGeometry)}`);
}
if (roomWallGeometry.fill !== 'url(#panel)') {
  throw new Error(`Default room wall does not use booth panel finish: ${JSON.stringify(roomWallGeometry)}`);
}
const roomGraphicGeometry = await page.evaluate(() => {
  const graphic = faces.find(face => face.partId === 'room-check-wall-image');
  if (!graphic) return null;
  const xs = graphic.pts.map(point => point[0]);
  return {
    designWall: graphic.designWall,
    graphicFit: graphic.graphicFit,
    opacity: graphic.designOpacity,
    normal: graphic.normal,
    xSpread: Math.max(...xs) - Math.min(...xs),
    meta: graphic.partMeta,
  };
});
if (!roomGraphicGeometry
  || roomGraphicGeometry.designWall !== 'right'
  || roomGraphicGeometry.graphicFit !== 'contain'
  || Math.abs(roomGraphicGeometry.opacity - 0.6) > 0.001
  || roomGraphicGeometry.normal?.[0] !== -1
  || Math.abs(roomGraphicGeometry.xSpread) > 0.001
  || !roomGraphicGeometry.meta.includes('right wall')) {
  throw new Error(`Room graphic wall targeting failed: ${JSON.stringify(roomGraphicGeometry)}`);
}
const roomDoorGeometry = await page.evaluate(() => {
  const ids = new Set(faces.map(face => String(face.partId || '')));
  const headerFaces = faces.filter(face => face.partId === 'room-check-left-header');
  const headerPoints = headerFaces.flatMap(face => face.pts);
  return {
    hasSplitWall: ids.has('room-check-left-back') && ids.has('room-check-left-front'),
    hasSolidDoorWall: ids.has('room-check-left'),
    hasWallHeader: ids.has('room-check-left-header'),
    hasRailHeader: ids.has('room-check-rail-left-door-header'),
    hasDoorPanel: ids.has('room-check-door-panel'),
    hasFrontWall: ids.has('room-check-front'),
    hasFrontDoorHeader: ids.has('room-check-front-header') || ids.has('room-check-rail-front-door-header'),
    openingWidth: headerPoints.length
      ? Math.max(...headerPoints.map(point => point[2])) - Math.min(...headerPoints.map(point => point[2]))
      : 0,
  };
});
if (!roomDoorGeometry.hasSplitWall
  || roomDoorGeometry.hasSolidDoorWall
  || !roomDoorGeometry.hasWallHeader
  || !roomDoorGeometry.hasRailHeader
  || !roomDoorGeometry.hasDoorPanel
  || !roomDoorGeometry.hasFrontWall
  || roomDoorGeometry.hasFrontDoorHeader
  || Math.abs(roomDoorGeometry.openingWidth - 0.7) > 0.001) {
  throw new Error(`Room door wall geometry is inconsistent: ${JSON.stringify(roomDoorGeometry)}`);
}
const roomCollision = await page.evaluate(() => window.checkItemCollision('alignment-chair', 1.5, 1.5, 0.55, 0.55, 0));
if (!roomCollision) throw new Error('Expected room collision for furniture footprint');
const roomCollisionCases = await page.evaluate(() => {
  const room = rooms.find(entry => entry.id === 'room-check');
  return {
    inside: window.itemCollisionReason('inside-test', 2.0, 2.0, 0.3, 0.3, 0),
    wall: window.itemCollisionReason('wall-test', 2.35, 2.0, 0.4, 0.4, 0),
    door: window.itemCollisionReason('door-test', 0.8, 1.0, 0.3, 0.3, 0),
    overlappingRoom: window.roomPlacementCollisionReason('candidate-room', {...room, id:'candidate-room', x:4, z:1.5}),
    clearRoom: window.roomPlacementCollisionReason('candidate-room', {...room, id:'candidate-room', width:1, depth:1, x:1, z:2.5, hasDoor:false}),
  };
});
if (roomCollisionCases.inside
  || !roomCollisionCases.wall.startsWith('Crosses')
  || !roomCollisionCases.door.startsWith('Blocks')
  || !roomCollisionCases.overlappingRoom.startsWith('Overlaps')
  || roomCollisionCases.clearRoom) {
  throw new Error(`Room collision zoning failed: ${JSON.stringify(roomCollisionCases)}`);
}

await page.evaluate(() => {
  window.__roomSelectionMessage = null;
  window.addEventListener('message', event => {
    if (event.data?.type === 'workspaceItemSelected' && event.data?.roomId === 'room-check') {
      window.__roomSelectionMessage = event.data;
    }
  });
});
await page.locator('[data-room-id="room-check"]').first().click({ force: true });
await page.waitForFunction(() => window.__roomSelectionMessage?.roomId === 'room-check');
const roomSelection = await page.evaluate(() => window.__roomSelectionMessage);
if (!roomSelection?.partId || roomSelection.partType !== 'room') {
  throw new Error(`Room selection did not include room context: ${JSON.stringify(roomSelection)}`);
}

const restoredRoomPosition = await page.evaluate(() => {
  const room = rooms.find(entry => entry.id === 'room-check');
  const original = {x:room.x,z:room.z};
  objectDrag = {
    type: 'room',
    pointerId: 998,
    roomId: room.id,
    lastValidX: room.x,
    lastValidZ: room.z,
  };
  room.x = 1.2;
  room.z = 1.2;
  const collisionWasDetected = Boolean(roomPlacementCollisionReason(room.id, room));
  dragHasCollision = collisionWasDetected;
  endPointer({pointerId:998});
  return {original,current:{x:room.x,z:room.z},collisionWasDetected};
});
if (Math.abs(restoredRoomPosition.current.x-restoredRoomPosition.original.x)>0.001
  || Math.abs(restoredRoomPosition.current.z-restoredRoomPosition.original.z)>0.001
  || !restoredRoomPosition.collisionWasDetected) {
  throw new Error(`Invalid room drag did not restore last valid position: ${JSON.stringify(restoredRoomPosition)}`);
}

const sharedShellDoorFallback = await page.evaluate(() => {
  rooms = [{
    id:'corner-room-check',
    name:'Corner storage',
    x:1,
    z:0.5,
    width:2,
    depth:1,
    height:BH,
    hasDoor:true,
    doorSide:'back',
    doorWidth:0.7,
    doorPosition:'center',
    doorSwing:'left-in',
    doorOpen:false,
  }];
  buildBoothGeometry();
  renderAll();
  const ids = new Set(faces.map(face=>String(face.partId||'')));
  return {
    hasFrontDoorHeader:ids.has('corner-room-check-front-header')&&ids.has('corner-room-check-rail-front-door-header'),
    hasBackDoorHeader:ids.has('corner-room-check-back-header')||ids.has('corner-room-check-rail-back-door-header'),
    hasDoorPanel:ids.has('corner-room-check-door-panel'),
    generatedIds:[...ids].filter(id=>id.startsWith('corner-room-check')),
  };
});
if (!sharedShellDoorFallback.hasFrontDoorHeader || sharedShellDoorFallback.hasBackDoorHeader || !sharedShellDoorFallback.hasDoorPanel) {
  throw new Error(`Door on shared booth shell did not move to an available room wall: ${JSON.stringify(sharedShellDoorFallback)}`);
}

const catalogDropChecks = await page.evaluate(async () => {
  rooms = [];
  renderAll();
  window.__catalogDropMessages = [];
  const capture = event => {
    if (event.data?.type === 'catalogDropPreview' || event.data?.type === 'catalogDropCommitted') {
      window.__catalogDropMessages.push(event.data);
    }
  };
  window.addEventListener('message', capture);

  const ratioForFloorPoint = point => {
    const projected = project(point);
    const transform = svgEl.getScreenCTM();
    if (!projected || !transform) throw new Error(`Could not project floor point ${JSON.stringify(point)}`);
    const screen = new DOMPoint(projected.x, projected.y).matrixTransform(transform);
    return { xPct: screen.x / innerWidth, yPct: screen.y / innerHeight };
  };
  const item = {
    catalogId: 'drop-candidate',
    name: 'Drop candidate',
    w: 0.55,
    d: 0.55,
    h: 0.85,
    rotationY: 0,
  };
  const waitForMessages = async count => {
    const deadline = performance.now() + 1_000;
    while (window.__catalogDropMessages.length < count && performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    if (window.__catalogDropMessages.length < count) {
      throw new Error(`Timed out waiting for catalogue drop message ${count}`);
    }
  };
  const validPoint = ratioForFloorPoint([1.5, 0.02, 1.5]);
  const occupiedPoint = ratioForFloorPoint([-BW / 2 + 1.2, 0.02, 1.2]);

  window.postMessage({ type: 'catalogDragPreview', ...validPoint, item }, '*');
  await waitForMessages(1);
  const validPreview = window.__catalogDropMessages.at(-1);
  const validFootprint = document.querySelector('[data-catalog-drop-preview="valid"]') != null;

  window.postMessage({ type: 'catalogDragPreview', ...occupiedPoint, item }, '*');
  await waitForMessages(2);
  const blockedPreview = window.__catalogDropMessages.at(-1);
  const blockedFootprint = document.querySelector('[data-catalog-drop-preview="invalid"]') != null;

  window.postMessage({ type: 'catalogDragCommit', ...validPoint, item }, '*');
  await waitForMessages(3);
  const committed = window.__catalogDropMessages.at(-1);
  window.removeEventListener('message', capture);
  return { validPreview, validFootprint, blockedPreview, blockedFootprint, committed };
});
if (!catalogDropChecks.validPreview?.valid || !catalogDropChecks.validFootprint) {
  throw new Error(`Valid catalogue drop was not accepted: ${JSON.stringify(catalogDropChecks)}`);
}
if (catalogDropChecks.blockedPreview?.valid
  || !catalogDropChecks.blockedFootprint
  || !String(catalogDropChecks.blockedPreview?.reason || '').startsWith('Overlaps ')) {
  throw new Error(`Overlapping catalogue drop was not blocked: ${JSON.stringify(catalogDropChecks)}`);
}
if (catalogDropChecks.committed?.type !== 'catalogDropCommitted'
  || !catalogDropChecks.committed.valid
  || Math.abs(catalogDropChecks.committed.x - 4.5) > 0.08
  || Math.abs(catalogDropChecks.committed.z - 1.5) > 0.08) {
  throw new Error(`Catalogue drop commit returned wrong floor coordinates: ${JSON.stringify(catalogDropChecks)}`);
}

const restoredPosition = await page.evaluate(() => {
  const item = placedItems.find(entry => entry.id === 'alignment-chair');
  objectDrag = {
    type: 'item',
    pointerId: 999,
    itemId: item.id,
    lastValidX: item.x,
    lastValidZ: item.z,
  };
  item.x = 4.5;
  item.z = 1.5;
  dragHasCollision = true;
  endPointer({ pointerId: 999 });
  return { x: item.x, z: item.z };
});
if (Math.abs(restoredPosition.x - 1.2) > 0.001 || Math.abs(restoredPosition.z - 1.2) > 0.001) {
  throw new Error(`Invalid drag was not restored: ${JSON.stringify(restoredPosition)}`);
}

const hitbox = page.locator('[data-item-id="alignment-chair"]').first();
await hitbox.click();
await page.waitForFunction(() => {
  const card = document.getElementById('sel-card');
  const label = document.getElementById('sel-label');
  return card?.style.display === 'block' && label?.textContent?.includes('Plastic chair');
});

await page.evaluate(() => {
  window.__lockedRotationRequests = 0;
  window.addEventListener('message', event => {
    if (event.data?.type === 'workspaceItemRotated') window.__lockedRotationRequests += 1;
  });
  window.postMessage({
    type: 'boothUpdate',
    placedItems: placedItems.map(item => item.id === 'alignment-chair' ? {...item, locked: true} : item),
  }, '*');
});
await page.waitForFunction(() => placedItems.find(item => item.id === 'alignment-chair')?.locked === true);
await page.keyboard.press(']');
await page.waitForTimeout(50);
const lockedRotationRequests = await page.evaluate(() => window.__lockedRotationRequests);
if (lockedRotationRequests !== 0) {
  throw new Error(`Locked furniture emitted a rotation request: ${lockedRotationRequests}`);
}
const lockedHitbox = page.locator('[data-item-id="alignment-chair"]').first();
const lockedHitboxBounds = await lockedHitbox.boundingBox();
if (!lockedHitboxBounds) throw new Error('Locked furniture hitbox is missing');
await page.mouse.move(lockedHitboxBounds.x + lockedHitboxBounds.width / 2, lockedHitboxBounds.y + lockedHitboxBounds.height / 2);
await page.mouse.down();
const lockedDragState = await page.evaluate(() => objectDrag);
await page.mouse.up();
if (lockedDragState !== null) {
  throw new Error(`Locked furniture started a drag: ${JSON.stringify(lockedDragState)}`);
}

const sizes = [];
for (const viewport of [{ width: 1600, height: 900 }, { width: 1000, height: 900 }, { width: 390, height: 844 }]) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(150);
  sizes.push(await page.evaluate(() => {
    const canvas = document.getElementById('glbCanvas').getBoundingClientRect();
    const expectedScale = Math.max(innerWidth / 1600, innerHeight / 1000);
    return {
      viewport: [innerWidth, innerHeight],
      canvas: [canvas.left, canvas.top, canvas.width, canvas.height],
      expected: [
        (innerWidth - 1600 * expectedScale) / 2,
        (innerHeight - 1000 * expectedScale) / 2 + 90 * expectedScale,
        1600 * expectedScale,
        1000 * expectedScale,
      ],
      visibleModels: window.__glbVisibleItems?.size || 0,
    };
  }));
}

for (const result of sizes) {
  result.canvas.forEach((value, index) => {
    if (Math.abs(value - result.expected[index]) > 1) {
      throw new Error(`Canvas alignment mismatch at ${result.viewport.join('x')}: ${JSON.stringify(result)}`);
    }
  });
  if (result.visibleModels !== 1) throw new Error(`Expected one visible GLB: ${JSON.stringify(result)}`);
}

await assertPhysicalBounds({ width: 0.55, depth: 0.55, height: 0.85 }, 'review viewport');
const pixelCoverage = await page.evaluate(() => window.__readGlbPixelCoverage?.());
if (!pixelCoverage || pixelCoverage.visiblePixels < 100) {
  throw new Error(`GLB canvas is blank: ${JSON.stringify(pixelCoverage)}`);
}
if (process.env.RENDERER_SCREENSHOT_PATH) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: process.env.RENDERER_SCREENSHOT_PATH, fullPage: true });
}
if (process.env.RENDERER_MOBILE_SCREENSHOT_PATH) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: process.env.RENDERER_MOBILE_SCREENSHOT_PATH, fullPage: true });
}

await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  placedItems: [{
    id: 'alignment-chair',
    catalogId: 'sedef-149',
    name: 'Plastic chair',
    sku: '149',
    qty: 1,
    w: 0.825,
    d: 0.66,
    h: 1.02,
    x: 1.2,
    z: 1.2,
    rotationY: 0,
    kind: 'furniture',
    modelUrl: '/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/149%20PLASTIK%20HARE%20SANDALYE%20-%20PLASTIC%20CHAIR.glb',
  }],
}, '*'));
await page.waitForFunction(() => {
  const bounds = window.__glbPhysicalBounds?.get('alignment-chair');
  return bounds && Math.abs(bounds.targetWidth - 0.825) < 0.001;
}, null, { timeout: 15_000 });
await assertPhysicalBounds({ width: 0.825, depth: 0.66, height: 1.02 }, 'same-item dimension update');

await page.evaluate(() => window.postMessage({ type: 'workspaceItemRemove', id: 'alignment-chair' }, '*'));
await page.waitForFunction(() => window.__glbVisibleItems?.size === 0);
const deletedModelState = await page.evaluate(() => ({
  visible: window.__glbVisibleItems?.has('alignment-chair'),
  bounds: window.__glbPhysicalBounds?.has('alignment-chair'),
}));
if (deletedModelState.visible || deletedModelState.bounds) {
  throw new Error(`Deleted GLB retained renderer state: ${JSON.stringify(deletedModelState)}`);
}

// Delete a different uncached model immediately after requesting it. This
// reproduces the async load race that previously left untracked ghost furniture.
await page.evaluate(() => {
  window.postMessage({
    type: 'boothUpdate',
    placedItems: [{
      id: 'ghost-chair',
      catalogId: 'sedef-250-b',
      name: 'White wood chair',
      sku: '250-B',
      qty: 1,
      w: 0.55,
      d: 0.55,
      h: 0.85,
      x: 2,
      z: 1.4,
      kind: 'furniture',
      modelUrl: '/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/250-B%20AHSAP%20SANDALYE%20BEYAZ%20-%20WHITE%20WOOD%20CHAIR.glb',
    }],
  }, '*');
  window.postMessage({ type: 'workspaceItemRemove', id: 'ghost-chair' }, '*');
});
await page.waitForTimeout(750);
const ghostState = await page.evaluate(() => ({
  inWorkspace: placedItems.some(item => item.id === 'ghost-chair'),
  visible: window.__glbVisibleItems?.has('ghost-chair'),
  bounds: window.__glbPhysicalBounds?.has('ghost-chair'),
}));
if (ghostState.inWorkspace || ghostState.visible || ghostState.bounds) {
  throw new Error(`Async deletion left ghost furniture: ${JSON.stringify(ghostState)}`);
}
await page.evaluate(() => {
  window.postMessage({
    type: 'boothUpdate',
    placedItems: [{
      id: 'alignment-chair',
      catalogId: 'sedef-149',
      name: 'Plastic chair',
      sku: '149',
      qty: 1,
      w: 0.55,
      d: 0.55,
      h: 0.85,
      x: 1.2,
      z: 1.2,
      rotationY: 0,
      kind: 'furniture',
      modelUrl: '/ens-workspace-assets/sedef_remaining_furniture_refined_v2/glb_models/149%20PLASTIK%20HARE%20SANDALYE%20-%20PLASTIC%20CHAIR.glb',
    }],
  }, '*');
});
await page.waitForFunction(() => window.__glbVisibleItems?.has('alignment-chair'), null, { timeout: 15_000 });
if (errors.length) throw new Error(`Renderer errors: ${errors.join(' | ')}`);

console.log(JSON.stringify(sizes));
await browser.close();
