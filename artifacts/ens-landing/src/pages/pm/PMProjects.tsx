import { DashboardLayout } from "@/components/layouts/DashboardLayout";
import { PageHeader } from "@/components/dashboard/PageHeader";

export default function PMProjects() {
  return (
    <DashboardLayout role="pm">
      <PageHeader title="My Projects" breadcrumbs={[{ label: "Dashboard", href: "/pm" }, { label: "My Projects" }]} />
      <div className="mt-8 border-2 border-dashed border-border rounded-xl h-[400px] flex items-center justify-center bg-card/30">
        <p className="text-muted-foreground">My Projects Content Coming Soon</p>
      </div>
    </DashboardLayout>
  );
}
