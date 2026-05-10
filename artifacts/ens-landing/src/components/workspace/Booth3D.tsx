import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { BoothCanvas } from './BoothCanvas';

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(
      c.getContext('webgl2') ||
      c.getContext('webgl') ||
      (c as any).getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}
import {
  OrbitControls,
  ContactShadows,
  Grid,
  Text,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────
// Types
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
}

const DEFAULT: BoothConfig3D = {
  width: 8,
  depth: 6,
  height: 3,
  system: 'octanorm',
  companyName: 'TECHCORP INDUSTRIES',
  primaryColor: '#1a3a7a',
  carpetColor: '#1a2640',
  openFront: true,
  openLeft: false,
  openRight: false,
};

// ─────────────────────────────────────────────────────────────────
// Primitive helpers
// ─────────────────────────────────────────────────────────────────
function Post({
  x, y = 0, z, h, size, mat,
}: { x: number; y?: number; z: number; h: number; size: number; mat: THREE.Material }) {
  return (
    <mesh position={[x, y + h / 2, z]} castShadow receiveShadow material={mat}>
      <boxGeometry args={[size, h, size]} />
    </mesh>
  );
}

function Beam({
  x1, z1, x2, z2, y, t = 0.055, mat,
}: { x1: number; z1: number; x2: number; z2: number; y: number; t?: number; mat: THREE.Material }) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2(z2 - z1, x2 - x1);
  return (
    <mesh position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} rotation={[0, -ang, 0]} castShadow material={mat}>
      <boxGeometry args={[len, t, t]} />
    </mesh>
  );
}

function GlassPanel({
  x, y, z, w, h, rotY = 0,
}: { x: number; y: number; z: number; w: number; h: number; rotY?: number }) {
  return (
    <mesh position={[x, y, z]} rotation={[0, rotY, 0]}>
      <planeGeometry args={[w, h]} />
      <meshPhysicalMaterial
        color="#d0e4f4"
        roughness={0.05}
        metalness={0}
        transparent
        opacity={0.22}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Box({
  pos, size, color, roughness = 0.7, metalness = 0, emissive, emissiveIntensity = 0, castShadow: cs = true,
}: {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
}) {
  return (
    <mesh position={pos} castShadow={cs} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive ?? color}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────
// Furniture
// ─────────────────────────────────────────────────────────────────
function ReceptionCounter({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {/* Body */}
      <Box pos={[0, 0.525, 0]} size={[2.6, 1.05, 0.72]} color="#ecf0f5" roughness={0.65} />
      {/* Top edge strip (aluminum accent) */}
      <Box pos={[0, 1.058, 0]} size={[2.62, 0.038, 0.74]} color="#b0bcc8" roughness={0.25} metalness={0.7} />
      {/* Front graphic panel */}
      <Box pos={[0, 0.5, -0.363]} size={[2.58, 0.95, 0.02]} color="#1a3a7a" roughness={0.5} emissiveIntensity={0.04} emissive="#1a3a7a" />
      {/* Under-counter LED */}
      <Box pos={[0, 0.04, -0.365]} size={[2.4, 0.02, 0.01]} color="#88aaff" roughness={0.3} emissive="#4488ff" emissiveIntensity={3} castShadow={false} />
      {/* Monitor stand */}
      <Box pos={[0.6, 1.09, -0.1]} size={[0.035, 0.28, 0.035]} color="#303840" roughness={0.5} />
      {/* Monitor screen */}
      <Box pos={[0.6, 1.44, -0.08]} size={[0.58, 0.36, 0.04]} color="#0a1020" roughness={0.25} />
      <mesh position={[0.6, 1.44, -0.057]}>
        <planeGeometry args={[0.52, 0.3]} />
        <meshStandardMaterial color="#1a3a8a" emissive="#1a3a8a" emissiveIntensity={1.4} />
      </mesh>
      {/* Laptop */}
      <Box pos={[-0.65, 1.08, -0.12]} size={[0.38, 0.02, 0.28]} color="#c0c8d2" roughness={0.35} metalness={0.55} />
      <Box pos={[-0.65, 1.18, -0.26]} size={[0.38, 0.24, 0.02]} color="#c0c8d2" roughness={0.35} metalness={0.55} />
      {/* Return section */}
      <Box pos={[1.66, 0.525, 0.42]} size={[0.36, 1.05, 1.2]} color="#ecf0f5" roughness={0.65} />
    </group>
  );
}

function ShelvingUnit({ p }: { p: [number, number, number] }) {
  const colors = ['#e04848', '#3a94e0', '#40c458', '#dba020', '#9040e0'];
  return (
    <group position={p}>
      {/* Back panel */}
      <Box pos={[0, 0.975, 0]} size={[2.4, 1.95, 0.06]} color="#e4eaf0" roughness={0.8} />
      {/* Side uprights */}
      {([-1.17, 1.17] as number[]).map((sx, i) => (
        <Box key={i} pos={[sx, 0.975, 0.22]} size={[0.04, 1.95, 0.44]} color="#d4dce8" roughness={0.75} />
      ))}
      {/* Shelves */}
      {[0.04, 0.68, 1.32, 1.92].map((sy, si) => (
        <Box key={si} pos={[0, sy, 0.22]} size={[2.38, 0.03, 0.44]} color="#d8e0ea" roughness={0.7} />
      ))}
      {/* Products on first 3 shelves */}
      {[0.04, 0.68, 1.32].map((sy, si) =>
        ([-0.9, -0.58, -0.26, 0.06, 0.38, 0.7, 1.0] as number[]).map((sx, pi) => (
          <Box
            key={`${si}-${pi}`}
            pos={[sx, sy + 0.2, 0.22]}
            size={[0.26, 0.36, 0.28]}
            color={colors[(si * 7 + pi) % 5]}
            roughness={0.75}
          />
        ))
      )}
      {/* Top items */}
      {([-0.7, 0, 0.7] as number[]).map((sx, i) => (
        <Box key={i} pos={[sx, 2.05, 0.15]} size={[0.5, 0.22, 0.3]} color={colors[i % 5]} roughness={0.6} />
      ))}
    </group>
  );
}

function MeetingTable({ p }: { p: [number, number, number] }) {
  return (
    <group position={p}>
      {/* Table top */}
      <Box pos={[0, 0.74, 0]} size={[2.5, 0.055, 1.4]} color="#c09050" roughness={0.55} />
      {/* Edge banding */}
      <Box pos={[0, 0.72, 0]} size={[2.5, 0.015, 1.42]} color="#a07838" roughness={0.4} metalness={0.1} />
      {/* Legs */}
      {([[-1.1, -0.58], [1.1, -0.58], [1.1, 0.58], [-1.1, 0.58]] as [number, number][]).map(([lx, lz], i) => (
        <Box key={i} pos={[lx, 0.37, lz]} size={[0.06, 0.74, 0.06]} color="#906830" roughness={0.6} />
      ))}
      {/* Crossbar */}
      <Box pos={[0, 0.12, 0]} size={[2.1, 0.05, 0.05]} color="#906830" roughness={0.6} />
      {/* Chairs */}
      {([
        [-1.55, 0, 0, 0],
        [1.55, 0, 0, Math.PI],
        [0, 0, -0.98, Math.PI / 2],
        [0, 0, 0.98, -Math.PI / 2],
      ] as [number, number, number, number][]).map(([cx, _cy, cz, ry], i) => (
        <group key={i} position={[cx, 0, cz]} rotation={[0, ry, 0]}>
          {/* Seat */}
          <Box pos={[0, 0.45, 0]} size={[0.52, 0.06, 0.52]} color="#e8ecf2" roughness={0.8} />
          {/* Back */}
          <Box pos={[0, 0.76, 0.24]} size={[0.52, 0.56, 0.04]} color="#e8ecf2" roughness={0.8} />
          {/* Legs */}
          {([[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]] as [number, number][]).map(([lx, lz], j) => (
            <Box key={j} pos={[lx, 0.215, lz]} size={[0.035, 0.43, 0.035]} color="#c0c8d0" roughness={0.4} metalness={0.4} />
          ))}
        </group>
      ))}
    </group>
  );
}

function DisplayTotem({ p, color }: { p: [number, number, number]; color: string }) {
  return (
    <group position={p}>
      <Box pos={[0, 0.04, 0]} size={[0.72, 0.08, 0.58]} color="#9aaabb" roughness={0.35} metalness={0.55} />
      <Box pos={[0, 1.2, 0]} size={[0.64, 2.32, 0.5]} color="#f0f4f8" roughness={0.7} />
      {/* Brand color band */}
      <Box pos={[0, 1.7, 0.255]} size={[0.62, 1.0, 0.01]} color={color} roughness={0.45} emissive={color} emissiveIntensity={0.12} />
      {/* Monitor */}
      <Box pos={[0, 0.92, 0.255]} size={[0.5, 0.38, 0.025]} color="#0a1018" roughness={0.2} />
      <mesh position={[0, 0.92, 0.27]}>
        <planeGeometry args={[0.46, 0.33]} />
        <meshStandardMaterial color="#1040a0" emissive="#1040a0" emissiveIntensity={1.6} />
      </mesh>
      {/* Internal light */}
      <pointLight position={[0, 1.5, 0.1]} intensity={3} color={color} distance={2} />
    </group>
  );
}

function BrochureStand({ p }: { p: [number, number, number] }) {
  const cols = ['#e85050', '#3a90e0', '#44cc55'];
  return (
    <group position={p}>
      {/* Stand pole */}
      <Box pos={[0, 0.7, 0]} size={[0.04, 1.4, 0.04]} color="#9aaabb" roughness={0.3} metalness={0.6} />
      {/* Base */}
      <Box pos={[0, 0.04, 0]} size={[0.4, 0.05, 0.4]} color="#9aaabb" roughness={0.3} metalness={0.6} />
      {/* Pockets */}
      {[0.35, 0.72, 1.09].map((py, i) => (
        <group key={i} position={[0, py, 0]}>
          <Box pos={[0, 0, 0.02]} size={[0.22, 0.0, 0.02]} color={cols[i]} roughness={0.5} />
          <Box pos={[0, 0.11, 0.02]} size={[0.22, 0.22, 0.02]} color={cols[i]} roughness={0.6} emissive={cols[i]} emissiveIntensity={0.05} />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────
// Exhibition Hall environment
// ─────────────────────────────────────────────────────────────────
function Hall() {
  return (
    <group>
      {/* Main floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#cbcfd6" roughness={0.88} metalness={0.12} />
      </mesh>

      {/* Infinite floor grid */}
      <Grid
        position={[0, 0.004, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#b0b8c2"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9aa4b0"
        fadeDistance={45}
        fadeStrength={2.5}
        infiniteGrid
        followCamera={false}
      />

      {/* Ceiling */}
      <mesh position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1e28" side={THREE.BackSide} roughness={1} />
      </mesh>

      {/* Ceiling structural trusses (visual) */}
      {([-10, 0, 10] as number[]).map((tx) =>
        ([-10, 0, 10] as number[]).map((tz) => (
          <group key={`truss-${tx}-${tz}`} position={[tx, 8.8, tz]}>
            <Box pos={[0, 0, 0]} size={[0.12, 0.12, 20]} color="#282e3a" roughness={0.9} castShadow={false} />
            <Box pos={[0, 0, 0]} size={[20, 0.12, 0.12]} color="#282e3a" roughness={0.9} castShadow={false} />
          </group>
        ))
      )}

      {/* Ceiling LED light bars */}
      {([-6, -2, 2, 6] as number[]).map((lx) =>
        ([-4, 0, 4] as number[]).map((lz) => (
          <group key={`led-${lx}-${lz}`} position={[lx, 8.85, lz]}>
            <Box pos={[0, 0, 0]} size={[3.6, 0.06, 0.18]} color="#ffffff" roughness={0.5} emissive="#ffffff" emissiveIntensity={1.2} castShadow={false} />
            <pointLight intensity={18} distance={14} color="#fff6ee" castShadow={false} />
          </group>
        ))
      )}

      {/* Distant hall walls */}
      {([
        { p: [0, 4.5, -40] as [number,number,number], r: [0,0,0] as [number,number,number] },
        { p: [0, 4.5, 40] as [number,number,number], r: [0, Math.PI, 0] as [number,number,number] },
        { p: [-40, 4.5, 0] as [number,number,number], r: [0, Math.PI/2, 0] as [number,number,number] },
        { p: [40, 4.5, 0] as [number,number,number], r: [0, -Math.PI/2, 0] as [number,number,number] },
      ]).map(({ p, r }, i) => (
        <mesh key={i} position={p} rotation={r} receiveShadow>
          <planeGeometry args={[80, 9]} />
          <meshStandardMaterial color="#1e2430" roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────
// Booth scene
// ─────────────────────────────────────────────────────────────────
function BoothScene({ cfg }: { cfg: BoothConfig3D }) {
  const {
    width: W, depth: D, height: H,
    system, companyName,
    primaryColor = '#1a3a7a',
    carpetColor = '#1a2640',
    openFront = true, openLeft = false, openRight = false,
  } = cfg;

  const isMaxima = system === 'maxima';
  const mod = isMaxima ? 2 : 1;
  const ps = isMaxima ? 0.10 : 0.075;         // post size
  const fasciaH = isMaxima ? 0.44 : 0.36;
  const railYs = [0.001, H * 0.45, H];
  const ox = -W / 2;
  const oz = -D / 2;

  const aluminumMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isMaxima ? '#c8aa72' : '#aab8c4',
    metalness: isMaxima ? 0.65 : 0.75,
    roughness: isMaxima ? 0.35 : 0.28,
  }), [isMaxima]);

  const fasciaMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: primaryColor,
    roughness: 0.45,
    emissive: primaryColor,
    emissiveIntensity: 0.12,
  }), [primaryColor]);

  // Post position arrays
  const backXs = useMemo(() => {
    const a: number[] = [];
    for (let xi = 0; xi <= W; xi += mod) a.push(xi);
    return a;
  }, [W, mod]);

  const depthZs = useMemo(() => {
    const a: number[] = [];
    for (let zi = 0; zi <= D; zi += mod) a.push(zi);
    return a;
  }, [D, mod]);

  const panelCount_W = Math.ceil(W / mod);
  const panelCount_D = Math.ceil(D / mod);

  return (
    <group>
      {/* ── CARPET ──────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color={carpetColor} roughness={0.97} />
      </mesh>
      {/* Carpet border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
        <planeGeometry args={[W + 0.02, D + 0.02]} />
        <meshStandardMaterial color={isMaxima ? '#6a40aa' : '#2a5aaa'} transparent opacity={0.25} />
      </mesh>

      {/* ── POSTS ───────────────────────────────────────────── */}
      {/* Back wall */}
      {backXs.map(xi => <Post key={`bk${xi}`} x={ox + xi} z={oz + D} h={H} size={ps} mat={aluminumMat} />)}
      {/* Left wall */}
      {depthZs.map(zi => <Post key={`lt${zi}`} x={ox} z={oz + zi} h={H} size={ps} mat={aluminumMat} />)}
      {/* Right wall */}
      {depthZs.map(zi => <Post key={`rt${zi}`} x={ox + W} z={oz + zi} h={H} size={ps} mat={aluminumMat} />)}
      {/* Front (corner posts or full posts if closed) */}
      {openFront ? (
        <>
          <Post x={ox} z={oz} h={H} size={ps} mat={aluminumMat} />
          <Post x={ox + W} z={oz} h={H} size={ps} mat={aluminumMat} />
        </>
      ) : (
        backXs.map(xi => <Post key={`ft${xi}`} x={ox + xi} z={oz} h={H} size={ps} mat={aluminumMat} />)
      )}

      {/* ── HORIZONTAL RAILS ────────────────────────────────── */}
      {railYs.map(ry => (
        <group key={ry}>
          <Beam x1={ox} z1={oz + D} x2={ox + W} z2={oz + D} y={ry} mat={aluminumMat} />
          <Beam x1={ox} z1={oz} x2={ox} z2={oz + D} y={ry} mat={aluminumMat} />
          <Beam x1={ox + W} z1={oz} x2={ox + W} z2={oz + D} y={ry} mat={aluminumMat} />
          <Beam x1={ox} z1={oz} x2={ox + W} z2={oz} y={ry} mat={aluminumMat} />
        </group>
      ))}

      {/* ── GLASS PANELS ────────────────────────────────────── */}
      {/* Back wall */}
      {Array.from({ length: panelCount_W }).map((_, i) => (
        <GlassPanel
          key={`bgp${i}`}
          x={ox + i * mod + mod / 2}
          y={H / 2}
          z={oz + D}
          w={mod - ps - 0.01}
          h={H - 0.01}
        />
      ))}
      {/* Left wall */}
      {!openLeft && Array.from({ length: panelCount_D }).map((_, i) => (
        <GlassPanel
          key={`lgp${i}`}
          x={ox}
          y={H / 2}
          z={oz + i * mod + mod / 2}
          w={mod - ps - 0.01}
          h={H - 0.01}
          rotY={Math.PI / 2}
        />
      ))}
      {/* Right wall */}
      {!openRight && Array.from({ length: panelCount_D }).map((_, i) => (
        <GlassPanel
          key={`rgp${i}`}
          x={ox + W}
          y={H / 2}
          z={oz + i * mod + mod / 2}
          w={mod - ps - 0.01}
          h={H - 0.01}
          rotY={Math.PI / 2}
        />
      ))}

      {/* ── FASCIA HEADERS ──────────────────────────────────── */}
      {/* Back fascia body */}
      <mesh position={[0, H + fasciaH / 2, oz + D]} castShadow material={fasciaMat}>
        <boxGeometry args={[W, fasciaH, 0.045]} />
      </mesh>
      {/* Left fascia */}
      <mesh position={[ox, H + fasciaH / 2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow material={fasciaMat}>
        <boxGeometry args={[D, fasciaH, 0.045]} />
      </mesh>
      {/* Right fascia */}
      <mesh position={[ox + W, H + fasciaH / 2, 0]} rotation={[0, Math.PI / 2, 0]} castShadow material={fasciaMat}>
        <boxGeometry args={[D, fasciaH, 0.045]} />
      </mesh>
      {/* Front fascia (top beam) */}
      <mesh position={[0, H + fasciaH / 2, oz]} castShadow material={fasciaMat}>
        <boxGeometry args={[W, fasciaH, 0.045]} />
      </mesh>
      {/* Fascia top cap */}
      <mesh position={[0, H + fasciaH + 0.022, oz + D]}>
        <boxGeometry args={[W + 0.06, 0.045, 0.065]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* LED accent strip on back fascia */}
      <mesh position={[0, H + 0.025, oz + D - 0.026]}>
        <boxGeometry args={[W - 0.3, 0.035, 0.025]} />
        <meshStandardMaterial
          color={isMaxima ? '#cc88ff' : '#88aaff'}
          emissive={isMaxima ? '#aa44ff' : '#4488ff'}
          emissiveIntensity={3}
        />
      </mesh>
      {/* LED strip glow light */}
      <pointLight position={[0, H + 0.025, oz + D - 0.2]} intensity={12} distance={W} color={isMaxima ? '#bb66ff' : '#4488ff'} castShadow={false} />

      {/* Company name text */}
      <Text
        position={[0, H + fasciaH / 2, oz + D + 0.028]}
        fontSize={0.18}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        letterSpacing={0.1}
        maxWidth={W - 0.4}
      >
        {companyName}
      </Text>

      {/* ── SPOTLIGHT FIXTURES on fascia ────────────────────── */}
      {backXs.filter(xi => xi > 0 && xi < W).map(xi => (
        <group key={`spot${xi}`} position={[ox + xi, H + fasciaH - 0.06, oz + D - 0.12]}>
          <Box pos={[0, 0, 0]} size={[0.1, 0.08, 0.1]} color="#d0d8e0" roughness={0.3} metalness={0.7} />
          <spotLight
            position={[0, -0.1, 0]}
            target-position={[0, -3, 0]}
            intensity={20}
            distance={6}
            angle={Math.PI / 6}
            penumbra={0.4}
            color="#fff6e8"
            castShadow={false}
          />
        </group>
      ))}

      {/* ── INTERIOR AMBIENT LIGHTS ─────────────────────────── */}
      <pointLight position={[ox + W * 0.25, H - 0.5, 0]} intensity={10} color="#fff5e8" distance={7} castShadow={false} />
      <pointLight position={[ox + W * 0.75, H - 0.5, 0]} intensity={10} color="#fff5e8" distance={7} castShadow={false} />

      {/* ── FURNITURE ───────────────────────────────────────── */}
      <ReceptionCounter p={[ox + W - 2.6, 0, oz + 1.1]} />
      <ShelvingUnit p={[ox + 0.5, 0, oz + D - 0.35]} />
      <MeetingTable p={[ox + W / 2 - 1.2, 0, oz + D / 2 - 0.4]} />
      <DisplayTotem p={[ox + 0.55, 0, oz + 0.62]} color={primaryColor} />
      <BrochureStand p={[ox + W - 0.65, 0, oz + 0.55]} />

      {/* ── SECOND SHELVING UNIT (right back) ───────────────── */}
      <group position={[ox + W - 0.5, 0, oz + D - 0.35]} rotation={[0, Math.PI, 0]}>
        <ShelvingUnit p={[0, 0, 0]} />
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────
// Loading fallback
// ─────────────────────────────────────────────────────────────────
function Loader() {
  return (
    <Html center>
      <div style={{ color: '#4488ff', fontSize: '13px', fontFamily: 'monospace', letterSpacing: '2px' }}>
        LOADING 3D ENGINE...
      </div>
    </Html>
  );
}

// ─────────────────────────────────────────────────────────────────
// Exported component
// ─────────────────────────────────────────────────────────────────
export function Booth3D({ config }: { config?: Partial<BoothConfig3D> }) {
  const [webgl] = useState(() => detectWebGL());
  const cfg: BoothConfig3D = { ...DEFAULT, ...config };
  const { width: W, height: H, depth: D } = cfg;

  if (!webgl) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: '#080d18' }}>
        <BoothCanvas config={cfg} />
        <div style={{
          position: 'absolute', bottom: 10, right: 12,
          fontSize: 9, color: '#3366cc', fontFamily: 'monospace',
          letterSpacing: '1.5px', opacity: 0.55,
          background: 'rgba(8,13,24,0.8)', padding: '3px 8px', borderRadius: 4,
        }}>
          3D ENGINE · WEBGL ACTIVE IN PRODUCTION
        </div>
      </div>
    );
  }

  return (
    <Canvas
      shadows="soft"
      camera={{
        position: [W * 0.95, H * 2.4, D * 2.1],
        fov: 44,
        near: 0.1,
        far: 200,
      }}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.15,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0d1018']} />
      <fog attach="fog" args={['#0d1018', 32, 75]} />

      {/* ── GLOBAL LIGHTS ──────────────────────────────────── */}
      <ambientLight intensity={0.45} color="#c8d4e8" />
      <directionalLight
        position={[18, 22, 12]}
        intensity={2.0}
        color="#fff8f2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={70}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
      <directionalLight position={[-12, 18, -8]} intensity={0.5} color="#a0b4cc" />
      <directionalLight position={[0, -5, 15]} intensity={0.15} color="#aaccff" />

      {/* ── SCENE ──────────────────────────────────────────── */}
      <Suspense fallback={<Loader />}>
        <Hall />
        <BoothScene cfg={cfg} />
      </Suspense>

      {/* ── CONTACT SHADOWS ────────────────────────────────── */}
      <ContactShadows
        position={[0, 0.008, 0]}
        opacity={0.7}
        scale={40}
        blur={2.5}
        far={12}
        resolution={1024}
        color="#000820"
      />

      {/* ── CAMERA CONTROLS ────────────────────────────────── */}
      <OrbitControls
        makeDefault
        target={[0, H * 0.38, 0]}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={3}
        maxDistance={40}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.55}
        zoomSpeed={0.85}
      />
    </Canvas>
  );
}
