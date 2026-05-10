import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { Booth3D } from "@/components/workspace/Booth3D";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Lock, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  MessageSquare, 
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  ChevronDown,
  Layers
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const furnitureCategories = [
  { name: "Structure", items: ["Wall Panel", "Corner Post", "Fascia"] },
  { name: "Furniture", items: ["Counter", "Bar Stool", "Meeting Table", "Chair"] },
  { name: "Lighting", items: ["Spotlight", "LED Strip", "Arm Light"] },
];

export default function ClientWorkspace() {
  const [rotation, setRotation] = useState({ x: 20, y: -30 });
  const [zoom, setZoom] = useState(1);
  const [comments, setComments] = useState([
    { id: 1, user: "John Doe (PM)", text: "I've added the new lighting fixtures as requested.", time: "2h ago" },
    { id: 2, user: "You", text: "Looks great, but can we move the branding slightly to the left?", time: "1h ago" },
  ]);
  const [newComment, setNewComment] = useState("");

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    setComments([...comments, { id: Date.now(), user: "You", text: newComment, time: "Just now" }]);
    setNewComment("");
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Toolbar */}
      <header className="h-14 border-b bg-card/50 backdrop-blur-md flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">TechCon 2024 - Global Exhibit</span>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <Eye className="h-3 w-3 mr-1" /> View Only
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                v2.4 (Current) <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>v2.4 - Latest</DropdownMenuItem>
              <DropdownMenuItem>v2.3 - May 12</DropdownMenuItem>
              <DropdownMenuItem>v2.2 - May 10</DropdownMenuItem>
              <DropdownMenuItem>v1.0 - Initial</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10">
                <AlertCircle className="mr-2 h-4 w-4" /> Request Changes
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Design Changes</DialogTitle>
                <DialogDescription>
                  Your feedback will be sent directly to your Project Manager.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea placeholder="Describe the changes you'd like to see..." className="min-h-[120px]" />
              </div>
              <DialogFooter>
                <Button type="submit">Submit Request</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700">
            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Design
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Read Only Assets */}
        <aside className="w-64 border-r bg-card/30 flex flex-col">
          <div className="p-4 bg-muted/50 border-b">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Lock className="h-3 w-3" /> Asset Library (Locked)
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {furnitureCategories.map((cat) => (
                <div key={cat.name}>
                  <h4 className="text-xs font-bold mb-3 text-muted-foreground uppercase">{cat.name}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {cat.items.map((item) => (
                      <div key={item} className="group relative aspect-square rounded-md border bg-muted/20 flex flex-col items-center justify-center p-2 opacity-60 grayscale-[0.5]">
                        <div className="w-8 h-8 rounded bg-primary/10 border border-primary/20 mb-1" />
                        <span className="text-[9px] text-center font-medium leading-tight">{item}</span>
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t bg-muted/20">
            <div className="text-[10px] text-muted-foreground leading-relaxed italic">
              * Design is in "Review" mode. Editing is restricted to Project Managers.
            </div>
          </div>
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 relative bg-[#080d18] overflow-hidden">
          {/* Booth Canvas SVG — Maxima system for client view */}
          <div className="absolute inset-0">
            <Booth3D config={{
              width: 8, depth: 6, height: 3,
              system: 'maxima',
              companyName: 'TECHCORP INDUSTRIES',
              primaryColor: '#4a1a8a',
              carpetColor: '#1e1830',
              openFront: true,
            }} />
          </div>

          {/* Camera Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1 rounded-full bg-card/80 border backdrop-blur-md shadow-2xl z-10">
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4" />
            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>

          {/* View Indicator */}
          <div className="absolute top-6 left-6 flex flex-col gap-1 z-10">
            <div className="px-3 py-1 rounded bg-background/50 border backdrop-blur-md text-[10px] font-bold text-primary">PERSPECTIVE VIEW</div>
            <div className="px-3 py-1 rounded bg-background/50 border backdrop-blur-md text-[10px] font-bold text-muted-foreground uppercase">MAXIMA SYSTEM · 8×6m</div>
          </div>
        </main>

        {/* Right Panel - Comments & Details */}
        <aside className="w-80 border-l bg-card/30 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-bold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" /> Review Comments
            </h3>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className={`flex flex-col gap-1 ${comment.user === 'You' ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-2">
                    {comment.user !== 'You' && <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">PM</AvatarFallback></Avatar>}
                    <span className="text-[10px] font-bold text-muted-foreground">{comment.user}</span>
                    {comment.user === 'You' && <Avatar className="h-5 w-5"><AvatarFallback className="text-[8px]">YOU</AvatarFallback></Avatar>}
                  </div>
                  <div className={`p-3 rounded-lg text-xs max-w-[90%] ${
                    comment.user === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted border'
                  }`}>
                    {comment.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground">{comment.time}</span>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="p-4 border-t bg-card/50">
            <div className="flex gap-2">
              <Input 
                placeholder="Add a comment..." 
                className="h-9 text-xs" 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleAddComment}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4 bg-muted/20 border-t">
             <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-3 tracking-widest">Project Info</h4>
             <div className="space-y-3">
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase font-medium">Stand Type</p>
                 <p className="text-xs font-bold">Maxima Premium</p>
               </div>
               <div>
                 <p className="text-[10px] text-muted-foreground uppercase font-medium">Approval Status</p>
                 <Badge variant="outline" className="mt-1 bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Awaiting Approval</Badge>
               </div>
             </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
