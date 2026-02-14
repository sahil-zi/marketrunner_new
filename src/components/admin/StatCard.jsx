import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const VARIANT_STYLES = {
  default: {
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    accent: "",
  },
  success: {
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    accent: "border-l-2 border-l-emerald-500",
  },
  warning: {
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    accent: "border-l-2 border-l-amber-500",
  },
  info: {
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    accent: "border-l-2 border-l-blue-500",
  },
  accent: {
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    accent: "border-l-2 border-l-primary",
  },
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  variant = "default",
  isLoading = false,
  className,
}) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.default;

  if (isLoading) {
    return (
      <Card className={cn("border-border bg-card", styles.accent, className)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const isTrendPositive = trend && !trend.startsWith("-");

  return (
    <Card className={cn("border-border bg-card", styles.accent, className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  isTrendPositive ? "text-emerald-400" : "text-red-400"
                )}
              >
                {isTrendPositive ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                <span>{trend}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                styles.iconBg
              )}
            >
              <Icon className={cn("h-5 w-5", styles.iconColor)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
