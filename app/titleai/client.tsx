"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, Search, ShieldCheck, AlertTriangle, Download, 
  CheckCircle2, Building2, MapPin, Loader2, ArrowRight, MessageSquare,
  Terminal, ChevronDown, History, Monitor
} from "lucide-react";
import Link from "next/link";
import type { TitleReportData, OwnershipNode, Lien, TitleException } from '@/lib/agents/title-search/types';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const STEPS = [
  { id: 'lookup',    label: 'Property Lookup', icon: MapPin },
  { id: 'retrieval', label: 'Doc Retrieval',   icon: Search },
  { id: 'chain',     label: 'Chain of Title',  icon: FileText },
  { id: 'liens',     label: 'Lien Scan',       icon: AlertTriangle },
  { id: 'risk',      label: 'Risk Analysis',   icon: ShieldCheck },
  { id: 'summary',   label: 'Finalizing',      icon: CheckCircle2 },
];

interface LogLine {
  id: number;
  step: string;
  message: string;
  ts: string;
}

interface Screenshot {
  id: number;
  label: string;
  step: string;
  data: string; // base64 jpeg
}

export function TitleSearchClient() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [activeScreenshot, setActiveScreenshot] = useState<Screenshot | null>(null);
  const [liveViewUrl, setLiveViewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<TitleReportData & { pdfBase64: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);
  const shotIdRef = useRef(0);

  // Auto-scroll terminal
  useEffect(() => {
    if (showTerminal) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showTerminal]);

  const addLog = (step: string, message: string) => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    setLogs(prev => [...prev, { id: logIdRef.current++, step, message, ts }]);
  };

  const runSearch = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setLogs([]);
    setScreenshots([]);
    setActiveScreenshot(null);
    setLiveViewUrl(null);
    setCurrentStep('lookup');
    setProgressMessage('Initializing Title AI agents...');
    setShowTerminal(true);
    logIdRef.current = 0;

    addLog('init', 'Title AI Nova — starting property search...');

    try {
      const response = await fetch('/api/titleai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });

      if (!response.ok) throw new Error(response.statusText);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let evt: any;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          if (evt.type === 'progress') {
            setCurrentStep(evt.step);
            setProgressMessage(evt.message);
            addLog(evt.step, evt.message);
          } else if (evt.type === 'log') {
            // Detailed log lines from Nova Act sidecar
            addLog(evt.step, evt.message);
          } else if (evt.type === 'live_view') {
            setLiveViewUrl(evt.url);
            addLog('retrieval', '[AgentCore] Cloud browser live — streaming view available');
          } else if (evt.type === 'screenshot') {
            const shot: Screenshot = {
              id: shotIdRef.current++,
              label: evt.label || 'Browser view',
              step: evt.step || 'lookup',
              data: evt.data,
            };
            setScreenshots(prev => [...prev, shot]);
            setActiveScreenshot(shot);
            addLog(evt.step, `[screenshot] ${evt.label}`);
          } else if (evt.type === 'result') {
            setResult(evt.data);
            setCurrentStep('complete');
            addLog('complete', 'Title report generated successfully.');
          } else if (evt.type === 'error') {
            setError(evt.message);
            addLog('error', `ERROR: ${evt.message}`);
            setLoading(false);
          }
        }
      }
    } catch (e: any) {
      setError(e.message || "Failed to run Title AI");
      addLog('error', `ERROR: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!result?.pdfBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${result.pdfBase64}`;
    link.download = `TitleAI_Report_${address.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stepColor: Record<string, string> = {
    lookup: '#a78bfa',
    retrieval: '#60a5fa',
    chain: '#34d399',
    liens: '#f87171',
    risk: '#fbbf24',
    summary: '#f97316',
    complete: '#4ade80',
    error: '#ef4444',
    init: '#94a3b8',
  };

  return (
    <div className="max-w-7xl mx-auto pb-24 relative">
        {/* Background Gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-0 left-1/4 w-[1000px] h-[600px] bg-yellow-200/20 rounded-full blur-[100px] -translate-y-1/2" />
            <div className="absolute bottom-0 right-1/4 w-[800px] h-[600px] bg-orange-100/30 rounded-full blur-[100px] translate-y-1/2" />
        </div>

      {/* Hero Section */}
      <div className="text-center space-y-8 pt-12 pb-16">
        <div className="flex justify-center gap-4 mb-4">
          <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 text-sm font-semibold shadow-sm backdrop-blur-sm"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
            </span>
            AI-Powered Title Intelligence
          </motion.div>
          
          <Link href="/titleai/chat">
            <Button variant="outline" className="gap-2 border-yellow-500/20 hover:bg-yellow-500/10">
              <MessageSquare className="h-4 w-4" />
              Chat Mode
            </Button>
          </Link>
          <Link href="/searches">
            <Button variant="outline" className="gap-2 border-yellow-500/20 hover:bg-yellow-500/10">
              <History className="h-4 w-4" />
              History
            </Button>
          </Link>
        </div>
        
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
        >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-tight">
            Instant Title Reports <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 via-orange-500 to-yellow-500 animate-gradient-x">
                Powered by Agents
            </span>
            </h1>
            <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Replace weeks of manual searches with seconds of AI analysis. 
            Detailed ownership chains, lien detection, and risk assessment for any U.S. property.
            </p>
        </motion.div>
      </div>

      {/* Search Interface */}
      <motion.div
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ duration: 0.5, delay: 0.2 }}
         className="w-full max-w-3xl mx-auto"
      >
        <Card className="bg-white/80 backdrop-blur-xl border-white/20 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] overflow-hidden relative ring-1 ring-slate-900/5">
            <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-yellow-50/50 pointer-events-none" />
            
            <CardContent className="p-2 md:p-3">
            <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                    placeholder="Enter property address (e.g., 123 Main St, Houston, TX)" 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                    className="pl-12 h-16 bg-white border-0 text-slate-900 text-lg shadow-none focus-visible:ring-0 placeholder:text-slate-400 rounded-xl"
                />
                </div>
                <Button 
                onClick={runSearch} 
                disabled={loading} 
                className="h-16 px-8 bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 font-bold text-lg rounded-xl transition-all shadow-lg shadow-yellow-500/20 active:scale-[0.98] min-w-[180px]"
                >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Run Analysis'}
                </Button>
            </div>
            </CardContent>
            {/* Progress Bar Loader */}
            {loading && (
                 <div className="h-1 bg-slate-100 w-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 animate-progress" />
                 </div>
            )}
        </Card>
      </motion.div>

      {/* Sample addresses — quick start */}
      {!loading && !result && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="max-w-3xl mx-auto mt-4 flex flex-wrap justify-center gap-2"
        >
          <span className="text-xs text-slate-400 mr-1 self-center">Try:</span>
          {[
            '1600 Pennsylvania Ave, Washington, DC',
            '100 Congress Ave, Austin, TX',
            '350 Fifth Ave, New York, NY',
            '1 Infinite Loop, Cupertino, CA',
          ].map((sample) => (
            <button
              key={sample}
              onClick={() => { setAddress(sample); }}
              className="text-xs px-3 py-1.5 rounded-full bg-white/60 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-yellow-300 hover:bg-yellow-50 transition-all cursor-pointer"
            >
              {sample}
            </button>
          ))}
        </motion.div>
      )}

      {/* AgentCore live browser — placeholder while screenshots load */}
      {liveViewUrl && !activeScreenshot && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 max-w-4xl mx-auto rounded-2xl overflow-hidden border border-slate-700 shadow-2xl"
        >
          <div className="bg-slate-900 px-4 py-2.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-slate-400 text-xs font-mono">AgentCore Browser Tool — Live Session</span>
            <span className="ml-auto text-slate-600 text-xs font-mono">bedrock-agentcore</span>
          </div>
          <div className="bg-slate-950 flex flex-col items-center justify-center py-16 text-slate-500">
            <Monitor className="h-12 w-12 mb-4 animate-pulse" />
            <p className="text-sm font-medium text-slate-400">AI agent is browsing county records...</p>
            <p className="text-xs mt-1.5 text-slate-600">Live screenshots will appear in the terminal below</p>
          </div>
        </motion.div>
      )}

      {/* Processing Steps + Live Terminal */}
      <AnimatePresence mode="wait">
        {(loading || (logs.length > 0 && !result)) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-12 max-w-4xl mx-auto space-y-8"
          >
            {/* Step Tracker */}
            <div className="flex justify-between relative px-10">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 -translate-y-1/2" />
              {STEPS.map((step) => {
                const isActive = step.id === currentStep;
                const stepIndex = STEPS.findIndex(s => s.id === step.id);
                const currentIndex = STEPS.findIndex(s => s.id === currentStep);
                const isCompleted = currentIndex > stepIndex || currentStep === 'complete';
                return (
                  <div key={step.id} className="flex flex-col items-center gap-4 relative bg-white px-2">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 z-10",
                      isActive ? "bg-white border-yellow-500 text-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.3)] scale-110" :
                      isCompleted ? "bg-yellow-500 border-yellow-500 text-white shadow-md shadow-yellow-500/20" :
                      "bg-white border-slate-200 text-slate-300"
                    )}>
                      {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : <step.icon className="h-5 w-5" />}
                    </div>
                    <span className={cn(
                      "absolute top-14 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors duration-300",
                      (isActive || isCompleted) ? 'text-slate-900' : 'text-slate-300'
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="text-center">
              <span className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-600 bg-white px-5 py-2.5 rounded-full shadow-sm border border-slate-100">
                <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                {progressMessage}
              </span>
            </div>

            {/* Live Terminal Panel */}
            <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-slate-900/30">
              {/* Terminal chrome */}
              <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                    <Terminal className="h-3.5 w-3.5" />
                    nova-act-agent — title search
                  </div>
                  {screenshots.length > 0 && (
                    <span className="text-slate-500 text-xs font-mono">
                      · {screenshots.length} screenshot{screenshots.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowTerminal(v => !v)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", !showTerminal && "rotate-180")} />
                </button>
              </div>

              <AnimatePresence>
                {showTerminal && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                     {/* Live browser screenshot — only shown when real screenshots arrive from Nova Act */}
                      {activeScreenshot && (
                      <div className="bg-slate-900 border-b border-slate-800 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-slate-400 text-xs font-mono">
                            Nova Act Browser — {activeScreenshot.label}
                          </span>
                          {screenshots.length > 1 && (
                            <div className="ml-auto flex gap-1">
                              {screenshots.map((s, i) => (
                                <button
                                  key={s.id}
                                  onClick={() => setActiveScreenshot(s)}
                                  className={cn(
                                    "w-6 h-6 rounded text-xs font-mono transition",
                                    activeScreenshot.id === s.id
                                      ? "bg-yellow-500 text-slate-900"
                                      : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                                  )}
                                >
                                  {i + 1}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/jpeg;base64,${activeScreenshot.data}`}
                          alt={activeScreenshot.label}
                          className="w-full rounded-lg border border-slate-700 max-h-64 object-contain object-top"
                        />
                      </div>
                    )}

                    <div className="bg-slate-950 p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1">
                      {logs.map(log => (
                        <div key={log.id} className="flex gap-3 items-start leading-relaxed">
                          <span className="text-slate-600 shrink-0 select-none">{log.ts}</span>
                          <span
                            className="shrink-0 w-2 h-2 rounded-full mt-1.5"
                            style={{ backgroundColor: stepColor[log.step] || '#94a3b8' }}
                          />
                          <span
                            className="break-all"
                            style={{ color: log.step === 'error' ? '#f87171' : '#e2e8f0' }}
                          >
                            {log.message}
                          </span>
                        </div>
                      ))}
                      {loading && (
                        <div className="flex gap-3 items-center">
                          <span className="text-slate-600 select-none">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                          <span className="text-yellow-400 animate-pulse">▌</span>
                        </div>
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        
      {/* Error Display */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 max-w-2xl mx-auto p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3 shadow-sm"
        >
          <AlertTriangle className="h-5 w-5 shrink-0" /> 
          <span className="font-medium">{error}</span>
        </motion.div>
      )}

      {/* Results View */}
      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
          className="space-y-8 mt-16"
        >
          {/* Result Header */}
          <Card className="border-0 shadow-xl shadow-slate-200/50 bg-white overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-400" />
            <CardContent className="p-8 md:p-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-inner">
                    <Building2 className="h-8 w-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-yellow-600 font-semibold mb-1">
                      <MapPin className="h-4 w-4" />
                      {result.county}
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900">{result.propertyAddress}</h2>
                    <div className="flex gap-4 mt-2 text-slate-500 text-sm">
                      <span>APN: {result.parcelId || 'Searching...'}</span>
                      <span>•</span>
                      <span>{result.legalDescription ? result.legalDescription.slice(0, 50) + '...' : 'Legal Description Retrieved'}</span>
                    </div>
                    {(result as any).dataSource && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs text-slate-500 border-slate-200 gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                          {(result as any).dataSource}
                        </Badge>
                        {(result as any).overallConfidence && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs gap-1",
                              (result as any).overallConfidence.level === 'high' ? 'border-green-200 text-green-700 bg-green-50' :
                              (result as any).overallConfidence.level === 'medium' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                              'border-red-200 text-red-700 bg-red-50'
                            )}
                          >
                            Confidence: {(result as any).overallConfidence.score}% ({(result as any).overallConfidence.level})
                          </Badge>
                        )}
                        {(result as any).reviewStatus && (
                          <Badge variant="outline" className="text-xs border-yellow-200 text-yellow-700 bg-yellow-50">
                            Pending Review
                          </Badge>
                        )}
                        {(result as any).altaScheduleA?.commitmentNumber && (
                          <Badge variant="outline" className="text-xs border-purple-200 text-purple-700 bg-purple-50 font-mono">
                            {(result as any).altaScheduleA.commitmentNumber}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Button onClick={downloadPDF} className="bg-slate-900 text-white hover:bg-slate-800 h-12 px-6 rounded-xl font-medium shadow-lg shadow-slate-900/20 gap-2">
                  <Download className="h-4 w-4" />
                  Download PDF Report
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Summary & Risks */}
            <div className="space-y-8 lg:col-span-1">
              <Card className="border-0 shadow-lg shadow-slate-200/40 bg-white h-full">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900">Executive Summary</h3>
                  </div>
                  <div className="text-slate-600 leading-relaxed text-sm prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-ul:pl-0 prose-li:list-none prose-strong:text-slate-900">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
                  </div>
                  
                  <div className="mt-8 space-y-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-lg text-slate-900">Risk Assessment</h3>
                    </div>
                    {result.exceptions.length === 0 ? (
                      <div className="p-4 bg-green-50 text-green-700 rounded-xl text-sm font-medium flex gap-2">
                        <CheckCircle2 className="h-5 w-5 shrink-0" />
                        No major title exceptions detected.
                      </div>
                    ) : (
                      result.exceptions.map((ex, i) => (
                        <div key={i} className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-orange-800 text-sm">{ex.type} Risk</span>
                          </div>
                          <p className="text-sm text-orange-900 font-medium">{ex.description}</p>
                          <p className="text-xs text-orange-700 leading-relaxed">{ex.explanation}</p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Chain & Liens */}
            <div className="space-y-8 lg:col-span-2">
              {/* Chain of Title */}
              <Card className="border-0 shadow-lg shadow-slate-200/40 bg-white">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900">Chain of Title</h3>
                  </div>
                  
                  <div className="relative pl-4 space-y-8">
                    <div className="absolute top-2 left-[19px] bottom-2 w-0.5 bg-slate-100" />
                    {result.ownershipChain.length === 0 ? (
                      <div className="relative flex gap-6">
                        <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-white border-[3px] border-slate-300 mt-1.5 z-10" />
                        <div className="flex-1 p-5 rounded-xl bg-slate-50 border border-slate-100 border-dashed">
                          <div className="flex flex-col items-center justify-center py-4 text-center">
                            <FileText className="h-8 w-8 text-slate-300 mb-2" />
                            <p className="font-semibold text-slate-700">No Deeds Found</p>
                            <p className="text-xs text-slate-500 mt-1 max-w-[250px]">
                              We couldn't retrieve digital deed records for this property. This may require a manual courthouse search.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      result.ownershipChain.map((node, i) => (
                        <div key={i} className="relative flex gap-6">
                          <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-white border-[3px] border-slate-300 mt-1.5 z-10" />
                          <div className="flex-1 p-5 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <Badge variant="outline" className="bg-white text-slate-700 border-slate-200 font-mono text-xs">
                                {node.date}
                              </Badge>
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{node.documentType}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-3">
                              <div>
                                <span className="text-xs text-slate-400 font-medium uppercase">Grantor</span>
                                <p className="font-semibold text-slate-900">{node.grantor}</p>
                              </div>
                              <div>
                                <span className="text-xs text-slate-400 font-medium uppercase">Grantee</span>
                                <p className="font-semibold text-slate-900">{node.grantee}</p>
                              </div>
                            </div>
                            {node.documentNumber && (
                              <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-500">
                                Doc #: <span className="font-mono text-slate-700">{node.documentNumber}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Liens */}
              <Card className="border-0 shadow-lg shadow-slate-200/40 bg-white">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900">Active Liens & Encumbrances</h3>
                  </div>
                  {result.liens.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No active liens detected on this property.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {result.liens.map((lien, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs",
                              lien.type === 'Tax' ? 'bg-red-100 text-red-600' :
                              lien.type === 'HOA' ? 'bg-orange-100 text-orange-600' :
                              'bg-slate-100 text-slate-600'
                            )}>
                              {lien.type?.substring(0, 3).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{lien.claimant}</p>
                              <p className="text-sm text-slate-500">Recorded: {lien.dateRecorded} • {lien.status}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono font-bold text-slate-900">{lien.amount || 'Unknown Amount'}</p>
                            {lien.priority === 'High' && <Badge className="bg-red-500 text-white border-0 mt-1">High Priority</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Browser screenshots (collapsed, shown after result) */}
          {screenshots.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors list-none select-none">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                View Nova Act browser screenshots ({screenshots.length})
                <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {screenshots.map((shot) => (
                  <div key={shot.id} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                    <div className="bg-slate-800 px-3 py-1.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      <span className="text-slate-300 text-xs font-mono truncate">{shot.label}</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:image/jpeg;base64,${shot.data}`}
                      alt={shot.label}
                      className="w-full object-cover object-top max-h-48"
                    />
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* Completed terminal log (collapsed by default) */}
          {logs.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors list-none select-none">
                <Terminal className="h-4 w-4" />
                View agent activity log ({logs.length} events)
                <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 rounded-xl overflow-hidden border border-slate-800">
                <div className="bg-slate-950 p-4 font-mono text-xs max-h-64 overflow-y-auto space-y-1">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-3 items-start leading-relaxed">
                      <span className="text-slate-600 shrink-0 select-none">{log.ts}</span>
                      <span className="shrink-0 w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: stepColor[log.step] || '#94a3b8' }} />
                      <span className="break-all" style={{ color: log.step === 'error' ? '#f87171' : '#e2e8f0' }}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          )}
        </motion.div>
      )}
    </div>
  );
}
