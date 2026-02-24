"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
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

export default function TitleChatPage() {
  const [text, setText] = useState("");

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
    <div className="flex flex-col h-screen bg-white">
      {/* Shared Navbar */}
      <Navbar />

      {/* Messages */}
      <div className="flex-1 overflow-hidden max-w-5xl w-full mx-auto px-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-8 py-16">
            <div>
              <div className="w-20 h-20 mx-auto rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600 mb-6">
                <Building2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
                Property Title Assistant
              </h2>
              <p className="text-slate-500 text-center max-w-md">
              Ask about ownership history, liens, encumbrances, and title risks for any U.S. property.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full max-w-xl">
              {STARTERS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => { sendMessage({ text: s.q }); setText(""); }}
                  className="p-4 text-left rounded-xl bg-slate-50 border border-slate-200 hover:border-yellow-400 hover:bg-yellow-50 transition group"
                >
                  <p className="font-semibold text-slate-900 group-hover:text-yellow-700 text-sm mb-1">{s.label}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">"{s.q}"</p>
                </button>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200">Nova Act Browser Agent</Badge>
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200">Chain of Title</Badge>
              <Badge className="bg-red-50 text-red-700 border border-red-200">Lien Detection</Badge>
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200">Risk Analysis</Badge>
            </div>
          </div>
        ) : (
          <Conversation className="h-full">
            <ConversationContent>
              {messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <div className="flex-shrink-0">
                    {message.role === "user" ? (
                      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold">
                        U
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
                        <Building2 className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <MessageContent>
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

                        // Loading state
                        if (state === "call" || state === "partial-call") {
                          return (
                            <div key={i} className="my-3 p-4 rounded-xl bg-yellow-50 border border-yellow-200 flex items-center gap-3">
                              <Loader2 className="w-5 h-5 text-yellow-600 animate-spin shrink-0" />
                              <div>
                                <p className="font-semibold text-yellow-800 text-sm">
                                  {toolName === "run_title_search" ? "Running Title Search..." : "Retrieving Report..."}
                                </p>
                                <p className="text-xs text-yellow-600">AI agents are working</p>
                              </div>
                            </div>
                          );
                        }

                        // Result state
                        if (state === "result" && result) {
                          if (toolName === "run_title_search" && result.success) {
                            const r = result;
                            return (
                              <div key={i} className="my-3 space-y-3">
                                {/* Header */}
                                <div className="p-4 rounded-xl bg-green-50 border border-green-200">
                                  <div className="flex items-center gap-2 mb-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                    <span className="font-bold text-green-800">Title Search Complete</span>
                                    <Badge className="bg-green-100 text-green-700 border-green-200 text-xs ml-auto">{r.dataSource}</Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-green-700">
                                    <MapPin className="w-3.5 h-3.5" />
                                    <span className="font-semibold">{r.propertyAddress}</span>
                                    <span className="text-green-500">-</span>
                                    <span>{r.county}</span>
                                  </div>
                                </div>

                                {/* Quick stats */}
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center">
                                    <div className="text-lg font-bold text-slate-900">{r.ownershipChain?.length || 0}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">Deeds</div>
                                  </div>
                                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center">
                                    <div className={`text-lg font-bold ${(r.liens?.length || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>{r.liens?.length || 0}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">Liens</div>
                                  </div>
                                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-center">
                                    <div className={`text-lg font-bold ${(r.exceptions?.length || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>{r.exceptions?.length || 0}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">Exceptions</div>
                                  </div>
                                </div>

                                {/* Chain preview */}
                                {r.ownershipChain?.length > 0 && (
                                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Ownership Chain</p>
                                    {r.ownershipChain.slice(0, 3).map((n: any, j: number) => (
                                      <div key={j} className="flex items-center gap-2 text-xs text-slate-700 py-1 border-b border-slate-100 last:border-0">
                                        <span className="font-mono text-slate-400">{n.date}</span>
                                        <span>{n.grantor}</span>
                                        <span className="text-slate-400">→</span>
                                        <span className="font-semibold">{n.grantee}</span>
                                      </div>
                                    ))}
                                    {r.ownershipChain.length > 3 && (
                                      <p className="text-[10px] text-slate-400 mt-1">+ {r.ownershipChain.length - 3} more records</p>
                                    )}
                                  </div>
                                )}

                                {/* Liens preview */}
                                {r.liens?.length > 0 && (
                                  <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                                    <p className="text-xs font-bold text-red-500 uppercase mb-2">Active Liens</p>
                                    {r.liens.map((l: any, j: number) => (
                                      <div key={j} className="flex items-center justify-between text-xs text-red-800 py-1">
                                        <span>{l.claimant || l.type} ({l.type})</span>
                                        <span className="font-mono font-bold">{l.amount}</span>
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
                            const rpt = result.report as any;
                            return (
                              <div key={i} className="my-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="w-4 h-4 text-blue-600" />
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
                </Message>
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white p-4 shrink-0">
        <div className="max-w-5xl mx-auto">
          <PromptInput
            onSubmit={handleSubmit}
            className="border border-slate-300 rounded-xl bg-white shadow-sm"
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
          <p className="text-center text-slate-400 text-xs mt-2">
            Powered by Amazon Nova Act + Nova Pro · Real-time county recorder data
          </p>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
