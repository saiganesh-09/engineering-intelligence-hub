import Link from "next/link";
import { BrainCircuit, FileText, FolderGit2, ShieldCheck } from "lucide-react";

const BULLETS = [
  { icon: FileText, text: "Docs, code & incidents — one knowledge base" },
  { icon: FolderGit2, text: "GitHub repos indexed at function level" },
  { icon: ShieldCheck, text: "Every answer cites its real sources" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-violet-700 to-indigo-900 p-10 text-primary-foreground lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,white/10,transparent_50%),radial-gradient(circle_at_80%_80%,white/5,transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,white/5_1px,transparent_1px),linear-gradient(to_bottom,white/5_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <span className="text-sm font-bold">Engineering Intelligence Hub</span>
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">
            Engineering knowledge,
            <br />
            instantly answerable.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-primary-foreground/80">
            A RAG platform that reads your docs, code, and incident reports —
            and answers with citations, not guesses.
          </p>
          <div className="mt-8 space-y-3">
            {BULLETS.map((b) => (
              <div key={b.text} className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <b.icon className="h-4 w-4" />
                </div>
                <span className="text-primary-foreground/90">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-primary-foreground/60">
          Next.js · FastAPI · PostgreSQL + pgvector · RAG
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
