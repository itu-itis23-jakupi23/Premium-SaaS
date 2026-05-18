import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import {
  Layers, Calendar, Clock, CheckCircle2, AlertCircle, ChevronDown,
  ExternalLink, MessageSquare, FileText, History,
} from "lucide-react";

const STATUS_CFG: Record<string,{bg:string;text:string;border:string}> = {
  Active:    { bg:'rgba(47,125,58,0.08)',  text:'#2f7d3a', border:'rgba(47,125,58,0.3)' },
  Pending:   { bg:'rgba(194,65,12,0.08)',  text:'#c2410c', border:'rgba(194,65,12,0.3)' },
  Delayed:   { bg:'rgba(220,38,38,0.08)',  text:'#dc2626', border:'rgba(220,38,38,0.3)' },
  Completed: { bg:'rgba(29,78,216,0.08)',  text:'#1d4ed8', border:'rgba(29,78,216,0.3)' },
};

function ProgressBar({ value }: { value: number }) {
  const c = value >= 80 ? '#2f7d3a' : value >= 40 ? '#1d4ed8' : '#c2410c';
  return (
    <div style={{height:5,borderRadius:3,background:'#e5e7eb',overflow:'hidden'}}>
      <div style={{height:'100%',width:`${value}%`,background:c,borderRadius:3}}/>
    </div>
  );
}

// Build per-project timeline events from mock data
function getTimeline(p: typeof mockProjects[0]) {
  const events = [];
  if(p.revisions?.length) {
    events.push(...p.revisions.map(r => ({ icon:History, color:'#7c3aed', label:r.note, date:r.date, badge:r.status })));
  }
  if(p.approvals?.length) {
    events.push(...p.approvals.map(a => ({ icon:CheckCircle2, color:a.status==='Approved'?'#2f7d3a':'#d97706', label:a.title, date:a.date!=='-'?a.date:'Pending', badge:a.status })));
  }
  if(events.length === 0) {
    events.push({ icon:Layers, color:'#1d4ed8', label:'Project created — design in progress', date:'Recently', badge:'Active' });
  }
  return events.slice(0, 5);
}

// Assign action required to first two projects for interest
const ACTION_PROJECTS = new Set(['0','1']);

export default function ClientProjects() {
  const [expanded, setExpanded] = useState<string|null>(mockProjects[0]?.id ?? null);

  // Client sees their subset — take all for demo
  const projects = mockProjects;
  const stats = {
    total: projects.length,
    active: projects.filter(p=>p.status==='Active').length,
    pending: projects.filter(p=>p.status==='Pending').length,
    avgProgress: Math.round(projects.reduce((s,p)=>s+p.progress,0)/projects.length),
  };

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        <PageHeader title="My Projects" breadcrumbs={[{label:'Dashboard',href:'/client'},{label:'Projects'}]}/>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {l:'Total Projects',    v:stats.total,          c:'text-foreground'},
            {l:'Active',            v:stats.active,         c:'text-green-600'},
            {l:'Pending Review',    v:stats.pending,        c:'text-orange-600'},
            {l:'Avg. Progress',     v:`${stats.avgProgress}%`, c:'text-blue-600'},
          ].map(s=>(
            <div key={s.l} className="border rounded-lg p-4 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{s.l}</p>
              <p className={`text-2xl font-bold font-mono ${s.c}`}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Project cards */}
        <div className="space-y-3">
          {projects.map((project, idx) => {
            const sc = STATUS_CFG[project.status] ?? STATUS_CFG.Active;
            const isExp = expanded === project.id;
            const hasAction = ACTION_PROJECTS.has(String(idx));
            const timeline = getTimeline(project);

            return (
              <div key={project.id}
                className="border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-all"
                style={hasAction?{borderColor:'rgba(217,119,6,0.4)'}:{}}>

                {/* Row header */}
                <div className="p-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : project.id)}>
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-sm leading-tight">{project.name}</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold"
                          style={{background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`}}>{project.status}</span>
                        {hasAction && (
                          <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5 animate-pulse">
                            <AlertCircle className="h-2.5 w-2.5"/> Action Required
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">{project.exhibition ?? 'Exhibition TBD'}</p>
                    </div>
                    <button className="text-muted-foreground p-1 transition-transform flex-shrink-0" style={{transform:isExp?'rotate(180deg)':'none'}}>
                      <ChevronDown className="h-4 w-4"/>
                    </button>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {[
                      {label:'System',   value: project.system?.toUpperCase() ?? 'OCTANORM'},
                      {label:'Size',     value: project.dimensions ?? '—'},
                      {label:'PM',       value: project.pm},
                      {label:'Deadline', value: new Date(project.deadline).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})},
                    ].map(m=>(
                      <div key={m.label} className="bg-muted/30 rounded p-2">
                        <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{m.label}</p>
                        <p className="text-[11px] font-semibold font-mono mt-0.5 truncate">{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1.5">
                      <span>Production Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <ProgressBar value={project.progress}/>
                  </div>
                </div>

                {/* Expanded: timeline + actions */}
                {isExp && (
                  <div className="border-t bg-muted/10 p-5 grid grid-cols-3 gap-6">
                    {/* Timeline */}
                    <div className="col-span-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Project Timeline</p>
                      <div className="space-y-2.5">
                        {timeline.map((ev, i) => {
                          const Icon = ev.icon;
                          return (
                            <div key={i} className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{background:`${ev.color}14`}}>
                                <Icon className="h-3.5 w-3.5" style={{color:ev.color}}/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[11.5px] font-medium">{ev.label}</p>
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                                    style={{color:ev.color,borderColor:`${ev.color}30`,background:`${ev.color}08`}}>{ev.badge}</span>
                                </div>
                                <p className="text-[9.5px] font-mono text-muted-foreground mt-0.5">{ev.date}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Quick Actions</p>
                      <div className="space-y-2">
                        <Link href="/client/workspace">
                          <button className="w-full flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-md px-3 py-2.5 text-xs font-semibold hover:bg-primary hover:text-white transition-colors">
                            <Layers className="h-3.5 w-3.5"/> View Design
                          </button>
                        </Link>
                        <Link href="/client/approvals">
                          <button className={`w-full flex items-center gap-2 border rounded-md px-3 py-2.5 text-xs font-semibold transition-colors ${hasAction?'border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-600 hover:text-white':'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40'}`}>
                            <CheckCircle2 className="h-3.5 w-3.5"/> {hasAction?'Review Pending':'Approvals'}
                          </button>
                        </Link>
                        <Link href="/client/documents">
                          <button className="w-full flex items-center gap-2 border rounded-md px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                            <FileText className="h-3.5 w-3.5"/> Documents
                          </button>
                        </Link>
                        <Link href="/client/messages">
                          <button className="w-full flex items-center gap-2 border rounded-md px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                            <MessageSquare className="h-3.5 w-3.5"/> Message PM
                          </button>
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}
