import React, { useState, useEffect } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
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
  ArrowRight
} from 'lucide-react';

const FADE_UP = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
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
            <Button className="rounded-full px-6 font-semibold shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:shadow-[0_0_30px_rgba(109,40,217,0.5)] transition-all">
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
      <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-[0.03] dark:opacity-[0.1] -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
        
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
              
              <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold shadow-[0_0_20px_rgba(109,40,217,0.3)] hover:shadow-[0_0_30px_rgba(109,40,217,0.5)] transition-all gap-2" data-testid="btn-hero-cta1">
                  Start Designing <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold border-border hover:bg-muted/50" data-testid="btn-hero-cta2">
                  Book a Demo
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Precision Engineering for Exhibition Spaces</h2>
            <p className="text-muted-foreground">Built specifically for the nuances of trade show design. Move beyond rigid CAD software and flimsy drawing tools.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <MonitorPlay className="w-6 h-6" />, title: "Real-time 3D editor", desc: "Experience fluid performance directly in your browser. No downloads, no heavy rendering times." },
              { icon: <Layers className="w-6 h-6" />, title: "Octanorm & Maxima", desc: "Native support for industry-standard systems. Snapping logic built for real-world structural integrity." },
              { icon: <MousePointer2 className="w-6 h-6" />, title: "Drag & drop objects", desc: "Extensive library of furniture, lighting, and accessories. Place items with intelligent surface snapping." },
              { icon: <Users className="w-6 h-6" />, title: "Client & project management", desc: "Organize briefs, floor plans, and assets in one unified workspace per client." },
              { icon: <Save className="w-6 h-6" />, title: "Save and load designs", desc: "Version control for your booths. Re-use successful layouts across different shows." },
              { icon: <Share2 className="w-6 h-6" />, title: "Interactive Sharing", desc: "Send clients a link to explore the 3D model themselves. Stop sending static PDFs." }
            ].map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-colors group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="w-full md:w-1/2">
              <h2 className="text-3xl md:text-4xl font-bold mb-6">From Brief to Build in Minutes</h2>
              <p className="text-muted-foreground mb-10 text-lg">Streamline your workflow. ENS provides a seamless transition from initial concept to client approval.</p>
              
              <div className="space-y-8">
                {[
                  { step: "01", title: "Create Booth Parameters", desc: "Input the floor space dimensions and select your base system." },
                  { step: "02", title: "Customize Structure", desc: "Snap walls, fascias, and counters together. Add custom graphics." },
                  { step: "03", title: "Share with Clients", desc: "Generate a secure link for clients to review the 3D model." }
                ].map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                    className="flex gap-6"
                  >
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center font-mono font-bold text-sm">
                        {item.step}
                      </div>
                      {i !== 2 && <div className="w-px h-full bg-border mt-2" />}
                    </div>
                    <div className="pb-8">
                      <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            
            <div className="w-full md:w-1/2">
              <div className="relative rounded-2xl overflow-hidden border border-border/50 aspect-square bg-muted/20 flex items-center justify-center p-8">
                <div className="absolute inset-0 grid-pattern opacity-[0.05]" />
                {/* Abstract visual for workflow */}
                <div className="relative w-full h-full">
                  <motion.div 
                    className="absolute top-1/4 left-1/4 w-32 h-32 rounded-lg border border-primary/40 bg-primary/5 backdrop-blur-sm"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                  <motion.div 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-500/40 bg-blue-500/5 backdrop-blur-sm flex items-center justify-center"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Zap className="w-8 h-8 text-blue-500/50" />
                  </motion.div>
                  <motion.div 
                    className="absolute bottom-1/4 right-1/4 w-40 h-24 rounded-lg border border-purple-500/40 bg-purple-500/5 backdrop-blur-sm"
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                  />
                  
                  {/* Connecting lines */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ filter: 'drop-shadow(0 0 4px rgba(109,40,217,0.3))' }}>
                    <path d="M 30% 35% L 50% 50% L 70% 65%" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" className="text-primary/40" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <section id="showcase" className="py-24 bg-card border-y border-border/50 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">A Workspace for Every Stakeholder</h2>
            <p className="text-muted-foreground">ENS connects the entire exhibition lifecycle, from internal admin management to client-facing approvals.</p>
          </div>

          <div className="flex flex-col items-center">
            {/* Tabs */}
            <div className="flex bg-muted/50 p-1 rounded-full border border-border/50 mb-12">
              {[
                { id: 'workspace', label: '3D Workspace', icon: <Layers className="w-4 h-4 mr-2" /> },
                { id: 'admin', label: 'Admin Dashboard', icon: <LayoutDashboard className="w-4 h-4 mr-2" /> },
                { id: 'client', label: 'Client View', icon: <Eye className="w-4 h-4 mr-2" /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`tab-${tab.id}`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            <div className="w-full max-w-5xl relative aspect-video md:aspect-[16/9]">
              <AnimatePresence mode="wait">
                {activeTab === 'workspace' && (
                  <motion.div
                    key="workspace"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 rounded-xl border border-border/50 bg-background/50 overflow-hidden shadow-2xl flex flex-col"
                  >
                    <div className="h-10 bg-muted/30 border-b border-border/50 flex items-center px-4 justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-border" /><div className="w-2.5 h-2.5 rounded-full bg-border" /><div className="w-2.5 h-2.5 rounded-full bg-border" /></div>
                        <span className="text-xs text-muted-foreground ml-4">workspace.ens.app</span>
                      </div>
                    </div>
                    <div className="flex-1 bg-black/10 relative p-8 flex items-center justify-center">
                      <div className="absolute inset-0 grid-pattern opacity-10" />
                      <div className="relative w-64 h-64 border-2 border-primary/20 bg-primary/5 rounded-lg flex items-center justify-center transform -rotate-12 skew-x-12 shadow-[0_20px_50px_rgba(109,40,217,0.15)]">
                        <Box className="w-16 h-16 text-primary opacity-50" />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <div className="w-4 h-4 bg-primary/30 rounded" />
                          <div className="w-4 h-4 bg-blue-500/30 rounded" />
                        </div>
                      </div>
                      <div className="absolute left-4 top-4 bottom-4 w-48 bg-background border border-border/50 rounded-lg p-4">
                        <div className="h-4 w-20 bg-muted rounded mb-4" />
                        <div className="space-y-2">
                          {[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-muted/50 rounded" />)}
                        </div>
                      </div>
                      <div className="absolute right-4 top-4 w-48 bg-background border border-border/50 rounded-lg p-4">
                        <div className="h-4 w-24 bg-muted rounded mb-4" />
                        <div className="h-32 bg-muted/30 rounded border border-border" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'admin' && (
                  <motion.div
                    key="admin"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 rounded-xl border border-border/50 bg-background overflow-hidden shadow-2xl flex flex-col"
                  >
                    <div className="h-12 border-b border-border/50 flex items-center px-4 gap-4">
                      <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center"><LayoutDashboard className="w-3 h-3 text-primary" /></div>
                      <span className="text-sm font-medium">Projects Dashboard</span>
                    </div>
                    <div className="flex-1 flex">
                      <div className="w-48 border-r border-border/50 p-4 space-y-2">
                        <div className="h-8 bg-primary/10 rounded flex items-center px-3"><span className="text-xs text-primary">All Projects</span></div>
                        <div className="h-8 hover:bg-muted/50 rounded flex items-center px-3"><span className="text-xs text-muted-foreground">Team</span></div>
                        <div className="h-8 hover:bg-muted/50 rounded flex items-center px-3"><span className="text-xs text-muted-foreground">Settings</span></div>
                      </div>
                      <div className="flex-1 p-6">
                        <div className="flex gap-4 mb-6">
                          <div className="flex-1 h-24 rounded-xl border border-border/50 bg-muted/20 p-4"><div className="text-xs text-muted-foreground">Active Booths</div><div className="text-2xl font-bold mt-2">14</div></div>
                          <div className="flex-1 h-24 rounded-xl border border-border/50 bg-muted/20 p-4"><div className="text-xs text-muted-foreground">Pending Review</div><div className="text-2xl font-bold mt-2">3</div></div>
                          <div className="flex-1 h-24 rounded-xl border border-border/50 bg-muted/20 p-4"><div className="text-xs text-muted-foreground">Total Assets</div><div className="text-2xl font-bold mt-2">842</div></div>
                        </div>
                        <div className="h-48 border border-border/50 rounded-xl bg-muted/10 p-4">
                          <div className="space-y-3">
                            {[1,2,3].map(i => (
                              <div key={i} className="h-10 bg-background border border-border/50 rounded flex items-center px-4 justify-between">
                                <div className="flex items-center gap-3"><div className="w-6 h-6 rounded bg-muted" /><div className="h-3 w-32 bg-muted rounded" /></div>
                                <div className="h-5 w-16 bg-primary/10 rounded-full" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'client' && (
                  <motion.div
                    key="client"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 rounded-xl border border-border/50 bg-background overflow-hidden shadow-2xl flex flex-col"
                  >
                    <div className="flex-1 relative flex items-center justify-center bg-black/5">
                      {/* Client Viewer Simulation */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 pointer-events-none" />
                      <div className="w-64 h-64 border border-primary/30 bg-primary/5 rounded-lg flex items-center justify-center transform rotate-6 shadow-xl backdrop-blur-sm">
                         <span className="text-primary/40 font-mono text-sm tracking-widest">Interactive Review</span>
                      </div>
                      
                      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-md border border-border/50 rounded-full px-6 py-3 flex gap-6 items-center shadow-lg">
                        <div className="flex items-center gap-2"><Eye className="w-4 h-4 text-muted-foreground" /><span className="text-sm">Orbit Mode</span></div>
                        <div className="w-px h-4 bg-border" />
                        <Button size="sm" className="h-8 rounded-full">Approve Design</Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-full">Add Comment</Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute left-0 top-0 w-1/3 h-full bg-gradient-to-r from-primary/5 to-transparent -z-10" />
        
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="text-4xl font-bold text-primary mb-4 glow-text">3x</div>
              <h3 className="text-xl font-semibold mb-2">Faster design process</h3>
              <p className="text-muted-foreground text-sm">Stop fighting generic tools. Use components built specifically for your systems.</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="text-4xl font-bold text-blue-500 mb-4 glow-text">100%</div>
              <h3 className="text-xl font-semibold mb-2">Better collaboration</h3>
              <p className="text-muted-foreground text-sm">Clients understand 3D immediately. Reduce revisions caused by misinterpreting 2D plans.</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="text-4xl font-bold text-purple-500 mb-4 glow-text">Pro</div>
              <h3 className="text-xl font-semibold mb-2">Professional results</h3>
              <p className="text-muted-foreground text-sm">Export clean, accurate part lists and high-quality renders for production.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32 relative overflow-hidden border-t border-border/50">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[500px] bg-primary/20 blur-[150px] pointer-events-none -z-10" />
        
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to upgrade your studio?</h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">Join the industry leaders designing the next generation of exhibition spaces.</p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto rounded-full px-10 h-14 text-base font-semibold shadow-[0_0_20px_rgba(109,40,217,0.4)] hover:shadow-[0_0_40px_rgba(109,40,217,0.6)] transition-all" data-testid="btn-footer-cta1">
              Start Designing Now
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-full px-10 h-14 text-base font-semibold bg-background/50 backdrop-blur-sm" data-testid="btn-footer-cta2">
              Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 bg-muted/20">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm font-mono">
              E
            </div>
            <span className="font-bold tracking-tight">ENS Studio</span>
          </div>
          
          <div className="flex gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
          </div>
          
          <div className="text-sm text-muted-foreground">
            © 2025 ENS Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}