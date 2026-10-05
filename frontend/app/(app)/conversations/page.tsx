"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareText, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingRows, PageHeader } from "@/components/shared";

export default function ConversationsPage() {
  const convs = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/api/conversations"),
  });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <PageHeader
        title="Conversations"
        description="Your AI chat history — pick up where you left off."
        actions={
          <Button size="sm" nativeButton={false} render={<Link href="/chat" />}>
            <Plus className="mr-1.5 h-4 w-4" /> New conversation
          </Button>
        }
      />
      {convs.isLoading ? (
        <LoadingRows rows={6} />
      ) : !convs.data?.length ? (
        <EmptyState
          icon={MessageSquareText}
          title="No conversations yet"
          body="Ask your first engineering question in the AI chat."
          action={<Button size="sm" nativeButton={false} render={<Link href="/chat" />}>Open chat</Button>}
        />
      ) : (
        <div className="space-y-2">
          {convs.data.map((c) => (
            <Card key={c.id} className="transition-shadow hover:shadow-sm">
              <CardContent className="flex items-center gap-3 p-3.5">
                <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Link href={`/chat?c=${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium hover:underline">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.message_count} message{c.message_count === 1 ? "" : "s"} · {timeAgo(c.updated_at)}
                  </p>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
