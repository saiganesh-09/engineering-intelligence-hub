"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Role, User } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, LoadingRows, PageHeader, StatusBadge } from "@/components/shared";

const ROLES: Role[] = ["admin", "manager", "developer"];

export default function AdminPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<User[]>("/api/admin/users"),
  });

  async function update(user: User, patch: Record<string, unknown>) {
    try {
      await api.patch(`/api/admin/users/${user.id}`, patch);
      toast.success(`Updated ${user.name}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Update failed");
    }
  }

  if (me?.role !== "admin") {
    return (
      <div className="p-6">
        <EmptyState icon={ShieldCheck} title="Admins only" body="You need the admin role to manage users." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="User management"
        description="Manage roles and access for your team."
      />
      {users.isLoading ? (
        <LoadingRows rows={5} />
      ) : users.isError ? (
        <EmptyState title="Couldn't load users" body={(users.error as Error).message} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-24">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <p className="text-sm font-medium">
                      {u.name} {u.id === me?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onValueChange={(r) => r && update(u, { role: r as Role })}
                      disabled={u.id === me?.id}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={u.is_active}
                      disabled={u.id === me?.id}
                      onCheckedChange={(v) => update(u, { is_active: v })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
