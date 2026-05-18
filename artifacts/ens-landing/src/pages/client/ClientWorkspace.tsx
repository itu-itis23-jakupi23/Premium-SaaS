import { useState } from "react";
import { Booth3D } from "@/components/workspace/Booth3D";
import {
  Lock, ZoomIn, ZoomOut, Maximize2, Send, CheckCircle2, AlertCircle,
  Eye, ChevronDown, Layers, RotateCcw, MessageSquare,
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
} as const;
const MONO = '"JetBrains Mono","Courier New",monospace';
const UI   = 'Inter,system-ui,sans-serif';

// ── Asset catalog (locked / read-only) ───────────────────────────
const CATALOG = [
  { name:'Structure', items:['Solid Wall','Glass Wall','Corner Post','Fascia'] },
  { name:'Furniture', items:['Reception Counter','Bar Stool','Meeting Table','Design Chair'] },
  { name:'Lighting',  items:['Spotlight','LED Strip','Arm Light'] },
];

// ── Mock comments ────────────────────────────────────────────────
interface Comment { id:number; user:string; initials:string; text:string; time:string; }
const INITIAL_COMMENTS: Comment[] = [
  { id:1, user:'Sarah M. (PM)', initials:'PM', text:"I've added the lighting fixtures as requested, and updated the fascia to show the new branding.", time:'2h ago' },
  { id:2, user:'You', initials:'YO', text:'Looks great! Can we move the reception counter slightly to the left?', time:'1h ago' },
  { id:3, user:'Sarah M. (PM)', initials:'PM', text:'Done — counter repositioned. Also added extra spotlights over the display area.', time:'45m ago' },
];

// ── Version history ──────────────────────────────────────────────
const VERSIONS = [
  { label:'v2.4 — Latest', value:'2.4' },
  { label:'v2.3 — May 12', value:'2.3' },
  { label:'v2.2 — May 10', value:'2.2' },
  { label:'v1.0 — Initial', value:'1.0' },
];

// ── Small helpers ────────────────────────────────────────────────
function MonoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.1em', color:C.muted, textTransform:'uppercase' as const }}>{children}</span>
  );
}
function Hairline() { return <div style={{ height:1, background:C.hair }} />; }

export default function ClientWorkspace() {
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [newComment, setNewComment] = useState('');
  const [version, setVersion] = useState('2.4');
  const [showVersions, setShowVersions] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [changeText, setChangeText] = useState('');
  const [approved, setApproved] = useState(false);

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments(c => [...c, { id:Date.now(), user:'You', initials:'YO', text:newComment.trim(), time:'Just now' }]);
    setNewComment('');
  };

  const submitChange = () => {
    if (!changeText.trim()) return;
    setComments(c => [...c, { id:Date.now(), user:'You', initials:'YO', text:`[Change Request] ${changeText.trim()}`, time:'Just now' }]);
    setChangeText('');
    setShowChangeDialog(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:C.bg, color:C.ink, fontFamily:UI, overflow:'hidden', userSelect:'none' }}>

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <header style={{ height:46, borderBottom:`1px solid ${C.hair}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', background:C.panel, flexShrink:0, gap:8 }}>
        {/* Left: identity + view-only badge */}
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Layers size={14} style={{ color:C.blue, flexShrink:0 }} />
            <span style={{ fontSize:13, fontWeight:700, letterSpacing:'-0.01em', whiteSpace:'nowrap' }}>TechCon 2024 — Global Exhibit</span>
          </div>
          <div style={{ width:1, height:18, background:C.hair, flexShrink:0 }} />
          <span style={{ fontFamily:MONO, fontSize:9.5, display:'flex', alignItems:'center', gap:5, background:`${C.orange}12`, color:C.orange, border:`1px solid ${C.orange}30`, borderRadius:4, padding:'3px 9px', flexShrink:0 }}>
            <Eye size={10} /> VIEW ONLY
          </span>
        </div>

        {/* Right: version picker + action buttons */}
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {/* Version dropdown */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setShowVersions(s=>!s)} style={{ background:'none', border:`1px solid ${C.hair}`, borderRadius:4, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:11.5, fontFamily:MONO, color:C.ink }}>
              v{version} (Current) <ChevronDown size={11} />
            </button>
            {showVersions && (
              <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, zIndex:50, minWidth:160, boxShadow:'0 4px 16px rgba(0,0,0,0.08)' }}>
                {VERSIONS.map(v => (
                  <button key={v.value} onClick={()=>{ setVersion(v.value); setShowVersions(false); }}
                    style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', fontFamily:MONO, fontSize:11, color: version===v.value ? C.blue : C.ink, background: version===v.value ? `${C.blue}08` : 'none', border:'none', cursor:'pointer' }}>
                    {v.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Request Changes */}
          <button onClick={()=>setShowChangeDialog(true)} style={{ background:'none', border:`1px solid ${C.orange}40`, borderRadius:4, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11.5, fontFamily:UI, color:C.orange }}>
            <AlertCircle size={12} /> Request Changes
          </button>

          {/* Approve */}
          {approved ? (
            <span style={{ fontFamily:MONO, fontSize:10.5, color:C.green, display:'flex', alignItems:'center', gap:5, padding:'5px 10px', border:`1px solid ${C.green}40`, borderRadius:4, background:`${C.green}08` }}>
              <CheckCircle2 size={12} /> Approved
            </span>
          ) : (
            <button onClick={()=>setApproved(true)} style={{ background:C.green, border:'none', color:'#fff', borderRadius:4, padding:'6px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, fontFamily:UI }}>
              <CheckCircle2 size={12} /> Approve Design
            </button>
          )}
        </div>
      </header>

      {/* Click-away for dropdowns */}
      {showVersions && <div style={{ position:'fixed', inset:0, zIndex:40 }} onClick={()=>setShowVersions(false)} />}

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* ── Left — Locked Asset Library ─────────────────────── */}
        <aside style={{ width:240, borderRight:`1px solid ${C.hair}`, background:C.panel, display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          {/* Panel header */}
          <div style={{ padding:'8px 14px', borderBottom:`1px solid ${C.hair}`, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <Lock size={10} style={{ color:C.muted }} />
            <MonoLabel>§ Asset Library</MonoLabel>
            <span style={{ fontFamily:MONO, fontSize:9.5, color:C.muted, marginLeft:'auto' }}>Locked</span>
          </div>

          {/* Categories */}
          <div style={{ flex:1, overflowY:'auto' }}>
            {CATALOG.map(cat => (
              <div key={cat.name} style={{ borderBottom:`1px solid ${C.hair}` }}>
                <div style={{ padding:'7px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:C.muted }}>{cat.name}</span>
                </div>
                <div style={{ padding:'4px 10px 10px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
                  {cat.items.map(item => (
                    <div key={item} style={{ position:'relative', background:C.bg, border:`1px dashed ${C.hair}`, borderRadius:4, padding:'9px 7px 7px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, opacity:0.6 }}>
                      <div style={{ width:18, height:18, borderRadius:3, background:C.hair }} />
                      <span style={{ fontSize:10, fontWeight:500, color:C.muted, textAlign:'center', lineHeight:1.2 }}>{item}</span>
                      {/* Lock overlay on hover — static here */}
                      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', opacity:0, borderRadius:4, background:`${C.panel}cc` }}
                        onMouseEnter={e=>(e.currentTarget.style.opacity='1')} onMouseLeave={e=>(e.currentTarget.style.opacity='0')}>
                        <Lock size={12} style={{ color:C.muted }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footnote */}
          <div style={{ padding:'10px 14px', borderTop:`1px solid ${C.hair}`, background:C.bg }}>
            <span style={{ fontFamily:MONO, fontSize:8.5, color:C.muted, lineHeight:1.5 }}>
              Design is in Review mode. Editing restricted to Project Managers.
            </span>
          </div>
        </aside>

        {/* ── Center — Canvas ─────────────────────────────────── */}
        <main style={{ flex:1, position:'relative', overflow:'hidden', backgroundColor:C.bg,
          backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,#d8d3c9 39px,#d8d3c9 40px)' }}>

          {/* Booth */}
          <div style={{ position:'absolute', inset:0 }}>
            <Booth3D config={{ width:8, depth:6, height:3, system:'maxima', companyName:'TECHCORP INDUSTRIES', carpetColor:'#1e1830', openFront:true }} />
          </div>

          {/* Top-left badges */}
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6, zIndex:10, pointerEvents:'none' }}>
            {[
              { text:'◈ MAXIMA SYSTEM', color:C.muted },
              { text:'8 × 6 M', color:C.muted },
            ].map(b => (
              <span key={b.text} style={{ fontFamily:MONO, fontSize:9.5, background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, padding:'4px 9px', color:b.color }}>
                {b.text}
              </span>
            ))}
          </div>

          {/* VIEW ONLY watermark */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%) rotate(-25deg)', fontFamily:MONO, fontSize:64, fontWeight:900, color:C.ink, opacity:0.025, letterSpacing:'0.05em', pointerEvents:'none', zIndex:5, whiteSpace:'nowrap' }}>
            VIEW ONLY
          </div>

          {/* Camera/View controls */}
          <div style={{ position:'absolute', bottom:38, left:'50%', transform:'translateX(-50%)', display:'flex', background:C.panel, border:`1px solid ${C.hair}`, borderRadius:20, overflow:'hidden', zIndex:10, padding:'2px 4px', gap:2 }}>
            {[RotateCcw, ZoomIn, ZoomOut, Maximize2].map((Icon, i) => (
              <button key={i} style={{ background:'none', border:'none', cursor:'pointer', padding:'5px 9px', color:C.muted, borderRight: i<3?`1px solid ${C.hair}`:'none', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <Icon size={13} />
              </button>
            ))}
          </div>

          {/* Bottom info bar */}
          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:32, background:C.panel, borderTop:`1px solid ${C.hair}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', zIndex:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:0 }}>
              {[
                { text:'Maxima Premium',     style:{fontWeight:700} },
                { text:'|',                   style:{color:C.hair, margin:'0 8px'} },
                { text:'OPEN SIDE · FRONT',   style:{color:C.orange} },
                { text:'|',                   style:{color:C.hair, margin:'0 8px'} },
                { text:'8.0 × 6.0 m' },
                { text:'H 3.00 m',           style:{marginLeft:10} },
              ].map((s,i) => (
                <span key={i} style={{ fontFamily:MONO, fontSize:9.5, color:C.ink, letterSpacing:'0.04em', ...s.style }}>{s.text}</span>
              ))}
            </div>
            <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>v{version} · READ-ONLY · PERSPECTIVE VIEW</span>
          </div>
        </main>

        {/* ── Right — Comments + Approval ─────────────────────── */}
        <aside style={{ width:300, borderLeft:`1px solid ${C.hair}`, background:C.panel, display:'flex', flexDirection:'column', flexShrink:0 }}>
          {/* Panel header */}
          <div style={{ padding:'8px 16px', borderBottom:`1px solid ${C.hair}`, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <MessageSquare size={11} style={{ color:C.blue }} />
            <MonoLabel>§ Review Comments</MonoLabel>
            <span style={{ fontFamily:MONO, fontSize:9.5, color:C.muted, marginLeft:'auto' }}>{comments.length} notes</span>
          </div>

          {/* Comment thread */}
          <div style={{ flex:1, overflowY:'auto', padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
            {comments.map(comment => {
              const isMe = comment.user === 'You';
              return (
                <div key={comment.id} style={{ display:'flex', flexDirection:'column', alignItems: isMe?'flex-end':'flex-start', gap:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                    {!isMe && (
                      <div style={{ width:20, height:20, borderRadius:'50%', background:C.blue, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontFamily:MONO, fontSize:7.5, color:'#fff', fontWeight:700 }}>{comment.initials}</span>
                      </div>
                    )}
                    <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>{comment.user}</span>
                    {isMe && (
                      <div style={{ width:20, height:20, borderRadius:'50%', background:C.hair, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontFamily:MONO, fontSize:7.5, color:C.ink, fontWeight:700 }}>YO</span>
                      </div>
                    )}
                  </div>
                  <div style={{ maxWidth:'88%', padding:'8px 11px', borderRadius:6, fontSize:12, lineHeight:1.5, background: isMe ? C.blue : C.bg, color: isMe ? '#fff' : C.ink, border: isMe ? 'none' : `1px solid ${C.hair}` }}>
                    {comment.text}
                  </div>
                  <span style={{ fontFamily:MONO, fontSize:8.5, color:C.muted }}>{comment.time}</span>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div style={{ padding:'10px 12px', borderTop:`1px solid ${C.hair}`, display:'flex', gap:6, background:C.bg, flexShrink:0 }}>
            <input value={newComment} onChange={e=>setNewComment(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && addComment()}
              placeholder="Add a comment…"
              style={{ flex:1, height:34, border:`1px solid ${C.hair}`, borderRadius:4, background:C.panel, fontFamily:UI, fontSize:12, color:C.ink, paddingLeft:10, paddingRight:8, outline:'none', boxSizing:'border-box' }} />
            <button onClick={addComment} style={{ background:C.blue, border:'none', color:'#fff', borderRadius:4, width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              <Send size={13} />
            </button>
          </div>

          <Hairline />

          {/* Project Info */}
          <div style={{ padding:'12px 16px', flexShrink:0 }}>
            <MonoLabel>§ Project Info</MonoLabel>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
              {[
                { label:'Stand Type',        value:'Maxima Premium' },
                { label:'System',            value:'Maxima (2 m module)' },
                { label:'Floor Area',        value:'48.0 m²' },
                { label:'Bounds',            value:'8 × 6 × 3 m' },
              ].map(row => (
                <div key={row.label}>
                  <span style={{ fontFamily:MONO, fontSize:8.5, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', display:'block' }}>{row.label}</span>
                  <span style={{ fontSize:12, fontWeight:600, fontFamily:MONO }}>{row.value}</span>
                </div>
              ))}
              {/* Approval status */}
              <div>
                <span style={{ fontFamily:MONO, fontSize:8.5, color:C.muted, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:4 }}>Approval Status</span>
                <span style={{ fontFamily:MONO, fontSize:10, padding:'3px 9px', borderRadius:4, background: approved?`${C.green}14`:`${C.orange}12`, color: approved?C.green:C.orange, border:`1px solid ${approved?C.green:C.orange}30` }}>
                  {approved ? '✓ Approved' : 'Awaiting Approval'}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Status Bar ────────────────────────────────────────────── */}
      <footer style={{ height:26, background:'#1a1815', borderTop:'1px solid #111', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ fontFamily:MONO, fontSize:9.5, color:'#6a5a40', display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:'#6a5a40', display:'inline-block' }} />
            View-Only Session
          </span>
          {[`TechCorp Exhibit 2024`, `Maxima System`, `v${version}`, `Floor 48.0 m²`].map((s,i) => (
            <span key={i} style={{ fontFamily:MONO, fontSize:9.5, color:'#5a5048', marginLeft:4 }}>· {s}</span>
          ))}
        </div>
        <span style={{ fontFamily:MONO, fontSize:9.5, color:'#5a5048' }}>
          Editing restricted · Contact your PM to make changes
        </span>
      </footer>

      {/* ── Request Changes Dialog ───────────────────────────────── */}
      {showChangeDialog && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(24,22,19,0.4)', zIndex:100 }} onClick={()=>setShowChangeDialog(false)} />
          <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:C.panel, border:`1px solid ${C.hair}`, borderRadius:6, padding:24, zIndex:101, width:400, boxShadow:'0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:4, marginTop:0 }}>Request Design Changes</h3>
            <p style={{ fontFamily:MONO, fontSize:10, color:C.muted, marginBottom:14 }}>Your feedback goes directly to your Project Manager.</p>
            <textarea value={changeText} onChange={e=>setChangeText(e.target.value)}
              placeholder="Describe the changes you'd like to see…"
              rows={5}
              style={{ width:'100%', border:`1px solid ${C.hair}`, borderRadius:4, padding:10, fontFamily:UI, fontSize:13, color:C.ink, background:C.bg, resize:'vertical', outline:'none', boxSizing:'border-box', lineHeight:1.5 }} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button onClick={()=>setShowChangeDialog(false)} style={{ background:'none', border:`1px solid ${C.hair}`, borderRadius:4, padding:'7px 14px', cursor:'pointer', fontFamily:UI, fontSize:12, color:C.ink }}>
                Cancel
              </button>
              <button onClick={submitChange} style={{ background:C.blue, border:'none', color:'#fff', borderRadius:4, padding:'7px 16px', cursor:'pointer', fontFamily:UI, fontSize:12, fontWeight:600 }}>
                Submit Request
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
