"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode2,
  FolderClosed,
  FolderOpen,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AIResult, CodeFileContent, RepoTreeNode, Repository } from "@/lib/types";
import { formatBytes, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/shared";
import { Markdown } from "@/components/markdown";

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: RepoTreeNode;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  if (node.type === "file") {
    return (
      <button
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[13px]",
          selected === node.path ? "bg-accent font-medium" : "hover:bg-accent/50",
        )}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono">{node.name}</span>
      </button>
    );
  }
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[13px] hover:bg-accent/50"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
        {open ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <FolderClosed className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <span className="truncate font-mono">{node.name}</span>
      </button>
      {open &&
        node.children.map((c) => (
          <TreeNode key={c.path} node={c} depth={depth + 1} selected={selected} onSelect={onSelect} />
        ))}
    </div>
  );
}

export default function RepoExplorerPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<AIResult | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [question, setQuestion] = useState("");

  const repo = useQuery({
    queryKey: ["repo", id],
    queryFn: () => api.get<Repository>(`/api/repositories/${id}`),
    refetchInterval: (q) =>
      q.state.data?.indexing_status === "indexing" || q.state.data?.indexing_status === "pending"
        ? 3000
        : false,
  });
  const tree = useQuery({
    queryKey: ["repo-tree", id],
    queryFn: () => api.get<RepoTreeNode>(`/api/repositories/${id}/tree`),
  });
  const file = useQuery({
    queryKey: ["repo-file", id, selectedPath],
    enabled: !!selectedPath,
    queryFn: () =>
      api.get<CodeFileContent>(
        `/api/repositories/${id}/file?path=${encodeURIComponent(selectedPath!)}`,
      ),
  });

  const readme = useMemo(() => {
    if (!selectedPath) {
      const find = (n: RepoTreeNode): string | null => {
        if (n.type === "file" && /^readme/i.test(n.name)) return n.path;
        for (const c of n.children ?? []) {
          const f = find(c);
          if (f) return f;
        }
        return null;
      };
      return tree.data ? find(tree.data) : null;
    }
    return null;
  }, [tree.data, selectedPath]);

  // Auto-open README when nothing is selected.
  if (readme && !file.isLoading && !file.data && !file.isFetching) {
    setSelectedPath(readme);
  }

  async function explain(q?: string) {
    if (!file.data) return;
    setExplaining(true);
    setExplanation(null);
    try {
      const res = await api.post<AIResult>("/api/ai/explain-code", {
        code_file_id: file.data.id,
        question: q ?? null,
      });
      setExplanation(res);
      setQuestion("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Explanation failed");
    } finally {
      setExplaining(false);
    }
  }

  const r = repo.data;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/repositories" />}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          {repo.isLoading ? (
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          ) : r ? (
            <>
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {r.owner}/{r.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.branch} · {r.file_count} files
                  {r.last_indexed_at && ` · indexed ${timeAgo(r.last_indexed_at)}`}
                </p>
              </div>
              <StatusBadge value={r.indexing_status} />
            </>
          ) : null}
        </div>
        {r && (
          <a href={r.url} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open on GitHub
            </Button>
          </a>
        )}
      </div>

      {r?.indexing_status !== "completed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          {r?.indexing_status === "failed" ? (
            <EmptyState title="Indexing failed" body={r.error ?? undefined} />
          ) : (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Indexing repository — this can take a few minutes…
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {/* File tree */}
          <ScrollArea className="w-72 shrink-0 border-r border-border">
            <div className="p-2">
              {tree.isLoading ? (
                <LoadingRows rows={8} />
              ) : tree.data ? (
                <TreeNode node={tree.data} depth={0} selected={selectedPath} onSelect={(p) => { setSelectedPath(p); setExplanation(null); }} />
              ) : (
                <p className="p-3 text-sm text-muted-foreground">No files indexed.</p>
              )}
            </div>
          </ScrollArea>

          {/* File viewer */}
          <div className="flex min-w-0 flex-1 flex-col">
            {!selectedPath ? (
              <EmptyState icon={FileCode2} title="Select a file" body="Browse the tree on the left." />
            ) : file.isLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : file.data ? (
              <ScrollArea className="min-w-0 flex-1">
                <div className="p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-medium">{file.data.file_path}</p>
                      <div className="mt-1 flex gap-2">
                        {file.data.language && <Badge variant="secondary" className="text-xs">{file.data.language}</Badge>}
                        <span className="text-xs text-muted-foreground">{formatBytes(file.data.size)}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" disabled={explaining} onClick={() => explain()}>
                      {explaining ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      Explain this file
                    </Button>
                  </div>
                  <Markdown content={`\`\`\`${file.data.language ?? ""}\n${file.data.content}\n\`\`\``} />

                  {(explanation || explaining) && (
                    <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                        <BrainCircuit className="h-4 w-4 text-primary" /> AI explanation
                      </p>
                      {explaining ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing file…
                        </div>
                      ) : (
                        explanation && <Markdown content={explanation.answer} />
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState title="File not found" />
            )}

            {file.data && (
              <form
                className="flex gap-2 border-t border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (question.trim()) explain(question.trim());
                }}
              >
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask AI about this file… e.g. “explain this function”"
                  className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <Button type="submit" size="sm" disabled={explaining || !question.trim()}>
                  Ask
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
