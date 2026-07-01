import { BoothIframe } from './BoothIframe';

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
  placedItems?: any[];
  rooms?: any[];
  panelOverrides?: Record<string, any>;
  frontSupportPositions?: number[];
  fasciaEnabled?: boolean;
  fasciaOption?: string;
  lightingPreset?: string;
  pins?: any[];
  pinMode?: boolean;
  invalidItemIds?: string[];
  onItemMove?: (id: string, patch: { x: number; z: number }) => void;
  onItemSelect?: (id: string | null, partId?: string | null, detail?: any) => void;
  onItemDelete?: (id: string) => void;
  onItemRotate?: (id: string, patch: { rotationY: number }) => void;
  onRoomMove?: (id: string, patch: any) => void;
  onFrontSupportMove?: (positions: number[]) => void;
  onPinRequest?: (partId: string, detail: any) => void;
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
      panelOverrides: cfg.panelOverrides,
      frontSupportPositions: cfg.frontSupportPositions,
      fasciaEnabled: cfg.fasciaEnabled,
      fasciaOption: cfg.fasciaOption,
      lightingPreset: cfg.lightingPreset,
      pins:        cfg.pins,
      pinMode:     cfg.pinMode,
      invalidItemIds: cfg.invalidItemIds,
      onItemMove:  cfg.onItemMove,
      onItemSelect: cfg.onItemSelect,
      onItemDelete: cfg.onItemDelete,
      onItemRotate: cfg.onItemRotate,
      onRoomMove:  cfg.onRoomMove,
      onFrontSupportMove: cfg.onFrontSupportMove,
      onPinRequest: cfg.onPinRequest,
    }} />
  );
}
