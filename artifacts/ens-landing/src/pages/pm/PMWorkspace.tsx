import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Booth3D } from "@/components/workspace/Booth3D";
import type { BoothSystem } from "@/components/workspace/BoothCanvas";
import {
  ChevronLeft, Undo2, Redo2, Save, Camera, History, Send,
  ZoomIn, ZoomOut, Maximize2, Search, Plus, ChevronDown,
  Square, LayoutTemplate, Lightbulb, Home, Monitor, Layers, Map, Box, PanelLeft,
} from "lucide-react";

// ── Drafting palette ─────────────────────────────────────────────
const C = {
  bg:     '#f3f1ec',
  panel:  '#ffffff',
  ink:    '#181613',
  hair:   '#d8d3c9',
  blue:   '#1d4ed8',
  orange: '#c2410c',
  green:  '#2f7d3a',
  muted:  '#6b6560',
  bgHover:'#ece9e3',
} as const;

const MONO = '"JetBrains Mono","Courier New",monospace';
const UI   = 'Inter,system-ui,sans-serif';

// ── Catalog ──────────────────────────────────────────────────────
interface CatItem { id: string; name: string; sku: string; dim: string; inStand: number; icon: React.ElementType; }

const CATALOG: Record<string, CatItem[]> = {
  Structure: [
    { id:'s1', name:'Solid Wall',      sku:'OCT-SW-100', dim:'1.0 × 2.5', inStand:6, icon:Square },
    { id:'s2', name:'Glass Wall',      sku:'OCT-GW-100', dim:'1.0 × 2.5', inStand:2, icon:Square },
    { id:'s3', name:'Curved Wall',     sku:'OCT-CW-100', dim:'1.0 × 2.5', inStand:0, icon:Square },
    { id:'s4', name:'Header Beam',     sku:'OCT-HB-200', dim:'2.0 × 0.85', inStand:0, icon:LayoutTemplate },
  ],
  Fascia: [
    { id:'f1', name:'Std Fascia',      sku:'FAS-STD-01', dim:'1.0 × 0.3', inStand:6, icon:LayoutTemplate },
    { id:'f2', name:'Corner Fascia',   sku:'FAS-COR-01', dim:'0.3 × 0.3', inStand:4, icon:LayoutTemplate },
  ],
  Furniture: [
    { id:'u1', name:'Reception Counter', sku:'FUR-RC-04', dim:'1.2 × 0.6', inStand:1, icon:Monitor },
    { id:'u2', name:'Design Chair',      sku:'FUR-DC-12', dim:'0.45 × 0.6', inStand:2, icon:PanelLeft },
    { id:'u3', name:'Bar Stool',         sku:'FUR-BS-08', dim:'0.4 × 0.4', inStand:0, icon:PanelLeft },
    { id:'u4', name:'Meeting Table',     sku:'FUR-MT-01', dim:'1.8 × 0.8', inStand:0, icon:Monitor },
    { id:'u5', name:'Display Shelf',     sku:'FUR-DS-02', dim:'1.0 × 0.35', inStand:0, icon:Layers },
    { id:'u6', name:'Storage Cabinet',   sku:'FUR-SC-01', dim:'0.8 × 0.5', inStand:0, icon:Box },
  ],
  Lighting: [
    { id:'l1', name:'Spotlight',  sku:'LIT-SP-100', dim:'0.15 × 0.15', inStand:4, icon:Lightbulb },
    { id:'l2', name:'LED Strip',  sku:'LIT-LED-01', dim:'1.0 × 0.03',  inStand:8, icon:Lightbulb },
    { id:'l3', name:'Arm Light',  sku:'LIT-AR-100', dim:'0.4 × 0.3',   inStand:2, icon:Lightbulb },
  ],
};

const CAT_COUNT: Record<string, number> = { Structure:4, Fascia:2, Furniture:6, Lighting:3 };

const THEMES = [
  { label:'Charcoal',   color:'#3b3e44' },
  { label:'White',      color:'#dde0e4' },
  { label:'Walnut',     color:'#7a4a2a' },
  { label:'Navy',       color:'#1a2640' },
];

const CARPETS = [
  { label:'Black',      color:'#1a1a1a' },
  { label:'Bone',       color:'#dde0e4' },
  { label:'Gray',       color:'#7a7e84' },
  { label:'Navy',       color:'#1a2640' },
  { label:'Forest',     color:'#1e3a28' },
  { label:'Terracotta', color:'#5a2316' },
];

// ── Sub-components ────────────────────────────────────────────────
function Hairline({ margin = 16 }: { margin?: number }) {
  return <div style={{ height: 1, background: C.hair, margin: `0 -${margin}px` }} />;
}

function MonoLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:7 }}>
      <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.1em', color:C.muted, textTransform:'uppercase' as const }}>{children}</span>
      {right && <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>{right}</span>}
    </div>
  );
}

function PropBlock({ label, right, children }: { label: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding:'12px 0' }}>
      <MonoLabel right={right}>{label}</MonoLabel>
      {children}
    </div>
  );
}

function DimInput({ label, value, min, max, step, onChange }: { label:string; value:number; min:number; max:number; step:number; onChange:(v:number)=>void }) {
  return (
    <div>
      <label style={{ fontFamily:MONO, fontSize:9, color:C.muted, textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'block', marginBottom:3 }}>{label}</label>
      <div style={{ position:'relative' }}>
        <input type="number" min={min} max={max} step={step} value={value}
          onChange={e => { const n=parseFloat(e.target.value); if (!isNaN(n) && n>=min && n<=max) onChange(n); }}
          style={{ width:'100%', height:30, border:`1px solid ${C.hair}`, borderRadius:4, background:C.bg, fontFamily:MONO, fontSize:12.5, fontWeight:600, color:C.ink, paddingLeft:8, paddingRight:22, boxSizing:'border-box' as const, outline:'none' }}
        />
        <span style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', fontFamily:MONO, fontSize:9, color:C.muted }}>m</span>
      </div>
    </div>
  );
}

function Swatch({ color, active, onClick, size=28 }: { color:string; active:boolean; onClick:()=>void; size?:number }) {
  const light = color === '#dde0e4';
  return (
    <button onClick={onClick} title={color} style={{ width:size, height:size, borderRadius:4, background:color, cursor:'pointer', flexShrink:0, border:`${active?2:1}px solid ${active ? C.ink : C.hair}`, position:'relative' }}>
      {active && (
        <span style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polyline points="1.5,5 4,7.5 8.5,2.5" stroke={light ? C.ink : '#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      )}
    </button>
  );
}

function OpenSidesPlan({ openFront, openBack, openLeft, openRight }: { openFront:boolean; openBack:boolean; openLeft:boolean; openRight:boolean; }) {
  const open = (on: boolean) => ({ stroke: on ? C.orange : C.ink, strokeDasharray: on ? '5 3.5' : undefined });
  return (
    <svg width="188" height="116" viewBox="0 0 188 116" style={{ fontFamily:MONO }}>
      {/* Walls */}
      <line x1="30" y1="24" x2="158" y2="24" strokeWidth="2" {...open(openBack)} />
      <line x1="30" y1="24" x2="30" y2="92" strokeWidth="2" {...open(openLeft)} />
      <line x1="158" y1="24" x2="158" y2="92" strokeWidth="2" {...open(openRight)} />
      <line x1="30" y1="92" x2="158" y2="92" strokeWidth="2" {...open(openFront)} />
      {/* Camera/viewer indicator (T symbol centered) */}
      <text x="94" y="62" textAnchor="middle" fontSize="18" fill={C.muted} opacity={0.18} fontWeight="700">T</text>
      {/* Side labels */}
      <text x="94" y="15" textAnchor="middle" fontSize="7.5" fill={openBack  ? C.orange : C.muted}>BACK</text>
      <text x="94" y="110" textAnchor="middle" fontSize="7.5" fill={openFront ? C.orange : C.muted}>FRONT{openFront?' · OPEN':''}</text>
      <text x="16" y="60" textAnchor="middle" fontSize="7.5" fill={openLeft  ? C.orange : C.muted} transform="rotate(-90,16,60)">LEFT</text>
      <text x="172" y="60" textAnchor="middle" fontSize="7.5" fill={openRight ? C.orange : C.muted} transform="rotate(90,172,60)">RIGHT</text>
    </svg>
  );
}

function AxisGizmo() {
  return (
    <svg width="58" height="58" viewBox="0 0 58 58">
      <line x1="29" y1="29" x2="50" y2="39" stroke="#c53030" strokeWidth="1.5" />
      <text x="52" y="43" fontSize="8" fill="#c53030" fontFamily={MONO} fontWeight="700">X</text>
      <line x1="29" y1="29" x2="29" y2="7"  stroke="#2f855a" strokeWidth="1.5" />
      <text x="25" y="5"  fontSize="8" fill="#2f855a" fontFamily={MONO} fontWeight="700">Y</text>
      <line x1="29" y1="29" x2="8"  y2="39" stroke="#2b6cb0" strokeWidth="1.5" />
      <text x="1"  y="43" fontSize="8" fill="#2b6cb0" fontFamily={MONO} fontWeight="700">Z</text>
      <circle cx="29" cy="29" r="2.5" fill={C.ink} />
    </svg>
  );
}

// ── Booth state ───────────────────────────────────────────────────
interface BoothState {
  width:number; depth:number; height:number; system:BoothSystem; companyName:string;
  openFront:boolean; openBack:boolean; openLeft:boolean; openRight:boolean;
}

// ── Main ──────────────────────────────────────────────────────────
export default function PMWorkspace() {
  const [booth, setBooth] = useState<BoothState>({ width:6, depth:3, height:2.5, system:'octanorm', companyName:'TECHCORP INDUSTRIES', openFront:true, openBack:false, openLeft:false, openRight:false });
  const [themeIdx,  setThemeIdx]  = useState(0);
  const [carpetIdx, setCarpetIdx] = useState(0);
  const [search,    setSearch]    = useState('');
  const [openCats,  setOpenCats]  = useState<Set<string>>(new Set(['Structure', 'Furniture']));
  const [activeId,  setActiveId]  = useState('s1');
  const [viewMode,  setViewMode]  = useState('iso');

  const set = useCallback(<K extends keyof BoothState>(k:K, v:BoothState[K]) =>
    setBooth(p => ({ ...p, [k]:v })), []);

  const toggleCat = (cat: string) =>
    setOpenCats(prev => { const s = new Set(prev); s.has(cat) ? s.delete(cat) : s.add(cat); return s; });

  const floorArea = (booth.width * booth.depth).toFixed(1);
  const carpetColor = CARPETS[carpetIdx].color;
  const openCount = [booth.openFront, booth.openBack, booth.openLeft, booth.openRight].filter(Boolean).length;

  const filteredCatalog = Object.fromEntries(
    Object.entries(CATALOG).map(([cat, items]) => [cat,
      search ? items.filter(i => `${i.name} ${i.sku}`.toLowerCase().includes(search.toLowerCase())) : items
    ])
  );

  // ── Icon-button helper
  const iconBtn = (Icon: React.ElementType, tooltip: string, onClick?: () => void, style?: React.CSSProperties) => (
    <button title={tooltip} onClick={onClick} style={{ background:'none', border:'none', cursor:'pointer', padding:'5px 7px', color:C.muted, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:3, ...style }}>
      <Icon size={13} />
    </button>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:C.bg, color:C.ink, fontFamily:UI, overflow:'hidden', userSelect:'none' }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header style={{ height:46, borderBottom:`1px solid ${C.hair}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', background:C.panel, flexShrink:0, gap:8 }}>
        {/* Left: back + project info */}
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <Link href="/pm">
            <button style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, color:C.muted, padding:'4px 6px', borderRadius:4, flexShrink:0 }}>
              <ChevronLeft size={13} />
              <span style={{ fontFamily:MONO, fontSize:10 }}>Back</span>
            </button>
          </Link>
          <div style={{ width:1, height:18, background:C.hair, flexShrink:0 }} />
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.2, minWidth:0 }}>
            <span style={{ fontFamily:MONO, fontSize:8.5, color:C.muted, letterSpacing:'0.1em', textTransform:'uppercase' }}>Project</span>
            <span style={{ fontSize:12.5, fontWeight:700, letterSpacing:'-0.01em', whiteSpace:'nowrap' }}>TechCon 2024 — Global Exhibit</span>
          </div>
          <span style={{ fontFamily:MONO, fontSize:9.5, background:`${C.blue}12`, color:C.blue, border:`1px solid ${C.blue}28`, borderRadius:4, padding:'2px 7px', flexShrink:0 }}>v2.4.1</span>
          <div style={{ width:1, height:18, background:C.hair, flexShrink:0 }} />
          {/* LIVE badge */}
          <span style={{ fontFamily:MONO, fontSize:9.5, display:'flex', alignItems:'center', gap:5, color:C.green, flexShrink:0 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:C.green, display:'inline-block', flexShrink:0 }} />
            LIVE WORKSPACE
          </span>
        </div>

        {/* Right: toolbar actions */}
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          {/* Undo / Redo */}
          <div style={{ display:'flex', border:`1px solid ${C.hair}`, borderRadius:4, overflow:'hidden' }}>
            {iconBtn(Undo2, 'Undo', undefined, { borderRight:`1px solid ${C.hair}` })}
            {iconBtn(Redo2, 'Redo')}
          </div>
          <div style={{ width:1, height:18, background:C.hair }} />
          {/* Action buttons */}
          {([{ icon:Save, label:'Save' }, { icon:Camera, label:'Snapshot' }, { icon:History, label:'History' }] as const).map(({ icon:Icon, label }) => (
            <button key={label} title={label} style={{ background:'none', border:`1px solid ${C.hair}`, borderRadius:4, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11.5, fontFamily:UI, color:C.ink }}>
              <Icon size={12} /> {label}
            </button>
          ))}
          {/* CTA */}
          <button style={{ background:C.blue, border:'none', color:'#fff', borderRadius:4, padding:'6px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, fontFamily:UI }}>
            <Send size={12} /> Send to Client
          </button>
        </div>
      </header>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── Left — Component Catalog ────────────────────────── */}
        <aside style={{ width:240, borderRight:`1px solid ${C.hair}`, background:C.panel, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          {/* Panel header */}
          <div style={{ padding:'8px 14px', borderBottom:`1px solid ${C.hair}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.12em', color:C.muted, textTransform:'uppercase' }}>§ Components</span>
            <span style={{ fontFamily:MONO, fontSize:9.5, color:C.muted }}>{Object.values(CATALOG).reduce((a,b)=>a+b.length,0)} items</span>
          </div>

          {/* Search */}
          <div style={{ padding:'8px 10px', borderBottom:`1px solid ${C.hair}`, flexShrink:0 }}>
            <div style={{ position:'relative' }}>
              <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:C.muted }} />
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items, SKUs…"
                style={{ width:'100%', height:28, paddingLeft:26, paddingRight:32, border:`1px solid ${C.hair}`, borderRadius:4, background:C.bg, fontFamily:UI, fontSize:11.5, color:C.ink, outline:'none', boxSizing:'border-box' }} />
              <span style={{ position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', fontFamily:MONO, fontSize:8.5, color:C.muted, border:`1px solid ${C.hair}`, borderRadius:3, padding:'1px 4px', lineHeight:1.2 }}>⌘K</span>
            </div>
          </div>

          {/* Accordion categories */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {Object.entries(filteredCatalog).map(([cat, items]) => {
              const isOpen = openCats.has(cat);
              return (
                <div key={cat} style={{ borderBottom:`1px solid ${C.hair}` }}>
                  <button onClick={()=>toggleCat(cat)}
                    style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'7px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', textAlign:'left' }}>
                    <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:C.ink }}>
                      {cat} · {String(CAT_COUNT[cat]).padStart(2,'0')}
                    </span>
                    <ChevronDown size={11} style={{ color:C.muted, transform:isOpen?'rotate(0deg)':'rotate(-90deg)', transition:'transform 0.15s', flexShrink:0 }} />
                  </button>

                  {isOpen && (
                    <div style={{ padding:'6px 10px 10px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                      {items.map(item => {
                        const isActive = activeId === item.id;
                        const hasCount = item.inStand > 0;
                        const Icon = item.icon;
                        return (
                          <button key={item.id} onClick={()=>setActiveId(item.id)}
                            style={{ position:'relative', background: isActive ? '#f0ecff' : C.bg, border:`1px ${isActive?'solid':hasCount?'solid':'dashed'} ${isActive?C.ink:hasCount?C.hair:C.hair}`, borderRadius:4, padding:'9px 7px 7px', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, textAlign:'center', transition:'all 0.1s' }}>
                            {/* Active checkbox */}
                            {isActive && (
                              <div style={{ position:'absolute', top:3, right:3, width:13, height:13, background:C.ink, borderRadius:2, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                            )}
                            {/* Count chip */}
                            {hasCount && !isActive && (
                              <span style={{ position:'absolute', top:3, right:3, fontFamily:MONO, fontSize:8, color:C.blue, fontWeight:700 }}>×{item.inStand}</span>
                            )}
                            <Icon size={17} style={{ color: isActive ? C.ink : C.muted, flexShrink:0 }} />
                            <span style={{ fontSize:10.5, fontWeight:600, color:C.ink, lineHeight:1.2, wordBreak:'break-word' as const }}>{item.name}</span>
                            <span style={{ fontFamily:MONO, fontSize:8, color:C.muted }}>{item.sku}</span>
                          </button>
                        );
                      })}
                      <button style={{ background:'none', border:`1px dashed ${C.hair}`, borderRadius:4, padding:'9px 7px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor:'pointer', color:C.muted }}>
                        <Plus size={13} />
                        <span style={{ fontFamily:MONO, fontSize:9 }}>Add</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Center — Canvas ─────────────────────────────────── */}
        <main style={{ flex:1, position:'relative', overflow:'hidden', backgroundColor:C.bg,
          backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px)' }}>

          {/* Booth3D fills canvas */}
          <div style={{ position:'absolute', inset:0 }}>
            <Booth3D config={{ width:booth.width, depth:booth.depth, height:booth.height, system:booth.system, companyName:booth.companyName, carpetColor, openFront:booth.openFront, openBack:booth.openBack, openLeft:booth.openLeft, openRight:booth.openRight }} />
          </div>

          {/* Top-left floating badges */}
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6, zIndex:10, pointerEvents:'none' }}>
            {[
              { text:'● LIVE WORKSPACE', color:C.green },
              { text:`⬡ OCTANORM · ${booth.width}×${booth.depth}M`, color:C.muted },
            ].map(b => (
              <span key={b.text} style={{ fontFamily:MONO, fontSize:9.5, display:'flex', alignItems:'center', gap:5, background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, padding:'4px 9px', color:b.color, letterSpacing:'0.04em' }}>{b.text}</span>
            ))}
          </div>

          {/* View mode toggle — top right */}
          <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:1, background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, padding:2, zIndex:10 }}>
            {([{icon:Home,key:'home'},{icon:Box,key:'iso'},{icon:Map,key:'plan'},{icon:Layers,key:'front'}] as const).map(({icon:Icon,key}) => (
              <button key={key} onClick={()=>setViewMode(key)}
                style={{ background:viewMode===key?C.ink:'none', border:'none', borderRadius:3, padding:'5px 8px', cursor:'pointer', color:viewMode===key?'#fff':C.muted, transition:'all 0.1s' }}>
                <Icon size={12} />
              </button>
            ))}
          </div>

          {/* Axis gizmo — top right below toggles */}
          <div style={{ position:'absolute', top:58, right:12, zIndex:10, background:`${C.panel}e0`, border:`1px solid ${C.hair}`, borderRadius:4, padding:5 }}>
            <AxisGizmo />
          </div>

          {/* Height dimension label — left center */}
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', zIndex:10, pointerEvents:'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
              <div style={{ width:1, height:28, background:C.muted, opacity:0.5 }} />
              <div style={{ transform:'rotate(-90deg)', whiteSpace:'nowrap', fontFamily:MONO, fontSize:9.5, color:C.muted, letterSpacing:'0.04em' }}>
                {booth.height.toFixed(2)} m
              </div>
              <div style={{ width:1, height:28, background:C.muted, opacity:0.5 }} />
            </div>
          </div>

          {/* Zoom controls — bottom left (above status bar) */}
          <div style={{ position:'absolute', bottom:38, left:12, display:'flex', background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, overflow:'hidden', zIndex:10 }}>
            {([ZoomIn, ZoomOut, Maximize2] as const).map((Icon, i) => (
              <button key={i} style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px', color:C.muted, borderRight:i<2?`1px solid ${C.hair}`:'none' }}>
                <Icon size={13} />
              </button>
            ))}
          </div>

          {/* Bottom viewport info bar */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:32, background:C.panel, borderTop:`1px solid ${C.hair}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', zIndex:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:0 }}>
              {[
                { text:'Octanorm', style:{ fontWeight:700 } },
                { text:'|', style:{ color:C.hair, margin:'0 8px' } },
                { text:`OPEN SIDE · FRONT`, style:{ color:C.orange } },
                { text:'|', style:{ color:C.hair, margin:'0 8px' } },
                { text:`${booth.width.toFixed(1)} × ${booth.depth.toFixed(1)} m` },
                { text:`H ${booth.height.toFixed(2)} m`, style:{ marginLeft:10 } },
                { text:'40 mm profile', style:{ marginLeft:10 } },
              ].map((item, i) => (
                <span key={i} style={{ fontFamily:MONO, fontSize:9.5, color:C.ink, letterSpacing:'0.04em', ...item.style }}>{item.text}</span>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>SCROLL zoom · CLICK inspect part · CAM 40° · FOV 32mm</span>
              {/* Scale bar */}
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <div style={{ position:'relative', width:40, height:10 }}>
                  <div style={{ position:'absolute', left:0, right:0, top:'50%', height:1, background:C.ink }} />
                  <div style={{ position:'absolute', left:0, top:0, bottom:0, width:1, background:C.ink }} />
                  <div style={{ position:'absolute', right:0, top:0, bottom:0, width:1, background:C.ink }} />
                  {/* Mid ticks */}
                  {[0.25, 0.5, 0.75].map(f => (
                    <div key={f} style={{ position:'absolute', left:`${f*100}%`, top:'30%', height:'40%', width:1, background:C.ink, opacity:0.5 }} />
                  ))}
                </div>
                <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>1.0 m</span>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right — Properties ──────────────────────────────── */}
        <aside style={{ width:282, borderLeft:`1px solid ${C.hair}`, background:C.panel, display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>
          {/* Panel header */}
          <div style={{ padding:'8px 16px', borderBottom:`1px solid ${C.hair}`, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.12em', color:C.muted, textTransform:'uppercase' }}>§ Properties</span>
            <span style={{ fontFamily:MONO, fontSize:9.5, color:C.muted }}>Stand · 01</span>
          </div>

          <div style={{ padding:'0 16px', display:'flex', flexDirection:'column' }}>

            {/* Workspace Theme */}
            <PropBlock label="Workspace Theme">
              <div style={{ display:'flex', gap:6 }}>
                {THEMES.map((t,i) => <Swatch key={t.label} color={t.color} active={themeIdx===i} onClick={()=>setThemeIdx(i)} />)}
              </div>
            </PropBlock>

            <Hairline />

            {/* Workplane / Carpet */}
            <PropBlock label="Workplane · Carpet" right="6 swatches">
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {CARPETS.map((c,i) => <Swatch key={c.label} color={c.color} active={carpetIdx===i} onClick={()=>setCarpetIdx(i)} size={24} />)}
              </div>
            </PropBlock>

            <Hairline />

            {/* Stand Configuration */}
            <PropBlock label="Stand Configuration" right="metric">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <DimInput label="Width" value={booth.width}  min={1} max={40} step={0.5} onChange={v=>set('width',v)} />
                <DimInput label="Depth" value={booth.depth}  min={1} max={40} step={0.5} onChange={v=>set('depth',v)} />
              </div>
              <DimInput label="Height" value={booth.height} min={1.5} max={6} step={0.5} onChange={v=>set('height',v)} />
              <div style={{ marginTop:8 }}>
                <label style={{ fontFamily:MONO, fontSize:9, color:C.muted, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:3 }}>System</label>
                <select value={booth.system} onChange={e=>set('system',e.target.value as BoothSystem)}
                  style={{ width:'100%', height:30, border:`1px solid ${C.hair}`, borderRadius:4, background:C.bg, fontFamily:UI, fontSize:12, color:C.ink, paddingLeft:8, boxSizing:'border-box', outline:'none', cursor:'pointer' }}>
                  <option value="octanorm">Octanorm (1 m module)</option>
                  <option value="maxima">Maxima (2 m module)</option>
                </select>
              </div>
            </PropBlock>

            <Hairline />

            {/* Fascia */}
            <PropBlock label="Fascia / Company Name" right={`${booth.companyName.length}/22`}>
              <input value={booth.companyName} onChange={e=>set('companyName',e.target.value.toUpperCase().slice(0,22))}
                style={{ width:'100%', height:34, border:`1px solid ${C.hair}`, borderRadius:4, background:C.bg, fontFamily:MONO, fontSize:12, fontWeight:700, color:C.ink, paddingLeft:10, boxSizing:'border-box', outline:'none', letterSpacing:'0.06em' }} />
            </PropBlock>

            <Hairline />

            {/* Open Sides */}
            <PropBlock label="Open Sides" right={`${openCount} of 4 open`}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:2, marginBottom:10 }}>
                {([['openFront','Front'],['openBack','Back'],['openLeft','Left'],['openRight','Right']] as [keyof BoothState, string][]).map(([key, label]) => {
                  const on = !!booth[key];
                  return (
                    <label key={key} style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', padding:'5px 4px' }}>
                      <div onClick={()=>set(key,!on)} style={{ width:14, height:14, borderRadius:3, flexShrink:0, border:`1px solid ${on?C.blue:C.hair}`, background:on?C.blue:'transparent', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                        {on && <svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1,4.5 3.5,7 8,2" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{ fontSize:12, color: on?C.blue:C.ink }}>{label}</span>
                    </label>
                  );
                })}
              </div>
              {/* Plan diagram */}
              <div style={{ border:`1px solid ${C.hair}`, borderRadius:4, background:C.bg, display:'flex', justifyContent:'center', padding:'6px 0' }}>
                <OpenSidesPlan openFront={booth.openFront} openBack={booth.openBack} openLeft={booth.openLeft} openRight={booth.openRight} />
              </div>
            </PropBlock>
          </div>
        </aside>
      </div>

      {/* ── Status Bar ────────────────────────────────────────────── */}
      <footer style={{ height:26, background:'#1a1815', borderTop:'1px solid #111', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:3, overflow:'hidden' }}>
          <span style={{ fontFamily:MONO, fontSize:9.5, color:'#4a8a5e', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#4a8a5e', display:'inline-block' }} />
            Connected
          </span>
          {[`TechCorp_Workspace_A`,`System Octanorm`,`Floor ${floorArea} m²`,`Bounds ${booth.width} × ${booth.depth} × ${booth.height} m`,`Parts 24`,`Weight 184 kg`].map((s,i) => (
            <span key={i} style={{ fontFamily:MONO, fontSize:9.5, color:'#6b6058', marginLeft:4, whiteSpace:'nowrap' }}>· {s}</span>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ fontFamily:MONO, fontSize:9.5, color:'#6b6058' }}>Auto-save ON</span>
          <span style={{ fontFamily:MONO, fontSize:9.5, color:'#4a8a5e' }}>Last saved Just now</span>
        </div>
      </footer>
    </div>
  );
}
