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
      .map(face => basePartId(face.partId))
      .filter(id => requiredSides.some(side => id === `fascia-${side}-body`)),
  );
  const signFace = faces.find(face => basePartId(face.partId) === 'fascia-front-text-face');
  const mountedSignSides = new Set(
    faces
      .map(face => basePartId(face.partId))
      .filter(id => requiredSides.some(side => id === `fascia-${side}-text-face`))
      .map(id => id.replace('fascia-', '').replace('-text-face', '')),
  );
  const duplicateMountedGraphics = faces.some(face => requiredSides
    .some(side => basePartId(face.partId) === `fascia-${side}-graphic-face`));
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
  const wall = faces.find(face => basePartId(face.partId) === 'room-check-back');
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
  const graphic = faces.find(face => basePartId(face.partId) === 'room-check-wall-image');
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
  const ids = new Set(faces.map(face => basePartId(face.partId)));
  const headerFaces = faces.filter(face => basePartId(face.partId) === 'room-check-left-header');
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

// A room stays where it is put, even over an overlap - see the release handler
// in booth-render.js. What still has to be true is that the overlap is *seen*,
// because that is what colours the room while it is being dragged and what the
// workspace refuses to save. This assertion used to demand the old spring-back
// and had been failing since that was removed.
const droppedRoomPosition = await page.evaluate(() => {
  const room = rooms.find(entry => entry.id === 'room-check');
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
  return {current:{x:room.x,z:room.z},collisionWasDetected};
});
if (Math.abs(droppedRoomPosition.current.x-1.2)>0.001
  || Math.abs(droppedRoomPosition.current.z-1.2)>0.001
  || !droppedRoomPosition.collisionWasDetected) {
  throw new Error(`Room drop did not hold its position or missed the overlap: ${JSON.stringify(droppedRoomPosition)}`);
}

// This booth is open on all four sides, and a room only borrows a shell wall
// that actually exists - so on an open side it builds its own and a door there
// is perfectly buildable. Close the back for the length of this check, or the
// fixture stops exercising the fallback it is named after.
const sharedShellDoorFallback = await page.evaluate(() => {
  const backWasOpen = wallsVisible.back === false;
  wallsVisible.back = true;
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
  const ids = new Set(faces.map(face=>basePartId(face.partId)));
  const result = {
    hasFrontDoorHeader:ids.has('corner-room-check-front-header')&&ids.has('corner-room-check-rail-front-door-header'),
    hasBackDoorHeader:ids.has('corner-room-check-back-header')||ids.has('corner-room-check-rail-back-door-header'),
    hasDoorPanel:ids.has('corner-room-check-door-panel'),
    generatedIds:[...ids].filter(id=>id.startsWith('corner-room-check')),
  };
  if (backWasOpen) wallsVisible.back = false;
  buildBoothGeometry();
  renderAll();
  return result;
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
// An overlap is advisory, not a refusal - a designer putting a counter tight
// against another piece knows what they are drawing better than a collision box
// does, so the preview names the overlap and still lets go of the item. (This
// assertion used to demand a refusal and had been failing since that rule
// changed.) What is refused is a room conflict, checked further down.
if (!catalogDropChecks.blockedPreview?.valid
  || !catalogDropChecks.validFootprint
  || !String(catalogDropChecks.blockedPreview?.reason || '').startsWith('Overlaps ')) {
  throw new Error(`Overlapping catalogue drop lost its advisory: ${JSON.stringify(catalogDropChecks)}`);
}
if (catalogDropChecks.committed?.type !== 'catalogDropCommitted'
  || !catalogDropChecks.committed.valid
  || Math.abs(catalogDropChecks.committed.x - 4.5) > 0.08
  || Math.abs(catalogDropChecks.committed.z - 1.5) > 0.08) {
  throw new Error(`Catalogue drop commit returned wrong floor coordinates: ${JSON.stringify(catalogDropChecks)}`);
}

// An invalid drop now looks for the nearest spot it *can* take (see the
// invalid-placement block further down), and only falls back to the position
// the drag started from when there is nowhere within reach. That fallback is
// what this used to be the whole of, and it is still the guarantee: on a stand
// with no room to put anything, an item must not be left somewhere illegal.
// The search is stubbed out to stand in for "found nothing".
const restoredPosition = await page.evaluate(() => {
  const search = nearestValidPlacement;
  window.nearestValidPlacement = () => null;
  try {
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
  } finally {
    window.nearestValidPlacement = search;
  }
});
if (Math.abs(restoredPosition.x - 1.2) > 0.001 || Math.abs(restoredPosition.z - 1.2) > 0.001) {
  throw new Error(`Invalid drag with nowhere to go was not restored: ${JSON.stringify(restoredPosition)}`);
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

/* ── Rooms ─────────────────────────────────────────────────────────────────
 *
 * A free-standing room, checked as a room rather than as a list of part ids.
 *
 * The bug this covers: every wall box was pushed with one `normal` in its
 * props, which overwrote the per-face normal on all six of its faces, so the
 * draw loop's back-face cull threw whole walls away. Two of the four walls of
 * every room were invisible - the frame stood there with nothing in it - and
 * the two that drew were shaded as though they faced one way. A part-id check
 * could not see any of that, because the faces were all built; they were never
 * drawn. So this measures the polygons that reach the DOM.
 */
await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  w: 8, d: 6, h: 3, open: 'front',
  placedItems: [],
  rooms: [{
    id: 'room-solid', name: 'Storage', width: 3, depth: 2.5, height: 2.4,
    x: 4, z: 3, hasDoor: true, hasCeiling: false,
    doorSide: 'front', doorWidth: 0.85, doorPosition: 'center',
    doorSwing: 'left-in', doorOpen: false,
    wallFinish: 'white', floorColor: '#1f2937', locked: false,
    designWall: 'back', designFit: 'cover',
  }],
  activeRoomId: '',
}, '*'));
await page.waitForFunction(() => rooms.some(room => room.id === 'room-solid'));

const roomWallsDrawn = await page.evaluate(() => {
  // The panels only - `data-room-wall` is set on wall infill and on nothing
  // else, so the aluminium frame, which drew correctly throughout, cannot stand
  // in for a wall that did not.
  const drawn = side => document.querySelectorAll(
    `[data-room-id="room-solid"][data-room-wall="${side}"]`).length;
  // Every wall slab is a box, and a box has six faces pointing six ways. One
  // normal shared across a slab is the bug itself.
  const slabs = new Map();
  for (const face of faces) {
    if (face.roomId !== 'room-solid' || !face.roomWall || face.gid == null) continue;
    if (!slabs.has(face.gid)) slabs.set(face.gid, new Set());
    slabs.get(face.gid).add(JSON.stringify(face.normal));
  }
  return {
    back: drawn('back'), front: drawn('front'), left: drawn('left'), right: drawn('right'),
    slabCount: slabs.size,
    flatSlabs: [...slabs.values()].filter(normals => normals.size < 6).length,
    ghosted: document.querySelectorAll('[data-room-id="room-solid"][data-room-cutaway]').length,
  };
});
if (!roomWallsDrawn.back || !roomWallsDrawn.front || !roomWallsDrawn.left || !roomWallsDrawn.right) {
  throw new Error(`A room wall was built but never drawn: ${JSON.stringify(roomWallsDrawn)}`);
}
if (!roomWallsDrawn.slabCount || roomWallsDrawn.flatSlabs) {
  throw new Error(`Room wall faces share a normal - props are overwriting them again: ${JSON.stringify(roomWallsDrawn)}`);
}
if (roomWallsDrawn.ghosted !== 0) {
  throw new Error(`An unselected room should be solid: ${JSON.stringify(roomWallsDrawn)}`);
}

// Selecting the room cuts away the walls the camera is looking through, so the
// designer can see what is inside it, and drops those walls' depth occluders so
// the GLB layer does not hide the furniture the cutaway just revealed.
const roomCutaway = await page.evaluate(async () => {
  const before = window.__shellOccluderCount;
  window.postMessage({ type: 'boothUpdate', activeRoomId: 'room-solid' }, '*');
  await new Promise(resolve => setTimeout(resolve, 300));
  return {
    before,
    after: window.__shellOccluderCount,
    open: [...cutawayRoomWalls()],
    ghosted: document.querySelectorAll('[data-room-id="room-solid"][data-room-cutaway]').length,
    clickable: document.querySelectorAll(
      '[data-room-id="room-solid"][data-room-cutaway][pointer-events="none"]').length,
  };
});
if (!roomCutaway.open.length
  || roomCutaway.ghosted === 0
  || roomCutaway.ghosted !== roomCutaway.clickable
  || roomCutaway.after !== roomCutaway.before - roomCutaway.open.length) {
  throw new Error(`Room cutaway did not open the near walls: ${JSON.stringify(roomCutaway)}`);
}

/* The walls are a limit, not a warning: a piece inside a room slides along the
 * inside of the wall it is pushed against, a piece outside slides along the
 * outside, and neither ends up somewhere the workspace would then refuse. */
const roomLimits = await page.evaluate(() => {
  const cabinet = () => ({ w: 1.04, d: 0.44, h: 1.95, shape: 'cabinet', sku: '213', name: 'Cab', rotationY: 0 });
  const room0 = rooms[0];
  const box = { x: room0.x - BW / 2, z: room0.z, w: room0.width, d: room0.depth };
  const reason = point => itemCollisionReason('probe', point.x, point.z, 1.04, 0.44, 0);
  const inside = resolveDropPosition(cabinet(), box.x + 1.4, box.z);
  const outside = resolveDropPosition(cabinet(), box.x - 1.7, box.z);
  return {
    insideGap: (box.x + box.w / 2) - (inside.x + 0.52),
    outsideGap: (box.x - box.w / 2) - (outside.x + 0.52),
    insideReason: reason(inside),
    outsideReason: reason(outside),
  };
});
if (roomLimits.insideGap <= 0 || roomLimits.outsideGap <= 0
  || roomLimits.insideReason || roomLimits.outsideReason) {
  throw new Error(`Room walls did not limit furniture: ${JSON.stringify(roomLimits)}`);
}

/* Everything the shell's walls carry, a room's walls carry too: a shelf takes
 * the width of the panel it lands on, a light rides the top rail - at the
 * room's height, not the booth's - and which face you get is decided by which
 * side of the wall you are standing on. */
const roomMounting = await page.evaluate(() => {
  const room1 = rooms[0];
  const box = { x: room1.x - BW / 2, z: room1.z, w: room1.width, d: room1.depth };
  const shelf = { w: 1.03, d: 0.33, h: 0.10, shape: 'wall_shelf', sku: 'ws-001', name: 'Shelf' };
  const insidePoint = { x: box.x, z: box.z - box.d / 2 + 0.2 };
  const outsidePoint = { x: box.x, z: box.z - box.d / 2 - 0.2 };
  resolveDropPosition(shelf, insidePoint.x, insidePoint.z);
  const light = { w: 0.26, d: 0.15, h: 0.21, shape: 'rail_light', sku: '418', name: 'Spot' };
  const lightPos = resolveDropPosition(light, box.x, box.z);
  return {
    insideRun: nearestPanelSlot(insidePoint.x, insidePoint.z).slot.run.name,
    outsideRun: nearestPanelSlot(outsidePoint.x, outsidePoint.z).slot.run.name,
    shelfWidth: shelf.w,
    lightRun: nearestRailRun(box.x, box.z).run.name,
    lightY: light.y,
    boothRailY: railLightY(),
    drawnLightY: mountedBaseY({ ...light, x: lightPos.x + 8 / 2, z: lightPos.z }),
  };
});
if (roomMounting.insideRun !== 'room:room-solid:back:in'
  || roomMounting.outsideRun !== 'room:room-solid:back:out'
  || Math.abs(roomMounting.shelfWidth - 0.94) > 0.001
  || !roomMounting.lightRun.startsWith('room:room-solid')
  || !(roomMounting.lightY < roomMounting.boothRailY)
  || Math.abs(roomMounting.drawnLightY - roomMounting.lightY) > 0.0001) {
  throw new Error(`Room walls do not mount what booth walls mount: ${JSON.stringify(roomMounting)}`);
}

/* A door belongs to the wall it hangs in, and to no other. The leaf used to be
 * lifted clear of the room's layer band so it would always beat that wall -
 * which also lifted it above every other wall, so a door on the far side of a
 * room painted on top of the near one and floated in the middle of a solid
 * panel. Nobody saw it while two of the four walls were not drawn at all.
 *
 * Everything is painted; what decides what you see is the order. A far door has
 * to be painted before the wall in front of it, and a near door after. */
const doorPaintOrder = {};
for (const doorSide of ['front', 'back']) {
  await page.evaluate(side => window.postMessage({
    type: 'boothUpdate', w: 8, d: 6, h: 3, open: 'front', placedItems: [], activeRoomId: '',
    rooms: [{
      id: 'door-room', name: 'Storage', width: 3, depth: 2.5, height: 2.8, x: 4, z: 3,
      hasDoor: true, hasCeiling: false, doorSide: side, doorWidth: 0.9, doorPosition: 'center',
      doorSwing: 'left-in', doorOpen: false, wallFinish: 'white', floorColor: '#e5e7eb',
      locked: false, designWall: 'back', designFit: 'cover',
    }],
  }, '*'), doorSide);
  await page.waitForFunction(s => rooms[0]?.doorSide === s, doorSide);
  await page.evaluate(() => {
    camState.azimuth = 0; camState.elevation = 0.06; camState.distance = 14;
    updateCamera(); renderAll();
  });
  doorPaintOrder[doorSide] = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#boothGroup polygon')];
    const lastIndex = prefix => nodes.reduce((found, node, i) =>
      basePartId(node.getAttribute('data-pid') || '').startsWith(prefix) ? i : found, -1);
    return { leaf: lastIndex('door-room-door-panel'), nearWall: lastIndex('door-room-front') };
  });
}
if (doorPaintOrder.back.leaf < 0 || doorPaintOrder.back.nearWall < 0
  || doorPaintOrder.back.leaf > doorPaintOrder.back.nearWall) {
  throw new Error(`A far room door is painting over the near wall: ${JSON.stringify(doorPaintOrder)}`);
}

/* ── Floor grid ────────────────────────────────────────────────────────────
 *
 * The metre grid is paint on the carpet, so it has to be laid down before the
 * stand is built on top of it. Its group used to come after boothGroup, so
 * every line was drawn over the whole booth - walls, room partitions and
 * furniture all had the grid showing through them, and a solid panel read as
 * glass. */
const gridBeforeBooth = await page.evaluate(() => {
  const grid = document.getElementById('gridGroup');
  const booth = document.getElementById('boothGroup');
  if (!grid || !booth) return null;
  // DOCUMENT_POSITION_FOLLOWING (4) means booth comes after grid: painted later.
  return Boolean(grid.compareDocumentPosition(booth) & Node.DOCUMENT_POSITION_FOLLOWING);
});
if (!gridBeforeBooth) {
  throw new Error('The floor grid is painted over the booth instead of under it');
}

/* ── Wall graphics ─────────────────────────────────────────────────────────
 *
 * Artwork and brand text are printed on the panel, in the panel's own surface
 * coordinates. They used to be composed in screen space - the image dropped
 * into the bounding box of the projected panel, the text drawn horizontally at
 * its centre - so nothing was attached to the wall: orbit the stand and a logo
 * stayed upright and square while the panel carrying it turned away.
 *
 * Two things are checked, from every side of the stand.
 *
 * Anchoring: the brand's own coordinates never move. They are a fixed point on
 * the panel, so the same number has to come back at every camera angle; a
 * screen-space layout changes it on every frame.
 *
 * Handedness: the surface matrix must not mirror. buildWall() runs the side
 * walls back-to-front and the back wall left-to-right, and pushes each bay's
 * reverse face in the opposite order again, so reading the corners literally
 * printed the artwork back to front on four of the eleven panels measured here. */
await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  w: 6, d: 4, h: 3, open: 'front', placedItems: [], rooms: [],
  panelOverrides: {
    'panel-back-1': { brandText: 'SEDEF', brandScale: 0.28 },
    'panel-left-0': { brandText: 'SEDEF', brandScale: 0.28 },
    'panel-right-1': { brandText: 'SEDEF', brandScale: 0.28 },
    'panel-front-1': { brandText: 'SEDEF', brandScale: 0.28 },
  },
}, '*'));
await page.waitForFunction(() => faces.some(face => face.brandText === 'SEDEF'));
const wallGraphics = await page.evaluate(() => {
  const anchors = new Set();
  const determinants = [];
  for (const azimuth of [0, 0.6, 1.2, 2.4, 3.6, 4.8]) {
    camState.azimuth = azimuth;
    camState.elevation = 0.3;
    camState.distance = 13;
    updateCamera();
    renderAll();
    for (const printed of document.querySelectorAll('#boothGroup g[transform^="matrix"]')) {
      const m = printed.getAttribute('transform').match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);
      determinants.push(m[0] * m[3] - m[1] * m[2]);
      const text = printed.querySelector('text');
      if (text) anchors.add(text.getAttribute('x'));
    }
  }
  return { anchors: [...anchors], drawn: determinants.length, mirrored: determinants.filter(d => d <= 0).length };
});
if (!wallGraphics.drawn) {
  throw new Error('No wall graphic was drawn in its panel surface at all');
}
if (wallGraphics.mirrored) {
  throw new Error(`${wallGraphics.mirrored} of ${wallGraphics.drawn} wall graphics are printed mirrored`);
}
if (wallGraphics.anchors.length !== 1) {
  throw new Error(`Brand text moved on its panel as the camera turned: ${JSON.stringify(wallGraphics.anchors)}`);
}

/* ── Rooms against an open side ────────────────────────────────────────────
 *
 * A room edge flush with the stand borrows that shell wall rather than building
 * its own - but only where the shell has a wall. An open side is a frame with
 * no panel in it, so a room pushed against one has to build its own wall there,
 * and used not to: the storeroom stood open to the aisle with a gap exactly
 * where its wall belonged, and the take-off never charged for the missing
 * panels either. availableRoomWallSides() in workspace-geometry.ts reads the
 * same rule for the door options and the BOM. */
await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  w: 4, d: 3, h: 3, open: 'front,left', placedItems: [], activeRoomId: '',
  rooms: [{
    id: 'open-side-room', name: 'Storage', width: 2, depth: 3, height: 2.5,
    x: 1, z: 1.5, hasDoor: true, hasCeiling: false,
    doorSide: 'right', doorWidth: 0.9, doorPosition: 'center',
    doorSwing: 'left-in', doorOpen: false,
    wallFinish: 'white', floorColor: '#e5e7eb', locked: false,
    designWall: 'back', designFit: 'cover',
  }],
}, '*'));
await page.waitForFunction(() => roomGeometry.has('open-side-room'));
const roomAgainstOpenSide = await page.evaluate(() => {
  const drawn = side => document.querySelectorAll(
    `[data-room-id="open-side-room"][data-room-wall="${side}"]`).length;
  return {
    built: { ...roomGeometry.get('open-side-room').built },
    shellPanels: {
      left: faces.filter(f => basePartId(f.partId).startsWith('panel-left')).length,
      front: faces.filter(f => basePartId(f.partId).startsWith('panel-front')).length,
      back: faces.filter(f => basePartId(f.partId).startsWith('panel-back')).length,
    },
    drawn: { back: drawn('back'), front: drawn('front'), left: drawn('left'), right: drawn('right') },
  };
});
// Flush with the open front and the open left, so it builds both itself. Flush
// with the closed back, so it borrows that one and builds nothing.
if (!roomAgainstOpenSide.built.front || !roomAgainstOpenSide.built.left
  || roomAgainstOpenSide.built.back
  || !roomAgainstOpenSide.drawn.front || !roomAgainstOpenSide.drawn.left) {
  throw new Error(`A room against an open booth side has a hole in it: ${JSON.stringify(roomAgainstOpenSide)}`);
}
if (roomAgainstOpenSide.shellPanels.left || roomAgainstOpenSide.shellPanels.front) {
  throw new Error(`The open sides grew panels, so this case no longer tests anything: ${JSON.stringify(roomAgainstOpenSide)}`);
}

/* ── Corners ───────────────────────────────────────────────────────────────
 *
 * A corner unit is a real product and a corner is where it goes, so furniture
 * pushed into one has to seat flush against both walls and stay there. Two
 * separate things stopped it.
 *
 * The frame was an obstacle: every corner post and every upright between wall
 * panels reserved a 36 cm pocket, so a piece dragged into a corner was marked
 * as colliding and sprang back to wherever it had last been legal. Only the
 * front support column is a real obstruction now, which is also the only one
 * the workspace half has ever enforced.
 *
 * And the flush snap measured the wrong distance: centre-to-target rather than
 * edge-to-wall. A 1.02 m counter seats with its centre 0.51 m off the wall, so
 * aiming the pointer at the wall itself left the centre 0.51 m past the target,
 * outside the 0.35 m range - pushing furniture straight at a wall was the one
 * gesture that could not seat it against one. */
await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  w: 4, d: 3, h: 3, open: 'front', placedItems: [], rooms: [], activeRoomId: '',
}, '*'));
await page.waitForFunction(() => Math.abs(BW - 4) < 0.001 && rooms.length === 0);
const corners = await page.evaluate(() => {
  const results = {};
  const aim = { backLeft: [-BW / 2, 0], backRight: [BW / 2, 0], frontLeft: [-BW / 2, BD], frontRight: [BW / 2, BD] };
  for (const [name, [cx, cz]] of Object.entries(aim)) {
    // A low showcase: wide enough that centre-to-target and edge-to-wall are
    // visibly different distances, which is what the old rule got wrong.
    const item = { w: 1.02, d: 0.54, h: 0.94, shape: 'cabinet', sku: '201', name: 'Showcase', rotationY: 0 };
    const at = resolveDropPosition(item, cx, cz);
    const footprint = rotatedFootprint(item.w, item.d, item.rotationY);
    results[name] = {
      sideGap: (BW / 2 - Math.abs(at.x) - footprint.w / 2),
      endGap: Math.min(at.z - footprint.d / 2, BD - (at.z + footprint.d / 2)),
      refused: itemCollisionReason(null, at.x, at.z, item.w, item.d, 0),
    };
  }
  return results;
});
for (const [name, seat] of Object.entries(corners)) {
  if (Math.abs(seat.sideGap) > 0.001 || Math.abs(seat.endGap) > 0.001 || seat.refused) {
    throw new Error(`Furniture will not sit in the ${name} corner: ${JSON.stringify(corners)}`);
  }
}

/* ── Invalid placement: say why, and land somewhere ────────────────────────
 *
 * Dropping furniture on something used to do two unhelpful things at once. The
 * gizmo said "Overlap" whatever was actually wrong, because the drag called
 * checkItemCollision() and threw away the sentence itemCollisionReason() had
 * already built. And on release the item sprang back to wherever the drag
 * began - so a piece dragged across the stand vanished from under the pointer
 * and reappeared metres away, which reads as the drag having failed rather than
 * as the spot being taken.
 *
 * It now names the obstruction and puts the item down beside where it was
 * aimed. See nearestValidPlacement(); note especially that it has one caller. */
await page.evaluate(() => window.postMessage({
  type: 'boothUpdate',
  w: 6, d: 4, h: 3, open: 'front', rooms: [], activeRoomId: '',
  placedItems: [
    { id: 'ws08-chair', catalogId: 'sedef-149', name: 'Plastic chair', sku: '149', qty: 1,
      w: 0.5, d: 0.45, h: 0.88, x: 1.5, z: 2, rotationY: 0, kind: 'furniture', shape: 'chair', color: '#888' },
    { id: 'ws08-counter', catalogId: 'ens-208', name: 'Counter', sku: '208', qty: 1,
      w: 1.04, d: 0.44, h: 0.97, x: 5, z: 3.5, rotationY: 0, kind: 'furniture', shape: 'counter', color: '#aaa' },
  ],
}, '*'));
await page.waitForFunction(() => placedItems.some(item => item.id === 'ws08-counter'));
// The viewport-sweep above leaves the page at phone size, where the stand is a
// few dozen pixels across and nothing can be aimed at.
await page.setViewportSize({ width: 1280, height: 800 });
await page.evaluate(() => {
  camState.azimuth = 0; camState.elevation = 0.8; camState.distance = 15;
  updateCamera(); renderAll();
});
await page.waitForTimeout(150);

// A real gesture, not a call into the collision helper. The bug was that the
// *drag* asked a boolean question, so testing the helper directly would pass
// either way; this picks the counter up, drags it onto the chair, reads what
// the gizmo says while the pointer is still down, and lets go.
// The biggest face of each item, not the first one in the document. An item is
// drawn as six polygons and several of them are edge-on: the first can be under
// a pixel wide, and aiming at the centre of its box misses the item entirely.
const faceCentre = async (itemId) => {
  const centre = await page.evaluate((id) => {
    let best = null;
    for (const node of document.querySelectorAll(`[data-item-id="${id}"]`)) {
      const box = node.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      // On screen, or the pointer cannot be put on it. The stand projects low
      // at a shallow camera angle and the nearest items can sit below the fold.
      if (x < 4 || y < 4 || x > innerWidth - 4 || y > innerHeight - 4) continue;
      const area = box.width * box.height;
      if (!best || area > best.area) best = { area, x, y };
    }
    return best;
  }, itemId);
  if (!centre) throw new Error(`WS-08 fixture item ${itemId} is not on screen`);
  return centre;
};
const counterAt = await faceCentre('ws08-counter');
const chairAt = await faceCentre('ws08-chair');
await page.mouse.move(counterAt.x, counterAt.y);
await page.mouse.down();
const grabbed = await page.evaluate(() => (objectDrag ? objectDrag.itemId : null));
if (grabbed !== 'ws08-counter') {
  const at = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return { tag: el?.tagName, item: el?.getAttribute?.('data-item-id'), pid: el?.getAttribute?.('data-pid'),
             vw: innerWidth, vh: innerHeight, faces: document.querySelectorAll('[data-item-id="ws08-counter"]').length };
  }, [counterAt.x, counterAt.y]);
  throw new Error(`WS-08 drag never picked the counter up (grabbed ${grabbed}) at ${JSON.stringify(counterAt)} -> ${JSON.stringify(at)}`);
}
await page.mouse.move(chairAt.x, chairAt.y, { steps: 12 });
const whileDragging = await page.evaluate(() => {
  const item = placedItems.find(entry => entry.id === 'ws08-counter');
  const warning = [...document.querySelectorAll('#boothGroup text')]
    .map(node => node.textContent || '')
    .find(text => text.startsWith('⚠'));
  return { reason: dragCollisionReason, warning: warning || '', aimX: item.x, aimZ: item.z };
});
await page.mouse.up();
const invalidPlacement = await page.evaluate(() => {
  const item = placedItems.find(entry => entry.id === 'ws08-counter');
  return {
    x: item.x, z: item.z,
    stillInvalid: itemCollisionReason('ws08-counter', item.x - BW / 2, item.z, item.w, item.d, item.rotationY || 0),
  };
});
if (!whileDragging.reason || whileDragging.reason === 'Overlap') {
  throw new Error(`The drag did not name what it collided with: ${JSON.stringify(whileDragging)}`);
}
if (!whileDragging.warning.includes(whileDragging.reason)) {
  throw new Error(`The gizmo did not show the reason the drag found: ${JSON.stringify(whileDragging)}`);
}
if (invalidPlacement.stillInvalid) {
  throw new Error(`Furniture was put down somewhere invalid: ${JSON.stringify({ whileDragging, invalidPlacement })}`);
}
// Beside the pointer, not back at the start four metres away.
const fromAim = Math.hypot(invalidPlacement.x - whileDragging.aimX, invalidPlacement.z - whileDragging.aimZ);
const fromStart = Math.hypot(invalidPlacement.x - 5, invalidPlacement.z - 3.5);
if (fromAim > 1 || fromAim >= fromStart) {
  throw new Error(`Furniture sprang back instead of landing near the pointer: ${JSON.stringify({ fromAim, fromStart, invalidPlacement })}`);
}

/* ── Octanorm against Maxima ───────────────────────────────────────────────
 *
 * The two systems used to be drawn at the same size. Only the fascia half of
 * getSystemProfile() had been ported from the reference engine; the structure
 * was EX for both, so switching system turned an octagon into a square at the
 * same 40 mm across and changed nothing else - while the take-off, the weights
 * and the price all moved. The picture said the systems were the same and the
 * quote said they were not.
 *
 * Measured, not eyeballed: this compares the geometry that reaches the DOM for
 * one booth drawn both ways. */
const systemContrast = await page.evaluate(async () => {
  const measure = async (style) => {
    window.postMessage({
      type: 'boothUpdate', w: 6, d: 4, h: 3, open: 'front', style,
      placedItems: [], rooms: [], activeRoomId: '',
    }, '*');
    await new Promise(resolve => setTimeout(resolve, 260));
    const profile = ensSystemProfile();
    const postIds = new Set(faces
      .map(face => basePartId(face.partId))
      .filter(id => id.startsWith('post-'))
      .map(id => id.replace(/-\d+:[-+a-z]+$/, '')));
    // The drawn width of one upright, across every face of it. A single face
    // is no good: the first one a box pushes is a side, and all four of its
    // corners share an x.
    const xs = [];
    for (const face of faces) {
      if (basePartId(face.partId) !== 'post-back-1') continue;
      for (const point of face.pts) xs.push(point[0]);
    }
    return {
      style,
      upright: profile.uprightWidth,
      railHeight: profile.railHeight,
      railDepth: profile.railDepth,
      posts: postIds.size,
      hud: document.getElementById('hud-profile')?.textContent || '',
      drawnSpan: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    };
  };
  const octa = await measure('octa');
  const maxima = await measure('maxima');
  return { octa, maxima };
});
const { octa, maxima } = systemContrast;
// A Maxima upright is 80 mm against Octanorm's 45, and its rails are nearly
// three times as deep. If these ever converge the systems look alike again.
if (!(maxima.upright > octa.upright * 1.6)
  || !(maxima.railDepth > octa.railDepth * 2)
  || !(maxima.railHeight > octa.railHeight)) {
  throw new Error(`Octanorm and Maxima are drawn at the same weight: ${JSON.stringify(systemContrast)}`);
}
if (octa.hud === maxima.hud || !octa.hud || !maxima.hud) {
  throw new Error(`The profile readout does not distinguish the systems: ${JSON.stringify(systemContrast)}`);
}
// And it reaches the picture, not just the profile table.
if (!(maxima.drawnSpan > octa.drawnSpan * 1.4)) {
  throw new Error(`The heavier profile never reached the geometry: ${JSON.stringify(systemContrast)}`);
}

/* ── Per-face data survives the caller ─────────────────────────────────────
 *
 * pushBox() and pushPrism() build a literal per face. They used to set the
 * per-face fields and *then* spread the caller's props over them, so any prop
 * of the same name silently won. Three fields were lost to it: renderOrder
 * (twenty-one furniture call sites that never ran), normal (every wall of every
 * room shared one direction, so two of the four were culled from every view)
 * and partId (all six faces of a box answered to one id).
 *
 * Props go first now and per-face data last, so nothing outside can win. This
 * checks the three fields together on a real box, because fixing one of them at
 * a time is how the other two survived. */
const perFaceData = await page.evaluate(() => {
  const boxes = new Map();
  for (const face of faces) {
    if (!face.gid) continue;
    if (!boxes.has(face.gid)) boxes.set(face.gid, []);
    boxes.get(face.gid).push(face);
  }
  let sixFaced = 0, sharedId = 0, sharedNormal = 0, splitPart = 0, splitLayer = 0;
  for (const [, group] of boxes) {
    if (group.length !== 6) continue;
    sixFaced++;
    if (new Set(group.map(face => face.partId)).size !== 6) sharedId++;
    if (new Set(group.map(face => JSON.stringify(face.normal))).size !== 6) sharedNormal++;
    // ...and the six still name one part, or selection cannot address it.
    if (new Set(group.map(face => basePartId(face.partId))).size !== 1) splitPart++;
    if (new Set(group.map(face => face.renderOrder)).size !== 1) splitLayer++;
  }
  return { sixFaced, sharedId, sharedNormal, splitPart, splitLayer };
});
if (perFaceData.sixFaced < 20) {
  throw new Error(`Not enough boxes to judge per-face data: ${JSON.stringify(perFaceData)}`);
}
if (perFaceData.sharedId || perFaceData.sharedNormal) {
  throw new Error(`A caller's props are overwriting per-face data again: ${JSON.stringify(perFaceData)}`);
}
if (perFaceData.splitPart || perFaceData.splitLayer) {
  throw new Error(`A box's faces no longer agree on their part or layer: ${JSON.stringify(perFaceData)}`);
}

/* ── Both halves answer the same question the same way ─────────────────────
 *
 * Item/room/booth collision used to be implemented twice - once here in
 * booth-centred coordinates and once in workspace-geometry.ts - and the copies
 * drifted. They measured room interiors differently, and they disagreed on how
 * much daylight two items need: the renderer let go at 2 cm, the workspace
 * refused under 6 cm. A drag could put something down that the workspace then
 * rejected, with nothing on screen to explain why.
 *
 * There is one implementation now; the renderer loads it compiled and keeps only
 * the coordinate shift. This walks an item across a room wall a centimetre at a
 * time and asks both halves at every step - the boundary is where a rounding or
 * a padding difference shows up, and a single spot check would step over it. */
const halvesAgree = await page.evaluate(() => {
  window.postMessage({
    type: 'boothUpdate', w: 8, d: 6, h: 3, open: 'front', placedItems: [], activeRoomId: '',
    rooms: [{
      id: 'agree-room', name: 'Storage', width: 3, depth: 2.5, height: 2.4, x: 4, z: 3,
      hasDoor: true, hasCeiling: false, doorSide: 'front', doorWidth: 0.85,
      doorPosition: 'center', doorSwing: 'left-in', doorOpen: false,
      wallFinish: 'white', floorColor: '#1f2937', locked: false,
      designWall: 'back', designFit: 'cover',
    }],
  }, '*');
  return new Promise(resolve => setTimeout(() => {
    const room = rooms[0];
    const booth = { width: BW, depth: BD, height: BH, system: 'octanorm' };
    const w = 1.04, d = 0.44;
    const disagreements = [];
    for (let step = -6; step <= 6; step += 1) {
      const worldX = room.x + room.width / 2 - 0.15 - w / 2 + step * 0.01;
      const renderer = itemCollisionReason('probe', worldX - BW / 2, room.z, w, d, 0);
      const item = { id: 'probe', catalogId: 'c', name: 'Cab', sku: '213', qty: 1, w, d, h: 1.9,
                     color: '#000', weight: 10, x: worldX, z: room.z, rotation: 0,
                     kind: 'furniture', shape: 'cabinet' };
      const workspace = (ENSPlacement.placementIssuesFor([item], rooms, booth, activeFrontSupportPositions())
        .find(issue => issue.itemId === 'probe') || {}).message || '';
      if (Boolean(renderer) !== Boolean(workspace)) {
        disagreements.push({ mm: step * 10, renderer, workspace });
      }
    }
    // And what a drag actually lets go of has to be something the workspace keeps.
    const settled = resolveDropPosition(
      { w, d, h: 1.9, shape: 'cabinet', sku: '213', name: 'Cab', rotationY: 0 },
      room.x + room.width / 2 - BW / 2, room.z);
    const dropped = { id: 'drop', catalogId: 'c', name: 'Cab', sku: '213', qty: 1, w, d, h: 1.9,
                      color: '#000', weight: 10, x: settled.x + BW / 2, z: settled.z,
                      rotation: 0, kind: 'furniture', shape: 'cabinet' };
    resolve({
      steps: 13,
      disagreements,
      dropRefusedByWorkspace: ENSPlacement.placementIssuesFor([dropped], rooms, booth, activeFrontSupportPositions()).length,
    });
  }, 320));
});
if (halvesAgree.disagreements.length) {
  throw new Error(`The renderer and the workspace disagree about placement: ${JSON.stringify(halvesAgree)}`);
}
if (halvesAgree.dropRefusedByWorkspace) {
  throw new Error(`A drag let go of something the workspace refuses: ${JSON.stringify(halvesAgree)}`);
}

/* ── The oval fascia sign is an oval ───────────────────────────────────────
 *
 * The "custom" option used to paint a flat oval polygon over the rectangular
 * name plate. It read as an outline rather than an object - no thickness, no
 * shading - and the rectangular plate was still underneath it, so the sign
 * overlapped the board it was supposed to be. The plate IS the oval now, built
 * as an extruded ellipse, and it is capped by aspect so it stays a sign rather
 * than becoming a sliver on a wide stand. */
const ovalSign = await page.evaluate(async () => {
  const measure = async (fasciaOption) => {
    window.postMessage({
      type: 'boothUpdate', w: 6, d: 4, h: 3, open: 'front',
      placedItems: [], rooms: [], activeRoomId: '', fasciaEnabled: true, fasciaOption,
    }, '*');
    await new Promise(resolve => setTimeout(resolve, 260));
    const plate = faces.filter(face => basePartId(face.partId) === 'fascia-front-name-plate');
    const ys = plate.flatMap(face => face.pts.map(point => point[1]));
    const xs = plate.flatMap(face => face.pts.map(point => point[0]));
    const zs = plate.flatMap(face => face.pts.map(point => point[2]));
    return {
      faces: plate.length,
      width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
      height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
      thickness: zs.length ? Math.max(...zs) - Math.min(...zs) : 0,
      top: ys.length ? Math.max(...ys) : 0,
      bottom: ys.length ? Math.min(...ys) : 0,
      bandTop: BH + FH,
      bandBottom: BH,
      // A painted oval would be a loose many-sided polygon carrying a fill of
      // its own. Shading is also a loose many-sided polygon - one per face, the
      // oval's own caps included - but it is always black, so fill tells them
      // apart. Without that distinction this counts the oval's own shadow.
      paintedOvals: [...document.querySelectorAll('#boothGroup polygon')]
        .filter(node => (node.getAttribute('points') || '').split(' ').length > 12
          && !node.getAttribute('data-pid')
          && (node.getAttribute('fill') || '').toLowerCase() !== '#000').length,
    };
  };
  return { custom: await measure('custom'), classic: await measure('classic') };
});
if (ovalSign.custom.faces < 20) {
  throw new Error(`The oval fascia sign is not built as geometry: ${JSON.stringify(ovalSign)}`);
}
if (!(ovalSign.custom.thickness > 0.005)) {
  throw new Error(`The oval sign has no thickness - it is a painted outline again: ${JSON.stringify(ovalSign)}`);
}
// Inside the fascia band, top and bottom.
if (ovalSign.custom.top > ovalSign.custom.bandTop + 0.001
  || ovalSign.custom.bottom < ovalSign.custom.bandBottom - 0.001) {
  throw new Error(`The oval sign overhangs the fascia board: ${JSON.stringify(ovalSign)}`);
}
// A sign, not a sliver.
if (ovalSign.custom.width / ovalSign.custom.height > 5.05) {
  throw new Error(`The oval sign is out of proportion: ${JSON.stringify(ovalSign)}`);
}
if (ovalSign.custom.paintedOvals) {
  throw new Error(`Something is still painting an oval over the plate: ${JSON.stringify(ovalSign)}`);
}
// The other options keep their rectangular plate - six faces, one box.
if (ovalSign.classic.faces !== 6) {
  throw new Error(`The classic fascia plate is no longer a plain board: ${JSON.stringify(ovalSign)}`);
}

/* ── The renderer forwards every shortcut the workspace binds ──────────────
 *
 * Clicking the booth moves focus into this iframe and the parent stops seeing
 * key events, so the renderer forwards them. That makes two key lists that have
 * to agree: anything the workspace binds and the renderer does not forward
 * simply stops working the moment the designer touches the stand - which is
 * exactly when they want it. Group nudge, group duplicate and the rotate keys
 * were all in that state when they were added.
 *
 * This drives real keydowns at the renderer and checks what comes back out. */
const forwardedShortcuts = await page.evaluate(async () => {
  const seen = [];
  const listen = (event) => {
    if (event.data && event.data.type === 'workspaceShortcut') seen.push(event.data.action);
  };
  window.addEventListener('message', listen);
  const keys = [
    { key: 'z', ctrlKey: true }, { key: 'y', ctrlKey: true }, { key: 'd', ctrlKey: true },
    { key: 'Delete' }, { key: 'Escape' }, { key: '[' }, { key: ']' },
    { key: 'ArrowLeft' }, { key: 'ArrowRight' }, { key: 'ArrowUp' }, { key: 'ArrowDown' },
  ];
  for (const init of keys) {
    window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
  }
  await new Promise(resolve => setTimeout(resolve, 200));
  window.removeEventListener('message', listen);
  return seen;
});
const mustForward = [
  'undo', 'redo', 'duplicate', 'delete', 'deselect',
  'rotate-ccw', 'rotate-cw',
  'nudge-left', 'nudge-right', 'nudge-up', 'nudge-down',
];
const missing = mustForward.filter(action => !forwardedShortcuts.includes(action));
if (missing.length) {
  throw new Error(`The renderer stopped forwarding shortcuts the workspace binds: ${JSON.stringify({ missing, forwardedShortcuts })}`);
}

if (errors.length) throw new Error(`Renderer errors: ${errors.join(' | ')}`);

console.log(JSON.stringify(sizes));
await browser.close();
