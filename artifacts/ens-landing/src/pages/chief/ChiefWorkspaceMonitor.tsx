import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Activity, Maximize2, Users, Clock, ExternalLink,
  CheckCircle2, AlertCircle, Circle,
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

// ── Per-project mock status ────────────────────────────────────
type Status = 'live' | 'pending' | 'review';
const STATUS: Status[] = ['live','review','live','pending','live','review','live','pending'];

const STATUS_CFG: Record<Status, { label:string; color:string; dot:string }> = {
  live:    { label:'Live',    color:C.green,  dot:C.green },
  review:  { label:'Review',  color:C.blue,   dot:C.blue },
  pending: { label:'Pending', color:C.orange, dot:C.orange },
};

// ── Mini booth wireframe SVG ─────────────────────────────────────
function MiniBooth({ status }: { status:Status }) {
  const accent = STATUS_CFG[status].dot;
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet"
      style={{ background:C.bg, display:'block',
        backgroundImage:'repeating-linear-gradient(0deg,transparent,transparent 9px,#d8d3c9 9px,#d8d3c9 10px),repeating-linear-gradient(90deg,transparent,transparent 9px,#d8d3c9 9px,#d8d3c9 10px)' }}>
      {/* Isometric booth outline */}
      {/* Floor */}
      <polygon points="40,65 80,80 120,65 80,50" fill={`${accent}18`} stroke={accent} strokeWidth="0.8" />
      {/* Left wall */}
      <polygon points="40,65 40,35 80,20 80,50" fill={`${accent}10`} stroke={accent} strokeWidth="0.8" />
      {/* Right wall */}
      <polygon points="80,50 80,20 120,35 120,65" fill={`${accent}06`} stroke={accent} strokeWidth="0.8" />
      {/* Fascia strip */}
      <polygon points="40,35 40,30 80,15 80,20" fill={accent} opacity="0.6" />
      <polygon points="80,20 80,15 120,30 120,35" fill={accent} opacity="0.4" />
      {/* Open front indicator */}
      <line x1="40" y1="65" x2="80" y2="80" stroke={C.orange} strokeWidth="1" strokeDasharray="3 2" />
      {/* Post corners */}
      {([[40,65],[40,35],[80,80],[80,20],[120,65],[120,35]] as [number,number][]).map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r={1.8} fill={accent} />
      ))}
    </svg>
  );
}

// ── Monitor stat card ────────────────────────────────────────────
function StatCard({ label, value, sub, color = C.ink }: { label:string; value:string|number; sub?:string; color?:string }) {
  return (
    <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, padding:'12px 16px', display:'flex', flexDirection:'column', gap:2 }}>
      <span style={{ fontFamily:MONO, fontSize:9, color:C.muted, letterSpacing:'0.1em', textTransform:'uppercase' as const }}>{label}</span>
      <span style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color, lineHeight:1 }}>{value}</span>
      {sub && <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>{sub}</span>}
    </div>
  );
}

// ── Workspace project card ───────────────────────────────────────
function WorkspaceCard({ project, status, idx }: { project: typeof mockProjects[0]; status:Status; idx:number }) {
  const scfg = STATUS_CFG[status];
  const dims = idx % 3 === 0 ? '6 × 3 m' : idx % 3 === 1 ? '8 × 6 m' : '4 × 4 m';
  const pms  = ['S.M.','A.K.','J.L.'].slice(0, (idx % 2) + 1);
  const version = `v${2 + (idx % 3)}.${idx % 5}`;

  return (
    <div style={{ background:C.panel, border:`1px solid ${C.hair}`, borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column', transition:'border-color 0.1s', fontFamily:UI }}
      onMouseEnter={e=>(e.currentTarget.style.borderColor=C.blue)} onMouseLeave={e=>(e.currentTarget.style.borderColor=C.hair)}>

      {/* Preview */}
      <div style={{ height:100, position:'relative', overflow:'hidden' }}>
        <MiniBooth status={status} />
        {/* Version chip */}
        <span style={{ position:'absolute', top:6, left:6, fontFamily:MONO, fontSize:8.5, background:C.panel, border:`1px solid ${C.hair}`, borderRadius:3, padding:'2px 6px', color:C.muted }}>{version}</span>
        {/* Expand button */}
        <Link href="/pm/workspace">
          <button
            data-testid={`button-maximize-workspace-${project.id}`}
            style={{ position:'absolute', top:4, right:4, background:`${C.panel}e0`, border:`1px solid ${C.hair}`, borderRadius:3, width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:C.muted }}>
            <Maximize2 size={10} />
          </button>
        </Link>
      </div>

      {/* Info */}
      <div style={{ padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
        {/* Name + status */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
          <span style={{ fontSize:12, fontWeight:700, lineHeight:1.3, color:C.ink }}>{project.name}</span>
          <span style={{ fontFamily:MONO, fontSize:8.5, padding:'2px 7px', borderRadius:3, flexShrink:0, background:`${scfg.dot}14`, color:scfg.color, border:`1px solid ${scfg.dot}30`, display:'flex', alignItems:'center', gap:4 }}>
            {status === 'live' ? <span style={{ width:5, height:5, borderRadius:'50%', background:scfg.dot, display:'inline-block' }} /> : status === 'review' ? <CheckCircle2 size={8} /> : <Circle size={8} />}
            {scfg.label}
          </span>
        </div>

        {/* Meta row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Users size={9} style={{ color:C.muted, flexShrink:0 }} />
            <span style={{ fontFamily:MONO, fontSize:9, color:C.muted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project.client}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={9} style={{ color:C.muted, flexShrink:0 }} />
            <span style={{ fontFamily:MONO, fontSize:9, color:C.muted }}>{project.lastUpdate}</span>
          </div>
        </div>

        {/* System + dims */}
        <div style={{ display:'flex', gap:4 }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, background:C.bg, border:`1px solid ${C.hair}`, borderRadius:3, padding:'2px 6px', color:C.muted }}>{project.system?.toUpperCase() ?? 'OCT'}</span>
          <span style={{ fontFamily:MONO, fontSize:8.5, background:C.bg, border:`1px solid ${C.hair}`, borderRadius:3, padding:'2px 6px', color:C.muted }}>{dims}</span>
        </div>

        {/* Bottom: avatars + join */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:4, borderTop:`1px solid ${C.hair}` }}>
          <div style={{ display:'flex', alignItems:'center', gap:-4 }}>
            {pms.map((initials, i) => (
              <div key={i} style={{ width:22, height:22, borderRadius:'50%', background:C.blue, border:`2px solid ${C.panel}`, display:'flex', alignItems:'center', justifyContent:'center', marginLeft: i > 0 ? -7 : 0, zIndex: pms.length - i }}>
                <span style={{ fontFamily:MONO, fontSize:7.5, color:'#fff', fontWeight:700 }}>{initials}</span>
              </div>
            ))}
            <span style={{ fontFamily:MONO, fontSize:9, color:C.muted, marginLeft:8 }}>{pms.length} PM{pms.length > 1 ? 's' : ''}</span>
          </div>
          <Link href="/pm/workspace">
            <button data-testid={`button-open-workspace-${project.id}`}
              style={{ background:C.blue, border:'none', color:'#fff', borderRadius:4, padding:'5px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, fontFamily:UI }}>
              <ExternalLink size={10} /> Join
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function ChiefWorkspaceMonitor() {
  const [filter, setFilter] = useState<'all' | Status>('all');

  const liveCount    = STATUS.filter(s=>s==='live').length;
  const reviewCount  = STATUS.filter(s=>s==='review').length;
  const pendingCount = STATUS.filter(s=>s==='pending').length;

  const filtered = mockProjects.filter((_, i) =>
    filter === 'all' || STATUS[i % STATUS.length] === filter
  );

  return (
    <DashboardLayout role="chief">
      <div className="space-y-6">
        <PageHeader
          title="Workspace Monitor"
          breadcrumbs={[{ label:'Chief', href:'/chief' }, { label:'Monitor' }]}
        >
          <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:MONO }}>
            <span style={{ fontSize:10, display:'flex', alignItems:'center', gap:6, color:C.green }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:C.green, display:'inline-block' }} />
              {liveCount} Active Now
            </span>
            <Button size="sm" variant="outline" data-testid="button-refresh-monitor"
              style={{ fontFamily:MONO, fontSize:10, height:28, padding:'0 12px' }}>
              Refresh All
            </Button>
          </div>
        </PageHeader>

        {/* ── Stats row ──────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
          <StatCard label="Active Workspaces"  value={liveCount}    sub="Live right now"        color={C.green}  />
          <StatCard label="In Review"          value={reviewCount}  sub="Pending client sign-off" color={C.blue}   />
          <StatCard label="Awaiting Approval"  value={pendingCount} sub="Need PM attention"      color={C.orange} />
          <StatCard label="Total Projects"     value={mockProjects.length} sub="All time" />
        </div>

        {/* ── Filter tabs ─────────────────────────────────────── */}
        <div style={{ display:'flex', gap:4, background:'#f3f1ec', border:`1px solid ${C.hair}`, borderRadius:4, padding:3, width:'fit-content' }}>
          {(['all','live','review','pending'] as const).map(f => (
            <button key={f} onClick={()=>setFilter(f)}
              style={{ background: filter===f ? C.panel : 'none', border: filter===f ? `1px solid ${C.hair}` : '1px solid transparent', borderRadius:3, padding:'4px 12px', cursor:'pointer', fontFamily:MONO, fontSize:9.5, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', color: filter===f ? C.ink : C.muted, boxShadow: filter===f ? '0 1px 3px rgba(0,0,0,0.07)' : 'none', transition:'all 0.1s' }}>
              {f === 'all' ? `All · ${mockProjects.length}` : `${STATUS_CFG[f].label} · ${STATUS.filter(s=>s===f).length}`}
            </button>
          ))}
        </div>

        {/* ── Card grid ───────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
          {filtered.map((project, i) => (
            <WorkspaceCard
              key={project.id}
              project={project}
              status={STATUS[i % STATUS.length]}
              idx={i}
            />
          ))}
        </div>

        {/* ── Legend ──────────────────────────────────────────── */}
        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'8px 0', borderTop:`1px solid ${C.hair}` }}>
          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
            <span key={key} style={{ fontFamily:MONO, fontSize:9.5, color:C.muted, display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:7, height:7, borderRadius:'50%', background:cfg.dot, display:'inline-block' }} />
              {cfg.label}
            </span>
          ))}
          <span style={{ fontFamily:MONO, fontSize:9, color:C.muted, marginLeft:'auto' }}>
            Auto-refreshes every 30 s
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}
