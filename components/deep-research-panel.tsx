"use client";

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DeepResearchProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  result?: {
    plan: Array<{ title: string; todos: string[] }>;
    sources: Array<{ title: string; url: string; content: string }>;
    findings: string;
  };
}

export function DeepResearchPanel({ onSearch, isLoading, result }: DeepResearchProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-600 rounded-lg">
          <Search className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Deep Research Mode</h3>
          <p className="text-sm text-slate-600">Multi-step AI-powered research</p>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-purple-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm font-medium">Conducting deep research...</span>
          </div>

          {result?.plan && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Research Plan:</p>
              {result.plan.map((item, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-purple-200">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.todos.length} queries
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {result && !isLoading && (
        <div className="space-y-4">
          {/* Research Plan */}
          <div>
            <button
              onClick={() => toggleExpand('plan')}
              className="flex items-center gap-2 w-full text-left font-medium text-sm mb-2"
            >
              {expanded['plan'] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Research Plan ({result.plan.length} areas)
            </button>
            <AnimatePresence>
              {expanded['plan'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2"
                >
                  {result.plan.map((item, i) => (
                    <div key={i} className="bg-white rounded p-3 border">
                      <p className="font-medium text-sm mb-1">{item.title}</p>
                      <ul className="text-xs text-slate-600 space-y-1">
                        {item.todos.map((todo, j) => (
                          <li key={j}>• {todo}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sources */}
          <div>
            <button
              onClick={() => toggleExpand('sources')}
              className="flex items-center gap-2 w-full text-left font-medium text-sm mb-2"
            >
              {expanded['sources'] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Sources ({result.sources.length} found)
            </button>
            <AnimatePresence>
              {expanded['sources'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2"
                >
                  {result.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-white rounded p-3 border hover:border-purple-300 transition"
                    >
                      <p className="font-medium text-sm text-blue-600 hover:underline">
                        {source.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {source.content}
                      </p>
                    </a>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Card>
  );
}
