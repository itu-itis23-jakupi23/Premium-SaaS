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
}

const DEFAULTS: BoothConfig = {
  width: 8, depth: 6, height: 3,
  system: 'octanorm',
  companyName: 'TECHCORP INDUSTRIES',
  primaryColor: '#1a3a7a',
  carpetColor: '#1a2640',
  openFront: true, openLeft: false, openRight: false,
};

// Isometric projection — scale in pixels per meter
const SH = 26;   // horizontal
const SV = 30;   // vertical

function iso(x: number, y: number, z: number): [number, number] {
  return [(x - y) * 0.866 * SH, (x + y) * 0.5 * SH - z * SV];
}

// Offset so (0,0,0) [front-left floor] is at SVG origin
const CX = 192;
const CY = 170;

function pt(x: number, y: number, z: number): string {
  const [px, py] = iso(x, y, z);
  return `${(px + CX).toFixed(1)},${(py + CY).toFixed(1)}`;
}

function poly(...coords: [number, number, number][]): string {
  return coords.map(([x, y, z]) => pt(x, y, z)).join(' ');
}

function scrXY(x: number, y: number, z: number): { x: number; y: number } {
  const [px, py] = iso(x, y, z);
  return { x: px + CX, y: py + CY };
}

// ─────────────────────────────────────────────────────────────────
// Gradient-shaded box — 3 visible faces with proper depth cues
// ─────────────────────────────────────────────────────────────────
interface ShadedBoxProps {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  topG: string; frontG: string; sideG: string;
  stroke?: string; strokeW?: number;
}

function ShadedBox({ x, y, z, w, d, h, topG, frontG, sideG, stroke = 'rgba(0,0,0,0.18)', strokeW = 0.4 }: ShadedBoxProps) {
  return (
    <g>
      {/* Right / side face (x+w) — darkest */}
      <polygon points={poly([x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h])}
        fill={`url(#${sideG})`} stroke={stroke} strokeWidth={strokeW} />
      {/* Front face (y=y) — medium */}
      <polygon points={poly([x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h])}
        fill={`url(#${frontG})`} stroke={stroke} strokeWidth={strokeW} />
      {/* Top face — brightest */}
      <polygon points={poly([x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h])}
        fill={`url(#${topG})`} stroke={stroke} strokeWidth={strokeW} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────
// Structural post — tall thin box
// ─────────────────────────────────────────────────────────────────
function Post({ x, y, h, s, isMax }: { x: number; y: number; h: number; s: number; isMax: boolean }) {
  const hw = s / 2;
  const g = isMax ? 'gold' : 'alum';
  return (
    <g>
      {/* Right face */}
      <polygon points={poly([x+hw,y-hw,0],[x+hw,y+hw,0],[x+hw,y+hw,h],[x+hw,y-hw,h])}
        fill={`url(#${g}_side)`} stroke="rgba(0,0,0,0.25)" strokeWidth={0.3} />
      {/* Front face */}
      <polygon points={poly([x-hw,y-hw,0],[x+hw,y-hw,0],[x+hw,y-hw,h],[x-hw,y-hw,h])}
        fill={`url(#${g}_front)`} stroke="rgba(0,0,0,0.2)" strokeWidth={0.3} />
      {/* Cap */}
      <polygon points={poly([x-hw,y-hw,h],[x+hw,y-hw,h],[x+hw,y+hw,h],[x-hw,y+hw,h])}
        fill={`url(#${g}_top)`} stroke="rgba(0,0,0,0.2)" strokeWidth={0.3} />
      {/* Octanorm connector node */}
      {!isMax && (
        <polygon points={poly([x-0.07,y-0.07,h-0.05],[x+0.07,y-0.07,h-0.05],[x+0.07,y+0.07,h-0.05],[x-0.07,y+0.07,h-0.05])}
          fill="#7080a0" stroke="rgba(0,0,0,0.3)" strokeWidth={0.5} />
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────
// Horizontal rail beam on a wall face
// ─────────────────────────────────────────────────────────────────
function BackRail({ x1, x2, y, z, isMax }: { x1: number; x2: number; y: number; z: number; isMax: boolean }) {
  const th = 0.055;
  const g = isMax ? 'gold' : 'alum';
  return (
    <polygon points={poly([x1,y,z],[x2,y,z],[x2,y,z+th],[x1,y,z+th])}
      fill={`url(#${g}_front)`} stroke="rgba(0,0,0,0.15)" strokeWidth={0.3} />
  );
}

function LeftRail({ y1, y2, x, z, isMax }: { y1: number; y2: number; x: number; z: number; isMax: boolean }) {
  const th = 0.055;
  const g = isMax ? 'gold' : 'alum';
  return (
    <polygon points={poly([x,y1,z],[x,y2,z],[x,y2,z+th],[x,y1,z+th])}
      fill={`url(#${g}_front)`} stroke="rgba(0,0,0,0.15)" strokeWidth={0.3} />
  );
}

// ─────────────────────────────────────────────────────────────────
// Wall panel (glass-like, semi-transparent)
// ─────────────────────────────────────────────────────────────────
function BackPanel({ x1, x2, y, h }: { x1: number; x2: number; y: number; h: number }) {
  return (
    <polygon points={poly([x1,y,0],[x2,y,0],[x2,y,h],[x1,y,h])}
      fill="url(#wall_panel)" stroke="rgba(150,180,220,0.3)" strokeWidth={0.4} />
  );
}

function LeftPanel({ y1, y2, x, h }: { y1: number; y2: number; x: number; h: number }) {
  return (
    <polygon points={poly([x,y1,0],[x,y2,0],[x,y2,h],[x,y1,h])}
      fill="url(#wall_panel_l)" stroke="rgba(150,180,220,0.3)" strokeWidth={0.4} />
  );
}

// ─────────────────────────────────────────────────────────────────
// Furniture components
// ─────────────────────────────────────────────────────────────────
function ReceptionCounter({ W, D }: { W: number; D: number }) {
  const bx = W - 3.0, by = 0.4;
  return (
    <g>
      {/* Counter body */}
      <ShadedBox x={bx} y={by} z={0} w={2.6} d={0.72} h={1.04} topG="white_top" frontG="white_front" sideG="white_side" />
      {/* Top accent edge */}
      <polygon points={poly([bx,by,1.04],[bx+2.6,by,1.04],[bx+2.6,by,1.07],[bx,by,1.07])}
        fill="url(#alum_front)" />
      {/* Graphic front panel (brand color) */}
      <polygon points={poly([bx,by,0.08],[bx+2.6,by,0.08],[bx+2.6,by,0.95],[bx,by,0.95])}
        fill="url(#fascia_front)" opacity="0.9" />
      {/* Return unit */}
      <ShadedBox x={bx+2.45} y={by} z={0} w={0.38} d={1.25} h={1.04} topG="white_top" frontG="white_front" sideG="white_side" />
      {/* Monitor stand */}
      <ShadedBox x={bx+0.6} y={by+0.15} z={1.04} w={0.04} d={0.04} h={0.3} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      {/* Monitor screen */}
      <ShadedBox x={bx+0.35} y={by+0.12} z={1.34} w={0.55} d={0.06} h={0.35} topG="screen_top" frontG="screen_front" sideG="screen_side" />
      {/* Screen glow */}
      <polygon points={poly([bx+0.37,by+0.118,1.35],[bx+0.88,by+0.118,1.35],[bx+0.88,by+0.118,1.68],[bx+0.37,by+0.118,1.68])}
        fill="url(#screen_glow)" filter="url(#ledGlow)" opacity="0.9" />
      {/* Laptop */}
      <ShadedBox x={bx+1.5} y={by+0.1} z={1.04} w={0.4} d={0.28} h={0.02} topG="alum_top" frontG="alum_front" sideG="alum_side" />
    </g>
  );
}

function ShelvingUnit({ W, D }: { W: number; D: number }) {
  const bx = 0.4, by = D - 0.5;
  const colors = ['#dd4444','#3388dd','#44bb55','#ddaa22','#9944cc'];
  return (
    <g>
      {/* Back panel */}
      <ShadedBox x={bx} y={by} z={0} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={0.62} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={1.24} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={1.86} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      {/* Side uprights */}
      <ShadedBox x={bx} y={by} z={0} w={0.04} d={0.45} h={1.9} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      <ShadedBox x={bx+2.36} y={by} z={0} w={0.04} d={0.45} h={1.9} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      {/* Products on 3 shelves */}
      {[0, 0.62, 1.24].map((sz, si) =>
        [0, 0.36, 0.72, 1.08, 1.44, 1.8].map((sx, pi) => (
          <ShadedBox key={`p${si}${pi}`}
            x={bx+0.06+sx} y={by+0.04} z={sz+0.04} w={0.28} d={0.35} h={0.48}
            topG={`prod${(si*6+pi)%5}_top`} frontG={`prod${(si*6+pi)%5}_front`} sideG={`prod${(si*6+pi)%5}_side`}
            strokeW={0.3}
          />
        ))
      )}
    </g>
  );
}

function RightShelvingUnit({ W, D }: { W: number; D: number }) {
  const bx = W - 2.84, by = D - 0.5;
  const colors = ['#9944cc','#dd4444','#44bb55','#3388dd','#ddaa22'];
  return (
    <g>
      <ShadedBox x={bx} y={by} z={0} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={0.62} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={1.24} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={1.86} w={2.4} d={0.45} h={0.04} topG="white_top" frontG="white_front" sideG="white_side" />
      <ShadedBox x={bx} y={by} z={0} w={0.04} d={0.45} h={1.9} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      <ShadedBox x={bx+2.36} y={by} z={0} w={0.04} d={0.45} h={1.9} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      {[0, 0.62, 1.24].map((sz, si) =>
        [0, 0.36, 0.72, 1.08, 1.44, 1.8].map((sx, pi) => (
          <ShadedBox key={`rp${si}${pi}`}
            x={bx+0.06+sx} y={by+0.04} z={sz+0.04} w={0.28} d={0.35} h={0.48}
            topG={`prod${(si*6+pi+2)%5}_top`} frontG={`prod${(si*6+pi+2)%5}_front`} sideG={`prod${(si*6+pi+2)%5}_side`}
            strokeW={0.3}
          />
        ))
      )}
    </g>
  );
}

function MeetingTable({ W, D }: { W: number; D: number }) {
  const bx = W/2 - 1.3, by = D/2 - 0.8;
  return (
    <g>
      {/* Legs */}
      {([[bx+0.08,by+0.08],[bx+2.4,by+0.08],[bx+2.4,by+1.3],[bx+0.08,by+1.3]] as [number,number][]).map(([lx,ly],i) => (
        <ShadedBox key={i} x={lx} y={ly} z={0} w={0.06} d={0.06} h={0.73} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      ))}
      {/* Table top */}
      <ShadedBox x={bx} y={by} z={0.73} w={2.55} d={1.42} h={0.055} topG="wood_top" frontG="wood_front" sideG="wood_side" />
      {/* Chairs */}
      {/* Front 2 */}
      <ShadedBox x={bx+0.3} y={by-0.7} z={0} w={0.52} d={0.5} h={0.44} topG="chair_top" frontG="chair_front" sideG="chair_side" />
      <ShadedBox x={bx+0.3} y={by-0.7} z={0.44} w={0.52} d={0.05} h={0.42} topG="chair_top" frontG="chair_front" sideG="chair_side" />
      <ShadedBox x={bx+1.7} y={by-0.7} z={0} w={0.52} d={0.5} h={0.44} topG="chair_top" frontG="chair_front" sideG="chair_side" />
      <ShadedBox x={bx+1.7} y={by-0.7} z={0.44} w={0.52} d={0.05} h={0.42} topG="chair_top" frontG="chair_front" sideG="chair_side" />
      {/* Back 2 */}
      <ShadedBox x={bx+0.3} y={by+1.5} z={0} w={0.52} d={0.5} h={0.44} topG="chair_top" frontG="chair_front" sideG="chair_side" />
      <ShadedBox x={bx+1.7} y={by+1.5} z={0} w={0.52} d={0.5} h={0.44} topG="chair_top" frontG="chair_front" sideG="chair_side" />
      {/* Laptop on table */}
      <ShadedBox x={bx+0.7} y={by+0.3} z={0.785} w={0.38} d={0.28} h={0.015} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      {/* Papers */}
      <ShadedBox x={bx+1.6} y={by+0.25} z={0.785} w={0.55} d={0.38} h={0.008} topG="white_top" frontG="white_front" sideG="white_side" />
    </g>
  );
}

function DisplayTotem({ W, D, primaryColor }: { W: number; D: number; primaryColor: string }) {
  const bx = 0.4, by = 0.5;
  return (
    <g>
      {/* Base plate */}
      <ShadedBox x={bx} y={by} z={0} w={0.68} d={0.55} h={0.06} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      {/* Body */}
      <ShadedBox x={bx+0.04} y={by+0.04} z={0.06} w={0.6} d={0.47} h={2.28} topG="white_top" frontG="white_front" sideG="white_side" />
      {/* Brand panel */}
      <polygon points={poly([bx+0.05,by+0.045,1.5],[bx+0.62,by+0.045,1.5],[bx+0.62,by+0.045,2.3],[bx+0.05,by+0.045,2.3])}
        fill="url(#fascia_front)" opacity="0.95" />
      {/* Screen */}
      <ShadedBox x={bx+0.06} y={by+0.038} z={0.85} w={0.56} d={0.06} h={0.42} topG="screen_top" frontG="screen_front" sideG="screen_side" />
      <polygon points={poly([bx+0.08,by+0.034,0.86],[bx+0.6,by+0.034,0.86],[bx+0.6,by+0.034,1.26],[bx+0.08,by+0.034,1.26])}
        fill="url(#screen_glow)" filter="url(#ledGlow)" opacity="0.85" />
    </g>
  );
}

function BrochureStand({ W, D }: { W: number; D: number }) {
  const bx = W - 0.7, by = 0.45;
  return (
    <g>
      <ShadedBox x={bx} y={by} z={0} w={0.04} d={0.04} h={1.2} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      <ShadedBox x={bx-0.22} y={by-0.04} z={0} w={0.48} d={0.5} h={0.04} topG="alum_top" frontG="alum_front" sideG="alum_side" />
      {[0.28, 0.6, 0.92].map((sz, i) => (
        <ShadedBox key={i} x={bx-0.22} y={by-0.02} z={sz} w={0.48} d={0.04} h={0.22}
          topG={`prod${i}_top`} frontG={`prod${i}_front`} sideG={`prod${i}_side`} />
      ))}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────
// Wall + structure for Octanorm / Maxima
// ─────────────────────────────────────────────────────────────────
function BoothWalls({ W, D, H, isMax, primaryColor }: { W: number; D: number; H: number; isMax: boolean; primaryColor: string }) {
  const mod = isMax ? 2 : 1;
  const ps = isMax ? 0.10 : 0.075;
  const railZs = isMax ? [0.001, H * 0.48, H] : [0.001, H * 0.38, H * 0.76, H];

  const backXs: number[] = useMemo(() => { const a = []; for (let x = 0; x <= W; x += mod) a.push(x); return a; }, [W, mod]);
  const depthZs: number[] = useMemo(() => { const a = []; for (let y = 0; y <= D; y += mod) a.push(y); return a; }, [D, mod]);

  const fasciaH = isMax ? 0.44 : 0.36;

  return (
    <g>
      {/* ── Wall panels (drawn first, behind posts) ─────────── */}
      {/* Back wall */}
      {backXs.slice(0, -1).map((xi, i) => (
        <BackPanel key={`bwp${i}`} x1={xi + ps / 2} x2={backXs[i + 1] - ps / 2} y={D} h={H} />
      ))}
      {/* Left wall */}
      {!isMax && depthZs.slice(0, -1).map((yi, i) => (
        <LeftPanel key={`lwp${i}`} y1={yi + ps / 2} y2={depthZs[i + 1] - ps / 2} x={0} h={H} />
      ))}
      {!isMax && depthZs.slice(0, -1).map((yi, i) => (
        <polygon key={`rwp${i}`}
          points={poly([W,yi+ps/2,0],[W,depthZs[i+1]-ps/2,0],[W,depthZs[i+1]-ps/2,H],[W,yi+ps/2,H])}
          fill="url(#wall_panel_l)" stroke="rgba(150,180,220,0.3)" strokeWidth={0.4} />
      ))}
      {isMax && (
        <>
          <polygon points={poly([0,0,0],[0,D,0],[0,D,H],[0,0,H])} fill="url(#wall_panel_l)" stroke="rgba(150,180,220,0.25)" strokeWidth={0.5} />
          <polygon points={poly([W,0,0],[W,D,0],[W,D,H],[W,0,H])} fill="url(#wall_panel_l)" stroke="rgba(150,180,220,0.25)" strokeWidth={0.5} />
        </>
      )}

      {/* ── Horizontal rails ──────────────────────────────────── */}
      {railZs.map(rz => (
        <g key={rz}>
          <BackRail x1={0} x2={W} y={D} z={rz} isMax={isMax} />
          <LeftRail y1={0} y2={D} x={0} z={rz} isMax={isMax} />
          <polygon points={poly([W,0,rz],[W,D,rz],[W,D,rz+0.055],[W,0,rz+0.055])}
            fill={`url(#${isMax ? 'gold' : 'alum'}_front)`} strokeWidth={0.3} />
        </g>
      ))}

      {/* ── Vertical posts ────────────────────────────────────── */}
      {backXs.map(xi => <Post key={`bk${xi}`} x={xi} y={D} h={H} s={ps} isMax={isMax} />)}
      {depthZs.map(yi => <Post key={`lt${yi}`} x={0} y={yi} h={H} s={ps} isMax={isMax} />)}
      {depthZs.map(yi => <Post key={`rt${yi}`} x={W} y={yi} h={H} s={ps} isMax={isMax} />)}
      <Post x={0} y={0} h={H} s={ps} isMax={isMax} />
      <Post x={W} y={0} h={H} s={ps} isMax={isMax} />

      {/* ── Fascia headers ───────────────────────────────────── */}
      {/* Back fascia */}
      <polygon points={poly([0,D,H],[W,D,H],[W,D,H+fasciaH],[0,D,H+fasciaH])}
        fill="url(#fascia_front)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      {/* Left fascia */}
      <polygon points={poly([0,0,H],[0,D,H],[0,D,H+fasciaH],[0,0,H+fasciaH])}
        fill="url(#fascia_side)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      {/* Right fascia */}
      <polygon points={poly([W,0,H],[W,D,H],[W,D,H+fasciaH],[W,0,H+fasciaH])}
        fill="url(#fascia_side)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      {/* Front fascia (top beam) */}
      <polygon points={poly([0,0,H],[W,0,H],[W,0,H+fasciaH],[0,0,H+fasciaH])}
        fill="url(#fascia_front)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.5} />
      {/* Fascia top cap */}
      <polygon points={poly([0,0,H+fasciaH],[W,0,H+fasciaH],[W,D,H+fasciaH],[0,D,H+fasciaH])}
        fill="url(#alum_top)" stroke="rgba(255,255,255,0.3)" strokeWidth={0.4} />

      {/* LED accent strip on back fascia */}
      <polygon points={poly([0.2,D-0.03,H+0.03],[W-0.2,D-0.03,H+0.03],[W-0.2,D-0.03,H+0.07],[0.2,D-0.03,H+0.07])}
        fill={isMax ? '#cc88ff' : '#4488ff'} filter="url(#ledGlow)" opacity="0.95" />
      {/* LED on front fascia */}
      <polygon points={poly([0.2,0.03,H+0.03],[W-0.2,0.03,H+0.03],[W-0.2,0.03,H+0.07],[0.2,0.03,H+0.07])}
        fill={isMax ? '#cc88ff' : '#4488ff'} filter="url(#ledGlow)" opacity="0.7" />

      {/* Spotlight dots on fascia */}
      {backXs.filter(xi => xi > 0 && xi < W).map(xi => {
        const sp = scrXY(xi, D, H + fasciaH - 0.05);
        return (
          <g key={`sp${xi}`}>
            <circle cx={sp.x} cy={sp.y} r={3.5} fill="#d0dce8" stroke="#a0b0c0" strokeWidth={0.5} />
            <circle cx={sp.x} cy={sp.y + 6} r={4} fill="rgba(255,245,220,0.06)" />
          </g>
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────
export function BoothCanvas({ config }: { config?: Partial<BoothConfig> }) {
  const cfg: BoothConfig = { ...DEFAULTS, ...config };
  const { width: W, depth: D, height: H, system, companyName, primaryColor = '#1a3a7a', carpetColor = '#1a2640' } = cfg;
  const isMax = system === 'maxima';

  const hallExt = 2;

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const ext = hallExt + 0.5;
    for (let yi = -hallExt; yi <= D + ext; yi += 0.5) {
      const a = scrXY(-ext, yi, 0), b = scrXY(W + ext, yi, 0);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    for (let xi = -ext; xi <= W + ext; xi += 0.5) {
      const a = scrXY(xi, -hallExt, 0), b = scrXY(xi, D + ext, 0);
      lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return lines;
  }, [W, D]);

  const pc = primaryColor;
  // Derive lighter/darker shades of primary
  const pcDark = isMax ? '#2e1050' : '#0e2050';
  const pcSide = isMax ? '#220c3c' : '#091838';

  return (
    <svg viewBox="0 0 520 400" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <defs>
        {/* ── Drop shadow for booth ─────────────────────── */}
        <filter id="boothShadow" x="-15%" y="-15%" width="130%" height="140%">
          <feDropShadow dx="3" dy="10" stdDeviation="8" floodColor="#000820" floodOpacity="0.75" />
        </filter>

        {/* ── LED glow ─────────────────────────────────── */}
        <filter id="ledGlow" x="-100%" y="-400%" width="300%" height="900%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>

        {/* ── Aluminum gradients ───────────────────────── */}
        <linearGradient id="alum_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef3f8" /><stop offset="100%" stopColor="#d0dce8" />
        </linearGradient>
        <linearGradient id="alum_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c0ceda" /><stop offset="100%" stopColor="#98a8b8" />
        </linearGradient>
        <linearGradient id="alum_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8898aa" /><stop offset="100%" stopColor="#607080" />
        </linearGradient>

        {/* ── Gold (Maxima) gradients ──────────────────── */}
        <linearGradient id="gold_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0d898" /><stop offset="100%" stopColor="#d4b060" />
        </linearGradient>
        <linearGradient id="gold_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c8a050" /><stop offset="100%" stopColor="#a07830" />
        </linearGradient>
        <linearGradient id="gold_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#906020" /><stop offset="100%" stopColor="#684010" />
        </linearGradient>

        {/* ── White/light (panels, counter) ───────────── */}
        <linearGradient id="white_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f8fafc" /><stop offset="100%" stopColor="#e0e8f0" />
        </linearGradient>
        <linearGradient id="white_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4dfe8" /><stop offset="100%" stopColor="#b0bcc8" />
        </linearGradient>
        <linearGradient id="white_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#98a8b8" /><stop offset="100%" stopColor="#708090" />
        </linearGradient>

        {/* ── Wood (table) ─────────────────────────────── */}
        <linearGradient id="wood_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d8aa72" /><stop offset="100%" stopColor="#b88848" />
        </linearGradient>
        <linearGradient id="wood_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a87840" /><stop offset="100%" stopColor="#7a5828" />
        </linearGradient>
        <linearGradient id="wood_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6a4820" /><stop offset="100%" stopColor="#4a3010" />
        </linearGradient>

        {/* ── Chairs ───────────────────────────────────── */}
        <linearGradient id="chair_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eaf0f8" /><stop offset="100%" stopColor="#d0dce8" />
        </linearGradient>
        <linearGradient id="chair_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b8c8d8" /><stop offset="100%" stopColor="#98a8b8" />
        </linearGradient>
        <linearGradient id="chair_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7888a0" /><stop offset="100%" stopColor="#586880" />
        </linearGradient>

        {/* ── Fascia (primary color) ───────────────────── */}
        <linearGradient id="fascia_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pc} /><stop offset="100%" stopColor={pcDark} />
        </linearGradient>
        <linearGradient id="fascia_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={pcDark} /><stop offset="100%" stopColor={pcSide} />
        </linearGradient>

        {/* ── Screen ───────────────────────────────────── */}
        <linearGradient id="screen_top" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a2030" /><stop offset="100%" stopColor="#0a1020" />
        </linearGradient>
        <linearGradient id="screen_front" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a1828" /><stop offset="100%" stopColor="#050e18" />
        </linearGradient>
        <linearGradient id="screen_side" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050e18" /><stop offset="100%" stopColor="#020810" />
        </linearGradient>
        <linearGradient id="screen_glow" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={isMax ? '#6030c0' : '#1048b0'} />
          <stop offset="100%" stopColor={isMax ? '#4020a0' : '#0830a0'} />
        </linearGradient>

        {/* ── Wall panels ──────────────────────────────── */}
        <linearGradient id="wall_panel" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(210,228,248,0.28)" />
          <stop offset="100%" stopColor="rgba(180,205,230,0.15)" />
        </linearGradient>
        <linearGradient id="wall_panel_l" gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(190,210,235,0.22)" />
          <stop offset="100%" stopColor="rgba(160,185,215,0.12)" />
        </linearGradient>

        {/* ── Product colors (5) ───────────────────────── */}
        {[['#ee4444','#cc2222','#aa1010'],['#3399ee','#1177cc','#0055aa'],
          ['#44cc55','#22aa33','#108820'],['#eebb22','#cc9900','#aa7700'],
          ['#aa44dd','#8822bb','#661099']].map(([t,f,s],i) => (
          <g key={i}>
            <linearGradient id={`prod${i}_top`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={t} /><stop offset="100%" stopColor={f} />
            </linearGradient>
            <linearGradient id={`prod${i}_front`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={f} /><stop offset="100%" stopColor={s} />
            </linearGradient>
            <linearGradient id={`prod${i}_side`} gradientUnits="objectBoundingBox" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s} /><stop offset="100%" stopColor="#101010" />
            </linearGradient>
          </g>
        ))}

        {/* ── Ambient shadow under booth ────────────────── */}
        <radialGradient id="boothAmbient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#000820" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#000820" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ── Background ───────────────────────────────────── */}
      <rect width="520" height="400" fill="#080d18" />
      {/* Atmospheric gradient */}
      <radialGradient id="atmo" cx="45%" cy="55%" r="55%">
        <stop offset="0%" stopColor={isMax ? '#1a0830' : '#04142a'} stopOpacity="0.8" />
        <stop offset="100%" stopColor="#080d18" stopOpacity="0" />
      </radialGradient>
      <rect width="520" height="400" fill="url(#atmo)" />

      {/* ── Exhibition hall floor ─────────────────────────── */}
      <polygon
        points={poly([-hallExt,-hallExt,0],[W+hallExt,-hallExt,0],[W+hallExt,D+hallExt,0],[-hallExt,D+hallExt,0])}
        fill="#111820"
      />
      {/* Floor grid */}
      <g stroke={isMax ? '#2a1a40' : '#182038'} strokeWidth="0.5" opacity="0.55">
        {gridLines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />
        ))}
      </g>

      {/* ── Ambient shadow under booth ────────────────────── */}
      <ellipse
        cx={scrXY(W/2, D*0.6, 0).x}
        cy={scrXY(W/2, D*0.6, 0).y + 5}
        rx={160} ry={40}
        fill="url(#boothAmbient)"
      />

      {/* ── Carpet ────────────────────────────────────────── */}
      <polygon points={poly([0,0,0],[W,0,0],[W,D,0],[0,D,0])} fill={carpetColor} />
      {/* Carpet border */}
      <polygon points={poly([0.05,0.05,0.002],[W-0.05,0.05,0.002],[W-0.05,D-0.05,0.002],[0.05,D-0.05,0.002])}
        fill="none" stroke={isMax ? 'rgba(160,100,230,0.2)' : 'rgba(80,120,200,0.18)'} strokeWidth="1" />

      {/* ── Full booth with shadow filter ─────────────────── */}
      <g filter="url(#boothShadow)">
        <BoothWalls W={W} D={D} H={H} isMax={isMax} primaryColor={pc} />
      </g>

      {/* ── Furniture (drawn on top of walls) ─────────────── */}
      <RightShelvingUnit W={W} D={D} />
      <ShelvingUnit W={W} D={D} />
      <MeetingTable W={W} D={D} />
      <ReceptionCounter W={W} D={D} />
      <DisplayTotem W={W} D={D} primaryColor={pc} />
      <BrochureStand W={W} D={D} />

      {/* ── System badge ──────────────────────────────────── */}
      <rect x="12" y="12" width="100" height="22" rx="5" ry="5" fill={pc} opacity="0.9" />
      <text x="62" y="27" fill="white" fontSize="8.5" fontFamily="'Courier New',monospace" fontWeight="bold"
        letterSpacing="1.5" textAnchor="middle">
        {isMax ? '◈ MAXIMA' : '⬡ OCTANORM'}
      </text>

      {/* ── Company name on fascia ────────────────────────── */}
      {(() => {
        const a = scrXY(W * 0.25, D, H + 0.18);
        const b = scrXY(W * 0.75, D, H + 0.18);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
        return (
          <text
            x={mid.x} y={mid.y}
            fill="rgba(255,255,255,0.92)"
            fontSize="7.5"
            fontFamily="'Courier New',monospace"
            fontWeight="bold"
            letterSpacing="2.5"
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${ang},${mid.x},${mid.y})`}
          >
            {companyName}
          </text>
        );
      })()}

      {/* ── Scale bar ─────────────────────────────────────── */}
      <g opacity="0.5">
        {(() => {
          const a = scrXY(0, 0, 0), b = scrXY(1, 0, 0);
          return (
            <>
              <line x1={a.x} y1={a.y + 10} x2={b.x} y2={b.y + 10} stroke="#4060a0" strokeWidth="1.5" />
              <text x={(a.x + b.x) / 2} y={a.y + 20} fill="#4060a0" fontSize="6" fontFamily="monospace" textAnchor="middle">1m</text>
            </>
          );
        })()}
      </g>
    </svg>
  );
}
