import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ENSLogo } from '@/components/ENSLogo';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useLocation } from 'wouter';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ExhibitionCursorField } from '@/components/ExhibitionCursorField';
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
  LayoutDashboard,
  Eye,
  Settings,
  TrendingUp,
  BoxSelect,
  Package,
  History,
  Activity,
  CheckCircle2,
  FileText,
} from 'lucide-react';

/**
 * Sales enquiries route to the same published address as support (CS-08).
 * Previously "Contact Sales" navigated to /login, which promised a
 * conversation and delivered a password prompt.
 */
const SALES_CONTACT_HREF = 'mailto:support@ens.io?subject=Sales%20enquiry';

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

/**
 * Presentation-only values (CS-12).
 *
 * The copy for these sections lives in `home.*` translation keys. Icons,
 * gradients, and progress values are not translatable, so they stay here and
 * are zipped with the translated content by index. Keep the lengths in sync
 * with the corresponding arrays in `en.json`.
 */
const FEATURE_ICONS = [
  <MonitorPlay className="w-6 h-6" />,
  <Box className="w-6 h-6" />,
  <Sparkles className="w-6 h-6" />,
  <MousePointer2 className="w-6 h-6" />,
  <Users className="w-6 h-6" />,
  <Save className="w-6 h-6" />,
  <History className="w-6 h-6" />,
  <Activity className="w-6 h-6" />,
  <LayoutDashboard className="w-6 h-6" />,
  <Eye className="w-6 h-6" />,
];

const WORKFLOW_ICONS = [
  <FileText className="w-5 h-5" />,
  <Settings className="w-5 h-5" />,
  <Box className="w-5 h-5" />,
  <Package className="w-5 h-5" />,
  <Eye className="w-5 h-5" />,
  <History className="w-5 h-5" />,
  <CheckCircle2 className="w-5 h-5" />,
];

const ROLE_GRADIENTS = [
  'from-violet-600 to-indigo-600',
  'from-blue-600 to-cyan-500',
  'from-emerald-600 to-teal-500',
];

const SHOWCASE_ICONS = [LayoutDashboard, Box, Eye];

const SHOWCASE_PROGRESS = [72, 45, 88];

type LabelledItem = { title: string; desc: string };
type TeamRole = { role: string; headline: string; points: string[] };
type ShowcaseCard = { title: string; role: string; badge: string; metrics: string[] };
type PricingTier = { tier: string; features: string[] };

/**
 * Commercial figures stay in code — they are amounts, not copy, and must not
 * drift per locale. Tier names and feature lists come from `home.pricingTiers`.
 *
 * NOTE (CS-04): these tiers do not correspond to the plans implemented in
 * `artifacts/api-server/src/routes/billing.ts`, which bills starter/pro/
 * unlimited as a per-project client subscription. Resolve before launch.
 */
const PRICING_PLANS = [
  { monthlyPrice: '$99', annualPrice: '$79', monthlyPriceCents: 9900, annualPriceCents: 7900, recommended: false },
  { monthlyPrice: '$299', annualPrice: '$239', monthlyPriceCents: 29900, annualPriceCents: 23900, recommended: true },
  { monthlyPrice: 'Custom', annualPrice: 'Custom', monthlyPriceCents: null, annualPriceCents: null, recommended: false },
];

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [, navigate] = useLocation();
  const { t, i18n } = useTranslation();
  // CS-13: the drawer slides in from the inline-end edge, which is the left
  // side in Arabic. Tailwind logical utilities handle placement; the motion
  // offset has to be mirrored explicitly.
  const isRtl = i18n.dir() === 'rtl';
  const drawerOffscreen = isRtl ? '-100%' : '100%';
  const showStaffLinks = PORTAL_MODE !== 'client';
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  // Translated content (CS-12). Arrays come back via returnObjects.
  const octanormFeatures = t('home.systems.octanorm.features', { returnObjects: true }) as string[];
  const maximaFeatures = t('home.systems.maxima.features', { returnObjects: true }) as string[];
  const featureCards = t('home.featureCards', { returnObjects: true }) as LabelledItem[];
  const workflowSteps = t('home.workflow.steps', { returnObjects: true }) as LabelledItem[];
  const teamRoles = t('home.team.roles', { returnObjects: true }) as TeamRole[];
  const showcaseCards = t('home.showcase.cards', { returnObjects: true }) as ShowcaseCard[];
  const pricingTiers = t('home.pricingTiers', { returnObjects: true }) as PricingTier[];

  useEffect(() => {
    document.title = t('home.pageTitle');
  }, [t]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="ens-platform-landing ens-platform-client min-h-screen bg-background text-foreground overflow-x-hidden font-sans">
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
              initial={{ x: drawerOffscreen }}
              animate={{ x: 0 }}
              exit={{ x: drawerOffscreen }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute end-0 top-0 h-full w-80 max-w-[90vw] bg-card/98 backdrop-blur-2xl border-s border-border/60 shadow-2xl flex flex-col"
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
      <section className="ens-landing-hero ens-landing-hero-client relative pt-40 pb-0 md:pt-52 overflow-hidden">
        <ExhibitionCursorField variant="client" />
        <div className="absolute inset-0 grid-pattern opacity-[0.04] dark:opacity-[0.12] -z-10" />
        <div className="ens-landing-dimension absolute left-6 right-6 top-32 hidden md:flex" aria-hidden="true">
          <span>{t('home.dimensionLabel')}</span><i /><span>01</span>
        </div>
        
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={STAGGER}
            >
              <motion.div variants={FADE_UP} className="ens-landing-hero-badge inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20">
                <Sparkles className="w-4 h-4" />
                <span>{t('home.hero.badge')}</span>
              </motion.div>
              
              <motion.h1 variants={FADE_UP} className="ens-landing-hero-title text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-[1.1]">
                {t('home.hero.titlePart1')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500 glow-text">{t('home.hero.titlePart2')}</span>
              </motion.h1>
              
              <motion.p variants={FADE_UP} className="ens-landing-hero-copy text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
                {t('home.hero.subtitle')}
              </motion.p>
              
              <motion.div variants={FADE_UP} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <Button size="lg" onClick={() => navigate('/login')} className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold shadow-[0_0_20px_rgba(109,40,217,0.4)] hover:shadow-[0_0_35px_rgba(109,40,217,0.6)] transition-all gap-2" data-testid="btn-hero-cta1">
                  {t('common.startDesigning')} <ChevronRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => scrollTo('showcase')} className="w-full sm:w-auto rounded-full px-8 h-14 text-base font-semibold border-border/80 hover:bg-muted/50" data-testid="btn-hero-cta2">
                  {t('common.watchDemo')}
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Hero Stats (floating) — illustrative, not live data (CS-09) */}
      <div className="container mx-auto px-6 mb-20 relative z-20">
        <p className="text-center text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-3" data-testid="label-hero-stats-illustrative">
          {t('home.stats.illustrative')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('home.stats.projectProgress'), value: "84%", icon: TrendingUp, color: "text-blue-500" },
            { label: t('home.stats.boothDimensions'), value: "6m x 9m", icon: BoxSelect, color: "text-primary" },
            { label: t('home.stats.approvalStatus'), value: t('home.stats.pending'), icon: CheckCircle2, color: "text-yellow-500" },
            { label: t('home.stats.furnitureCount'), value: "18 items", icon: Package, color: "text-emerald-600 dark:text-emerald-400" }
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

      {/* ── Capabilities Strip ─────────────────────────────────── */}
      <div className="container mx-auto px-6 mb-8 relative z-20">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-6 border-y border-border/30">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 flex-shrink-0">
            {t('home.trustedBy')}
          </span>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              t('home.capabilityItems.octanorm'),
              t('home.capabilityItems.maxima'),
              t('home.capabilityItems.live3d'),
              t('home.capabilityItems.bom'),
              t('home.capabilityItems.approvals'),
              t('home.capabilityItems.languages'),
            ].map((name) => (
              <span key={name} className="text-sm font-bold text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors tracking-wide whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── For Agencies / White-label ─────────────────────────── */}
      <section className="container mx-auto px-6 mb-12 relative z-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto max-w-5xl rounded-3xl border border-primary/20 bg-primary/5 backdrop-blur-xl p-8 md:p-10"
        >
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
                {t('home.agency.kicker')}
              </p>
              <h2 className="mb-3 text-2xl md:text-3xl font-bold tracking-tight">
                {t('home.agency.title')}
              </h2>
              <p className="text-sm md:text-base text-muted-foreground">
                {t('home.agency.desc')}
              </p>
            </div>
            <ul className="space-y-3">
              {[t('home.agency.bullet1'), t('home.agency.bullet2'), t('home.agency.bullet3')].map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm text-foreground/90">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </section>


      {/* Features */}
      <section id="features" className="py-24 bg-muted/10">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 uppercase tracking-tighter">{t('home.systemComparison.heading')}</h2>
            <p className="text-muted-foreground">{t('home.systemComparison.subheading')}</p>
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
                <h3 className="text-3xl font-bold">{t('home.systems.octanorm.name')}</h3>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {t('home.systems.octanorm.desc')}
              </p>
              <ul className="space-y-3 mb-8">
                {octanormFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-blue-400/80">
                    <Zap className="w-4 h-4" /> {item}
                  </li>
                ))}
              </ul>
              {/* Animated Octanorm booth wireframe */}
              <div className="aspect-video rounded-xl bg-blue-500/8 border border-blue-500/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-15" />
                <motion.svg
                  viewBox="0 0 240 180"
                  className="w-52 h-40 text-blue-400"
                  fill="none"
                  aria-hidden="true"
                  whileHover={{ scale: 1.06 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Floor */}
                  <polygon points="20,140 120,160 220,140 120,120" stroke="currentColor" strokeWidth="1.2" fill="rgba(59,130,246,0.05)" />
                  {/* Back wall left panel */}
                  <polygon points="20,60 70,50 70,140 20,140" stroke="currentColor" strokeWidth="1.2" fill="rgba(59,130,246,0.06)" />
                  {/* Back wall right panel */}
                  <polygon points="70,50 170,50 170,140 70,140" stroke="currentColor" strokeWidth="1.2" fill="rgba(59,130,246,0.04)" />
                  {/* Side wing */}
                  <polygon points="170,50 220,60 220,140 170,140" stroke="currentColor" strokeWidth="1.2" fill="rgba(59,130,246,0.06)" />
                  {/* Ceiling / top fascia */}
                  <polygon points="20,60 70,50 170,50 220,60 170,30 70,30" stroke="currentColor" strokeWidth="1.2" fill="rgba(59,130,246,0.08)" />
                  {/* Upright columns */}
                  <line x1="70" y1="50" x2="70" y2="140" stroke="currentColor" strokeWidth="2" />
                  <line x1="170" y1="50" x2="170" y2="140" stroke="currentColor" strokeWidth="2" />
                  {/* Horizontal rail top */}
                  <line x1="20" y1="60" x2="220" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                  {/* Panel grid lines */}
                  <line x1="95" y1="50" x2="95" y2="140" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
                  <line x1="120" y1="50" x2="120" y2="140" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
                  <line x1="145" y1="50" x2="145" y2="140" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
                  <line x1="20" y1="95" x2="220" y2="95" stroke="currentColor" strokeWidth="0.7" opacity="0.35" />
                  {/* Counter */}
                  <rect x="80" y="108" width="40" height="32" rx="1" stroke="currentColor" strokeWidth="1.5" fill="rgba(59,130,246,0.1)" />
                  {/* Animated glow dot */}
                  <motion.circle cx="120" cy="55" r="3" fill="rgb(59,130,246)"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  {/* Corner connectors */}
                  {[[20,60],[70,50],[170,50],[220,60],[70,140],[170,140]].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="3" fill="currentColor" opacity="0.6" />
                  ))}
                </motion.svg>
                <div className="absolute bottom-2 right-3 text-[9px] text-blue-400/50 font-mono">OCTANORM 3D</div>
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
                <h3 className="text-3xl font-bold">{t('home.systems.maxima.name')}</h3>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                {t('home.systems.maxima.desc')}
              </p>
              <ul className="space-y-3 mb-8">
                {maximaFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-purple-400/80">
                    <Zap className="w-4 h-4" /> {item}
                  </li>
                ))}
              </ul>
              {/* Animated Maxima architectural arch */}
              <div className="aspect-video rounded-xl bg-purple-500/8 border border-purple-500/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 grid-pattern opacity-15" />
                <motion.svg
                  viewBox="0 0 240 180"
                  className="w-52 h-40 text-purple-400"
                  fill="none"
                  aria-hidden="true"
                  whileHover={{ scale: 1.06 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Floor plane */}
                  <polygon points="20,148 120,162 220,148 120,134" stroke="currentColor" strokeWidth="1.2" fill="rgba(168,85,247,0.04)" />
                  {/* Left tower */}
                  <rect x="20" y="50" width="36" height="98" stroke="currentColor" strokeWidth="1.5" fill="rgba(168,85,247,0.06)" />
                  {/* Right tower */}
                  <rect x="184" y="50" width="36" height="98" stroke="currentColor" strokeWidth="1.5" fill="rgba(168,85,247,0.06)" />
                  {/* Center span */}
                  <rect x="56" y="80" width="128" height="68" stroke="currentColor" strokeWidth="1.5" fill="rgba(168,85,247,0.04)" />
                  {/* Arch curve on top of span */}
                  <path d="M56,80 Q120,20 184,80" stroke="currentColor" strokeWidth="2" fill="rgba(168,85,247,0.08)" />
                  {/* Tower top caps */}
                  <rect x="16" y="44" width="44" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" fill="rgba(168,85,247,0.12)" />
                  <rect x="180" y="44" width="44" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" fill="rgba(168,85,247,0.12)" />
                  {/* Panel grid inside center */}
                  <line x1="56" y1="110" x2="184" y2="110" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
                  <line x1="92" y1="80" x2="92" y2="148" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
                  <line x1="148" y1="80" x2="148" y2="148" stroke="currentColor" strokeWidth="0.7" opacity="0.3" />
                  {/* Lighting strip at top of arch */}
                  <motion.path d="M60,82 Q120,24 180,82" stroke="rgba(168,85,247,0.8)" strokeWidth="1.5" fill="none"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 2.5, repeat: Infinity }} />
                  {/* Corner dots */}
                  {[[20,50],[56,50],[56,80],[184,80],[184,50],[220,50],[120,35]].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="2.5" fill="currentColor" opacity="0.5" />
                  ))}
                </motion.svg>
                <div className="absolute bottom-2 right-3 text-[9px] text-purple-400/50 font-mono">MAXIMA 3D</div>
              </div>
            </motion.div>
          </div>

          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('home.features.heading')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">{t('home.features.headingAccent')}</span></h2>
            <p className="text-muted-foreground">{t('home.features.subheading')}</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {featureCards.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all hover:shadow-[0_0_20px_rgba(109,40,217,0.1)] group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {FEATURE_ICONS[i]}
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('home.workflow.heading')}</h2>
            <p className="text-muted-foreground">{t('home.workflow.subheading')}</p>
          </div>

          <div className="max-w-4xl mx-auto relative">
            {/* Vertical Line */}
            <div className="absolute start-[20px] md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-border to-transparent -translate-x-1/2" />
            
            <div className="space-y-12">
              {workflowSteps.map((step, i) => (
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
                    <div className={`p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors shadow-xl ${i % 2 === 0 ? 'md:text-start' : 'md:text-end'}`}>
                      <div className={`w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4 ${i % 2 === 0 ? '' : 'md:ms-auto'}`}>
                        {WORKFLOW_ICONS[i]}
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

      {/* Why teams choose ENS */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('home.team.heading')}</h2>
            <p className="text-muted-foreground">{t('home.team.subheading')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {teamRoles.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-8 rounded-3xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.15)] transition-all flex flex-col group"
              >
                <div className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-gradient-to-r ${ROLE_GRADIENTS[i]} text-white mb-5 self-start`}>
                  {item.role}
                </div>
                <p className="text-lg font-semibold mb-5 leading-snug">{item.headline}</p>
                <ul className="space-y-3 flex-1">
                  {item.points.map((point, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-primary/60 flex-shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <section id="showcase" className="py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/10 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold uppercase tracking-widest text-primary mb-6">
              <Eye className="w-3.5 h-3.5" /> {t('nav.showcase')}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              {t('home.showcase.heading')}
            </h2>
            <p className="text-muted-foreground">
              {t('home.showcase.subheading')}
            </p>
            <p className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground/60" data-testid="label-showcase-illustrative">
              {t('home.showcase.illustrative')}
            </p>
          </motion.div>

          {/* Interface preview (CS-07). Labelled as a preview, not a live capture. */}
          <motion.figure
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-5xl mx-auto mb-16"
          >
            <div className="rounded-3xl border border-border/60 bg-card overflow-hidden shadow-2xl">
              <img
                src="/mockup-1.png"
                alt={t('home.showcase.previewAlt')}
                width={1685}
                height={998}
                loading="lazy"
                className="w-full h-auto block"
                data-testid="img-workspace-preview"
              />
            </div>
            <figcaption className="mt-3 text-center text-xs text-muted-foreground">
              {t('home.showcase.previewCaption')}
            </figcaption>
          </motion.figure>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {showcaseCards.map((item, i) => {
              const Icon = SHOWCASE_ICONS[i];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12 }}
                  whileHover={{ y: -6, scale: 1.01 }}
                  className="rounded-3xl border border-border/50 bg-card overflow-hidden group hover:border-primary/30 hover:shadow-[0_12px_40px_rgba(0,0,0,0.15)] transition-all"
                >
                  <div className={`h-2 bg-gradient-to-r ${ROLE_GRADIENTS[i]}`} />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ROLE_GRADIENTS[i]} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{item.role}</p>
                    <h3 className="text-lg font-bold mb-5">{item.title}</h3>
                    <div className="space-y-2">
                      {item.metrics.map((m, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-br ${ROLE_GRADIENTS[i]} flex-shrink-0`} />
                          {m}
                        </div>
                      ))}
                    </div>
                    <div className="mt-5 h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${ROLE_GRADIENTS[i]} transition-all duration-700`}
                        style={{ width: `${SHOWCASE_PROGRESS[i]}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-1.5">{t('home.showcase.percentComplete', { percent: SHOWCASE_PROGRESS[i] })}</p>
                  </div>
                </motion.div>
              );
            })}
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
            <span className={`text-sm font-medium transition-colors ${!billingAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>{t('home.billing.monthly')}</span>
            <button
              onClick={() => setBillingAnnual(v => !v)}
              className={`relative w-12 h-6 rounded-full border-2 transition-all duration-200 ${billingAnnual ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${billingAnnual ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
            <span className={`text-sm font-medium transition-colors flex items-center gap-2 ${billingAnnual ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('home.billing.annual')}
              <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">{t('home.billing.saveBadge')}</span>
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {PRICING_PLANS.map((p, i) => (
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
                <div className="text-xl font-bold mb-2">{pricingTiers[i]?.tier}</div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-black">{billingAnnual ? p.annualPrice : p.monthlyPrice}</span>
                  {p.monthlyPrice !== 'Custom' && (
                    <span className="text-muted-foreground text-sm">{billingAnnual ? t('home.billing.perMonthAnnual') : t('home.pricing.perMonth')}</span>
                  )}
                </div>
                {p.monthlyPriceCents !== null && billingAnnual && (
                  <p className="text-xs text-green-500 font-medium mb-6">
                    Save ${(((p.monthlyPriceCents ?? 0) - (p.annualPriceCents ?? 0)) * 12 / 100).toFixed(0)}/year
                  </p>
                )}
                {(p.monthlyPriceCents === null || !billingAnnual) && <div className="mb-8" />}
                <ul className="space-y-3 mb-10 flex-1">
                  {(pricingTiers[i]?.features ?? []).map((f, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${p.recommended ? 'text-primary' : 'text-muted-foreground'}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                {p.monthlyPrice === 'Custom' ? (
                  <Button
                    variant="outline"
                    asChild
                    className="mt-auto w-full rounded-xl h-12 font-bold"
                  >
                    <a href={SALES_CONTACT_HREF} data-testid="btn-pricing-contact-sales">{t('home.billing.contactSales')}</a>
                  </Button>
                ) : (
                  <Button
                    variant={p.recommended ? 'default' : 'outline'}
                    className={`mt-auto w-full rounded-xl h-12 font-bold ${p.recommended ? 'shadow-lg shadow-primary/20' : ''}`}
                    onClick={() => navigate('/signup')}
                  >
                    {t('home.billing.getStarted')}
                  </Button>
                )}
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
              <Button variant="outline" size="lg" asChild className="rounded-full px-12 h-16 text-lg font-bold border-border">
                <a href={SALES_CONTACT_HREF} data-testid="btn-contact-sales">{t('common.contactSales')}</a>
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
              {[
                { label: t('home.footer.privacy'), slug: 'privacy' },
                { label: t('home.footer.terms'), slug: 'terms' },
                { label: t('home.footer.security'), slug: 'security' },
                { label: t('home.footer.cookies'), slug: 'cookies' },
                { label: t('home.footer.gdpr'), slug: 'gdpr' },
              ].map(({ label, slug }) => (
                <a key={slug} href={`/${slug}`} className="hover:text-primary transition-colors" data-testid={`link-legal-${slug}`}>{label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
