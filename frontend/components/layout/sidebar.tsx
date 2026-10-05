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
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "AI Chat", icon: MessageSquareText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/sources", label: "Knowledge Sources", icon: Library },
  { href: "/repositories", label: "Repositories", icon: FolderGit2 },
  { href: "/architecture", label: "Architecture", icon: Network },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/conversations", label: "Conversations", icon: FileText },
  { href: "/onboarding", label: "Onboarding", icon: GraduationCap },
];

const BOTTOM = [
  { href: "/settings", label: "Settings", icon: Settings },
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
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <BrainCircuit className="h-4.5 w-4.5 text-primary-foreground" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Engineering</p>
          <p className="text-xs text-muted-foreground">Intelligence Hub</p>
        </div>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV.map((n) => item(n.href, n.label, n.icon))}
        {isAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            {item("/admin", "User Management", Users)}
          </>
        )}
      </nav>
      <div className="space-y-0.5 border-t border-border px-3 py-2">
        {BOTTOM.map((n) => item(n.href, n.label, n.icon))}
        <div className="flex items-center gap-2 px-3 py-2">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs capitalize text-muted-foreground">{user?.role}</span>
        </div>
      </div>
    </aside>
  );
}
