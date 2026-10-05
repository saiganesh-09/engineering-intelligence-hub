"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, Flame, ShieldAlert, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import type { IncidentStats } from "@/lib/types";
import { PageHeader, StatCard } from "@/components/shared";
import { IncidentsPanel } from "@/components/incidents-panel";

export default function IncidentsPage() {
  const stats = useQuery({
    queryKey: ["incident-stats"],
    queryFn: () => api.get<IncidentStats>("/api/incidents/stats/summary"),
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Incident intelligence"
        description="Incident reports are indexed so AI answers can cite past failures."
      />

      {stats.data && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total incidents" value={stats.data.total} icon={ShieldAlert} />
          <StatCard label="Open / investigating" value={stats.data.open} icon={AlertOctagon} />
          <StatCard label="Critical" value={stats.data.by_severity?.critical ?? 0} icon={Flame} />
          <StatCard
            label="Most affected service"
            value={stats.data.most_affected_services?.[0]?.service ?? "—"}
            icon={Wrench}
            hint={stats.data.most_affected_services?.[0] ? `${stats.data.most_affected_services[0].count} incidents` : undefined}
          />
        </div>
      )}

      <IncidentsPanel />
    </div>
  );
}
