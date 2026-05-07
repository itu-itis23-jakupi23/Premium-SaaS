import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { mockDocuments } from "@/lib/mock-data";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, FileImage, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function ClientDocuments() {
  return (
    <DashboardLayout role="client">
      <PageHeader 
        title="Project Documents" 
        breadcrumbs={[{ label: "Dashboard", href: "/client" }, { label: "Project Documents" }]} 
      />

      <div className="mt-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search documents..." className="pl-9 bg-card" />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button variant="outline" size="sm" className="flex-1 md:flex-none">
              <Filter className="mr-2 h-4 w-4" /> Filter
            </Button>
            <Button size="sm" className="flex-1 md:flex-none">
              Request Document
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-bold">Files & Assets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date Uploaded</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {doc.type === 'PDF' ? (
                          <div className="h-8 w-8 rounded bg-red-500/10 flex items-center justify-center text-red-500">
                            <FileText className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <FileImage className="h-4 w-4" />
                          </div>
                        )}
                        <span>{doc.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs px-2 py-1 rounded bg-muted font-medium">{doc.type}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{doc.date}</TableCell>
                    <TableCell className="text-muted-foreground">{doc.size}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Info Box */}
        <div className="rounded-lg border bg-primary/5 p-4 flex gap-4 items-start">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-primary">Need something else?</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              If you require specific technical drawings, CAD files, or official quotations that aren't listed here, please contact your Project Manager or use the "Request Document" button above.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
