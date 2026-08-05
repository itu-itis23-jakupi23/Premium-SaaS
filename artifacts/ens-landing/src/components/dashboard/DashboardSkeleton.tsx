import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse p-6">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded-md bg-muted/60" />
          <div className="h-4 w-96 rounded-md bg-muted/40" />
        </div>
        <div className="h-10 w-32 rounded-md bg-muted/60" />
      </div>

      {/* Stat Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="h-4 w-24 rounded bg-muted/60" />
              <div className="h-8 w-8 rounded-full bg-muted/50" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-7 w-20 rounded bg-muted/80" />
              <div className="h-3 w-32 rounded bg-muted/40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/50 bg-card/50">
          <CardHeader className="space-y-2">
            <div className="h-6 w-48 rounded bg-muted/60" />
            <div className="h-4 w-72 rounded bg-muted/40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-48 w-full rounded-lg bg-muted/30" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 rounded-md bg-muted/40" />
              <div className="h-12 rounded-md bg-muted/40" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader className="space-y-2">
            <div className="h-6 w-36 rounded bg-muted/60" />
            <div className="h-4 w-48 rounded bg-muted/40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/20">
                <div className="space-y-1">
                  <div className="h-4 w-28 rounded bg-muted/50" />
                  <div className="h-3 w-20 rounded bg-muted/30" />
                </div>
                <div className="h-6 w-16 rounded bg-muted/40" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
