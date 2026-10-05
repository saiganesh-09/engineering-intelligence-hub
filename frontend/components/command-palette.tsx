"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  BrainCircuit,
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Library,
  Loader2,
  MessageSquareText,
  Network,
  Plus,
  Search,
  Settings,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { SourceTypeIcon } from "@/components/citations";

const PAGES = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Chat", icon: MessageSquareText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/sources", label: "Knowledge Sources", icon: Library },
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
  { href: "/conversations", label: "Conversations", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ⌘K / Ctrl+K toggle + "eih:palette" event from the topbar button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("eih:palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("eih:palette", onOpen);
    };
  }, []);

  // Debounced knowledge search while typing.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (query.trim().length < 2) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      try {
        const d = await api.get<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(query.trim())}&k=6`,
        );
        setResults(d.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, [query]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[15vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <Command
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
        label="Command palette"
        shouldFilter={false}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search knowledge or jump to a page…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[50vh] overflow-y-auto p-2">
          {searching && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching knowledge…
            </div>
          )}

          {results.length > 0 && (
            <Command.Group
              heading={
                <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Knowledge results
                </span>
              }
            >
              {results.map((r) => (
                <Command.Item
                  key={r.chunk_id}
                  value={`r-${r.chunk_id}`}
                  onSelect={() => go(`/chat?q=${encodeURIComponent(query.trim())}`)}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
                >
                  <SourceTypeIcon type={r.source_type} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{r.snippet}</p>
                  </div>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {(r.score * 100).toFixed(0)}%
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group
            heading={
              <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Actions
              </span>
            }
          >
            {[
              { label: "Ask a question", icon: BrainCircuit, to: "/chat" },
              { label: "New chat", icon: Plus, to: "/chat" },
              { label: "Upload a document", icon: Upload, to: "/sources" },
              { label: "Connect a repository", icon: FolderGit2, to: "/repositories" },
              { label: "Search knowledge", icon: Search, to: "/search" },
            ].map((a) => (
              <Command.Item
                key={a.label}
                value={`a-${a.label}`}
                onSelect={() => go(a.to)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
              >
                <a.icon className="h-4 w-4 text-muted-foreground" />
                {a.label}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group
            heading={
              <span className="px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Pages
              </span>
            }
          >
            {PAGES.map((p) => (
              <Command.Item
                key={p.href}
                value={`p-${p.label}`}
                onSelect={() => go(p.href)}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
              >
                <p.icon className="h-4 w-4 text-muted-foreground" />
                {p.label}
              </Command.Item>
            ))}
            {user?.role === "admin" && (
              <Command.Item
                value="p-admin"
                onSelect={() => go("/admin")}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm aria-selected:bg-accent"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                User Management
              </Command.Item>
            )}
          </Command.Group>

          {query.trim().length >= 2 && !searching && results.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No knowledge found for “{query.trim()}” — try the AI chat instead.
            </div>
          )}
        </Command.List>
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span className={cn("font-medium text-primary")}>⌘K</span>
        </div>
      </Command>
    </div>
  );
}
