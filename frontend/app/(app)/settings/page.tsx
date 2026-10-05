"use client";

import { BrainCircuit, KeyRound, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, StatusBadge } from "@/components/shared";
import { formatDateTime } from "@/lib/format";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <PageHeader title="Settings" description="Your account and platform configuration." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>Your account details.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={user?.name ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <div className="pt-1"><StatusBadge value={user?.role ?? "developer"} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Member since</Label>
            <Input value={formatDateTime(user?.created_at)} disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-4 w-4" /> AI configuration
          </CardTitle>
          <CardDescription>
            Provider settings are configured on the backend via environment
            variables — they are never exposed to the frontend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">API base:</span>{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{api.url}</code>
          </p>
          <p>
            Configure <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">LLM_PROVIDER</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">LLM_MODEL</code>,{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">EMBEDDING_PROVIDER</code>{" "}
            and related keys in the backend <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">.env</code>{" "}
            file. Without an API key the platform runs in offline mock mode.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" /> Security
          </CardTitle>
          <CardDescription>Authentication &amp; access.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Signed in via <span className="font-medium text-foreground">{user?.auth_provider}</span>.
          Sessions use short-lived JWTs stored locally. Passwords are bcrypt-hashed
          on the backend.
        </CardContent>
      </Card>
    </div>
  );
}
