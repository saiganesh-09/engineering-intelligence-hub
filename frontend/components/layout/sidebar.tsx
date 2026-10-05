"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BrainCircuit,
  FileText,
  FolderGit2,
  GraduationCap,
  LayoutDashboard,
  Library,
  MessageSquareText,
  Network,
  Search,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV: { group: string; items: { href: string; label: string; icon: typeof Search }[] }[] = [
  {
    group: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/chat", label: "AI Chat", icon: MessageSquareText },
      { href: "/search", label: "Search", icon: Search },
    ],
  },
  {
    group: "Knowledge",
    items: [
      { href: "/sources", label: "Knowledge Sources", icon: Library },
      { href: "/repositories", label: "Repositories", icon: FolderGit2 },
      { href: "/incidents", label: "Incidents", icon: ShieldAlert },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/architecture", label: "Architecture", icon: Network },
      { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
      { href: "/conversations", label: "Conversations", icon: FileText },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const item = (href: string, label: string, Icon: typeof Search) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
        )}
        <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-400 shadow-sm shadow-primary/25">
          <BrainCircuit className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Engineering</p>
          <p className="text-[11px] text-muted-foreground">Intelligence Hub</p>
        </div>
      </Link>
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {NAV.map((g) => (
          <div key={g.group} className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {g.group}
            </p>
            <div className="space-y-0.5">
              {g.items.map((n) => item(n.href, n.label, n.icon))}
            </div>
          </div>
        ))}
        {isAdmin && (
          <div className="mb-4">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Admin
            </p>
            <div className="space-y-0.5">{item("/admin", "User Management", Users)}</div>
          </div>
        )}
      </nav>
      <div className="border-t border-border p-3">
        <div className="space-y-0.5">
          {item("/settings", "Settings", Settings)}
        </div>
        <div className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium">{user?.name}</p>
            <p className="text-[10px] capitalize text-muted-foreground">{user?.role}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
