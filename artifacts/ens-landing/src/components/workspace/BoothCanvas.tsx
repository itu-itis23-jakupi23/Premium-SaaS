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
  openFront: true,
  openLeft: false,
  openRight: false,
  openBack: false,
};

// ─────────────────────────────────────────────────────────────────
// Perspective projection math
// ─────────────────────────────────────────────────────────────────
type V3 = [number, number, number];

function norm(v: V3): V3 {
  const l = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  return [v[0]/l, v[1]/l, v[2]/l];
}
function cross(a: V3, b: V3): V3 {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function dot(a: V3, b: V3): number {
  return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

interface Camera {
  right: V3; upVec: V3; fwd: V3; eye: V3;
  focal: number; cx: number; cy: number;
}

function makeCamera(eye: V3, target: V3, focal: number, cx: number, cy: number): Camera {
  const fwd = norm([target[0]-eye[0], target[1]-eye[1], target[2]-eye[2]]);
  const worldUp: V3 = [0, 0, 1];
  const right = norm(cross(fwd, worldUp));
  const upVec = cross(right, fwd);
  return { eye, fwd, right, upVec, focal, cx, cy };
}

function project(cam: Camera, x: number, y: number, z: number): [number, number] {
  const rel: V3 = [x - cam.eye[0], y - cam.eye[1], z - cam.eye[2]];
  const vz = dot(cam.fwd, rel);
  if (vz < 0.01) return [cam.cx, cam.cy];
  const vx = dot(cam.right, rel);
  const vy = dot(cam.upVec, rel);
  return [
    cam.cx + (vx / vz) * cam.focal,
    cam.cy - (vy / vz) * cam.focal,
  ];
}

function ptStr(cam: Camera, x: number, y: number, z: number): string {
  const [sx, sy] = project(cam, x, y, z);
  return `${sx.toFixed(1)},${sy.toFixed(1)}`;
}

function polyStr(cam: Camera, ...verts: V3[]): string {
  return verts.map(([x,y,z]) => ptStr(cam, x, y, z)).join(' ');
}

// ─────────────────────────────────────────────────────────────────
// Face brightness (simple diffuse lighting)
// Light direction from top-right-front
// ─────────────────────────────────────────────────────────────────
const LIGHT: V3 = norm([0.6, -0.8, 1.2]);

function brightness(normal: V3): number {
  return Math.max(0.18, dot(normal, LIGHT));
}

// Compute a hex color from a base hex + brightness multiplier
function shade(hex: string, b: number): string {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const bl = parseInt(hex.slice(5,7), 16);
  const cap = (n: number) => Math.min(255, Math.max(0, Math.round(n * b)));
  return `rgb(${cap(r)},${cap(g)},${cap(bl)})`;
}

// ─────────────────────────────────────────────────────────────────
// Polygon face
// ─────────────────────────────────────────────────────────────────
function Face({
  cam, verts, fill, stroke = 'rgba(0,0,0,0.22)', sw = 0.5, opacity = 1,
}: {
  cam: Camera; verts: V3[]; fill: string;
  stroke?: string; sw?: number; opacity?: number;
}) {
  const pts = polyStr(cam, ...verts);
  return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} opacity={opacity} />;
}

// ─────────────────────────────────────────────────────────────────
// Rectangular wall or panel — 4 verts in order
// ─────────────────────────────────────────────────────────────────
function Quad({
  cam, a, b, c, d, fill, stroke = 'rgba(0,0,0,0.18)', sw = 0.5, opacity = 1,
}: {
  cam: Camera; a: V3; b: V3; c: V3; d: V3;
  fill: string; stroke?: string; sw?: number; opacity?: number;
}) {
  return <Face cam={cam} verts={[a,b,c,d]} fill={fill} stroke={stroke} sw={sw} opacity={opacity} />;
}

// ─────────────────────────────────────────────────────────────────
// A rectangular post (thin box) — 3 visible faces
// ─────────────────────────────────────────────────────────────────
function Post({
  cam, x, y, z0, z1, s,
  postLight, postMid, postDark,
}: {
  cam: Camera; x: number; y: number; z0: number; z1: number; s: number;
  postLight: string; postMid: string; postDark: string;
}) {
  const hw = s / 2;
  // The 3 faces we can potentially see depend on camera, but for our fixed camera
  // angle (front-right, looking left-back) we always see: front face (y-hw), right face (x+hw), top cap
  return (
    <>
      {/* Front face of post (facing -y) */}
      <Quad cam={cam}
        a={[x-hw, y-hw, z0]} b={[x+hw, y-hw, z0]}
        c={[x+hw, y-hw, z1]} d={[x-hw, y-hw, z1]}
        fill={postMid} sw={0.4} />
      {/* Right face of post (facing +x) */}
      <Quad cam={cam}
        a={[x+hw, y-hw, z0]} b={[x+hw, y+hw, z0]}
        c={[x+hw, y+hw, z1]} d={[x+hw, y-hw, z1]}
        fill={postDark} sw={0.4} />
      {/* Top cap */}
      <Quad cam={cam}
        a={[x-hw, y-hw, z1]} b={[x+hw, y-hw, z1]}
        c={[x+hw, y+hw, z1]} d={[x-hw, y+hw, z1]}
        fill={postLight} sw={0.4} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Horizontal beam (runs along x axis at fixed y, fixed z)
// ─────────────────────────────────────────────────────────────────
function BeamX({
  cam, x0, x1, y, z, th, fill,
}: { cam: Camera; x0: number; x1: number; y: number; z: number; th: number; fill: string }) {
  // Bottom face visible from below — skip
  // Front face (y-th/2 side)
  return (
    <Quad cam={cam}
      a={[x0, y-th/2, z]} b={[x1, y-th/2, z]}
      c={[x1, y-th/2, z+th]} d={[x0, y-th/2, z+th]}
      fill={fill} sw={0.3} />
  );
}

// ─────────────────────────────────────────────────────────────────
// Horizontal beam along y axis
// ─────────────────────────────────────────────────────────────────
function BeamY({
  cam, x, y0, y1, z, th, fillFront, fillRight,
}: { cam: Camera; x: number; y0: number; y1: number; z: number; th: number; fillFront: string; fillRight: string }) {
  return (
    <>
      {/* Right face (+x side) */}
      <Quad cam={cam}
        a={[x+th/2, y0, z]} b={[x+th/2, y1, z]}
        c={[x+th/2, y1, z+th]} d={[x+th/2, y0, z+th]}
        fill={fillRight} sw={0.3} />
      {/* Front face (-y end) */}
      <Quad cam={cam}
        a={[x-th/2, y0, z]} b={[x+th/2, y0, z]}
        c={[x+th/2, y0, z+th]} d={[x-th/2, y0, z+th]}
        fill={fillFront} sw={0.3} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Dimension label
// ─────────────────────────────────────────────────────────────────
function DimLabel({
  ax, ay, bx, by, label,
}: { ax: number; ay: number; bx: number; by: number; label: string }) {
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2 - 8;
  const len = Math.hypot(bx-ax, by-ay);
  if (len < 10) return null;
  return (
    <g>
      <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#606878" strokeWidth={0.8} strokeDasharray="4,3" />
      <line x1={ax} y1={ay-4} x2={ax} y2={ay+4} stroke="#606878" strokeWidth={0.8} />
      <line x1={bx} y1={by-4} x2={bx} y2={by+4} stroke="#606878" strokeWidth={0.8} />
      <rect x={mx-19} y={my-7} width={38} height={13} rx={4} fill="#181d28" stroke="#3a4258" strokeWidth={0.8} />
      <text x={mx} y={my+0.5} textAnchor="middle" dominantBaseline="middle"
        fill="#8090aa" fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">
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
  const ps  = isMax ? 0.10 : 0.07;   // post width
  const bth = isMax ? 0.07 : 0.055;  // beam thickness
  const fasciaH = isMax ? 0.42 : 0.36;

  // Rail heights
  const railZs: number[] = isMax
    ? [H * 0.5]
    : [H * 0.34, H * 0.68];

  // Post grids
  const backXs  = useMemo(() => { const a: number[] = []; for (let x = 0; x <= W; x += mod) a.push(x); return a; }, [W, mod]);
  const depthYs = useMemo(() => { const a: number[] = []; for (let y = 0; y <= D; y += mod) a.push(y); return a; }, [D, mod]);

  // ── Camera setup ────────────────────────────────────────────
  const cam = useMemo<Camera>(() => {
    // Position: to the right, in front, elevated — matches reference image angle
    const eyeX = W + W * 0.6;
    const eyeY = -D * 1.6;
    const eyeZ = H * 1.5;
    // Look toward center-left of booth, slightly below top
    const tgtX = W * 0.30;
    const tgtY = D * 0.48;
    const tgtZ = H * 0.22;
    return makeCamera(
      [eyeX, eyeY, eyeZ],
      [tgtX, tgtY, tgtZ],
      340,   // focal length
      260,   // center x in SVG
      210,   // center y in SVG
    );
  }, [W, D, H]);

  // ── Colors ──────────────────────────────────────────────────
  const POST_DARK  = '#1c2028';
  const POST_MID   = '#252a36';
  const POST_LIGHT = '#30353e';

  // Panel colors — light with slight shading by wall orientation
  const PANEL_BACK  = '#dde2e8';  // back wall (medium bright)
  const PANEL_LEFT  = '#e8edf3';  // left wall (brightest, faces toward light)
  const PANEL_RIGHT = '#cacfd8';  // right wall (darkest, in shadow)

  const FASCIA_TOP   = '#f0f3f7';
  const FASCIA_FRONT = '#e8ecf2';
  const FASCIA_LEFT  = '#d8dce6';
  const FASCIA_RIGHT = '#c8ccd8';

  // ── Floor extent (outside booth) ───────────────────────────
  const FEX = 3.0;

  // ── Floor grid lines (computed here, rendered inside SVG) ──
  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    for (let xi = -FEX; xi <= W + FEX; xi++) {
      const [ax, ay] = project(cam, xi, -FEX, 0.002);
      const [bx, by] = project(cam, xi, D + FEX, 0.002);
      lines.push(<line key={`gx${xi}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#1a2030" strokeWidth="0.5" />);
    }
    for (let yi = -FEX; yi <= D + FEX; yi++) {
      const [ax, ay] = project(cam, -FEX, yi, 0.002);
      const [bx, by] = project(cam, W + FEX, yi, 0.002);
      lines.push(<line key={`gy${yi}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#1a2030" strokeWidth="0.5" />);
    }
    return lines;
  }, [cam, W, D]);

  return (
    <svg viewBox="0 0 520 400" width="100%" height="100%"
      xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <defs>
        <radialGradient id="bg" cx="40%" cy="40%" r="65%">
          <stop offset="0%"   stopColor="#24283a" />
          <stop offset="60%"  stopColor="#101420" />
          <stop offset="100%" stopColor="#080c12" />
        </radialGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" floodColor="#000010" floodOpacity="0.85" />
        </filter>
      </defs>

      {/* ── Background ──────────────────────────────────── */}
      <rect width="520" height="400" fill="url(#bg)" />

      {/* ── Ground plane ───────────────────────────────── */}
      <Face cam={cam} fill="#0e1218"
        verts={[
          [-FEX, -FEX, 0], [W+FEX, -FEX, 0], [W+FEX, D+FEX, 0], [-FEX, D+FEX, 0],
        ]}
      />

      {/* Subtle floor grid lines */}
      {gridLines}

      {/* ── Inside booth floor ─────────────────────────── */}
      <Face cam={cam} fill="#161a24"
        verts={[[0,0,0.003],[W,0,0.003],[W,D,0.003],[0,D,0.003]]}
      />

      {/* ═══════════════════════════════════════════════════
          ALL BOOTH GEOMETRY IN ONE FILTER GROUP
          ═══════════════════════════════════════════════════ */}
      <g filter="url(#shadow)">

        {/* ── BACK WALL PANELS (y = D) ─────────────────── */}
        {!openBack && backXs.slice(0,-1).map((xi, i) => {
          const x0 = xi + ps / 2;
          const x1 = backXs[i+1] - ps / 2;
          return (
            <Quad key={`bwp${i}`} cam={cam}
              a={[x0, D, 0]} b={[x1, D, 0]}
              c={[x1, D, H]} d={[x0, D, H]}
              fill={PANEL_BACK}
            />
          );
        })}

        {/* ── LEFT WALL PANELS (x = 0) ─────────────────── */}
        {!openLeft && depthYs.slice(0,-1).map((yi, i) => {
          const y0 = yi + ps / 2;
          const y1 = depthYs[i+1] - ps / 2;
          return (
            <Quad key={`lwp${i}`} cam={cam}
              a={[0, y0, 0]} b={[0, y1, 0]}
              c={[0, y1, H]} d={[0, y0, H]}
              fill={PANEL_LEFT}
            />
          );
        })}

        {/* ── RIGHT WALL PANELS (x = W) ────────────────── */}
        {!openRight && depthYs.slice(0,-1).map((yi, i) => {
          const y0 = yi + ps / 2;
          const y1 = depthYs[i+1] - ps / 2;
          return (
            <Quad key={`rwp${i}`} cam={cam}
              a={[W, y0, 0]} b={[W, y1, 0]}
              c={[W, y1, H]} d={[W, y0, H]}
              fill={PANEL_RIGHT}
            />
          );
        })}

        {/* ── FRONT WALL PANELS (y = 0) if closed ─────── */}
        {!openFront && backXs.slice(0,-1).map((xi, i) => {
          const x0 = xi + ps / 2;
          const x1 = backXs[i+1] - ps / 2;
          return (
            <Quad key={`fwp${i}`} cam={cam}
              a={[x0, 0, 0]} b={[x1, 0, 0]}
              c={[x1, 0, H]} d={[x0, 0, H]}
              fill={PANEL_BACK}
            />
          );
        })}

        {/* ── HORIZONTAL RAILS ─────────────────────────── */}
        {railZs.map(rz => (
          <g key={`rail${rz}`}>
            {/* Back wall rails */}
            {!openBack && <BeamX cam={cam} x0={0} x1={W} y={D} z={rz} th={bth} fill={POST_MID} />}
            {/* Left wall rails */}
            {!openLeft && <BeamY cam={cam} x={0} y0={0} y1={D} z={rz} th={bth} fillFront={POST_MID} fillRight={POST_DARK} />}
            {/* Right wall rails */}
            {!openRight && <BeamY cam={cam} x={W} y0={0} y1={D} z={rz} th={bth} fillFront={POST_MID} fillRight={POST_DARK} />}
            {/* Front rail */}
            <BeamX cam={cam} x0={0} x1={W} y={0} z={rz} th={bth} fill={POST_MID} />
          </g>
        ))}

        {/* ── POSTS ─────────────────────────────────────── */}
        {/* Back wall posts */}
        {backXs.map(xi => (
          <Post key={`bp${xi}`} cam={cam} x={xi} y={D} z0={0} z1={H} s={ps}
            postLight={POST_LIGHT} postMid={POST_MID} postDark={POST_DARK} />
        ))}
        {/* Left wall posts */}
        {depthYs.map(yi => (
          <Post key={`lp${yi}`} cam={cam} x={0} y={yi} z0={0} z1={H} s={ps}
            postLight={POST_LIGHT} postMid={POST_MID} postDark={POST_DARK} />
        ))}
        {/* Right wall posts */}
        {depthYs.map(yi => (
          <Post key={`rp${yi}`} cam={cam} x={W} y={yi} z0={0} z1={H} s={ps}
            postLight={POST_LIGHT} postMid={POST_MID} postDark={POST_DARK} />
        ))}
        {/* Front corner posts */}
        <Post cam={cam} x={0} y={0} z0={0} z1={H} s={ps}
          postLight={POST_LIGHT} postMid={POST_MID} postDark={POST_DARK} />
        <Post cam={cam} x={W} y={0} z0={0} z1={H} s={ps}
          postLight={POST_LIGHT} postMid={POST_MID} postDark={POST_DARK} />

        {/* ── FASCIA — solid white box on top ─────────── */}
        {/* Fascia top face (all 4 sides form one large slab top) */}
        <Quad cam={cam}
          a={[-ps/2, -ps/2, H + fasciaH]}
          b={[W+ps/2, -ps/2, H + fasciaH]}
          c={[W+ps/2, D+0.08, H + fasciaH]}
          d={[-ps/2, D+0.08, H + fasciaH]}
          fill={FASCIA_TOP} stroke="rgba(180,185,198,0.3)" sw={0.5}
        />
        {/* Front face of fascia (y=0 side, facing viewer) */}
        <Quad cam={cam}
          a={[-ps/2, -ps/2, H]}
          b={[W+ps/2, -ps/2, H]}
          c={[W+ps/2, -ps/2, H + fasciaH]}
          d={[-ps/2, -ps/2, H + fasciaH]}
          fill={FASCIA_FRONT} stroke="rgba(160,165,178,0.3)" sw={0.5}
        />
        {/* Back face of fascia (y=D) */}
        <Quad cam={cam}
          a={[W+ps/2, D+0.08, H]}
          b={[-ps/2, D+0.08, H]}
          c={[-ps/2, D+0.08, H + fasciaH]}
          d={[W+ps/2, D+0.08, H + fasciaH]}
          fill={FASCIA_FRONT} stroke="rgba(160,165,178,0.3)" sw={0.5}
        />
        {/* Left face of fascia */}
        <Quad cam={cam}
          a={[-ps/2, D+0.08, H]}
          b={[-ps/2, -ps/2, H]}
          c={[-ps/2, -ps/2, H + fasciaH]}
          d={[-ps/2, D+0.08, H + fasciaH]}
          fill={FASCIA_LEFT} stroke="rgba(160,165,178,0.3)" sw={0.5}
        />
        {/* Right face of fascia */}
        <Quad cam={cam}
          a={[W+ps/2, -ps/2, H]}
          b={[W+ps/2, D+0.08, H]}
          c={[W+ps/2, D+0.08, H + fasciaH]}
          d={[W+ps/2, -ps/2, H + fasciaH]}
          fill={FASCIA_RIGHT} stroke="rgba(160,165,178,0.3)" sw={0.5}
        />

      </g>{/* end filter group */}

      {/* ── COMPANY NAME on front fascia face ─────────── */}
      {(() => {
        // Project two points along the front fascia face to get text baseline
        const [ax, ay] = project(cam, W * 0.2, -ps/2 - 0.01, H + fasciaH * 0.5);
        const [bx, by] = project(cam, W * 0.8, -ps/2 - 0.01, H + fasciaH * 0.5);
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
        const textW = Math.hypot(bx-ax, by-ay);
        const fSize = Math.max(6, Math.min(12, textW / (companyName.length * 0.6)));
        return (
          <text
            x={mx} y={my}
            fill="#1e2330"
            fontSize={fSize}
            fontFamily="'Helvetica Neue', Arial, sans-serif"
            fontWeight="500"
            letterSpacing={fSize * 0.55}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(${ang}, ${mx}, ${my})`}
          >
            {companyName}
          </text>
        );
      })()}

      {/* ── DIMENSION LABELS ───────────────────────────── */}
      {/* Width (along x at front of booth, below floor) */}
      {(() => {
        const [ax, ay] = project(cam, 0, -0.8, 0);
        const [bx, by] = project(cam, W, -0.8, 0);
        return <DimLabel ax={ax} ay={ay} bx={bx} by={by} label={`${W.toFixed(1)} m`} />;
      })()}
      {/* Depth (along y at right of booth) */}
      {(() => {
        const [ax, ay] = project(cam, W + 0.7, 0, 0);
        const [bx, by] = project(cam, W + 0.7, D, 0);
        return <DimLabel ax={ax} ay={ay} bx={bx} by={by} label={`${D.toFixed(1)} m`} />;
      })()}
      {/* Height (vertical at front-left corner) */}
      {(() => {
        const [ax, ay] = project(cam, -0.7, 0, 0);
        const [bx, by] = project(cam, -0.7, 0, H);
        return <DimLabel ax={ax} ay={ay} bx={bx} by={by} label={`${H.toFixed(1)} m`} />;
      })()}

      {/* ── SCALE BAR ──────────────────────────────────── */}
      {(() => {
        const [ax, ay] = project(cam, W * 0.65, -0.7, 0);
        const [bx, by] = project(cam, W * 0.65 + 1, -0.7, 0);
        const len = Math.hypot(bx-ax, by-ay);
        return (
          <g opacity="0.5">
            <rect x={bx + 8} y={by - 8} width={38} height={13} rx={3} fill="#181d28" />
            <text x={bx + 27} y={by - 1.5} textAnchor="middle" dominantBaseline="middle"
              fill="#5a6880" fontSize="7" fontFamily="monospace">
              scale 1.0 m
            </text>
          </g>
        );
      })()}

      {/* ── SYSTEM BADGE ───────────────────────────────── */}
      <rect x="14" y="14" width={isMax ? 80 : 88} height="20" rx="5"
        fill="#181d2c" stroke="#2a3045" strokeWidth="0.8" />
      <text x={isMax ? 54 : 58} y="26" textAnchor="middle" fill="#606888" fontSize="7.5"
        fontFamily="'Helvetica Neue',Arial,sans-serif" fontWeight="600" letterSpacing="1.5">
        {isMax ? '◈ MAXIMA' : '⬡ OCTANORM'}
      </text>
    </svg>
  );
}
