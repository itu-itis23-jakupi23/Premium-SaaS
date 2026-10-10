// GENERATED — do not edit.
// Source: artifacts/ens-landing/src/pages/pm/workspace-geometry.ts
// Rebuild: node scripts/build-placement-bundle.mjs

"use strict";
var ENSPlacement = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // artifacts/ens-landing/src/pages/pm/workspace-geometry.ts
  var workspace_geometry_exports = {};
  __export(workspace_geometry_exports, {
    alignedPositions: () => alignedPositions,
    applyRoomLimits: () => applyRoomLimits,
    availableRoomWallSides: () => availableRoomWallSides,
    clampInsideRoom: () => clampInsideRoom,
    clampItemToBooth: () => clampItemToBooth,
    distributedPositions: () => distributedPositions,
    findAvailableRoomPlacement: () => findAvailableRoomPlacement,
    itemPositionBounds: () => itemPositionBounds,
    placementIssuesFor: () => placementIssuesFor,
    placementReason: () => placementReason,
    positionBoundsForItem: () => positionBoundsForItem,
    roomContainingPoint: () => roomContainingPoint,
    roomInteriorBounds: () => roomInteriorBounds,
    roomItemPlacementReason: () => roomItemPlacementReason,
    roomPlacementIssue: () => roomPlacementIssue,
    roomPlacementReason: () => roomPlacementReason,
    rotatedItemFootprint: () => rotatedItemFootprint,
    structuralObstacles: () => structuralObstacles
  });

  // artifacts/ens-landing/src/pages/pm/workspace-model.ts
  var ROOM_SIDE_OPTIONS = [
    { value: "front", label: "Front wall" },
    { value: "back", label: "Back wall" },
    { value: "left", label: "Left wall" },
    { value: "right", label: "Right wall" }
  ];

  // artifacts/ens-landing/src/lib/workspace-transform.ts
  var ROOM_SNAP_M = 0.05;
  var ITEM_WALL_CLEARANCE_M = 0;
  var ROOM_WALL_CLEARANCE_M = 0.12;
  var ROOM_ITEM_PAD_M = 0.03;
  var PLAN_MARGIN_M = 3;
  var POSITION_DECIMALS = 3;
  function snapNumber(value, step = ROOM_SNAP_M) {
    return Number((Math.round(value / step) * step).toFixed(POSITION_DECIMALS));
  }

  // artifacts/ens-landing/src/pages/pm/workspace-geometry.ts
  function itemPositionBounds(w, d, booth) {
    const clearance = ITEM_WALL_CLEARANCE_M;
    const margin = PLAN_MARGIN_M;
    const minX = Math.min(booth.width / 2, w / 2 + clearance - margin);
    const maxX = Math.max(minX, booth.width - w / 2 - clearance + margin);
    const minZ = Math.min(booth.depth / 2, d / 2 + clearance - margin);
    const maxZ = Math.max(minZ, booth.depth - d / 2 - clearance + margin);
    return { minX, maxX, minZ, maxZ };
  }
  function rotatedItemFootprint(item) {
    const radians = (Number(item.rotationY ?? item.rotation) || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(radians));
    const sin = Math.abs(Math.sin(radians));
    return {
      width: item.w * cos + item.d * sin,
      depth: item.w * sin + item.d * cos
    };
  }
  function positionBoundsForItem(item, booth) {
    const footprint = rotatedItemFootprint(item);
    return itemPositionBounds(footprint.width, footprint.depth, booth);
  }
  function itemRect(item, pad = ROOM_ITEM_PAD_M) {
    const footprint = rotatedItemFootprint(item);
    return {
      x0: item.x - footprint.width / 2 - pad,
      x1: item.x + footprint.width / 2 + pad,
      z0: item.z - footprint.depth / 2 - pad,
      z1: item.z + footprint.depth / 2 + pad
    };
  }
  function roomRect(room, pad = 0.03) {
    return {
      x0: room.x - room.width / 2 - pad,
      x1: room.x + room.width / 2 + pad,
      z0: room.z - room.depth / 2 - pad,
      z1: room.z + room.depth / 2 + pad
    };
  }
  function rectsOverlap(a, b) {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
  }
  function rectInside(inner, outer, tolerance = 1e-3) {
    return inner.x0 >= outer.x0 - tolerance && inner.x1 <= outer.x1 + tolerance && inner.z0 >= outer.z0 - tolerance && inner.z1 <= outer.z1 + tolerance;
  }
  function roomInteriorRect(room) {
    const clearance = ROOM_WALL_CLEARANCE_M;
    const outer = roomRect(room, 0);
    return {
      x0: Math.min(room.x, outer.x0 + clearance),
      x1: Math.max(room.x, outer.x1 - clearance),
      z0: Math.min(room.z, outer.z0 + clearance),
      z1: Math.max(room.z, outer.z1 - clearance)
    };
  }
  function roomDoorAxisCenter(room) {
    const usesDepth = room.doorSide === "left" || room.doorSide === "right";
    const span = usesDepth ? room.depth : room.width;
    const start = usesDepth ? room.z - room.depth / 2 : room.x - room.width / 2;
    const sectionCount = Math.max(1, Math.floor(span));
    const sectionWidth = span / sectionCount;
    const index = room.doorPosition === "left" ? 0 : room.doorPosition === "right" ? sectionCount - 1 : Math.round((sectionCount - 1) / 2);
    return start + sectionWidth * (index + 0.5);
  }
  function roomDoorClearanceRect(room) {
    if (!room.hasDoor) return null;
    const center = roomDoorAxisCenter(room);
    const halfOpening = room.doorWidth / 2 + 0.08;
    const swingDepth = Math.max(0.75, room.doorWidth + 0.12);
    const outer = roomRect(room, 0);
    if (room.doorSide === "back") return { x0: center - halfOpening, x1: center + halfOpening, z0: outer.z0 - 0.06, z1: outer.z0 + swingDepth };
    if (room.doorSide === "left") return { x0: outer.x0 - 0.06, x1: outer.x0 + swingDepth, z0: center - halfOpening, z1: center + halfOpening };
    if (room.doorSide === "right") return { x0: outer.x1 - swingDepth, x1: outer.x1 + 0.06, z0: center - halfOpening, z1: center + halfOpening };
    return { x0: center - halfOpening, x1: center + halfOpening, z0: outer.z1 - swingDepth, z1: outer.z1 + 0.06 };
  }
  function roomItemConflict(itemBounds, room) {
    if (!rectsOverlap(itemBounds, roomRect(room, 0))) return null;
    if (!rectInside(itemBounds, roomInteriorRect(room))) return "wall";
    const doorClearance = roomDoorClearanceRect(room);
    return doorClearance && rectsOverlap(itemBounds, doorClearance) ? "door" : null;
  }
  function roomPlacementIssue(candidate, allRooms, items) {
    for (const other of allRooms) {
      if (other.id === candidate.id) continue;
      if (rectsOverlap(roomRect(candidate, 0.04), roomRect(other, 0.04))) return `Overlaps ${other.name}`;
    }
    for (const item of items.filter(isFloorPlacedItem)) {
      const conflict = roomItemConflict(itemRect(item), candidate);
      if (conflict === "wall") return `${item.name} crosses a room wall`;
      if (conflict === "door") return `${item.name} blocks the door clearance`;
    }
    return "";
  }
  function findAvailableRoomPlacement(room, rooms, items, booth) {
    const minX = room.width / 2;
    const maxX = Math.max(minX, booth.width - room.width / 2);
    const minZ = room.depth / 2;
    const maxZ = Math.max(minZ, booth.depth - room.depth / 2);
    const candidates = [
      { x: minX, z: minZ },
      { x: maxX, z: minZ },
      { x: minX, z: maxZ },
      { x: maxX, z: maxZ },
      { x: booth.width / 2, z: booth.depth / 2 }
    ];
    for (let z = minZ; z <= maxZ + 1e-3; z += 0.5) {
      for (let x = minX; x <= maxX + 1e-3; x += 0.5) candidates.push({ x: snapNumber(x), z: snapNumber(z) });
    }
    for (const position of candidates) {
      const candidate = { ...room, ...position };
      if (!roomPlacementIssue(candidate, rooms, items)) return candidate;
    }
    return null;
  }
  function isFloorPlacedItem(item) {
    return (item.kind === "furniture" || item.kind === "asset") && item.shape !== "wall_shelf" && item.shape !== "light" && item.shape !== "rail_light";
  }
  function placementIssuesFor(items, rooms, booth, frontSupports) {
    const issues = [];
    const floorItems = items.filter(isFloorPlacedItem);
    const seen = /* @__PURE__ */ new Set();
    const addIssue = (itemId, message) => {
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
        if (conflict === "wall") addIssue(a.id, `Crosses ${room.name} wall`);
        if (conflict === "door") addIssue(a.id, `Blocks ${room.name} door clearance`);
      }
      const bounds = itemPositionBounds(rotatedItemFootprint(a).width, rotatedItemFootprint(a).depth, booth);
      if (a.x < bounds.minX || a.x > bounds.maxX || a.z < bounds.minZ || a.z > bounds.maxZ) {
        addIssue(a.id, "Outside the usable plan area");
      }
      for (const supportX of frontSupports) {
        const supportLane = {
          x0: supportX - 0.12,
          x1: supportX + 0.12,
          z0: 0,
          z1: booth.depth
        };
        if (rectsOverlap(aRect, supportLane)) addIssue(a.id, "Blocks a structural support rail");
      }
    }
    return issues;
  }
  function availableRoomWallSides(width, depth, x, z, booth) {
    const tolerance = 0.02;
    return ROOM_SIDE_OPTIONS.map((option) => option.value).filter((side) => {
      if (side === "back") return booth.openBack || z - depth / 2 > tolerance;
      if (side === "front") return booth.openFront || z + depth / 2 < booth.depth - tolerance;
      if (side === "left") return booth.openLeft || x - width / 2 > tolerance;
      return booth.openRight || x + width / 2 < booth.width - tolerance;
    });
  }
  function footprintRect(shape, pad = ROOM_ITEM_PAD_M) {
    const size = rotatedItemFootprint({ w: shape.w, d: shape.d, rotationY: shape.rotationY ?? 0 });
    return {
      x0: shape.x - size.width / 2 - pad,
      x1: shape.x + size.width / 2 + pad,
      z0: shape.z - size.depth / 2 - pad,
      z1: shape.z + size.depth / 2 + pad
    };
  }
  function roomItemPlacementReason(shape, room) {
    const conflict = roomItemConflict(footprintRect(shape), room);
    if (conflict === "wall") return `Crosses ${String(room.name || "room")} wall`;
    if (conflict === "door") return `Blocks ${String(room.name || "room")} door clearance`;
    return "";
  }
  function roomInteriorBounds(room) {
    return roomInteriorRect(room);
  }
  function roomContainingPoint(rooms, x, z) {
    for (const room of rooms) {
      const outer = roomRect(room, 0);
      if (x >= outer.x0 && x <= outer.x1 && z >= outer.z0 && z <= outer.z1) return room;
    }
    return null;
  }
  function clampInsideRoom(room, x, z, w, d) {
    const interior = roomInteriorRect(room);
    const spareX = (interior.x1 - interior.x0 - Math.max(0.06, w) - ROOM_ITEM_PAD_M * 2) / 2;
    const spareZ = (interior.z1 - interior.z0 - Math.max(0.06, d) - ROOM_ITEM_PAD_M * 2) / 2;
    const cx = (interior.x0 + interior.x1) / 2;
    const cz = (interior.z0 + interior.z1) / 2;
    return {
      x: spareX <= 0 ? cx : Math.max(cx - spareX, Math.min(cx + spareX, x)),
      z: spareZ <= 0 ? cz : Math.max(cz - spareZ, Math.min(cz + spareZ, z))
    };
  }
  function applyRoomLimits(rooms, x, z, w, d) {
    if (!rooms.length) return { x, z };
    const inside = roomContainingPoint(rooms, x, z);
    if (inside) return clampInsideRoom(inside, x, z, w, d);
    let outX = x;
    let outZ = z;
    for (const room of rooms) {
      const outer = roomRect(room, 0);
      const cx = (outer.x0 + outer.x1) / 2;
      const cz = (outer.z0 + outer.z1) / 2;
      const reachX = (outer.x1 - outer.x0) / 2 + Math.max(0.06, w) / 2 + ROOM_ITEM_PAD_M;
      const reachZ = (outer.z1 - outer.z0) / 2 + Math.max(0.06, d) / 2 + ROOM_ITEM_PAD_M;
      const dx = outX - cx;
      const dz = outZ - cz;
      const overlapX = reachX - Math.abs(dx);
      const overlapZ = reachZ - Math.abs(dz);
      if (overlapX <= 0 || overlapZ <= 0) continue;
      if (overlapX <= overlapZ) outX = cx + (dx < 0 ? -reachX : reachX);
      else outZ = cz + (dz < 0 ? -reachZ : reachZ);
    }
    return { x: outX, z: outZ };
  }
  function clampItemToBooth(booth, x, z, w, d) {
    const bounds = itemPositionBounds(w, d, booth);
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, Number(x) || 0)),
      z: Math.max(bounds.minZ, Math.min(bounds.maxZ, Number(z) || 0))
    };
  }
  function structuralObstacles(booth, frontSupports) {
    return frontSupports.map((supportX) => ({
      x0: supportX - 0.12,
      x1: supportX + 0.12,
      z0: 0,
      z1: booth.depth
    }));
  }
  function placementReason(world, excludeId, shape) {
    const rect = footprintRect(shape);
    for (const zone of structuralObstacles(world.booth, world.frontSupports)) {
      if (rectsOverlap(rect, zone)) return "Blocked by a booth support";
    }
    for (const other of world.items) {
      if (excludeId != null && String(other.id) === String(excludeId)) continue;
      if (!isFloorPlacedItem(other)) continue;
      if (rectsOverlap(rect, itemRect(other))) return `Overlaps ${String(other.name || "another item")}`;
    }
    for (const room of world.rooms) {
      const conflict = roomItemConflict(rect, room);
      if (conflict === "wall") return `Crosses ${String(room.name || "room")} wall`;
      if (conflict === "door") return `Blocks ${String(room.name || "room")} door clearance`;
    }
    return "";
  }
  function roomPlacementReason(candidate, rooms, items) {
    for (const other of rooms) {
      if (String(other.id) === String(candidate.id)) continue;
      if (rectsOverlap(roomRect(candidate, 0.04), roomRect(other, 0.04))) {
        return `Overlaps ${String(other.name || "another room")}`;
      }
    }
    for (const item of items) {
      if (!isFloorPlacedItem(item)) continue;
      const conflict = roomItemConflict(itemRect(item), candidate);
      if (conflict === "wall") return `Crosses ${String(candidate.name || "room")} wall`;
      if (conflict === "door") return `Blocks ${String(candidate.name || "room")} door clearance`;
    }
    return "";
  }
  function footprintOf(item) {
    return rotatedItemFootprint(item);
  }
  function alignedPositions(items, edge) {
    if (items.length < 2) return [];
    const alongX = edge === "left" || edge === "right" || edge === "centre-x";
    const halfOf = (item) => (alongX ? footprintOf(item).width : footprintOf(item).depth) / 2;
    const centreOf = (item) => alongX ? item.x : item.z;
    const low = Math.min(...items.map((item) => centreOf(item) - halfOf(item)));
    const high = Math.max(...items.map((item) => centreOf(item) + halfOf(item)));
    const mid = (low + high) / 2;
    const target = (item) => {
      const half = halfOf(item);
      if (edge === "left" || edge === "back") return low + half;
      if (edge === "right" || edge === "front") return high - half;
      return mid;
    };
    return items.map((item) => ({
      id: item.id,
      x: alongX ? target(item) : item.x,
      z: alongX ? item.z : target(item)
    }));
  }
  function distributedPositions(items, axis) {
    if (items.length < 3) return [];
    const centreOf = (item) => axis === "x" ? item.x : item.z;
    const ordered = [...items].sort((a, b) => centreOf(a) - centreOf(b));
    const first = centreOf(ordered[0]);
    const last = centreOf(ordered[ordered.length - 1]);
    const step = (last - first) / (ordered.length - 1);
    return ordered.map((item, index) => ({
      id: item.id,
      x: axis === "x" ? first + step * index : item.x,
      z: axis === "x" ? item.z : first + step * index
    }));
  }
  return __toCommonJS(workspace_geometry_exports);
})();
