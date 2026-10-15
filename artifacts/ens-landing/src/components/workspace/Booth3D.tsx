import { BoothIframe, type CatalogDragItem } from './BoothIframe';

import type { WorkspacePlacedItem, WorkspaceRoom } from "@/lib/platform-api";

// The renderer boundary. `placedItems` and `rooms` have real types - the same
// ones the API and the validator use - so they are typed here rather than left
// as any[]: this is the seam the three renderers meet at, and a shape mismatch
// across it has produced live bugs before. `detail` stays `unknown` because it
// genuinely comes from the untyped renderer bundle and the caller has to narrow
// it; `unknown` says that, `any` only hides it.

// ─────────────────────────────────────────────────────────────────
// Types — kept compatible with existing callers
// ─────────────────────────────────────────────────────────────────
export type BoothSystem = 'octanorm' | 'maxima';

export interface BoothConfig3D {
  width: number;
  depth: number;
  height: number;
  system: BoothSystem;
  companyName: string;
  primaryColor?: string;
  wallColor?: string;
  frameColor?: string;
  fasciaColor?: string;
  carpetColor?: string;
  openFront?: boolean;
  openLeft?: boolean;
  openRight?: boolean;
  openBack?: boolean;
  placedItems?: WorkspacePlacedItem[];
  rooms?: WorkspaceRoom[];
  /** Items selected in the workspace; dragging any of them moves all of them. */
  selectedItemIds?: string[];
  /** Room selected in the workspace panel; opens that room up in the renderer. */
  activeRoomId?: string;
  panelOverrides?: Record<string, unknown>;
  frontSupportPositions?: number[];
  suppressedDefaultPositions?: number[];
  fasciaEnabled?: boolean;
  fasciaOption?: string;
  lightingPreset?: string;
  pins?: unknown[];
  pinMode?: boolean;
  invalidItemIds?: string[];
  catalogDragItem?: CatalogDragItem | null;
  onItemMove?: (id: string, patch: { x: number; z: number }) => void;
  /** Fired once when a drag of an item, room or support is released. */
  onGestureEnd?: (kind: string) => void;
  /** Keyboard shortcut pressed while focus was inside the renderer. */
  onShortcut?: (action: string) => void;
  onItemSelect?: (id: string | null, partId?: string | null, detail?: unknown) => void;
  onItemDelete?: (id: string) => void;
  onItemRotate?: (id: string, patch: { rotationY: number }) => void;
  onRoomMove?: (id: string, patch: Partial<WorkspaceRoom>) => void;
  onFrontSupportMove?: (positions: number[], suppressedDefaultPositions: number[]) => void;
  onPinRequest?: (partId: string, detail: unknown) => void;
  onCatalogItemDrop?: (catalogId: string, position: { x: number; z: number }) => void;
  onCatalogItemDropRejected?: (catalogId: string, reason: string) => void;
}

const DEFAULT: BoothConfig3D = {
  width: 6,
  depth: 3,
  height: 2.5,
  system: 'octanorm',
  companyName: 'COMPANY NAME',
  primaryColor: '#1a3a7a',
  wallColor: '#f8fafc',
  frameColor: '#b8bdc3',
  fasciaColor: '#ffffff',
  carpetColor: '#3b3e44',
  openFront: true,
  openLeft: false,
  openRight: false,
  openBack: false,
};

// ─────────────────────────────────────────────────────────────────
// Booth3D — renders the high-quality perspective SVG renderer
// via an iframe (light-background, brushed-aluminum aesthetic,
// drag-to-orbit, click-to-inspect, animated view presets)
// ─────────────────────────────────────────────────────────────────
export function Booth3D({ config }: { config?: Partial<BoothConfig3D> }) {
  const cfg: BoothConfig3D = { ...DEFAULT, ...config };
  return (
    <BoothIframe config={{
      width:       cfg.width,
      depth:       cfg.depth,
      height:      cfg.height,
      system:      cfg.system,
      companyName: cfg.companyName,
      primaryColor:cfg.primaryColor,
      wallColor:   cfg.wallColor,
      frameColor:  cfg.frameColor,
      fasciaColor: cfg.fasciaColor,
      carpetColor: cfg.carpetColor,
      openFront:   cfg.openFront,
      openLeft:    cfg.openLeft,
      openRight:   cfg.openRight,
      openBack:    cfg.openBack,
      placedItems: cfg.placedItems,
      rooms:       cfg.rooms,
      selectedItemIds: cfg.selectedItemIds,
      activeRoomId: cfg.activeRoomId,
      panelOverrides: cfg.panelOverrides,
      frontSupportPositions: cfg.frontSupportPositions,
      suppressedDefaultPositions: cfg.suppressedDefaultPositions,
      fasciaEnabled: cfg.fasciaEnabled,
      fasciaOption: cfg.fasciaOption,
      lightingPreset: cfg.lightingPreset,
      pins:        cfg.pins,
      pinMode:     cfg.pinMode,
      invalidItemIds: cfg.invalidItemIds,
      catalogDragItem: cfg.catalogDragItem,
      onItemMove:  cfg.onItemMove,
      onGestureEnd: cfg.onGestureEnd,
      onShortcut: cfg.onShortcut,
      onItemSelect: cfg.onItemSelect,
      onItemDelete: cfg.onItemDelete,
      onItemRotate: cfg.onItemRotate,
      onRoomMove:  cfg.onRoomMove,
      onFrontSupportMove: cfg.onFrontSupportMove,
      onPinRequest: cfg.onPinRequest,
      onCatalogItemDrop: cfg.onCatalogItemDrop,
      onCatalogItemDropRejected: cfg.onCatalogItemDropRejected,
    }} />
  );
}
