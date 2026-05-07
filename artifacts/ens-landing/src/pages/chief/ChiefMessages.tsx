import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockManagers, mockActivity } from "@/lib/mock-data";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Send, 
  MoreVertical, 
  Paperclip, 
  Smile,
  Phone,
  Video
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChiefMessages() {
  const [selectedChat, setSelectedChat] = useState(mockManagers[0]);
  const [message, setMessage] = useState("");

  const mockMessages = [
    { id: 1, senderId: selectedChat.id, text: "Hey, I've updated the TechCon workspace with the latest Maxima components.", time: "10:30 AM" },
    { id: 2, senderId: "me", text: "Great, thanks John. I'll take a look at it during the monitor session.", time: "10:35 AM" },
    { id: 3, senderId: selectedChat.id, text: "Also, the client for HealthExpo requested a revision on the fascia lighting.", time: "10:42 AM" },
    { id: 4, senderId: "me", text: "Got it. Let's make sure that's addressed by the end of the day.", time: "10:45 AM" },
  ];

  return (
    <DashboardLayout role="chief">
      <div className="flex flex-col h-[calc(100vh-180px)] space-y-4">
        <PageHeader 
          title="Messages" 
          breadcrumbs={[{ label: "Chief", href: "/chief" }, { label: "Messages" }]}
        />
        
        <div className="flex-1 flex overflow-hidden border rounded-xl bg-card/30 backdrop-blur-sm">
          {/* Sidebar */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search chats..." 
                  className="pl-9 bg-muted/50 border-transparent focus:border-primary"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {mockManagers.map((manager) => (
                <div 
                  key={manager.id}
                  onClick={() => setSelectedChat(manager)}
                  className={cn(
                    "flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-muted/30",
                    selectedChat.id === manager.id && "bg-primary/10 border-r-2 border-r-primary"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{manager.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm truncate">{manager.name}</span>
                      <span className="text-[10px] text-muted-foreground">10:42 AM</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">Latest message preview text...</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-muted/10">
            {/* Chat Header */}
            <div className="p-4 border-b bg-card/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{selectedChat.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-sm">{selectedChat.name}</h3>
                  <p className="text-[10px] text-green-500 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Phone className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Video className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {mockMessages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={cn(
                    "flex flex-col max-w-[70%]",
                    msg.senderId === "me" ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "rounded-2xl p-3 text-sm",
                    msg.senderId === "me" 
                      ? "bg-primary text-primary-foreground rounded-tr-none" 
                      : "bg-card border rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">{msg.time}</span>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 border-t bg-card/30">
              <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0"><Paperclip className="h-4 w-4" /></Button>
                <Input 
                  placeholder="Type a message..." 
                  className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setMessage("")}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0"><Smile className="h-4 w-4" /></Button>
                <Button 
                  size="icon" 
                  className="h-8 w-8 shrink-0 rounded-lg"
                  onClick={() => setMessage("")}
                  disabled={!message.trim()}
                  data-testid="button-send-message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
