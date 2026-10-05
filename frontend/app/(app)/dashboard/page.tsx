"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  FolderGit2,
  GraduationCap,
  HelpCircle,
  Layers,
  MessageSquareText,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ActivityItem, DashboardStats, PopularQuestion } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, LoadingRows, StatusBadge } from "@/components/shared";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON = {
  document: FileText,
  repository: FolderGit2,
  incident: ShieldAlert,
  conversation: MessageSquareText,
} as const;

const QUICK_ACTIONS = [
  { href: "/sources", icon: Upload, label: "Upload document", desc: "PDF, MD, TXT, DOCX" },
  { href: "/repositories", icon: FolderGit2, label: "Connect repo", desc: "Index a GitHub repo" },
  { href: "/incidents", icon: ShieldAlert, label: "Report incident", desc: "Log a post-mortem" },
  { href: "/onboarding", icon: GraduationCap, label: "Onboarding brief", desc: "New-engineer guide" },
];

function Stat({
  label, value, icon: Icon, hint, accent,
}: {
  label: string; value?: number; icon: typeof FileText; hint?: string; accent: string;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", accent)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight">{value ?? "—"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {label}{hint ? ` · ${hint}` : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [ask, setAsk] = useState("");
  const stats = useQuery({ queryKey: ["stats"], queryFn: () => api.get<DashboardStats>("/api/dashboard/stats") });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => api.get<ActivityItem[]>("/api/dashboard/activity") });
  const popular = useQuery({ queryKey: ["popular"], queryFn: () => api.get<PopularQuestion[]>("/api/dashboard/popular-questions") });

  const s = stats.data;
  const totalSources = (s?.documents ?? 0) + (s?.repositories ?? 0);
  const healthy = totalSources > 0 ? Math.round(((totalSources - (s?.failed_indexing ?? 0)) / totalSources) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Hero + quick ask */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-violet-500/10 to-cyan-500/10 p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,var(--color-primary)/12,transparent_50%)]" />
        <div className="relative">
          <h1 className="text-xl font-bold tracking-tight">
            Welcome back, {user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask anything about your docs, code, or incidents — every answer cites its sources.
          </p>
          <form
            className="mt-4 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (ask.trim()) router.push(`/chat?q=${encodeURIComponent(ask.trim())}`);
            }}
          >
            <Input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="e.g. How does the payment service process a transaction?"
              className="h-10 flex-1 bg-background/80 backdrop-blur"
            />
            <Button type="submit" disabled={!ask.trim()}>
              <BrainCircuit className="mr-1.5 h-4 w-4" /> Ask
            </Button>
          </form>
        </div>
      </div>

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
          <Stat label="Documents" value={s?.documents} icon={FileText} accent="bg-violet-500/10 text-violet-500" />
          <Stat label="Repositories" value={s?.repositories} icon={FolderGit2} accent="bg-cyan-500/10 text-cyan-500" />
          <Stat label="Knowledge chunks" value={s?.chunks} icon={Layers} accent="bg-emerald-500/10 text-emerald-500" />
          <Stat
            label="Incidents"
            value={s?.incidents}
            icon={ShieldAlert}
            hint={s?.open_incidents ? `${s.open_incidents} open` : undefined}
            accent="bg-amber-500/10 text-amber-500"
          />
          <Stat label="AI questions" value={s?.questions} icon={HelpCircle} accent="bg-rose-500/10 text-rose-500" />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Activity */}
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
                  const href =
                    a.kind === "repository" ? "/repositories"
                    : a.kind === "incident" ? "/incidents"
                    : a.kind === "conversation" ? "/conversations"
                    : "/documents";
                  return (
                    <li key={i}>
                      <Link href={href} className="group flex items-center gap-3 py-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:text-primary">
                            {a.title}
                          </p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {a.kind} · {timeAgo(a.timestamp)}
                          </p>
                        </div>
                        {a.status && <StatusBadge value={a.status} />}
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Knowledge health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4" /> Knowledge health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold">{totalSources ? `${healthy}%` : "—"}</span>
                <span className="text-xs text-muted-foreground">sources healthy</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", healthy >= 90 ? "bg-emerald-500" : healthy >= 60 ? "bg-amber-500" : "bg-rose-500")}
                  style={{ width: `${healthy}%` }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                  <p className="font-semibold">{s?.documents ?? 0}</p>
                  <p className="text-muted-foreground">documents</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-2.5 py-2">
                  <p className={cn("font-semibold", (s?.failed_indexing ?? 0) > 0 && "text-destructive")}>
                    {s?.failed_indexing ?? 0}
                  </p>
                  <p className="text-muted-foreground">failed</p>
                </div>
              </div>
              {(s?.failed_indexing ?? 0) > 0 && (
                <Link href="/sources" className="mt-2 block text-xs font-medium text-primary hover:underline">
                  Review failed sources →
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Popular questions */}
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
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Questions your team asks will appear here.
                </p>
              ) : (
                <ul className="space-y-2">
                  {popular.data.map((p, i) => (
                    <li key={i}>
                      <Link
                        href={`/chat?q=${encodeURIComponent(p.question)}`}
                        className="block rounded-lg border border-border p-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5"
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
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <a.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{a.label}</p>
              <p className="truncate text-xs text-muted-foreground">{a.desc}</p>
            </div>
            <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
