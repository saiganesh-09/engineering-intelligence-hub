import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  FileSearch,
  FolderGit2,
  MessageSquareText,
  Network,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: MessageSquareText,
    title: "Source-backed AI answers",
    body: "Ask natural-language questions about your systems. Every answer cites the exact docs, code, and incidents it used.",
  },
  {
    icon: FileSearch,
    title: "Hybrid engineering search",
    body: "Semantic + keyword search across documentation, repositories, runbooks, and incident reports — with filters.",
  },
  {
    icon: FolderGit2,
    title: "Repository intelligence",
    body: "Connect GitHub repos, browse the indexed code, and ask AI to explain files and functions.",
  },
  {
    icon: ShieldAlert,
    title: "Incident intelligence",
    body: "Track incidents, find similar past failures, and generate AI analysis with related sources.",
  },
  {
    icon: Network,
    title: "Architecture insights",
    body: "Understand services, dependencies, and data flow extracted from your architecture documentation.",
  },
  {
    icon: BrainCircuit,
    title: "Onboarding briefs",
    body: "Generate a practical learning path for new engineers grounded in your real documentation.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-4 lg:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <BrainCircuit className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold">Engineering Intelligence Hub</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" render={<Link href="/login" />}>
            Sign in
          </Button>
          <Button render={<Link href="/register" />}>Get started</Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
        <section className="flex flex-col items-center py-20 text-center lg:py-28">
          <div className="mb-5 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
            Retrieval-Augmented Generation for engineering teams
          </div>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your engineering knowledge,{" "}
            <span className="text-primary">instantly answerable</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Ingest documentation, repositories, and incident reports. Ask questions in
            plain English. Get accurate, cited answers — never hallucinated.
          </p>
          <div className="mt-8 flex gap-3">
            <Button size="lg" render={<Link href="/register" />}>
              Start for free <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/login" />}>
              Sign in
            </Button>
          </div>
        </section>

        <section className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <f.icon className="mb-3 h-5 w-5 text-primary" />
              <h3 className="mb-1.5 text-sm font-semibold">{f.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Engineering Intelligence Hub — built with Next.js, FastAPI, PostgreSQL + pgvector
      </footer>
    </div>
  );
}
