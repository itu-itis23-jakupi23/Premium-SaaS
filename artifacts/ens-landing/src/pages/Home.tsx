import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence, Variants } from 'framer-motion';
import { useLocation } from 'wouter';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { 
  Box, 
  Layers, 
  Share2, 
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
  const [activeTab, setActiveTab] = useState('workspace');
  const [, navigate] = useLocation();

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
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl font-mono shadow-[0_0_15px_rgba(109,40,217,0.5)]">
              E
            </div>
            <span className="font-bold text-xl tracking-tight">ENS</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
            <a href="#showcase" className="text-muted-foreground hover:text-foreground transition-colors">Showcase</a>
            <ThemeToggle />
            <Button variant="ghost" className="rounded-full px-5 font-semibold border border-border/40" onClick={() => navigate('/team')} data-testid="btn-nav-team">
              Staff Portal
            </Button>
            <Button variant="ghost" className="rounded-full px-5 font-semibold" onClick={() => navigate('/login')} data-testid="btn-nav-login">
              Log In
            </Button>
            <Button className="rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:shadow-[0_0_30px_rgba(109,40,217,0.5)] transition-all" onClick={() => navigate('/login')} data-testid="btn-nav-start">
              Start Designing
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
                <span>The 3D design studio for the exhibition industry</span>
              </motion.div>
              
              <motion.h1 variants={FADE_UP} className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                Design Exhibition Booths in <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 glow-text">Real-Time 3D</span>
              </motion.h1>
              
              <motion.p variants={FADE_UP} className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                Build, customize, and manage Octanorm and Maxima stands directly in your browser. Professional tools for serious exhibition designers.
              </motion.p>
              
              <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Button size="lg" onClick={() => navigate('/login')} className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold shadow-[0_0_20px_rgba(109,40,217,0.4)] hover:shadow-[0_0_35px_rgba(109,40,217,0.6)] transition-all gap-2" data-testid="btn-hero-cta1">
                  Start Designing <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold border-border/80 hover:bg-muted/50" data-testid="btn-hero-cta2">
                  Watch Demo
                </Button>
              </motion.div>

              {/* ── Product Preview ── */}
              <motion.div
                variants={FADE_UP}
                className="relative"
              >
                <div className="absolute -inset-6 bg-primary/8 blur-3xl rounded-3xl -z-10 pointer-events-none" />
                <div className="rounded-2xl border border-border/60 bg-card/20 backdrop-blur-sm shadow-[0_40px_80px_rgba(0,0,0,0.6)] overflow-hidden">
                  {/* Browser chrome */}
                  <div className="h-10 bg-muted/50 border-b border-border/50 flex items-center gap-3 px-4">
                    <div className="flex gap-1.5 flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-red-500/70" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                      <div className="w-3 h-3 rounded-full bg-green-500/70" />
                    </div>
                    <div className="flex-1 flex justify-center">
                      <div className="bg-background/60 border border-border/40 rounded-md h-6 flex items-center px-3 gap-2 w-60">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                        <span className="text-[10px] text-muted-foreground font-mono truncate">app.ens.io/pm/workspace</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono hidden sm:block flex-shrink-0">TechCon 2024</span>
                  </div>
                  {/* Actual booth renderer */}
                  <div className="relative h-[480px] overflow-hidden bg-[#f0f2f5]">
                    <iframe
                      src="/booth-render.html?w=9&d=6&h=2.2&name=TECHCORP+INDUSTRIES&style=octa&open=front,left"
                      className="w-full h-full border-0"
                      style={{ pointerEvents: 'none' }}
                      title="ENS 3D Booth Preview"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-background via-background/60 to-transparent pointer-events-none" />
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Hero Stats (floating) */}
      <div className="container mx-auto px-6 -mt-10 mb-20 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Project Progress", value: "84%", icon: TrendingUp, color: "text-blue-500" },
            { label: "Booth Dimensions", value: "6m x 9m", icon: BoxSelect, color: "text-purple-500" },
            { label: "Approval Status", value: "Pending", icon: CheckCircle2, color: "text-yellow-500" },
            { label: "Furniture Count", value: "18 items", icon: Package, color: "text-cyan-500" }
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
            Trusted by
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
              <Button size="sm" onClick={() => navigate('/chief')} className="gap-2 rounded-full px-5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30" variant="ghost" data-testid="btn-demo-chief">
                <LayoutDashboard className="w-4 h-4" /> Chief Manager
              </Button>
              <Button size="sm" onClick={() => navigate('/pm')} className="gap-2 rounded-full px-5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30" variant="ghost" data-testid="btn-demo-pm">
                <Settings className="w-4 h-4" /> Project Manager
              </Button>
              <Button size="sm" onClick={() => navigate('/client')} className="gap-2 rounded-full px-5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" variant="ghost" data-testid="btn-demo-client">
                <Eye className="w-4 h-4" /> Client View
              </Button>
              <Button size="sm" onClick={() => navigate('/pm/workspace')} className="gap-2 rounded-full px-5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30" variant="ghost" data-testid="btn-demo-workspace">
                <Box className="w-4 h-4" /> 3D Workspace
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Interactive 3D Preview Mockup */}
      <section className="py-20 relative z-10">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden backdrop-blur-sm flex flex-col h-[600px] glow-box relative"
          >
            {/* Editor Topbar */}
            <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="text-sm font-mono text-muted-foreground bg-background/50 px-3 py-1 rounded-md border border-border/50 flex items-center gap-2">
                  <Layers className="w-3 h-3" /> booth-layout-v2.ens
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="h-8 w-8"><Share2 className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8"><Save className="w-4 h-4" /></Button>
                <Button size="sm" className="h-8 rounded-full bg-primary/20 text-primary hover:bg-primary/30">Export</Button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Editor Sidebar */}
              <div className="w-64 border-r border-border/50 bg-muted/10 p-4 hidden md:block overflow-y-auto">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Components</div>
                <div className="space-y-2">
                  {['Octanorm Wall', 'Maxima Post', 'Fascia Panel', 'Display Counter', 'Spotlight', 'Literature Rack'].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border/50 transition-colors">
                      <Box className="w-4 h-4 text-primary" />
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Materials</div>
                <div className="grid grid-cols-4 gap-2">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="w-full aspect-square rounded bg-muted border border-border hover:border-primary/50 cursor-pointer" />
                  ))}
                </div>
              </div>

              {/* 3D Canvas Area */}
              <div className="flex-1 relative bg-black/5 dark:bg-black/20 overflow-hidden flex items-center justify-center grid-pattern perspective-[1000px]">
                
                {/* Simulated 3D Booth */}
                <motion.div 
                  className="wireframe-box w-64 h-64 relative"
                  animate={{ 
                    rotateY: [0, 360],
                    rotateX: [10, 20, 10]
                  }}
                  transition={{ 
                    rotateY: { duration: 20, repeat: Infinity, ease: "linear" },
                    rotateX: { duration: 10, repeat: Infinity, ease: "easeInOut" }
                  }}
                >
                  {/* Floor */}
                  <div className="wireframe-face w-64 h-64 absolute -bottom-32 left-0 rotate-x-90 bg-primary/10 border-primary/30" />
                  
                  {/* Back Wall */}
                  <div className="wireframe-face w-64 h-48 absolute bottom-0 left-0 -translate-z-32 bg-primary/5" />
                  
                  {/* Left Wall */}
                  <div className="wireframe-face w-32 h-48 absolute bottom-0 left-0 -rotate-y-90 origin-left bg-primary/5" />
                  
                  {/* Structure Pillars */}
                  <div className="absolute bottom-0 left-0 w-2 h-48 bg-primary/40 -translate-z-32 shadow-[0_0_10px_rgba(109,40,217,0.5)]" />
                  <div className="absolute bottom-0 right-0 w-2 h-48 bg-primary/40 -translate-z-32 shadow-[0_0_10px_rgba(109,40,217,0.5)]" />
                  <div className="absolute bottom-0 left-0 w-2 h-48 bg-primary/40 translate-z-32 shadow-[0_0_10px_rgba(109,40,217,0.5)]" />
                  
                  {/* Header/Fascia */}
                  <div className="wireframe-face w-64 h-8 absolute top-0 left-0 -translate-z-32 bg-primary/20 backdrop-blur-md border-primary/50 flex items-center justify-center">
                    <span className="text-[8px] font-mono text-primary-foreground opacity-50">YOUR LOGO</span>
                  </div>
                  
                  {/* Counter */}
                  <div className="wireframe-face w-24 h-16 absolute bottom-0 left-10 translate-z-16 bg-blue-500/10 border-blue-500/30" />
                </motion.div>

                {/* Floating UI Overlays */}
                <motion.div 
                  className="absolute top-6 right-6 bg-background/80 backdrop-blur-md border border-border/50 rounded-lg p-4 shadow-xl w-48"
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <div className="text-xs font-semibold mb-3">Properties: Wall Panel</div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-[10px] mb-1 text-muted-foreground"><span>Width</span><span>2950mm</span></div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full w-3/4 bg-primary rounded-full" /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] mb-1 text-muted-foreground"><span>Height</span><span>2400mm</span></div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden"><div className="h-full w-full bg-primary rounded-full" /></div>
                    </div>
                  </div>
                </motion.div>
                
              </div>
            </div>
          </motion.div>
        </div>
      </section>

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
                <div className="w-24 h-24 border-2 border-blue-400/50 rotate-45 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <div className="w-16 h-16 border border-blue-400/30" />
                </div>
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
                <div className="w-32 h-16 bg-purple-400/20 border border-purple-400/50 rounded flex items-center justify-center group-hover:scale-110 transition-transform">
                   <div className="w-full h-[2px] bg-purple-400/30" />
                </div>
              </div>
            </motion.div>
          </div>

          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Precision Engineering for Exhibition Spaces</h2>
            <p className="text-muted-foreground">Built specifically for the nuances of trade show design. Move beyond rigid CAD software and flimsy drawing tools.</p>
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

      {/* Workspace Preview Section */}
      <section className="py-24 bg-black/40 relative overflow-hidden border-y border-border/50">
        <div className="absolute inset-0 grid-pattern opacity-10" />
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Professional Design Environment</h2>
            <p className="text-muted-foreground">A clean, technical interface designed for high-performance booth planning.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-xl border border-border/50 bg-background shadow-2xl overflow-hidden flex flex-col aspect-[16/10] max-w-6xl mx-auto"
          >
            {/* Toolbar */}
            <div className="h-12 border-b border-border/50 bg-muted/30 flex items-center justify-between px-4">
              <div className="flex items-center gap-6">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/50" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                  <div className="w-3 h-3 rounded-full bg-green-500/50" />
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Button variant="ghost" size="sm" className="h-7 px-2">Save</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2">Undo</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2">Redo</Button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-primary">Snapshot</Button>
                  <Button size="sm" className="h-7 px-3 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30">Send to Client</Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono">
                <span>PROJECT: TECH_CON_2024</span>
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Panel: Furniture */}
              <div className="w-56 border-r border-border/50 bg-muted/10 p-4 flex flex-col">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center justify-between">
                  <span>Furniture Library</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
                <div className="space-y-4">
                  {['Counters', 'Seating', 'Display', 'Lighting'].map((cat, i) => (
                    <div key={i}>
                      <div className="text-[9px] font-bold uppercase text-primary mb-2 tracking-widest">{cat}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2].map(j => (
                          <div key={j} className="aspect-square rounded border border-border bg-background/50 flex flex-col items-center justify-center gap-1 hover:border-primary/50 cursor-pointer transition-colors">
                            <Box className="w-4 h-4 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground">Item {i}{j}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Center Canvas */}
              <div className="flex-1 relative bg-black/50 overflow-hidden flex items-center justify-center perspective-[1200px]">
                <div className="absolute inset-0 grid-pattern opacity-20" />
                
                {/* 3D Booth Wireframe Simulation */}
                <div className="relative w-[500px] h-[350px] transform-gpu rotate-x-12 rotate-y-[-20deg] preserve-3d">
                  {/* Floor Grid */}
                  <div className="absolute inset-0 border border-primary/20 bg-primary/5 grid-pattern rotate-x-90 translate-y-[175px]" />
                  
                  {/* Walls */}
                  <div className="absolute bottom-[175px] left-0 w-full h-[200px] border border-primary/30 bg-primary/5 transform-gpu -translate-z-[250px]" />
                  <div className="absolute bottom-[175px] left-0 w-[500px] h-[200px] border border-primary/30 bg-primary/5 transform-gpu rotate-y-90 origin-left" />
                  
                  {/* Fascia */}
                  <div className="absolute top-0 left-0 w-full h-10 border border-primary/40 bg-primary/20 backdrop-blur-md flex items-center justify-center transform-gpu -translate-z-[100px]">
                    <span className="text-xs font-mono text-primary-foreground opacity-30">ENS PLATFORM</span>
                  </div>

                  {/* Placed Items */}
                  <div className="absolute bottom-[175px] left-20 w-32 h-20 border border-blue-500/50 bg-blue-500/10 transform-gpu translate-z-20" />
                  <div className="absolute bottom-[175px] right-20 w-20 h-40 border border-purple-500/50 bg-purple-500/10 transform-gpu -translate-z-40" />
                </div>

                {/* Compass UI */}
                <div className="absolute bottom-6 left-6 flex flex-col gap-2">
                  <div className="flex gap-2">
                    {['Front', 'Top', 'Side'].map(view => (
                      <button key={view} className="px-3 py-1 bg-background/50 border border-border text-[9px] rounded hover:bg-primary/20 transition-colors uppercase font-bold">{view}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Panel: Properties */}
              <div className="w-64 border-l border-border/50 bg-muted/10 p-4">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-6">Properties Panel</div>
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="text-[9px] font-bold uppercase text-primary">Dimensions</div>
                    <div className="grid grid-cols-2 gap-2">
                      {['Width', 'Depth', 'Height'].map(dim => (
                        <div key={dim}>
                          <label className="text-[8px] text-muted-foreground block mb-1">{dim}</label>
                          <div className="h-7 bg-background border border-border rounded flex items-center px-2 text-[10px] font-mono">6000mm</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-[9px] font-bold uppercase text-primary">System Type</div>
                    <div className="flex gap-2">
                      <button className="flex-1 h-8 rounded border-2 border-primary bg-primary/10 text-[9px] font-bold">MAXIMA</button>
                      <button className="flex-1 h-8 rounded border border-border bg-background text-[9px] font-bold text-muted-foreground">OCTANORM</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-[9px] font-bold uppercase text-primary">Selected Object</div>
                    <div className="p-3 bg-background border border-border rounded space-y-2">
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Type</span>
                        <span>Aluminum Post</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Material</span>
                        <span>Brushed Silver</span>
                      </div>
                      <div className="flex justify-between text-[9px]">
                        <span className="text-muted-foreground">Position</span>
                        <span className="font-mono">X: 1200, Y: 0</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
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
              { name: "Sarah Chen", company: "Global Exhibits Inc.", quote: "ENS has cut our design-to-approval time by 60%. The real-time 3D collaboration is a game changer for our international clients.", ref: "CES 2024" },
              { name: "Marcus Weber", company: "Exhibito Group", quote: "Finally, a tool that understands Octanorm structural logic. We no longer worry about structural impossibilities during the design phase.", ref: "Hannover Messe" },
              { name: "Elena Rossi", company: "Milano Design Studio", quote: "The Maxima support is incredible. We can build complex architectural stands that look premium and are technically accurate.", ref: "Salone del Mobile" }
            ].map((t, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl border border-border/50 bg-card hover:border-primary/30 transition-all flex flex-col"
              >
                <Quote className="w-10 h-10 text-primary/20 mb-6" />
                <p className="text-lg mb-8 italic text-muted-foreground leading-relaxed">"{t.quote}"</p>
                <div className="mt-auto flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-blue-500" />
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.company}</div>
                    <div className="text-[10px] text-primary mt-1 font-mono">{t.ref}</div>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4 uppercase tracking-tighter">Pricing Tiers</h2>
            <p className="text-muted-foreground">Scale your exhibition business with the right plan.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { tier: "Starter", price: "$99", features: ["5 Active Projects", "Octanorm Only", "Standard Library", "Email Support"] },
              { tier: "Professional", price: "$299", features: ["Unlimited Projects", "Octanorm & Maxima", "Full Furniture Library", "Client Review Links", "Priority Support"], recommended: true },
              { tier: "Enterprise", price: "Custom", features: ["White-label Links", "Custom Object Imports", "API Access", "Dedicated Success Manager", "SLA Support"] }
            ].map((p, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10 }}
                className={`p-8 rounded-3xl border flex flex-col ${p.recommended ? 'border-primary bg-primary/5 shadow-[0_0_40px_rgba(109,40,217,0.15)] relative' : 'border-border/50 bg-card'}`}
              >
                {p.recommended && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full uppercase tracking-widest">
                    Recommended
                  </div>
                )}
                <div className="text-xl font-bold mb-2">{p.tier}</div>
                <div className="flex items-baseline gap-1 mb-8">
                  <span className="text-4xl font-bold">{p.price}</span>
                  {p.price !== 'Custom' && <span className="text-muted-foreground text-sm">/mo</span>}
                </div>
                <ul className="space-y-4 mb-10">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className={`w-4 h-4 ${p.recommended ? 'text-primary' : 'text-muted-foreground'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button variant={p.recommended ? 'default' : 'outline'} className={`mt-auto w-full rounded-xl h-12 font-bold ${p.recommended ? 'shadow-lg' : ''}`}>
                  Get Started
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
              Start building your booth today
            </h2>
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              Join the future of exhibition design. Create, collaborate, and close deals faster than ever before.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <Button size="lg" onClick={() => navigate('/login')} className="rounded-full px-12 h-16 text-lg font-bold shadow-[0_0_30px_rgba(109,40,217,0.5)]">
                Get Access Now
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/login')} className="rounded-full px-12 h-16 text-lg font-bold border-border">
                Contact Sales
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
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg font-mono shadow-[0_0_12px_rgba(109,40,217,0.4)]">E</div>
                <span className="font-bold text-lg tracking-tight">ENS Platform</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
                The professional 3D booth design platform for the global exhibition and trade show industry.
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
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Platform</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['3D Workspace', 'Octanorm System', 'Maxima System', 'Furniture Library', 'Client Review', 'API Access'].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Company links */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Company</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['About ENS', 'Blog', 'Careers', 'Press Kit', 'Partners', 'Contact'].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>

            {/* Support links */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-4">Support</div>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {['Documentation', 'Tutorials', 'Release Notes', 'System Status', 'Community'].map(l => (
                  <li key={l}><a href="#" className="hover:text-foreground transition-colors">{l}</a></li>
                ))}
              </ul>
              <div className="mt-6 p-3 rounded-xl bg-primary/5 border border-primary/15">
                <div className="text-xs font-semibold mb-1">Need help?</div>
                <div className="text-[11px] text-muted-foreground mb-2">Mon–Fri, 9am–6pm CET</div>
                <a href="mailto:support@ens.io" className="text-[11px] text-primary hover:underline">support@ens.io</a>
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">© {new Date().getFullYear()} ENS Expo Solutions Ltd. All rights reserved.</span>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted-foreground">
              {['Privacy Policy', 'Terms of Service', 'Security', 'Cookie Policy', 'GDPR'].map(l => (
                <a key={l} href="#" className="hover:text-primary transition-colors">{l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}