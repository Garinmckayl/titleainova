"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, MapPin, ArrowRight, Clock, FileText, AlertTriangle,
  CheckCircle2, Loader2, History, ChevronDown, ShieldCheck, Camera, X,
  Share2, Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Navbar } from '@/components/navbar-simple';
import { Footer } from '@/components/footer-simple';

interface ScreenshotRecord {
  label: string;
  step: string;
  data: string; // base64 jpeg
}

interface SearchRow {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  created_at: string;
  review_status: string;
  screenshots: ScreenshotRecord[];
  report: {
    summary?: string;
    overallConfidence?: { level: string; score: number };
    exceptions?: Array<{ type: string; description: string; explanation?: string }>;
    liens?: Array<{ type: string; amount: string; status: string; claimant?: string; dateRecorded?: string; priority?: string }>;
    ownershipChain?: Array<{ grantor: string; grantee: string; date: string; documentType?: string; documentNumber?: string }>;
    altaScheduleA?: {
      effectiveDate: string;
      policyAmount?: string;
      estateType: string;
      vestedOwner: string;
      legalDescription: string;
      commitmentNumber: string;
    };
    altaScheduleB?: {
      requirements: Array<{ number: string; description: string; satisfied: boolean }>;
      exceptions: Array<{ number: string; category: string; description: string; removable: boolean }>;
    };
  };
}

function SourceBadge({ source }: { source: string | null }) {
  const isLive = source?.includes('nova_act') && !source?.includes('simulation');
  const isSimulation = source?.includes('simulation');

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs gap-1.5',
        isLive ? 'border-green-200 text-green-700 bg-green-50' :
        isSimulation ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
        'border-slate-200 text-slate-500 bg-slate-50'
      )}
    >
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        isLive ? 'bg-green-500' : isSimulation ? 'bg-yellow-500' : 'bg-slate-400'
      )} />
      {isLive ? 'Live Browser' : isSimulation ? 'Demo' : (source || 'Web Search')}
    </Badge>
  );
}

/* ─── Detail view for a single search ────────────────────────── */
function SearchDetail({ row, onClose }: { row: SearchRow; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);

  const getShareUrl = () => {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.thebigfourai.com';
    return `${base}/report?id=${row.id}`;
  };

  const handleShare = () => {
    const url = getShareUrl();
    if (navigator.share) {
      navigator.share({ title: `Title Report - ${row.address}`, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
            <h2 className="text-xl font-bold text-slate-900">{row.address}</h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <SourceBadge source={row.source} />
              <span className="text-xs text-slate-400">{row.county}</span>
              {row.parcel_id && <span className="text-xs text-slate-400 font-mono">APN: {row.parcel_id}</span>}
              <span className="text-xs text-slate-400">
                {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleShare} variant="outline" size="sm" className="gap-1.5 text-yellow-700 border-yellow-200 hover:bg-yellow-50">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? 'Link Copied!' : 'Share Report'}
          </Button>
          <Button onClick={onClose} variant="outline" size="sm" className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Back
          </Button>
        </div>
      </div>

      {/* Browser Screenshots */}
      {row.screenshots && row.screenshots.length > 0 && (
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <div className="bg-slate-900 px-4 py-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-green-400" />
            <span className="text-slate-300 text-sm font-semibold">
              Browser Screenshots ({row.screenshots.length})
            </span>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {row.screenshots.map((shot, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <div className="bg-slate-800 px-3 py-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-slate-300 text-xs font-mono truncate">{shot.label}</span>
                    <Badge variant="outline" className="ml-auto text-[10px] text-slate-500 border-slate-600">{shot.step}</Badge>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/jpeg;base64,${shot.data}`}
                    alt={shot.label}
                    className="w-full object-cover object-top"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {row.report?.summary && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Executive Summary</h3>
            </div>
            <div className="text-slate-600 leading-relaxed text-sm prose prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{row.report.summary}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chain of Title */}
      {row.report?.ownershipChain && row.report.ownershipChain.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">
                Chain of Title ({row.report.ownershipChain.length} records)
              </h3>
            </div>
            <div className="relative pl-4 space-y-4">
              <div className="absolute top-2 left-[19px] bottom-2 w-0.5 bg-slate-100" />
              {row.report.ownershipChain.map((node, i) => (
                <div key={i} className="relative flex gap-4">
                  <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-white border-[3px] border-slate-300 mt-1.5 z-10" />
                  <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="outline" className="bg-white text-xs font-mono">{node.date}</Badge>
                      {node.documentType && <span className="text-xs font-bold text-slate-400 uppercase">{node.documentType}</span>}
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
                    {node.documentNumber && (
                      <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                        Doc #: <span className="font-mono text-slate-700">{node.documentNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liens */}
      {row.report?.liens && row.report.liens.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Liens & Encumbrances ({row.report.liens.length})</h3>
            </div>
            <div className="space-y-3">
              {row.report.liens.map((lien, i) => (
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
      {row.report?.exceptions && row.report.exceptions.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">Title Exceptions ({row.report.exceptions.length})</h3>
            </div>
            <div className="space-y-3">
              {row.report.exceptions.map((ex, i) => (
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

      {/* ALTA Schedule A — Title Commitment */}
      {row.report?.altaScheduleA && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">ALTA Schedule A — Title Commitment</h3>
              {row.report.altaScheduleA.commitmentNumber && (
                <Badge variant="outline" className="ml-auto font-mono text-xs">{row.report.altaScheduleA.commitmentNumber}</Badge>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <span className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Effective Date</span>
                <p className="font-bold text-slate-900 mt-1">{row.report.altaScheduleA.effectiveDate || 'N/A'}</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <span className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Estate Type</span>
                <p className="font-bold text-slate-900 mt-1">{row.report.altaScheduleA.estateType || 'Fee Simple'}</p>
              </div>
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <span className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Vested Owner</span>
                <p className="font-bold text-slate-900 mt-1">{row.report.altaScheduleA.vestedOwner || 'N/A'}</p>
              </div>
              {row.report.altaScheduleA.policyAmount && (
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                  <span className="text-xs text-indigo-500 font-semibold uppercase tracking-wider">Policy Amount</span>
                  <p className="font-bold text-slate-900 mt-1">{row.report.altaScheduleA.policyAmount}</p>
                </div>
              )}
            </div>
            {row.report.altaScheduleA.legalDescription && (
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Legal Description</span>
                <p className="text-sm text-slate-700 mt-1 font-mono leading-relaxed">{row.report.altaScheduleA.legalDescription}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ALTA Schedule B — Requirements & Exceptions */}
      {row.report?.altaScheduleB && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">ALTA Schedule B — Requirements & Exceptions</h3>
            </div>

            {row.report.altaScheduleB.requirements?.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Part I — Requirements</h4>
                <div className="space-y-2">
                  {row.report.altaScheduleB.requirements.map((req, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5",
                        req.satisfied ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      )}>
                        {req.satisfied ? <CheckCircle2 className="w-3.5 h-3.5" /> : req.number}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-800">{req.description}</p>
                        <span className={cn(
                          "text-xs font-semibold mt-1 inline-block",
                          req.satisfied ? "text-green-600" : "text-yellow-600"
                        )}>
                          {req.satisfied ? 'Satisfied' : 'Outstanding'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {row.report.altaScheduleB.exceptions?.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Part II — Exceptions from Coverage</h4>
                <div className="space-y-2">
                  {row.report.altaScheduleB.exceptions.map((ex, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100"
                      style={{ backgroundColor: ex.category === 'standard' ? '#f8fafc' : '#fffbeb' }}>
                      <Badge variant="outline" className={cn(
                        "shrink-0 text-[10px] uppercase",
                        ex.category === 'standard' ? "border-slate-300 text-slate-500" : "border-amber-300 text-amber-700"
                      )}>
                        {ex.number}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-sm text-slate-800">{ex.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">{ex.category}</Badge>
                          {ex.removable && (
                            <span className="text-xs text-green-600 font-semibold">Removable</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════ */

export default function SearchesPage() {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SearchRow | null>(null);

  useEffect(() => {
    fetch('/api/searches?limit=20')
      .then(r => r.json())
      .then(json => {
        if (json.success) setSearches(json.data);
        else setError(json.error || 'Failed to load');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600">
              <History className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Search History</h1>
               <p className="text-slate-500 mt-1">Your recent title searches and results</p>
            </div>
          </div>
          <Link href="/titleai">
            <Button className="bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 font-bold gap-2">
              <FileText className="h-4 w-4" />
              New Search
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-5 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && searches.length === 0 && !selected && (
        <div className="text-center py-24">
          <Building2 className="h-16 w-16 text-slate-200 mx-auto mb-4" />
          <p className="text-xl font-semibold text-slate-400 mb-2">No searches yet</p>
          <p className="text-slate-400 mb-8">Run your first title search to see results here.</p>
          <Link href="/titleai">
            <Button className="bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 font-bold gap-2">
              <ArrowRight className="h-4 w-4" />
              Start Searching
            </Button>
          </Link>
        </div>
      )}

      {/* Detail view OR list */}
      <AnimatePresence mode="wait">
        {selected ? (
          <SearchDetail key={selected.id} row={selected} onClose={() => setSelected(null)} />
        ) : (
          !loading && !error && searches.length > 0 && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="space-y-4">
                {searches.map((row, i) => {
                  const lienCount = row.report?.liens?.length ?? 0;
                  const exceptionCount = row.report?.exceptions?.length ?? 0;
                  const chainLength = row.report?.ownershipChain?.length ?? 0;
                  const latestOwner = row.report?.ownershipChain?.at(-1)?.grantee;
                  const riskLevel = exceptionCount === 0 ? 'clean' : exceptionCount <= 2 ? 'medium' : 'high';
                  const hasScreenshots = row.screenshots && row.screenshots.length > 0;
                  const reviewStatus = row.review_status || 'pending_review';
                  const confidence = row.report?.overallConfidence;

                  return (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <Card
                        className="border-0 shadow-md shadow-slate-200/50 hover:shadow-lg hover:shadow-slate-200/70 transition-all bg-white overflow-hidden group cursor-pointer"
                        onClick={() => setSelected(row)}
                      >
                        <div className={cn(
                          "h-1",
                          riskLevel === 'clean' ? 'bg-green-400' :
                          riskLevel === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
                        )} />
                        <CardContent className="p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4 flex-1 min-w-0">
                              <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                                <Building2 className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-bold text-slate-900 text-lg truncate">{row.address}</h3>
                                  <SourceBadge source={row.source} />
                                   {hasScreenshots && (
                                     <Badge variant="outline" className="text-xs gap-1 border-green-200 text-green-700 bg-green-50">
                                       <Camera className="h-3 w-3" />
                                       {row.screenshots.length}
                                     </Badge>
                                   )}
                                   <Badge
                                     variant="outline"
                                     className={cn(
                                       "text-xs gap-1",
                                       reviewStatus === 'approved' ? 'border-green-200 text-green-700 bg-green-50' :
                                       reviewStatus === 'rejected' ? 'border-red-200 text-red-700 bg-red-50' :
                                       reviewStatus === 'in_review' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                       'border-yellow-200 text-yellow-700 bg-yellow-50'
                                     )}
                                   >
                                     {reviewStatus === 'pending_review' ? 'Pending Review' :
                                      reviewStatus === 'in_review' ? 'In Review' :
                                      reviewStatus === 'approved' ? 'Approved' :
                                      reviewStatus === 'rejected' ? 'Rejected' : reviewStatus}
                                   </Badge>
                                   {confidence && (
                                     <Badge
                                       variant="outline"
                                       className={cn(
                                         "text-xs",
                                         confidence.level === 'high' ? 'border-green-200 text-green-700 bg-green-50' :
                                         confidence.level === 'medium' ? 'border-yellow-200 text-yellow-700 bg-yellow-50' :
                                         'border-red-200 text-red-700 bg-red-50'
                                       )}
                                     >
                                       {confidence.score}% conf
                                     </Badge>
                                   )}
                                </div>
                                <div className="flex items-center gap-2 text-slate-500 text-sm mt-1 flex-wrap">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span>{row.county}</span>
                                  {row.parcel_id && (
                                    <>
                                      <span className="text-slate-300">-</span>
                                      <span className="font-mono text-xs">APN: {row.parcel_id}</span>
                                    </>
                                  )}
                                  <span className="text-slate-300">-</span>
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  <span>{new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {latestOwner && (
                                  <p className="text-slate-500 text-sm mt-1.5">
                                    Current owner: <span className="font-semibold text-slate-700">{latestOwner}</span>
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-6 shrink-0">
                              <div className="flex gap-4 text-center">
                                <div>
                                  <div className="text-lg font-bold text-slate-900">{chainLength}</div>
                                  <div className="text-xs text-slate-400 uppercase tracking-wide">Deeds</div>
                                </div>
                                <div>
                                  <div className={cn("text-lg font-bold", lienCount > 0 ? 'text-red-600' : 'text-green-600')}>
                                    {lienCount}
                                  </div>
                                  <div className="text-xs text-slate-400 uppercase tracking-wide">Liens</div>
                                </div>
                                <div>
                                  {riskLevel === 'clean' ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
                                  ) : (
                                    <AlertTriangle className={cn("h-6 w-6 mx-auto", riskLevel === 'high' ? 'text-red-500' : 'text-yellow-500')} />
                                  )}
                                  <div className="text-xs text-slate-400 uppercase tracking-wide mt-0.5">
                                    {riskLevel === 'clean' ? 'Clean' : riskLevel === 'medium' ? 'Review' : 'Risks'}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.thebigfourai.com';
                                  const url = `${base}/report?id=${row.id}`;
                                  if (navigator.share) {
                                    navigator.share({ title: `Title Report - ${row.address}`, url });
                                  } else {
                                    navigator.clipboard.writeText(url);
                                    const btn = e.currentTarget;
                                    btn.title = 'Copied!';
                                    setTimeout(() => { btn.title = 'Share report link'; }, 2000);
                                  }
                                }}
                                className="p-2 rounded-lg text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                                title="Share report link"
                              >
                                <Share2 className="h-4 w-4" />
                              </button>

                              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* Stats footer */}
      {!loading && !selected && searches.length > 0 && (
        <div className="mt-8 text-center text-slate-400 text-sm">
          Showing {searches.length} most recent search{searches.length !== 1 ? 'es' : ''}
        </div>
      )}
      </div>
      <Footer />
    </div>
  );
}
