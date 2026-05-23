import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ENSLogo } from '@/components/ENSLogo';
import { motion, useScroll, useTransform, AnimatePresence, Variants } from 'framer-motion';
import { useLocation } from 'wouter';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { PORTAL_MODE } from '@/lib/portal';
import { 
  Box, 
  MonitorPlay, 
  MousePointer2, 
  Save,
  Users,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Zap,
  Globe,
  LayoutDashboard,
  Eye,
  Settings,
  ArrowRight,
  TrendingUp,
  BoxSelect,
  Package,
  History,
  Activity,
  CheckCircle2,
  FileText,
  DollarSign,
  Star,
  Quote
} from 'lucide-react';

const FADE_UP: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.6, 
      ease: [0.22, 1, 0.36, 1] 
    } 
  }
};

const STAGGER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function Home() {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [, navigate] = useLocation();
  const { t } = useTranslation();
  const showStaffLinks = PORTAL_MODE !== 'client';
  const showClientLinks = PORTAL_MODE !== 'staff';
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden font-sans">
      {/* Navigation */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? 'bg-background/80 backdrop-blur-lg border-b border-border/50 py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          <ENSLogo size="sm" href="/" />
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <button onClick={() => scrollTo('features')} className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.features')}</button>
            <button onClick={() => scrollTo('how-it-works')} className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.howItWorks')}</button>
            <button onClick={() => scrollTo('showcase')} className="text-muted-foreground hover:text-foreground transition-colors">{t('nav.showcase')}</button>
            <LanguageSwitcher />
            <ThemeToggle />
            {showStaffLinks && (
              <Button variant="ghost" className="rounded-full px-5 font-semibold border border-border/40" onClick={() => navigate('/team')} data-testid="btn-nav-team">
                {t('nav.staffPortal')}
              </Button>
            )}
            <Button variant="ghost" className="rounded-full px-5 font-semibold" onClick={() => navigate('/login')} data-testid="btn-nav-login">
              {t('common.logIn')}
            </Button>
            <Button className="rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:shadow-[0_0_30px_rgba(109,40,217,0.5)] transition-all" onClick={() => navigate('/login')} data-testid="btn-nav-start">
              {t('common.startDesigning')}
            </Button>
          </nav>

          <div className="md:hidden flex items-center gap-4">
            <ThemeToggle />
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2" data-testid="btn-mobile-menu">
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Navigation Drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 md:hidden"
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-0 h-full w-80 max-w-[90vw] bg-card/98 backdrop-blur-2xl border-l border-border/60 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/40">
                <ENSLogo size="sm" href="/" />
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-full hover:bg-muted/50 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1 p-4 flex-1 overflow-y-auto">
                {[
                  { label: t('nav.features'), id: 'features' },
                  { label: t('nav.howItWorks'), id: 'how-it-works' },
                  { label: t('nav.showcase'), id: 'showcase' },
                ].map(({ label, id }) => (
                  <button
                    key={id}
                    onClick={() => { scrollTo(id); setMobileMenuOpen(false); }}
                    className="text-left py-3 px-4 rounded-xl text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {label}
                  </button>
                ))}

                <div className="border-t border-border/40 mt-4 pt-4 px-4 flex items-center gap-4">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </nav>

              <div className="p-4 border-t border-border/40 space-y-2">
                {showStaffLinks && (
                  <Button variant="outline" className="w-full rounded-full h-11 font-semibold"
                    onClick={() => { navigate('/team'); setMobileMenuOpen(false); }}>
                    {t('nav.staffPortal')}
                  </Button>
                )}
                <Button variant="ghost" className="w-full rounded-full h-11 font-semibold"
                  onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}>
                  {t('common.logIn')}
                </Button>
                <Button className="w-full rounded-full h-11 font-semibold shadow-[0_0_15px_rgba(109,40,217,0.3)]"
                  onClick={() => { navigate('/login'); setMobileMenuOpen(false); }}>
                  {t('common.startDesigning')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-40 pb-0 md:pt-52 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-[0.04] dark:opacity-[0.12] -z-10" />
        {/* Multi-layer ambient glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-primary/20 blur-[140px] rounded-full pointer-events-none -z-10" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/8 blur-[100px] rounded-full pointer-events-none -z-10" />
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={STAGGER}
            >
              <motion.div variants={FADE_UP} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4" />
                <span>{t('home.hero.badge')}</span>
              </motion.div>
              
              <motion.h1 variants={FADE_UP} className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                {t('home.hero.titlePart1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 glow-text">{t('home.hero.titlePart2')}</span>
              </motion.h1>
              
              <motion.p variants={FADE_UP} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                {t('home.hero.subtitle')}
              </motion.p>
              
              <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Button size="lg" onClick={() => navigate('/login')} className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold shadow-[0_0_20px_rgba(109,40,217,0.4)] hover:shadow-[0_0_35px_rgba(109,40,217,0.6)] transition-all gap-2" data-testid="btn-hero-cta1">
                  {t('common.startDesigning')} <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold border-border/80 hover:bg-muted/50" data-testid="btn-hero-cta2">
                  {t('common.watchDemo')}
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Hero Stats (floating) */}
      <div className="container mx-auto px-6 mb-20 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('home.stats.projectProgress'), value: "84%", icon: TrendingUp, color: "text-blue-500" },
            { label: t('home.stats.boothDimensions'), value: "6m x 9m", icon: BoxSelect, color: "text-purple-500" },
            { label: t('home.stats.approvalStatus'), value: t('home.stats.pending'), icon: CheckCircle2, color: "text-yellow-500" },
            { label: t('home.stats.furnitureCount'), value: "18 items", icon: Package, color: "text-cyan-500" }
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-card/50 backdrop-blur-md border border-border/50 p-4 rounded-xl flex items-center gap-4 glow-box"
            >
              <div className={`p-2 rounded-lg bg-background/50 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
                <div className="text-sm font-bold">{stat.value}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Trusted By Strip ──────────────────────────────────── */}
      <div className="container mx-auto px-6 mb-8 relative z-20">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-6 border-y border-border/30">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 flex-shrink-0">
            {t('home.trustedBy')}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {['Global Exhibits Inc.', 'Exhibito Group', 'Milano Design Studio', 'ExpoVision GmbH', 'ShowCraft Asia', 'NordExpo'].map((name) => (
              <span key={name} className="text-sm font-bold text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors tracking-wide whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Demo Access Strip */}
      <div className="container mx-auto px-6 mb-16 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-card/60 backdrop-blur-md border border-primary/20 rounded-2xl p-6"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1">Try the platform instantly</p>
              <p className="text-sm text-muted-foreground">Jump directly into any dashboard — no account required for the demo.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {showStaffLinks && (
                <>
                  <Button size="sm" onClick={() => navigate('/chief')} className="gap-2 rounded-full px-5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30" variant="ghost" data-testid="btn-demo-chief">
                    <LayoutDashboard className="w-4 h-4" /> Chief Manager
                  </Button>
                  <Button size="sm" onClick={() => navigate('/pm')} className="gap-2 rounded-full px-5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30" variant="ghost" data-testid="btn-demo-pm">
                    <Settings className="w-4 h-4" /> Project Manager
                  </Button>
                  <Button size="sm" onClick={() => navigate('/pm/workspace')} className="gap-2 rounded-full px-5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30" variant="ghost" data-testid="btn-demo-workspace">
                    <Box className="w-4 h-4" /> 3D Workspace
                  </Button>
                </>
              )}
              {showClientLinks && (
                <Button size="sm" onClick={() => navigate('/client')} className="gap-2 rounded-full px-5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" variant="ghost" data-testid="btn-demo-client">
                  <Eye className="w-4 h-4" /> Client View
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Features */}
      <section id="features" className="py-24 bg-muted/10">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 uppercase tracking-tighter">System Comparison</h2>
            <p className="text-muted-foreground">Choose the framework that matches your client's brand and budget.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto mb-32">
            {/* Octanorm Card */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="relative group p-8 rounded-3xl border border-blue-500/20 bg-blue-500/5 backdrop-blur-xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -z-10" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Box className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-bold">OCTANORM</h3>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                The global standard for modular exhibitions. Practical, efficient, and highly customizable structure.
              </p>
              <ul className="space-y-3 mb-8">
                {["4mm Groove System", "Aluminum Extrusion", "Modular Flexibility", "Standard Panels"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-blue-400/80">
                    <Zap className="w-4 h-4" /> {item}
                  </li>
                ))}
              </ul>
              <div className="aspect-video rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-20" />
                <svg
                  viewBox="0 0 220 220"
                  className="w-40 h-40 text-blue-400/70 group-hover:scale-110 transition-transform"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="110" cy="110" r="27" stroke="currentColor" strokeWidth="10" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <g key={i} transform={`rotate(${i * 45} 110 110)`}>
                      <path
                        d="M110 78 L110 54 L96 40 L96 24 M124 40 L124 24 M96 24 H124"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                      <path
                        d="M102 77 L90 90 M118 77 L130 90"
                        stroke="currentColor"
                        strokeWidth="10"
                        strokeLinecap="square"
                        strokeLinejoin="miter"
                      />
                    </g>
                  ))}
                </svg>
              </div>
            </motion.div>

            {/* Maxima Card */}
            <motion.div 
              whileHover={{ y: -10 }}
              className="relative group p-8 rounded-3xl border border-purple-500/20 bg-purple-500/5 backdrop-blur-xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -z-10" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-3xl font-bold">MAXIMA</h3>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Premium architectural system for high-impact presence. Large spans and smooth, seamless finishes.
              </p>
              <ul className="space-y-3 mb-8">
                {["Large Format Spans", "Clean Geometry", "Premium Visuals", "Integrated Lighting"].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-purple-400/80">
                    <Zap className="w-4 h-4" /> {item}
                  </li>
                ))}
              </ul>
              <div className="aspect-video rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-20" />
                <div className="w-24 h-24 border-2 border-purple-400/50 rotate-45 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-16 h-16 border border-purple-400/30" />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('home.features.heading')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">{t('home.features.headingAccent')}</span></h2>
            <p className="text-muted-foreground">{t('home.features.subheading')}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {[
              { icon: <MonitorPlay className="w-6 h-6" />, title: "3D Booth Workspace", desc: "Real-time interactive editor with perspective controls." },
              { icon: <Box className="w-6 h-6" />, title: "Octanorm Support", desc: "Native modular snapping logic for standard system walls." },
              { icon: <Sparkles className="w-6 h-6" />, title: "Maxima Support", desc: "Architectural spans and premium structural components." },
              { icon: <MousePointer2 className="w-6 h-6" />, title: "Furniture Placement", desc: "Intelligent surface snapping for tables, chairs, and racks." },
              { icon: <Users className="w-6 h-6" />, title: "Client Collaboration", desc: "Live feedback loop between managers and clients." },
              { icon: <Save className="w-6 h-6" />, title: "Workspace Snapshots", desc: "Capture design states and instantly switch between them." },
              { icon: <History className="w-6 h-6" />, title: "Version History", desc: "Track changes across the entire design lifecycle." },
              { icon: <Activity className="w-6 h-6" />, title: "Approval Workflow", desc: "Streamlined sign-off process for structural designs." },
              { icon: <LayoutDashboard className="w-6 h-6" />, title: "Project Management", desc: "Comprehensive dashboard for tracking multiple shows." },
              { icon: <Eye className="w-6 h-6" />, title: "Live Monitoring", desc: "Chief managers can monitor all active workspaces." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-[0_0_20px_rgba(109,40,217,0.1)] group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-base font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-xs leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-64 h-64 bg-primary/5 blur-3xl -z-10" />
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From Brief to Build in 7 Steps</h2>
            <p className="text-muted-foreground">The most efficient workflow in the exhibition industry.</p>
          </div>

          <div className="max-w-4xl mx-auto relative">
            {/* Vertical Line */}
            <div className="absolute left-[20px] md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-transparent -translate-x-1/2" />
            
            <div className="space-y-12">
              {[
                { title: "Initial Brief", desc: "Define exhibition goals, floor space, and brand requirements.", icon: <FileText className="w-5 h-5" /> },
                { title: "Workspace Setup", desc: "Create a new project and set your base booth dimensions.", icon: <Settings className="w-5 h-5" /> },
                { title: "3D Construction", desc: "Build walls, fascias, and structural elements using Octanorm or Maxima.", icon: <Box className="w-5 h-5" /> },
                { title: "Furniture & Styling", desc: "Drag and drop items from our extensive library into your space.", icon: <Package className="w-5 h-5" /> },
                { title: "Client Review", desc: "Share a live link for clients to explore the booth in their browser.", icon: <Eye className="w-5 h-5" /> },
                { title: "Revision Cycle", desc: "Make adjustments in real-time based on client feedback and requests.", icon: <History className="w-5 h-5" /> },
                { title: "Final Approval", desc: "Get structural sign-off and export documentation for production.", icon: <CheckCircle2 className="w-5 h-5" /> }
              ].map((step, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className={`flex items-center gap-8 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                >
                  <div className="flex-1 hidden md:block" />
                  <div className="relative z-10 w-10 h-10 rounded-full bg-background border-2 border-primary flex items-center justify-center font-bold text-primary shadow-[0_0_15px_rgba(109,40,217,0.3)]">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors shadow-xl ${i % 2 === 0 ? 'md:text-left' : 'md:text-right'}`}>
                      <div className={`w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 ${i % 2 === 0 ? '' : 'md:ml-auto'}`}>
                        {step.icon}
                      </div>
                      <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                      <p className="text-muted-foreground text-sm">{step.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted by Industry Leaders</h2>
            <p className="text-muted-foreground">See how ENS is transforming exhibition delivery for top design firms.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { name: "Sarah Chen", role: "Creative Director", company: "Global Exhibits Inc.", quote: "ENS cut our design-to-approval time by 60%. The real-time 3D collaboration is a game changer for our international clients.", ref: "CES 2024", gradient: "from-primary to-blue-500" },
              { name: "Marcus Weber", role: "Head of Design", company: "Exhibito Group", quote: "Finally, a tool that understands Octanorm structural logic. We no longer worry about impossibilities during the design phase.", ref: "Hannover Messe", gradient: "from-blue-500 to-cyan-500" },
              { name: "Elena Rossi", role: "Studio Principal", company: "Milano Design Studio", quote: "The Maxima support is incredible. We build complex architectural stands that look premium and are technically accurate.", ref: "Salone del Mobile", gradient: "from-purple-500 to-pink-500" }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] transition-all flex flex-col group"
              >
                <div className="flex gap-1 mb-5">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <Quote className="w-8 h-8 text-primary/20 mb-4" />
                <p className="text-base mb-8 text-muted-foreground leading-relaxed flex-1">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${testimonial.gradient} flex-shrink-0`} />
                  <div>
                    <div className="font-bold text-sm">{testimonial.name}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role} · {testimonial.company}</div>
                    <div className="text-[10px] text-primary mt-0.5 font-mono tracking-wide">{testimonial.ref}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 bg-muted/5 border-t border-border/50">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 uppercase tracking-tighter">{t('home.pricing.heading')}</h2>
            <p className="text-muted-foreground">{t('home.pricing.subheading')}</p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-sm font-medium transition-colors ${!billingAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>Monthly</span>
            <button
              onClick={() => setBillingAnnual(v => !v)}
              className={`relative w-12 h-6 rounded-full border-2 transition-all duration-200 ${billingAnnual ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${billingAnnual ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors flex items-center gap-2 ${billingAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              Annual
              <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">Save 20%</span>
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                tier: "Starter", monthlyPrice: "$99", annualPrice: "$79",
                features: ["5 Active Projects", "Octanorm System", "Standard Furniture Library", "2 GB Storage", "Email Support"]
              },
              {
                tier: "Professional", monthlyPrice: "$299", annualPrice: "$239",
                features: ["Unlimited Projects", "Octanorm & Maxima", "Full Furniture Library", "Client Review Links", "Priority Support", "Advanced Analytics"], recommended: true
              },
              {
                tier: "Enterprise", monthlyPrice: "Custom", annualPrice: "Custom",
                features: ["White-label Client Links", "Custom Object Imports", "Full API Access", "Dedicated Success Manager", "99.9% SLA", "On-site Training"]
              }
            ].map((p, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -8 }}
                className={`p-8 rounded-3xl border flex flex-col ${p.recommended ? 'border-primary bg-primary/5 shadow-[0_0_40px_rgba(109,40,217,0.15)] relative' : 'border-border/50 bg-card'}`}
              >
                {p.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full uppercase tracking-widest shadow-lg">
                    {t('home.pricing.recommended')}
                  </div>
                )}
                <div className="text-xl font-bold mb-2">{p.tier}</div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-black">{billingAnnual ? p.annualPrice : p.monthlyPrice}</span>
                  {p.monthlyPrice !== 'Custom' && (
                    <span className="text-muted-foreground text-sm">{billingAnnual ? '/mo · billed annually' : t('home.pricing.perMonth')}</span>
                  )}
                </div>
                {p.monthlyPrice !== 'Custom' && billingAnnual && (
                  <p className="text-xs text-green-500 font-medium mb-6">
                    Save ${(parseInt(p.monthlyPrice.replace('$','')) - parseInt(p.annualPrice.replace('$',''))) * 12}/year
                  </p>
                )}
                {(p.monthlyPrice === 'Custom' || !billingAnnual) && <div className="mb-8" />}
                <ul className="space-y-3 mb-10 flex-1">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${p.recommended ? 'text-primary' : 'text-muted-foreground'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={p.recommended ? 'default' : 'outline'}
                  className={`mt-auto w-full rounded-xl h-12 font-bold ${p.recommended ? 'shadow-lg shadow-primary/20' : ''}`}
                  onClick={() => navigate('/signup')}
                >
                  {p.monthlyPrice === 'Custom' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Cinematic CTA */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        <div className="absolute inset-0 grid-pattern opacity-10" />
        <div className="container mx-auto px-6 relative text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-8 glow-text tracking-tighter">
              {t('home.cta.heading')}
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              {t('home.cta.subheading')}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" onClick={() => navigate('/login')} className="rounded-full px-12 h-16 text-lg font-bold shadow-[0_0_30px_rgba(109,40,217,0.5)]">
                {t('common.getAccess')}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/login')} className="rounded-full px-12 h-16 text-lg font-bold border-border">
                {t('common.contactSales')}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-border/50 bg-background pt-16 pb-8">
        <div className="container mx-auto px-6">
          {/* Main footer grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">
            {/* Brand column */}
            <div className="col-span-2">
              <div className="mb-4">
                <ENSLogo size="sm" href="/" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
                {t('home.footer.tagline')}
              </p>
              <div className="flex gap-3">
                {[
                  { label: 'LinkedIn', path: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z M2 9h4v12H2z M4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z' },
                  { label: 'Twitter', path: 'M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z' },
                  { label: 'Instagram', path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z' },
                ].map(s => (
                  <a key={s.label} href="#" aria-label={s.label}
                    className="w-8 h-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d={s.path} /></svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Platform links */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">{t('home.footer.platform')}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[t('home.footer.workspace'), t('home.footer.octanorm'), t('home.footer.maxima'), t('home.footer.furnitureLib'), t('home.footer.clientReview'), t('home.footer.apiAccess')].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">{t('home.footer.company')}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[t('home.footer.about'), t('home.footer.blog'), t('home.footer.careers'), t('home.footer.press'), t('home.footer.partners'), t('home.footer.contact')].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Support links */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">{t('home.footer.support')}</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[t('home.footer.docs'), t('home.footer.tutorials'), t('home.footer.releaseNotes'), t('home.footer.systemStatus'), t('home.footer.community')].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <div className="text-xs font-semibold mb-1">{t('home.footer.needHelp')}</div>
                <div className="text-[11px] text-muted-foreground mb-2">{t('home.footer.supportHours')}</div>
                <a href="mailto:support@ens.io" className="text-[11px] text-primary hover:underline">support@ens.io</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">{t('common.copyright', { year: new Date().getFullYear() })}</span>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
              {[t('home.footer.privacy'), t('home.footer.terms'), t('home.footer.security'), t('home.footer.cookies'), t('home.footer.gdpr')].map(l => (
                <a key={l} href="#" className="hover:text-primary transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
