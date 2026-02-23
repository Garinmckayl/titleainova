"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, Building2, MapPin, Loader2, ArrowRight, CheckCircle2,
  AlertTriangle, Clock, Terminal, ChevronDown, Download, FileText,
  ShieldCheck, Workflow, RefreshCw, Play, ExternalLink
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ─── types matching the DB shape ────────────────────────────── */
type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

interface Job {
  id: string;
  address: string;
  status: JobStatus;
  current_step: string | null;
  progress_pct: number;
  logs: string[];
  result: any | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/* ─── Step definitions ───────────────────────────────────────── */
const STEPS = [
  { id: 'lookup',    label: 'Lookup',       pct: 20 },
  { id: 'retrieval', label: 'Retrieval',    pct: 40 },
  { id: 'chain',     label: 'Chain',        pct: 55 },
  { id: 'liens',     label: 'Liens',        pct: 65 },
  { id: 'risk',      label: 'Risk',         pct: 80 },
  { id: 'summary',   label: 'Report',       pct: 90 },
  { id: 'complete',  label: 'Done',         pct: 100 },
];

/* ─── Status badge ───────────────────────────────────────────── */
function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    queued: 'bg-slate-100 text-slate-600 border-slate-200',
    running: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
  };
  const icons: Record<JobStatus, React.ReactNode> = {
    queued: <Clock className="w-3 h-3" />,
    running: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
    failed: <AlertTriangle className="w-3 h-3" />,
  };
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-xs font-semibold', styles[status])}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

/* ─── Job detail panel ───────────────────────────────────────── */
function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [showLogs, setShowLogs] = useState(true);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [job.logs]);

  const currentStepIdx = STEPS.findIndex(s => s.id === job.current_step);

  const downloadPDF = () => {
    if (!job.result?.pdfBase64) return;
    const link = document.createElement('a');
    link.href = `data:application/pdf;base64,${job.result.pdfBase64}`;
    link.download = `TitleAI_Report_${job.address.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{job.address}</h2>
            <div className="flex items-center gap-3 mt-1">
              <StatusBadge status={job.status} />
              <span className="text-xs text-slate-400 font-mono">{job.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === 'completed' && job.result?.pdfBase64 && (
            <Button onClick={downloadPDF} size="sm" className="bg-slate-900 text-white gap-1.5">
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          )}
          <Button onClick={onClose} variant="outline" size="sm">
            Back to Jobs
          </Button>
        </div>
      </div>

      {/* Step progress */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-slate-700">Progress</span>
          <span className="text-sm font-bold text-yellow-600">{job.progress_pct}%</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
          <motion.div
            className={cn(
              "h-full rounded-full",
              job.status === 'failed' ? 'bg-red-500' :
              job.status === 'completed' ? 'bg-green-500' :
              'bg-gradient-to-r from-yellow-400 to-orange-500'
            )}
            initial={{ width: 0 }}
            animate={{ width: `${job.progress_pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        {/* Step dots */}
        <div className="flex justify-between">
          {STEPS.map((step, i) => {
            const isActive = step.id === job.current_step;
            const isDone = currentStepIdx > i || job.status === 'completed';
            return (
              <div key={step.id} className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  isActive ? "bg-yellow-500 text-white shadow-lg shadow-yellow-500/30 scale-110" :
                  isDone ? "bg-green-500 text-white" :
                  "bg-slate-100 text-slate-400"
                )}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  isActive || isDone ? 'text-slate-700' : 'text-slate-300'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live logs */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        <div className="bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
              <Terminal className="h-3.5 w-3.5" />
              inngest-durable-agent — {job.id}
            </div>
            {job.status === 'running' && (
              <span className="flex items-center gap-1.5 text-yellow-400 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                live
              </span>
            )}
          </div>
          <button
            onClick={() => setShowLogs(v => !v)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", !showLogs && "rotate-180")} />
          </button>
        </div>

        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-950 p-4 font-mono text-xs max-h-72 overflow-y-auto space-y-1">
                {job.logs.length === 0 && (
                  <span className="text-slate-600">Waiting for agent to start...</span>
                )}
                {job.logs.map((log, i) => (
                  <div key={i} className="flex gap-3 items-start leading-relaxed">
                    <span className="text-slate-600 shrink-0 select-none">{String(i + 1).padStart(3, '0')}</span>
                    <span className="shrink-0 w-2 h-2 rounded-full mt-1.5 bg-yellow-400" />
                    <span className="text-slate-200 break-all">{log}</span>
                  </div>
                ))}
                {job.status === 'running' && (
                  <div className="flex gap-3 items-center">
                    <span className="text-slate-600 select-none">&nbsp;&nbsp;&nbsp;</span>
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                    <span className="text-yellow-400 animate-pulse">...</span>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      {job.error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="font-medium">{job.error}</span>
        </div>
      )}

      {/* Result */}
      {job.status === 'completed' && job.result && (
        <div className="space-y-6">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
              <div className="text-2xl font-bold text-slate-900">{job.result.ownershipChain?.length || 0}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Deeds Found</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
              <div className={cn("text-2xl font-bold", (job.result.liens?.length || 0) > 0 ? 'text-red-600' : 'text-green-600')}>
                {job.result.liens?.length || 0}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Liens</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
              <div className={cn("text-2xl font-bold", (job.result.exceptions?.length || 0) > 0 ? 'text-orange-600' : 'text-green-600')}>
                {job.result.exceptions?.length || 0}
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Exceptions</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-100 text-center">
              <div className="text-2xl font-bold text-yellow-600">{job.result.county || 'N/A'}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">County</div>
            </div>
          </div>

          {/* Summary */}
          {job.result.summary && (
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">Executive Summary</h3>
                </div>
                <div className="text-slate-600 leading-relaxed text-sm prose prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{job.result.summary}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chain of Title */}
          {job.result.ownershipChain?.length > 0 && (
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">
                    Chain of Title ({job.result.ownershipChain.length} records)
                  </h3>
                </div>
                <div className="relative pl-4 space-y-4">
                  <div className="absolute top-2 left-[19px] bottom-2 w-0.5 bg-slate-100" />
                  {job.result.ownershipChain.map((node: any, i: number) => (
                    <div key={i} className="relative flex gap-4">
                      <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-white border-[3px] border-slate-300 mt-1.5 z-10" />
                      <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex justify-between items-start mb-2">
                          <Badge variant="outline" className="bg-white text-xs font-mono">{node.date}</Badge>
                          <span className="text-xs font-bold text-slate-400 uppercase">{node.documentType}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-xs text-slate-400 font-medium uppercase">Grantor</span>
                            <p className="font-semibold text-slate-900 text-sm">{node.grantor}</p>
                          </div>
                          <div>
                            <span className="text-xs text-slate-400 font-medium uppercase">Grantee</span>
                            <p className="font-semibold text-slate-900 text-sm">{node.grantee}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liens */}
          {job.result.liens?.length > 0 && (
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">Liens & Encumbrances ({job.result.liens.length})</h3>
                </div>
                <div className="space-y-3">
                  {job.result.liens.map((lien: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-900">{lien.claimant || lien.type}</p>
                        <p className="text-sm text-slate-500">{lien.type} - {lien.status}{lien.dateRecorded && ` - ${lien.dateRecorded}`}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-bold text-slate-900">{lien.amount || 'N/A'}</p>
                        {lien.priority === 'High' && <Badge className="bg-red-500 text-white border-0 mt-1 text-xs">High</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exceptions */}
          {job.result.exceptions?.length > 0 && (
            <Card className="border-0 shadow-lg bg-white">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900">Title Exceptions ({job.result.exceptions.length})</h3>
                </div>
                <div className="space-y-3">
                  {job.result.exceptions.map((ex: any, i: number) => (
                    <div key={i} className="p-4 bg-orange-50 border border-orange-100 rounded-xl">
                      <span className="font-bold text-orange-800 text-sm">{ex.type}</span>
                      <p className="text-sm text-orange-900 mt-1">{ex.description}</p>
                      {ex.explanation && <p className="text-xs text-orange-700 mt-1">{ex.explanation}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════════════════════
 * Main Jobs Page
 * ═══════════════════════════════════════════════════════════════ */
export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedJobRef = useRef<Job | null>(null);
  selectedJobRef.current = selectedJob;

  /* ── Fetch jobs list ──────────────────────────────────────── */
  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?limit=20');
      const json = await res.json();
      if (json.success) {
        setJobs(json.data);
        // Update selectedJob if it's in the list
        if (selectedJobRef.current) {
          const updated = json.data.find((j: Job) => j.id === selectedJobRef.current!.id);
          if (updated) setSelectedJob(updated);
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch jobs', e);
    }
  }, []);

  /* ── Fetch a single job (for detail view) ─────────────────── */
  const fetchJob = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/jobs?id=${id}`);
      const json = await res.json();
      if (json.success) setSelectedJob(json.data);
    } catch (e: any) {
      console.error('Failed to fetch job', e);
    }
  }, []);

  /* ── Initial load + polling ────────────────────────────────── */
  useEffect(() => {
    fetchJobs().finally(() => setLoading(false));

    // Poll every 3 seconds for updates
    pollRef.current = setInterval(() => {
      const current = selectedJobRef.current;
      if (current && (current.status === 'queued' || current.status === 'running')) {
        fetchJob(current.id);
      }
      fetchJobs();
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchJobs, fetchJob]);

  /* ── Submit a new job ──────────────────────────────────────── */
  const submitJob = async () => {
    if (!address.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to submit');

      setAddress('');
      // Immediately fetch the new job and select it
      await fetchJobs();
      const jobRes = await fetch(`/api/jobs?id=${json.jobId}`);
      const jobJson = await jobRes.json();
      if (jobJson.success) setSelectedJob(jobJson.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#fefce8]/80 backdrop-blur-md border-b border-yellow-200/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Title AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/titleai">
              <Button variant="ghost" size="sm">Instant Search</Button>
            </Link>
            <Link href="/searches">
              <Button variant="ghost" size="sm">History</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto max-w-5xl px-6 py-12">
        {/* Page Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600">
            <Workflow className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Durable Agent Jobs</h1>
            <p className="text-slate-500 mt-1">
              Long-running title searches powered by Inngest durable execution.
              Close your browser — come back anytime.
            </p>
          </div>
        </div>

        {/* Submit form */}
        <Card className="bg-white/80 backdrop-blur-xl border-white/20 shadow-lg mb-8 overflow-hidden ring-1 ring-slate-900/5">
          <CardContent className="p-3">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Enter property address for background search..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitJob()}
                  className="pl-12 h-14 bg-white border-0 text-slate-900 text-lg shadow-none focus-visible:ring-0 placeholder:text-slate-400 rounded-xl"
                />
              </div>
              <Button
                onClick={submitJob}
                disabled={submitting || !address.trim()}
                className="h-14 px-8 bg-purple-600 hover:bg-purple-500 text-white font-bold text-base rounded-xl shadow-lg shadow-purple-500/20 gap-2"
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                Start Durable Job
              </Button>
            </div>
          </CardContent>
          <div className="px-4 pb-3 flex items-center gap-2 text-xs text-slate-400">
            <Workflow className="h-3 w-3" />
            Runs via Inngest — survives browser close, network drops, and server restarts
          </div>
        </Card>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Detail view OR list view */}
        <AnimatePresence mode="wait">
          {selectedJob ? (
            <JobDetail
              key={selectedJob.id}
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {loading && (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
                </div>
              )}

              {!loading && jobs.length === 0 && (
                <div className="text-center py-20">
                  <Workflow className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-slate-400 mb-2">No durable jobs yet</p>
                  <p className="text-slate-400 mb-4">
                    Submit a property address above to start a background title search.
                  </p>
                </div>
              )}

              {!loading && jobs.length > 0 && (
                <div className="space-y-3">
                  {jobs.map((job, i) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Card
                        className="border-0 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden cursor-pointer group"
                        onClick={() => {
                          setSelectedJob(job);
                          // If running/queued, start polling
                          if (job.status === 'running' || job.status === 'queued') {
                            fetchJob(job.id);
                          }
                        }}
                      >
                        {/* Progress strip */}
                        <div className="h-1 bg-slate-100">
                          <div
                            className={cn(
                              "h-full transition-all duration-500",
                              job.status === 'failed' ? 'bg-red-500' :
                              job.status === 'completed' ? 'bg-green-500' :
                              'bg-gradient-to-r from-yellow-400 to-orange-500'
                            )}
                            style={{ width: `${job.progress_pct}%` }}
                          />
                        </div>
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                                <Building2 className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-slate-900 truncate">{job.address}</h3>
                                  <StatusBadge status={job.status} />
                                </div>
                                <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                                  <span className="font-mono">{job.id}</span>
                                  <span>-</span>
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {new Date(job.created_at).toLocaleDateString('en-US', {
                                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                  </span>
                                  {job.current_step && job.status === 'running' && (
                                    <>
                                      <span>-</span>
                                      <span className="text-yellow-600 font-semibold">{job.current_step}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-sm font-bold text-slate-500">{job.progress_pct}%</span>
                              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-12 text-center text-slate-400 text-sm">
          Powered by{' '}
          <span className="text-slate-600 font-semibold">Inngest Durable Execution</span>
          {' + '}
          <span className="text-slate-600 font-semibold">Amazon Nova Act</span>
          {' + '}
          <span className="text-slate-600 font-semibold">Nova Pro</span>
        </div>
      </div>
    </div>
  );
}
