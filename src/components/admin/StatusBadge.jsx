import { cn } from "@/lib/utils";
import {
  Clock,
  Play,
  CheckCircle2,
  FileText,
  XCircle,
  Package,
  Truck,
  ArrowRightCircle,
  RotateCcw,
  CircleDot,
  CircleOff,
  PackageCheck,
} from "lucide-react";

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  },
  active: {
    label: "Active",
    icon: Play,
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  completed: {
    label: "Completed",
    icon: CheckCircle2,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  draft: {
    label: "Draft",
    icon: FileText,
    className: "bg-muted text-muted-foreground border-border",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    className: "bg-destructive/15 text-red-400 border-destructive/20",
  },
  picked: {
    label: "Picked",
    icon: Package,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  shipped: {
    label: "Shipped",
    icon: Truck,
    className: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
  assigned_to_run: {
    label: "Assigned to Run",
    icon: ArrowRightCircle,
    className: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  },
  processed: {
    label: "Processed",
    icon: PackageCheck,
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: CircleOff,
    className: "bg-destructive/15 text-red-400 border-destructive/20",
  },
  not_found: {
    label: "Not Found",
    icon: XCircle,
    className: "bg-destructive/15 text-red-400 border-destructive/20",
  },
  dropped_off: {
    label: "Dropped Off",
    icon: CircleDot,
    className: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  },
  returned: {
    label: "Returned",
    icon: RotateCcw,
    className: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  },
};

export default function StatusBadge({ status, className: customClassName }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        config.className,
        customClassName
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

export { STATUS_CONFIG };
