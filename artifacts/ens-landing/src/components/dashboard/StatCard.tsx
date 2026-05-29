import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  href?: string;
}

export function StatCard({ label, value, icon: Icon, trend, trendUp, className, href }: StatCardProps) {
  const [, navigate] = useLocation();
  const { t } = useTranslation();

  const cardProps = href
    ? {
        role: "button" as const,
        tabIndex: 0,
        onClick: () => navigate(href),
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(href); } },
        "aria-label": label,
      }
    : {};

  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-card/50 backdrop-blur-sm",
        href && "cursor-pointer transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
      {...cardProps}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <h3 className="mt-1 text-3xl font-bold tracking-tight">{value}</h3>
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Icon aria-hidden="true" className="h-6 w-6" />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-2">
            <span className={cn("text-xs font-medium", trendUp ? "text-green-500" : "text-red-500")}>
              {trend}
            </span>
            <span className="text-xs text-muted-foreground">{t("common.vsLastMonth")}</span>
          </div>
        )}
        {href && (
          <p className="mt-2 text-[10px] text-muted-foreground/60">{t("common.clickToView")}</p>
        )}
      </CardContent>
    </Card>
  );
}
