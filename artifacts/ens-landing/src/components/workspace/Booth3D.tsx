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
  carpetColor?: string;
  openFront?: boolean;
  openLeft?: boolean;
  openRight?: boolean;
  openBack?: boolean;
}

const DEFAULT: BoothConfig3D = {
  width: 6,
  depth: 3,
  height: 2.5,
  system: 'octanorm',
  companyName: 'COMPANY NAME',
  primaryColor: '#1a3a7a',
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
      carpetColor: cfg.carpetColor,
      openFront:   cfg.openFront,
      openLeft:    cfg.openLeft,
      openRight:   cfg.openRight,
      openBack:    cfg.openBack,
    }} />
  );
}
