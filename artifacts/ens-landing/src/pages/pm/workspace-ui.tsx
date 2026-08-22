import { useEffect, useId, type ReactNode } from "react";
import { Box, CheckCircle2 } from "lucide-react";
import { formatMoneyUSD } from "@/lib/currency";
import type { CatItem } from "./workspace-model";
import { C, MONO, UI, catalogItemProps } from "./workspace-constants";

// Leaf presentational components for the booth workspace inspector — hairlines,
// labels, dimension inputs, swatches, catalog thumbnails, and the toast. Pure
// UI (props in, markup out), split out of PMWorkspace.tsx.

export function Hairline({margin=16}:{margin?:number}) { return <div style={{height:1,background:C.hair,margin:`0 -${margin}px`}}/>; }
export function MonoLabel({children,right}:{children:ReactNode;right?:ReactNode}) {
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7}}><span style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,letterSpacing:'0.1em',color:C.muted,textTransform:'uppercase'}}>{children}</span>{right&&<span style={{fontFamily:MONO,fontSize:9,color:C.muted}}>{right}</span>}</div>;
}
export function PropBlock({label,right,children}:{label:string;right?:ReactNode;children:ReactNode}) {
  return <div style={{padding:'12px 0'}}><MonoLabel right={right}>{label}</MonoLabel>{children}</div>;
}
export function formatUsd(value:number) {
  // Values are USD internally; rendering converts to the selected display
  // currency (components consuming useCurrency re-render on switch).
  return formatMoneyUSD(value);
}
export function DimInput({label,value,min,max,step,onChange,disabled=false}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;disabled?:boolean}) {
  const fieldId = useId();
  return (<div>
    <label htmlFor={fieldId} style={{fontFamily:MONO,fontSize:9,color:C.muted,textTransform:'uppercase',letterSpacing:'0.05em',display:'block',marginBottom:3}}>{label}</label>
    <div style={{position:'relative'}}>
      <input type="number" id={fieldId} name={`dim-${label.toLowerCase().replace(/\s+/g,'-')}`} aria-label={label} min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={e=>{if(disabled)return;const n=parseFloat(e.target.value);if(!isNaN(n)&&n>=min&&n<=max)onChange(n);}}
        style={{width:'100%',height:30,border:`1px solid ${C.hair}`,borderRadius:4,background:disabled?'#f2f0eb':C.bg,fontFamily:MONO,fontSize:12.5,fontWeight:600,color:disabled?C.muted:C.ink,paddingLeft:8,paddingRight:22,boxSizing:'border-box',outline:'none',cursor:disabled?'not-allowed':'text'}}/>
      <span style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontFamily:MONO,fontSize:9,color:C.muted}}>m</span>
    </div>
  </div>);
}
export function Swatch({color,active,onClick,size=28,title}:{color:string;active:boolean;onClick:()=>void;size?:number;title?:string}) {
  const light=color==='#dde0e4';
  return (<button onClick={onClick} title={title??color} style={{width:size,height:size,borderRadius:4,background:color,cursor:'pointer',flexShrink:0,border:`${active?2:1}px solid ${active?C.ink:C.hair}`,position:'relative'}}>
    {active&&<span style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke={light?C.ink:'#fff'} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg></span>}
  </button>);
}
export function catalogPreviewUrl(item: CatItem) {
  // The ENS catalogue carries its preview path explicitly. Deriving it from the
  // model filename - as this used to - meant every picture broke the moment a
  // model was renamed or repointed, silently and with no failing test.
  if (item.previewUrl) return item.previewUrl;
  if (!item.modelUrl) return '';
  // Legacy fallback for the older Sedef set, whose previews are named after
  // their model file rather than stored on the item.
  const filename = decodeURIComponent(item.modelUrl.split('/').pop() || '').replace(/\.glb$/i, ' - preview.png');
  return `/ens-workspace-assets/sedef_remaining_furniture_refined_v2/previews-clean/${encodeURIComponent(filename)}`;
}
export function CatalogImagePreview({item,active}:{item:CatItem;active:boolean}) {
  const previewUrl = catalogPreviewUrl(item);
  return (
    <div style={{width:'100%',height:62,border:`1px solid ${active?C.ink:'rgba(156,163,175,0.32)'}`,borderRadius:4,background:active?'#f8fafc':'#ffffff',overflow:'hidden',display:'grid',placeItems:'center'}}>
      {previewUrl ? (
        <img src={previewUrl} alt={`${item.name} preview`} loading="lazy" style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',display:'block',padding:2}}/>
      ) : (
        <Box size={18} color={C.muted}/>
      )}
    </div>
  );
}
export function CatalogPreview({item,active}:{item:CatItem;active:boolean}) {
  const props = catalogItemProps(item);
  const color = props.color;
  const stroke = active ? C.ink : '#9ca3af';
  const shape = item.shape ?? 'box';
  if (item.modelUrl) return <CatalogImagePreview item={item} active={active}/>;
  return (
    <svg viewBox="0 0 72 46" width="100%" height="46" aria-hidden="true" style={{display:'block'}}>
      <rect x="1" y="1" width="70" height="44" rx="4" fill={active?'rgba(24,22,19,0.05)':'rgba(255,255,255,0.48)'} stroke="rgba(156,163,175,0.32)"/>
      {shape==='round_table'&&<>
        <ellipse cx="36" cy="19" rx="18" ry="10" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="34" y="20" width="4" height="14" rx="1" fill="#565b63"/>
        <ellipse cx="36" cy="36" rx="12" ry="3" fill="#565b63" opacity="0.65"/>
      </>}
      {shape==='rect_table'&&<>
        <rect x="18" y="14" width="36" height="14" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        {[22,48].map(x=><rect key={x} x={x} y="27" width="4" height="12" rx="1" fill="#565b63"/>)}
      </>}
      {shape==='counter'&&<>
        <rect x="14" y="16" width="44" height="20" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="18" y="13" width="36" height="6" rx="2" fill="#fff" stroke="rgba(80,80,80,0.2)"/>
      </>}
      {(shape==='shelf'||shape==='cabinet')&&<>
        <rect x="20" y="8" width="32" height="30" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        {[17,26,34].map(y=><line key={y} x1="22" y1={y} x2="50" y2={y} stroke="#fff" strokeWidth="2" opacity="0.85"/>)}
      </>}
      {shape==='cube'&&<>
        <rect x="24" y="14" width="24" height="24" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        <path d="M24 14 L31 9 H55 L48 14" fill="rgba(255,255,255,0.45)" stroke={stroke} strokeWidth="0.8"/>
        <path d="M48 14 L55 9 V33 L48 38" fill="rgba(0,0,0,0.08)" stroke={stroke} strokeWidth="0.8"/>
      </>}
      {shape==='chair'&&<>
        <path d="M21 29 L24 17 Q36 10 48 17 L51 29 Z" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="24" y="28" width="24" height="8" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>
        {[27,45].map(x=><line key={x} x1={x} y1="36" x2={x-2} y2="41" stroke="#565b63" strokeWidth="2"/>)}
      </>}
      {shape==='bar_stool'&&<>
        <ellipse cx="36" cy="18" rx="14" ry="7" fill={color} stroke={stroke} strokeWidth="1"/>
        <rect x="34" y="19" width="4" height="16" rx="1" fill="#565b63"/>
        <ellipse cx="36" cy="37" rx="12" ry="3" fill="#565b63" opacity="0.75"/>
      </>}
      {(shape==='light'||shape==='rail_light')&&<>
        <rect x="28" y="10" width="16" height="10" rx="3" fill="#303741" stroke={stroke} strokeWidth="1"/>
        <path d="M26 21 H46 L40 36 H32 Z" fill={color} opacity="0.38"/>
        <ellipse cx="36" cy="21" rx="11" ry="5" fill={color} stroke={stroke} strokeWidth="1"/>
      </>}
      {shape==='wall_shelf'&&<>
        <rect x="16" y="20" width="40" height="6" rx="1" fill={color} stroke={stroke} strokeWidth="1"/>
        {[24,48].map(x=><path key={x} d={`M${x} 26 L${x-5} 36 H${x+5} Z`} fill="#9aa1aa" opacity="0.8"/>)}
      </>}
      {shape==='box'&&<rect x="22" y="12" width="28" height="24" rx="2" fill={color} stroke={stroke} strokeWidth="1"/>}
    </svg>
  );
}
export function OpenSidesPlan({openFront,openBack,openLeft,openRight}:{openFront:boolean;openBack:boolean;openLeft:boolean;openRight:boolean}) {
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
export function Toast({msg,onClose}:{msg:string;onClose:()=>void}) {
  useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t);},[onClose]);
  return (<div style={{position:'fixed',bottom:48,left:'50%',transform:'translateX(-50%)',background:C.ink,color:'#fff',fontFamily:UI,fontSize:12,fontWeight:600,padding:'10px 20px',borderRadius:6,zIndex:1000,display:'flex',alignItems:'center',gap:8,boxShadow:'0 4px 20px rgba(0,0,0,0.3)',whiteSpace:'nowrap'}}>
    <CheckCircle2 size={14} style={{color:'#6ee7b7'}}/>{msg}
  </div>);
}
