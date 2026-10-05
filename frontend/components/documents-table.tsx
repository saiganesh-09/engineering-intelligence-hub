"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Document, Chunk } from "@/lib/types";
import { formatBytes, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/shared";

export function DocumentsTable({ poll = true }: { poll?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = user?.role === "admin" || user?.role === "manager";
  const [chunksFor, setChunksFor] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState<Document | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const docs = useQuery({
    queryKey: ["documents"],
    queryFn: () => api.get<Document[]>("/api/documents"),
    refetchInterval: poll ? (q) => {
      const hasActive = (q.state.data ?? []).some(
        (d) => d.status === "pending" || d.status === "processing",
      );
      return hasActive ? 3000 : false;
    } : false,
  });

  const chunks = useQuery({
    queryKey: ["doc-chunks", chunksFor?.id],
    enabled: !!chunksFor,
    queryFn: () => api.get<Chunk[]>(`/api/documents/${chunksFor!.id}/chunks`),
  });

  async function reindex(doc: Document) {
    setBusyId(doc.id);
    try {
      await api.post(`/api/documents/${doc.id}/reindex`);
      toast.success(`Re-indexing "${doc.title}"`);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reindex failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await api.delete(`/api/documents/${deleting.id}`);
      toast.success("Document deleted");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  if (docs.isLoading) return <LoadingRows rows={5} />;
  if (docs.isError)
    return <EmptyState title="Couldn't load documents" body={(docs.error as Error).message} />;
  if (!docs.data?.length)
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        body="Upload PDFs, Markdown, or text files to build your knowledge base."
      />
    );

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.data.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => setChunksFor(d)}
                  >
                    {d.title}
                  </button>
                  <p className="font-mono text-xs text-muted-foreground">{d.file_name}</p>
                  {d.error && (
                    <p className="mt-0.5 max-w-md truncate text-xs text-destructive" title={d.error}>
                      {d.error}
                    </p>
                  )}
                </TableCell>
                <TableCell className="uppercase text-xs">{d.file_type}</TableCell>
                <TableCell className="text-xs">{formatBytes(d.file_size)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge value={d.status} />
                    {(d.status === "pending" || d.status === "processing") && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {timeAgo(d.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Re-index"
                          disabled={busyId === d.id}
                          onClick={() => reindex(d)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => setDeleting(d)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Chunk preview dialog */}
      <Dialog open={!!chunksFor} onOpenChange={(o) => !o && setChunksFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{chunksFor?.title}</DialogTitle>
            <DialogDescription>
              Indexed chunks — the retrievable units used for RAG answers.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
            {chunks.isLoading ? (
              <LoadingRows rows={3} />
            ) : !chunks.data?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No chunks yet — the document may still be processing.
              </p>
            ) : (
              chunks.data.map((c, i) => (
                <div key={c.id} className="rounded-lg border border-border p-3">
                  <div className="mb-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span className="font-medium">Chunk {i + 1}</span>
                    {c.meta?.section ? <span>§ {String(c.meta.section)}</span> : null}
                    {c.meta?.page_start ? <span>p. {String(c.meta.page_start)}</span> : null}
                    <span>{c.token_count} tokens</span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                    {c.content.slice(0, 400)}
                    {c.content.length > 400 ? "…" : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document</DialogTitle>
            <DialogDescription>
              This removes &quot;{deleting?.title}&quot;, its file, and all indexed
              chunks. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busyId === deleting?.id} onClick={remove}>
              {busyId === deleting?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
