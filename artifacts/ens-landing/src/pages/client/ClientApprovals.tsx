import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CheckCircle2, X, Clock, Eye, MessageSquare, AlertCircle, ChevronDown, ChevronUp, Send } from "lucide-react";

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

interface ApprovalItem {
  id: string; title: string; version: string; project: string;
  description: string; submittedAt: string; status: ApprovalStatus;
  previewHint: string; notes?: string;
  comments: { id:string; text:string; author:string; time:string; }[];
}

const STATUS_CFG: Record<ApprovalStatus,{bg:string;text:string;border:string}> = {
  Pending:  { bg:'rgba(217,119,6,0.08)', text:'#d97706', border:'rgba(217,119,6,0.3)' },
  Approved: { bg:'rgba(47,125,58,0.08)', text:'#2f7d3a', border:'rgba(47,125,58,0.3)' },
  Rejected: { bg:'rgba(220,38,38,0.08)', text:'#dc2626', border:'rgba(220,38,38,0.3)' },
};

const INITIAL: ApprovalItem[] = [
  {
    id:'a1', title:'Final Stand Design — v2.4', version:'v2.4', project:'TechCon 2024 — Global Exhibit',
    description:'Full 8×6m Maxima stand with charcoal carpet, updated branding fascia, and furniture layout per your last request.',
    submittedAt:'Today, 10:32 AM', status:'Pending', previewHint:'8×6 Maxima · Charcoal',
    comments:[{id:'c1',text:'Counter repositioned and additional spotlights added over display area.',author:'Sarah M. (PM)',time:'2h ago'}],
  },
  {
    id:'a2', title:'Lighting Scheme — Revision B', version:'v2.3', project:'TechCon 2024 — Global Exhibit',
    description:'Four additional spotlights added to left display area. LED strips fitted under the reception counter edge.',
    submittedAt:'Yesterday, 4:15 PM', status:'Approved', previewHint:'Lighting update',
    comments:[{id:'c2',text:'Looks great! The LED strips are exactly what we wanted.',author:'You',time:'Yesterday, 5:00 PM'}],
    notes:'Approved by client on May 17.',
  },
  {
    id:'a3', title:'Reception Layout — v1.2', version:'v1.2', project:'TechCon 2024 — Global Exhibit',
    description:'Initial reception counter placement at front-left. Waiting for client feedback on positioning.',
    submittedAt:'May 12, 2024', status:'Rejected', previewHint:'Reception layout',
    comments:[{id:'c3',text:"We'd prefer the counter slightly more centered. Can you adjust?",author:'You',time:'May 12'}],
    notes:'Client requested counter to be centered — implemented in v2.x.',
  },
  {
    id:'a4', title:'Wall Finish Selection', version:'v1.0', project:'HealthExpo Booth',
    description:'Please review and confirm the wall finish color. Options: White, Charcoal, or Oak veneer.',
    submittedAt:'May 10, 2024', status:'Pending', previewHint:'HealthExpo 6×3',
    comments:[],
  },
];

export default function ClientApprovals() {
  const [items,      setItems]   = useState<ApprovalItem[]>(INITIAL);
  const [expanded,   setExpanded] = useState<string|null>('a1');
  const [replyText,  setReply]   = useState<Record<string,string>>({});
  const [filterSt,   setFilter]  = useState<ApprovalStatus|'All'>('All');
  const [toast,      setToast]   = useState('');
  const [confirmDlg, setConfirm] = useState<{id:string;action:'Approved'|'Rejected'}|null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const doAction = (id: string, action: 'Approved'|'Rejected') => {
    setItems(prev => prev.map(i => i.id===id ? {...i, status:action} : i));
    setConfirm(null);
    showToast(action === 'Approved' ? '✓ Design approved — PM notified' : 'Changes requested — PM notified');
  };

  const sendReply = (id: string) => {
    const text = replyText[id]?.trim();
    if(!text) return;
    setItems(prev => prev.map(i => i.id===id ? {
      ...i, comments:[...i.comments,{id:`c${Date.now()}`,text,author:'You',time:'Just now'}],
    } : i));
    setReply(p => ({...p,[id]:''}));
    showToast('Comment sent to PM');
  };

  const visible = items.filter(i => filterSt==='All' || i.status===filterSt);
  const pending = items.filter(i => i.status==='Pending').length;

  return (
    <DashboardLayout role="client">
      <div className="space-y-6">
        <PageHeader title="Approvals" breadcrumbs={[{label:'Dashboard',href:'/client'},{label:'Approvals'}]}>
          {pending > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-1.5 animate-pulse">
              <AlertCircle className="h-4 w-4" /> {pending} Awaiting Your Review
            </span>
          )}
        </PageHeader>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {(['Pending','Approved','Rejected'] as const).map(s => {
            const cnt = items.filter(i => i.status===s).length;
            const sc = STATUS_CFG[s];
            return (
              <div key={s} className="border rounded-lg p-4 cursor-pointer transition-all hover:shadow-sm" style={{borderColor:sc.border,background:sc.bg}}
                onClick={() => setFilter(filterSt===s?'All':s)}>
                <p className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{color:sc.text}}>{s}</p>
                <p className="text-2xl font-bold font-mono" style={{color:sc.text}}>{cnt}</p>
              </div>
            );
          })}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(['All','Pending','Approved','Rejected'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold border transition-all ${filterSt===s?'bg-foreground text-background border-foreground':'bg-transparent text-muted-foreground border-border hover:border-foreground/50'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="space-y-3">
          {visible.map(item => {
            const sc = STATUS_CFG[item.status];
            const isExp = expanded === item.id;
            return (
              <div key={item.id} className="border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-all"
                style={item.status==='Pending'?{borderColor:'rgba(217,119,6,0.4)'}:{}}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-sm">{item.title}</span>
                        <span className="text-[10px] font-mono bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">{item.project}</span>
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{background:sc.bg,color:sc.text,border:`1px solid ${sc.border}`}}>{item.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{item.submittedAt}</span>
                        {item.comments.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/>{item.comments.length} comments</span>}
                      </div>
                    </div>
                    <button onClick={() => setExpanded(isExp ? null : item.id)}
                      className="text-muted-foreground hover:text-foreground p-1 shrink-0">
                      {isExp ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                    </button>
                  </div>

                  {/* Action buttons for pending */}
                  {item.status === 'Pending' && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <button onClick={() => setConfirm({id:item.id,action:'Approved'})}
                        className="flex items-center gap-1.5 bg-green-600 text-white rounded-md px-4 py-2 text-sm font-semibold hover:bg-green-700 transition-colors">
                        <CheckCircle2 className="h-3.5 w-3.5"/> Approve
                      </button>
                      <button onClick={() => setConfirm({id:item.id,action:'Rejected'})}
                        className="flex items-center gap-1.5 border border-red-200 text-red-600 rounded-md px-4 py-2 text-sm font-semibold hover:bg-red-50 transition-colors">
                        <X className="h-3.5 w-3.5"/> Request Changes
                      </button>
                      <button onClick={() => setExpanded(isExp ? null : item.id)}
                        className="flex items-center gap-1.5 border rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors ml-auto">
                        <Eye className="h-3.5 w-3.5"/> View Details
                      </button>
                    </div>
                  )}
                  {item.notes && (
                    <p className="mt-2 text-[11px] font-mono text-muted-foreground bg-muted/30 rounded px-3 py-1.5">{item.notes}</p>
                  )}
                </div>

                {/* Expanded thread */}
                {isExp && (
                  <div className="border-t bg-muted/10 p-4 space-y-3">
                    {item.comments.length > 0 && (
                      <div className="space-y-2.5">
                        {item.comments.map(c => (
                          <div key={c.id} className={`flex gap-2.5 ${c.author==='You'?'flex-row-reverse':''}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${c.author==='You'?'bg-primary/20':'bg-blue-100'}`}>
                              <span className={`text-[9px] font-mono font-bold ${c.author==='You'?'text-primary':'text-blue-700'}`}>{c.author==='You'?'ME':'PM'}</span>
                            </div>
                            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${c.author==='You'?'bg-primary text-white':'bg-background border'}`}>
                              <p className="font-semibold text-[11px] mb-0.5 opacity-70">{c.author}</p>
                              <p>{c.text}</p>
                              <p className={`text-[10px] mt-1 font-mono ${c.author==='You'?'text-white/60':'text-muted-foreground'}`}>{c.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input value={replyText[item.id]??''} onChange={e => setReply(p=>({...p,[item.id]:e.target.value}))}
                        onKeyDown={e => e.key==='Enter'&&sendReply(item.id)}
                        placeholder="Leave a comment for your PM…"
                        className="flex-1 h-9 border rounded-md px-3 text-sm bg-background outline-none focus:border-primary" />
                      <button onClick={() => sendReply(item.id)}
                        className="h-9 w-9 bg-primary text-white rounded-md flex items-center justify-center shrink-0">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && <div className="text-center py-16 text-muted-foreground text-sm font-mono border-2 border-dashed rounded-lg">No approvals here.</div>}
        </div>
      </div>

      {/* Confirm Dialog */}
      {confirmDlg && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setConfirm(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg p-6 z-50 w-96 shadow-2xl">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmDlg.action==='Approved'?'bg-green-100':'bg-red-100'}`}>
              {confirmDlg.action==='Approved' ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <X className="h-6 w-6 text-red-600" />}
            </div>
            <h3 className="text-center font-bold text-base mb-2">{confirmDlg.action==='Approved'?'Approve This Design?':'Request Changes?'}</h3>
            <p className="text-center text-sm text-muted-foreground mb-5">{confirmDlg.action==='Approved'?'Your PM will be notified and this version will be marked as approved.':'Your PM will be notified and will address your feedback.'}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirm(null)} className="flex-1 border rounded-md py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={() => doAction(confirmDlg.id,confirmDlg.action)}
                className={`flex-1 rounded-md py-2 text-sm font-bold text-white transition-colors ${confirmDlg.action==='Approved'?'bg-green-600 hover:bg-green-700':'bg-red-500 hover:bg-red-600'}`}>
                {confirmDlg.action==='Approved'?'Yes, Approve':'Yes, Request Changes'}
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xl z-50">
          <CheckCircle2 className="h-4 w-4 text-green-400" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
