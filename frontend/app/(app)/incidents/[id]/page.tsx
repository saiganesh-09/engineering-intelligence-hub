"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BrainCircuit, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { AIResult, Incident, RetrievedSource } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState, LoadingRows, PageHeader, StatusBadge } from "@/components/shared";
import { Markdown } from "@/components/markdown";
import { CitationList } from "@/components/citations";
import { IncidentForm } from "@/components/incidents-panel";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
    </div>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "manager";
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<AIResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const incident = useQuery({
    queryKey: ["incident", id],
    queryFn: () => api.get<Incident>(`/api/incidents/${id}`),
  });
  const similar = useQuery({
    queryKey: ["incident-similar", id],
    queryFn: () => api.get<RetrievedSource[]>(`/api/incidents/${id}/similar`),
  });

  async function update(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.patch(`/api/incidents/${id}`, data);
      toast.success("Incident updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["incident", id] });
      qc.invalidateQueries({ queryKey: ["incidents"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/api/incidents/${id}`);
      toast.success("Incident deleted");
      router.push("/incidents");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
      setBusy(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      setAnalysis(await api.post<AIResult>(`/api/incidents/${id}/analyze`));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (incident.isLoading) return <div className="p-6"><LoadingRows rows={6} /></div>;
  if (!incident.data)
    return <div className="p-6"><EmptyState title="Incident not found" /></div>;

  const inc = incident.data;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/incidents" />}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> All incidents
        </Button>
      </div>
      <PageHeader
        title={inc.title}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
            </Button>
            <Button size="sm" disabled={analyzing} onClick={analyze}>
              {analyzing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-1.5 h-4 w-4" />}
              AI analysis
            </Button>
            {canManage && (
              <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={inc.severity} />
        <StatusBadge value={inc.status} />
        {inc.affected_services.map((s) => (
          <span key={s} className="rounded bg-muted px-2 py-0.5 font-mono text-xs">{s}</span>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDateTime(inc.occurred_at ?? inc.created_at)}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="space-y-5 p-5">
            <Field label="Description" value={inc.description} />
            <Field label="Timeline" value={inc.timeline} />
            <Field label="Root cause" value={inc.root_cause} />
            <Field label="Resolution" value={inc.resolution} />
            <Field label="Preventive actions" value={inc.preventive_actions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4" /> Similar incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            {similar.isLoading ? (
              <LoadingRows rows={2} />
            ) : !similar.data?.length ? (
              <p className="text-sm text-muted-foreground">No similar incidents found.</p>
            ) : (
              <ul className="space-y-2">
                {similar.data.map((s) => (
                  <li key={s.chunk_id}>
                    <Link
                      href={`/incidents/${s.source_id}`}
                      className="block rounded-lg border border-border p-2.5 text-sm hover:bg-muted/60"
                    >
                      <p className="font-medium">{s.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {(s.score * 100).toFixed(0)}% similar
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(analyzing || analysis) && (
        <Card className="mt-4 border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <BrainCircuit className="h-4 w-4 text-primary" /> AI incident analysis
            </p>
            {analyzing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing incident and related sources…
              </div>
            ) : (
              analysis && (
                <>
                  <Markdown content={analysis.answer} />
                  <CitationList sources={analysis.sources} />
                </>
              )
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit incident</DialogTitle>
          </DialogHeader>
          <IncidentForm initial={inc} onSubmit={update} busy={busy} />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete incident</DialogTitle>
            <DialogDescription>
              Permanently delete &quot;{inc.title}&quot; and remove it from the knowledge index.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={remove}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
