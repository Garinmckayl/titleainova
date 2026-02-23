"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, MapPin, ArrowRight, Clock, FileText, AlertTriangle, CheckCircle2, Loader2, History } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchRow {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  created_at: string;
  report: {
    summary?: string;
    exceptions?: Array<{ type: string; description: string }>;
    liens?: Array<{ type: string; amount: string; status: string }>;
    ownershipChain?: Array<{ grantor: string; grantee: string; date: string }>;
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
      {isLive ? 'Nova Act Live' : isSimulation ? 'Demo' : (source || 'Web Search')}
    </Badge>
  );
}

export default function SearchesPage() {
  const [searches, setSearches] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              <p className="text-slate-500 mt-1">Your recent title searches powered by Amazon Nova Act</p>
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
      {!loading && !error && searches.length === 0 && (
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

      {/* Search list */}
      {!loading && !error && searches.length > 0 && (
        <div className="space-y-4">
          {searches.map((row, i) => {
            const lienCount = row.report?.liens?.length ?? 0;
            const exceptionCount = row.report?.exceptions?.length ?? 0;
            const chainLength = row.report?.ownershipChain?.length ?? 0;
            const latestOwner = row.report?.ownershipChain?.at(-1)?.grantee;
            const riskLevel = exceptionCount === 0 ? 'clean' : exceptionCount <= 2 ? 'medium' : 'high';

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="border-0 shadow-md shadow-slate-200/50 hover:shadow-lg hover:shadow-slate-200/70 transition-all bg-white overflow-hidden group">
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
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-sm mt-1 flex-wrap">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{row.county}</span>
                            {row.parcel_id && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="font-mono text-xs">APN: {row.parcel_id}</span>
                              </>
                            )}
                            <span className="text-slate-300">•</span>
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
                        {/* Stats */}
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

                        <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats footer */}
      {!loading && searches.length > 0 && (
        <div className="mt-8 text-center text-slate-400 text-sm">
          Showing {searches.length} most recent search{searches.length !== 1 ? 'es' : ''}
          {' · '}Powered by{' '}
          <span className="text-slate-600 font-semibold">Amazon Nova Act</span>
          {' + '}
          <span className="text-slate-600 font-semibold">Turso libSQL</span>
        </div>
      )}
    </div>
  );
}
