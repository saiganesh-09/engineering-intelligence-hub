"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FolderGit2, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Repository } from "@/lib/types";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/shared";

export function RepositoriesList({ onConnect }: { onConnect?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = user?.role === "admin" || user?.role === "manager";

  const repos = useQuery({
    queryKey: ["repos"],
    queryFn: () => api.get<Repository[]>("/api/repositories"),
    refetchInterval: (q) => {
      const active = (q.state.data ?? []).some(
        (r) => r.indexing_status === "indexing" || r.indexing_status === "pending",
      );
      return active ? 3000 : false;
    },
  });

  async function reindex(repo: Repository) {
    try {
      await api.post(`/api/repositories/${repo.id}/index`);
      toast.success(`Re-indexing ${repo.owner}/${repo.name}`);
      qc.invalidateQueries({ queryKey: ["repos"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Reindex failed");
    }
  }

  async function remove(repo: Repository) {
    try {
      await api.delete(`/api/repositories/${repo.id}`);
      toast.success(`Removed ${repo.owner}/${repo.name}`);
      qc.invalidateQueries({ queryKey: ["repos"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  }

  if (repos.isLoading) return <LoadingRows rows={4} />;
  if (repos.isError)
    return <EmptyState title="Couldn't load repositories" body={(repos.error as Error).message} />;
  if (!repos.data?.length)
    return (
      <EmptyState
        icon={FolderGit2}
        title="No repositories connected"
        body="Connect a GitHub repo to index its code and documentation."
        action={
          canManage && onConnect ? (
            <Button size="sm" onClick={onConnect}>
              Connect repository
            </Button>
          ) : undefined
        }
      />
    );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {repos.data.map((r) => (
        <Card key={r.id} className="transition-shadow hover:shadow-md">
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link
                href={`/repositories/${r.id}`}
                className="flex min-w-0 items-center gap-2 font-medium hover:underline"
              >
                <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {r.owner}/{r.name}
                </span>
              </Link>
              <div className="flex items-center gap-1">
                <StatusBadge value={r.indexing_status} />
                {(r.indexing_status === "indexing" || r.indexing_status === "pending") && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{r.branch}</span>
              <span>{r.file_count} files</span>
              <span>
                {r.last_indexed_at ? `indexed ${timeAgo(r.last_indexed_at)}` : "not indexed yet"}
              </span>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 hover:text-foreground"
              >
                GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {r.error && (
              <p className="mb-2 line-clamp-2 text-xs text-destructive">{r.error}</p>
            )}
            {canManage && (
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" onClick={() => reindex(r)}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Re-index
                </Button>
                <Button variant="outline" size="sm" render={<Link href={`/repositories/${r.id}`} />}>
                  Explore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-destructive"
                  onClick={() => remove(r)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
