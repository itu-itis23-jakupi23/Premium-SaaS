import { useState, useEffect } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Booth3D } from "@/components/workspace/Booth3D";
import { 
  Box, 
  Layers, 
  Layout, 
  Maximize, 
  Save, 
  Undo2, 
  Redo2, 
  Camera, 
  History, 
  Send, 
  ZoomIn, 
  ZoomOut,
  ChevronRight,
  Plus,
  Info,
  ChevronDown,
  Monitor,
  Lightbulb,
  Table as TableIcon,
  Palette,
  Columns as Wall,
  Square,
  Settings as SettingsIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const furnitureItems = [
  { id: "wall-1", name: "Solid Wall", icon: Wall, category: "Walls" },
  { id: "wall-2", name: "Glass Wall", icon: Wall, category: "Walls" },
  { id: "counter-1", name: "Reception Counter", icon: TableIcon, category: "Furniture" },
  { id: "chair-1", name: "Design Chair", icon: Square, category: "Furniture" },
  { id: "light-1", name: "Spotlight", icon: Lightbulb, category: "Lighting" },
  { id: "fascia-1", name: "Standard Fascia", icon: Layout, category: "Fascia" },
];

export default function PMWorkspace() {
  const [rotation, setRotation] = useState({ x: 20, y: -45 });
  const [isRotating, setIsRotating] = useState(true);

  useEffect(() => {
    if (!isRotating) return;
    const interval = setInterval(() => {
      setRotation(prev => ({ ...prev, y: prev.y + 0.5 }));
    }, 50);
    return () => clearInterval(interval);
  }, [isRotating]);

  return (
    <div className="flex h-screen w-full flex-col bg-[#0a0a0c] text-slate-200 overflow-hidden">
      {/* Top Toolbar */}
      <header className="flex h-14 items-center justify-between border-b border-white/5 bg-background/50 px-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link href="/pm">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/5">
              <ChevronRight className="h-4 w-4 rotate-180" />
            </Button>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Project</span>
            <span className="text-sm font-bold text-white leading-none">TechCon 2024 - Global Exhibit</span>
          </div>
          <Badge variant="outline" className="ml-2 border-primary/20 bg-primary/5 text-primary text-[10px]">
            v2.4.1
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 rounded-md p-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><Undo2 className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><Redo2 className="h-4 w-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
          </div>
          <div className="h-4 w-px bg-white/10 mx-1" />
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white/5 border-white/10 hover:bg-white/10">
            <Save className="h-4 w-4" /> Save
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white/5 border-white/10 hover:bg-white/10">
            <Camera className="h-4 w-4" /> Snapshot
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 bg-white/5 border-white/10 hover:bg-white/10">
            <History className="h-4 w-4" /> History
          </Button>
          <Button size="sm" className="h-9 gap-2 shadow-lg shadow-primary/20">
            <Send className="h-4 w-4" /> Send to Client
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Furniture Library */}
        <aside className="w-[240px] border-r border-white/5 bg-background/30 backdrop-blur-sm overflow-y-auto">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Layers className="h-3 w-3" /> Components
            </h3>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
              <Input placeholder="Search items..." className="h-8 pl-8 text-xs bg-white/5 border-white/10" />
            </div>
          </div>
          <Accordion type="multiple" defaultValue={["Structure", "Furniture"]} className="w-full">
            {["Structure", "Walls", "Fascia", "Furniture", "Lighting", "Decoration"].map((cat) => (
              <AccordionItem key={cat} value={cat} className="border-white/5">
                <AccordionTrigger className="px-4 py-3 text-xs font-medium hover:bg-white/5 no-underline">
                  {cat}
                </AccordionTrigger>
                <AccordionContent className="p-2 pt-0">
                  <div className="grid grid-cols-2 gap-2">
                    {furnitureItems.filter(i => i.category === cat || (cat === "Structure" && i.category === "Walls")).map((item) => (
                      <div 
                        key={item.id} 
                        className="group flex flex-col items-center justify-center rounded-lg border border-white/5 bg-white/5 p-3 transition-all hover:border-primary/50 hover:bg-white/10 cursor-grab active:cursor-grabbing"
                      >
                        <item.icon className="h-6 w-6 text-slate-400 group-hover:text-primary transition-colors mb-2" />
                        <span className="text-[10px] text-center text-slate-400 font-medium">{item.name}</span>
                      </div>
                    ))}
                    <button className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 p-3 hover:border-white/20 transition-colors">
                      <Plus className="h-5 w-5 text-slate-600" />
                      <span className="text-[10px] text-slate-600 mt-1">Add</span>
                    </button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 relative overflow-hidden bg-[#080d18]">
          {/* Booth Canvas SVG */}
          <div className="absolute inset-0">
            <Booth3D config={{
              width: 8, depth: 6, height: 3,
              system: 'octanorm',
              companyName: 'TECHCORP INDUSTRIES',
              openFront: true,
            }} />
          </div>

          {/* Canvas Controls */}
          <div className="absolute bottom-6 left-6 flex items-center gap-3 z-10">
            <div className="flex bg-background/80 backdrop-blur-md rounded-lg border border-white/10 p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><ZoomIn className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><ZoomOut className="h-4 w-4" /></Button>
              <div className="h-4 w-px bg-white/10 mx-1 self-center" />
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white"><Maximize className="h-4 w-4" /></Button>
            </div>
            <div className="flex bg-background/80 backdrop-blur-md rounded-lg border border-white/10 p-1">
              {["Front", "Top", "Side", "ISO"].map((view) => (
                <Button key={view} variant="ghost" size="sm" className="h-8 px-3 text-[10px] uppercase font-bold text-slate-400 hover:text-white">
                  {view}
                </Button>
              ))}
            </div>
          </div>

          {/* Live indicator */}
          <div className="absolute top-6 left-6 z-10">
            <Badge className="bg-primary/20 text-primary border-primary/30 gap-2 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              LIVE WORKSPACE
            </Badge>
          </div>
        </main>

        {/* Right Panel - Properties */}
        <aside className="w-[280px] border-l border-white/5 bg-background/30 backdrop-blur-sm overflow-y-auto">
          <div className="p-4 border-b border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <SettingsIcon className="h-3 w-3" /> Properties
            </h3>
            
            <div className="space-y-6">
              {/* Structure Settings */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Stand Configuration</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-400">Width (m)</Label>
                    <Input defaultValue="10" className="h-8 text-xs bg-white/5 border-white/10" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-slate-400">Depth (m)</Label>
                    <Input defaultValue="10" className="h-8 text-xs bg-white/5 border-white/10" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-slate-400">Stand Type</Label>
                  <Select defaultValue="maxima">
                    <SelectTrigger className="h-8 text-xs bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="octanorm">Octanorm</SelectItem>
                      <SelectItem value="maxima">Maxima</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="bg-white/5" />

              {/* Open Sides */}
              <div className="space-y-3">
                <Label className="text-[10px] uppercase font-bold text-slate-500">Open Sides</Label>
                <div className="grid grid-cols-2 gap-3">
                  {["Front", "Back", "Left", "Right"].map((side) => (
                    <div key={side} className="flex items-center gap-2">
                      <Checkbox id={`side-${side}`} checked={side === "Front" || side === "Right"} />
                      <Label htmlFor={`side-${side}`} className="text-xs text-slate-300">{side}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-white/5" />

              {/* Object Properties */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-slate-500">Selected Object</Label>
                  <Badge variant="outline" className="h-5 text-[8px] bg-primary/10 text-primary">Wall_04</Badge>
                </div>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-[10px] text-slate-400">Position X</Label>
                      <span className="text-[10px] text-slate-500">4.2m</span>
                    </div>
                    <Slider defaultValue={[42]} max={100} step={1} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-[10px] text-slate-400">Rotation</Label>
                      <span className="text-[10px] text-slate-500">90°</span>
                    </div>
                    <Slider defaultValue={[90]} max={360} step={45} className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3" />
                  </div>
                  <div className="pt-2">
                    <Button variant="outline" size="sm" className="w-full text-[10px] h-8 border-red-500/20 text-red-400 hover:bg-red-500/10">
                      Delete Object
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom Bar */}
      <footer className="h-10 flex items-center justify-between px-4 border-t border-white/5 bg-background/50 text-[10px] text-slate-500 font-medium">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>Connected to TechCorp_Workspace_A</span>
          </div>
          <Separator orientation="vertical" className="h-4 bg-white/10" />
          <span>Objects: 42</span>
          <span>Polygons: 1,204</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Zoom: 120%</span>
          <Separator orientation="vertical" className="h-4 bg-white/10" />
          <span>Last Saved: Just now</span>
        </div>
      </footer>
    </div>
  );
}

const Search = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);
