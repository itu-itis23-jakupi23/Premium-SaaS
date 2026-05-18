import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Clock, CheckCircle2, ArrowUpRight, X, MessageSquare, Send, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

type Status = 'Pending' | 'In Progress' | 'Resolved' | 'Declined';
type Priority = 'High' | 'Medium' | 'Low';

interface Comment { id: string; text: string; author: string; time: string; }
interface Request {
  id: number; client: string; project: string; request: string;
  timestamp: string; status: Status; priority: Priority;
  comments: Comment[];
}

const STATUS_CFG: Record<Status,{bg:string;text:string;label:string}> = {
  Pending:    { bg:'rgba(217,119,6,0.1)',   text:'#d97706', label:'Pending' },
  'In Progress':{ bg:'rgba(29,78,216,0.1)', text:'#1d4ed8', label:'In Progress' },
  Resolved:   { bg:'rgba(47,125,58,0.1)',   text:'#2f7d3a', label:'Resolved' },
  Declined:   { bg:'rgba(220,38,38,0.1)',   text:'#dc2626', label:'Declined' },
};
const PRIORITY_CFG: Record<Priority,{color:string}> = {
  High:  { color:'#dc2626' }, Medium: { color:'#d97706' }, Low: { color:'#6b7280' },
};

const INITIAL_REQUESTS: Request[] = [
  { id:1, client:'TechCorp Industries', project:'TechCon 2024', priority:'High', timestamp:'2 hours ago', status:'Pending',
    request:'Change the back wall to charcoal and add a small storage unit behind the reception desk. Also, can we increase the reception counter width by 20cm?',
    comments:[] },
  { id:2, client:'MediLife', project:'HealthExpo Booth', priority:'Medium', timestamp:'5 hours ago', status:'In Progress',
    request:'Increase the height of the fascia by 20cm to accommodate the new logo size. The logo was recently rebranded and needs more vertical space.',
    comments:[{id:'c1',text:'Working on the fascia update now — will send revised render by EOD.',author:'You',time:'3h ago'}] },
  { id:3, client:'FastCars Co', project:'AutoShow Premium Stand', priority:'Low', timestamp:'1 day ago', status:'Resolved',
    request:'Add 4 more spotlights to the left display area. The current lighting feels insufficient for the product showcase.',
    comments:[{id:'c2',text:'Spotlights added in v2.3. Client confirmed it looks great.',author:'You',time:'22h ago'}] },
  { id:4, client:'GreenTech', project:'EcoFair Stand', priority:'Medium', timestamp:'2 days ago', status:'Pending',
    request:'The carpet color needs to match our brand green. Current dark gray does not align with our sustainability message.',
    comments:[] },
  { id:5, client:'RetailBrand', project:'RetailPeak Expo', priority:'High', timestamp:'3 days ago', status:'Declined',
    request:'Move the entire stand to a corner configuration with two open sides instead of the original single open-front.',
    comments:[{id:'c3',text:'Unfortunately the venue floor plan does not permit corner configuration at this booth size.',author:'You',time:'2d ago'}] },
];

export default function PMRequests() {
  const [requests,   setRequests]   = useState<Request[]>(INITIAL_REQUESTS);
  const [expanded,   setExpanded]   = useState<number|null>(null);
  const [replyText,  setReplyText]  = useState<Record<number,string>>({});
  const [filterSt,   setFilterSt]   = useState<Status|'All'>('All');
  const [toast,      setToast]      = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const setStatus = (id: number, status: Status) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    showToast(`Request ${status.toLowerCase()}`);
  };

  const sendReply = (id: number) => {
    const text = replyText[id]?.trim();
    if(!text) return;
    setRequests(prev => prev.map(r => r.id === id ? {
      ...r, status: r.status === 'Pending' ? 'In Progress' : r.status,
      comments: [...r.comments, { id:`c${Date.now()}`, text, author:'You', time:'Just now' }],
    } : r));
    setReplyText(p => ({...p, [id]:''}));
    showToast('Reply sent');
  };

  const counts: Partial<Record<Status,number>> = {};
  INITIAL_REQUESTS.forEach(r => { counts[r.status] = (counts[r.status]||0)+1; });

  const visible = requests.filter(r => filterSt === 'All' || r.status === filterSt);
  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="Revision Requests" breadcrumbs={[{label:'Dashboard',href:'/pm'},{label:'Requests'}]}>
          {pendingCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-md px-3 py-1.5">
              <AlertCircle className="h-4 w-4" /> {pendingCount} Pending
            </span>
          )}
        </PageHeader>

        {/* Filter tabs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['All','Pending','In Progress','Resolved','Declined'] as const).map(s => {
            const cfg = s !== 'All' ? STATUS_CFG[s] : null;
            const cnt = s === 'All' ? requests.length : counts[s] ?? 0;
            return (
              <button key={s} onClick={() => setFilterSt(s)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold border transition-all ${filterSt===s?'bg-foreground text-background border-foreground':'bg-transparent text-muted-foreground border-border hover:border-foreground/50'}`}
                style={filterSt===s&&cfg?{background:cfg.bg,color:cfg.text,borderColor:cfg.text+'40'}:{}}>
                {s} · {cnt}
              </button>
            );
          })}
        </div>

        {/* Request cards */}
        <div className="space-y-3">
          {visible.map(req => {
            const sc = STATUS_CFG[req.status];
            const pc = PRIORITY_CFG[req.priority];
            const isExpanded = expanded === req.id;
            return (
              <div key={req.id} className="border rounded-lg bg-card overflow-hidden transition-all hover:border-primary/30">
                {/* Header */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-sm">{req.client}</span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                          {req.project}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded" style={{background:sc.bg,color:sc.text}}>{sc.label}</span>
                        <span className="text-[10px] font-mono font-bold" style={{color:pc.color}}>● {req.priority}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed italic">"{req.request}"</p>
                    </div>
                    <button onClick={() => setExpanded(isExpanded ? null : req.id)}
                      className="text-muted-foreground hover:text-foreground p-1 rounded shrink-0">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                      <Clock className="h-3 w-3" /> {req.timestamp}
                      {req.comments.length > 0 && (
                        <span className="ml-2 flex items-center gap-1"><MessageSquare className="h-3 w-3"/>{req.comments.length} replies</span>
                      )}
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {req.status === 'Pending' && (
                        <>
                          <button onClick={() => setStatus(req.id,'In Progress')}
                            className="text-[11px] font-semibold border border-primary/30 text-primary bg-primary/5 rounded px-3 py-1.5 hover:bg-primary hover:text-white transition-colors flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3"/> Start
                          </button>
                          <button onClick={() => setStatus(req.id,'Declined')}
                            className="text-[11px] font-semibold border border-red-200 text-red-600 rounded px-3 py-1.5 hover:bg-red-50 transition-colors flex items-center gap-1">
                            <X className="h-3 w-3"/> Decline
                          </button>
                        </>
                      )}
                      {req.status === 'In Progress' && (
                        <button onClick={() => setStatus(req.id,'Resolved')}
                          className="text-[11px] font-semibold border border-green-200 text-green-700 bg-green-50 rounded px-3 py-1.5 hover:bg-green-600 hover:text-white transition-colors flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3"/> Resolve
                        </button>
                      )}
                      {(req.status === 'Resolved' || req.status === 'Declined') && (
                        <span className="text-[11px] font-mono text-muted-foreground px-3 py-1.5 border rounded border-dashed">{req.status}</span>
                      )}
                      <button onClick={() => setExpanded(isExpanded ? null : req.id)}
                        className="text-[11px] font-semibold text-muted-foreground border border-border rounded px-3 py-1.5 hover:text-foreground hover:border-foreground/50 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3"/> Reply
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded: comments + reply */}
                {isExpanded && (
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    {req.comments.length > 0 && (
                      <div className="space-y-2">
                        {req.comments.map(c => (
                          <div key={c.id} className={`flex gap-2.5 ${c.author==='You'?'flex-row-reverse':''}`}>
                            <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                              <span className="text-[9px] font-mono font-bold text-primary">{c.author==='You'?'PM':c.author.slice(0,2).toUpperCase()}</span>
                            </div>
                            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${c.author==='You'?'bg-primary text-white':'bg-background border'}`}>
                              <p>{c.text}</p>
                              <p className={`text-[10px] mt-1 font-mono ${c.author==='You'?'text-white/60':'text-muted-foreground'}`}>{c.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input value={replyText[req.id]??''} onChange={e => setReplyText(p=>({...p,[req.id]:e.target.value}))}
                        onKeyDown={e => e.key==='Enter' && sendReply(req.id)}
                        placeholder="Add a reply…"
                        className="flex-1 h-9 border rounded-md px-3 text-sm bg-background outline-none focus:border-primary" />
                      <button onClick={() => sendReply(req.id)}
                        className="h-9 w-9 bg-primary text-white rounded-md flex items-center justify-center hover:bg-primary/90 shrink-0">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm font-mono border-2 border-dashed rounded-lg">
              No requests match this filter.
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xl z-50">
          <CheckCircle2 className="h-4 w-4 text-green-400" /> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
