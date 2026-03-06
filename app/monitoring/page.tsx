"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  MapPin,
  RefreshCw,
  Server,
  ShieldAlert,
  Signal,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";

/* ─── Types ──────────────────────────────────────────────────── */

interface CountyHealthStatus {
  countyName: string;
  state: string;
  recorderUrl: string;
  lastChecked: string;
  isOnline: boolean;
  responseTimeMs: number;
  lastSuccessfulSearch?: string;
  failureCount: number;
  structureChanged: boolean;
  notes?: string;
}

interface CoverageGap {
  state: string;
  totalCounties: number;
  coveredCounties: number;
  coveragePercent: number;
  priority: "high" | "medium" | "low";
}

interface MonitoringData {
  totalCounties: number;
  healthStatuses: CountyHealthStatus[];
  coverageGaps: CoverageGap[];
  summary: {
    online: number;
    offline: number;
    unchecked: number;
    statesWithCoverage: number;
  };
}

/* ─── Priority Badge ─────────────────────────────────────────── */

function PriorityBadge({ priority }: { priority: CoverageGap["priority"] }) {
  const styles = {
    high: "bg-red-50 text-red-700 border-red-200",
    medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
    low: "bg-slate-50 text-slate-500 border-slate-200",
  };
  return (
    <Badge variant="outline" className={cn("text-xs font-semibold capitalize", styles[priority])}>
      {priority}
    </Badge>
  );
}

/* ─── Status Badge ───────────────────────────────────────────── */

function OnlineBadge({ isOnline }: { isOnline: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 text-xs font-semibold",
        isOnline
          ? "bg-green-50 text-green-700 border-green-200"
          : "bg-red-50 text-red-700 border-red-200"
      )}
    >
      {isOnline ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {isOnline ? "Online" : "Offline"}
    </Badge>
  );
}

/* ─── Stat Card ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-0 shadow-lg bg-white overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">
                {label}
              </p>
              <p className="text-3xl font-bold text-slate-900">{value}</p>
            </div>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", accent)}>
              <Icon className="h-6 w-6" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * Main Monitoring Page
 * ═══════════════════════════════════════════════════════════════ */
export default function MonitoringPage() {
  const [data, setData] = useState<MonitoringData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  /* ── Fetch cached monitoring data ─────────────────────────── */
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring");
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error || "Failed to load monitoring data");
      }
    } catch (e: any) {
      setError(e.message || "Network error");
    }
  }, []);

  /* ── Initial load ─────────────────────────────────────────── */
  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  /* ── Run full health check ────────────────────────────────── */
  const runHealthCheck = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/monitoring", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Health check failed");
      }
    } catch (e: any) {
      setError(e.message || "Network error during health check");
    } finally {
      setChecking(false);
    }
  };

  /* ── Format time ago ──────────────────────────────────────── */
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  /* ── Response time color ──────────────────────────────────── */
  const responseTimeColor = (ms: number) => {
    if (ms < 1000) return "text-green-600";
    if (ms < 3000) return "text-yellow-600";
    return "text-red-600";
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white flex flex-col">
      <Navbar />

      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-16">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">County Health Monitor</h1>
                <p className="text-slate-500 mt-1">
                  Track county recorder site availability, response times, and coverage gaps
                </p>
              </div>
            </div>
            <Button
              onClick={runHealthCheck}
              disabled={checking}
              className="bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 font-bold gap-2 shadow-lg shadow-yellow-500/20"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {checking ? "Checking..." : "Run Health Check"}
            </Button>
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
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </motion.div>
        )}

        {/* Main content */}
        {!loading && data && (
          <div className="space-y-10">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Counties"
                value={data.totalCounties}
                icon={MapPin}
                accent="bg-blue-100 text-blue-600"
                delay={0}
              />
              <StatCard
                label="Online"
                value={data.summary.online}
                icon={CheckCircle2}
                accent="bg-green-100 text-green-600"
                delay={0.05}
              />
              <StatCard
                label="Offline"
                value={data.summary.offline}
                icon={XCircle}
                accent="bg-red-100 text-red-600"
                delay={0.1}
              />
              <StatCard
                label="States Covered"
                value={data.summary.statesWithCoverage}
                icon={Globe}
                accent="bg-yellow-100 text-yellow-600"
                delay={0.15}
              />
            </div>

            {/* Unchecked notice */}
            {data.summary.unchecked > 0 && data.healthStatuses.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-5 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-center gap-3"
              >
                <Signal className="h-5 w-5 text-yellow-600 shrink-0" />
                <p className="text-yellow-800 text-sm font-medium">
                  {data.summary.unchecked} counties have not been checked yet.
                  Run a health check to see live status.
                </p>
              </motion.div>
            )}

            {/* Coverage Gaps */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-0 shadow-lg bg-white overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                      <ShieldAlert className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-slate-900">Coverage Gaps</h2>
                      <p className="text-sm text-slate-500">
                        States sorted by expansion priority
                      </p>
                    </div>
                  </div>

                  {data.coverageGaps.length === 0 ? (
                    <div className="text-center py-12">
                      <Globe className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No coverage gap data available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="text-left py-3 px-4 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                              State
                            </th>
                            <th className="text-right py-3 px-4 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                              Total Counties
                            </th>
                            <th className="text-right py-3 px-4 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                              Covered
                            </th>
                            <th className="text-right py-3 px-4 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                              Coverage %
                            </th>
                            <th className="text-center py-3 px-4 text-xs text-slate-400 uppercase tracking-wider font-semibold">
                              Priority
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.coverageGaps.map((gap, i) => (
                            <motion.tr
                              key={gap.state}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + i * 0.02 }}
                              className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="py-3 px-4 font-bold text-slate-900">{gap.state}</td>
                              <td className="py-3 px-4 text-right text-slate-600 font-mono">
                                {gap.totalCounties}
                              </td>
                              <td className="py-3 px-4 text-right text-slate-600 font-mono">
                                {gap.coveredCounties}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        gap.coveragePercent >= 50
                                          ? "bg-green-500"
                                          : gap.coveragePercent >= 20
                                          ? "bg-yellow-500"
                                          : "bg-red-500"
                                      )}
                                      style={{ width: `${gap.coveragePercent}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-slate-700 w-10 text-right">
                                    {gap.coveragePercent}%
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <PriorityBadge priority={gap.priority} />
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Health Statuses */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-0 shadow-lg bg-white overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-bold text-lg text-slate-900">Health Status</h2>
                      <p className="text-sm text-slate-500">
                        {data.healthStatuses.length} counties checked
                      </p>
                    </div>
                  </div>

                  {data.healthStatuses.length === 0 ? (
                    <div className="text-center py-12">
                      <Server className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium mb-2">No health data yet</p>
                      <p className="text-slate-400 text-sm">
                        Click &quot;Run Health Check&quot; to ping all county recorder sites
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {data.healthStatuses.map((county, i) => (
                          <motion.div
                            key={`${county.countyName}-${county.state}`}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 + i * 0.02 }}
                            className={cn(
                              "p-4 rounded-2xl border transition-colors",
                              county.isOnline
                                ? "bg-white border-slate-100 hover:border-slate-200"
                                : "bg-red-50/50 border-red-100 hover:border-red-200"
                            )}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              {/* Left: County info */}
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                    county.isOnline
                                      ? "bg-green-100 text-green-600"
                                      : "bg-red-100 text-red-600"
                                  )}
                                >
                                  {county.isOnline ? (
                                    <CheckCircle2 className="h-5 w-5" />
                                  ) : (
                                    <XCircle className="h-5 w-5" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-900 truncate">
                                      {county.countyName}
                                    </h3>
                                    <span className="text-xs text-slate-400 font-semibold">
                                      {county.state}
                                    </span>
                                    <OnlineBadge isOnline={county.isOnline} />
                                    {county.structureChanged && (
                                      <Badge
                                        variant="outline"
                                        className="gap-1 text-xs bg-orange-50 text-orange-700 border-orange-200 font-semibold"
                                      >
                                        <AlertTriangle className="w-3 h-3" />
                                        Structure Changed
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {timeAgo(county.lastChecked)}
                                    </span>
                                    <span
                                      className={cn(
                                        "font-mono font-semibold",
                                        responseTimeColor(county.responseTimeMs)
                                      )}
                                    >
                                      {county.responseTimeMs}ms
                                    </span>
                                    {county.notes && (
                                      <span className="text-slate-400 truncate max-w-[200px]">
                                        {county.notes}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Failure count */}
                              <div className="flex items-center gap-4 shrink-0">
                                {county.failureCount > 0 && (
                                  <div className="text-center">
                                    <div className="text-lg font-bold text-red-600">
                                      {county.failureCount}
                                    </div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                                      Failures
                                    </div>
                                  </div>
                                )}
                                <a
                                  href={county.recorderUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline font-medium hidden sm:block"
                                >
                                  Visit Site
                                </a>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Empty state — no data and no error */}
        {!loading && !data && !error && (
          <div className="text-center py-24">
            <Activity className="h-16 w-16 text-slate-200 mx-auto mb-4" />
            <p className="text-xl font-semibold text-slate-400 mb-2">
              No monitoring data available
            </p>
            <p className="text-slate-400 mb-8">
              Run a health check to start monitoring county recorder sites.
            </p>
            <Button
              onClick={runHealthCheck}
              disabled={checking}
              className="bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 font-bold gap-2"
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Run Health Check
            </Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
