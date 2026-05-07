import { useState } from "react";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Paperclip, MoreVertical, Search, Phone, Video } from "lucide-react";
import { mockMessages } from "@/lib/mock-data";

export default function ClientMessages() {
  const [messages, setMessages] = useState(mockMessages);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;
    const newMessage = {
      id: messages.length + 1,
      sender: "You",
      role: "Client",
      text: inputValue,
      time: "Just now",
      avatar: ""
    };
    setMessages([...messages, newMessage]);
    setInputValue("");
  };

  return (
    <DashboardLayout role="client">
      <PageHeader 
        title="Messages" 
        breadcrumbs={[{ label: "Dashboard", href: "/client" }, { label: "Messages" }]} 
      />

      <div className="mt-6 h-[calc(100vh-220px)] flex gap-6">
        {/* Chat List Sidebar - Simplified for Client */}
        <Card className="w-80 hidden md:flex flex-col overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search messages..." className="pl-9 bg-muted/50 border-transparent" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="divide-y">
              <div className="p-4 bg-primary/5 border-l-4 border-primary cursor-pointer transition-colors">
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-primary/10 text-primary">JD</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold">John Doe</p>
                      <span className="text-[10px] text-muted-foreground">30m ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">I understand. I'll make the branding larger...</p>
                  </div>
                </div>
              </div>
              {/* Other mock contacts could go here */}
              <div className="p-4 hover:bg-muted/50 cursor-pointer transition-colors opacity-50">
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarFallback>SM</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold">Support Manager</p>
                      <span className="text-[10px] text-muted-foreground">2 days ago</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">Welcome to ENS Platform! Let us know if you...</p>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </Card>

        {/* Message Thread */}
        <Card className="flex-1 flex flex-col overflow-hidden border-primary/10">
          {/* Thread Header */}
          <div className="p-4 border-b flex items-center justify-between bg-card/50">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary/10 text-primary">JD</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-bold leading-none">John Doe</p>
                <p className="text-[10px] text-green-500 mt-1 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Active Now
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Phone className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Video className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreVertical className="h-4 w-4" /></Button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'You' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${msg.sender === 'You' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={msg.sender === 'You' ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                        {msg.sender === 'You' ? 'YC' : 'PM'}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'}`}>
                      <div className={`p-4 rounded-2xl text-sm ${
                        msg.sender === 'You' 
                          ? 'bg-primary text-primary-foreground rounded-tr-none shadow-lg shadow-primary/20' 
                          : 'bg-muted border rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-muted-foreground mt-2 px-1">{msg.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t bg-card/50">
            <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-2 border border-transparent focus-within:border-primary/30 transition-colors">
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary">
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input 
                placeholder="Type your message..." 
                className="border-0 bg-transparent focus-visible:ring-0 px-0 h-9"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={handleSendMessage}>
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
