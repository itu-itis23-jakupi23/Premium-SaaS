import { useState } from "react";
import { Link } from "wouter";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import {
  Search, Monitor, Send, MessageSquare, ChevronRight, ChevronDown,
  CheckCircle2, Clock, AlertCircle, Layers, Mail, Phone, Building2, X,
} from "lucide-react";

interface ContactEvent { date: string; type: 'message'|'approval'|'change'|'version'; text: string; }

const CLIENT_DATA = [
  { id:'c1', name:'TechCorp Industries', contact:'James Thornton', email:'james@techcorp.com', phone:'+1 555-0101', projects:['TechCon 2024 — Global Exhibit'], status:'Active',
    events:[
      {date:'Today 10:30',  type:'approval',  text:'Approved v2.4 lighting scheme'},
      {date:'Yesterday',    type:'message',   text:'Requested wider reception counter'},
      {date:'May 14',       type:'version',   text:'PM sent design v2.3 for review'},
      {date:'May 12',       type:'change',    text:'Change request: Charcoal back wall'},
    ] as ContactEvent[],
  },
  { id:'c2', name:'MediLife', contact:'Dr. Amara Singh', email:'amara@medilife.com', phone:'+1 555-0202', projects:['HealthExpo Booth'], status:'Active',
    events:[
      {date:'5h ago',  type:'change',   text:'Requested 20cm taller fascia'},
      {date:'May 13',  type:'version',  text:'PM sent design v1.3'},
      {date:'May 10',  text:'First design brief received',type:'message'},
    ] as ContactEvent[],
  },
  { id:'c3', name:'FastCars Co', contact:'Marco Bianchi', email:'marco@fastcars.com', phone:'+1 555-0303', projects:['AutoShow Premium Stand'], status:'Pending',
    events:[
      {date:'1d ago', type:'approval', text:'Approved spotlight placement'},
      {date:'Aug 8',  type:'message',  text:'Requested updated lighting'},
      {date:'Aug 5',  type:'version',  text:'Initial design sent'},
    ] as ContactEvent[],
  },
  { id:'c4', name:'GreenTech', contact:'Priya Kapoor', email:'priya@greentech.com', phone:'+1 555-0404', projects:['EcoFair Stand'], status:'Pending',
    events:[
      {date:'2d ago',  type:'change',  text:'Requested brand-green carpet'},
      {date:'May 10',  type:'version', text:'Concept v1 shared'},
    ] as ContactEvent[],
  },
  { id:'c5', name:'RetailBrand', contact:'Lena Hoffman', email:'lena@retailbrand.com', phone:'+1 555-0505', projects:['RetailPeak Expo'], status:'Active',
    events:[
      {date:'3d ago', type:'change',   text:'Corner config request — declined'},
      {date:'May 8',  type:'version',  text:'v1.0 initial design shared'},
      {date:'May 5',  type:'message',  text:'Onboarding call completed'},
    ] as ContactEvent[],
  },
];

const STATUS_COLOR: Record<string,{bg:string;text:string}> = {
  Active:  { bg:'rgba(47,125,58,0.1)',  text:'#2f7d3a' },
  Pending: { bg:'rgba(194,65,12,0.1)',  text:'#c2410c' },
  Delayed: { bg:'rgba(220,38,38,0.1)',  text:'#dc2626' },
};
const EVENT_CFG = {
  message:  { icon:MessageSquare, color:'#1d4ed8' },
  approval: { icon:CheckCircle2,  color:'#2f7d3a' },
  change:   { icon:AlertCircle,   color:'#c2410c' },
  version:  { icon:Layers,        color:'#7c3aed' },
};

export default function PMClients() {
  const [search,    setSearch]    = useState('');
  const [expanded,  setExpanded]  = useState<string|null>(null);
  const [msgDlg,    setMsgDlg]    = useState<typeof CLIENT_DATA[0]|null>(null);
  const [msgText,   setMsgText]   = useState('');
  const [toast,     setToast]     = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(()=>setToast(''),3000); };

  const sendMsg = () => {
    if(!msgText.trim() || !msgDlg) return;
    showToast(`Message sent to ${msgDlg.name}`);
    setMsgDlg(null); setMsgText('');
  };

  const filtered = CLIENT_DATA.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout role="pm">
      <div className="space-y-6">
        <PageHeader title="My Clients" breadcrumbs={[{label:'Dashboard',href:'/pm'},{label:'My Clients'}]}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
              className="pl-8 pr-3 h-8 text-xs border rounded-md bg-muted/30 outline-none focus:border-primary w-48"/>
          </div>
        </PageHeader>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[['Total Clients',CLIENT_DATA.length,'text-foreground'],['Active',CLIENT_DATA.filter(c=>c.status==='Active').length,'text-green-600'],['Pending',CLIENT_DATA.filter(c=>c.status==='Pending').length,'text-orange-600']].map(([l,v,c])=>(
            <div key={l as string} className="border rounded-lg p-4 bg-card">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">{l}</p>
              <p className={`text-2xl font-bold font-mono ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Client rows */}
        <div className="space-y-2.5">
          {filtered.map(client => {
            const sc = STATUS_COLOR[client.status] ?? STATUS_COLOR.Active;
            const isExp = expanded === client.id;
            return (
              <div key={client.id} className="border rounded-lg bg-card overflow-hidden hover:border-primary/30 transition-all">
                <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={() => setExpanded(isExp ? null : client.id)}>
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[11px] font-bold text-primary">{client.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{client.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold" style={{background:sc.bg,color:sc.text}}>{client.status}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{client.contact} · {client.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1.5">
                      {client.projects.map(p => (
                        <span key={p} className="text-[10px] font-mono bg-muted/50 border rounded px-2 py-0.5 max-w-[160px] truncate">{p}</span>
                      ))}
                    </div>
                    <button onClick={e=>{e.stopPropagation();setMsgDlg(client);}} title="Quick message"
                      className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors">
                      <MessageSquare className="h-3.5 w-3.5"/>
                    </button>
                    <Link href="/pm/workspace">
                      <button onClick={e=>e.stopPropagation()} title="Open workspace"
                        className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border hover:border-primary/30 transition-colors">
                        <Monitor className="h-3.5 w-3.5"/>
                      </button>
                    </Link>
                    <button className="p-1 text-muted-foreground transition-transform" style={{transform:isExp?'rotate(180deg)':'none'}}>
                      <ChevronDown className="h-4 w-4"/>
                    </button>
                  </div>
                </div>

                {isExp && (
                  <div className="border-t bg-muted/10 p-5 grid grid-cols-2 gap-6">
                    {/* Contact details */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Contact Details</p>
                      <div className="space-y-2.5">
                        {[
                          [Building2, client.name],
                          [Mail,      client.email],
                          [Phone,     client.phone],
                        ].map(([Icon, val], i) => (
                          <div key={i} className="flex items-center gap-2.5 text-sm">
                            <div className="w-7 h-7 rounded bg-muted/50 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground"/>
                            </div>
                            <span className="text-sm text-foreground">{val}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => {setMsgDlg(client);}}
                          className="flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-primary hover:text-white transition-colors">
                          <Send className="h-3 w-3"/> Message
                        </button>
                        <Link href="/pm/workspace">
                          <button className="flex items-center gap-1.5 border rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                            <Layers className="h-3 w-3"/> Workspace
                          </button>
                        </Link>
                      </div>
                    </div>

                    {/* Contact history */}
                    <div>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Interaction History</p>
                      <div className="space-y-2">
                        {client.events.map((ev, i) => {
                          const cfg = EVENT_CFG[ev.type];
                          const Icon = cfg.icon;
                          return (
                            <div key={i} className="flex items-start gap-3 p-2.5 rounded-md bg-card border border-border/50">
                              <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{background:`${cfg.color}14`}}>
                                <Icon className="h-3 w-3" style={{color:cfg.color}}/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11.5px] font-medium leading-tight">{ev.text}</p>
                                <p className="text-[9.5px] font-mono text-muted-foreground mt-0.5">{ev.date}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Message Dialog */}
      {msgDlg && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setMsgDlg(null)}/>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border rounded-lg p-6 z-50 w-[420px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm">Message {msgDlg.name}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{msgDlg.contact} · {msgDlg.email}</p>
              </div>
              <button onClick={() => setMsgDlg(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4"/></button>
            </div>
            <textarea value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Type your message to the client…" rows={4}
              className="w-full border rounded-md p-3 text-sm bg-muted/30 outline-none focus:border-primary resize-none"/>
            <div className="flex gap-2 justify-end mt-3">
              <button onClick={() => setMsgDlg(null)} className="px-4 py-2 border rounded-md text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button onClick={sendMsg} disabled={!msgText.trim()}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5"/> Send Message
              </button>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xl z-50">
          <CheckCircle2 className="h-4 w-4 text-green-400"/> {toast}
        </div>
      )}
    </DashboardLayout>
  );
}
