import { useRef, useEffect, useState, useCallback } from 'react';
import type { BoothSystem } from './BoothCanvas';

// ── Minimal config interface — only what the iframe renderer needs ──
interface IframeBoothConfig {
  width?: number;
  depth?: number;
  height?: number;
  system?: BoothSystem;
  companyName?: string;
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
  onItemSelect?: (id: string | null, partId?: string, detail?: any) => void;
  onItemDelete?: (id: string) => void;
  onItemRotate?: (id: string, patch: { rotationY: number }) => void;
  onRoomMove?: (id: string, patch: any) => void;
  onFrontSupportMove?: (positions: number[]) => void;
  onPinRequest?: (partId: string, detail: any) => void;
}

type RequiredIframeConfig = Required<Omit<IframeBoothConfig, 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'fasciaEnabled' | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds' | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove' | 'onFrontSupportMove' | 'onPinRequest'>> & Pick<IframeBoothConfig, 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'fasciaEnabled' | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds' | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove' | 'onFrontSupportMove' | 'onPinRequest'>;

const DEFAULTS: Required<Omit<IframeBoothConfig, 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds' | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove' | 'onFrontSupportMove' | 'onPinRequest'>> = {
  width:        6,
  depth:        3,
  height:       2.5,
  system:       'octanorm',
  companyName:  'Company Name',
  primaryColor: '#1a3a7a',
  wallColor:    '#f8fafc',
  frameColor:   '#b8bdc3',
  fasciaColor:  '#ffffff',
  carpetColor:  '#3b3e44',
  openFront:    true,
  openLeft:     false,
  openRight:    false,
  openBack:     false,
  fasciaEnabled: true,
};

function buildOpenParam(cfg: RequiredIframeConfig): string {
  const open = [
    cfg.openFront  && 'front',
    cfg.openBack   && 'back',
    cfg.openLeft   && 'left',
    cfg.openRight  && 'right',
  ].filter(Boolean) as string[];
  return open.length ? open.join(',') : 'none';
}

function buildSrc(cfg: RequiredIframeConfig): string {
  const bh = Math.max(0.8, cfg.height - 0.30).toFixed(2);
  const params = new URLSearchParams({
    w:      cfg.width.toString(),
    d:      cfg.depth.toString(),
    h:      bh,
    name:   encodeURIComponent(cfg.companyName),
    style:  cfg.system === 'maxima' ? 'maxima' : 'octa',
    wall:   cfg.wallColor ?? '#f8fafc',
    frame:  cfg.frameColor ?? '#b8bdc3',
    fasciaColor: cfg.fasciaColor ?? '#ffffff',
    open:   buildOpenParam(cfg),
    carpet: cfg.carpetColor ?? '#3b3e44',
    fascia: cfg.fasciaEnabled === false ? '0' : '1',
    renderer: 'glb-real-v5',
  });
  return `/booth-render.html?${params.toString()}`;
}

export function BoothIframe({ config }: { config?: IframeBoothConfig }) {
  const cfg: RequiredIframeConfig = { ...DEFAULTS, ...config };
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const configRef = useRef<IframeBoothConfig | undefined>(config);
  const latestPayloadRef = useRef<Record<string, unknown> | null>(null);

  const [src] = useState(() => buildSrc(cfg));

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const buildPayload = useCallback(() => {
    const bh = Math.max(0.8, cfg.height - 0.30).toFixed(2);
    return {
      type:   'boothUpdate',
      w:      cfg.width,
      d:      cfg.depth,
      h:      parseFloat(bh),
      name:   cfg.companyName,
      style:  cfg.system === 'maxima' ? 'maxima' : 'octa',
      wall:   cfg.wallColor ?? '#f8fafc',
      frame:  cfg.frameColor ?? '#b8bdc3',
      fasciaColor: cfg.fasciaColor ?? '#ffffff',
      open:   buildOpenParam(cfg),
      carpet: cfg.carpetColor ?? '#3b3e44',
      placedItems: cfg.placedItems ?? [],
      rooms: cfg.rooms ?? [],
      panelOverrides: cfg.panelOverrides ?? {},
      frontSupportPositions: cfg.frontSupportPositions ?? [],
      fasciaEnabled: cfg.fasciaEnabled !== false,
      fasciaOption: cfg.fasciaOption ?? 'classic',
      lightingPreset: cfg.lightingPreset ?? 'exhibition',
      pins:   cfg.pins ?? [],
      pinMode: cfg.pinMode ?? false,
      invalidItemIds: cfg.invalidItemIds ?? [],
    };
  }, [
    cfg.width, cfg.depth, cfg.height,
    cfg.system, cfg.companyName, cfg.wallColor, cfg.frameColor, cfg.fasciaColor, cfg.carpetColor,
    cfg.openFront, cfg.openBack, cfg.openLeft, cfg.openRight,
    cfg.placedItems, cfg.rooms, cfg.panelOverrides, cfg.frontSupportPositions, cfg.fasciaEnabled, cfg.fasciaOption, cfg.lightingPreset, cfg.pins, cfg.pinMode, cfg.invalidItemIds,
  ]);

  const sendUpdate = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload = buildPayload();
    latestPayloadRef.current = payload;
    win.postMessage(payload, '*');
  }, [
    buildPayload,
  ]);

  useEffect(() => {
    if (ready) sendUpdate();
  }, [ready, sendUpdate]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!event.data) return;
      const bridgeConfig = configRef.current;
      if (event.data.type === 'boothRendererReady') {
        setReady(true);
        setTimeout(sendUpdate, 0);
        return;
      }
      if (event.data.type === 'boothUpdateAck') {
        return;
      }
      if (event.data.type === 'workspaceItemSelected') {
        bridgeConfig?.onItemSelect?.(event.data.id == null ? null : String(event.data.id), event.data.partId == null ? undefined : String(event.data.partId), event.data);
        return;
      }
      if (event.data.type === 'workspaceItemMoved') {
        bridgeConfig?.onItemMove?.(String(event.data.id), {
          x: Number(event.data.x),
          z: Number(event.data.z),
        });
        return;
      }
      if (event.data.type === 'workspaceRoomMoved') {
        bridgeConfig?.onRoomMove?.(String(event.data.id), {
        x: Number(event.data.x),
        z: Number(event.data.z),
      });
        return;
      }
      if (event.data.type === 'workspaceRoomPatched') {
        const patch: Record<string, unknown> = {};
        if (event.data.doorOpen != null) patch.doorOpen = Boolean(event.data.doorOpen);
        if (typeof event.data.doorSwing === 'string') patch.doorSwing = event.data.doorSwing;
        if (Object.keys(patch).length) bridgeConfig?.onRoomMove?.(String(event.data.id), patch);
        return;
      }
      if (event.data.type === 'workspaceFrontSupportsMoved') {
        bridgeConfig?.onFrontSupportMove?.(Array.isArray(event.data.positions) ? event.data.positions.map(Number).filter(Number.isFinite) : []);
        return;
      }
      if (event.data.type === 'workspaceItemDeleteRequested') {
        if (event.data.id != null) bridgeConfig?.onItemDelete?.(String(event.data.id));
        return;
      }
      if (event.data.type === 'workspaceItemRotated') {
        if (event.data.id != null) bridgeConfig?.onItemRotate?.(String(event.data.id), { rotationY: Number(event.data.rotationY) });
        return;
      }
      if (event.data.type === 'pinRequested') {
        if (event.data.partId != null) bridgeConfig?.onPinRequest?.(String(event.data.partId), event.data);
        return;
      }
    };
    window.addEventListener('message', handler);
    return () => {
      window.removeEventListener('message', handler);
      // Blank the iframe src on unmount so the WebGL context is released immediately
      // rather than waiting for GC.
      const iframe = iframeRef.current;
      if (iframe) iframe.src = 'about:blank';
    };
  }, [sendUpdate]);

  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="Booth Renderer"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      onLoad={() => { setReady(true); setTimeout(sendUpdate, 50); }}
    />
  );
}
