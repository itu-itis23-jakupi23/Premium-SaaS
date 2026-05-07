import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Paperclip, MoreVertical, Phone, Video } from "lucide-react";

const contacts = [
  { id: 1, name: "Sarah TechCorp", company: "TechCorp Industries", lastMsg: "The layout looks great!", time: "10:30 AM", unread: 2, online: true },
  { id: 2, name: "David MediLife", company: "MediLife", lastMsg: "When can we see the 3D model?", time: "Yesterday", unread: 0, online: false },
  { id: 3, name: "Elena FastCars", company: "FastCars Co", lastMsg: "Please update the lighting.", time: "Aug 8", unread: 0, online: true },
];

const messages = [
  { id: 1, sender: "Sarah TechCorp", text: "Hi, I just saw the latest version of the booth.", time: "10:25 AM", isMe: false },
  { id: 2, sender: "Me", text: "Great! Did the Octanorm structure work for you?", time: "10:27 AM", isMe: true },
  { id: 3, sender: "Sarah TechCorp", text: "Yes, it looks solid. The layout looks great! Can we just check the lighting positions?", time: "10:30 AM", isMe: false },
];

export default function PMMessages() {
  const [selectedContact, setSelectedContact] = useState(contacts[0]);

  return (
    <DashboardLayout role="pm">
      <div className="flex flex-col h-[calc(100vh-140px)]">
        <PageHeader 
          title="Messages" 
          breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Messages" }]} 
        />
        
        <div className="mt-6 flex-1 flex overflow-hidden rounded-xl border border-border bg-card/30 backdrop-blur-sm">
          {/* Sidebar */}
          <div className="w-80 border-r border-border flex flex-col bg-card/50">
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search messages..." className="pl-9 h-9 bg-background/50" />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {contacts.map((contact) => (
                <div 
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={cn(
                    "p-4 flex gap-3 cursor-pointer hover:bg-primary/5 transition-colors border-b border-border/50",
                    selectedContact.id === contact.id ? "bg-primary/10 border-l-4 border-l-primary" : ""
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">{contact.name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    {contact.online && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-sm font-semibold truncate">{contact.name}</h4>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{contact.time}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate font-medium">{contact.company}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.lastMsg}</p>
                  </div>
                  {contact.unread > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] h-4 w-4 rounded-full flex items-center justify-center font-bold">
                      {contact.unread}
                    </span>
                  )}
                </div>
              ))}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-background/20">
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">{selectedContact.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-sm font-semibold leading-none">{selectedContact.name}</h4>
                  <span className="text-[10px] text-green-500 flex items-center gap-1 mt-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Active now
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><Phone className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><Video className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-6">
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex flex-col", msg.isMe ? "items-end" : "items-start")}>
                    <div className={cn(
                      "max-w-[70%] rounded-2xl p-4 text-sm shadow-sm",
                      msg.isMe 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-card border border-border rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Input Bar */}
            <div className="p-4 border-t border-border bg-card/50">
              <div className="flex items-center gap-3 bg-background/50 rounded-xl p-2 border border-border">
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground"><Paperclip className="h-4 w-4" /></Button>
                <Input 
                  placeholder="Type your message..." 
                  className="flex-1 border-none bg-transparent focus-visible:ring-0 shadow-none text-sm" 
                />
                <Button size="icon" className="h-9 w-9 shadow-lg shadow-primary/20"><Send className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
