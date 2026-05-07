import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, AlertCircle, ArrowUpRight } from "lucide-react";

const requests = [
  {
    id: 1,
    client: "TechCorp Industries",
    project: "TechCon 2024",
    request: "Change the back wall color to charcoal and add a small storage unit behind the reception desk.",
    timestamp: "2 hours ago",
    status: "Pending",
    priority: "High"
  },
  {
    id: 2,
    client: "MediLife",
    project: "HealthExpo Booth",
    request: "Increase the height of the fascia by 20cm to accommodate the new logo size.",
    timestamp: "5 hours ago",
    status: "In Progress",
    priority: "Medium"
  },
  {
    id: 3,
    client: "FastCars Co",
    project: "AutoShow Premium Stand",
    request: "Add 4 more spotlights to the left display area.",
    timestamp: "1 day ago",
    status: "Resolved",
    priority: "Low"
  }
];

export default function PMRequests() {
  return (
    <DashboardLayout role="pm">
      <PageHeader 
        title="Revision Requests" 
        breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "Revision Requests" }]} 
      />

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((req) => (
          <Card key={req.id} className="bg-card/50 backdrop-blur-sm border-border flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <Badge className={cn(
                  req.status === "Pending" ? "bg-yellow-500/10 text-yellow-500" :
                  req.status === "In Progress" ? "bg-blue-500/10 text-blue-500" :
                  "bg-green-500/10 text-green-500"
                )}>
                  {req.status}
                </Badge>
                <Badge variant="outline" className={cn(
                  req.priority === "High" ? "border-red-500/50 text-red-500" :
                  req.priority === "Medium" ? "border-yellow-500/50 text-yellow-500" :
                  "text-blue-500"
                )}>
                  {req.priority}
                </Badge>
              </div>
              <CardTitle className="text-base font-bold">{req.client}</CardTitle>
              <p className="text-xs text-primary font-medium">{req.project}</p>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "{req.request}"
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {req.timestamp}
              </div>
            </CardContent>
            <CardFooter className="pt-0 flex gap-2">
              {req.status !== "Resolved" ? (
                <>
                  <Button variant="outline" size="sm" className="flex-1 text-xs">
                    {req.status === "Pending" ? "Mark In Progress" : "Resolve"}
                  </Button>
                  <Button size="sm" className="flex-1 text-xs gap-1">
                    Open <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="w-full text-xs" disabled>
                  Resolved
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
