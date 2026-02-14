import React from "react";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Inbox,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import EmptyState from "@/components/admin/EmptyState";
import TableSkeleton from "@/components/admin/skeletons/TableSkeleton";

export default function DataTable({
  columns = [],
  data = [],
  sortBy,
  sortOrder,
  onSort,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  emptyIcon = Inbox,
  emptyMessage = "No data found",
  isLoading = false,
  mobileCardRender,
  className,
}) {
  const isMobile = useIsMobile();

  // Selection helpers
  const allSelected =
    data.length > 0 && data.every((row) => selectedIds.includes(row.id));
  const someSelected =
    data.some((row) => selectedIds.includes(row.id)) && !allSelected;

  function handleSelectAll() {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row) => row.id));
    }
  }

  function handleSelectRow(rowId) {
    if (!onSelectionChange) return;
    if (selectedIds.includes(rowId)) {
      onSelectionChange(selectedIds.filter((id) => id !== rowId));
    } else {
      onSelectionChange([...selectedIds, rowId]);
    }
  }

  function handleSort(column) {
    if (!column.sortable || !onSort) return;
    onSort(column.key);
  }

  function getSortIcon(columnKey) {
    if (sortBy !== columnKey) {
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 text-primary" />
    );
  }

  // Loading state
  if (isLoading) {
    return <TableSkeleton rows={5} cols={columns.length || 6} />;
  }

  // Empty state
  if (data.length === 0) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyMessage}
        className="py-12"
      />
    );
  }

  // Mobile card view
  if (isMobile && mobileCardRender) {
    return (
      <div className={cn("divide-y divide-border", className)}>
        {data.map((row) => (
          <div key={row.id} className="relative">
            {selectable && (
              <div className="absolute left-3 top-3 z-10">
                <Checkbox
                  checked={selectedIds.includes(row.id)}
                  onCheckedChange={() => handleSelectRow(row.id)}
                />
              </div>
            )}
            {mobileCardRender(row)}
          </div>
        ))}
      </div>
    );
  }

  // Desktop table view
  return (
    <div className={cn("relative w-full overflow-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            {selectable && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
            )}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={cn(
                  column.sortable && "cursor-pointer select-none",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                  column.className
                )}
                onClick={() => handleSort(column)}
              >
                <div
                  className={cn(
                    "flex items-center",
                    column.align === "right" && "justify-end",
                    column.align === "center" && "justify-center"
                  )}
                >
                  {column.label}
                  {column.sortable && getSortIcon(column.key)}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={row.id}
              className={cn(
                "border-border transition-colors hover:bg-muted/50",
                selectable &&
                  selectedIds.includes(row.id) &&
                  "bg-primary/5"
              )}
            >
              {selectable && (
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(row.id)}
                    onCheckedChange={() => handleSelectRow(row.id)}
                  />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  className={cn(
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.cellClassName
                  )}
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
