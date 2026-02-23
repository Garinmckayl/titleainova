"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Home, History, Building2 } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  { label: "Check for liens", q: "What liens are recorded against 1234 Oak Street, Houston TX?" },
  { label: "Chain of title", q: "Who are the previous owners of 500 Elm Ave, Dallas TX?" },
  { label: "Title risks", q: "Are there any title exceptions or encumbrances I should know about?" },
  { label: "Deed requirements", q: "What are the requirements for a valid deed transfer in Texas?" },
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
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur shrink-0">
        <div className="px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/titleai">
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600">
                <Home className="w-4 h-4" />
                Search
              </Button>
            </Link>
            <Link href="/searches">
              <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600">
                <History className="w-4 h-4" />
                History
              </Button>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-900">Title AI Chat</span>
            <Badge className="bg-yellow-100 text-yellow-700 border border-yellow-200 text-xs">
              Nova Pro
            </Badge>
          </div>

          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs gap-1.5 text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              Multi-Agent
            </Badge>
          </div>
        </div>
      </header>

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
                Ask about ownership history, liens, encumbrances, and title risks for any US property.
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
