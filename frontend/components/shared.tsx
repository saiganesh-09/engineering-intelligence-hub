"use client";

import { FileQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const STATUS_STYLE: Record<string, { className: string; icon?: React.ReactNode }> = {
  indexed: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  completed: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  resolved: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  pending: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  processing: { className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  indexing: { className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  investigating: { className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  failed: { className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
  open: { className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
  closed: { className: "bg-muted text-muted-foreground border-border" },
  critical: { className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20" },
  high: { className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  medium: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  low: { className: "bg-muted text-muted-foreground border-border" },
  admin: { className: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  manager: { className: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  developer: { className: "bg-muted text-muted-foreground border-border" },
};

export function StatusBadge({ value }: { value: string }) {
  const style = STATUS_STYLE[value] ?? STATUS_STYLE.closed;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", style.className)}>
      {value}
    </Badge>
  );
}

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  body,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold leading-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}{hint ? ` · ${hint}` : ""}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}
