"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { FileText, Building2, AlertTriangle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navbar } from "@/components/navbar-simple";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

const STARTERS = [
  { label: "Run a title search", q: "Run a title search on 1600 Pennsylvania Ave, Washington, DC 20500" },
  { label: "Check for liens", q: "Search 100 Congress Ave, Austin, TX 78701 and tell me about any liens" },
  { label: "Explain title insurance", q: "What is title insurance and why do I need it when buying a home?" },
  { label: "Review past searches", q: "Show me what properties have already been searched" },
];

/* ── Avatar components ───────────────────────────────────────── */

function AIAvatar() {
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-md shadow-yellow-500/20 shrink-0">
      <Building2 className="w-5 h-5 text-white" />
    </div>
  );
}

function UserAvatar() {
  const { user } = useUser();

  if (user?.imageUrl) {
    return (
      <Image
        src={user.imageUrl}
        alt={user.fullName || "You"}
        width={36}
        height={36}
        className="rounded-full object-cover ring-2 ring-slate-200 shrink-0"
      />
    );
  }

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] || ""}`.toUpperCase()
    : "U";

  return (
    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold ring-2 ring-slate-200 shrink-0">
      {initials}
    </div>
  );
}

/* ── Main client component ───────────────────────────────────── */

export function TitleChatClient() {
  const [text, setText] = useState("");
  const { user } = useUser();

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({ api: "/api/titleai/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (msg: PromptInputMessage) => {
    if (!msg.text?.trim()) return;
    sendMessage({ text: msg.text });
    setText("");
  };

  return (
    <TooltipProvider>
    <div className="flex flex-col h-screen bg-[#fefce8]">
      <Navbar />

      {/* Messages area */}
      <div className="flex-1 overflow-hidden max-w-4xl w-full mx-auto px-4 sm:px-6">
        {messages.length === 0 ? (
          /* ── Empty state ──────────────────────────────────── */
          <div className="flex flex-col items-center justify-center h-full gap-6 py-12 px-4">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-xl shadow-yellow-500/30 mb-6">
                <Building2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                {user?.firstName ? `Hey ${user.firstName}, what property` : "What property"} can I look up?
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-sm sm:text-base">
                Ask about ownership history, liens, encumbrances, and title risks for any U.S. property.
                I can run live searches against county recorder databases.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { sendMessage({ text: s.q }); setText(""); }}
                  className="p-4 text-left rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition group shadow-sm"
                >
                  <p className="font-semibold text-slate-900 group-hover:text-yellow-700 text-sm mb-1">{s.label}</p>
                  <p className="text-xs text-slate-400 line-clamp-2">{s.q}</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs">Nova Act Browser</Badge>
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">Chain of Title</Badge>
              <Badge className="bg-red-50 text-red-700 border border-red-200 text-xs">Lien Detection</Badge>
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs">Risk Analysis</Badge>
            </div>
          </div>
        ) : (
          /* ── Conversation ─────────────────────────────────── */
          <Conversation className="h-full">
            <ConversationContent className="gap-6 py-6">
              {messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <div className="flex gap-3 items-start w-full">
                    {/* Avatar */}
                    {message.role === "user" ? <UserAvatar /> : <AIAvatar />}

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Name label */}
                      <p className="text-xs font-semibold text-slate-500 mb-1.5">
                        {message.role === "user"
                          ? (user?.fullName || user?.firstName || "You")
                          : "Title AI"}
                      </p>

                      <MessageContent className="!ml-0 !max-w-full">
                        {message.parts.map((part, i) => {
                          if (part.type === "text") {
                            return (
                              <MessageResponse key={i}>
                                {part.text}
                              </MessageResponse>
                            );
                          }
                          if (part.type === "tool-invocation") {
                            const inv = part as any;
                            const toolName = inv.toolInvocation?.toolName || inv.toolName;
                            const state = inv.toolInvocation?.state || inv.state;
                            const result = inv.toolInvocation?.result || inv.result;

                            /* Loading state */
                            if (state === "call" || state === "partial-call") {
                              return (
                                <div key={i} className="my-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center gap-3">
                                  <Loader2 className="w-5 h-5 text-yellow-600 animate-spin shrink-0" />
                                  <div>
                                    <p className="font-semibold text-yellow-800 text-sm">
                                      {toolName === "run_title_search" ? "Running Title Search..." : "Retrieving Report..."}
                                    </p>
                                    <p className="text-xs text-yellow-600">AI agents are analyzing county records</p>
                                  </div>
                                </div>
                              );
                            }

                            /* Result state */
                            if (state === "result" && result) {
                              if (toolName === "run_title_search" && result.success) {
                                const r = result;
                                return (
                                  <div key={i} className="my-3 space-y-3">
                                    {/* Header */}
                                    <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                                        <span className="font-bold text-green-800">Title Search Complete</span>
                                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs sm:ml-auto">{r.dataSource}</Badge>
                                      </div>
                                      <div className="flex items-center gap-2 text-sm text-green-700 flex-wrap">
                                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                                        <span className="font-semibold">{r.propertyAddress}</span>
                                        <span className="text-green-500 hidden sm:inline">-</span>
                                        <span>{r.county}</span>
                                      </div>
                                    </div>

                                    {/* Quick stats */}
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="p-3 rounded-lg bg-white border border-slate-100 text-center shadow-sm">
                                        <div className="text-lg font-bold text-slate-900">{r.ownershipChain?.length || 0}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">Deeds</div>
                                      </div>
                                      <div className="p-3 rounded-lg bg-white border border-slate-100 text-center shadow-sm">
                                        <div className={`text-lg font-bold ${(r.liens?.length || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{r.liens?.length || 0}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">Liens</div>
                                      </div>
                                      <div className="p-3 rounded-lg bg-white border border-slate-100 text-center shadow-sm">
                                        <div className={`text-lg font-bold ${(r.exceptions?.length || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>{r.exceptions?.length || 0}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">Exceptions</div>
                                      </div>
                                    </div>

                                    {/* Chain preview */}
                                    {r.ownershipChain?.length > 0 && (
                                      <div className="p-3 rounded-lg bg-white border border-slate-100 shadow-sm">
                                        <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ownership Chain</p>
                                        {r.ownershipChain.slice(0, 3).map((n: any, j: number) => (
                                          <div key={j} className="flex items-center gap-2 text-xs text-slate-700 py-1.5 border-b border-slate-50 last:border-0 flex-wrap">
                                            <span className="font-mono text-slate-400 shrink-0">{n.date}</span>
                                            <span className="truncate">{n.grantor}</span>
                                            <span className="text-slate-300 shrink-0">&rarr;</span>
                                            <span className="font-semibold truncate">{n.grantee}</span>
                                          </div>
                                        ))}
                                        {r.ownershipChain.length > 3 && (
                                          <p className="text-[10px] text-slate-400 mt-1.5">+ {r.ownershipChain.length - 3} more records</p>
                                        )}
                                      </div>
                                    )}

                                    {/* Liens preview */}
                                    {r.liens?.length > 0 && (
                                      <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                                        <p className="text-xs font-bold text-red-500 uppercase mb-2">Active Liens</p>
                                        {r.liens.map((l: any, j: number) => (
                                          <div key={j} className="flex items-center justify-between text-xs text-red-800 py-1.5">
                                            <span className="truncate">{l.claimant || l.type} ({l.type})</span>
                                            <span className="font-mono font-bold shrink-0 ml-2">{l.amount}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {r.searchId && (
                                      <p className="text-[10px] text-slate-400">Saved as search #{r.searchId} — view in History</p>
                                    )}
                                  </div>
                                );
                              }

                              if (toolName === "run_title_search" && !result.success) {
                                return (
                                  <div key={i} className="my-3 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                                    <span className="text-red-700 text-sm">{result.error}</span>
                                  </div>
                                );
                              }

                              if (toolName === "get_search_report" && result.success) {
                                return (
                                  <div key={i} className="my-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                      <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                      <span className="font-bold text-blue-800 text-sm">Report #{result.id}: {result.address}</span>
                                    </div>
                                    <p className="text-xs text-blue-700">{result.county} - {result.source} - {result.created_at}</p>
                                    {result.screenshotCount > 0 && (
                                      <p className="text-xs text-blue-600 mt-1">{result.screenshotCount} browser screenshot(s) captured</p>
                                    )}
                                  </div>
                                );
                              }
                            }
                          }
                          return null;
                        })}
                      </MessageContent>
                    </div>
                  </div>
                </Message>
              ))}

              {/* Streaming indicator */}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 items-start">
                  <AIAvatar />
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Title AI</p>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-yellow-200/50 bg-[#fefce8] p-3 sm:p-4 shrink-0">
        <div className="max-w-4xl mx-auto">
          <PromptInput
            onSubmit={handleSubmit}
            className="border border-slate-200 rounded-xl bg-white shadow-lg shadow-slate-200/50"
          >
            <PromptInputBody>
              <PromptInputTextarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ask about property titles, liens, ownership history..."
                className="bg-transparent text-slate-900 placeholder:text-slate-400 border-0 focus:ring-0"
              />
            </PromptInputBody>
            <PromptInputFooter className="border-t border-slate-100">
              <PromptInputTools>
                <PromptInputButton
                  variant="ghost"
                  className="text-slate-400 text-xs gap-1"
                  tooltip="Nova Act browses county recorder websites in real-time"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                  Nova Act
                </PromptInputButton>
                <PromptInputButton
                  variant="ghost"
                  className="text-slate-400 text-xs gap-1"
                  tooltip="Amazon Nova Pro analyzes title data"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                  Nova Pro
                </PromptInputButton>
              </PromptInputTools>
              <PromptInputSubmit
                disabled={!text.trim()}
                status={status}
                className="bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 border-0"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
