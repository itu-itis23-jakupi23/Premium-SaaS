import { useMemo } from 'react';

export type BoothSystem = 'octanorm' | 'maxima';

export interface BoothConfig {
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

const DEFAULTS: BoothConfig = {
  width: 6, depth: 3, height: 2.5,
  system: 'octanorm',
  companyName: 'VERDANTIA',
  primaryColor: '#ffffff',
  carpetColor: '#1a1e28',
  openFront: true, openLeft: false, openRight: false, openBack: false,
};

// ─────────────────────────────────────────────────────────────────
// Isometric projection — tune SH/SV for viewing angle
// ─────────────────────────────────────────────────────────────────
const SH = 32;   // horizontal scale
const SV = 28;   // vertical scale

function isoXY(x: number, y: number, z: number): [number, number] {
  // x = along width, y = along depth, z = height
  // Right-hand isometric: x goes right-down, y goes left-down, z goes up
  const sx = (x - y) * 0.866 * SH;
  const sy = (x + y) * 0.5  * SH - z * SV;
  return [sx, sy];
}

// Scene offset so front-left corner of booth (0,0,0) lands at CX,CY
const CX = 210;
const CY = 185;

function pt(x: number, y: number, z: number): string {
  const [px, py] = isoXY(x, y, z);
  return `${(px + CX).toFixed(1)},${(py + CY).toFixed(1)}`;
}

function poly(...verts: [number, number, number][]): string {
  return verts.map(([x, y, z]) => pt(x, y, z)).join(' ');
}

function sc(x: number, y: number, z: number) {
  const [px, py] = isoXY(x, y, z);
  return { x: px + CX, y: py + CY };
}

// ─────────────────────────────────────────────────────────────────
// Faces of a box — 3 visible faces using gradient fills
// ─────────────────────────────────────────────────────────────────
function BoxFaces({
  x, y, z, w, d, h,
  topId, frontId, sideId,
  strokeColor = 'rgba(0,0,0,0.22)', strokeW = 0.5,
}: {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  topId: string; frontId: string; sideId: string;
  strokeColor?: string; strokeW?: number;
}) {
  return (
    <>
      {/* Right face (y+d side) */}
      <polygon
        points={poly([x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h])}
        fill={`url(#${sideId})`} stroke={strokeColor} strokeWidth={strokeW}
      />
      {/* Front face (y=const, x varies) */}
      <polygon
        points={poly([x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h])}
        fill={`url(#${frontId})`} stroke={strokeColor} strokeWidth={strokeW}
      />
      {/* Top face */}
      <polygon
        points={poly([x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h])}
        fill={`url(#${topId})`} stroke={strokeColor} strokeWidth={strokeW}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Structural post (dark charcoal)
// ─────────────────────────────────────────────────────────────────
function Post({ x, y, h, s }: { x: number; y: number; h: number; s: number }) {
  const hw = s / 2;
  return (
    <>
      {/* Right face */}
      <polygon points={poly([x+hw,y-hw,0],[x+hw,y+hw,0],[x+hw,y+hw,h],[x+hw,y-hw,h])}
        fill="url(#post_side)" stroke="rgba(0,0,0,0.35)" strokeWidth={0.4} />
      {/* Front face */}
      <polygon points={poly([x-hw,y-hw,0],[x+hw,y-hw,0],[x+hw,y-hw,h],[x-hw,y-hw,h])}
        fill="url(#post_front)" stroke="rgba(0,0,0,0.3)" strokeWidth={0.4} />
      {/* Top cap */}
      <polygon points={poly([x-hw,y-hw,h],[x+hw,y-hw,h],[x+hw,y+hw,h],[x-hw,y+hw,h])}
        fill="url(#post_top)" stroke="rgba(0,0,0,0.25)" strokeWidth={0.4} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Horizontal rail (dark charcoal beam on a wall)
// ─────────────────────────────────────────────────────────────────
function BackRail({ x1, x2, y, z, th = 0.06 }: { x1: number; x2: number; y: number; z: number; th?: number }) {
  return (
    <polygon
      points={poly([x1,y,z],[x2,y,z],[x2,y,z+th],[x1,y,z+th])}
      fill="url(#post_front)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.3}
    />
  );
}

function SideRail({ y1, y2, x, z, th = 0.06 }: { y1: number; y2: number; x: number; z: number; th?: number }) {
  return (
    <polygon
      points={poly([x,y1,z],[x,y2,z],[x,y2,z+th],[x,y1,z+th])}
      fill="url(#post_front)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.3}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Wall panel — solid white fill
// ─────────────────────────────────────────────────────────────────
function BackWallPanel({ x1, x2, y, z1, z2 }: { x1: number; x2: number; y: number; z1: number; z2: number }) {
  return (
    <polygon
      points={poly([x1,y,z1],[x2,y,z1],[x2,y,z2],[x1,y,z2])}
      fill="url(#panel_back)" stroke="rgba(180,185,195,0.3)" strokeWidth={0.3}
    />
  );
}

function SideWallPanel({ y1, y2, x, z1, z2, isRight = false }: { y1: number; y2: number; x: number; z1: number; z2: number; isRight?: boolean }) {
  return (
    <polygon
      points={poly([x,y1,z1],[x,y2,z1],[x,y2,z2],[x,y1,z2])}
      fill={isRight ? 'url(#panel_side_r)' : 'url(#panel_side_l)'}
      stroke="rgba(160,165,175,0.25)" strokeWidth={0.3}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Dimension label
// ─────────────────────────────────────────────────────────────────
function DimLabel({ ax, ay, bx, by, label }: { ax: number; ay: number; bx: number; by: number; label: string }) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 - 10;
  return (
    <g>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#5a6070" strokeWidth={0.8} strokeDasharray="3,2" />
      <rect x={mx - 18} y={my - 8} width={36} height={14} rx={4} fill="#1e2230" stroke="#3a4050" strokeWidth={0.8} />
      <text x={mx} y={my + 1.5} textAnchor="middle" dominantBaseline="middle" fill="#b0b8c8" fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">
        {label}
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────
export function BoothCanvas({ config }: { config?: Partial<BoothConfig> }) {
  const cfg: BoothConfig = { ...DEFAULTS, ...config };
  const {
    width: W, depth: D, height: H,
    system, companyName,
    openFront = true, openLeft = false, openRight = false, openBack = false,
  } = cfg;

  const isMax = system === 'maxima';
  const mod = isMax ? 2 : 1;
  const ps  = isMax ? 0.11 : 0.08;  // post half-width × 2

  // Post grid positions
  const backXs  = useMemo(() => { const a: number[] = []; for (let x = 0; x <= W; x += mod) a.push(x); return a; }, [W, mod]);
  const depthYs = useMemo(() => { const a: number[] = []; for (let y = 0; y <= D; y += mod) a.push(y); return a; }, [D, mod]);

  // Rail heights — Octanorm: 4 rails; Maxima: 3 rails
  const railZs = isMax
    ? [0.001, H * 0.5, H]
    : [0.001, H * 0.35, H * 0.7, H];

  const fasciaH = isMax ? 0.42 : 0.36;

  // Compute a mid-height for panel fills
  const panelZ1 = 0.001;
  const panelZ2 = H;

  return (
    <svg
      viewBox="0 0 520 400"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        {/* ── Background gradient ───────────────────────── */}
        <radialGradient id="bg" cx="40%" cy="45%" r="60%">
          <stop offset="0%"   stopColor="#2a2e3a" />
          <stop offset="100%" stopColor="#0a0c14" />
        </radialGradient>

        {/* ── Post / rail (dark charcoal) ──────────────── */}
        <linearGradient id="post_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#40444e" />
          <stop offset="100%" stopColor="#2e3240" />
        </linearGradient>
        <linearGradient id="post_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#282c38" />
          <stop offset="100%" stopColor="#1a1e2a" />
        </linearGradient>
        <linearGradient id="post_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e2230" />
          <stop offset="100%" stopColor="#12161e" />
        </linearGradient>

        {/* ── White wall panels ────────────────────────── */}
        {/* Back wall face */}
        <linearGradient id="panel_back" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#edf0f3" />
          <stop offset="100%" stopColor="#d8dde4" />
        </linearGradient>
        {/* Left side wall */}
        <linearGradient id="panel_side_l" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d8dde4" />
          <stop offset="100%" stopColor="#c0c6d0" />
        </linearGradient>
        {/* Right side wall (slightly lighter than left to show depth) */}
        <linearGradient id="panel_side_r" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c8cdd6" />
          <stop offset="100%" stopColor="#b0b6c2" />
        </linearGradient>

        {/* ── White fascia ─────────────────────────────── */}
        <linearGradient id="fascia_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e4e8ee" />
        </linearGradient>
        <linearGradient id="fascia_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#f0f3f7" />
          <stop offset="100%" stopColor="#dde1e8" />
        </linearGradient>
        <linearGradient id="fascia_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d8dce4" />
          <stop offset="100%" stopColor="#c2c7d2" />
        </linearGradient>

        {/* ── Floor inside booth ───────────────────────── */}
        <linearGradient id="floor_inside" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e2230" />
          <stop offset="100%" stopColor="#14181e" />
        </linearGradient>

        {/* ── Drop shadow on entire booth ───────────────── */}
        <filter id="boothShadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="2" dy="12" stdDeviation="10" floodColor="#000010" floodOpacity="0.8" />
        </filter>

        {/* ── System badge pill ─────────────────────────── */}
        <linearGradient id="badge_grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2a3040" />
          <stop offset="100%" stopColor="#1e2438" />
        </linearGradient>
      </defs>

      {/* ── Background ────────────────────────────────── */}
      <rect width="520" height="400" fill="url(#bg)" />

      {/* ── Floor plane (exterior, dark) ──────────────── */}
      <polygon
        points={poly([-1.5,-1,0],[W+1.5,-1,0],[W+1.5,D+1,0],[-1.5,D+1,0])}
        fill="#101418"
      />
      {/* Subtle floor grid */}
      <g stroke="#1e2230" strokeWidth="0.4" opacity="0.5">
        {useMemo(() => {
          const lines: [number,number,number,number][] = [];
          for (let xi = -2; xi <= W + 2; xi++) {
            const a = sc(xi, -1, 0), b = sc(xi, D + 1, 0);
            lines.push([a.x, a.y, b.x, b.y]);
          }
          for (let yi = -1; yi <= D + 1; yi++) {
            const a = sc(-1.5, yi, 0), b = sc(W + 1.5, yi, 0);
            lines.push([a.x, a.y, b.x, b.y]);
          }
          return lines.map((l, i) => <line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} />);
        }, [W, D])}
      </g>

      {/* ── Booth inside floor ────────────────────────── */}
      <polygon
        points={poly([0,0,0],[W,0,0],[W,D,0],[0,D,0])}
        fill="url(#floor_inside)"
      />

      {/* ── STRUCTURE (shadow filter on whole group) ──── */}
      <g filter="url(#boothShadow)">

        {/* ── WALL PANELS (drawn first, behind posts) ─── */}

        {/* Back wall panels */}
        {!openBack && backXs.slice(0, -1).map((xi, i) => {
          const x1 = xi + ps / 2;
          const x2 = backXs[i + 1] - ps / 2;
          return <BackWallPanel key={`bwp${i}`} x1={x1} x2={x2} y={D} z1={panelZ1} z2={panelZ2} />;
        })}

        {/* Left side wall panels */}
        {!openLeft && depthYs.slice(0, -1).map((yi, i) => {
          const y1 = yi + ps / 2;
          const y2 = depthYs[i + 1] - ps / 2;
          return <SideWallPanel key={`lwp${i}`} y1={y1} y2={y2} x={0} z1={panelZ1} z2={panelZ2} isRight={false} />;
        })}

        {/* Right side wall panels */}
        {!openRight && depthYs.slice(0, -1).map((yi, i) => {
          const y1 = yi + ps / 2;
          const y2 = depthYs[i + 1] - ps / 2;
          return <SideWallPanel key={`rwp${i}`} y1={y1} y2={y2} x={W} z1={panelZ1} z2={panelZ2} isRight={true} />;
        })}

        {/* Front wall panels (only if not open) */}
        {!openFront && backXs.slice(0, -1).map((xi, i) => {
          const x1 = xi + ps / 2;
          const x2 = backXs[i + 1] - ps / 2;
          // front is y=0
          return (
            <BackWallPanel key={`fwp${i}`} x1={x1} x2={x2} y={0} z1={panelZ1} z2={panelZ2} />
          );
        })}

        {/* ── HORIZONTAL RAILS ────────────────────────── */}
        {railZs.map(rz => (
          <g key={`rails-${rz}`}>
            {/* Back wall rail */}
            {!openBack && <BackRail x1={0} x2={W} y={D} z={rz} />}
            {/* Left wall rail */}
            {!openLeft && <SideRail y1={0} y2={D} x={0} z={rz} />}
            {/* Right wall rail */}
            {!openRight && (
              <polygon
                points={poly([W,0,rz],[W,D,rz],[W,D,rz+0.06],[W,0,rz+0.06])}
                fill="url(#post_front)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.3}
              />
            )}
            {/* Front rail (only if front is closed, or top rail always) */}
            {(!openFront || rz === H) && (
              <BackRail x1={0} x2={W} y={0} z={rz} />
            )}
          </g>
        ))}

        {/* ── POSTS ─────────────────────────────────── */}
        {/* Back wall posts */}
        {backXs.map(xi => <Post key={`bk${xi}`} x={xi} y={D} h={H} s={ps} />)}
        {/* Left wall posts */}
        {depthYs.map(yi => <Post key={`lt${yi}`} x={0} y={yi} h={H} s={ps} />)}
        {/* Right wall posts */}
        {depthYs.map(yi => <Post key={`rt${yi}`} x={W} y={yi} h={H} s={ps} />)}
        {/* Front corner posts (always visible even if open) */}
        {!backXs.includes(0)   && <Post x={0}  y={0} h={H} s={ps} />}
        {!backXs.includes(W)   && <Post x={W}  y={0} h={H} s={ps} />}
        {!depthYs.includes(0)  && <Post x={0}  y={0} h={H} s={ps} />}
        {!depthYs.includes(D)  && <Post x={0}  y={D} h={H} s={ps} />}

        {/* ── FASCIA (solid white box on top) ─────────── */}
        {/* Back fascia */}
        <BoxFaces
          x={0} y={D - 0.01} z={H} w={W} d={0.14} h={fasciaH}
          topId="fascia_top" frontId="fascia_front" sideId="fascia_side"
          strokeColor="rgba(140,148,160,0.3)" strokeW={0.4}
        />
        {/* Left fascia */}
        <BoxFaces
          x={-0.01} y={0} z={H} w={0.13} d={D} h={fasciaH}
          topId="fascia_top" frontId="fascia_front" sideId="fascia_side"
          strokeColor="rgba(140,148,160,0.3)" strokeW={0.4}
        />
        {/* Right fascia */}
        <BoxFaces
          x={W - 0.01} y={0} z={H} w={0.13} d={D} h={fasciaH}
          topId="fascia_top" frontId="fascia_front" sideId="fascia_side"
          strokeColor="rgba(140,148,160,0.3)" strokeW={0.4}
        />
        {/* Front fascia (top beam across front) */}
        <BoxFaces
          x={0} y={-0.13} z={H} w={W} d={0.14} h={fasciaH}
          topId="fascia_top" frontId="fascia_front" sideId="fascia_side"
          strokeColor="rgba(140,148,160,0.3)" strokeW={0.4}
        />

      </g>{/* end filter group */}

      {/* ── COMPANY NAME on back fascia ──────────────── */}
      {(() => {
        const a = sc(W * 0.2, D, H + fasciaH / 2);
        const b = sc(W * 0.8, D, H + fasciaH / 2);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        const fSize = Math.max(6, Math.min(10, W * 1.2));
        return (
          <text
            x={mid.x} y={mid.y}
            fill="#2a2e3a"
            fontSize={fSize}
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            fontWeight="500"
            letterSpacing={fSize * 0.5}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${ang},${mid.x},${mid.y})`}
          >
            {companyName}
          </text>
        );
      })()}

      {/* ── DIMENSION LABELS ──────────────────────────── */}
      {/* Width label */}
      {(() => {
        const a = sc(0, -0.7, 0);
        const b = sc(W, -0.7, 0);
        return <DimLabel ax={a.x} ay={a.y} bx={b.x} by={b.y} label={`${W.toFixed(1)} m`} />;
      })()}
      {/* Depth label */}
      {(() => {
        const a = sc(W + 0.6, 0, 0);
        const b = sc(W + 0.6, D, 0);
        return <DimLabel ax={a.x} ay={a.y} bx={b.x} by={b.y} label={`${D.toFixed(1)} m`} />;
      })()}
      {/* Height label */}
      {(() => {
        const a = sc(-0.6, 0, 0);
        const b = sc(-0.6, 0, H);
        return <DimLabel ax={a.x} ay={a.y} bx={b.x} by={b.y} label={`${H.toFixed(1)} m`} />;
      })()}

      {/* ── SCALE BAR ─────────────────────────────────── */}
      {(() => {
        const a = sc(0, D + 0.6, 0);
        const b = sc(1, D + 0.6, 0);
        return (
          <g opacity="0.6">
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#5a6070" strokeWidth={1.5} />
            <line x1={a.x} y1={a.y - 3} x2={a.x} y2={a.y + 3} stroke="#5a6070" strokeWidth={1} />
            <line x1={b.x} y1={b.y - 3} x2={b.x} y2={b.y + 3} stroke="#5a6070" strokeWidth={1} />
            <text x={(a.x+b.x)/2} y={a.y+11} fill="#5a6070" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
              scale 1:0 m
            </text>
          </g>
        );
      })()}

      {/* ── SYSTEM BADGE ──────────────────────────────── */}
      <rect x="12" y="12" width={isMax ? 82 : 88} height="20" rx="5" fill="url(#badge_grad)" stroke="#3a4050" strokeWidth={0.8} />
      <text x={isMax ? 53 : 56} y="24" textAnchor="middle" fill="#8090b0" fontSize="7.5"
        fontFamily="'Helvetica Neue',Arial,sans-serif" fontWeight="600" letterSpacing="1.5">
        {isMax ? '◈ MAXIMA' : '⬡ OCTANORM'}
      </text>
    </svg>
  );
}
