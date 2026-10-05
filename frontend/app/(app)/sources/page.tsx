"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderGit2, Loader2, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Repository } from "@/lib/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared";
import { DocumentsTable } from "@/components/documents-table";
import { RepositoriesList } from "@/components/repositories-list";
import { IncidentsPanel } from "@/components/incidents-panel";

const ALLOWED = ".md,.markdown,.txt,.pdf,.docx,.rst";

function UploadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("document");
  const [busy, setBusy] = useState(false);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file first");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (title.trim()) form.append("title", title.trim());
      form.append("source_type", sourceType);
      await api.post("/api/documents/upload", form);
      toast.success(`"${file.name}" uploaded — indexing started`);
      setTitle("");
      onClose();
      qc.invalidateQueries({ queryKey: ["documents"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            PDF, Markdown, TXT, DOCX, or RST — up to 25 MB. The file is parsed,
            chunked, and embedded automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>File</Label>
            <Input ref={fileRef} type="file" accept={ALLOWED} />
          </div>
          <div className="space-y-1.5">
            <Label>Title (optional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to file name" />
          </div>
          <div className="space-y-1.5">
            <Label>Source type</Label>
            <Select value={sourceType} onValueChange={(v) => setSourceType(v ?? "document")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="document">Documentation</SelectItem>
                <SelectItem value="architecture">Architecture</SelectItem>
                <SelectItem value="runbook">Runbook</SelectItem>
                <SelectItem value="faq">Engineering FAQ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={upload} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Upload & index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectRepoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/repositories", { url: url.trim(), branch: branch.trim() || null });
      toast.success("Repository connected — indexing started");
      setUrl("");
      setBranch("");
      onClose();
      qc.invalidateQueries({ queryKey: ["repos"] });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not connect repository");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect GitHub repository</DialogTitle>
          <DialogDescription>
            The repo is cloned shallowly; supported files are parsed, chunked,
            and embedded for search and chat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Repository URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Branch (optional)</Label>
            <Input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
          </div>
          <p className="text-xs text-muted-foreground">
            Private repos need a <code>GITHUB_TOKEN</code> configured on the backend.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={connect} disabled={busy || !url.trim()}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect & index
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SourcesPage() {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "manager";
  const [uploadOpen, setUploadOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [incidentOpen, setIncidentOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Knowledge sources"
        description="Everything the AI knows: documents, repositories, and incident reports."
        actions={
          canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setRepoOpen(true)}>
                <FolderGit2 className="mr-1.5 h-4 w-4" /> Connect repo
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Upload document
              </Button>
            </>
          ) : undefined
        }
      />

      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="repositories">Repositories</TabsTrigger>
          <TabsTrigger value="incidents">Incident reports</TabsTrigger>
        </TabsList>
        <TabsContent value="documents" className="mt-4">
          <DocumentsTable />
        </TabsContent>
        <TabsContent value="repositories" className="mt-4">
          <RepositoriesList onConnect={() => setRepoOpen(true)} />
        </TabsContent>
        <TabsContent value="incidents" className="mt-4">
          <IncidentsPanel createOpen={incidentOpen} setCreateOpen={setIncidentOpen} />
        </TabsContent>
      </Tabs>

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <ConnectRepoDialog open={repoOpen} onClose={() => setRepoOpen(false)} />
    </div>
  );
}
