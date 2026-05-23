import { useState, useCallback, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Booth3D } from "@/components/workspace/Booth3D";
import type { BoothSystem } from "@/components/workspace/BoothCanvas";
import {
  createProjectWorkspaceVersion,
  getCurrentWorkspace,
  saveProjectWorkspace,
  type ProjectWorkspace,
} from "@/lib/platform-api";
import {
  ChevronLeft, Undo2, Redo2, Save, Camera, History, Send,
  ZoomIn, ZoomOut, Maximize2, Search, Plus, ChevronDown, Trash2,
  Square, LayoutTemplate, Lightbulb, Monitor, Layers, Map, Box, PanelLeft, X,
  CheckCircle2, Package, StickyNote, Settings2, Home,
} from "lucide-react";

// ── Palette ────────────────────────────────────────────────────────
const C = { bg:'#f3f1ec', panel:'#ffffff', ink:'#181613', hair:'#d8d3c9', blue:'#1d4ed8', orange:'#c2410c', green:'#2f7d3a', muted:'#6b6560', bgHover:'#ece9e3' } as const;
const MONO = '"SamsungOne","SamsungOne UI","SamsungOneKorean","Samsung Sharp Sans",system-ui,sans-serif';
const UI   = '"SamsungOne","SamsungOne UI","SamsungOneKorean","Samsung Sharp Sans",system-ui,sans-serif';

// ── Types ──────────────────────────────────────────────────────────
interface BoothState { width:number; depth:number; height:number; system:BoothSystem; companyName:string; openFront:boolean; openBack:boolean; openLeft:boolean; openRight:boolean; }
interface WorkspacePlacedItem { id:string; catalogId:string; name:string; sku:string; qty:number; w:number; d:number; h:number; color:string; weight:number; }
interface Note { id:string; text:string; color:string; createdAt:string; }
interface Snapshot { id:string; name:string; data:WSData; createdAt:string; }
interface WSData { booth:BoothState; themeIdx:number; carpetIdx:number; placedItems:WorkspacePlacedItem[]; notes:Note[]; }

// ── Catalog ────────────────────────────────────────────────────────
interface CatItem { id:string; name:string; sku:string; dim:string; inStand:number; icon:React.ElementType; }
const CATALOG: Record<string,CatItem[]> = {
  Structure: [
    {id:'s1',name:'Solid Wall',sku:'OCT-SW-100',dim:'1.0 × 2.5',inStand:6,icon:Square},
    {id:'s2',name:'Glass Wall',sku:'OCT-GW-100',dim:'1.0 × 2.5',inStand:2,icon:Square},
    {id:'s3',name:'Curved Wall',sku:'OCT-CW-100',dim:'1.0 × 2.5',inStand:0,icon:Square},
    {id:'s4',name:'Header Beam',sku:'OCT-HB-200',dim:'2.0 × 0.85',inStand:0,icon:LayoutTemplate},
  ],
  Fascia: [
    {id:'f1',name:'Std Fascia',sku:'FAS-STD-01',dim:'1.0 × 0.3',inStand:6,icon:LayoutTemplate},
    {id:'f2',name:'Corner Fascia',sku:'FAS-COR-01',dim:'0.3 × 0.3',inStand:4,icon:LayoutTemplate},
  ],
  Furniture: [
    {id:'u1',name:'Reception Counter',sku:'FUR-RC-04',dim:'1.2 × 0.6',inStand:1,icon:Monitor},
    {id:'u2',name:'Design Chair',sku:'FUR-DC-12',dim:'0.45 × 0.6',inStand:2,icon:PanelLeft},
    {id:'u3',name:'Bar Stool',sku:'FUR-BS-08',dim:'0.4 × 0.4',inStand:0,icon:PanelLeft},
    {id:'u4',name:'Meeting Table',sku:'FUR-MT-01',dim:'1.8 × 0.8',inStand:0,icon:Monitor},
    {id:'u5',name:'Display Shelf',sku:'FUR-DS-02',dim:'1.0 × 0.35',inStand:0,icon:Layers},
    {id:'u6',name:'Storage Cabinet',sku:'FUR-SC-01',dim:'0.8 × 0.5',inStand:0,icon:Box},
  ],
  Lighting: [
    {id:'l1',name:'Spotlight',sku:'LIT-SP-100',dim:'0.15 × 0.15',inStand:4,icon:Lightbulb},
    {id:'l2',name:'LED Strip',sku:'LIT-LED-01',dim:'1.0 × 0.03',inStand:8,icon:Lightbulb},
    {id:'l3',name:'Arm Light',sku:'LIT-AR-100',dim:'0.4 × 0.3',inStand:2,icon:Lightbulb},
  ],
};

const ITEM_PROPS: Record<string,{w:number;d:number;h:number;color:string;weight:number}> = {
  s1:{w:1.0,d:0.08,h:2.5,color:'#4a90d9',weight:28}, s2:{w:1.0,d:0.05,h:2.5,color:'#7bb8f0',weight:22},
  s3:{w:1.0,d:0.08,h:2.5,color:'#6bb0e8',weight:26}, s4:{w:2.0,d:0.15,h:0.85,color:'#5580c0',weight:18},
  f1:{w:1.0,d:0.15,h:0.3,color:'#8868ee',weight:8},   f2:{w:0.3,d:0.3,h:0.3,color:'#9878f0',weight:5},
  u1:{w:1.2,d:0.6,h:1.0,color:'#e67e22',weight:45},   u2:{w:0.45,d:0.5,h:0.9,color:'#f39c12',weight:12},
  u3:{w:0.4,d:0.4,h:1.0,color:'#e5890a',weight:8},    u4:{w:1.8,d:0.8,h:0.75,color:'#d4790c',weight:38},
  u5:{w:1.0,d:0.35,h:1.8,color:'#cf6d17',weight:22},  u6:{w:0.8,d:0.5,h:1.8,color:'#ba5d0b',weight:35},
  l1:{w:0.15,d:0.15,h:0.3,color:'#d4af37',weight:2},  l2:{w:1.0,d:0.05,h:0.1,color:'#c8a020',weight:1},
  l3:{w:0.4,d:0.3,h:0.5,color:'#b89018',weight:3},
};

const THEMES  = [{label:'Charcoal',color:'#3b3e44'},{label:'White',color:'#dde0e4'},{label:'Walnut',color:'#7a4a2a'},{label:'Navy',color:'#1a2640'}];
const CARPETS = [{label:'Black',color:'#1a1a1a'},{label:'Bone',color:'#dde0e4'},{label:'Gray',color:'#7a7e84'},{label:'Navy',color:'#1a2640'},{label:'Forest',color:'#1e3a28'},{label:'Terracotta',color:'#5a2316'}];
const NOTE_COLORS = ['#1d4ed8','#c2410c','#2f7d3a','#7c3aed','#b45309'];
const CAT_TOTAL: Record<string,number> = { Structure:4, Fascia:2, Furniture:6, Lighting:3 };

// ── Sub-components ─────────────────────────────────────────────────
function Hairline({margin=16}:{margin?:number}) { return <div style={{height:1,background:C.hair,margin:`0 -${margin}px`}}/>; }
function MonoLabel({children,right}:{children:React.ReactNode;right?:React.ReactNode}) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}><span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',color:C.muted,textTransform:'uppercase'}}>{children}</span>{right&&<span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{right}</span>}</div>;
}
function PropBlock({label,right,children}:{label:string;right?:React.ReactNode;children:React.ReactNode}) {
  return <div style={{padding:'12px 0'}}><MonoLabel right={right}>{label}</MonoLabel>{children}</div>;
}
function DimInput({label,value,min,max,step,onChange}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void}) {
  return (<div>
    <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>{label}</label>
    <div style={{position:'relative'}}>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e=>{const n=parseFloat(e.target.value);if(!isNaN(n)&&n>=min&&n<=max)onChange(n);}}
        style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:12.5,fontWeight:600,color:C.ink,paddingLeft:8,paddingRight:22,boxSizing:'border-box',outline:'none'}}/>
      <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:9,color:C.muted}}>m</span>
    </div>
  </div>);
}
function Swatch({color,active,onClick,size=28,title}:{color:string;active:boolean;onClick:()=>void;size?:number;title?:string}) {
  const light=color==='#dde0e4';
  return (<button onClick={onClick} title={title??color} style={{width:size,height:size,borderRadius:4,background:color,cursor:'pointer',flexShrink:0,border:`${active?2:1}px solid ${active?C.ink:C.hair}`,position:'relative'}}>
    {active&&<span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke={light?C.ink:'#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
  </button>);
}
function OpenSidesPlan({openFront,openBack,openLeft,openRight}:{openFront:boolean;openBack:boolean;openLeft:boolean;openRight:boolean}) {
  const open=(on:boolean)=>({stroke:on?C.orange:C.ink,strokeDasharray:on?'5 3.5':undefined});
  return (<svg width="188" height="116" viewBox="0 0 188 116" style={{fontFamily:MONO}}>
    <line x1="30" y1="24" x2="158" y2="24" strokeWidth="2" {...open(openBack)}/>
    <line x1="30" y1="24" x2="30" y2="92" strokeWidth="2" {...open(openLeft)}/>
    <line x1="158" y1="24" x2="158" y2="92" strokeWidth="2" {...open(openRight)}/>
    <line x1="30" y1="92" x2="158" y2="92" strokeWidth="2" {...open(openFront)}/>
    <text x="94" y="62" textAnchor="middle" fontSize="18" fill={C.muted} opacity={0.18} fontWeight="700">T</text>
    <text x="94" y="15" textAnchor="middle" fontSize="7.5" fill={openBack?C.orange:C.muted}>BACK</text>
    <text x="94" y="110" textAnchor="middle" fontSize="7.5" fill={openFront?C.orange:C.muted}>FRONT{openFront?" · OPEN":""}</text>
    <text x="16" y="60" textAnchor="middle" fontSize="7.5" fill={openLeft?C.orange:C.muted} transform="rotate(-90,16,60)">LEFT</text>
    <text x="172" y="60" textAnchor="middle" fontSize="7.5" fill={openRight?C.orange:C.muted} transform="rotate(90,172,60)">RIGHT</text>
  </svg>);
}
function AxisGizmo() {
  return (<svg width="58" height="58" viewBox="0 0 58 58">
    <line x1="29" y1="29" x2="50" y2="39" stroke="#c53030" strokeWidth="1.5"/>
    <text x="52" y="43" fontSize="8" fill="#c53030" fontFamily={MONO} fontWeight="700">X</text>
    <line x1="29" y1="29" x2="29" y2="7" stroke="#2f855a" strokeWidth="1.5"/>
    <text x="25" y="5" fontSize="8" fill="#2f855a" fontFamily={MONO} fontWeight="700">Y</text>
    <line x1="29" y1="29" x2="8" y2="39" stroke="#2b6cb0" strokeWidth="1.5"/>
    <text x="1" y="43" fontSize="8" fill="#2b6cb0" fontFamily={MONO} fontWeight="700">Z</text>
    <circle cx="29" cy="29" r="2.5" fill={C.ink}/>
  </svg>);
}

// ── Toast ──────────────────────────────────────────────────────────
function Toast({msg,onClose}:{msg:string;onClose:()=>void}) {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return (<div style={{position:'fixed',bottom:48,left:'50%',transform:'translateX(-50%)',background:C.ink,color:'#fff',fontFamily:UI,fontSize:12,fontWeight:600,padding:'10px 20px',borderRadius:6,zIndex:1000,display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>
    <CheckCircle2 size={14} style={{color:'#6ee7b7'}}/>{msg}
  </div>);
}

// ── Initial state ──────────────────────────────────────────────────
const INITIAL_BOOTH: BoothState = {width:6,depth:3,height:2.5,system:'octanorm',companyName:'TECHCORP INDUSTRIES',openFront:true,openBack:false,openLeft:false,openRight:false};
const INITIAL_WS: WSData = {booth:INITIAL_BOOTH,themeIdx:0,carpetIdx:0,placedItems:[],notes:[]};

function workspaceSnapshots(record: ProjectWorkspace): Snapshot[] {
  return record.versions.map(version => ({
    id: version.id,
    name: `v${version.versionNumber} - ${version.title}`,
    data: version.workspace as WSData,
    createdAt: new Date(version.createdAt).toLocaleDateString(),
  }));
}

// ── Main ──────────────────────────────────────────────────────────
export default function PMWorkspace() {
  const [ws,    setWS]    = useState<WSData>(INITIAL_WS);
  const histStackRef      = useRef<WSData[]>([INITIAL_WS]);
  const histIdxRef        = useRef(0);
  const [histIdx, setHistIdx] = useState(0);
  const [histLen, setHistLen] = useState(1);

  const [viewMode,   setViewMode]   = useState('iso');
  const [search,     setSearch]     = useState('');
  const [openCats,   setOpenCats]   = useState(new Set(['Structure','Furniture']));
  const [activeTab,  setActiveTab]  = useState<'props'|'bom'|'notes'>('props');
  const [activeId,   setActiveId]   = useState('s1');

  const [showSendDlg,   setShowSendDlg]   = useState(false);
  const [showSnapDlg,   setShowSnapDlg]   = useState(false);
  const [showHistPanel, setShowHistPanel] = useState(false);
  const [snapName,      setSnapName]      = useState('');
  const [snapshots,     setSnapshots]     = useState<Snapshot[]>([]);
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [toast,         setToast]         = useState('');
  const [lastSaved,     setLastSaved]     = useState('Not saved');
  const [newNote,       setNewNote]       = useState('');
  const [noteColor,     setNoteColor]     = useState(NOTE_COLORS[0]);
  const [workspaceRecord, setWorkspaceRecord] = useState<ProjectWorkspace | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState('');

  // ── History helpers ───────────────────────────────────────────
  const resetWorkspace = useCallback((data:WSData)=>{
    setWS(data);
    histStackRef.current = [data];
    histIdxRef.current = 0;
    setHistIdx(0);
    setHistLen(1);
  },[]);

  const commit = useCallback((updater:(prev:WSData)=>WSData)=>{
    setWS(prev=>{
      const next = updater(prev);
      const stack = histStackRef.current.slice(0, histIdxRef.current+1);
      stack.push(next);
      if(stack.length>60) stack.shift();
      histStackRef.current = stack;
      histIdxRef.current = stack.length-1;
      setHistIdx(histIdxRef.current);
      setHistLen(stack.length);
      return next;
    });
  },[]);

  const undo = () => {
    if(histIdxRef.current<=0) return;
    histIdxRef.current--;
    setHistIdx(histIdxRef.current);
    setWS(histStackRef.current[histIdxRef.current]);
  };
  const redo = () => {
    if(histIdxRef.current>=histStackRef.current.length-1) return;
    histIdxRef.current++;
    setHistIdx(histIdxRef.current);
    setWS(histStackRef.current[histIdxRef.current]);
  };
  const canUndo = histIdx>0;
  const canRedo = histIdx<histLen-1;

  const set = (k:keyof BoothState, v:BoothState[keyof BoothState]) =>
    commit(prev=>({...prev,booth:{...prev.booth,[k]:v}}));

  const save = async () => {
    if(!workspaceRecord) {
      setToast('Workspace is still loading');
      return;
    }

    setLastSaved('Saving...');
    try {
      const saved = await saveProjectWorkspace(workspaceRecord.project.id, ws, 'Manual save');
      setWorkspaceRecord(saved);
      setSnapshots(workspaceSnapshots(saved));
      setLastSaved('Just now');
      setWorkspaceError('');
      setToast('Design saved to PostgreSQL');
    } catch (err) {
      setLastSaved('Save failed');
      setWorkspaceError(err instanceof Error ? err.message : 'Could not save workspace');
      setToast('Save failed');
    }
  };

  // Load from PostgreSQL on mount
  useEffect(()=>{
    let isMounted = true;

    getCurrentWorkspace()
      .then(record => {
        if(!isMounted) return;
        setWorkspaceRecord(record);
        resetWorkspace(record.workspace as WSData);
        setSnapshots(workspaceSnapshots(record));
        setLastSaved(record.currentVersion ? `v${record.currentVersion.versionNumber}` : 'Loaded');
        setWorkspaceError('');
      })
      .catch(err => {
        if(!isMounted) return;
        setWorkspaceError(err instanceof Error ? err.message : 'Could not load workspace');
        setLastSaved('Load failed');
      })
      .finally(() => {
        if(isMounted) setIsWorkspaceLoading(false);
      });

    return () => { isMounted = false; };
  },[resetWorkspace]);

  // Auto-save every 30s
  useEffect(()=>{
    if(!workspaceRecord || isWorkspaceLoading) return;
    const t=setInterval(()=>{
      saveProjectWorkspace(workspaceRecord.project.id, ws, 'Autosave')
        .then(saved => {
          setWorkspaceRecord(saved);
          setSnapshots(workspaceSnapshots(saved));
          setLastSaved(new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}));
          setWorkspaceError('');
        })
        .catch(err => {
          setLastSaved('Autosave failed');
          setWorkspaceError(err instanceof Error ? err.message : 'Autosave failed');
        });
    },30000);
    return()=>clearInterval(t);
  },[isWorkspaceLoading, workspaceRecord?.project.id, ws]);

  const createSnapshot = async () => {
    if(!snapName.trim() || !workspaceRecord) return;
    const name = snapName.trim();
    try {
      const saved = await createProjectWorkspaceVersion(workspaceRecord.project.id, ws, name);
      setWorkspaceRecord(saved);
      setSnapshots(workspaceSnapshots(saved));
      setSnapName('');
      setShowSnapDlg(false);
      setLastSaved(`v${saved.currentVersion?.versionNumber ?? saved.design.currentVersionNumber}`);
      setWorkspaceError('');
      setToast(`Snapshot "${name}" saved`);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'Could not save snapshot');
      setToast('Snapshot failed');
    }
  };
  const restoreSnapshot = (snap:Snapshot) => {
    resetWorkspace(snap.data);
    setShowHistPanel(false);
    setToast(`Restored locally: ${snap.name}`);
  };

  // ── Item placement ────────────────────────────────────────────
  const addItem = (item:CatItem) => {
    const props = ITEM_PROPS[item.id] ?? {w:0.5,d:0.5,h:1,color:'#888',weight:10};
    commit(prev=>{
      const existing = prev.placedItems.find(p=>p.catalogId===item.id);
      if(existing) {
        return {...prev,placedItems:prev.placedItems.map(p=>p.catalogId===item.id?{...p,qty:p.qty+1}:p)};
      }
      const newItem:WorkspacePlacedItem = {
        id:`${item.id}-${Date.now()}`, catalogId:item.id,
        name:item.name, sku:item.sku, qty:1, ...props,
      };
      return {...prev,placedItems:[...prev.placedItems,newItem]};
    });
    setActiveId(item.id);
    setToast(`${item.name} added to BOM`);
  };
  const removeItem = (id:string) => commit(prev=>({...prev,placedItems:prev.placedItems.filter(p=>p.id!==id)}));

  const addNote = () => {
    if(!newNote.trim()) return;
    const note:Note = {id:Date.now().toString(),text:newNote.trim(),color:noteColor,createdAt:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})};
    commit(prev=>({...prev,notes:[...prev.notes,note]}));
    setNewNote('');
  };
  const removeNote = (id:string) => commit(prev=>({...prev,notes:prev.notes.filter(n=>n.id!==id)}));

  const { booth, themeIdx, carpetIdx, placedItems, notes } = ws;
  const floorArea    = (booth.width*booth.depth).toFixed(1);
  const openCount    = [booth.openFront,booth.openBack,booth.openLeft,booth.openRight].filter(Boolean).length;
  const totalWeight  = placedItems.reduce((a,p)=>a+p.weight*p.qty,0);
  const totalParts   = placedItems.reduce((a,p)=>a+p.qty,0);
  const carpetColor  = CARPETS[carpetIdx].color;

  const filteredCatalog = Object.fromEntries(
    Object.entries(CATALOG).map(([cat,items])=>[cat,
      search?items.filter(i=>`${i.name} ${i.sku}`.toLowerCase().includes(search.toLowerCase())):items
    ])
  );

  // ── BOM structural auto-calc ─────────────────────────────────
  const isMax = booth.system==='maxima';
  const mod   = isMax?2:1;
  const cols  = Math.ceil(booth.width/mod)+1;
  const rows  = Math.ceil(booth.depth/mod)+1;
  const rl    = isMax?1:2;
  const closedSides = [!booth.openFront,!booth.openBack,!booth.openLeft,!booth.openRight].filter(Boolean).length;
  const structItems = [
    {name:'Upright Post',   sku:`${isMax?'MAX':'OCT'}-UP-01`, qty:cols*rows,                            unit:'ea',weight:4.5},
    {name:'Horizontal Rail',sku:`${isMax?'MAX':'OCT'}-HR-01`, qty:(cols-1)*rows*rl+(rows-1)*cols*rl,   unit:'ea',weight:2.2},
    {name:'Wall Panel',     sku:`${isMax?'MAX':'OCT'}-WP-01`, qty:Math.max(0,(cols-1)*(rows-1)*closedSides), unit:'ea',weight:3.8},
    {name:'Fascia Board',   sku:'FAS-STD-01',                 qty:(cols-1)*2+(rows-1)*2,               unit:'ea',weight:1.4},
    {name:'Base Foot',      sku:`${isMax?'MAX':'OCT'}-BF-01`, qty:cols*rows,                            unit:'ea',weight:1.2},
  ];
  const structWeight = structItems.reduce((a,s)=>a+s.qty*s.weight,0);

  const iconBtn = (Icon:React.ElementType,tooltip:string,onClick?:()=>void,disabled?:boolean,style?:React.CSSProperties) => (
    <button title={tooltip} onClick={onClick} disabled={disabled}
      style={{background:'none',border:'none',cursor:disabled?'not-allowed':'pointer',padding:'5px 7px',color:disabled?C.hair:C.muted,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:3,opacity:disabled?0.4:1,...style}}>
      <Icon size={13}/>
    </button>
  );

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,color:C.ink,fontFamily:UI,overflow:'hidden',userSelect:'none'}}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header style={{height:46,borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',background:C.panel,flexShrink:0,gap:8}}>
        <div style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>
          <Link href="/pm">
            <button style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4,color:C.muted,padding:'4px 6px',borderRadius:4,flexShrink:0}}>
              <ChevronLeft size={13}/><span style={{fontFamily:MONO,fontSize:10}}>Back</span>
            </button>
          </Link>
          <div style={{width:1,height:18,background:C.hair,flexShrink:0}}/>
          <div style={{display:'flex',flexDirection:'column',lineHeight:1.2,minWidth:0}}>
            <span style={{fontFamily:MONO,fontSize:8.5,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase'}}>Project</span>
            <span style={{fontSize:12.5,fontWeight:700,letterSpacing:'-0.01em',whiteSpace:'nowrap'}}>{workspaceRecord?.project.name ?? 'Loading workspace'}</span>
          </div>
          <span style={{fontFamily:MONO,fontSize:9.5,background:`${C.blue}12`,color:C.blue,border:`1px solid ${C.blue}28`,borderRadius:4,padding:'2px 7px',flexShrink:0}}>
            v{workspaceRecord?.currentVersion?.versionNumber ?? workspaceRecord?.design.currentVersionNumber ?? 1}
          </span>
          <div style={{width:1,height:18,background:C.hair,flexShrink:0}}/>
          <span style={{fontFamily:MONO,fontSize:9.5,display:'flex',alignItems:'center',gap:5,color:C.green,flexShrink:0}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:workspaceError?C.orange:C.green,display:'inline-block',flexShrink:0}}/>{workspaceError?'WORKSPACE ISSUE':isWorkspaceLoading?'LOADING WORKSPACE':'LIVE WORKSPACE'}
          </span>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:5,flexShrink:0}}>
          <div style={{display:'flex',border:`1px solid ${C.hair}`,borderRadius:4,overflow:'hidden'}}>
            {iconBtn(Undo2,'Undo (Ctrl+Z)',undo,!canUndo,{borderRight:`1px solid ${C.hair}`})}
            {iconBtn(Redo2,'Redo (Ctrl+Y)',redo,!canRedo)}
          </div>
          <div style={{width:1,height:18,background:C.hair}}/>
          <button onClick={save} title="Save" style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.ink}}>
            <Save size={12}/> Save
          </button>
          <button onClick={()=>setShowSnapDlg(true)} title="Save snapshot" style={{background:'none',border:`1px solid ${C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.ink}}>
            <Camera size={12}/> Snapshot
          </button>
          <button onClick={()=>setShowHistPanel(h=>!h)} style={{background:showHistPanel?C.bg:'none',border:`1px solid ${showHistPanel?C.ink:C.hair}`,borderRadius:4,padding:'5px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11.5,fontFamily:UI,color:C.ink}}>
            <History size={12}/> History
            <span style={{fontFamily:MONO,fontSize:9,background:`${C.blue}15`,color:C.blue,borderRadius:3,padding:'1px 5px'}}>{snapshots.length}</span>
          </button>
          <button onClick={()=>setShowSendDlg(true)} style={{background:C.blue,border:'none',color:'#fff',borderRadius:4,padding:'6px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,fontFamily:UI}}>
            <Send size={12}/> Send to Client
          </button>
        </div>
      </header>

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Left — Component Catalog ────────────────────────── */}
        <aside style={{width:240,borderRight:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.12em',color:C.muted,textTransform:'uppercase'}}>§ Components</span>
            <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{Object.values(CATALOG).reduce((a,b)=>a+b.length,0)} items</span>
          </div>

          <div style={{padding:'8px 10px',borderBottom:`1px solid ${C.hair}`,flexShrink:0}}>
            <div style={{position:'relative'}}>
              <Search size={11} style={{position:'absolute',left:8,top:'50%',transform:'translateY(-50%)',color:C.muted}}/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items, SKUs…"
                style={{width:'100%',height:28,paddingLeft:26,paddingRight:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:11.5,color:C.ink,outline:'none',boxSizing:'border-box'}}/>
              <span style={{position:'absolute',right:7,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:8.5,color:C.muted,border:`1px solid ${C.hair}`,borderRadius:3,padding:'1px 4px',lineHeight:1.2}}>⌘K</span>
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto'}}>
            {Object.entries(filteredCatalog).map(([cat,items])=>{
              const isOpen = openCats.has(cat);
              return (
                <div key={cat} style={{borderBottom:`1px solid ${C.hair}`}}>
                  <button onClick={()=>setOpenCats(prev=>{const s=new Set(prev);s.has(cat)?s.delete(cat):s.add(cat);return s;})}
                    style={{width:'100%',background:'none',border:'none',cursor:'pointer',padding:'7px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',textAlign:'left'}}>
                    <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',color:C.ink}}>
                      {cat} · {String(CAT_TOTAL[cat]??items.length).padStart(2,'0')}
                    </span>
                    <ChevronDown size={11} style={{color:C.muted,transform:isOpen?'rotate(0deg)':'rotate(-90deg)',transition:'transform 0.15s',flexShrink:0}}/>
                  </button>

                  {isOpen&&(
                    <div style={{padding:'6px 10px 10px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                      {items.map(item=>{
                        const isActive = activeId===item.id;
                        const placed   = placedItems.find(p=>p.catalogId===item.id);
                        const hasCount = item.inStand>0;
                        const Icon     = item.icon;
                        return (
                          <button key={item.id} onClick={()=>addItem(item)}
                            style={{position:'relative',background:isActive?'#f0ecff':placed?`${C.blue}08`:C.bg,border:`1px ${isActive?'solid':hasCount?'solid':'dashed'} ${isActive?C.ink:placed?C.blue:C.hair}`,borderRadius:4,padding:'9px 7px 7px',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:3,textAlign:'center',transition:'all 0.1s'}}>
                            {placed&&(
                              <div style={{position:'absolute',top:3,right:3,background:C.blue,borderRadius:2,padding:'1px 4px'}}>
                                <span style={{fontFamily:MONO,fontSize:8,color:'#fff',fontWeight:700}}>x{placed.qty}</span>
                              </div>
                            )}
                            {!placed&&hasCount&&(
                              <span style={{position:'absolute',top:3,right:3,fontFamily:MONO,fontSize:8,color:C.blue,fontWeight:700}}>×{item.inStand}</span>
                            )}
                            <Icon size={17} style={{color:isActive?C.ink:C.muted,flexShrink:0}}/>
                            <span style={{fontSize:10.5,fontWeight:600,color:C.ink,lineHeight:1.2,wordBreak:'break-word'}}>{item.name}</span>
                            <span style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{item.sku}</span>
                          </button>
                        );
                      })}
                      <button style={{background:'none',border:`1px dashed ${C.hair}`,borderRadius:4,padding:'9px 7px',display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'pointer',color:C.muted}}>
                        <Plus size={13}/><span style={{fontFamily:MONO,fontSize:9}}>Custom</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Placed items summary */}
          {placedItems.length>0&&(
            <div style={{padding:'8px 14px',borderTop:`1px solid ${C.hair}`,background:C.bg,flexShrink:0}}>
              <div style={{fontFamily:MONO,fontSize:9,color:C.muted,marginBottom:4}}>PLACED IN STAND</div>
              {placedItems.map(p=>(
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                  <div style={{width:8,height:8,borderRadius:2,background:p.color,flexShrink:0}}/>
                  <span style={{fontFamily:MONO,fontSize:9,flex:1,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                  <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>×{p.qty}</span>
                  <button onClick={()=>removeItem(p.id)} style={{background:'none',border:'none',cursor:'pointer',padding:2,color:C.muted,display:'flex'}}>
                    <Trash2 size={10}/>
                  </button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ── Center — Canvas (Booth3D iframe renderer) ────────── */}
        <main style={{flex:1,position:'relative',overflow:'hidden',backgroundColor:C.bg,
          backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px)'}}>

          {/* Booth3D fills canvas — iframe handles orbit/zoom internally */}
          <div style={{position:'absolute',inset:0}}>
            <Booth3D config={{
              width:booth.width, depth:booth.depth, height:booth.height,
              system:booth.system, companyName:booth.companyName,
              primaryColor:THEMES[themeIdx].color,
              carpetColor,
              openFront:booth.openFront, openBack:booth.openBack,
              openLeft:booth.openLeft, openRight:booth.openRight,
            }}/>
          </div>

          {/* Top-left floating badges */}
          <div style={{position:'absolute',top:12,left:12,display:'flex',gap:6,zIndex:10,pointerEvents:'none'}}>
            {[
              {text:'● LIVE WORKSPACE', color:C.green},
              {text:`${booth.system==='maxima'?'◈ MAXIMA':'⬡ OCTANORM'} · ${booth.width}×${booth.depth}M`, color:C.muted},
            ].map(b=>(
              <span key={b.text} style={{fontFamily:MONO,fontSize:9.5,display:'flex',alignItems:'center',gap:5,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,padding:'4px 9px',color:b.color,letterSpacing:'0.04em'}}>{b.text}</span>
            ))}
          </div>

          {/* View mode toggle — top right (cosmetic; iframe handles its own camera) */}
          <div style={{position:'absolute',top:12,right:12,display:'flex',gap:1,background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,padding:2,zIndex:10}}>
            {([{icon:Home,key:'home'},{icon:Box,key:'iso'},{icon:Map,key:'plan'},{icon:Layers,key:'front'}] as const).map(({icon:Icon,key})=>(
              <button key={key} onClick={()=>setViewMode(key)}
                style={{background:viewMode===key?C.ink:'none',border:'none',borderRadius:3,padding:'5px 8px',cursor:'pointer',color:viewMode===key?'#fff':C.muted,transition:'all 0.1s'}}>
                <Icon size={12}/>
              </button>
            ))}
          </div>

          {/* Axis gizmo */}
          <div style={{position:'absolute',top:58,right:12,zIndex:10,background:`${C.panel}e0`,border:`1px solid ${C.hair}`,borderRadius:4,padding:5}}>
            <AxisGizmo/>
          </div>

          {/* Height dimension label — left center */}
          <div style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',zIndex:10,pointerEvents:'none'}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <div style={{width:1,height:28,background:C.muted,opacity:0.5}}/>
              <div style={{transform:'rotate(-90deg)',whiteSpace:'nowrap',fontFamily:MONO,fontSize:9.5,color:C.muted,letterSpacing:'0.04em'}}>{booth.height.toFixed(2)} m</div>
              <div style={{width:1,height:28,background:C.muted,opacity:0.5}}/>
            </div>
          </div>

          {/* Zoom hint controls — bottom left */}
          <div style={{position:'absolute',bottom:38,left:12,display:'flex',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:4,overflow:'hidden',zIndex:10}}>
            {([ZoomIn, ZoomOut, Maximize2] as const).map((Icon,i)=>(
              <button key={i} title={i===0?'Zoom In':i===1?'Zoom Out':'Fit'} style={{background:'none',border:'none',cursor:'pointer',padding:'6px 8px',color:C.muted,borderRight:i<2?`1px solid ${C.hair}`:'none'}}>
                <Icon size={13}/>
              </button>
            ))}
          </div>

          {/* Bottom viewport info bar */}
          <div style={{position:'absolute',bottom:0,left:0,right:0,height:32,background:C.panel,borderTop:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',zIndex:10}}>
            <div style={{display:'flex',alignItems:'center',gap:0}}>
              {[
                {text:booth.system==='maxima'?'Maxima':'Octanorm',style:{fontWeight:700}},
                {text:'|',style:{color:C.hair,margin:'0 8px'}},
                {text:openCount>0?`OPEN: ${[booth.openFront&&'FRONT',booth.openBack&&'BACK',booth.openLeft&&'LEFT',booth.openRight&&'RIGHT'].filter(Boolean).join(' + ')}`:'ALL SIDES CLOSED',style:{color:openCount>0?C.orange:C.muted}},
                {text:'|',style:{color:C.hair,margin:'0 8px'}},
                {text:`${booth.width.toFixed(1)} × ${booth.depth.toFixed(1)} m`},
                {text:`H ${booth.height.toFixed(2)} m`,style:{marginLeft:10}},
                {text:'40 mm profile',style:{marginLeft:10}},
              ].map((item,i)=>(
                <span key={i} style={{fontFamily:MONO,fontSize:9.5,color:C.ink,letterSpacing:'0.04em',...item.style}}>{item.text}</span>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>SCROLL zoom · CLICK inspect part · CAM 40° · FOV 32mm</span>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{position:'relative',width:40,height:10}}>
                  <div style={{position:'absolute',left:0,right:0,top:'50%',height:1,background:C.ink}}/>
                  <div style={{position:'absolute',left:0,top:0,bottom:0,width:1,background:C.ink}}/>
                  <div style={{position:'absolute',right:0,top:0,bottom:0,width:1,background:C.ink}}/>
                  {[0.25,0.5,0.75].map(f=>(
                    <div key={f} style={{position:'absolute',left:`${f*100}%`,top:'30%',height:'40%',width:1,background:C.ink,opacity:0.5}}/>
                  ))}
                </div>
                <span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>1.0 m</span>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right — Properties / BOM / Notes ─────────────────── */}
        <aside style={{width:282,borderLeft:`1px solid ${C.hair}`,background:C.panel,display:'flex',flexDirection:'column',flexShrink:0}}>
          {/* Tab bar */}
          <div style={{display:'flex',borderBottom:`1px solid ${C.hair}`,flexShrink:0}}>
            {([['props','Properties',Settings2],['bom','BOM',Package],['notes','Notes',StickyNote]] as const).map(([k,label,Icon])=>(
              <button key={k} onClick={()=>setActiveTab(k as typeof activeTab)}
                style={{flex:1,background:activeTab===k?C.panel:'transparent',border:'none',borderBottom:activeTab===k?`2px solid ${C.blue}`:'2px solid transparent',padding:'8px 4px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:4,fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.08em',color:activeTab===k?C.blue:C.muted,textTransform:'uppercase'}}>
                <Icon size={10}/> {label}
              </button>
            ))}
          </div>

          {/* Properties Tab */}
          {activeTab==='props'&&(
            <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
              <PropBlock label="Workspace Theme">
                <div style={{display:'flex',gap:6}}>
                  {THEMES.map((t,i)=><Swatch key={t.label} color={t.color} active={themeIdx===i} onClick={()=>commit(p=>({...p,themeIdx:i}))} title={t.label}/>)}
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Workplane · Carpet" right="6 swatches">
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {CARPETS.map((c,i)=><Swatch key={c.label} color={c.color} active={carpetIdx===i} onClick={()=>commit(p=>({...p,carpetIdx:i}))} size={24} title={c.label}/>)}
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Stand Configuration" right="metric">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <DimInput label="Width"  value={booth.width}  min={1} max={40} step={0.5} onChange={v=>set('width',v)}/>
                  <DimInput label="Depth"  value={booth.depth}  min={1} max={40} step={0.5} onChange={v=>set('depth',v)}/>
                </div>
                <DimInput label="Height" value={booth.height} min={1.5} max={6} step={0.5} onChange={v=>set('height',v)}/>
                <div style={{marginTop:8}}>
                  <label style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>System</label>
                  <select value={booth.system} onChange={e=>set('system',e.target.value as BoothSystem)}
                    style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:8,boxSizing:'border-box',outline:'none',cursor:'pointer'}}>
                    <option value="octanorm">Octanorm (1 m module)</option>
                    <option value="maxima">Maxima (2 m module)</option>
                  </select>
                </div>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Fascia / Company Name" right={`${booth.companyName.length}/22`}>
                <input value={booth.companyName} onChange={e=>set('companyName',e.target.value.toUpperCase().slice(0,22))}
                  style={{width:'100%',height:34,border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,fontFamily:MONO,fontSize:12,fontWeight:700,color:C.ink,paddingLeft:10,boxSizing:'border-box',outline:'none',letterSpacing:'0.06em'}}/>
              </PropBlock>
              <Hairline/>
              <PropBlock label="Open Sides" right={`${openCount} of 4 open`}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:2,marginBottom:10}}>
                  {([['openFront','Front'],['openBack','Back'],['openLeft','Left'],['openRight','Right']] as [keyof BoothState,string][]).map(([key,label])=>{
                    const on=!!booth[key];
                    return (<label key={key} style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',padding:'5px 4px'}}>
                      <div onClick={()=>set(key,!on)} style={{width:14,height:14,borderRadius:3,flexShrink:0,border:`1px solid ${on?C.blue:C.hair}`,background:on?C.blue:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                        {on&&<svg width="9" height="9" viewBox="0 0 9 9"><polyline points="1,4.5 3.5,7 8,2" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span style={{fontSize:12,color:on?C.blue:C.ink}}>{label}</span>
                    </label>);
                  })}
                </div>
                <div style={{border:`1px solid ${C.hair}`,borderRadius:4,background:C.bg,display:'flex',justifyContent:'center',padding:'6px 0'}}>
                  <OpenSidesPlan openFront={booth.openFront} openBack={booth.openBack} openLeft={booth.openLeft} openRight={booth.openRight}/>
                </div>
              </PropBlock>
            </div>
          )}

          {/* BOM Tab */}
          {activeTab==='bom'&&(
            <div style={{flex:1,overflowY:'auto',padding:'0 16px'}}>
              <div style={{padding:'12px 0',borderBottom:`1px solid ${C.hair}`}}>
                <MonoLabel right={`${structWeight.toFixed(0)} kg`}>§ Structural</MonoLabel>
                {structItems.map((s,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0',borderBottom:`1px solid ${C.hair}28`}}>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:C.ink}}>{s.name}</div>
                      <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{s.sku}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:MONO,fontSize:11,fontWeight:700,color:C.ink}}>×{s.qty}</div>
                      <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{(s.qty*s.weight).toFixed(0)} kg</div>
                    </div>
                  </div>
                ))}
              </div>
              {placedItems.length>0&&(
                <div style={{padding:'12px 0',borderBottom:`1px solid ${C.hair}`}}>
                  <MonoLabel right={`${totalWeight.toFixed(0)} kg`}>§ Placed Items</MonoLabel>
                  {placedItems.map(p=>(
                    <div key={p.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid ${C.hair}28`}}>
                      <div style={{width:10,height:10,borderRadius:2,background:p.color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:11,fontWeight:600,color:C.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                        <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{p.sku}</div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{fontFamily:MONO,fontSize:11,fontWeight:700,color:C.ink}}>×{p.qty}</div>
                        <div style={{fontFamily:MONO,fontSize:8,color:C.muted}}>{(p.qty*p.weight).toFixed(0)} kg</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{padding:'12px 0'}}>
                <MonoLabel>§ Totals</MonoLabel>
                {[
                  {label:'Structural Parts', value:`${structItems.reduce((a,s)=>a+s.qty,0)}`},
                  {label:'Placed Items',      value:`${totalParts}`},
                  {label:'Total Weight',      value:`${(structWeight+totalWeight).toFixed(0)} kg`},
                  {label:'Floor Area',        value:`${floorArea} m²`},
                  {label:'System',            value:booth.system==='maxima'?'Maxima (2 m)':'Octanorm (1 m)'},
                ].map(row=>(
                  <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
                    <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{row.label}</span>
                    <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.ink}}>{row.value}</span>
                  </div>
                ))}
              </div>
              {placedItems.length===0&&(
                <div style={{padding:'20px 0',textAlign:'center',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                  Click catalog items to add<br/>them to your Bill of Materials
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab==='notes'&&(
            <div style={{flex:1,display:'flex',flexDirection:'column'}}>
              <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
                {notes.length===0&&(
                  <div style={{padding:'20px 0',textAlign:'center',color:C.muted,fontFamily:MONO,fontSize:9.5}}>
                    Add design notes and annotations<br/>visible to your team
                  </div>
                )}
                {notes.map(note=>(
                  <div key={note.id} style={{padding:'10px 12px',borderRadius:4,background:`${note.color}10`,border:`1px solid ${note.color}30`,position:'relative'}}>
                    <div style={{fontSize:12,color:C.ink,lineHeight:1.5,paddingRight:20}}>{note.text}</div>
                    <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginTop:4}}>{note.createdAt}</div>
                    <button onClick={()=>removeNote(note.id)} style={{position:'absolute',top:6,right:6,background:'none',border:'none',cursor:'pointer',color:C.muted,padding:2,display:'flex'}}>
                      <Trash2 size={10}/>
                    </button>
                    <div style={{position:'absolute',left:0,top:8,bottom:8,width:3,borderRadius:'0 2px 2px 0',background:note.color}}/>
                  </div>
                ))}
              </div>
              <div style={{padding:'10px 14px',borderTop:`1px solid ${C.hair}`,background:C.bg,flexShrink:0}}>
                <div style={{display:'flex',gap:4,marginBottom:6}}>
                  {NOTE_COLORS.map(c=>(
                    <button key={c} onClick={()=>setNoteColor(c)} style={{width:18,height:18,borderRadius:3,background:c,border:`2px solid ${noteColor===c?C.ink:'transparent'}`,cursor:'pointer',flexShrink:0}}/>
                  ))}
                </div>
                <div style={{display:'flex',gap:6}}>
                  <input value={newNote} onChange={e=>setNewNote(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNote()}
                    placeholder="Add a note…"
                    style={{flex:1,height:32,border:`1px solid ${C.hair}`,borderRadius:4,background:C.panel,fontFamily:UI,fontSize:12,color:C.ink,paddingLeft:8,outline:'none',boxSizing:'border-box'}}/>
                  <button onClick={addNote} style={{background:C.blue,border:'none',color:'#fff',borderRadius:4,width:32,height:32,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                    <Plus size={13}/>
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── History Panel (slide-over) ────────────────────────── */}
        {showHistPanel&&(
          <div style={{position:'absolute',top:0,bottom:0,right:282,width:240,background:C.panel,borderLeft:`1px solid ${C.hair}`,zIndex:20,display:'flex',flexDirection:'column',boxShadow:'-4px 0 20px rgba(0,0,0,0.08)'}}>
            <div style={{padding:'8px 14px',borderBottom:`1px solid ${C.hair}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',color:C.muted,textTransform:'uppercase'}}>§ Snapshots</span>
              <button onClick={()=>setShowHistPanel(false)} style={{background:'none',border:'none',cursor:'pointer',padding:4,color:C.muted,display:'flex'}}><X size={12}/></button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'8px 12px'}}>
              {snapshots.length===0&&(
                <div style={{fontFamily:MONO,fontSize:9.5,color:C.muted,textAlign:'center',padding:'20px 0'}}>
                  No snapshots yet.<br/>Click "Snapshot" to save a version.
                </div>
              )}
              {[...snapshots].reverse().map(snap=>(
                <div key={snap.id} style={{padding:'10px',borderRadius:4,border:`1px solid ${C.hair}`,background:C.bg,marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.ink,marginBottom:2}}>{snap.name}</div>
                  <div style={{fontFamily:MONO,fontSize:8.5,color:C.muted,marginBottom:8}}>{snap.createdAt}</div>
                  <button onClick={()=>restoreSnapshot(snap)}
                    style={{background:C.blue,border:'none',color:'#fff',borderRadius:3,padding:'4px 10px',cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:UI,width:'100%'}}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <footer style={{height:26,background:'#1a1815',borderTop:'1px solid #111',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 12px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:3,overflow:'hidden'}}>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#4a8a5e',display:'flex',alignItems:'center',gap:4,flexShrink:0}}>
            <span style={{width:5,height:5,borderRadius:'50%',background:'#4a8a5e',display:'inline-block'}}/>Connected
          </span>
          {[`TechCorp_WS`,`${booth.system==='maxima'?'Maxima':'Octanorm'}`,`Floor ${floorArea} m²`,`${booth.width}×${booth.depth}×${booth.height}m`,`${totalParts} placed`,`${(structWeight+totalWeight).toFixed(0)} kg`].map((s,i)=>(
            <span key={i} style={{fontFamily:MONO,fontSize:9.5,color:'#6b6058',marginLeft:4,whiteSpace:'nowrap'}}>· {s}</span>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#6b6058'}}>History: {histIdx+1}/{histLen}</span>
          <span style={{fontFamily:MONO,fontSize:9.5,color:'#4a8a5e'}}>Saved: {lastSaved}</span>
        </div>
      </footer>

      {/* ── Send to Client Dialog ─────────────────────────────────── */}
      {showSendDlg&&(
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.5)',zIndex:200}} onClick={()=>{ setShowSendDlg(false); setSendConfirmed(false); }}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:8,padding:28,zIndex:201,width:420,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            {!sendConfirmed?(
              <>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  <div style={{width:36,height:36,borderRadius:'50%',background:`${C.blue}14`,display:'flex',alignItems:'center',justifyContent:'center'}}><Send size={16} style={{color:C.blue}}/></div>
                  <div>
                    <h3 style={{fontSize:15,fontWeight:700,margin:0}}>Send Design to Client</h3>
                    <p style={{fontFamily:MONO,fontSize:9.5,color:C.muted,margin:'2px 0 0'}}>TechCorp Industries · TechCon 2024</p>
                  </div>
                </div>
                <div style={{background:C.bg,borderRadius:6,padding:'12px 14px',marginBottom:16}}>
                  {[
                    {label:'Stand Size',value:`${booth.width} × ${booth.depth} × ${booth.height} m`},
                    {label:'System',    value:booth.system==='maxima'?'Maxima':'Octanorm'},
                    {label:'Open Sides',value:openCount>0?`${openCount} side${openCount>1?'s':''}`:'Closed'},
                    {label:'BOM Items', value:`${structItems.reduce((a,s)=>a+s.qty,0) + totalParts} parts`},
                    {label:'Est. Weight',value:`${(structWeight+totalWeight).toFixed(0)} kg`},
                  ].map(row=>(
                    <div key={row.label} style={{display:'flex',justifyContent:'space-between',padding:'3px 0'}}>
                      <span style={{fontFamily:MONO,fontSize:9.5,color:C.muted}}>{row.label}</span>
                      <span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:C.ink}}>{row.value}</span>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{setShowSendDlg(false);setSendConfirmed(false);}} style={{flex:1,height:38,background:'none',border:`1px solid ${C.hair}`,borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:13,color:C.ink}}>Cancel</button>
                  <button onClick={()=>setSendConfirmed(true)} style={{flex:2,height:38,background:C.blue,border:'none',color:'#fff',borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                    <Send size={13}/> Send for Approval
                  </button>
                </div>
              </>
            ):(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{width:48,height:48,borderRadius:'50%',background:'#dcfce7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px'}}>
                  <CheckCircle2 size={24} style={{color:C.green}}/>
                </div>
                <h3 style={{fontSize:16,fontWeight:700,margin:'0 0 8px'}}>Sent to Client</h3>
                <p style={{fontFamily:MONO,fontSize:10,color:C.muted,margin:'0 0 20px',lineHeight:1.6}}>The booth design has been shared<br/>with TechCorp Industries for approval.</p>
                <button onClick={()=>{setShowSendDlg(false);setSendConfirmed(false);setToast('Design sent to client');}}
                  style={{width:'100%',height:38,background:C.ink,border:'none',color:'#fff',borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:13,fontWeight:600}}>
                  Done
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Snapshot Dialog ───────────────────────────────────────── */}
      {showSnapDlg&&(
        <>
          <div style={{position:'fixed',inset:0,background:'rgba(24,22,19,0.45)',zIndex:200}} onClick={()=>setShowSnapDlg(false)}/>
          <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:C.panel,border:`1px solid ${C.hair}`,borderRadius:8,padding:24,zIndex:201,width:340,boxShadow:'0 8px 40px rgba(0,0,0,0.18)'}}>
            <h3 style={{fontSize:14,fontWeight:700,margin:'0 0 14px',display:'flex',alignItems:'center',gap:8}}><Camera size={15} style={{color:C.blue}}/> Save Snapshot</h3>
            <input value={snapName} onChange={e=>setSnapName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&createSnapshot()}
              placeholder="e.g. v2 — After client review"
              autoFocus
              style={{width:'100%',height:36,border:`1px solid ${C.hair}`,borderRadius:5,background:C.bg,fontFamily:UI,fontSize:13,color:C.ink,paddingLeft:10,boxSizing:'border-box',outline:'none',marginBottom:12}}/>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setShowSnapDlg(false)} style={{flex:1,height:36,background:'none',border:`1px solid ${C.hair}`,borderRadius:5,cursor:'pointer',fontFamily:UI,fontSize:12,color:C.ink}}>Cancel</button>
              <button onClick={createSnapshot} disabled={!snapName.trim()} style={{flex:2,height:36,background:C.blue,border:'none',color:'#fff',borderRadius:5,cursor:snapName.trim()?'pointer':'not-allowed',fontFamily:UI,fontSize:12,fontWeight:700,opacity:snapName.trim()?1:0.5}}>Save Snapshot</button>
            </div>
          </div>
        </>
      )}

      {/* ── Toast ────────────────────────────────────────────────────── */}
      {toast&&<Toast msg={toast} onClose={()=>setToast('')}/>}
    </div>
  );
}
