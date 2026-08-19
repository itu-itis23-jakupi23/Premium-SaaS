import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ENSLogo } from '@/components/ENSLogo';
import { motion, useInView, Variants } from 'framer-motion';
import { useLocation } from 'wouter';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ExhibitionCursorField } from '@/components/ExhibitionCursorField';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard, Settings, Users, Eye, BarChart3,
  ChevronRight, Menu, X, Zap, Box, MessageSquare,
  ClipboardList, CheckCircle2, TrendingUp,
  Monitor, Package, FileText, ArrowRight,
  Building2, UserCog, Shield, Star, Globe,
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
const CHIEF_FEATURE_ICONS = [Monitor, Users, Building2, BarChart3, CheckCircle2, MessageSquare];
const CHIEF_FEATURE_KEYS  = ['workspaceMonitor', 'teamManagement', 'clientPortfolio', 'analytics', 'approvalGateway', 'commsHub'] as const;
const PM_FEATURE_ICONS    = [Box, Users, ClipboardList, Package, FileText, MessageSquare];
const PM_FEATURE_KEYS     = ['boothWorkspace', 'clientMgmt', 'taskTracker', 'pipeline', 'requestMgmt', 'messaging'] as const;

const PLATFORM_STATS = [
  { numericValue: 2400, valueSuffix: '+', tKey: 'team.stats.boothsDesigned',   color: 'text-primary',    bg: 'bg-primary/10',    icon: Box          },
  { numericValue: 98,   valueSuffix: '%', tKey: 'team.stats.approvalRate',     color: 'text-blue-400',   bg: 'bg-blue-500/10',   icon: CheckCircle2 },
  { numericValue: 60,   valueSuffix: '%', tKey: 'team.stats.fasterTurnaround', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: TrendingUp   },
  { numericValue: 40,   valueSuffix: '+', tKey: 'team.stats.activeProjects',   color: 'text-amber-500',   bg: 'bg-amber-500/10',   icon: Globe        },
];

const WORKFLOW_STEP_ICONS = [FileText, Settings, Box, Eye, Users, CheckCircle2, Package];
const WORKFLOW_STEP_ROLES = ['chief', 'pm', 'pm', 'chief', 'client', 'chief', 'pm'] as const;
const WORKFLOW_STEP_KEYS  = ['brief', 'workspace', 'design', 'review', 'signoff', 'approval', 'export'] as const;

const ROLE_BADGE: Record<string, string> = {
  chief:  'bg-primary/10 text-primary border-primary/20',
  pm:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  client: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

const TESTIMONIALS = [
  {
    quote: "The 3D workspace has completely changed how we communicate stand designs to clients. Approval cycles are down to days, not weeks.",
    name: 'Lena Hoffmann',
    role: 'Senior Project Manager',
    initials: 'LH',
    color: 'bg-primary/20 text-primary',
  },
  {
    quote: "Having full visibility of all active projects in one dashboard means I can spot bottlenecks before they become problems. It's indispensable.",
    name: 'Marco Di Luca',
    role: 'Chief Operations Manager',
    initials: 'MD',
    color: 'bg-blue-500/20 text-blue-400',
  },
  {
    quote: "Our clients love the live review portal. They can comment directly on the 3D model, and we see changes in real time. Huge confidence boost.",
    name: 'Aisha Kamal',
    role: 'Project Manager – Exhibition Design',
    initials: 'AK',
    color: 'bg-cyan-500/20 text-cyan-400',
  },
];

// ─── CountUp ──────────────────────────────────────────────────────
function CountUp({ target, suffix = '', className = '' }: { target: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const duration = 1800;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [isInView, target]);

  return (
    <div ref={ref} className={className}>
      {count.toLocaleString()}{suffix}
    </div>
  );
}

// ─── Hero Dashboard Preview ───────────────────────────────────────
function HeroDashboardPreview() {
  const projects = [
    { name: 'TechCon 2024 – Global Exhibit', pm: 'J. Rivera',   status: 'In Design', pct: 72,  color: 'bg-blue-500',   badge: 'bg-blue-500/15 text-blue-400'     },
    { name: 'AutoShow Berlin – Main Stand',  pm: 'K. Müller',   status: 'In Review', pct: 88,  color: 'bg-yellow-500', badge: 'bg-yellow-500/15 text-yellow-400'  },
    { name: 'MedExpo Dubai – Pharma Zone',   pm: 'S. Al-Farsi', status: 'Approved',  pct: 100, color: 'bg-green-500',  badge: 'bg-green-500/15 text-green-400'    },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mt-14 max-w-4xl mx-auto relative"
    >
      <div className="absolute -inset-4 bg-primary/8 blur-[60px] rounded-3xl pointer-events-none" />
      <div className="relative rounded-2xl border border-border/60 bg-background/80 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Browser chrome */}
        <div className="h-9 border-b border-border/50 bg-muted/20 flex items-center gap-3 px-4">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="text-[11px] font-mono text-muted-foreground bg-background/40 px-3 py-0.5 rounded border border-border/30">
              ens.io / chief / dashboard
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">Live</span>
          </div>
        </div>

        <div className="flex" style={{ height: 260 }}>
          {/* Sidebar */}
          <div className="w-40 border-r border-border/40 bg-muted/5 p-3 hidden sm:flex flex-col gap-0.5 flex-shrink-0">
            {[
              { icon: LayoutDashboard, label: 'Dashboard',  active: true  },
              { icon: Monitor,         label: 'WS Monitor', active: false },
              { icon: Users,           label: 'Team',       active: false },
              { icon: Building2,       label: 'Clients',    active: false },
              { icon: BarChart3,       label: 'Reports',    active: false },
              { icon: MessageSquare,   label: 'Messages',   active: false },
            ].map((item, i) => (
              <div key={i}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                  ${item.active ? 'bg-primary/12 text-primary' : 'text-muted-foreground'}`}>
                <item.icon className="w-3 h-3 flex-shrink-0" />
                {item.label}
              </div>
            ))}
          </div>
          {/* Main */}
          <div className="flex-1 p-4 overflow-hidden">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Overview</div>
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { label: 'Active Projects', val: '12', change: '+2', color: 'text-primary',     bg: 'bg-primary/8'      },
                { label: 'Open Approvals',  val: '3',  change: '-1', color: 'text-yellow-400',  bg: 'bg-yellow-500/8'  },
                { label: 'Active PMs',      val: '7',  change: '0',  color: 'text-blue-400',    bg: 'bg-blue-500/8'    },
              ].map((c, i) => (
                <div key={i} className={`rounded-xl border border-border/40 p-2.5 ${c.bg}`}>
                  <div className="text-[9px] text-muted-foreground mb-1">{c.label}</div>
                  <div className={`text-xl font-black leading-none ${c.color}`}>{c.val}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    <span className={c.change.startsWith('+') ? 'text-green-400' : c.change.startsWith('-') ? 'text-red-400' : ''}>{c.change}</span> this week
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Active Projects</div>
            <div className="space-y-1.5">
              {projects.map((p, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-muted/15 rounded-lg px-3 py-1.5 border border-border/20">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold truncate">{p.name}</div>
                    <div className="text-[9px] text-muted-foreground">PM: {p.pm}</div>
                  </div>
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${p.badge}`}>{p.status}</div>
                  <div className="w-14 h-1 bg-muted rounded-full overflow-hidden flex-shrink-0">
                    <div className={`h-full ${p.color} rounded-full`} style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────
export default function TeamLanding() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const isOpeningPortal = false;

  useEffect(() => {
    document.title = t('team.pageTitle');
  }, [t]);

  const chiefFeatures = useMemo(() =>
    CHIEF_FEATURE_KEYS.map((key, i) => ({
      icon: CHIEF_FEATURE_ICONS[i],
      title: t(`team.chiefFeatures.${key}.title`),
      desc:  t(`team.chiefFeatures.${key}.desc`),
    })), [t]);

  const pmFeatures = useMemo(() =>
    PM_FEATURE_KEYS.map((key, i) => ({
      icon: PM_FEATURE_ICONS[i],
      title: t(`team.pmFeatures.${key}.title`),
      desc:  t(`team.pmFeatures.${key}.desc`),
    })), [t]);

  const workflowSteps = useMemo(() =>
    WORKFLOW_STEP_KEYS.map((key, i) => ({
      icon: WORKFLOW_STEP_ICONS[i],
      role: WORKFLOW_STEP_ROLES[i],
      title: t(`team.workflowSteps.${key}.title`),
      desc:  t(`team.workflowSteps.${key}.desc`),
    })), [t]);

  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div className="ens-platform-landing ens-platform-staff min-h-screen bg-background text-foreground overflow-x-hidden font-sans">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-background/80 backdrop-blur-lg border-b border-border/50 py-3' : 'bg-transparent py-5'
      }`}>
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ENSLogo size="sm" href="/" />
            <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20 py-0 px-2 hidden sm:flex">
              Internal Portal
            </Badge>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <a href="#roles" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.roles')}</a>
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.features')}</a>
            <a href="#workflow" className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.workflow')}</a>
            <LanguageSwitcher />
            <ThemeToggle />
            <Button size="sm" className="rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(109,40,217,0.3)]"
              onClick={() => navigate('/login')}>{t('common.signIn')}</Button>
          </nav>

          <div className="md:hidden flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

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
      <section className="ens-landing-hero ens-landing-hero-staff relative pt-44 pb-16 md:pt-56 md:pb-24 overflow-hidden">
        <ExhibitionCursorField variant="staff" />
        <div className="absolute inset-0 grid-pattern opacity-[0.05] dark:opacity-[0.12] -z-10" />
        <div className="ens-landing-dimension absolute left-6 right-6 top-32 hidden md:flex" aria-hidden="true">
          <span>ENS / STAFF OPERATIONS</span><i /><span>02</span>
        </div>

        <div className="container mx-auto px-6">
          <motion.div initial="hidden" animate="visible" variants={STAGGER} className="max-w-5xl mx-auto text-center">

            <motion.div variants={FADE_UP}
              className="ens-landing-hero-badge inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
              <Shield className="w-3.5 h-3.5" />
              {t('team.hero.badge')}
            </motion.div>

            <motion.h1 variants={FADE_UP}
              className="ens-landing-hero-title text-5xl md:text-7xl font-bold tracking-tight mb-7 leading-[1.08]">
              {t('team.hero.titlePart1')}
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-cyan-400 glow-text">
                {t('team.hero.titlePart2')}
              </span>
            </motion.h1>

            <motion.p variants={FADE_UP}
              className="ens-landing-hero-copy text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              {t('team.hero.subtitle')}
            </motion.p>

            <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/login?returnTo=%2Fchief')} disabled={isOpeningPortal}
                className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold gap-2 shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:shadow-[0_0_30px_rgba(109,40,217,0.5)]">
                <LayoutDashboard className="w-5 h-5" /> {t('team.hero.cta1')} <ChevronRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login?returnTo=%2Fpm')} disabled={isOpeningPortal}
                className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold gap-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/5">
                <Settings className="w-5 h-5" /> {t('team.hero.cta2')} <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Hero Dashboard Preview */}
          <HeroDashboardPreview />
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
                <CountUp target={s.numericValue} suffix={s.valueSuffix} className={`text-2xl font-black leading-none mb-1 ${s.color}`} />
                <div className="text-xs text-muted-foreground">{t(s.tKey)}</div>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('team.roles.heading')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">{t('team.roles.headingAccent')}</span></h2>
            <p className="text-muted-foreground">{t('team.roles.subheading')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">

            {/* Chief Manager Card */}
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="relative group rounded-3xl border border-primary/25 bg-primary/5 backdrop-blur-xl overflow-hidden p-8 cursor-pointer"
              onClick={() => navigate('/login?returnTo=%2Fchief')}
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
                    <h3 className="text-2xl font-black">{t('team.roles.chiefTitle')}</h3>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-primary group-hover:text-primary group-hover:translate-x-1 transition-all mt-1" />
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
                disabled={isOpeningPortal}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate('/login?returnTo=%2Fchief'); }}>
                <LayoutDashboard className="w-4 h-4" /> {t('team.roles.chiefEnter')}
              </Button>
            </motion.div>

            {/* Project Manager Card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              whileHover={{ y: -6 }}
              className="relative group rounded-3xl border border-blue-500/25 bg-blue-500/5 backdrop-blur-xl overflow-hidden p-8 cursor-pointer"
              onClick={() => navigate('/login?returnTo=%2Fpm')}
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
                    <h3 className="text-2xl font-black">{t('team.roles.pmTitle')}</h3>
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
                disabled={isOpeningPortal}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate('/login?returnTo=%2Fpm'); }}>
                <Settings className="w-4 h-4" /> {t('team.roles.pmEnter')}
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
                { label: 'Chief Dashboard',  path: '/chief',                   clx: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'         },
                { label: 'Chief Workspace',  path: '/chief/workspace',         clx: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'         },
                { label: 'PM Dashboard',     path: '/pm',                      clx: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15'     },
                { label: '3D Workspace',     path: '/pm/workspace',            clx: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/15' },
                { label: 'PM Tasks',         path: '/pm/tasks',                clx: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/15'     },
              ].map(({ label, path, clx }) => (
                <button key={path}
                  disabled={isOpeningPortal}
                  onClick={() => navigate(`/login?returnTo=${encodeURIComponent(path)}`)}
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
            <div className="space-y-5">
              {chiefFeatures.slice(0, 1).map((f, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="relative p-8 rounded-2xl bg-card border border-primary/25 hover:border-primary/45 transition-all group overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 blur-3xl pointer-events-none rounded-full" />
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(109,40,217,0.2)]">
                      <f.icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold">{f.title}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">Key Feature</span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {chiefFeatures.slice(1).map((f, i) => (
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
            <div className="space-y-5">
              {pmFeatures.slice(0, 1).map((f, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="relative p-8 rounded-2xl bg-card border border-blue-500/25 hover:border-blue-500/45 transition-all group overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/8 blur-3xl pointer-events-none rounded-full" />
                  <div className="flex items-start gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                      <f.icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold">{f.title}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">Core Tool</span>
                      </div>
                      <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                      <div className="mt-4 flex items-end gap-1 h-8">
                        {[40, 55, 45, 70, 60, 80, 75, 90, 85, 100].map((h, idx) => (
                          <motion.div key={idx}
                            className="flex-1 bg-blue-500/30 rounded-sm"
                            style={{ height: `${h}%` }}
                            initial={{ scaleY: 0 }}
                            whileInView={{ scaleY: 1 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.04, duration: 0.4, ease: 'easeOut' }}
                          />
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">Design sessions — last 10 days</div>
                    </div>
                  </div>
                </motion.div>
              ))}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {pmFeatures.slice(1).map((f, i) => (
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
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-[0.04] dark:opacity-[0.08] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/6 blur-[80px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 border border-primary/20">
              <Star className="w-3.5 h-3.5" /> Trusted by exhibition professionals
            </div>
            <h2 className="text-3xl font-bold">What our <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">team says</span></h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {TESTIMONIALS.map((testimonial, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border/50 hover:border-border transition-all flex flex-col gap-4">
                <div className="text-muted-foreground text-sm leading-relaxed italic">&ldquo;{testimonial.quote}&rdquo;</div>
                <div className="flex items-center gap-3 mt-auto pt-2 border-t border-border/40">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${testimonial.color}`}>
                    {testimonial.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{testimonial.name}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Workflow Timeline ────────────────────────────────────── */}
      <section id="workflow" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-[0.05] dark:opacity-[0.1] pointer-events-none" />
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-blue-500/5 blur-3xl -z-10" />
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 border border-primary/20">
              <Zap className="w-3.5 h-3.5" /> {t('team.workflow.badge')}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('team.workflow.heading')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">{t('team.workflow.headingAccent')}</span></h2>
            <p className="text-muted-foreground">{t('team.workflow.subheading')}</p>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
            {workflowSteps.map((step, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: i % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex items-start gap-5 p-5 rounded-2xl bg-card border border-border/50 hover:border-border transition-all">
                <div className="flex-shrink-0 flex flex-col items-center gap-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${ROLE_BADGE[step.role]}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground">{String(i + 1).padStart(2, '0')}</div>
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm">{step.title}</h3>
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${ROLE_BADGE[step.role]}`}>
                      {step.role}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/10 blur-[100px] rounded-full -z-10" />
        <div className="container mx-auto px-6 text-center max-w-2xl">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={STAGGER}>
            <motion.div variants={FADE_UP}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
              <Star className="w-3.5 h-3.5" /> Ready to get started?
            </motion.div>
            <motion.h2 variants={FADE_UP} className="text-4xl md:text-5xl font-bold mb-6">
              Enter Your Dashboard
            </motion.h2>
            <motion.p variants={FADE_UP} className="text-muted-foreground mb-10">
              Sign in with your ENS staff account to continue to the correct portal.
            </motion.p>
            <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" onClick={() => navigate('/login?returnTo=%2Fchief')} disabled={isOpeningPortal}
                className="w-full sm:w-auto rounded-full px-8 h-12 font-semibold gap-2">
                <UserCog className="w-4 h-4" /> {t('team.roles.chiefTitle')}
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login?returnTo=%2Fpm')} disabled={isOpeningPortal}
                className="w-full sm:w-auto rounded-full px-8 h-12 font-semibold gap-2 border-blue-500/40 text-blue-400">
                <Settings className="w-4 h-4" /> {t('team.roles.pmTitle')}
              </Button>
              <Button size="lg" variant="ghost" onClick={() => navigate('/login')}
                className="w-full sm:w-auto rounded-full px-8 h-12 font-semibold border border-border/50">
                {t('common.signIn')} →
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-background pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <ENSLogo size="sm" href="/" />
                <Badge className="text-[10px] bg-primary/10 text-primary border border-primary/20 py-0 px-2 ml-1">Staff</Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
                {t('team.footer.tagline')}
              </p>
              <div className="flex gap-3">
                {[t('team.footer.chiefPortal'), t('team.footer.pmPortal')].map((label, i) => (
                  <button key={label}
                    disabled={isOpeningPortal}
                    onClick={() => navigate(i === 0 ? '/login?returnTo=%2Fchief' : '/login?returnTo=%2Fpm')}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4">{t('team.footer.chiefManager')}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[t('team.footer.dashboard'), t('team.footer.wsMonitor'), t('team.footer.teamMgmt'), t('team.footer.clientPortfolio'), t('team.footer.reports'), t('team.footer.settings')].map(l => (
                  <li key={l}><button onClick={() => navigate('/login?returnTo=%2Fchief')} className="hover:text-foreground transition-colors text-left">{l}</button></li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-4">{t('team.footer.projectManager')}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[t('team.footer.dashboard'), t('team.footer.workspace'), t('team.footer.projects'), t('team.footer.clients'), t('team.footer.tasks'), t('team.footer.messages')].map(l => (
                  <li key={l}><button onClick={() => navigate('/login?returnTo=%2Fpm')} className="hover:text-foreground transition-colors text-left">{l}</button></li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">{t('team.footer.resources')}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  { label: t('team.footer.docs'), href: 'mailto:it@ens.io?subject=Documentation%20access' },
                  { label: t('team.footer.training'), href: 'mailto:it@ens.io?subject=Training%20request' },
                  { label: t('team.footer.releaseNotes'), href: 'mailto:it@ens.io?subject=Release%20notes' },
                  { label: t('team.footer.systemStatus'), href: 'mailto:it@ens.io?subject=System%20status' },
                  { label: t('team.footer.itSupport'), href: 'mailto:it@ens.io?subject=IT%20support' },
                ].map(({ label, href }) => (
                  <li key={label}><a href={href} className="hover:text-foreground transition-colors">{label}</a></li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <div className="text-xs font-semibold mb-1">{t('team.footer.internalSupport')}</div>
                <a href="mailto:it@ens.io" className="text-[11px] text-primary hover:underline">it@ens.io</a>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">{t('common.copyright', { year: new Date().getFullYear() })}</span>
              <span className="text-xs text-muted-foreground">{t('common.internalOnly')}</span>
            </div>
            <div className="flex gap-6 text-xs text-muted-foreground">
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{t('team.footer.privacy')}</a>
              <a href="/security" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{t('team.footer.security')}</a>
              <button onClick={() => navigate('/login')} className="hover:text-foreground transition-colors">{t('common.signIn')}</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
