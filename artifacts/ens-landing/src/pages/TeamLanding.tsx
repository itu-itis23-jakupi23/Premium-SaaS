import { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import { useLocation } from 'wouter';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, Settings, Users, Eye, Activity, BarChart3,
  ChevronRight, Menu, X, Zap, Box, Layers, MessageSquare,
  ClipboardList, CheckCircle2, AlertTriangle, TrendingUp,
  Monitor, Package, Calendar, FileText, Bell, ArrowRight,
  Building2, UserCog, Shield, Clock, Star, Globe,
  Hexagon, Circle
} from 'lucide-react';

// ─── Animation variants ───────────────────────────────────────────
const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
const STAGGER: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.09 } },
};

// ─── Data ─────────────────────────────────────────────────────────
const CHIEF_FEATURES = [
  { icon: Monitor,       title: 'Workspace Monitor',   desc: 'Live oversight of every active design session across all projects.' },
  { icon: Users,         title: 'Team Management',     desc: 'Assign project managers, track workloads, and manage access levels.' },
  { icon: Building2,     title: 'Client Portfolio',    desc: 'Full view of all client accounts, contacts, and active contracts.' },
  { icon: BarChart3,     title: 'Analytics & Reports', desc: 'Project KPIs, time-to-approval rates, and revenue dashboards.' },
  { icon: CheckCircle2,  title: 'Approval Gateway',    desc: 'Final structural and design sign-off before production release.' },
  { icon: MessageSquare, title: 'Communications Hub',  desc: 'Centralised messaging across clients, PMs, and sub-contractors.' },
];

const PM_FEATURES = [
  { icon: Box,           title: '3D Booth Workspace',  desc: 'Full Octanorm/Maxima editor with real-time collaborative design.' },
  { icon: Users,         title: 'Client Management',   desc: 'Manage briefs, contacts, and live feedback sessions per project.' },
  { icon: ClipboardList, title: 'Task Tracker',         desc: 'Kanban task board covering production, design, and delivery phases.' },
  { icon: Package,       title: 'Project Pipeline',    desc: 'Track all active and upcoming projects with milestone timelines.' },
  { icon: FileText,      title: 'Request Management',  desc: 'Handle change requests, revision logs, and approval chains.' },
  { icon: MessageSquare, title: 'Messaging',            desc: 'Direct and group messaging with clients and the chief office.' },
];

const PLATFORM_STATS = [
  { value: '2,400+', label: 'Booths Designed',   color: 'text-primary',    bg: 'bg-primary/10',    icon: Box         },
  { value: '98%',    label: 'Approval Rate',     color: 'text-blue-400',  bg: 'bg-blue-500/10',   icon: CheckCircle2 },
  { value: '60%',    label: 'Faster Turnaround', color: 'text-cyan-400',  bg: 'bg-cyan-500/10',   icon: TrendingUp   },
  { value: '40+',    label: 'Active Projects',   color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Globe        },
];

const WORKFLOW_STEPS = [
  { icon: FileText,     title: 'Client Brief',      desc: 'Chief receives and assigns the show brief to a Project Manager.',       role: 'chief' },
  { icon: Settings,     title: 'Workspace Setup',   desc: 'PM creates the project and configures booth dimensions and system.',    role: 'pm'    },
  { icon: Box,          title: '3D Design',         desc: 'PM builds the stand in the live workspace using structural libraries.', role: 'pm'    },
  { icon: Eye,          title: 'Chief Review',      desc: 'Chief monitors progress and provides structural guidance.',             role: 'chief' },
  { icon: Users,        title: 'Client Sign-Off',   desc: 'Client reviews the design and submits change requests.',               role: 'client'},
  { icon: CheckCircle2, title: 'Final Approval',    desc: 'Chief approves the final design and releases for production.',         role: 'chief' },
  { icon: Package,      title: 'Production Export', desc: 'PM exports documentation, cut lists, and component schedules.',       role: 'pm'    },
];

const ROLE_BADGE: Record<string, string> = {
  chief:  'bg-primary/10 text-primary border-primary/20',
  pm:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  client: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

// ─── Component ────────────────────────────────────────────────────
export default function TeamLanding() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-background/80 backdrop-blur-lg border-b border-border/50 py-3' : 'bg-transparent py-5'
      }`}>
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl font-mono shadow-[0_0_15px_rgba(109,40,217,0.5)]">
              E
            </div>
            <span className="font-bold text-xl tracking-tight">ENS</span>
            <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20 py-0 px-2 hidden sm:flex">
              Internal Portal
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <a href="#roles" className="text-muted-foreground hover:text-foreground transition-colors">Roles</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#workflow" className="text-muted-foreground hover:text-foreground transition-colors">Workflow</a>
            <ThemeToggle />
            <Button variant="outline" size="sm" className="rounded-full px-5 font-semibold border-border/60"
              onClick={() => navigate('/')}>Client Site</Button>
            <Button size="sm" className="rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(109,40,217,0.3)]"
              onClick={() => navigate('/login')}>Sign In</Button>
          </nav>

          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-background/95 border-b border-border px-6 py-4 space-y-3 backdrop-blur-xl">
            {['roles', 'features', 'workflow'].map(s => (
              <a key={s} href={`#${s}`}
                onClick={() => setMobileOpen(false)}
                className="block text-sm capitalize text-muted-foreground hover:text-foreground py-1">{s}</a>
            ))}
            <Button size="sm" className="w-full rounded-full" onClick={() => navigate('/login')}>Sign In</Button>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-44 pb-16 md:pt-56 md:pb-24 overflow-hidden">
        {/* Background glow layers */}
        <div className="absolute inset-0 grid-pattern opacity-[0.05] dark:opacity-[0.12] -z-10" />
        <motion.div style={{ y }} className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[950px] h-[600px] rounded-full bg-primary/18 blur-[150px] pointer-events-none -z-10" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-blue-500/12 blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/4 w-[350px] h-[350px] rounded-full bg-cyan-500/8 blur-[100px] pointer-events-none -z-10" />
        {/* Subtle decorative rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full border border-primary/5 pointer-events-none -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full border border-blue-500/5 pointer-events-none -z-10" />

        <div className="container mx-auto px-6">
          <motion.div initial="hidden" animate="visible" variants={STAGGER} className="max-w-5xl mx-auto text-center">

            <motion.div variants={FADE_UP}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
              <Shield className="w-3.5 h-3.5" />
              Staff & Management Portal
            </motion.div>

            <motion.h1 variants={FADE_UP}
              className="text-5xl md:text-7xl font-bold tracking-tight mb-7 leading-[1.08]">
              Your Command Centre for
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-cyan-400 glow-text">
                Exhibition Excellence
              </span>
            </motion.h1>

            <motion.p variants={FADE_UP}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Purpose-built tools for Chief Managers overseeing operations and Project Managers
              designing world-class exhibition stands.
            </motion.p>

            <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/chief')}
                className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold gap-2 shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:shadow-[0_0_30px_rgba(109,40,217,0.5)]">
                <LayoutDashboard className="w-5 h-5" /> Chief Dashboard <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/pm')}
                className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/5">
                <Settings className="w-5 h-5" /> Project Manager <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Floating platform stats ──────────────────────────────── */}
      <div className="container mx-auto px-6 -mt-4 mb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PLATFORM_STATS.map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="bg-card/50 backdrop-blur-md border border-border/50 rounded-xl p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <div className={`text-2xl font-black leading-none mb-1 ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Role Portal Cards ─────────────────────────────────────── */}
      <section id="roles" className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-[0.03] -z-10" />
        <div className="container mx-auto px-6">

          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Choose Your Portal</h2>
            <p className="text-muted-foreground">Two dedicated environments, each tailored to your responsibilities within the platform.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">

            {/* Chief Manager Card */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="relative group rounded-3xl border border-primary/25 bg-primary/5 backdrop-blur-xl overflow-hidden p-8 cursor-pointer"
              onClick={() => navigate('/chief')}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary/15 blur-3xl -z-10" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 blur-3xl -z-10" />

              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                    <UserCog className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">Senior Role</div>
                    <h3 className="text-2xl font-black">Chief Manager</h3>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary/60 group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
              </div>

              <p className="text-muted-foreground mb-8 leading-relaxed">
                Full operational oversight. Monitor active workspaces, manage your PM team, approve final designs, and review company-wide analytics in real time.
              </p>

              <div className="space-y-3 mb-8">
                {['Live workspace monitoring', 'Team & client management', 'Approval authority', 'Business analytics'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-3 h-3 text-primary" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Decorative dashboard preview */}
              <div className="rounded-xl bg-background/50 border border-primary/15 p-4 space-y-2">
                {[
                  { label: 'Active Projects', val: '12', color: 'bg-primary' },
                  { label: 'Pending Approvals', val: '3', color: 'bg-yellow-500' },
                  { label: 'Team Utilisation', val: '84%', color: 'bg-green-500' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${row.color} rounded-full`}
                          style={{ width: row.val.includes('%') ? row.val : `${Math.min(100, parseInt(row.val) * 8)}%` }} />
                      </div>
                      <span className="text-[11px] font-bold w-8 text-right">{row.val}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full mt-6 rounded-full gap-2 shadow-[0_0_15px_rgba(109,40,217,0.2)]"
                onClick={e => { e.stopPropagation(); navigate('/chief'); }}>
                <LayoutDashboard className="w-4 h-4" /> Enter Chief Dashboard
              </Button>
            </motion.div>

            {/* Project Manager Card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="relative group rounded-3xl border border-blue-500/25 bg-blue-500/5 backdrop-blur-xl overflow-hidden p-8 cursor-pointer"
              onClick={() => navigate('/pm')}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/15 blur-3xl -z-10" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 blur-3xl -z-10" />

              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <Settings className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Design Role</div>
                    <h3 className="text-2xl font-black">Project Manager</h3>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-blue-400/60 group-hover:text-blue-400 group-hover:translate-x-1 transition-all mt-1" />
              </div>

              <p className="text-muted-foreground mb-8 leading-relaxed">
                Design, manage, and deliver. Build exhibition stands in the 3D workspace, coordinate with clients through the review cycle, and track every task to completion.
              </p>

              <div className="space-y-3 mb-8">
                {['Live 3D booth workspace', 'Client collaboration tools', 'Task & project tracking', 'Change request workflow'].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <div className="w-5 h-5 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-3 h-3 text-blue-400" />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Decorative workspace preview */}
              <div className="rounded-xl bg-background/50 border border-blue-500/15 p-4 space-y-2">
                {[
                  { label: 'My Projects', val: '5', color: 'bg-blue-500' },
                  { label: 'Open Tasks', val: '18', color: 'bg-cyan-500' },
                  { label: 'Client Reviews', val: '2', color: 'bg-purple-500' },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${row.color} rounded-full`}
                          style={{ width: `${Math.min(100, parseInt(row.val) * 5 + 20)}%` }} />
                      </div>
                      <span className="text-[11px] font-bold w-8 text-right">{row.val}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button variant="outline"
                className="w-full mt-6 rounded-full gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
                onClick={e => { e.stopPropagation(); navigate('/pm'); }}>
                <Settings className="w-4 h-4" /> Enter PM Dashboard
              </Button>
            </motion.div>
          </div>

          {/* Quick-access row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 max-w-5xl mx-auto bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl px-6 py-4 flex flex-wrap items-center justify-between gap-4"
          >
            <span className="text-xs text-muted-foreground font-medium">Quick access:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Chief Dashboard',     path: '/chief',              clx: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' },
                { label: 'Chief Monitor',        path: '/chief/workspace-monitor', clx: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' },
                { label: 'PM Dashboard',         path: '/pm',                 clx: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15' },
                { label: '3D Workspace',         path: '/pm/workspace',       clx: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/15' },
                { label: 'PM Tasks',             path: '/pm/tasks',           clx: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15' },
              ].map(({ label, path, clx }) => (
                <button key={path}
                  onClick={() => navigate(path)}
                  className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-colors ${clx}`}>
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features by Role ────────────────────────────────────── */}
      <section id="features" className="py-24 bg-muted/10 border-y border-border/40">
        <div className="container mx-auto px-6">

          {/* Chief Features */}
          <div className="mb-24">
            <div className="flex items-center gap-4 mb-12">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                <UserCog className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">For Chief Managers</div>
                <h2 className="text-2xl md:text-3xl font-bold">Operational Command Tools</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {CHIEF_FEATURES.map((f, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(109,40,217,0.07)] transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* PM Features */}
          <div>
            <div className="flex items-center gap-4 mb-12">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">For Project Managers</div>
                <h2 className="text-2xl md:text-3xl font-bold">Design & Delivery Tools</h2>
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {PM_FEATURES.map((f, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="p-6 rounded-2xl bg-card border border-border/50 hover:border-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.07)] transition-all group">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Workflow Timeline ────────────────────────────────────── */}
      <section id="workflow" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 blur-[80px] -z-10" />
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From Brief to Build</h2>
            <p className="text-muted-foreground">See exactly how Chief Managers and Project Managers collaborate through the 7-stage delivery process.</p>
          </div>

          <div className="max-w-3xl mx-auto relative">
            <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/60 via-blue-500/40 to-transparent -translate-x-1/2" />

            <div className="space-y-10">
              {WORKFLOW_STEPS.map((step, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-80px' }}
                  className={`flex items-center gap-6 md:gap-8 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                  <div className="flex-1 hidden md:block" />
                  <div className={`relative z-10 w-12 h-12 rounded-full bg-background border-2 flex items-center justify-center font-black text-sm flex-shrink-0
                    ${step.role === 'chief' ? 'border-primary text-primary shadow-[0_0_12px_rgba(109,40,217,0.3)]'
                      : step.role === 'pm' ? 'border-blue-500 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                      : 'border-cyan-500 text-cyan-400'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`p-5 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-border transition-colors ${i % 2 === 0 ? '' : 'md:text-right'}`}>
                      <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider mb-3 ${ROLE_BADGE[step.role]}`}>
                        {step.role === 'chief' ? <UserCog className="w-2.5 h-2.5" />
                          : step.role === 'pm' ? <Settings className="w-2.5 h-2.5" />
                          : <Eye className="w-2.5 h-2.5" />}
                        {step.role === 'chief' ? 'Chief Manager' : step.role === 'pm' ? 'Project Manager' : 'Client'}
                      </div>
                      <h3 className="text-base font-bold mb-1">{step.title}</h3>
                      <p className="text-muted-foreground text-sm">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Dashboard UI Preview ─────────────────────────────────── */}
      <section className="py-20 bg-black/30 border-y border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-[0.06]" />
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <h2 className="text-3xl font-bold mb-3">Professional Management Environment</h2>
            <p className="text-muted-foreground text-sm">A clear, information-dense interface built for fast decision-making.</p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-border/50 bg-background shadow-2xl overflow-hidden max-w-5xl mx-auto"
          >
            {/* App chrome */}
            <div className="h-11 border-b border-border/50 bg-muted/30 flex items-center gap-4 px-4">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="text-xs font-mono text-muted-foreground bg-background/40 px-3 py-0.5 rounded border border-border/40">
                ENS Platform — Chief Manager Dashboard
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-muted-foreground">Live</span>
              </div>
            </div>

            <div className="flex" style={{ height: 380 }}>
              {/* Sidebar nav */}
              <div className="w-48 border-r border-border/50 bg-muted/10 p-4 flex flex-col gap-1 hidden md:flex">
                {[
                  { icon: LayoutDashboard, label: 'Dashboard',    active: true  },
                  { icon: Monitor,         label: 'WS Monitor',   active: false },
                  { icon: Users,           label: 'Team',         active: false },
                  { icon: Building2,       label: 'Clients',      active: false },
                  { icon: BarChart3,       label: 'Reports',      active: false },
                  { icon: MessageSquare,   label: 'Messages',     active: false },
                  { icon: Settings,        label: 'Settings',     active: false },
                ].map((item, i) => (
                  <div key={i}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer
                      ${item.active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'}`}>
                    <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {item.label}
                  </div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-5 overflow-hidden">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Overview</div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { label: 'Active Projects', val: '12', change: '+2', color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Open Approvals',  val: '3',  change: '-1', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                    { label: 'Active PMs',      val: '7',  change: '0',  color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  ].map((card, i) => (
                    <div key={i} className={`rounded-xl border border-border/50 p-3 ${card.bg}`}>
                      <div className="text-[9px] text-muted-foreground mb-1">{card.label}</div>
                      <div className={`text-2xl font-black ${card.color}`}>{card.val}</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        <span className={card.change.startsWith('+') ? 'text-green-400' : card.change.startsWith('-') ? 'text-red-400' : ''}>{card.change}</span> this week
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Active Projects</div>
                <div className="space-y-2">
                  {[
                    { name: 'TechCon 2024 – Global Exhibit',    pm: 'J. Rivera', status: 'In Design',   pct: 72, color: 'bg-blue-500' },
                    { name: 'AutoShow Berlin – Main Stand',     pm: 'K. Müller', status: 'In Review',   pct: 88, color: 'bg-yellow-500' },
                    { name: 'MedExpo Dubai – Pharma Zone',      pm: 'S. Al-Farsi', status: 'Approved',  pct: 100, color: 'bg-green-500' },
                  ].map((p, i) => (
                    <div key={i} className="flex items-center gap-3 bg-muted/20 rounded-lg px-3 py-2 border border-border/30">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold truncate">{p.name}</div>
                        <div className="text-[9px] text-muted-foreground">PM: {p.pm}</div>
                      </div>
                      <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full
                        ${p.status === 'Approved' ? 'bg-green-500/15 text-green-400'
                          : p.status === 'In Review' ? 'bg-yellow-500/15 text-yellow-400'
                          : 'bg-blue-500/15 text-blue-400'}`}>{p.status}</div>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                        <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 blur-[100px] rounded-full -z-10" />
        <div className="container mx-auto px-6 text-center max-w-2xl">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}
          >
            <motion.div variants={FADE_UP}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
              <Star className="w-3.5 h-3.5" /> Ready to get started?
            </motion.div>
            <motion.h2 variants={FADE_UP} className="text-4xl md:text-5xl font-bold mb-6">
              Enter Your Dashboard
            </motion.h2>
            <motion.p variants={FADE_UP} className="text-muted-foreground mb-10">
              Sign in with your ENS account or jump directly into the demo environment.
            </motion.p>
            <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/chief')}
                className="w-full sm:w-auto rounded-full px-8 h-12 font-semibold gap-2">
                <UserCog className="w-4 h-4" /> Chief Manager
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/pm')}
                className="w-full sm:w-auto rounded-full px-8 h-12 font-semibold gap-2 border-blue-500/40 text-blue-400">
                <Settings className="w-4 h-4" /> Project Manager
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate('/login')}
                className="w-full sm:w-auto rounded-full px-8 h-12 font-semibold border border-border/50">
                Sign In →
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-background pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            {/* Brand */}
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg font-mono shadow-[0_0_12px_rgba(109,40,217,0.4)]">E</div>
                <span className="font-bold text-lg tracking-tight">ENS Platform</span>
                <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20 py-0 px-2 ml-1">Staff</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
                Purpose-built management tools for exhibition professionals — from initial brief to production-ready documentation.
              </p>
              <div className="flex gap-3">
                {['Chief Portal', 'PM Portal'].map((label, i) => (
                  <button key={label}
                    onClick={() => navigate(i === 0 ? '/chief' : '/pm')}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chief tools */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary/60 mb-4">Chief Manager</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['Dashboard', 'WS Monitor', 'Team Management', 'Client Portfolio', 'Reports', 'Settings'].map(l => (
                  <li key={l}><button onClick={() => navigate('/chief')} className="hover:text-foreground transition-colors text-left">{l}</button></li>
                ))}
              </ul>
            </div>

            {/* PM tools */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-4">Project Manager</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['Dashboard', '3D Workspace', 'My Projects', 'Clients', 'Tasks', 'Messages'].map(l => (
                  <li key={l}><button onClick={() => navigate('/pm')} className="hover:text-foreground transition-colors text-left">{l}</button></li>
                ))}
              </ul>
            </div>

            {/* Support */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Resources</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['Documentation', 'Training Videos', 'Release Notes', 'System Status', 'IT Support'].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <div className="text-xs font-semibold mb-1">Internal support</div>
                <a href="mailto:it@ens.io" className="text-[11px] text-primary hover:underline">it@ens.io</a>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} ENS Expo Solutions Ltd.</span>
              <span className="text-xs text-muted-foreground/40">Internal use only</span>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <button onClick={() => navigate('/')} className="hover:text-foreground transition-colors">Client Portal</button>
              <a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-foreground transition-colors">Security</a>
              <button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors">Sign In</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
