"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Search as SearchIcon } from "lucide-react";
import { api } from "@/lib/api";
import type { Repository, SearchResponse, SourceType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, LoadingRows, PageHeader } from "@/components/shared";
import { SourceTypeIcon, sourceTypeLabel } from "@/components/citations";
import { Markdown } from "@/components/markdown";

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "document", label: "Documents" },
  { value: "code", label: "Code" },
  { value: "incident", label: "Incidents" },
  { value: "architecture", label: "Architecture" },
  { value: "runbook", label: "Runbooks" },
];

function SearchInner() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [submitted, setSubmitted] = useState(params.get("q") ?? "");
  const [sourceType, setSourceType] = useState<string>("all");
  const [repository, setRepository] = useState<string>("all");

  const repos = useQuery({
    queryKey: ["repos"],
    queryFn: () => api.get<Repository[]>("/api/repositories"),
  });

  const results = useQuery({
    queryKey: ["search", submitted, sourceType, repository],
    enabled: !!submitted,
    queryFn: () => {
      const p = new URLSearchParams({ q: submitted });
      if (sourceType !== "all") p.append("source_type", sourceType);
      if (repository !== "all") p.append("repository", repository);
      return api.get<SearchResponse>(`/api/search?${p}`);
    },
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Engineering search"
        description="Semantic + keyword search across docs, code, and incidents."
      />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search engineering knowledge…"
          className="h-11 flex-1"
        />
        <Button type="submit" className="h-11" disabled={!query.trim()}>
          <SearchIcon className="mr-1.5 h-4 w-4" /> Search
        </Button>
      </form>

      <div className="mb-6 flex flex-wrap gap-2">
        <Select value={sourceType} onValueChange={(v) => setSourceType(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Source type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All source types</SelectItem>
            {SOURCE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={repository} onValueChange={(v) => setRepository(v ?? "all")}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Repository" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All repositories</SelectItem>
            {repos.data?.map((r) => (
              <SelectItem key={r.id} value={r.name}>
                {r.owner}/{r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!submitted ? (
        <EmptyState
          icon={SearchIcon}
          title="Search your engineering knowledge"
          body="Try: “How does authentication work?”, “kafka consumer lag”, or a function name."
        />
      ) : results.isLoading ? (
        <LoadingRows rows={5} />
      ) : results.isError ? (
        <EmptyState icon={AlertTriangle} title="Search failed" body={(results.error as Error).message} />
      ) : !results.data?.results.length ? (
        <EmptyState
          icon={SearchIcon}
          title={`No results for “${submitted}”`}
          body="Try different keywords, or index more sources."
        />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {results.data.total} result{results.data.total === 1 ? "" : "s"}
          </p>
          {results.data.results.map((r) => (
            <Card key={r.chunk_id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <SourceTypeIcon type={r.source_type} />
                  <span className="text-xs font-medium text-muted-foreground">
                    {sourceTypeLabel(r.source_type)}
                  </span>
                  {r.repository && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {r.repository}
                    </span>
                  )}
                  {r.language && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.language}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {(r.score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="mb-1 font-medium">{r.title}</p>
                {r.file_path && (
                  <p className="mb-2 font-mono text-xs text-muted-foreground">{r.file_path}</p>
                )}
                <p className="line-clamp-3 text-sm text-muted-foreground">{r.snippet}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingRows rows={5} />}>
      <SearchInner />
    </Suspense>
  );
}
