import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
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
  suppressedDefaultPositions?: number[];
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
  onFrontSupportMove?: (positions: number[], suppressedDefaultPositions: number[]) => void;
  onPinRequest?: (partId: string, detail: any) => void;
}

type RequiredIframeConfig = Required<Omit<IframeBoothConfig, 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'suppressedDefaultPositions' | 'fasciaEnabled' | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds' | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove' | 'onFrontSupportMove' | 'onPinRequest'>> & Pick<IframeBoothConfig, 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'suppressedDefaultPositions' | 'fasciaEnabled' | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds' | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove' | 'onFrontSupportMove' | 'onPinRequest'>;

const DEFAULTS: Required<Omit<IframeBoothConfig, 'placedItems' | 'rooms' | 'panelOverrides' | 'frontSupportPositions' | 'suppressedDefaultPositions' | 'fasciaOption' | 'lightingPreset' | 'pins' | 'pinMode' | 'invalidItemIds' | 'onItemMove' | 'onItemSelect' | 'onItemDelete' | 'onItemRotate' | 'onRoomMove' | 'onFrontSupportMove' | 'onPinRequest'>> = {
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

const RENDERER_TIMEOUT_MS = 12_000;

export function BoothIframe({ config }: { config?: IframeBoothConfig }) {
  const cfg: RequiredIframeConfig = { ...DEFAULTS, ...config };
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const configRef = useRef<IframeBoothConfig | undefined>(config);
  const latestPayloadRef = useRef<Record<string, unknown> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const src = useMemo(() => buildSrc(cfg), [
    cfg.width,
    cfg.depth,
    cfg.height,
    cfg.system,
    cfg.companyName,
    cfg.wallColor,
    cfg.frameColor,
    cfg.fasciaColor,
    cfg.carpetColor,
    cfg.openFront,
    cfg.openBack,
    cfg.openLeft,
    cfg.openRight,
    cfg.fasciaEnabled,
  ]);

  useEffect(() => {
    setReady(false);
    setRendererError(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!ready) setRendererError("Renderer did not respond in time. Try refreshing the page.");
    }, RENDERER_TIMEOUT_MS);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

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
      suppressedDefaultPositions: cfg.suppressedDefaultPositions ?? [],
      fasciaEnabled: cfg.fasciaEnabled !== false,
      fasciaOption: cfg.fasciaOption ?? 'full',
      lightingPreset: cfg.lightingPreset ?? 'exhibition',
      pins:   cfg.pins ?? [],
      pinMode: cfg.pinMode ?? false,
      invalidItemIds: cfg.invalidItemIds ?? [],
    };
  }, [
    cfg.width, cfg.depth, cfg.height,
    cfg.system, cfg.companyName, cfg.wallColor, cfg.frameColor, cfg.fasciaColor, cfg.carpetColor,
    cfg.openFront, cfg.openBack, cfg.openLeft, cfg.openRight,
    cfg.placedItems, cfg.rooms, cfg.panelOverrides, cfg.frontSupportPositions, cfg.suppressedDefaultPositions, cfg.fasciaEnabled, cfg.fasciaOption, cfg.lightingPreset, cfg.pins, cfg.pinMode, cfg.invalidItemIds,
  ]);

  const sendUpdate = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const payload = buildPayload();
    latestPayloadRef.current = payload;
    win.postMessage(payload, location.origin);
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
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setReady(true);
        setRendererError(null);
        setTimeout(sendUpdate, 0);
        return;
      }
      if (event.data.type === 'boothRendererError') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setRendererError(typeof event.data.message === 'string' ? event.data.message : 'The 3D renderer encountered an error.');
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
        const positions = Array.isArray(event.data.positions) ? event.data.positions.map(Number).filter(Number.isFinite) : [];
        const suppressed = Array.isArray(event.data.suppressedDefaultPositions) ? event.data.suppressedDefaultPositions.map(Number).filter(Number.isFinite) : [];
        bridgeConfig?.onFrontSupportMove?.(positions, suppressed);
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
    };
  }, [sendUpdate]);

  if (rendererError) {
    return (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: '12px',
        background: 'var(--workspace-bg, #f3f1ec)', color: 'var(--workspace-muted, #6b6560)',
        fontSize: '14px', textAlign: 'center', padding: '24px',
      }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <span>{rendererError}</span>
        <button
          onClick={() => { setRendererError(null); setReady(false); }}
          style={{
            padding: '6px 16px', borderRadius: '6px', border: '1px solid currentColor',
            background: 'transparent', color: 'inherit', cursor: 'pointer', fontSize: '13px',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <style>{`@keyframes __booth_spin{to{transform:rotate(360deg)}}`}</style>
      {!ready && (
        <div
          aria-label="Loading 3D renderer"
          style={{
            position: 'absolute', inset: 0, zIndex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'var(--workspace-bg, #f3f1ec)',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2.5px solid var(--workspace-hair, #d8d3c9)',
            borderTopColor: 'var(--workspace-blue, #1d4ed8)',
            animation: '__booth_spin 0.75s linear infinite',
          }} />
          <span style={{
            fontSize: 11.5,
            fontFamily: 'var(--app-font-samsung)',
            color: 'var(--workspace-muted, #6b6560)',
            letterSpacing: '0.04em',
          }}>
            Loading 3D renderer…
          </span>
        </div>
      )}
      <iframe
        key={src}
        ref={iframeRef}
        src={src}
        title="Booth Renderer"
        data-renderer-ready={ready ? "true" : "false"}
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        onLoad={() => { setTimeout(sendUpdate, 50); }}
        onError={() => setRendererError('Failed to load the booth renderer. Check your network connection.')}
      />
    </div>
  );
}
