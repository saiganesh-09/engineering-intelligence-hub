"use client";

import { PageHeader } from "@/components/shared";
import { DocumentsTable } from "@/components/documents-table";

export default function DocumentsPage() {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader
        title="Documents"
        description="Uploaded engineering documentation, indexed for retrieval."
      />
      <DocumentsTable />
    </div>
  );
}
