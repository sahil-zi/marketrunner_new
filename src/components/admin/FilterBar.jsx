import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function FilterBar({
  children,
  className,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
}) {
  return (
    <Card className={cn("border-border bg-card", className)}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {onSearchChange !== undefined && (
            <div className="relative flex-1 min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>
          )}
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
