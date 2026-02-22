"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Home, Search } from "lucide-react";

export default function TitleChatPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    await sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Title AI Chat
          </Link>
          <div className="flex gap-2">
            <Link href="/titleai">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-1" />
                Search
              </Button>
            </Link>
            <Link href="/titleai/chat">
              <Button variant="default" size="sm">💬 Chat</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Property Title Assistant
          </h1>
          <p className="text-slate-600 text-lg">
            Powered by Amazon Nova Pro • Multi-Agent Title Research
          </p>
          <div className="flex gap-2 mt-4">
            <Badge className="bg-green-100 text-green-700 border-green-200">🏠 Property Search</Badge>
            <Badge className="bg-blue-100 text-blue-700 border-blue-200">⚡ Real-time Analysis</Badge>
            <Badge className="bg-purple-100 text-purple-700 border-purple-200">🤖 Multi-Agent</Badge>
            <Badge className="bg-orange-100 text-orange-700 border-orange-200">🧠 Nova Pro</Badge>
          </div>
        </div>

        <Card className="shadow-lg border-slate-200">
          {/* Messages */}
          <div className="h-[550px] overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-2xl">
                  <div className="text-7xl mb-6">🏠</div>
                  <h2 className="text-2xl font-bold mb-4 text-slate-800">Ask about any property</h2>
                  <div className="grid gap-3 text-left">
                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200 hover:shadow-md transition cursor-pointer">
                      <p className="font-medium text-green-900">"What liens are on 123 Main St?"</p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200 hover:shadow-md transition cursor-pointer">
                      <p className="font-medium text-blue-900">"Show me the ownership history"</p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200 hover:shadow-md transition cursor-pointer">
                      <p className="font-medium text-purple-900">"Are there any title issues?"</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                    message.role === "user"
                      ? "bg-gradient-to-r from-green-600 to-blue-600 text-white"
                      : "bg-white border border-slate-200"
                  }`}
                >
                  <div className={`text-xs font-semibold mb-2 ${message.role === "user" ? "text-green-100" : "text-slate-500"}`}>
                    {message.role === "user" ? "You" : "🏠 Title AI"}
                  </div>
                  <div className={`prose prose-sm max-w-none ${message.role === "user" ? "prose-invert" : ""}`}>
                    {message.parts.map((part, i) => {
                      if (part.type === 'text') {
                        return (
                          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
                            {part.text}
                          </ReactMarkdown>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-green-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-slate-600 text-sm">Analyzing with Nova Pro...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t pt-4 px-6 pb-6">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about property titles, liens, ownership..."
                disabled={isLoading}
                className="flex-1 border-slate-300 focus:border-green-500 focus:ring-green-500"
              />
              <Button 
                type="submit" 
                disabled={isLoading}
                className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
              >
                <Search className="w-4 h-4 mr-1" />
                Ask
              </Button>
            </form>
            <p className="text-xs text-slate-500 text-center mt-3">
              Powered by Amazon Nova Pro • Multi-Agent Title Research • Real-time Property Analysis
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
