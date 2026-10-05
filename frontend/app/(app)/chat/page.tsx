"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Check,
  Copy,
  Loader2,
  MessageSquareText,
  Plus,
  RefreshCw,
  SendHorizonal,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { api, streamChat } from "@/lib/api";
import type {
  Conversation,
  ConversationDetail,
  Message,
  RetrievedSource,
} from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Markdown } from "@/components/markdown";
import { CitationList } from "@/components/citations";
import { EmptyState } from "@/components/shared";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: RetrievedSource[];
  streaming?: boolean;
  error?: string;
}

const SUGGESTIONS = [
  "How does the authentication service communicate with other services?",
  "Explain the architecture of the payment system",
  "What could cause transaction failures?",
  "Have we seen this type of incident before?",
];

function ConversationList({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const qc = useQueryClient();
  const convs = useQuery({
    queryKey: ["conversations"],
    queryFn: () => api.get<Conversation[]>("/api/conversations"),
  });

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-muted/20">
      <div className="p-3">
        <Button className="w-full" size="sm" onClick={() => onSelect(null)}>
          <Plus className="mr-1.5 h-4 w-4" /> New conversation
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        {convs.data?.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group mb-0.5 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
              c.id === activeId ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            )}
            onClick={() => onSelect(c.id)}
          >
            <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate">{c.title}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(c.updated_at)}</p>
            </div>
            <button
              aria-label="Delete conversation"
              className="hidden shrink-0 text-muted-foreground hover:text-destructive group-hover:block"
              onClick={async (e) => {
                e.stopPropagation();
                await api.delete(`/api/conversations/${c.id}`);
                if (c.id === activeId) onSelect(null);
                qc.invalidateQueries({ queryKey: ["conversations"] });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
}

function MessageBubble({
  msg,
  onRegenerate,
}: {
  msg: UiMessage;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          isUser ? "bg-primary" : "bg-muted",
        )}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-primary-foreground" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div className={cn("min-w-0 max-w-[85%]", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-2xl px-4 py-2.5 text-left",
            isUser ? "bg-primary text-primary-foreground" : "bg-card border border-border",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
          ) : (
            <>
              {msg.error ? (
                <p className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {msg.error}
                </p>
              ) : msg.content ? (
                <Markdown content={msg.content} />
              ) : (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
                </span>
              )}
              {msg.streaming && msg.content && (
                <span className="ml-1 inline-block h-3.5 w-1.5 animate-pulse bg-foreground/70 align-middle" />
              )}
            </>
          )}
        </div>
        {!isUser && <CitationList sources={msg.citations ?? []} />}
        {!isUser && msg.content && !msg.streaming && (
          <div className="mt-1.5 flex gap-1">
            <button
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => {
                navigator.clipboard.writeText(msg.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            {onRegenerate && (
              <button
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                onClick={onRegenerate}
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatInner() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState(params.get("q") ?? "");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<string | null>(null);

  // Load an existing conversation's messages.
  useEffect(() => {
    if (!conversationId || loadedRef.current === conversationId) return;
    loadedRef.current = conversationId;
    api.get<ConversationDetail>(`/api/conversations/${conversationId}`).then((d) => {
      setMessages(
        d.messages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          citations: m.citations.map((c) => ({
            chunk_id: c.chunk_id ?? "",
            source_type: c.source_type,
            source_id: c.source_id,
            title: c.title,
            path: c.meta?.path ?? null,
            repository: c.meta?.repository ?? null,
            snippet: c.meta?.snippet ?? "",
            score: c.meta?.score ?? 0,
            meta: c.meta,
          })),
        })),
      );
    });
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectConversation = useCallback(
    (id: string | null) => {
      setConversationId(id);
      setMessages([]);
      loadedRef.current = null;
      router.replace(id ? `/chat?c=${id}` : "/chat");
    },
    [router],
  );

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setBusy(true);
    const userMsg: UiMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", content: "", streaming: true },
    ]);
    try {
      for await (const ev of streamChat(question, conversationId)) {
        if (ev.type === "sources") {
          setMessages((m) =>
            m.map((x) => (x.id === assistantId ? { ...x, citations: ev.sources } : x)),
          );
        } else if (ev.type === "token") {
          setMessages((m) =>
            m.map((x) =>
              x.id === assistantId ? { ...x, content: x.content + ev.token } : x,
            ),
          );
        } else if (ev.type === "done") {
          setMessages((m) =>
            m.map((x) =>
              x.id === assistantId ? { ...x, streaming: false, id: ev.message_id } : x,
            ),
          );
          if (!conversationId) {
            setConversationId(ev.conversation_id);
            loadedRef.current = ev.conversation_id;
            router.replace(`/chat?c=${ev.conversation_id}`);
          }
          qc.invalidateQueries({ queryKey: ["conversations"] });
        } else if (ev.type === "error") {
          setMessages((m) =>
            m.map((x) =>
              x.id === assistantId ? { ...x, error: ev.error, streaming: false } : x,
            ),
          );
        }
      }
    } finally {
      setMessages((m) => m.map((x) => (x.id === assistantId ? { ...x, streaming: false } : x)));
      setBusy(false);
    }
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="flex h-full">
      <ConversationList activeId={conversationId} onSelect={selectConversation} />
      <div className="flex min-w-0 flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center pt-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Bot className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Ask about your engineering org</h2>
                <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
                  Answers are grounded in your documentation, code, and incident
                  reports — always with source citations.
                </p>
                <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-border bg-card p-3 text-left text-sm transition-colors hover:bg-muted/60"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  msg={m}
                  onRegenerate={
                    m.role === "assistant" && i === messages.length - 1 && !busy
                      ? () => send(lastUserMessage?.content)
                      : undefined
                  }
                />
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-background p-4">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about docs, code, incidents, architecture…"
              rows={1}
              className="max-h-40 min-h-10 flex-1 resize-none"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-muted-foreground">
            Answers are generated from your indexed knowledge sources — verify citations.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ChatInner />
    </Suspense>
  );
}
