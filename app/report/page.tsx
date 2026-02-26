"use client";

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2, FileText, AlertTriangle, CheckCircle2, Loader2,
  ShieldCheck, Camera, MapPin, Clock, ArrowLeft, Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';

interface ReportData {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  created_at: string;
  review_status: string;
  screenshots: Array<{ label: string; step: string; data: string }>;
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

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    }>
      <ReportPageContent />
    </Suspense>
  );
}

function ReportPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('No report ID provided');
      setLoading(false);
      return;
    }

    fetch(`/api/report?id=${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.success) setReport(json.data);
        else setError(json.error || 'Report not found');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = () => {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'https://www.thebigfourai.com';
    const url = `${base}/report?id=${id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-700 mb-2">Report Not Found</h1>
          <p className="text-slate-500 mb-6">{error || 'This report may have been removed or the link is invalid.'}</p>
          <Link href="/">
            <Button className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go to Title AI
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const row = report;
  const confidence = row.report?.overallConfidence;
  const lienCount = row.report?.liens?.length ?? 0;
  const chainLength = row.report?.ownershipChain?.length ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white">
      {/* Simple header for shared reports */}
      <div className="bg-white border-b border-slate-100 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">Title AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button onClick={handleShare} variant="outline" size="sm" className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              Share
            </Button>
            <Link href="/titleai">
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold gap-1.5">
                Run Your Own Search
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
        {/* Report Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{row.address}</h1>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {row.county}
                </div>
                {row.parcel_id && <span className="text-xs text-slate-400 font-mono">APN: {row.parcel_id}</span>}
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
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
                    {confidence.score}% confidence
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
            <div className="text-2xl font-bold text-slate-900">{chainLength}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Deeds Found</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
            <div className={cn("text-2xl font-bold", lienCount > 0 ? 'text-red-600' : 'text-green-600')}>
              {lienCount}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Liens</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
            <div className={cn("text-2xl font-bold", (row.report?.exceptions?.length || 0) > 0 ? 'text-orange-600' : 'text-green-600')}>
              {row.report?.exceptions?.length || 0}
            </div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">Exceptions</div>
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
            <div className="text-2xl font-bold text-yellow-600">{row.county}</div>
            <div className="text-xs text-slate-400 uppercase tracking-wide">County</div>
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
                      <p className="text-sm text-slate-500">{lien.type} - {lien.status}</p>
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
                <h3 className="font-bold text-lg text-slate-900">ALTA Schedule A &mdash; Title Commitment</h3>
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
                <h3 className="font-bold text-lg text-slate-900">ALTA Schedule B &mdash; Requirements & Exceptions</h3>
              </div>

              {row.report.altaScheduleB.requirements?.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Part I &mdash; Requirements</h4>
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
                  <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Part II &mdash; Exceptions from Coverage</h4>
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

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-sm text-slate-400 mb-4">
            This report was generated by Title AI &mdash; powered by autonomous AI agents searching real county records.
          </p>
          <Link href="https://www.thebigfourai.com/searches">
            <Button variant="outline" className="gap-2">
              <Building2 className="h-4 w-4" />
              View More Reports at thebigfourai.com
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
