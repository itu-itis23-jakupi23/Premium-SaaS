import { useEffect, useState } from "react";
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

  // Animated Counter Effect for numeric values
  const numericMatch = value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  const prefix = numericMatch ? numericMatch[1] : "";
  const numVal = numericMatch ? parseFloat(numericMatch[2].replace(/,/g, "")) : NaN;
  const suffix = numericMatch ? numericMatch[3] : "";

  const [displayCount, setDisplayCount] = useState(() => (Number.isNaN(numVal) ? value : 0));

  useEffect(() => {
    if (Number.isNaN(numVal)) {
      setDisplayCount(value);
      return;
    }

    const duration = 600; // ms
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(eased * numVal);

      setDisplayCount(current);

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setDisplayCount(numVal);
      }
    }

    requestAnimationFrame(step);
  }, [numVal, value]);

  const formattedValue = Number.isNaN(numVal)
    ? value
    : `${prefix}${displayCount.toLocaleString()}${suffix}`;

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
        "overflow-hidden border-border bg-card/50 backdrop-blur-sm transition-all hover:shadow-lg",
        href && "cursor-pointer hover:border-primary/40 hover:scale-[1.01]",
        className,
      )}
      {...cardProps}
    >
      <CardContent className="p-3.5 sm:p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-foreground transition-all">
              {formattedValue}
            </h3>
          </div>
          <div className="rounded-full bg-primary/10 p-2.5 text-primary">
            <Icon aria-hidden="true" className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className={cn("text-[11px] font-semibold", trendUp ? "text-emerald-500" : "text-rose-500")}>
              {trend}
            </span>
            {/^[+-]/.test(trend) && (
              <span className="text-[11px] text-muted-foreground/80">{t("common.vsLastMonth")}</span>
            )}
          </div>
        )}
        {href && (
          <p className="mt-1 text-[10px] font-medium text-muted-foreground/60">{t("common.clickToView")}</p>
        )}
      </CardContent>
    </Card>
  );
}
