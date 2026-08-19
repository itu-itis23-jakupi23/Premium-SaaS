import { describe, expect, it } from "vitest";
import {
  QUOTE_ALLOWANCE_RATE,
  fasciaBoardQty,
  moduleSize,
  quoteTotals,
  roomBomFor,
  structuralBom,
  structuralGrid,
  wallPanelQty,
} from "./workspace-bom";
import { ROOM_UNIT_PRICE, STRUCT_UNIT_PRICE } from "./workspace-constants";
import type { BoothState, WorkspacePlacedItem, WorkspaceRoom } from "./workspace-model";

const booth = (over: Partial<BoothState> = {}): BoothState => ({
  width: 6, depth: 4, height: 3, system: 'octanorm', companyName: 'ACME',
  openFront: true, openBack: false, openLeft: false, openRight: false,
  fasciaEnabled: true, fasciaOption: 'classic', ...over,
});

const room = (over: Partial<WorkspaceRoom> = {}): WorkspaceRoom => ({
  id: 'r1', name: 'Storage', width: 2, depth: 2, height: 2.5, x: 3, z: 2,
  hasDoor: false, hasCeiling: false, doorSide: 'front', doorWidth: 0.9,
  doorPosition: 'center', doorSwing: 'left-in', doorOpen: false,
  wallFinish: 'white', floorColor: '#111', locked: false,
  designWall: 'front', designFit: 'cover', ...over,
});

const placed = (over: Partial<WorkspacePlacedItem> = {}): WorkspacePlacedItem => ({
  id: 'p1', catalogId: 'c1', name: 'Chair', sku: 'CH-1', qty: 1,
  w: 0.5, d: 0.5, h: 0.9, color: '#000', weight: 6,
  x: 1, z: 1, rotation: 0, kind: 'furniture', ...over,
});

const lineFor = (booth: BoothState, name: string) => {
  const line = structuralBom(booth).find(item => item.name === name);
  if (!line) throw new Error(`missing BOM line: ${name}`);
  return line;
};

describe('structural grid', () => {
  it('uses a 1 m module for Octanorm and 2 m for Maxima', () => {
    expect(moduleSize(booth())).toBe(1);
    expect(moduleSize(booth({ system: 'maxima' }))).toBe(2);
  });

  it('puts a post at every module corner', () => {
    // 6 x 4 m on a 1 m grid = 7 x 5 posts.
    expect(structuralGrid(booth())).toEqual({ cols: 7, rows: 5 });
    // The same footprint on a 2 m grid = 4 x 3.
    expect(structuralGrid(booth({ system: 'maxima' }))).toEqual({ cols: 4, rows: 3 });
  });

  it('rounds a partial module up to a whole bay', () => {
    expect(structuralGrid(booth({ width: 6.5 }))).toEqual({ cols: 8, rows: 5 });
  });

  it('prices posts and feet off the same grid', () => {
    const b = booth();
    const { cols, rows } = structuralGrid(b);
    expect(lineFor(b, 'Upright Post').qty).toBe(cols * rows);
    expect(lineFor(b, 'Base Foot').qty).toBe(cols * rows);
    expect(lineFor(b, 'Upright Post').unitPrice).toBe(STRUCT_UNIT_PRICE.post);
  });

  it('tags SKUs with the booth system', () => {
    expect(lineFor(booth(), 'Upright Post').sku).toBe('OCT-UP-01');
    expect(lineFor(booth({ system: 'maxima' }), 'Upright Post').sku).toBe('MAX-UP-01');
  });
});

describe('wall panels', () => {
  it('skips the run on every open side', () => {
    // 7 cols / 5 rows: a closed front or back is 6 panels, a closed side is 4.
    expect(wallPanelQty(booth({ openFront: true, openBack: true, openLeft: true, openRight: true }))).toBe(0);
    expect(wallPanelQty(booth({ openFront: false, openBack: false, openLeft: false, openRight: false }))).toBe(20);
    expect(wallPanelQty(booth())).toBe(14); // open front only
  });

  it('never returns a negative quantity for a sub-module booth', () => {
    expect(wallPanelQty(booth({ width: 0.5, depth: 0.5, openFront: false, openBack: false, openLeft: false, openRight: false }))).toBeGreaterThanOrEqual(0);
  });
});

describe('fascia', () => {
  it('bands only the front and back when classic', () => {
    expect(fasciaBoardQty(booth({ fasciaOption: 'classic' }))).toBe(12);
  });

  it('wraps the depth as well when full', () => {
    expect(fasciaBoardQty(booth({ fasciaOption: 'full' }))).toBe(20);
  });

  it('drops to zero when disabled', () => {
    expect(fasciaBoardQty(booth({ fasciaEnabled: false }))).toBe(0);
    expect(lineFor(booth({ fasciaEnabled: false }), 'Fascia Board').qty).toBe(0);
  });
});

describe('room take-off', () => {
  it('omits walls the booth shell already provides', () => {
    // Flush into the back-left corner: only front and right walls get built.
    const flush = roomBomFor(room({ x: 1, z: 1 }), booth());
    const profile = flush.find(line => line.sku === 'ROOM-PROFILE-01');
    expect(profile?.notes).toBe('front, right walls');
  });

  it('bills a door kit only when the door sits on a built wall', () => {
    const withDoor = roomBomFor(room({ hasDoor: true, doorSide: 'front' }), booth());
    expect(withDoor.find(line => line.sku === 'ROOM-DOOR-01')?.unitPrice).toBe(ROOM_UNIT_PRICE.door);

    // A door on a wall the shell provides is not built, so it is not billed.
    const sharedWall = roomBomFor(room({ x: 1, z: 1, hasDoor: true, doorSide: 'back' }), booth());
    expect(sharedWall.find(line => line.sku === 'ROOM-DOOR-01')).toBeUndefined();
  });

  it('subtracts the door opening from the panel run, then rounds up to whole panels', () => {
    const panels = (over: Partial<WorkspaceRoom>) =>
      roomBomFor(room(over), booth()).find(l => l.sku === 'ROOM-WALL-WHITE')!.qty;

    // All four 2 m walls are built, so a bare room is 4 x 2 = 8 panels.
    expect(panels({})).toBe(8);

    // A 0.9 m door leaves 1.1 m of wall, which still needs two panels: panels
    // are whole units, so a narrow opening is absorbed by the rounding.
    expect(panels({ hasDoor: true, doorSide: 'front', doorWidth: 0.9 })).toBe(8);

    // A 1.2 m door leaves 0.8 m, which fits in one panel — the run drops.
    expect(panels({ hasDoor: true, doorSide: 'front', doorWidth: 1.2 })).toBe(7);
  });

  it('prices glass walls above white', () => {
    const white = roomBomFor(room({ wallFinish: 'white' }), booth()).find(l => l.name.includes('Wall Panel'))!;
    const glass = roomBomFor(room({ wallFinish: 'glass' }), booth()).find(l => l.name.includes('Wall Panel'))!;
    expect(glass.unitPrice).toBe(Math.round(ROOM_UNIT_PRICE.panel * 1.5));
    expect(glass.unitPrice).toBeGreaterThan(white.unitPrice);
  });

  it('bills ceiling and graphic only when present', () => {
    const bare = roomBomFor(room(), booth()).map(l => l.sku);
    expect(bare).not.toContain('ROOM-CEILING-01');
    expect(bare).not.toContain('ROOM-GRAPHIC-01');

    const dressed = roomBomFor(room({ hasCeiling: true, designImageUrl: 'https://x/y.png' }), booth()).map(l => l.sku);
    expect(dressed).toContain('ROOM-CEILING-01');
    expect(dressed).toContain('ROOM-GRAPHIC-01');
  });

  it('drops zero-quantity lines entirely', () => {
    expect(roomBomFor(room(), booth()).every(line => line.qty > 0)).toBe(true);
  });
});

describe('quote totals', () => {
  const priceFor = (id: string) => (id === 'priced' ? 100 : undefined);

  it('adds the allowance on top of the subtotal', () => {
    const t = quoteTotals({
      structItems: [{ name: 'x', sku: 'x', qty: 2, unit: 'ea', weight: 1, unitPrice: 50 }],
      roomItems: [], placedItems: [], fasciaSubtotal: 0,
    });
    expect(t.quoteSubtotal).toBe(100);
    expect(t.quoteAllowance).toBeCloseTo(100 * QUOTE_ALLOWANCE_RATE);
    expect(t.quoteTotal).toBeCloseTo(110);
  });

  it('rolls structure, rooms, placed items and fascia into one subtotal', () => {
    const t = quoteTotals({
      structItems: [{ name: 's', sku: 's', qty: 1, unit: 'ea', weight: 2, unitPrice: 100 }],
      roomItems: [{ roomId: 'r1', roomName: 'R', notes: '', name: 'r', sku: 'r', qty: 2, unit: 'm2', weight: 3, unitPrice: 50 }],
      placedItems: [placed({ catalogId: 'priced', qty: 2 })],
      fasciaSubtotal: 120,
      priceFor,
    });
    expect(t.structSubtotal).toBe(100);
    expect(t.roomSubtotal).toBe(100);
    expect(t.placedSubtotal).toBe(200);
    expect(t.quoteSubtotal).toBe(520);
    expect(t.quoteTotal).toBeCloseTo(572);
  });

  it('counts unpriced catalog items instead of charging zero silently', () => {
    const t = quoteTotals({
      structItems: [], roomItems: [], fasciaSubtotal: 0, priceFor,
      placedItems: [placed({ id: 'a', catalogId: 'priced' }), placed({ id: 'b', catalogId: 'unknown' })],
    });
    expect(t.placedSubtotal).toBe(100);
    expect(t.unpricedItems).toBe(1);
  });

  it('multiplies weights by quantity for both take-offs', () => {
    const t = quoteTotals({
      structItems: [{ name: 's', sku: 's', qty: 3, unit: 'ea', weight: 4.5, unitPrice: 0 }],
      roomItems: [{ roomId: 'r', roomName: 'R', notes: '', name: 'r', sku: 'r', qty: 2, unit: 'm2', weight: 1.5, unitPrice: 0 }],
      placedItems: [], fasciaSubtotal: 0,
    });
    expect(t.structWeight).toBeCloseTo(13.5);
    expect(t.roomWeight).toBeCloseTo(3);
  });

  it('reports cents as a rounded integer for persistence', () => {
    const t = quoteTotals({
      structItems: [{ name: 'x', sku: 'x', qty: 1, unit: 'ea', weight: 0, unitPrice: 33.33 }],
      roomItems: [], placedItems: [], fasciaSubtotal: 0,
    });
    // 33.33 + 10% = 36.663 -> 3666 cents, not a float.
    expect(t.quoteTotalCents).toBe(3666);
    expect(Number.isInteger(t.quoteTotalCents)).toBe(true);
  });

  it('quotes an empty booth at zero rather than NaN', () => {
    const t = quoteTotals({ structItems: [], roomItems: [], placedItems: [], fasciaSubtotal: 0 });
    expect(t.quoteTotal).toBe(0);
    expect(t.quoteTotalCents).toBe(0);
    expect(t.unpricedItems).toBe(0);
  });
});
