import { useMemo } from 'react';

export type BoothSystem = 'octanorm' | 'maxima';

export interface PlacedItem {
  id: string;
  name: string;
  sku: string;
  color: string;
  x: number; y: number; w: number; d: number; h: number;
}

export interface CanvasAnnotation {
  id: string; x: number; y: number; text: string; color: string; num: number;
}

export interface BoothConfig {
  width: number; depth: number; height: number;
  system: BoothSystem; companyName: string;
  primaryColor?: string; carpetColor?: string;
  openFront?: boolean; openLeft?: boolean; openRight?: boolean; openBack?: boolean;
  viewMode?: 'iso' | 'plan' | 'front' | 'side';
  orbitAz?: number; orbitEl?: number; zoomFactor?: number;
  wallFinish?: string;
  placedItems?: PlacedItem[];
  annotations?: CanvasAnnotation[];
}

const DEFAULTS: BoothConfig = {
  width: 6, depth: 3, height: 2.5, system: 'octanorm', companyName: 'VERDANTIA',
  openFront: true, openLeft: false, openRight: false, openBack: false,
};

// ─── Perspective helpers ──────────────────────────────────────────
type V3 = [number, number, number];
function norm(v: V3): V3 { const l=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); return l<1e-9?[0,0,1]:[v[0]/l,v[1]/l,v[2]/l]; }
function cross(a: V3, b: V3): V3 { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot(a: V3, b: V3): number { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
interface Camera { right: V3; upVec: V3; fwd: V3; eye: V3; focal: number; cx: number; cy: number; }
function makeCamera(eye: V3, target: V3, focal: number, cx: number, cy: number): Camera {
  const fwd=norm([target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]]);
  const right=norm(cross(fwd,[0,0,1]));
  const upVec=cross(right,fwd);
  return {eye,fwd,right,upVec,focal,cx,cy};
}
function project(cam: Camera, x: number, y: number, z: number): [number, number] {
  const rel: V3=[x-cam.eye[0],y-cam.eye[1],z-cam.eye[2]];
  const vz=dot(cam.fwd,rel);
  if(vz<0.01) return [cam.cx,cam.cy];
  return [cam.cx+dot(cam.right,rel)/vz*cam.focal, cam.cy-dot(cam.upVec,rel)/vz*cam.focal];
}
function pts(cam: Camera, ...verts: V3[]): string {
  return verts.map(([x,y,z])=>{ const[px,py]=project(cam,x,y,z); return `${px.toFixed(1)},${py.toFixed(1)}`; }).join(' ');
}

// ─── Quad ─────────────────────────────────────────────────────────
function Q({cam,a,b,c,d,fill,stroke='none',sw=0}:{cam:Camera;a:V3;b:V3;c:V3;d:V3;fill:string;stroke?:string;sw?:number}) {
  return <polygon points={pts(cam,a,b,c,d)} fill={fill} stroke={stroke} strokeWidth={sw}/>;
}

// ─── Post ─────────────────────────────────────────────────────────
function Post({cam,x,y,z0,z1,s,c0,c1,c2}:{cam:Camera;x:number;y:number;z0:number;z1:number;s:number;c0:string;c1:string;c2:string;}) {
  const h=s/2;
  return (<>
    <Q cam={cam} fill={c1} a={[x-h,y-h,z0]} b={[x+h,y-h,z0]} c={[x+h,y-h,z1]} d={[x-h,y-h,z1]}/>
    <Q cam={cam} fill={c2} a={[x+h,y-h,z0]} b={[x+h,y+h,z0]} c={[x+h,y+h,z1]} d={[x+h,y-h,z1]}/>
    <Q cam={cam} fill={c0} a={[x-h,y-h,z1]} b={[x+h,y-h,z1]} c={[x+h,y+h,z1]} d={[x-h,y+h,z1]}/>
  </>);
}

// ─── Rail ─────────────────────────────────────────────────────────
function RailX({cam,x0,x1,y,z,th,fill}:{cam:Camera;x0:number;x1:number;y:number;z:number;th:number;fill:string;}) {
  return <Q cam={cam} fill={fill} a={[x0,y-th/2,z]} b={[x1,y-th/2,z]} c={[x1,y-th/2,z+th]} d={[x0,y-th/2,z+th]}/>;
}
function RailY({cam,x,y0,y1,z,th,fillF,fillR}:{cam:Camera;x:number;y0:number;y1:number;z:number;th:number;fillF:string;fillR:string;}) {
  return (<>
    <Q cam={cam} fill={fillR} a={[x+th/2,y0,z]} b={[x+th/2,y1,z]} c={[x+th/2,y1,z+th]} d={[x+th/2,y0,z+th]}/>
    <Q cam={cam} fill={fillF} a={[x-th/2,y0,z]} b={[x+th/2,y0,z]} c={[x+th/2,y0,z+th]} d={[x-th/2,y0,z+th]}/>
  </>);
}

// ─── Wall panels ──────────────────────────────────────────────────
function WallPanel({cam,x0,x1,y,z0,z1,fill,border}:{cam:Camera;x0:number;x1:number;y:number;z0:number;z1:number;fill:string;border:string;}) {
  return (<>
    <Q cam={cam} fill={fill} a={[x0,y,z0]} b={[x1,y,z0]} c={[x1,y,z1]} d={[x0,y,z1]}/>
    <polygon points={pts(cam,[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1])} fill="none" stroke={border} strokeWidth={0.8}/>
  </>);
}
function SidePanel({cam,y0,y1,x,z0,z1,fill,border}:{cam:Camera;y0:number;y1:number;x:number;z0:number;z1:number;fill:string;border:string;}) {
  return (<>
    <Q cam={cam} fill={fill} a={[x,y0,z0]} b={[x,y1,z0]} c={[x,y1,z1]} d={[x,y0,z1]}/>
    <polygon points={pts(cam,[x,y0,z0],[x,y1,z0],[x,y1,z1],[x,y0,z1])} fill="none" stroke={border} strokeWidth={0.8}/>
  </>);
}

// ─── Fascia ───────────────────────────────────────────────────────
function Fascia({cam,x0,x1,y0,y1,zBot,zTop,cTop,cFront,cSide}:{cam:Camera;x0:number;x1:number;y0:number;y1:number;zBot:number;zTop:number;cTop:string;cFront:string;cSide:string;}) {
  return (<>
    <Q cam={cam} fill={cTop} a={[x0,y0,zTop]} b={[x1,y0,zTop]} c={[x1,y1,zTop]} d={[x0,y1,zTop]} stroke="rgba(150,155,170,0.25)" sw={0.4}/>
    <Q cam={cam} fill={cFront} a={[x0,y0,zBot]} b={[x1,y0,zBot]} c={[x1,y0,zTop]} d={[x0,y0,zTop]} stroke="rgba(150,155,170,0.25)" sw={0.4}/>
    <Q cam={cam} fill={cFront} a={[x1,y1,zBot]} b={[x0,y1,zBot]} c={[x0,y1,zTop]} d={[x1,y1,zTop]} stroke="rgba(150,155,170,0.2)" sw={0.4}/>
    <Q cam={cam} fill={cSide} a={[x0,y1,zBot]} b={[x0,y0,zBot]} c={[x0,y0,zTop]} d={[x0,y1,zTop]} stroke="rgba(150,155,170,0.2)" sw={0.4}/>
    <Q cam={cam} fill={cSide} a={[x1,y0,zBot]} b={[x1,y1,zBot]} c={[x1,y1,zTop]} d={[x1,y0,zTop]} stroke="rgba(150,155,170,0.2)" sw={0.4}/>
  </>);
}

// ─── Dimension label ──────────────────────────────────────────────
function DimLabel({ax,ay,bx,by,label}:{ax:number;ay:number;bx:number;by:number;label:string;}) {
  const mx=(ax+bx)/2,my=(ay+by)/2-9;
  if(Math.hypot(bx-ax,by-ay)<12) return null;
  return (<g>
    <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#505870" strokeWidth={0.8} strokeDasharray="4,3"/>
    <line x1={ax} y1={ay-4} x2={ax} y2={ay+4} stroke="#505870" strokeWidth={0.8}/>
    <line x1={bx} y1={by-4} x2={bx} y2={by+4} stroke="#505870" strokeWidth={0.8}/>
    <rect x={mx-19} y={my-7} width={38} height={13} rx={4} fill="#141824" stroke="#303850" strokeWidth={0.8}/>
    <text x={mx} y={my+0.5} textAnchor="middle" dominantBaseline="middle" fill="#7888a8" fontSize="7" fontFamily="monospace" fontWeight="bold" letterSpacing="0.5">{label}</text>
  </g>);
}

// ─── Placed item box (3D) ─────────────────────────────────────────
function PlacedBox({cam,item}:{cam:Camera;item:PlacedItem}) {
  const {x,y,w,d,h,color}=item;
  const top=color+'cc', front=color+'88', side=color+'66';
  return (<>
    <Q cam={cam} fill={top} stroke={color} sw={0.5} a={[x,y,h]} b={[x+w,y,h]} c={[x+w,y+d,h]} d={[x,y+d,h]}/>
    <Q cam={cam} fill={front} stroke={color} sw={0.5} a={[x,y,0]} b={[x+w,y,0]} c={[x+w,y,h]} d={[x,y,h]}/>
    <Q cam={cam} fill={side} stroke={color} sw={0.5} a={[x+w,y,0]} b={[x+w,y+d,0]} c={[x+w,y+d,h]} d={[x+w,y,h]}/>
  </>);
}

// ─── Plan View (2D orthographic) ─────────────────────────────────
function PlanView({cfg}:{cfg:Required<BoothConfig>}) {
  const {width:W, depth:D, openFront, openBack, openLeft, openRight, placedItems=[], annotations=[]} = cfg;
  const zoom = cfg.zoomFactor ?? 1;
  const margin = 56;
  const availW = 524 - margin*2;
  const availH = 408 - margin*2;
  const scale = Math.min(availW/W, availH/D) * Math.min(zoom, 2.5);
  const bx0 = (524 - W*scale)/2;
  const by0 = (408 - D*scale)/2;
  const tx = (x:number) => bx0 + x*scale;
  const ty = (y:number) => by0 + y*scale;

  // Grid
  const gridEls: React.ReactElement[] = [];
  const gridExt = 1.5;
  for(let xi=-gridExt; xi<=W+gridExt; xi+=0.5) {
    const x=tx(xi), ya=ty(-gridExt), yb=ty(D+gridExt);
    gridEls.push(<line key={`gx${xi}`} x1={x} y1={ya} x2={x} y2={yb} stroke="#e8e3d9" strokeWidth={xi%1===0?0.8:0.4}/>);
  }
  for(let yi=-gridExt; yi<=D+gridExt; yi+=0.5) {
    const y=ty(yi), xa=tx(-gridExt), xb=tx(W+gridExt);
    gridEls.push(<line key={`gy${yi}`} x1={xa} y1={y} x2={xb} y2={y} stroke="#e8e3d9" strokeWidth={yi%1===0?0.8:0.4}/>);
  }

  // Posts (at column intersections)
  const isMax = cfg.system==='maxima';
  const mod = isMax?2:1;
  const xs: number[]=[], ys: number[]=[];
  for(let x=0;x<=W;x+=mod) xs.push(x); if(xs[xs.length-1]!==W) xs.push(W);
  for(let y=0;y<=D;y+=mod) ys.push(y); if(ys[ys.length-1]!==D) ys.push(D);
  const ps = (isMax?0.10:0.075)*scale;

  const wallStroke = (open:boolean) => ({ stroke: open?'#c2410c':'#181613', strokeWidth: open?1.5:2.5, strokeDasharray: open?'6 4':undefined });

  return (<>
    {/* BG */}
    <rect width="524" height="408" fill="#f3f1ec"/>
    {/* Grid */}
    {gridEls}
    {/* Booth floor */}
    <rect x={tx(0)} y={ty(0)} width={W*scale} height={D*scale} fill="#ffffff" stroke="#d8d3c9" strokeWidth={0.5}/>
    {/* Walls */}
    <line x1={tx(0)} y1={ty(0)} x2={tx(W)} y2={ty(0)} {...wallStroke(openFront)}/>
    <line x1={tx(0)} y1={ty(D)} x2={tx(W)} y2={ty(D)} {...wallStroke(openBack)}/>
    <line x1={tx(0)} y1={ty(0)} x2={tx(0)} y2={ty(D)} {...wallStroke(openLeft)}/>
    <line x1={tx(W)} y1={ty(0)} x2={tx(W)} y2={ty(D)} {...wallStroke(openRight)}/>
    {/* Open side labels */}
    {openFront && <text x={tx(W/2)} y={ty(0)-8} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#c2410c" fontWeight="700">OPEN</text>}
    {openBack  && <text x={tx(W/2)} y={ty(D)+14} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#c2410c" fontWeight="700">OPEN</text>}
    {openLeft  && <text x={tx(0)-10} y={ty(D/2)} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#c2410c" fontWeight="700" transform={`rotate(-90,${tx(0)-10},${ty(D/2)})`}>OPEN</text>}
    {openRight && <text x={tx(W)+10} y={ty(D/2)} textAnchor="middle" fontSize="7" fontFamily="monospace" fill="#c2410c" fontWeight="700" transform={`rotate(90,${tx(W)+10},${ty(D/2)})`}>OPEN</text>}
    {/* Mid rails */}
    {xs.slice(0,-1).map((xi,i)=>{
      const x0=tx(xi)+ps/2, x1=tx(xs[i+1])-ps/2;
      return <line key={`mr${i}`} x1={x0} y1={ty(D/2)} x2={x1} y2={ty(D/2)} stroke="#b0a898" strokeWidth={0.8} strokeDasharray="3 2"/>;
    })}
    {/* Posts */}
    {xs.flatMap(xi=>ys.map(yi=>(
      <rect key={`p${xi}_${yi}`} x={tx(xi)-ps/2} y={ty(yi)-ps/2} width={ps} height={ps} fill="#22263a" rx={1}/>
    )))}
    {/* Placed items */}
    {placedItems.map(item=>(
      <g key={item.id}>
        <rect x={tx(item.x)} y={ty(item.y)} width={item.w*scale} height={item.d*scale}
          fill={item.color+'30'} stroke={item.color} strokeWidth={1.2} rx={2}/>
        <text x={tx(item.x)+item.w*scale/2} y={ty(item.y)+item.d*scale/2}
          textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(9,item.w*scale*0.5)}
          fontFamily="monospace" fill={item.color} fontWeight="700">{item.name.slice(0,8)}</text>
      </g>
    ))}
    {/* Annotations */}
    {annotations.map(a=>(
      <g key={a.id}>
        <circle cx={tx(a.x)} cy={ty(a.y)} r={8} fill={a.color} opacity={0.9}/>
        <text x={tx(a.x)} y={ty(a.y)} textAnchor="middle" dominantBaseline="middle"
          fontSize="8" fontFamily="monospace" fill="#fff" fontWeight="700">{a.num}</text>
      </g>
    ))}
    {/* Dimension labels */}
    <g>
      {/* Width */}
      <line x1={tx(0)} y1={ty(-0.7)} x2={tx(W)} y2={ty(-0.7)} stroke="#9090a0" strokeWidth={0.8}/>
      <line x1={tx(0)} y1={ty(-0.7)-4} x2={tx(0)} y2={ty(-0.7)+4} stroke="#9090a0" strokeWidth={0.8}/>
      <line x1={tx(W)} y1={ty(-0.7)-4} x2={tx(W)} y2={ty(-0.7)+4} stroke="#9090a0" strokeWidth={0.8}/>
      <text x={tx(W/2)} y={ty(-0.7)-5} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fill="#6b6560">{W.toFixed(1)} m</text>
      {/* Depth */}
      <line x1={tx(-0.7)} y1={ty(0)} x2={tx(-0.7)} y2={ty(D)} stroke="#9090a0" strokeWidth={0.8}/>
      <line x1={tx(-0.7)-4} y1={ty(0)} x2={tx(-0.7)+4} y2={ty(0)} stroke="#9090a0" strokeWidth={0.8}/>
      <line x1={tx(-0.7)-4} y1={ty(D)} x2={tx(-0.7)+4} y2={ty(D)} stroke="#9090a0" strokeWidth={0.8}/>
      <text x={tx(-0.7)-6} y={ty(D/2)} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontFamily="monospace" fill="#6b6560" transform={`rotate(-90,${tx(-0.7)-6},${ty(D/2)})`}>{D.toFixed(1)} m</text>
    </g>
    {/* Labels */}
    <text x={tx(W/2)} y={ty(-0.7)-18} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#c2410c" letterSpacing="1">FRONT</text>
    <text x={tx(W/2)} y={ty(D)+20} textAnchor="middle" fontSize="8" fontFamily="monospace" fill="#6b6560" letterSpacing="1">BACK</text>
    {/* System badge */}
    <rect x="14" y="14" width={isMax?78:86} height="20" rx="5" fill="#f3f1ec" stroke="#d8d3c9" strokeWidth="0.8"/>
    <text x={isMax?53:57} y="26" textAnchor="middle" fill="#6b6560" fontSize="7.5" fontFamily="monospace" fontWeight="700" letterSpacing="1.5">{isMax?'◈ MAXIMA':'⬡ OCTANORM'}</text>
    {/* PLAN VIEW badge */}
    <rect x="420" y="14" width="90" height="20" rx="5" fill="#1d4ed814" stroke="#1d4ed830" strokeWidth="0.8"/>
    <text x="465" y="26" textAnchor="middle" fill="#1d4ed8" fontSize="7.5" fontFamily="monospace" fontWeight="700" letterSpacing="1">PLAN VIEW</text>
  </>);
}

// ─── Elevation View labels ────────────────────────────────────────
function ElevationBadge({label}:{label:string}) {
  return (<>
    <rect x="420" y="14" width="90" height="20" rx="5" fill="#1d4ed814" stroke="#1d4ed830" strokeWidth="0.8"/>
    <text x="465" y="26" textAnchor="middle" fill="#1d4ed8" fontSize="7.5" fontFamily="monospace" fontWeight="700" letterSpacing="1">{label}</text>
  </>);
}

// ─── Main ─────────────────────────────────────────────────────────
export function BoothCanvas({ config }: { config?: Partial<BoothConfig> }) {
  const cfg = { ...DEFAULTS, ...config } as Required<BoothConfig>;
  const { width:W, depth:D, height:H, system, companyName,
    openFront=true, openLeft=false, openRight=false, openBack=false } = cfg;
  const viewMode = cfg.viewMode ?? 'iso';
  const orbitAz = cfg.orbitAz ?? 0;
  const orbitEl = cfg.orbitEl ?? 0;
  const zoom = cfg.zoomFactor ?? 1;
  const placedItems = cfg.placedItems ?? [];
  const annotations = cfg.annotations ?? [];

  const isMax = system==='maxima';
  const mod = isMax?2:1;
  const ps = isMax?0.10:0.075;
  const bth = isMax?0.07:0.055;
  const fH = isMax?0.40:0.34;

  const backXs = useMemo(()=>{ const a:number[]=[]; for(let x=0;x<=W;x+=mod)a.push(x); if(a[a.length-1]!==W)a.push(W); return a; },[W,mod]);
  const depthYs = useMemo(()=>{ const a:number[]=[]; for(let y=0;y<=D;y+=mod)a.push(y); if(a[a.length-1]!==D)a.push(D); return a; },[D,mod]);
  const railZs = useMemo<number[]>(()=>isMax?[H*0.5]:[H/3,H*2/3],[isMax,H]);
  const zBounds = useMemo<number[]>(()=>[0,...railZs,H],[railZs,H]);

  // ── Camera ────────────────────────────────────────────────────
  const cam = useMemo<Camera>(()=>{
    const z = zoom;
    if(viewMode==='front') return makeCamera([W/2,-D*5,H*0.5],[W/2,D*0.3,H*0.5],300*z,262,214);
    if(viewMode==='side')  return makeCamera([W*6,D/2,H*0.5],[W*0.1,D/2,H*0.5],280*z,262,214);

    // iso with orbit
    const defaultEye: V3 = [W+W*0.65,-D*1.7,H*1.6];
    const center: V3 = [W*0.3,D*0.45,H*0.20];
    if(orbitAz===0 && orbitEl===0) return makeCamera(defaultEye,center,340*z,262,214);
    const off: V3 = [defaultEye[0]-center[0],defaultEye[1]-center[1],defaultEye[2]-center[2]];
    const r = Math.sqrt(off[0]**2+off[1]**2+off[2]**2);
    const defAz = Math.atan2(off[0],-off[1]);
    const defEl = Math.asin(Math.min(1,Math.max(-1,off[2]/r)));
    const newAz = defAz + orbitAz*Math.PI/180;
    const newEl = Math.max(-1.2, Math.min(1.4, defEl+orbitEl*Math.PI/180));
    const newEye: V3 = [
      center[0]+r*Math.cos(newEl)*Math.sin(newAz),
      center[1]-r*Math.cos(newEl)*Math.cos(newAz),
      center[2]+r*Math.sin(newEl),
    ];
    return makeCamera(newEye,center,340*z,262,214);
  },[W,D,H,viewMode,orbitAz,orbitEl,zoom]);

  // ── Colours ────────────────────────────────────────────────────
  const P_DARK='#1a1e28', P_MID='#22263a', P_TOP='#2e3248';
  const wallColor = cfg.wallFinish ?? '#dce1e8';
  const PANEL_BACK = wallColor;
  const PANEL_LEFT = wallColor;
  const PANEL_RIGHT = wallColor;
  const PANEL_BORDER='#2a2e3c';
  const FASCIA_TOP='#eef1f6', FASCIA_FRONT='#e4e8f0', FASCIA_SIDE='#ced4de';

  // ── Floor grid ─────────────────────────────────────────────────
  const FEX=3;
  const gridLines = useMemo(()=>{
    const els:React.ReactElement[]=[];
    for(let xi=-FEX;xi<=W+FEX;xi++){
      const[ax,ay]=project(cam,xi,-FEX,0.002);const[bx,by]=project(cam,xi,D+FEX,0.002);
      els.push(<line key={`gx${xi}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#161c2a" strokeWidth="0.5"/>);
    }
    for(let yi=-FEX;yi<=D+FEX;yi++){
      const[ax,ay]=project(cam,-FEX,yi,0.002);const[bx,by]=project(cam,W+FEX,yi,0.002);
      els.push(<line key={`gy${yi}`} x1={ax} y1={ay} x2={bx} y2={by} stroke="#161c2a" strokeWidth="0.5"/>);
    }
    return els;
  },[cam,W,D]);

  function dimW() { const[ax,ay]=project(cam,0,-0.9,0);const[bx,by]=project(cam,W,-0.9,0); return <DimLabel ax={ax} ay={ay} bx={bx} by={by} label={`${W.toFixed(1)} m`}/>; }
  function dimD() { const[ax,ay]=project(cam,W+0.8,0,0);const[bx,by]=project(cam,W+0.8,D,0); return <DimLabel ax={ax} ay={ay} bx={bx} by={by} label={`${D.toFixed(1)} m`}/>; }
  function dimH() { const[ax,ay]=project(cam,-0.8,0,0);const[bx,by]=project(cam,-0.8,0,H); return <DimLabel ax={ax} ay={ay} bx={bx} by={by} label={`${H.toFixed(1)} m`}/>; }

  // ── Plan view ──────────────────────────────────────────────────
  if(viewMode==='plan') {
    return (
      <svg viewBox="0 0 524 408" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
        <PlanView cfg={{...cfg, openFront, openBack, openLeft, openRight, placedItems, annotations}}/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 524 408" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{display:'block'}}>
      <defs>
        <radialGradient id="bg" cx="38%" cy="38%" r="62%">
          <stop offset="0%"  stopColor="#20253a"/>
          <stop offset="55%" stopColor="#0e1220"/>
          <stop offset="100%" stopColor="#06080e"/>
        </radialGradient>
        <filter id="sh" x="-25%" y="-25%" width="150%" height="160%">
          <feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="#000008" floodOpacity="0.9"/>
        </filter>
      </defs>

      <rect width="524" height="408" fill="url(#bg)"/>
      <polygon points={pts(cam,[-FEX,-FEX,0],[W+FEX,-FEX,0],[W+FEX,D+FEX,0],[-FEX,D+FEX,0])} fill="#0b0e16"/>
      {gridLines}
      <polygon points={pts(cam,[0,0,0.003],[W,0,0.003],[W,D,0.003],[0,D,0.003])} fill="#131826"/>

      <g filter="url(#sh)">
        {/* Back wall panels */}
        {!openBack && backXs.slice(0,-1).flatMap((xi,i)=>zBounds.slice(0,-1).map((z0,j)=>{
          const x0=xi+ps/2+0.005, x1=backXs[i+1]-ps/2-0.005;
          const zZ0=z0+(j===0?0.005:bth/2+0.005), zZ1=zBounds[j+1]-(j===zBounds.length-2?0.005:bth/2+0.005);
          return <WallPanel key={`bk${i}_${j}`} cam={cam} x0={x0} x1={x1} y={D} z0={zZ0} z1={zZ1} fill={PANEL_BACK} border={PANEL_BORDER}/>;
        }))}
        {/* Left wall panels */}
        {!openLeft && depthYs.slice(0,-1).flatMap((yi,i)=>zBounds.slice(0,-1).map((z0,j)=>{
          const y0=yi+ps/2+0.005, y1=depthYs[i+1]-ps/2-0.005;
          const zZ0=z0+(j===0?0.005:bth/2+0.005), zZ1=zBounds[j+1]-(j===zBounds.length-2?0.005:bth/2+0.005);
          return <SidePanel key={`lt${i}_${j}`} cam={cam} y0={y0} y1={y1} x={0} z0={zZ0} z1={zZ1} fill={PANEL_LEFT} border={PANEL_BORDER}/>;
        }))}
        {/* Right wall panels */}
        {!openRight && depthYs.slice(0,-1).flatMap((yi,i)=>zBounds.slice(0,-1).map((z0,j)=>{
          const y0=yi+ps/2+0.005, y1=depthYs[i+1]-ps/2-0.005;
          const zZ0=z0+(j===0?0.005:bth/2+0.005), zZ1=zBounds[j+1]-(j===zBounds.length-2?0.005:bth/2+0.005);
          return <SidePanel key={`rt${i}_${j}`} cam={cam} y0={y0} y1={y1} x={W} z0={zZ0} z1={zZ1} fill={PANEL_RIGHT} border={PANEL_BORDER}/>;
        }))}
        {/* Front wall panels */}
        {!openFront && backXs.slice(0,-1).flatMap((xi,i)=>zBounds.slice(0,-1).map((z0,j)=>{
          const x0=xi+ps/2+0.005, x1=backXs[i+1]-ps/2-0.005;
          const zZ0=z0+(j===0?0.005:bth/2+0.005), zZ1=zBounds[j+1]-(j===zBounds.length-2?0.005:bth/2+0.005);
          return <WallPanel key={`ft${i}_${j}`} cam={cam} x0={x0} x1={x1} y={0} z0={zZ0} z1={zZ1} fill={PANEL_BACK} border={PANEL_BORDER}/>;
        }))}

        {/* Rails — always visible */}
        {railZs.map(rz=>(
          <g key={`br${rz}`}>
            <RailX cam={cam} x0={0} x1={W} y={D} z={rz-bth/2} th={bth} fill={P_MID}/>
            <RailY cam={cam} x={0} y0={0} y1={D} z={rz-bth/2} th={bth} fillF={P_MID} fillR={P_DARK}/>
            <RailY cam={cam} x={W} y0={0} y1={D} z={rz-bth/2} th={bth} fillF={P_MID} fillR={P_DARK}/>
            <RailX cam={cam} x0={0} x1={W} y={0} z={rz-bth/2} th={bth} fill={P_MID}/>
          </g>
        ))}
        <RailX cam={cam} x0={0} x1={W} y={D} z={H-bth} th={bth} fill={P_MID}/>
        <RailY cam={cam} x={0} y0={0} y1={D} z={H-bth} th={bth} fillF={P_MID} fillR={P_DARK}/>
        <RailY cam={cam} x={W} y0={0} y1={D} z={H-bth} th={bth} fillF={P_MID} fillR={P_DARK}/>
        <RailX cam={cam} x0={0} x1={W} y={0} z={H-bth} th={bth} fill={P_MID}/>

        {/* Posts — always visible */}
        {backXs.map(xi=>(<Post key={`bp${xi}`} cam={cam} x={xi} y={D} z0={0} z1={H} s={ps} c0={P_TOP} c1={P_MID} c2={P_DARK}/>))}
        {depthYs.map(yi=>(<Post key={`lp${yi}`} cam={cam} x={0} y={yi} z0={0} z1={H} s={ps} c0={P_TOP} c1={P_MID} c2={P_DARK}/>))}
        {depthYs.map(yi=>(<Post key={`rp${yi}`} cam={cam} x={W} y={yi} z0={0} z1={H} s={ps} c0={P_TOP} c1={P_MID} c2={P_DARK}/>))}
        {!depthYs.includes(0) && (<>
          <Post cam={cam} x={0} y={0} z0={0} z1={H} s={ps} c0={P_TOP} c1={P_MID} c2={P_DARK}/>
          <Post cam={cam} x={W} y={0} z0={0} z1={H} s={ps} c0={P_TOP} c1={P_MID} c2={P_DARK}/>
        </>)}

        {/* Placed items — 3D boxes */}
        {placedItems.map(item=>(<PlacedBox key={item.id} cam={cam} item={item}/>))}

        {/* Fascia */}
        <Fascia cam={cam} x0={-ps/2} x1={W+ps/2} y0={-ps/2} y1={D+ps/2} zBot={H} zTop={H+fH}
          cTop={FASCIA_TOP} cFront={FASCIA_FRONT} cSide={FASCIA_SIDE}/>
      </g>

      {/* Company name */}
      {(()=>{
        const[ax,ay]=project(cam,W*0.15,-ps/2-0.02,H+fH*0.5);
        const[bx,by]=project(cam,W*0.85,-ps/2-0.02,H+fH*0.5);
        const mx=(ax+bx)/2,my=(ay+by)/2,ang=Math.atan2(by-ay,bx-ax)*180/Math.PI;
        const span=Math.hypot(bx-ax,by-ay),fSize=Math.max(5,Math.min(11,span/(companyName.length*0.62)));
        return(<text x={mx} y={my} fill="#1c2130" fontSize={fSize} fontFamily="'Helvetica Neue',Arial,sans-serif"
          fontWeight="600" letterSpacing={fSize*0.55} textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(${ang},${mx},${my})`}>{companyName}</text>);
      })()}

      {/* Annotations in 3D view */}
      {annotations.map(a=>{
        const[sx,sy]=project(cam,a.x,a.y,H*0.5);
        return(<g key={a.id}>
          <circle cx={sx} cy={sy} r={9} fill={a.color} opacity={0.85}/>
          <text x={sx} y={sy} textAnchor="middle" dominantBaseline="middle" fontSize="8" fontFamily="monospace" fill="#fff" fontWeight="700">{a.num}</text>
        </g>);
      })}

      {/* Dimension labels */}
      {dimW()}{dimD()}{dimH()}

      {/* Scale bar */}
      {(()=>{
        const[ax,ay]=project(cam,W*0.6,-0.8,0);const[bx,by]=project(cam,W*0.6+1,-0.8,0);
        return(<g opacity="0.55">
          <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#4a5268" strokeWidth="1.5"/>
          <line x1={ax} y1={ay-3} x2={ax} y2={ay+3} stroke="#4a5268" strokeWidth="1"/>
          <line x1={bx} y1={by-3} x2={bx} y2={by+3} stroke="#4a5268" strokeWidth="1"/>
          <rect x={(ax+bx)/2-18} y={(ay+by)/2+3} width={36} height={12} rx={3} fill="#0e1220"/>
          <text x={(ax+bx)/2} y={(ay+by)/2+10} textAnchor="middle" fill="#4a5268" fontSize="6.5" fontFamily="monospace">scale 1.0 m</text>
        </g>);
      })()}

      {/* System badge */}
      <rect x="14" y="14" width={isMax?78:86} height="20" rx="5" fill="#0e1220" stroke="#252a3e" strokeWidth="0.8"/>
      <text x={isMax?53:57} y="26" textAnchor="middle" fill="#4c5878" fontSize="7.5" fontFamily="'Helvetica Neue',Arial,sans-serif" fontWeight="700" letterSpacing="1.5">{isMax?'◈ MAXIMA':'⬡ OCTANORM'}</text>

      {/* Elevation badge */}
      {viewMode!=='iso' && <ElevationBadge label={viewMode==='front'?'FRONT ELEV':'SIDE ELEV'}/>}
    </svg>
  );
}
