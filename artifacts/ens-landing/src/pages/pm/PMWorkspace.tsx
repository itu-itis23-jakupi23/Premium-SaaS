import { useState, useCallback } from "react";
import { Link } from "wouter";
import { Booth3D } from "@/components/workspace/Booth3D";
import type { BoothSystem } from "@/components/workspace/BoothCanvas";
import {
  Layers, Layout, Maximize, Save, Undo2, Redo2, Camera, History,
  Send, ZoomIn, ZoomOut, ChevronRight, Plus, Lightbulb,
  Table as TableIcon, Columns as Wall, Square, Settings as SettingsIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ─────────────────────────────────────────────────────────────────
// Theme system
// ─────────────────────────────────────────────────────────────────
type ThemeName = 'dark' | 'light' | 'warm' | 'ocean';

interface ThemeCfg {
  label: string;
  swatch: string;
  outerBg: string;
  canvasBg: string;
  panelBg: string;
  headerBg: string;
  border: string;
  cardBg: string;
  inputBg: string;
  inputBorder: string;
  text: string;
  textMuted: string;
  textLabel: string;
  sep: string;
  glass: boolean;
  accent: string;
  accentFg: string;
}

const THEMES: Record<ThemeName, ThemeCfg> = {
  dark: {
    label: 'Dark', swatch: '#1a1e2c',
    outerBg: '#0a0a0c', canvasBg: '#080d18',
    panelBg: 'rgba(10,12,20,0.88)', headerBg: 'rgba(10,12,20,0.75)',
    border: 'rgba(255,255,255,0.06)', cardBg: 'rgba(255,255,255,0.04)',
    inputBg: 'rgba(255,255,255,0.05)', inputBorder: 'rgba(255,255,255,0.10)',
    text: '#e2e8f0', textMuted: '#64748b', textLabel: '#94a3b8',
    sep: 'rgba(255,255,255,0.05)',
    glass: true, accent: '#6366f1', accentFg: '#818cf8',
  },
  light: {
    label: 'Light', swatch: '#f0f2f5',
    outerBg: '#f0f2f5', canvasBg: '#e4e8ef',
    panelBg: '#ffffff', headerBg: '#ffffff',
    border: '#e2e5ea', cardBg: '#f5f7fa',
    inputBg: '#f8f9fb', inputBorder: '#d4d8e0',
    text: '#1e2530', textMuted: '#6b7380', textLabel: '#8a929e',
    sep: '#e8eaee',
    glass: false, accent: '#4f46e5', accentFg: '#4f46e5',
  },
  warm: {
    label: 'Warm', swatch: '#1c1008',
    outerBg: '#120e08', canvasBg: '#0e0a04',
    panelBg: 'rgba(30,18,8,0.92)', headerBg: 'rgba(30,18,8,0.80)',
    border: 'rgba(251,180,60,0.09)', cardBg: 'rgba(251,180,60,0.05)',
    inputBg: 'rgba(251,180,60,0.05)', inputBorder: 'rgba(251,180,60,0.14)',
    text: '#f0e6d4', textMuted: '#9a8060', textLabel: '#b09070',
    sep: 'rgba(251,180,60,0.07)',
    glass: true, accent: '#f59e0b', accentFg: '#fbbf24',
  },
  ocean: {
    label: 'Ocean', swatch: '#0a1628',
    outerBg: '#060d1a', canvasBg: '#040910',
    panelBg: 'rgba(6,14,32,0.92)', headerBg: 'rgba(6,14,32,0.80)',
    border: 'rgba(56,189,248,0.09)', cardBg: 'rgba(56,189,248,0.04)',
    inputBg: 'rgba(56,189,248,0.04)', inputBorder: 'rgba(56,189,248,0.13)',
    text: '#bfdbfe', textMuted: '#4a7a9a', textLabel: '#5a90b0',
    sep: 'rgba(56,189,248,0.07)',
    glass: true, accent: '#38bdf8', accentFg: '#38bdf8',
  },
};

// ─────────────────────────────────────────────────────────────────
// Workplane presets (carpet colour inside the booth)
// ─────────────────────────────────────────────────────────────────
const WORKPLANES = [
  { label: 'Charcoal',   color: '#3b3e44' },
  { label: 'Off White',  color: '#dde0e4' },
  { label: 'Concrete',   color: '#7a7e84' },
  { label: 'Navy',       color: '#1a2640' },
  { label: 'Forest',     color: '#1e3a28' },
  { label: 'Terracotta', color: '#5a2316' },
];

// ─────────────────────────────────────────────────────────────────
// Library items
// ─────────────────────────────────────────────────────────────────
const libraryItems = [
  { id: "wall-solid", name: "Solid Wall",       icon: Wall,      category: "Structure" },
  { id: "wall-glass", name: "Glass Wall",       icon: Wall,      category: "Structure" },
  { id: "fascia-std", name: "Standard Fascia",  icon: Layout,    category: "Fascia"    },
  { id: "counter-1",  name: "Reception Counter",icon: TableIcon, category: "Furniture" },
  { id: "chair-1",    name: "Design Chair",     icon: Square,    category: "Furniture" },
  { id: "light-spot", name: "Spotlight",        icon: Lightbulb, category: "Lighting"  },
  { id: "light-arm",  name: "Arm Light",        icon: Lightbulb, category: "Lighting"  },
];

// ─────────────────────────────────────────────────────────────────
// Booth state
// ─────────────────────────────────────────────────────────────────
interface BoothState {
  width: number; depth: number; height: number;
  system: BoothSystem; companyName: string;
  openFront: boolean; openBack: boolean; openLeft: boolean; openRight: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────
export default function PMWorkspace() {
  const [booth, setBooth] = useState<BoothState>({
    width: 6, depth: 3, height: 2.5,
    system: 'octanorm', companyName: 'TECHCORP INDUSTRIES',
    openFront: true, openBack: false, openLeft: false, openRight: false,
  });
  const [themeName, setThemeName] = useState<ThemeName>('dark');
  const [carpetColor, setCarpetColor] = useState(WORKPLANES[0].color);

  const t = THEMES[themeName];
  const isLight = themeName === 'light';

  const set = useCallback(<K extends keyof BoothState>(key: K, val: BoothState[K]) => {
    setBooth(prev => ({ ...prev, [key]: val }));
  }, []);

  const parseDim = (raw: string, fallback: number) => {
    const n = parseFloat(raw);
    return isNaN(n) || n <= 0 ? fallback : Math.min(n, 40);
  };

  // Inline style helpers
  const panelStyle = {
    background: t.panelBg,
    borderColor: t.border,
    color: t.text,
    ...(t.glass ? { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' } : {}),
  } as React.CSSProperties;

  const headerStyle = {
    background: t.headerBg,
    borderColor: t.border,
    color: t.text,
    ...(t.glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : {}),
  } as React.CSSProperties;

  const cardStyle    = { background: t.cardBg, borderColor: t.border } as React.CSSProperties;
  const inputStyle   = { background: t.inputBg, borderColor: t.inputBorder, color: t.text } as React.CSSProperties;
  const sepStyle     = { background: t.sep } as React.CSSProperties;

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden"
      style={{ background: t.outerBg, color: t.text }}
    >
      {/* ── Top Toolbar ──────────────────────────────────────────── */}
      <header
        className="flex h-14 items-center justify-between border-b px-4 flex-shrink-0"
        style={headerStyle}
      >
        <div className="flex items-center gap-4">
          <Link href="/pm">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              style={{ color: t.textMuted }}>
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </Link>
          <div className="h-4 w-px" style={{ background: t.border }} />
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: t.textMuted }}>Project</span>
            <span className="text-sm font-bold leading-none" style={{ color: t.text }}>TechCon 2024 – Global Exhibit</span>
          </div>
          <Badge className="ml-2 text-[10px]"
            style={{ background: `${t.accent}18`, color: t.accentFg, borderColor: `${t.accent}30` }}>
            v2.4.1
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md p-0.5" style={{ background: t.cardBg }}>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: t.textMuted }}>
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: t.textMuted }}>
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
          </div>
          <div className="h-4 w-px mx-1" style={{ background: t.border }} />
          {[
            { icon: Save,    label: 'Save'     },
            { icon: Camera,  label: 'Snapshot' },
            { icon: History, label: 'History'  },
          ].map(({ icon: Icon, label }) => (
            <Button key={label} variant="outline" size="sm"
              className="h-9 gap-2 text-xs"
              style={{ background: t.cardBg, borderColor: t.border, color: t.text }}>
              <Icon className="h-4 w-4" /> {label}
            </Button>
          ))}
          <Button size="sm" className="h-9 gap-2 text-xs"
            style={{ background: t.accent, color: '#fff', border: 'none' }}>
            <Send className="h-4 w-4" /> Send to Client
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left Panel — Component Library ──────────────────────── */}
        <aside
          className="w-[240px] border-r overflow-y-auto flex-shrink-0"
          style={panelStyle}
        >
          <div className="p-4 border-b" style={{ borderColor: t.border }}>
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: t.textLabel }}>
              <Layers className="h-3 w-3" /> Components
            </h3>
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2" style={{ color: t.textMuted }} />
              <Input placeholder="Search items…"
                className="h-8 pl-8 text-xs border"
                style={inputStyle} />
            </div>
          </div>
          <Accordion type="multiple" defaultValue={["Structure", "Furniture"]} className="w-full">
            {["Structure", "Fascia", "Furniture", "Lighting"].map((cat) => (
              <AccordionItem key={cat} value={cat}
                className="border-b" style={{ borderColor: t.border }}>
                <AccordionTrigger
                  className="px-4 py-3 text-xs font-medium no-underline hover:no-underline"
                  style={{ color: t.text }}>
                  {cat}
                </AccordionTrigger>
                <AccordionContent className="p-2 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {libraryItems.filter(i => i.category === cat).map((item) => (
                      <div key={item.id}
                        className="group flex flex-col items-center justify-center rounded-lg border p-3 transition-all cursor-grab active:cursor-grabbing"
                        style={{ background: t.cardBg, borderColor: t.border }}>
                        <item.icon className="h-6 w-6 mb-2 transition-colors"
                          style={{ color: t.textMuted }} />
                        <span className="text-[10px] text-center font-medium"
                          style={{ color: t.textMuted }}>{item.name}</span>
                      </div>
                    ))}
                    <button
                      className="flex flex-col items-center justify-center rounded-lg border border-dashed p-3 transition-colors"
                      style={{ borderColor: t.border }}>
                      <Plus className="h-5 w-5" style={{ color: t.textMuted }} />
                      <span className="text-[10px] mt-1" style={{ color: t.textMuted }}>Add</span>
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </aside>

        {/* ── Center Canvas ──────────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden" style={{ background: t.canvasBg }}>
          <div className="absolute inset-0">
            <Booth3D config={{
              width:       booth.width,
              depth:       booth.depth,
              height:      booth.height,
              system:      booth.system,
              companyName: booth.companyName,
              carpetColor: carpetColor,
              openFront:   booth.openFront,
              openBack:    booth.openBack,
              openLeft:    booth.openLeft,
              openRight:   booth.openRight,
            }} />
          </div>

          {/* Live badge */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest"
              style={{ background: `${t.accent}18`, color: t.accentFg, border: `1px solid ${t.accent}30` }}>
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: t.accent }} />
              Live Workspace
            </div>
            <div className="px-3 py-1 rounded text-[10px] font-bold uppercase"
              style={{ background: `${t.panelBg}`, border: `1px solid ${t.border}`, color: t.textMuted,
                ...(t.glass ? { backdropFilter: 'blur(8px)' } : {}) }}>
              {booth.system === 'octanorm' ? '⬡ OCTANORM' : '◈ MAXIMA'} · {booth.width}×{booth.depth}m
            </div>
          </div>

          {/* Canvas tool strip */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 z-10">
            <div className="flex rounded-lg border p-0.5"
              style={{ background: t.panelBg, borderColor: t.border,
                ...(t.glass ? { backdropFilter: 'blur(12px)' } : {}) }}>
              <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: t.textMuted }}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: t.textMuted }}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <div className="w-px my-1.5 mx-0.5" style={{ background: t.border }} />
              <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: t.textMuted }}>
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </main>

        {/* ── Right Panel — Properties ──────────────────────────── */}
        <aside
          className="w-[280px] border-l overflow-y-auto flex-shrink-0"
          style={panelStyle}
        >
          <div className="p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center gap-2"
              style={{ color: t.textLabel }}>
              <SettingsIcon className="h-3 w-3" /> Properties
            </h3>

            <div className="space-y-5">

              {/* ── Appearance ──────────────────────────────────── */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold" style={{ color: t.textLabel }}>
                  Workspace Theme
                </Label>
                <div className="flex gap-2">
                  {(Object.keys(THEMES) as ThemeName[]).map(name => {
                    const th = THEMES[name];
                    const active = themeName === name;
                    return (
                      <Tooltip key={name}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setThemeName(name)}
                            className="relative w-8 h-8 rounded-full border-2 transition-all flex-shrink-0"
                            style={{
                              background: th.swatch,
                              borderColor: active ? t.accent : t.border,
                              boxShadow: active ? `0 0 0 2px ${t.accent}40` : 'none',
                            }}
                          >
                            {active && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 12 12">
                                  <polyline points="2,6 5,9 10,3"
                                    stroke={name === 'light' ? '#1e2530' : '#fff'}
                                    strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{th.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              {/* ── Workplane ───────────────────────────────────── */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold" style={{ color: t.textLabel }}>
                  Workplane (Carpet)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {WORKPLANES.map(wp => {
                    const active = carpetColor === wp.color;
                    return (
                      <Tooltip key={wp.color}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setCarpetColor(wp.color)}
                            className="w-7 h-7 rounded-md border-2 transition-all flex-shrink-0 relative"
                            style={{
                              background: wp.color,
                              borderColor: active ? t.accent : t.border,
                              boxShadow: active ? `0 0 0 2px ${t.accent}40` : 'none',
                            }}
                          >
                            {active && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg width="10" height="10" viewBox="0 0 10 10">
                                  <polyline points="1.5,5 4,7.5 8.5,2.5"
                                    stroke={wp.color === '#dde0e4' ? '#1e2530' : '#fff'}
                                    strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </span>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{wp.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>

              <div className="h-px" style={{ background: t.sep }} />

              {/* ── Stand Configuration ─────────────────────────── */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold" style={{ color: t.textLabel }}>
                  Stand Configuration
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['Width (m)',  'width',  1, 40, 1],
                    ['Depth (m)',  'depth',  1, 40, 1],
                  ] as [string, keyof BoothState, number, number, number][]).map(([lbl, key, min, max, step]) => (
                    <div key={key} className="space-y-1">
                      <Label className="text-[10px]" style={{ color: t.textMuted }}>{lbl}</Label>
                      <Input
                        type="number" min={min} max={max} step={step}
                        value={booth[key] as number}
                        onChange={e => set(key, parseDim(e.target.value, booth[key] as number))}
                        className="h-8 text-xs border"
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]" style={{ color: t.textMuted }}>Height (m)</Label>
                  <Input
                    type="number" min={1.5} max={6} step={0.5}
                    value={booth.height}
                    onChange={e => set('height', parseDim(e.target.value, booth.height))}
                    className="h-8 text-xs border"
                    style={inputStyle}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]" style={{ color: t.textMuted }}>System</Label>
                  <Select value={booth.system} onValueChange={v => set('system', v as BoothSystem)}>
                    <SelectTrigger className="h-8 text-xs border" style={inputStyle}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="octanorm">Octanorm (1m module)</SelectItem>
                      <SelectItem value="maxima">Maxima (2m module)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]" style={{ color: t.textMuted }}>Fascia / Company Name</Label>
                  <Input
                    value={booth.companyName}
                    onChange={e => set('companyName', e.target.value.toUpperCase())}
                    className="h-8 text-xs border"
                    style={inputStyle}
                    placeholder="COMPANY NAME"
                  />
                </div>
              </div>

              <div className="h-px" style={{ background: t.sep }} />

              {/* ── Open Sides ──────────────────────────────────── */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold" style={{ color: t.textLabel }}>
                  Open Sides
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['openFront', 'Front'],
                    ['openBack',  'Back'],
                    ['openLeft',  'Left'],
                    ['openRight', 'Right'],
                  ] as [keyof BoothState, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={`side-${key}`}
                        checked={booth[key] as boolean}
                        onCheckedChange={v => set(key, !!v)}
                      />
                      <Label htmlFor={`side-${key}`}
                        className="text-xs cursor-pointer"
                        style={{ color: t.text }}>{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px" style={{ background: t.sep }} />

              {/* ── Stand Stats ─────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold" style={{ color: t.textLabel }}>
                  Stand Stats
                </Label>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {[
                    ['Floor Area', `${(booth.width * booth.depth).toFixed(1)} m²`],
                    ['Volume',     `${(booth.width * booth.depth * booth.height).toFixed(1)} m³`],
                    ['Modules',    booth.system === 'octanorm'
                      ? `${booth.width}×${booth.depth}`
                      : `${Math.ceil(booth.width/2)}×${Math.ceil(booth.depth/2)}`],
                    ['Height',     `${booth.height} m`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded p-2" style={cardStyle}>
                      <p style={{ color: t.textMuted }}>{k}</p>
                      <p className="font-bold mt-0.5" style={{ color: t.text }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </aside>
      </div>

      {/* ── Bottom Bar ───────────────────────────────────────────── */}
      <footer
        className="h-10 flex items-center justify-between px-4 border-t text-[10px] font-medium flex-shrink-0"
        style={headerStyle}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span style={{ color: t.textMuted }}>Connected to TechCorp_Workspace_A</span>
          </div>
          <div className="h-3.5 w-px" style={{ background: t.border }} />
          <span style={{ color: t.textMuted }}>
            System: {booth.system === 'octanorm' ? 'Octanorm' : 'Maxima'}
          </span>
          <span style={{ color: t.textMuted }}>
            Floor: {(booth.width * booth.depth).toFixed(0)} m²
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span style={{ color: t.textMuted }}>
            {booth.width}m × {booth.depth}m × {booth.height}m
          </span>
          <div className="h-3.5 w-px" style={{ background: t.border }} />
          <span style={{ color: t.textMuted }}>Last Saved: Just now</span>
        </div>
      </footer>
    </div>
  );
}

const SearchIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} xmlns="http://www.w3.org/2000/svg"
    width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
  </svg>
);
