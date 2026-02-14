import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export default function TableSkeleton({ rows = 5, cols = 6, className }) {
  return (
    <div className={cn("w-full", className)}>
      {/* Header row */}
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: cols }).map((_, colIdx) => (
          <Skeleton
            key={`head-${colIdx}`}
            className={cn(
              "h-4 rounded",
              colIdx === 0 ? "w-32" : "w-20",
              "flex-1"
            )}
          />
        ))}
      </div>

      {/* Body rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="flex items-center gap-4 border-b border-border px-4 py-3"
        >
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={`cell-${rowIdx}-${colIdx}`}
              className={cn(
                "h-4 rounded flex-1",
                colIdx === 0 ? "w-32" : "w-20"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
