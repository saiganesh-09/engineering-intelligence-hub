"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AIResult, Repository } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function OnboardingPage() {
  const [repoId, setRepoId] = useState("all");
  const [result, setResult] = useState<AIResult | null>(null);
  const [busy, setBusy] = useState(false);

  const repos = useQuery({ queryKey: ["repos"], queryFn: () => api.get<Repository[]>("/api/repositories") });
  async function generate() {
    setBusy(true);
    setResult(null);
    try {
      setResult(
        await api.post<AIResult>("/api/ai/onboarding", {
          repository_id: repoId === "all" ? null : repoId,
        }),
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not generate brief");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader
        title="Onboarding assistant"
        description="Generate a practical onboarding brief for engineers joining the project — grounded in your real docs and code."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Scope</label>
            <Select value={repoId} onValueChange={(v) => setRepoId(v ?? "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All knowledge sources</SelectItem>
                {repos.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id} label={`${r.owner}/${r.name}`}>
                    {r.owner}/{r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-1.5 h-4 w-4" />}
            Generate onboarding brief
          </Button>
        </CardContent>
      </Card>

      {busy && (
        <div className="flex items-center gap-3 rounded-xl border border-border p-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Reviewing docs, READMEs, and code structure…
          </p>
        </div>
      )}

      {result ? (
        <Card>
          <CardContent className="p-6">
            <Markdown content={result.answer} />
            <CitationList sources={result.sources} />
          </CardContent>
        </Card>
      ) : (
        !busy && (
          <EmptyState
            icon={GraduationCap}
            title="I'm new to this project — what should I understand first?"
            body="Generate a brief covering the architecture, key services, dev setup, important docs, common issues, and a suggested learning path."
          />
        )
      )}
    </div>
  );
}
