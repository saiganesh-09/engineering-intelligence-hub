"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Incident, IncidentSeverity, IncidentStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/shared";

const SEVERITIES: IncidentSeverity[] = ["critical", "high", "medium", "low"];
const STATUSES: IncidentStatus[] = ["open", "investigating", "resolved", "closed"];

export function IncidentForm({
  initial,
  onSubmit,
  busy,
}: {
  initial?: Partial<Incident>;
  onSubmit: (data: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [severity, setSeverity] = useState<IncidentSeverity>(initial?.severity ?? "medium");
  const [status, setStatus] = useState<IncidentStatus>(initial?.status ?? "open");
  const [services, setServices] = useState((initial?.affected_services ?? []).join(", "));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [rootCause, setRootCause] = useState(initial?.root_cause ?? "");
  const [resolution, setResolution] = useState(initial?.resolution ?? "");
  const [preventive, setPreventive] = useState(initial?.preventive_actions ?? "");
  const [timeline, setTimeline] = useState(initial?.timeline ?? "");

  return (
    <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
      <div className="space-y-1.5">
        <Label>Title *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short incident summary" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(v) => setSeverity((v ?? "medium") as IncidentSeverity)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus((v ?? "open") as IncidentStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Affected services</Label>
        <Input value={services} onChange={(e) => setServices(e.target.value)} placeholder="payment-service, ledger-service" />
      </div>
      <div className="space-y-1.5">
        <Label>Description *</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What happened, impact, when detected…" />
      </div>
      <div className="space-y-1.5">
        <Label>Root cause</Label>
        <Textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Resolution</Label>
        <Textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Preventive actions</Label>
        <Textarea value={preventive} onChange={(e) => setPreventive(e.target.value)} rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>Timeline</Label>
        <Textarea value={timeline} onChange={(e) => setTimeline(e.target.value)} rows={2} placeholder="14:02 alert fired → 14:15 rollback…" />
      </div>
      <DialogFooter>
        <Button
          disabled={busy || !title.trim() || !description.trim()}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              severity,
              status,
              description,
              root_cause: rootCause || null,
              resolution: resolution || null,
              preventive_actions: preventive || null,
              timeline: timeline || null,
              affected_services: services.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save incident
        </Button>
      </DialogFooter>
    </div>
  );
}

export function IncidentsPanel({
  createOpen,
  setCreateOpen,
  compact,
}: {
  createOpen?: boolean;
  setCreateOpen?: (o: boolean) => void;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const showCreate = createOpen ?? open;
  const setShowCreate = setCreateOpen ?? setOpen;

  const incidents = useQuery({
    queryKey: ["incidents"],
    queryFn: () => api.get<Incident[]>("/api/incidents"),
  });

  async function create(data: Record<string, unknown>) {
    setBusy(true);
    try {
      await api.post("/api/incidents", data);
      toast.success("Incident recorded and indexed for search");
      setShowCreate(false);
      qc.invalidateQueries({ queryKey: ["incidents"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create incident");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New incident
        </Button>
      </div>

      {incidents.isLoading ? (
        <LoadingRows rows={4} />
      ) : incidents.isError ? (
        <EmptyState title="Couldn't load incidents" body={(incidents.error as Error).message} />
      ) : !incidents.data?.length ? (
        <EmptyState
          icon={ShieldAlert}
          title="No incidents recorded"
          body="Document incidents so the AI can answer “have we seen this before?”"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Link href={`/incidents/${i.id}`} className="font-medium hover:underline">
                      {i.title}
                    </Link>
                  </TableCell>
                  <TableCell><StatusBadge value={i.severity} /></TableCell>
                  <TableCell><StatusBadge value={i.status} /></TableCell>
                  <TableCell>
                    <div className="flex max-w-52 flex-wrap gap-1">
                      {i.affected_services.map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {s}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(i.occurred_at ?? i.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New incident report</DialogTitle>
            <DialogDescription>
              Indexed automatically — the AI can surface it in future answers.
            </DialogDescription>
          </DialogHeader>
          <IncidentForm onSubmit={create} busy={busy} />
        </DialogContent>
      </Dialog>
    </>
  );
}
