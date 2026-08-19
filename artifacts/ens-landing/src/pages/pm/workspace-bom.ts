import { availableRoomWallSides } from "./workspace-geometry";
import { CATALOG, ROOM_UNIT_PRICE, STRUCT_UNIT_PRICE } from "./workspace-constants";
import type { BoothState, CatItem, WorkspacePlacedItem, WorkspaceRoom } from "./workspace-model";

// Bill of materials and quote arithmetic for the booth workspace, split out of
// PMWorkspace.tsx. This is the money math — it produces the number the agency
// quotes from — so it lives in one pure, testable place with no React in it.

export interface StructBomLine {
  name: string;
  sku: string;
  qty: number;
  unit: string;
  weight: number;
  unitPrice: number;
}

export interface RoomBomLine extends StructBomLine {
  roomId: string;
  roomName: string;
  notes: string;
}

/** Contingency added on top of every quote subtotal. */
export const QUOTE_ALLOWANCE_RATE = 0.1;

/** Module pitch in metres: Maxima builds on a 2 m grid, Octanorm on 1 m. */
export function moduleSize(booth: BoothState) {
  return booth.system === 'maxima' ? 2 : 1;
}

/** Post grid implied by the booth footprint — posts sit at every module corner. */
export function structuralGrid(booth: BoothState) {
  const mod = moduleSize(booth);
  return { cols: Math.ceil(booth.width / mod) + 1, rows: Math.ceil(booth.depth / mod) + 1 };
}

/** Wall panels are only built on closed sides; every open side drops its run. */
export function wallPanelQty(booth: BoothState) {
  const { cols, rows } = structuralGrid(booth);
  return Math.max(0,
    (booth.openFront ? 0 : cols - 1) +
    (booth.openBack ? 0 : cols - 1) +
    (booth.openLeft ? 0 : rows - 1) +
    (booth.openRight ? 0 : rows - 1),
  );
}

/** Classic fascia bands the front and back only; the others wrap the depth too. */
export function fasciaBoardQty(booth: BoothState) {
  if (!booth.fasciaEnabled) return 0;
  const mod = moduleSize(booth);
  const { cols } = structuralGrid(booth);
  return booth.fasciaOption === 'classic'
    ? (cols - 1) * 2
    : (cols - 1) * 2 + Math.ceil(booth.depth / mod) * 2;
}

/** Structural take-off for the shell: posts, rails, panels, fascia, feet. */
export function structuralBom(booth: BoothState): StructBomLine[] {
  const isMax = booth.system === 'maxima';
  const prefix = isMax ? 'MAX' : 'OCT';
  const { cols, rows } = structuralGrid(booth);
  // Octanorm needs a rail per module edge top and bottom; Maxima spans one.
  const railsPerEdge = isMax ? 1 : 2;
  return [
    { name: 'Upright Post',    sku: `${prefix}-UP-01`, qty: cols * rows,                                                    unit: 'ea', weight: 4.5, unitPrice: STRUCT_UNIT_PRICE.post },
    { name: 'Horizontal Rail', sku: `${prefix}-HR-01`, qty: (cols - 1) * rows * railsPerEdge + (rows - 1) * cols * railsPerEdge, unit: 'ea', weight: 2.2, unitPrice: STRUCT_UNIT_PRICE.rail },
    { name: 'Wall Panel',      sku: `${prefix}-WP-01`, qty: wallPanelQty(booth),                                            unit: 'ea', weight: 3.8, unitPrice: STRUCT_UNIT_PRICE.panel },
    { name: 'Fascia Board',    sku: `FAS-${booth.fasciaOption.toUpperCase()}-01`, qty: fasciaBoardQty(booth),               unit: 'ea', weight: 1.4, unitPrice: STRUCT_UNIT_PRICE.fascia },
    { name: 'Base Foot',       sku: `${prefix}-BF-01`, qty: cols * rows,                                                    unit: 'ea', weight: 1.2, unitPrice: STRUCT_UNIT_PRICE.foot },
  ];
}

/** Glass and frosted room walls cost more per panel than plain white. */
function wallFinishMultiplier(finish: WorkspaceRoom['wallFinish']) {
  return finish === 'glass' ? 1.5 : finish === 'frosted' ? 1.35 : finish === 'dark' ? 1.1 : 1;
}

/** Material take-off for one room: profile, walls, door, floor, ceiling, graphic. */
export function roomBomFor(room: WorkspaceRoom, booth: BoothState): RoomBomLine[] {
  const wallSides = availableRoomWallSides(room.width, room.depth, room.x, room.z, booth);
  const wallLengths = wallSides.map(side => ({ side, length: side === 'front' || side === 'back' ? room.width : room.depth }));
  const doorIsBuilt = room.hasDoor && wallSides.includes(room.doorSide);

  const panelQty = wallLengths.reduce((total, wall) => {
    const opening = doorIsBuilt && wall.side === room.doorSide ? room.doorWidth : 0;
    return total + Math.ceil(Math.max(0, wall.length - opening));
  }, 0);

  const totalWallLength = wallLengths.reduce((total, wall) => total + wall.length, 0);
  const verticalCount = wallLengths.reduce((total, wall) => total + Math.ceil(wall.length) + 1, 0);
  const doorHeight = Math.min(2.1, room.height * 0.88);
  const profileLength = Math.round((totalWallLength * 2 + verticalCount * room.height + (doorIsBuilt ? doorHeight * 2 + room.doorWidth : 0)) * 10) / 10;
  const floorArea = Math.round(room.width * room.depth * 10) / 10;
  const graphicSpan = room.designWall === 'front' || room.designWall === 'back' ? room.width : room.depth;
  const graphicArea = Math.round(Math.max(0, graphicSpan - 0.16) * Math.max(0, room.height - 0.28) * 10) / 10;
  const base = { roomId: room.id, roomName: room.name };

  return [
    { ...base, name: 'Room Frame Profile', sku: 'ROOM-PROFILE-01', qty: profileLength, unit: 'lm', weight: 0.95, unitPrice: ROOM_UNIT_PRICE.profile, notes: `${wallSides.join(', ') || 'shared shell'} walls` },
    { ...base, name: `${room.wallFinish} Room Wall Panel`, sku: `ROOM-WALL-${room.wallFinish.toUpperCase()}`, qty: panelQty, unit: 'ea', weight: 3.8, unitPrice: Math.round(ROOM_UNIT_PRICE.panel * wallFinishMultiplier(room.wallFinish)), notes: `${room.height.toFixed(1)} m high` },
    ...(doorIsBuilt ? [{ ...base, name: 'Room Door Kit', sku: 'ROOM-DOOR-01', qty: 1, unit: 'kit', weight: 18, unitPrice: ROOM_UNIT_PRICE.door, notes: `${room.doorSide} / ${room.doorWidth.toFixed(2)} m / ${room.doorSwing}` }] : []),
    { ...base, name: 'Room Floor Finish', sku: 'ROOM-FLOOR-01', qty: floorArea, unit: 'm2', weight: 1.5, unitPrice: ROOM_UNIT_PRICE.floor, notes: room.floorColor },
    ...(room.hasCeiling ? [{ ...base, name: 'Room Ceiling Panel', sku: 'ROOM-CEILING-01', qty: floorArea, unit: 'm2', weight: 4.5, unitPrice: ROOM_UNIT_PRICE.ceiling, notes: `${room.width} x ${room.depth} m` }] : []),
    ...(room.designImageUrl ? [{ ...base, name: 'Printed Room Wall Graphic', sku: 'ROOM-GRAPHIC-01', qty: graphicArea, unit: 'm2', weight: 0.2, unitPrice: ROOM_UNIT_PRICE.graphic, notes: `${room.designWall} wall / ${room.designFit}` }] : []),
  ].filter(line => line.qty > 0);
}

/** Room take-off across every room in the booth. */
export function roomBom(rooms: WorkspaceRoom[], booth: BoothState): RoomBomLine[] {
  return rooms.flatMap(room => roomBomFor(room, booth));
}

/** Catalog lookup by id across every category. */
export function catalogItemFor(catalogId: string): CatItem | undefined {
  return Object.values(CATALOG).reduce<CatItem | undefined>(
    (found, items) => found || items.find(item => item.id === catalogId),
    undefined,
  );
}

export interface QuoteTotals {
  structWeight: number;
  structSubtotal: number;
  roomWeight: number;
  roomSubtotal: number;
  placedSubtotal: number;
  /** Placed items whose catalog entry carries no price — quoted as TBD. */
  unpricedItems: number;
  fasciaSubtotal: number;
  quoteSubtotal: number;
  quoteAllowance: number;
  quoteTotal: number;
  quoteTotalCents: number;
}

/**
 * Roll the three take-offs plus the fascia option into one quote.
 *
 * `fasciaSubtotal` is passed in rather than derived: the fascia price comes
 * from the selected FASCIA_OPTIONS entry, which the component already resolves.
 */
export function quoteTotals(input: {
  structItems: StructBomLine[];
  roomItems: RoomBomLine[];
  placedItems: WorkspacePlacedItem[];
  fasciaSubtotal: number;
  priceFor?: (catalogId: string) => number | undefined;
}): QuoteTotals {
  const { structItems, roomItems, placedItems, fasciaSubtotal } = input;
  const priceFor = input.priceFor ?? ((catalogId: string) => catalogItemFor(catalogId)?.price);

  const sum = (lines: StructBomLine[], pick: (line: StructBomLine) => number) => lines.reduce((total, line) => total + pick(line), 0);

  const structWeight = sum(structItems, line => line.qty * line.weight);
  const structSubtotal = sum(structItems, line => line.qty * line.unitPrice);
  const roomWeight = sum(roomItems, line => line.qty * line.weight);
  const roomSubtotal = sum(roomItems, line => line.qty * line.unitPrice);
  const placedSubtotal = placedItems.reduce((total, item) => total + (priceFor(item.catalogId) || 0) * item.qty, 0);
  const unpricedItems = placedItems.filter(item => !priceFor(item.catalogId)).length;

  const quoteSubtotal = structSubtotal + roomSubtotal + placedSubtotal + fasciaSubtotal;
  const quoteAllowance = quoteSubtotal * QUOTE_ALLOWANCE_RATE;
  const quoteTotal = quoteSubtotal + quoteAllowance;

  return {
    structWeight, structSubtotal, roomWeight, roomSubtotal,
    placedSubtotal, unpricedItems, fasciaSubtotal,
    quoteSubtotal, quoteAllowance, quoteTotal,
    quoteTotalCents: Math.round(quoteTotal * 100),
  };
}
