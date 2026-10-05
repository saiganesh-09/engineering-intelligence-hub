"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Loader2, Network } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AIResult, Document, Repository } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { CitationList } from "@/components/citations";

export default function ArchitecturePage() {
  const [topic, setTopic] = useState("system architecture");
  const [scope, setScope] = useState("all");
  const [result, setResult] = useState<AIResult | null>(null);
  const [busy, setBusy] = useState(false);

  const docs = useQuery({ queryKey: ["documents"], queryFn: () => api.get<Document[]>("/api/documents") });
  const repos = useQuery({ queryKey: ["repos"], queryFn: () => api.get<Repository[]>("/api/repositories") });

  const archDocs = (docs.data ?? []).filter((d) => d.source_type === "architecture" || d.status === "indexed");
  const hasSources = (docs.data?.length ?? 0) > 0 || (repos.data?.length ?? 0) > 0;

  async function analyze() {
    setBusy(true);
    setResult(null);
    try {
      const payload: Record<string, string> = { topic: topic.trim() || "system architecture" };
      if (scope.startsWith("doc:")) payload.document_id = scope.slice(4);
      if (scope.startsWith("repo:")) payload.repository_id = scope.slice(5);
      setResult(await api.post<AIResult>("/api/ai/explain-architecture", payload));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Analysis failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Architecture intelligence"
        description="AI-generated analysis of services, dependencies, and data flow — grounded in your indexed sources."
      />

      {!hasSources && !docs.isLoading && !repos.isLoading ? (
        <EmptyState
          icon={Network}
          title="No architecture sources yet"
          body="Upload architecture docs or connect a repository, then come back to generate an analysis."
        />
      ) : (
        <Card className="mb-6">
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-56 flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Topic</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. payment system, auth flow, data pipeline"
              />
            </div>
            <div className="w-64 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Scope</label>
              <Select value={scope} onValueChange={(v) => setScope(v ?? "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All knowledge sources</SelectItem>
                  {archDocs.map((d) => (
                    <SelectItem key={d.id} value={`doc:${d.id}`} label={`Doc: ${d.title}`}>
                      Doc: {d.title}
                    </SelectItem>
                  ))}
                  {repos.data?.map((r) => (
                    <SelectItem key={r.id} value={`repo:${r.id}`} label={`Repo: ${r.owner}/${r.name}`}>
                      Repo: {r.owner}/{r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={analyze} disabled={busy}>
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-1.5 h-4 w-4" />}
              Analyze
            </Button>
          </CardContent>
        </Card>
      )}

      {busy && (
        <div className="flex items-center gap-3 rounded-xl border border-border p-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Retrieving architecture sources and generating analysis…
          </p>
        </div>
      )}

      {result && (
        <Card>
          <CardContent className="p-6">
            <Markdown content={result.answer} />
            <CitationList sources={result.sources} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
