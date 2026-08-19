import { ROOM_SIDE_OPTIONS, type BoothState, type DoorSide, type WorkspacePlacedItem, type WorkspaceRoom } from "./workspace-model";
import { ITEM_WALL_CLEARANCE_M, snapNumber } from "@/lib/workspace-transform";

// Pure 2D placement/collision geometry for the booth workspace, split out of
// PMWorkspace.tsx. No React, no component state — just math on booth/item/room
// shapes. Kept in one module so the placement rules live in one testable place.

export type PlacementIssue = { itemId: string; message: string };
export type Rect2D = { x0: number; x1: number; z0: number; z1: number };

export function itemPositionBounds(w: number, d: number, booth: BoothState) {
  const clearance = ITEM_WALL_CLEARANCE_M;
  const minX = Math.min(booth.width / 2, w / 2 + clearance);
  const maxX = Math.max(minX, booth.width - w / 2 - clearance);
  const minZ = Math.min(booth.depth / 2, d / 2 + clearance);
  const maxZ = Math.max(minZ, booth.depth - d / 2 - clearance);
  return { minX, maxX, minZ, maxZ };
}

export function rotatedItemFootprint(item: WorkspacePlacedItem) {
  const radians = ((Number(item.rotationY ?? item.rotation) || 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: item.w * cos + item.d * sin,
    depth: item.w * sin + item.d * cos,
  };
}

export function positionBoundsForItem(item: WorkspacePlacedItem, booth: BoothState) {
  const footprint = rotatedItemFootprint(item);
  return itemPositionBounds(footprint.width, footprint.depth, booth);
}

export function itemRect(item: WorkspacePlacedItem, pad = 0.03): Rect2D {
  const footprint = rotatedItemFootprint(item);
  return {
    x0: item.x - footprint.width / 2 - pad,
    x1: item.x + footprint.width / 2 + pad,
    z0: item.z - footprint.depth / 2 - pad,
    z1: item.z + footprint.depth / 2 + pad,
  };
}

export function roomRect(room: WorkspaceRoom, pad = 0.03): Rect2D {
  return {
    x0: room.x - room.width / 2 - pad,
    x1: room.x + room.width / 2 + pad,
    z0: room.z - room.depth / 2 - pad,
    z1: room.z + room.depth / 2 + pad,
  };
}

export function rectsOverlap(a: Rect2D, b: Rect2D) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

export function rectInside(inner: Rect2D, outer: Rect2D, tolerance = 0.001) {
  return inner.x0 >= outer.x0 - tolerance
    && inner.x1 <= outer.x1 + tolerance
    && inner.z0 >= outer.z0 - tolerance
    && inner.z1 <= outer.z1 + tolerance;
}

export function roomInteriorRect(room: WorkspaceRoom): Rect2D {
  const clearance = 0.12;
  const outer = roomRect(room, 0);
  return {
    x0: Math.min(room.x, outer.x0 + clearance),
    x1: Math.max(room.x, outer.x1 - clearance),
    z0: Math.min(room.z, outer.z0 + clearance),
    z1: Math.max(room.z, outer.z1 - clearance),
  };
}

export function roomDoorAxisCenter(room: WorkspaceRoom) {
  const usesDepth = room.doorSide === 'left' || room.doorSide === 'right';
  const span = usesDepth ? room.depth : room.width;
  const start = usesDepth ? room.z - room.depth / 2 : room.x - room.width / 2;
  const sectionCount = Math.max(1, Math.floor(span));
  const sectionWidth = span / sectionCount;
  const index = room.doorPosition === 'left' ? 0 : room.doorPosition === 'right' ? sectionCount - 1 : Math.round((sectionCount - 1) / 2);
  return start + sectionWidth * (index + 0.5);
}

export function roomDoorClearanceRect(room: WorkspaceRoom): Rect2D | null {
  if (!room.hasDoor) return null;
  const center = roomDoorAxisCenter(room);
  const halfOpening = room.doorWidth / 2 + 0.08;
  const swingDepth = Math.max(0.75, room.doorWidth + 0.12);
  const outer = roomRect(room, 0);
  if (room.doorSide === 'back') return { x0: center - halfOpening, x1: center + halfOpening, z0: outer.z0 - 0.06, z1: outer.z0 + swingDepth };
  if (room.doorSide === 'left') return { x0: outer.x0 - 0.06, x1: outer.x0 + swingDepth, z0: center - halfOpening, z1: center + halfOpening };
  if (room.doorSide === 'right') return { x0: outer.x1 - swingDepth, x1: outer.x1 + 0.06, z0: center - halfOpening, z1: center + halfOpening };
  return { x0: center - halfOpening, x1: center + halfOpening, z0: outer.z1 - swingDepth, z1: outer.z1 + 0.06 };
}

export function roomItemConflict(itemBounds: Rect2D, room: WorkspaceRoom): 'wall' | 'door' | null {
  if (!rectsOverlap(itemBounds, roomRect(room, 0))) return null;
  if (!rectInside(itemBounds, roomInteriorRect(room))) return 'wall';
  const doorClearance = roomDoorClearanceRect(room);
  return doorClearance && rectsOverlap(itemBounds, doorClearance) ? 'door' : null;
}

export function roomPlacementIssue(candidate: WorkspaceRoom, allRooms: WorkspaceRoom[], items: WorkspacePlacedItem[]) {
  for (const other of allRooms) {
    if (other.id === candidate.id) continue;
    if (rectsOverlap(roomRect(candidate, 0.04), roomRect(other, 0.04))) return `Overlaps ${other.name}`;
  }
  for (const item of items.filter(isFloorPlacedItem)) {
    const conflict = roomItemConflict(itemRect(item), candidate);
    if (conflict === 'wall') return `${item.name} crosses a room wall`;
    if (conflict === 'door') return `${item.name} blocks the door clearance`;
  }
  return '';
}

export function findAvailableRoomPlacement(room: WorkspaceRoom, rooms: WorkspaceRoom[], items: WorkspacePlacedItem[], booth: BoothState) {
  const minX = room.width / 2;
  const maxX = Math.max(minX, booth.width - room.width / 2);
  const minZ = room.depth / 2;
  const maxZ = Math.max(minZ, booth.depth - room.depth / 2);
  const candidates: { x: number; z: number }[] = [
    { x: minX, z: minZ }, { x: maxX, z: minZ }, { x: minX, z: maxZ }, { x: maxX, z: maxZ },
    { x: booth.width / 2, z: booth.depth / 2 },
  ];
  for (let z = minZ; z <= maxZ + 0.001; z += 0.5) {
    for (let x = minX; x <= maxX + 0.001; x += 0.5) candidates.push({ x: snapNumber(x), z: snapNumber(z) });
  }
  for (const position of candidates) {
    const candidate = { ...room, ...position };
    if (!roomPlacementIssue(candidate, rooms, items)) return candidate;
  }
  return null;
}

export function isFloorPlacedItem(item: WorkspacePlacedItem) {
  return (item.kind === 'furniture' || item.kind === 'asset') && item.shape !== 'wall_shelf' && item.shape !== 'light' && item.shape !== 'rail_light';
}

export function placementIssuesFor(items: WorkspacePlacedItem[], rooms: WorkspaceRoom[], booth: BoothState, frontSupports: number[]): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  const floorItems = items.filter(isFloorPlacedItem);
  const seen = new Set<string>();
  const addIssue = (itemId: string, message: string) => {
    const key = `${itemId}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    issues.push({ itemId, message });
  };

  for (let i = 0; i < floorItems.length; i += 1) {
    const a = floorItems[i];
    const aRect = itemRect(a);
    for (let j = i + 1; j < floorItems.length; j += 1) {
      const b = floorItems[j];
      if (!rectsOverlap(aRect, itemRect(b))) continue;
      addIssue(a.id, `Overlaps ${b.name}`);
      addIssue(b.id, `Overlaps ${a.name}`);
    }
    for (const room of rooms) {
      const conflict = roomItemConflict(aRect, room);
      if (conflict === 'wall') addIssue(a.id, `Crosses ${room.name} wall`);
      if (conflict === 'door') addIssue(a.id, `Blocks ${room.name} door clearance`);
    }
    const bounds = itemPositionBounds(rotatedItemFootprint(a).width, rotatedItemFootprint(a).depth, booth);
    if (a.x < bounds.minX || a.x > bounds.maxX || a.z < bounds.minZ || a.z > bounds.maxZ) {
      addIssue(a.id, 'Outside the usable booth floor');
    }
    for (const supportX of frontSupports) {
      const supportLane: Rect2D = {
        x0: supportX - 0.12,
        x1: supportX + 0.12,
        z0: 0,
        z1: booth.depth,
      };
      if (rectsOverlap(aRect, supportLane)) addIssue(a.id, 'Blocks a structural support rail');
    }
  }
  return issues;
}

// Which sides of a room actually get a built wall: a room edge flush with the
// booth shell borrows that shell wall instead of getting its own. Drives both
// the door-side options and the room material take-off.
export function availableRoomWallSides(width: number, depth: number, x: number, z: number, booth: BoothState): DoorSide[] {
  const tolerance = 0.02;
  return ROOM_SIDE_OPTIONS.map(option => option.value).filter(side => {
    if (side === 'back') return z - depth / 2 > tolerance;
    if (side === 'front') return z + depth / 2 < booth.depth - tolerance;
    if (side === 'left') return x - width / 2 > tolerance;
    return x + width / 2 < booth.width - tolerance;
  });
}
