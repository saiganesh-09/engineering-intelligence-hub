"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">{language || "code"}</span>
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
          onClick={() => {
            navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{ margin: 0, fontSize: "0.8rem", background: "transparent" }}
        codeTagProps={{ className: "font-mono" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export const Markdown = memo(function Markdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const text = String(children).replace(/\n$/, "");
            const isBlock = match || text.includes("\n");
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.82em] text-foreground"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return <CodeBlock language={match?.[1] ?? ""} code={text} />;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-3 overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
