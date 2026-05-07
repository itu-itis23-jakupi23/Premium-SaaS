import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockProjects } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function ClientApprovals() {
  const project = mockProjects[0];

  return (
    <DashboardLayout role="client">
      <PageHeader 
        title="Design Approvals" 
        breadcrumbs={[{ label: "Dashboard", href: "/client" }, { label: "Design Approvals" }]} 
      />

      <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {project.approvals?.map((approval) => (
          <Card key={approval.id} className={`flex flex-col ${approval.status === 'Approved' ? 'border-green-500/20 bg-green-500/5' : 'border-primary/20 bg-primary/5'}`}>
            <CardHeader>
              <div className="flex justify-between items-start mb-2">
                {approval.status === 'Approved' ? (
                  <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-500" />
                  </div>
                )}
                <Badge variant={approval.status === 'Approved' ? 'default' : 'outline'} className={approval.status === 'Approved' ? 'bg-green-500 hover:bg-green-600' : 'text-yellow-500 border-yellow-500/50'}>
                  {approval.status}
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold">{approval.title}</CardTitle>
              <CardDescription>{approval.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-3 py-4 border-y border-border/50 my-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted Date</span>
                  <span className="font-medium">{approval.date === '-' ? 'Not submitted' : approval.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">Booth Design</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project</span>
                  <span className="font-medium text-xs truncate max-w-[150px]">{project.name}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              {approval.status === 'Approved' ? (
                <Button variant="outline" className="w-full text-xs" disabled>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approved
                </Button>
              ) : (
                <>
                  <Button variant="outline" className="flex-1 text-xs">
                    <AlertCircle className="mr-2 h-4 w-4" /> Request Changes
                  </Button>
                  <Button className="flex-1 text-xs bg-green-600 hover:bg-green-700">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                </>
              )}
            </CardFooter>
          </Card>
        ))}

        {/* View in Workspace Card */}
        <Card className="border-dashed border-2 flex flex-col items-center justify-center text-center p-6 bg-muted/20">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
            <ArrowRight className="h-6 w-6" />
          </div>
          <h3 className="font-bold mb-2">Want to see it in 3D?</h3>
          <p className="text-sm text-muted-foreground mb-6">Review all designs in the interactive 3D workspace before approving.</p>
          <Button asChild>
            <Link href="/client/workspace">Open Workspace</Link>
          </Button>
        </Card>
      </div>
    </DashboardLayout>
  );
}
