"use client";

import { useState } from "react";
import { FolderGit2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared";
import { RepositoriesList } from "@/components/repositories-list";

export default function RepositoriesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const canManage = user?.role === "admin" || user?.role === "manager";
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      await api.post("/api/repositories", { url: url.trim(), branch: branch.trim() || null });
      toast.success("Repository connected — indexing started");
      setOpen(false);
      setUrl("");
      qc.invalidateQueries({ queryKey: ["repos"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not connect repository");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Repositories"
        description="Connected GitHub repositories, indexed for code search and AI answers."
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <FolderGit2 className="mr-1.5 h-4 w-4" /> Connect repository
            </Button>
          ) : undefined
        }
      />
      <RepositoriesList onConnect={() => setOpen(true)} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect GitHub repository</DialogTitle>
            <DialogDescription>
              Shallow-cloned, filtered, chunked, and embedded automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Repository URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/org/repo" />
            </div>
            <div className="space-y-1.5">
              <Label>Branch (optional)</Label>
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={connect} disabled={busy || !url.trim()}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect & index
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
