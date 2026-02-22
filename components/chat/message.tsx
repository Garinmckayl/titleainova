"use client";

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageProps {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

export function Message({ role, content, timestamp }: MessageProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex gap-4 group", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
        isUser 
          ? "bg-gradient-to-br from-blue-600 to-purple-600" 
          : "bg-gradient-to-br from-slate-700 to-slate-900"
      )}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 space-y-2", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">
            {isUser ? "You" : "AI Assistant"}
          </span>
          {timestamp && (
            <span className="text-xs text-slate-400">
              {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <div className={cn(
          "rounded-2xl px-5 py-4 shadow-sm",
          isUser 
            ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white ml-12" 
            : "bg-white border border-slate-200 mr-12"
        )}>
          <div className={cn(
            "prose prose-sm max-w-none",
            isUser ? "prose-invert" : "prose-slate",
            "prose-headings:font-semibold prose-headings:mb-2",
            "prose-p:leading-relaxed prose-p:my-2",
            "prose-ul:my-2 prose-ol:my-2",
            "prose-li:my-1",
            "prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
            "prose-pre:bg-slate-900 prose-pre:text-slate-100"
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
