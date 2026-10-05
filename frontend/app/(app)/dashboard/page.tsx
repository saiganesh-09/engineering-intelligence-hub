"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  FileText,
  FolderGit2,
  HelpCircle,
  Layers,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityItem, DashboardStats, PopularQuestion } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingRows, PageHeader, StatCard, StatusBadge } from "@/components/shared";

const ACTIVITY_ICON = {
  document: FileText,
  repository: FolderGit2,
  incident: ShieldAlert,
  conversation: MessageSquareText,
} as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api.get<DashboardStats>("/api/dashboard/stats") });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api.get<ActivityItem[]>("/api/dashboard/activity") });
  const popular = useQuery({ queryKey: ["popular"], queryFn: () => api.get<PopularQuestion[]>("/api/dashboard/popular-questions") });

  const s = stats.data;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0] ?? "there"}`}
        description="Here's what's happening across your engineering knowledge base."
        actions={
          <Button size="sm" render={<Link href="/chat" />}>
            <BrainCircuit className="mr-1.5 h-4 w-4" /> Ask a question
          </Button>
        }
      />

      {stats.isLoading ? (
        <LoadingRows rows={3} />
      ) : stats.isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Couldn't load dashboard"
          body={(stats.error as Error).message}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Documents" value={s?.documents} icon={FileText} />
          <StatCard label="Repositories" value={s?.repositories} icon={FolderGit2} />
          <StatCard label="Knowledge chunks" value={s?.chunks} icon={Layers} />
          <StatCard
            label="Incidents"
            value={s?.incidents}
            icon={ShieldAlert}
            hint={s?.open_incidents ? `${s.open_incidents} open` : undefined}
          />
          <StatCard label="AI questions" value={s?.questions} icon={HelpCircle} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.isLoading ? (
              <LoadingRows rows={5} />
            ) : !activity.data?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No activity yet — upload a document or connect a repository to get started.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.data.map((a, i) => {
                  const Icon = ACTIVITY_ICON[a.kind] ?? FileText;
                  return (
                    <li key={i} className="flex items-center gap-3 py-2.5">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.title}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {a.kind} · {timeAgo(a.timestamp)}
                        </p>
                      </div>
                      {a.status && <StatusBadge value={a.status} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4" /> Popular questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {popular.isLoading ? (
              <LoadingRows rows={4} />
            ) : !popular.data?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Questions your team asks will appear here.
              </p>
            ) : (
              <ul className="space-y-2">
                {popular.data.map((p, i) => (
                  <li key={i}>
                    <Link
                      href={`/chat?q=${encodeURIComponent(p.question)}`}
                      className="block rounded-lg border border-border p-2.5 text-sm transition-colors hover:bg-muted/60"
                    >
                      <p className="line-clamp-2">{p.question}</p>
                      {p.count > 1 && (
                        <p className="mt-1 text-xs text-muted-foreground">asked {p.count}×</p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!!s?.failed_indexing && (
        <Card className="mt-4 border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-sm">
              <span className="font-medium">{s.failed_indexing} source(s) failed indexing.</span>{" "}
              <Link href="/sources" className="text-primary underline">
                Review knowledge sources
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
