/**
 * Canonical workspace transform precision and snapping rules (WS-03).
 *
 * These values were previously duplicated as unlabelled literals in two places
 * that must agree:
 *
 *   - `src/pages/pm/PMWorkspace.tsx` — React state, numeric inputs, and the
 *     placement/duplication paths, via `snapNumber(value, step)`.
 *   - `booth-render.html` — the standalone Three.js iframe renderer, which
 *     snaps during pointer drags with expressions like
 *     `Math.round(next * 20) / 20`.
 *
 * `Math.round(v * 20) / 20` is not visibly "a 5 cm grid", so the two could
 * drift apart silently: dragging an item in 3D and typing its position into
 * the inspector would then land on different grids, and nothing would fail.
 *
 * This module is the single source of truth for the React side.
 * `scripts/check-transform-constants.mjs` asserts that the renderer's inline
 * expressions still encode the same numbers, and fails the release gate when
 * they diverge. If you change a value here, the gate will tell you which
 * renderer expression to update.
 *
 * All distances are metres.
 */

/** Grid furniture snaps to when dragged or positioned numerically. 5 cm. */
export const FURNITURE_SNAP_M = 0.05;

/**
 * Grid room origins snap to. 5 cm, the same grid furniture uses.
 *
 * This was 50 cm, which let a room stop only at half-metre stations: it could
 * rarely be lined up with anything already placed, and a room whose own size
 * was not a multiple of half a metre could not be pushed tight to a booth edge
 * except through the corner snap below.
 */
export const ROOM_SNAP_M = 0.05;

/** Grid room width/depth snap to. Rooms are built from 1 m wall sections. */
export const ROOM_DIMENSION_SNAP_M = 1;

/**
 * Distance from a booth edge within which a dragged room jumps flush to it.
 * Much larger than ROOM_SNAP_M, so a corner is reachable by aim rather than by
 * pixel precision even though the grid underneath it is fine.
 */
export const ROOM_CORNER_SNAP_M = 0.32;

/**
 * Minimum gap kept between furniture and the booth perimeter.
 *
 * Zero: furniture is allowed to sit flush against a wall and into a corner,
 * because that is where counters, cabinets and showcases actually go. This was
 * 0.25, which held every item a visible 25 cm off every wall and made corners
 * unreachable - two walls at once was not expressible at all.
 *
 * The renderer encodes the same number; `pnpm run workspace:transform` fails if
 * the two drift apart, which is how this change was caught mid-edit.
 */
export const ITEM_WALL_CLEARANCE_M = 0;

/** Offset applied to a duplicated item so it does not sit exactly on its source. */
export const DUPLICATE_OFFSET_M = 0.35;

/**
 * Decimal places retained after snapping. Snapping divides and re-multiplies,
 * so results like 1.4000000000000001 are routine; rounding here keeps
 * persisted payloads and equality checks stable.
 */
export const POSITION_DECIMALS = 3;

/** Clamp `value` into [min, max]. */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Snap `value` to the nearest multiple of `step`, at POSITION_DECIMALS
 * precision. Defaults to the room grid, matching the previous default.
 */
export function snapNumber(value: number, step: number = ROOM_SNAP_M): number {
  return Number((Math.round(value / step) * step).toFixed(POSITION_DECIMALS));
}

/**
 * Snap a value to the furniture grid and clamp it to the given bounds — the
 * combination used by every furniture placement path.
 */
export function snapItemCoordinate(value: number, min: number, max: number): number {
  return clampNumber(snapNumber(value, FURNITURE_SNAP_M), min, max);
}
