"use client";

import { RequireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </RequireAuth>
  );
}
