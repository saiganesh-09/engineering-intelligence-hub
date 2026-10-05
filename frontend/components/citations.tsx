"use client";

import { useState } from "react";
import {
  BookOpen,
  Code2,
  ExternalLink,
  FileText,
  FileWarning,
  ScrollText,
  Network,
  HelpCircle,
} from "lucide-react";
import type { Citation, RetrievedSource, SourceType } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TYPE_META: Record<SourceType, { icon: typeof FileText; label: string; cls: string }> = {
  document: { icon: FileText, label: "Document", cls: "text-blue-500" },
  code: { icon: Code2, label: "Code", cls: "text-emerald-500" },
  incident: { icon: FileWarning, label: "Incident", cls: "text-red-500" },
  runbook: { icon: ScrollText, label: "Runbook", cls: "text-amber-500" },
  architecture: { icon: Network, label: "Architecture", cls: "text-violet-500" },
  faq: { icon: HelpCircle, label: "FAQ", cls: "text-cyan-500" },
};

export function SourceTypeIcon({ type, className }: { type: SourceType; className?: string }) {
  const Meta = TYPE_META[type] ?? TYPE_META.document;
  return <Meta.icon className={cn("h-4 w-4", Meta.cls, className)} />;
}

export function sourceTypeLabel(type: SourceType) {
  return (TYPE_META[type] ?? TYPE_META.document).label;
}

interface SourceLike {
  chunk_id: string | null;
  source_type: SourceType;
  title: string;
  path?: string | null;
  repository?: string | null;
  snippet?: string;
  score?: number;
  meta?: Citation["meta"];
}

export function CitationList({ sources }: { sources: SourceLike[] }) {
  const [preview, setPreview] = useState<SourceLike | null>(null);
  if (!sources.length) return null;

  return (
    <div className="mt-4 border-t border-border pt-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" /> Sources
      </p>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => (
          <button
            key={s.chunk_id ?? i}
            onClick={() => setPreview(s)}
            className="flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs transition-colors hover:bg-muted"
          >
            <SourceTypeIcon type={s.source_type} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-medium">
              [{i + 1}] {s.path ?? s.title}
            </span>
            {(s.meta?.url || undefined) && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </button>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <SourceTypeIcon type={preview.source_type} />
                  <span className="truncate">{preview.title}</span>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{sourceTypeLabel(preview.source_type)}</span>
                  {preview.path && <span className="font-mono">{preview.path}</span>}
                  {preview.repository && <span>repo: {preview.repository}</span>}
                  {preview.meta?.section ? <span>§ {String(preview.meta.section)}</span> : null}
                  {preview.meta?.page_start ? <span>p. {String(preview.meta.page_start)}</span> : null}
                  {typeof preview.score === "number" && (
                    <span>relevance {(preview.score * 100).toFixed(0)}%</span>
                  )}
                </div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                  {preview.snippet || preview.meta?.snippet as string || "No preview available"}
                </pre>
                {preview.meta?.url ? (
                  <a
                    href={String(preview.meta.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Open on GitHub <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
