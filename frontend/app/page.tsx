import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileSearch,
  FileText,
  FolderGit2,
  Layers,
  MessageSquareText,
  Network,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Source-backed AI answers",
    body: "Every answer cites the exact docs, code, and incidents it used — click through to the source.",
    accent: "from-violet-500/20 to-violet-500/0 text-violet-500",
  },
  {
    icon: FileSearch,
    title: "Hybrid engineering search",
    body: "Semantic + keyword retrieval across documentation, repositories, runbooks, and incident reports.",
    accent: "from-cyan-500/20 to-cyan-500/0 text-cyan-500",
  },
  {
    icon: FolderGit2,
    title: "Repository intelligence",
    body: "Connect GitHub repos — code is chunked by function and class, explorable, and explainable.",
    accent: "from-emerald-500/20 to-emerald-500/0 text-emerald-500",
  },
  {
    icon: ShieldAlert,
    title: "Incident intelligence",
    body: "“Have we seen this before?” — similar-incident retrieval and AI post-mortem analysis.",
    accent: "from-amber-500/20 to-amber-500/0 text-amber-500",
  },
  {
    icon: Network,
    title: "Architecture insights",
    body: "Services, dependencies, and data flow extracted from your architecture documentation.",
    accent: "from-rose-500/20 to-rose-500/0 text-rose-500",
  },
  {
    icon: BrainCircuit,
    title: "Onboarding briefs",
    body: "A practical learning path for new engineers, generated from your real docs and code.",
    accent: "from-sky-500/20 to-sky-500/0 text-sky-500",
  },
];

const PIPELINE = [
  { icon: FileText, step: "Ingest", body: "Docs, PDFs, repos, incident reports" },
  { icon: Layers, step: "Chunk", body: "Structure-aware sections & AST symbols" },
  { icon: Database, step: "Embed", body: "pgvector + metadata indexing" },
  { icon: Sparkles, step: "Answer", body: "Grounded generation with citations" },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-400 shadow-md shadow-primary/25">
              <BrainCircuit className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">Engineering Intelligence Hub</p>
              <p className="text-[11px] text-muted-foreground">Knowledge, answered</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" render={<Link href="/login" />}>
              Sign in
            </Button>
            <Button render={<Link href="/register" />}>Get started</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px] dark:bg-primary/20" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-16 pt-20 text-center lg:pt-28">
          <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            RAG-powered engineering knowledge platform
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.1]">
            Your engineering knowledge,{" "}
            <span className="bg-gradient-to-r from-primary via-violet-500 to-cyan-500 bg-clip-text text-transparent">
              instantly answerable
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Ingest documentation, repositories, and incident reports. Ask
            questions in plain English. Get accurate, cited answers — never
            hallucinated.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" render={<Link href="/register" />}>
              Start for free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/search" />}>
              <Search className="mr-1.5 h-4 w-4" /> Try the search
            </Button>
          </div>

          {/* Product mock */}
          <div className="mt-14 w-full max-w-3xl rounded-2xl border border-border bg-card/80 text-left shadow-2xl shadow-primary/10 backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 text-xs text-muted-foreground">AI Chat — Engineering Intelligence Hub</span>
            </div>
            <div className="space-y-4 p-5">
              <div className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
                How does the payment service process a transaction?
              </div>
              <div className="w-fit max-w-[85%] space-y-3 rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-4 py-3 text-sm">
                <p>
                  The <strong>payment-service</strong> validates card details and
                  calls Stripe for authorization, then publishes{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">payment.completed</code>{" "}
                  to Kafka. The <strong>ledger-service</strong> consumes the event
                  and writes double-entry bookkeeping rows.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["payment-architecture.md", "src/payments/service.py", "api-overview.md"].map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-2 py-0.5 font-mono text-[11px] text-primary">
                      <FileText className="h-3 w-3" /> {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pipeline */}
      <section className="border-y border-border bg-muted/30">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {PIPELINE.map((p, i) => (
            <div key={p.step} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  <span className="mr-1.5 text-xs text-muted-foreground">0{i + 1}</span>
                  {p.step}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Built for engineering teams, not chatbots
          </h2>
          <p className="mt-2 text-muted-foreground">
            Retrieval-Augmented Generation done properly — grounded, cited, and honest.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${f.accent.split(" ")[0]} ${f.accent.split(" ")[1]} opacity-0 transition-opacity group-hover:opacity-100`}
              />
              <f.icon className={`relative mb-3 h-5 w-5 ${f.accent.split(" ")[2]}`} />
              <h3 className="relative mb-1.5 text-sm font-semibold">{f.title}</h3>
              <p className="relative text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet-600 to-cyan-600 px-8 py-14 text-center text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white/15,transparent_50%)]" />
          <h2 className="relative text-2xl font-bold sm:text-3xl">
            Stop digging through docs. Start asking.
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-sm text-primary-foreground/80">
            Spin it up in minutes — SQLite for dev, Postgres + pgvector for
            production, offline mock mode with zero API keys.
          </p>
          <div className="relative mt-7 flex justify-center gap-3">
            <Button size="lg" variant="secondary" render={<Link href="/register" />}>
              Create your workspace
            </Button>
          </div>
          <div className="relative mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-primary-foreground/70">
            {["Source citations on every answer", "RBAC built in", "Zero-key offline mode"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Engineering Intelligence Hub — Next.js · FastAPI · PostgreSQL + pgvector · RAG
      </footer>
    </div>
  );
}
