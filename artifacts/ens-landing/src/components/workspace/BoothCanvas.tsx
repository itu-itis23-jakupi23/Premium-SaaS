import { useMemo } from 'react';

export type BoothSystem = 'octanorm' | 'maxima';

export interface BoothConfig {
  width: number;
  depth: number;
  height: number;
  system: BoothSystem;
  companyName: string;
  openFront?: boolean;
  openRight?: boolean;
  openLeft?: boolean;
}

const DEFAULT_CONFIG: BoothConfig = {
  width: 8,
  depth: 6,
  height: 3,
  system: 'octanorm',
  companyName: 'TECHCORP INDUSTRIES',
  openFront: true,
  openRight: false,
  openLeft: false,
};

// Scale: pixels per meter
const SH = 24;
const SV = 28;
// SVG canvas center origin (where front-left floor corner projects to)
const CX = 188;
const CY = 158;

function isoXY(x: number, y: number, z: number): [number, number] {
  return [(x - y) * 0.866 * SH, (x + y) * 0.5 * SH - z * SV];
}

function pt(x: number, y: number, z: number): string {
  const [px, py] = isoXY(x, y, z);
  return `${(px + CX).toFixed(1)},${(py + CY).toFixed(1)}`;
}

function poly(...coords: [number, number, number][]): string {
  return coords.map(([x, y, z]) => pt(x, y, z)).join(' ');
}

function textAnchor(x: number, y: number, z: number): { x: number; y: number } {
  const [px, py] = isoXY(x, y, z);
  return { x: px + CX, y: py + CY };
}

interface BoxProps {
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  top: string; front: string; side: string;
  stroke?: string; strokeWidth?: number;
}

function Box({ x, y, z, w, d, h, top, front, side, stroke = 'none', strokeWidth = 0.5 }: BoxProps) {
  return (
    <g>
      <polygon points={poly([x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h])} fill={side} stroke={stroke} strokeWidth={strokeWidth} />
      <polygon points={poly([x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h])} fill={front} stroke={stroke} strokeWidth={strokeWidth} />
      <polygon points={poly([x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h])} fill={top} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
}

// Thin horizontal rail/beam drawn as a flat plane
function Rail({ x1, y1, x2, y2, z, thickness, color }: {
  x1:number; y1:number; x2:number; y2:number; z:number; thickness:number; color:string;
}) {
  return (
    <polygon
      points={poly([x1,y1,z],[x2,y2,z],[x2,y2,z+thickness],[x1,y1,z+thickness])}
      fill={color}
    />
  );
}

// A thin upright post column
function Post({ x, y, h, pw, pd, postColor, capColor }: {
  x:number; y:number; h:number; pw:number; pd:number; postColor:string; capColor:string;
}) {
  const cx2 = x - pw / 2;
  const cy2 = y - pd / 2;
  return (
    <g>
      {/* Post body */}
      <polygon points={poly([cx2+pw,cy2,0],[cx2+pw,cy2+pd,0],[cx2+pw,cy2+pd,h],[cx2+pw,cy2,h])} fill={postColor} />
      <polygon points={poly([cx2,cy2,0],[cx2+pw,cy2,0],[cx2+pw,cy2,h],[cx2,cy2,h])} fill={postColor} />
      <polygon points={poly([cx2,cy2,h],[cx2+pw,cy2,h],[cx2+pw,cy2+pd,h],[cx2,cy2+pd,h])} fill={capColor} />
    </g>
  );
}

// Octanorm connector node (small cube at joint)
function Connector({ x, y, z, size, color }: { x:number; y:number; z:number; size:number; color:string }) {
  const s = size / 2;
  return (
    <Box x={x-s} y={y-s} z={z-s} w={size} d={size} h={size}
      top={color} front={color} side={color} />
  );
}

// A shelf panel (thin horizontal slab)
function ShelfPanel({ x, y, z, w, d, color }: { x:number; y:number; z:number; w:number; d:number; color:string }) {
  return (
    <polygon
      points={poly([x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z])}
      fill={color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.5"
    />
  );
}

const OCTANORM = {
  postColor: '#8a9bae',
  postCapColor: '#6a7f90',
  railColor: '#7a8fa0',
  panelFill: 'rgba(195,215,232,0.22)',
  panelStroke: 'rgba(140,170,200,0.5)',
  fasciaColor: '#1a3a6e',
  fasciaAccent: '#2a5fa8',
  carpetColor: '#1c2844',
  carpetAlt: '#1a2640',
  module: 1,
  postW: 0.07,
  postD: 0.07,
  fasciaH: 0.34,
  railH: 0.05,
  connectorSize: 0.10,
  midRail: true,
};

const MAXIMA = {
  postColor: '#b09060',
  postCapColor: '#c8a870',
  railColor: '#a08050',
  panelFill: 'rgba(230,218,200,0.28)',
  panelStroke: 'rgba(180,155,120,0.5)',
  fasciaColor: '#2a1648',
  fasciaAccent: '#4a2880',
  carpetColor: '#1e1830',
  carpetAlt: '#1c162a',
  module: 2,
  postW: 0.10,
  postD: 0.10,
  fasciaH: 0.42,
  railH: 0.06,
  connectorSize: 0.0,
  midRail: false,
};

function OctanormBackWall({ W, D, H, cfg }: { W:number; D:number; H:number; cfg: typeof OCTANORM }) {
  const { module, postW, postD, postColor, postCapColor, railColor, panelFill, panelStroke, railH, midRail, connectorSize } = cfg;
  const posts: number[] = [];
  for (let xi = 0; xi <= W; xi += module) posts.push(xi);

  const railZs = [0, H];
  if (midRail) railZs.push(H * 0.45);

  return (
    <g>
      {/* Wall panel fill */}
      <polygon points={poly([0,D,0],[W,D,0],[W,D,H],[0,D,H])} fill={panelFill} stroke={panelStroke} strokeWidth="0.5" />

      {/* Panel grid lines (inner horizontal divisions) */}
      {[H * 0.45].map(zr => (
        <line
          key={zr}
          x1={textAnchor(0, D, zr).x} y1={textAnchor(0, D, zr).y}
          x2={textAnchor(W, D, zr).x} y2={textAnchor(W, D, zr).y}
          stroke={panelStroke} strokeWidth="0.7" strokeDasharray="2,2"
        />
      ))}

      {/* Horizontal rails */}
      {railZs.map(zr => (
        <polygon key={zr}
          points={poly([0,D,zr],[W,D,zr],[W,D,zr+railH],[0,D,zr+railH])}
          fill={railColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.3"
        />
      ))}

      {/* Vertical posts */}
      {posts.map(xi => (
        <Post key={xi} x={xi} y={D} h={H} pw={postW} pd={postD} postColor={postColor} capColor={postCapColor} />
      ))}

      {/* Octanorm connector nodes at joints */}
      {connectorSize > 0 && posts.map(xi =>
        railZs.map(zr => (
          <Connector key={`${xi}-${zr}`} x={xi} y={D} z={zr} size={connectorSize} color={postCapColor} />
        ))
      )}
    </g>
  );
}

function OctanormLeftWall({ W, D, H, cfg }: { W:number; D:number; H:number; cfg: typeof OCTANORM }) {
  const { module, postW, postD, postColor, postCapColor, railColor, panelFill, panelStroke, railH, midRail } = cfg;
  const posts: number[] = [];
  for (let yi = 0; yi <= D; yi += module) posts.push(yi);

  const railZs = [0, H];
  if (midRail) railZs.push(H * 0.45);

  return (
    <g>
      {/* Wall panel fill */}
      <polygon points={poly([0,0,0],[0,D,0],[0,D,H],[0,0,H])} fill={panelFill} stroke={panelStroke} strokeWidth="0.5" />

      {/* Horizontal rails */}
      {railZs.map(zr => (
        <polygon key={zr}
          points={poly([0,0,zr],[0,D,zr],[0,D,zr+railH],[0,0,zr+railH])}
          fill={railColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.3"
        />
      ))}

      {/* Vertical posts */}
      {posts.map(yi => (
        <Post key={yi} x={0} y={yi} h={H} pw={postW} pd={postD} postColor={postColor} capColor={postCapColor} />
      ))}
    </g>
  );
}

function OctanormRightWall({ W, D, H, cfg }: { W:number; D:number; H:number; cfg: typeof OCTANORM }) {
  const { module, postW, postD, postColor, postCapColor, railColor, panelFill, panelStroke, railH, midRail } = cfg;
  const posts: number[] = [];
  for (let yi = 0; yi <= D; yi += module) posts.push(yi);
  const railZs = [0, H];
  if (midRail) railZs.push(H * 0.45);

  return (
    <g>
      <polygon points={poly([W,0,0],[W,D,0],[W,D,H],[W,0,H])} fill={panelFill} stroke={panelStroke} strokeWidth="0.5" />
      {railZs.map(zr => (
        <polygon key={zr}
          points={poly([W,0,zr],[W,D,zr],[W,D,zr+railH],[W,0,zr+railH])}
          fill={railColor} stroke="rgba(0,0,0,0.3)" strokeWidth="0.3"
        />
      ))}
      {posts.map(yi => (
        <Post key={yi} x={W} y={yi} h={H} pw={postW} pd={postD} postColor={postColor} capColor={postCapColor} />
      ))}
    </g>
  );
}

function Fascia({ W, D, H, cfg, companyName, system }: {
  W:number; D:number; H:number; cfg: typeof OCTANORM; companyName: string; system: BoothSystem;
}) {
  const { fasciaH, fasciaColor, fasciaAccent } = cfg;
  const fH = H;
  const fTop = H + fasciaH;

  // Fascia labels - text using SVG text
  // We project a center point on each fascia face for text placement
  const backCenter = textAnchor(W / 2, D, fH + fasciaH / 2);
  const leftCenter = textAnchor(0, D / 2, fH + fasciaH / 2);

  return (
    <g>
      {/* Back fascia face */}
      <polygon
        points={poly([0,D,fH],[W,D,fH],[W,D,fTop],[0,D,fTop])}
        fill={fasciaColor} stroke={fasciaAccent} strokeWidth="0.8"
      />
      {/* Left fascia face */}
      <polygon
        points={poly([0,0,fH],[0,D,fH],[0,D,fTop],[0,0,fTop])}
        fill={fasciaColor} stroke={fasciaAccent} strokeWidth="0.8"
      />
      {/* Fascia top cap */}
      <polygon
        points={poly([0,D,fTop],[W,D,fTop],[W,D+0.05,fTop],[0,D+0.05,fTop])}
        fill={fasciaAccent}
      />
      {/* Accent LED strip at bottom of fascia - back */}
      <polygon
        points={poly([0,D,fH],[W,D,fH],[W,D,fH+0.04],[0,D,fH+0.04])}
        fill={system === 'maxima' ? '#9966ff' : '#4488ff'} opacity="0.9"
      />
      {/* Accent LED strip - left wall */}
      <polygon
        points={poly([0,0,fH],[0,D,fH],[0,D,fH+0.04],[0,0,fH+0.04])}
        fill={system === 'maxima' ? '#9966ff' : '#4488ff'} opacity="0.9"
      />
      {/* Company name on back fascia */}
      <text
        x={backCenter.x}
        y={backCenter.y}
        fill="white"
        fontSize="7"
        fontFamily="'Space Mono', monospace"
        fontWeight="bold"
        letterSpacing="2"
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`skewX(-${Math.atan2((isoXY(W, D, 0)[1] - isoXY(0, D, 0)[1]), (isoXY(W, D, 0)[0] - isoXY(0, D, 0)[0])) * 180 / Math.PI})`}
      >
        {companyName}
      </text>
    </g>
  );
}

// Spotlight fixture on fascia
function Spotlight({ x, y, z }: { x:number; y:number; z:number }) {
  const p = textAnchor(x, y, z);
  return (
    <g>
      <circle cx={p.x} cy={p.y} r={3} fill="#e0e8f0" stroke="#c0ccd8" strokeWidth="0.5" />
      <circle cx={p.x} cy={p.y} r={5} fill="none" stroke="rgba(200,220,255,0.3)" strokeWidth="0.5" />
      {/* Light cone */}
      <ellipse cx={p.x} cy={p.y + 8} rx={4} ry={2} fill="rgba(200,220,255,0.08)" />
    </g>
  );
}

function OctanormFurniture({ W, D, system }: { W:number; D:number; system: BoothSystem }) {
  const isMax = system === 'maxima';
  // Color schemes
  const counterColors = isMax
    ? { top: '#f0ece4', front: '#c8c0b0', side: '#a0987e' }
    : { top: '#edf2f7', front: '#b8c8d8', side: '#8090a8' };
  const woodColors = isMax
    ? { top: '#d4a870', front: '#a8804c', side: '#806030' }
    : { top: '#c89860', front: '#9a7040', side: '#785030' };
  const whiteBoxColors = isMax
    ? { top: '#e8e0d4', front: '#c0b8a8', side: '#9890808' }
    : { top: '#dfe8f0', front: '#b0c0d0', side: '#8898b0' };
  const shelfColor = isMax ? '#d8d0c0' : '#d0dce8';
  const productColors = ['#e05050', '#50a0e0', '#50c050', '#e0a020', '#a050e0'];

  return (
    <g>
      {/* ── BACK WALL AREA ─────────────────────────────────────── */}

      {/* Left shelving unit (against back wall) */}
      <Box x={0.4} y={D-0.5} z={0} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={0.4} y={D-0.5} z={0.6} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={0.4} y={D-0.5} z={1.2} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={0.4} y={D-0.5} z={1.8} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      {/* Side uprights of shelving */}
      <Box x={0.4} y={D-0.5} z={0} w={0.04} d={0.45} h={1.85}
        top="#b0bcc8" front="#b0bcc8" side="#8090a0" />
      <Box x={2.56} y={D-0.5} z={0} w={0.04} d={0.45} h={1.85}
        top="#b0bcc8" front="#b0bcc8" side="#8090a0" />
      {/* Products on shelves (colored items) */}
      {[0, 0.6, 1.2].map((shz, si) =>
        [0, 0.35, 0.7, 1.05, 1.55].map((xi, pi) => (
          <Box key={`prod-${si}-${pi}`}
            x={0.5+xi} y={D-0.49} z={shz+0.04} w={0.25} d={0.3} h={0.45}
            top={productColors[(si * 5 + pi) % 5]}
            front={productColors[(si * 5 + pi) % 5] + 'cc'}
            side={productColors[(si * 5 + pi) % 5] + '88'}
          />
        ))
      )}

      {/* Central large display totem */}
      <Box x={W/2-0.35} y={D-0.45} z={0} w={0.7} d={0.3} h={0.06}
        top="#a0b0c0" front="#8090a0" side="#708090" />
      {/* Totem body */}
      <Box x={W/2-0.2} y={D-0.44} z={0.06} w={0.4} d={0.25} h={2.2}
        top={whiteBoxColors.top} front={whiteBoxColors.front} side={whiteBoxColors.side}
        stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      {/* Monitor on totem */}
      <Box x={W/2-0.35} y={D-0.46} z={1.0} w={0.7} d={0.06} h={0.5}
        top="#1a2840" front="#0a1828" side="#0a1828" />
      {/* Screen glow */}
      <polygon
        points={poly([W/2-0.33, D-0.455, 1.01],[W/2+0.33, D-0.455, 1.01],[W/2+0.33, D-0.455, 1.49],[W/2-0.33, D-0.455, 1.49])}
        fill={isMax ? '#3a2060' : '#0a2a5a'} opacity="0.9"
      />

      {/* Right shelving unit */}
      <Box x={W-2.6} y={D-0.5} z={0} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={W-2.6} y={D-0.5} z={0.6} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={W-2.6} y={D-0.5} z={1.2} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={W-2.6} y={D-0.5} z={1.8} w={2.2} d={0.45} h={0.04}
        top={shelfColor} front="#b0bcc8" side="#8898a8" />
      <Box x={W-2.6} y={D-0.5} z={0} w={0.04} d={0.45} h={1.85}
        top="#b0bcc8" front="#b0bcc8" side="#8090a0" />
      <Box x={W-0.44} y={D-0.5} z={0} w={0.04} d={0.45} h={1.85}
        top="#b0bcc8" front="#b0bcc8" side="#8090a0" />
      {[0, 0.6, 1.2].map((shz, si) =>
        [0, 0.35, 0.7, 1.05, 1.55].map((xi, pi) => (
          <Box key={`rprod-${si}-${pi}`}
            x={W-2.5+xi} y={D-0.49} z={shz+0.04} w={0.25} d={0.3} h={0.45}
            top={productColors[(si * 3 + pi + 2) % 5]}
            front={productColors[(si * 3 + pi + 2) % 5] + 'cc'}
            side={productColors[(si * 3 + pi + 2) % 5] + '88'}
          />
        ))
      )}

      {/* ── CENTER AREA ─────────────────────────────────────────── */}

      {/* Meeting table */}
      {/* Table legs */}
      {([[2.2, 2.1],[4.3,2.1],[4.3,3.2],[2.2,3.2]] as [number,number][]).map(([tx, ty], i) => (
        <Box key={`leg-${i}`} x={tx} y={ty} z={0} w={0.06} d={0.06} h={0.72}
          top={woodColors.side} front={woodColors.side} side={woodColors.side} />
      ))}
      {/* Table top */}
      <Box x={2.1} y={2.0} z={0.72} w={2.3} d={1.35} h={0.06}
        top={woodColors.top} front={woodColors.front} side={woodColors.side}
        stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      {/* Table items: laptop + papers */}
      <Box x={2.7} y={2.15} z={0.78} w={0.5} d={0.35} h={0.02}
        top="#e8edf2" front="#b0bcc8" side="#8898a8" />
      <Box x={3.5} y={2.2} z={0.78} w={0.6} d={0.4} h={0.01}
        top="white" front="white" side="#d0d8e0" />

      {/* Chairs (4 around table) */}
      {/* Front chairs */}
      <Box x={2.3} y={1.4} z={0} w={0.55} d={0.5} h={0.45}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      <Box x={2.3} y={1.4} z={0.45} w={0.55} d={0.06} h={0.45}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      <Box x={3.2} y={1.4} z={0} w={0.55} d={0.5} h={0.45}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      <Box x={3.2} y={1.4} z={0.45} w={0.55} d={0.06} h={0.45}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      {/* Back chairs */}
      <Box x={2.3} y={3.35} z={0} w={0.55} d={0.5} h={0.45}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      <Box x={3.2} y={3.35} z={0} w={0.55} d={0.5} h={0.45}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />

      {/* ── FRONT AREA ──────────────────────────────────────────── */}

      {/* Left info kiosk / brochure stand */}
      <Box x={0.4} y={0.5} z={0} w={0.5} d={0.5} h={0.04}
        top="#a0b0c0" front="#8090a0" side="#708090" />
      <Box x={0.6} y={0.6} z={0.04} w={0.1} d={0.3} h={1.2}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      {/* Brochure pockets */}
      {[0.3, 0.6, 0.9].map((bz, i) => (
        <Box key={`broch-${i}`} x={0.4} y={0.5} z={bz} w={0.55} d={0.06} h={0.22}
          top={productColors[i]} front={productColors[i]+'cc'} side={productColors[i]+'88'} />
      ))}

      {/* Reception counter (front-right area, L-shape) */}
      {/* Main counter body */}
      <Box x={W-3.0} y={0.4} z={0} w={2.6} d={0.75} h={1.05}
        top={counterColors.top} front={counterColors.front} side={counterColors.side}
        stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      {/* Counter top detail edge */}
      <polygon
        points={poly([W-3.0,0.4,1.05],[W-0.4,0.4,1.05],[W-0.4,0.4,1.08],[W-3.0,0.4,1.08])}
        fill={isMax ? '#c8a870' : '#6090b8'}
      />
      {/* Counter return (right side extension) */}
      <Box x={W-0.75} y={0.4} z={0} w={0.35} d={1.2} h={1.05}
        top={counterColors.top} front={counterColors.front} side={counterColors.side} />
      {/* Reception desk items */}
      <Box x={W-2.6} y={0.42} z={1.05} w={0.45} d={0.35} h={0.04}
        top="#e8edf2" front="#b0bcc8" side="#8898a8" />
      {/* Monitor at reception */}
      <Box x={W-1.8} y={0.38} z={1.05} w={0.04} d={0.02} h={0.3}
        top="#2a3040" front="#1a2030" side="#1a2030" />
      <Box x={W-1.95} y={0.34} z={1.35} w={0.34} d={0.04} h={0.24}
        top="#1a2840" front="#0a1828" side="#0a1828" />
      <polygon
        points={poly([W-1.93,0.35,1.36],[W-1.63,0.35,1.36],[W-1.63,0.35,1.58],[W-1.93,0.35,1.58])}
        fill={isMax ? '#3a2060' : '#0a2a5a'}
      />
    </g>
  );
}

export function BoothCanvas({ config }: { config?: Partial<BoothConfig> }) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const { width: W, depth: D, height: H, system, companyName } = cfg;
  const wallCfg = system === 'octanorm' ? OCTANORM : MAXIMA;

  // Exhibition hall floor (large parallelogram, extends beyond booth)
  const hallExt = 1.5;

  const hallFloorColor = '#0d1220';
  const carpetColor = wallCfg.carpetColor;

  // Grid lines on hall floor
  const gridLines = useMemo(() => {
    const lines = [];
    const ext = hallExt;
    // Along X axis
    for (let yi = -ext; yi <= D + ext; yi += 0.5) {
      lines.push({ type: 'x', y: yi });
    }
    // Along Y axis
    for (let xi = -ext; xi <= W + ext; xi += 0.5) {
      lines.push({ type: 'y', x: xi });
    }
    return lines;
  }, [W, D]);

  // Spotlights along fascia
  const spotlightPositions = useMemo(() => {
    const spots: { x: number; y: number }[] = [];
    for (let xi = 1; xi < W; xi += 2) spots.push({ x: xi, y: D });
    for (let yi = 1; yi < D; yi += 2) spots.push({ x: 0, y: yi });
    return spots;
  }, [W, D]);

  return (
    <svg
      viewBox="0 0 500 380"
      width="100%"
      height="100%"
      style={{ display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Ambient glow for the scene */}
        <radialGradient id="sceneGlow" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor={system === 'maxima' ? '#3a1860' : '#0a2050'} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#050810" stopOpacity="0" />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="softGlow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="500" height="380" fill="#080d18" />

      {/* Scene ambient glow */}
      <rect width="500" height="380" fill="url(#sceneGlow)" />

      {/* ── 1. Exhibition hall floor ──────────────────────────── */}
      <polygon
        points={poly(
          [-hallExt, -hallExt, 0],
          [W + hallExt, -hallExt, 0],
          [W + hallExt, D + hallExt, 0],
          [-hallExt, D + hallExt, 0]
        )}
        fill={hallFloorColor}
      />

      {/* Hall floor grid */}
      <g opacity="0.18" stroke="#2a4060" strokeWidth="0.4">
        {gridLines.map((gl, i) => gl.type === 'x'
          ? <line key={i}
              x1={textAnchor(-hallExt, gl.y!, 0).x} y1={textAnchor(-hallExt, gl.y!, 0).y}
              x2={textAnchor(W+hallExt, gl.y!, 0).x} y2={textAnchor(W+hallExt, gl.y!, 0).y}
            />
          : <line key={i}
              x1={textAnchor(gl.x!, -hallExt, 0).x} y1={textAnchor(gl.x!, -hallExt, 0).y}
              x2={textAnchor(gl.x!, D+hallExt, 0).x} y2={textAnchor(gl.x!, D+hallExt, 0).y}
            />
        )}
      </g>

      {/* ── 2. Booth carpet floor ─────────────────────────────── */}
      <polygon
        points={poly([0,0,0],[W,0,0],[W,D,0],[0,D,0])}
        fill={carpetColor}
        stroke="rgba(100,140,200,0.3)"
        strokeWidth="0.6"
      />
      {/* Carpet subtle pattern */}
      <polygon
        points={poly([0.05,0.05,0.001],[W-0.05,0.05,0.001],[W-0.05,D-0.05,0.001],[0.05,D-0.05,0.001])}
        fill="none"
        stroke={system === 'maxima' ? 'rgba(160,130,80,0.15)' : 'rgba(80,120,180,0.12)'}
        strokeWidth="1"
      />

      {/* ── 3. Right wall (before back wall in painter order) ──── */}
      {!cfg.openRight && <OctanormRightWall W={W} D={D} H={H} cfg={wallCfg} />}

      {/* ── 4. Back wall ──────────────────────────────────────── */}
      <OctanormBackWall W={W} D={D} H={H} cfg={wallCfg} />

      {/* ── 5. Left wall ─────────────────────────────────────── */}
      {!cfg.openLeft && <OctanormLeftWall W={W} D={D} H={H} cfg={wallCfg} />}

      {/* ── 6. Furniture ─────────────────────────────────────── */}
      <OctanormFurniture W={W} D={D} system={system} />

      {/* ── 7. Fascia headers ─────────────────────────────────── */}
      <Fascia W={W} D={D} H={H} cfg={wallCfg} companyName={companyName} system={system} />

      {/* ── 8. Spotlights on fascia ───────────────────────────── */}
      {spotlightPositions.map((sp, i) => (
        <Spotlight key={i} x={sp.x} y={sp.y} z={H + wallCfg.fasciaH + 0.05} />
      ))}

      {/* ── 9. Corner caps on top of posts ───────────────────── */}
      {/* Top corner connectors */}
      <Box x={-0.05} y={D-0.05} z={H} w={0.12} d={0.12} h={0.06}
        top={wallCfg.postCapColor} front={wallCfg.postCapColor} side={wallCfg.postColor} />
      <Box x={W-0.05} y={D-0.05} z={H} w={0.12} d={0.12} h={0.06}
        top={wallCfg.postCapColor} front={wallCfg.postCapColor} side={wallCfg.postColor} />
      {!cfg.openLeft && (
        <Box x={-0.05} y={-0.05} z={H} w={0.12} d={0.12} h={0.06}
          top={wallCfg.postCapColor} front={wallCfg.postCapColor} side={wallCfg.postColor} />
      )}

      {/* System label badge */}
      <g transform="translate(14, 14)">
        <rect rx="4" ry="4" width="90" height="20" fill={wallCfg.fasciaColor} opacity="0.9" />
        <text x="8" y="14" fill="white" fontSize="8" fontFamily="monospace" fontWeight="bold" letterSpacing="1">
          {system === 'octanorm' ? '⬡ OCTANORM' : '◈ MAXIMA'}
        </text>
      </g>

      {/* Scale indicator */}
      <g transform={`translate(14, 350)`}>
        <line
          x1={textAnchor(0,0,0).x - CX + 14} y1={textAnchor(0,0,0).y - CY}
          x2={textAnchor(1,0,0).x - CX + 14} y2={textAnchor(1,0,0).y - CY}
          stroke="#4060a0" strokeWidth="1"
        />
        <text x={textAnchor(0.5, 0, 0).x - CX + 11} y={textAnchor(0, 0, 0).y - CY + 8}
          fill="#4060a0" fontSize="6" fontFamily="monospace" textAnchor="middle">1m</text>
      </g>
    </svg>
  );
}
