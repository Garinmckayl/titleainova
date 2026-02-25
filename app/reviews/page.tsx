"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardCheck,
  Building2,
  MapPin,
  Clock,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  X,
  MessageSquare,
  Send,
  ThumbsUp,
  ThumbsDown,
  Flag,
  StickyNote,
  User,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";

/* ─── Types ──────────────────────────────────────────────────── */

type ReviewStatus =
  | "pending_review"
  | "in_review"
  | "approved"
  | "rejected"
  | "revision_requested";

type CommentSection =
  | "chain_of_title"
  | "liens"
  | "exceptions"
  | "summary"
  | "general";

type CommentAction = "approve" | "reject" | "flag" | "note";

interface ReviewComment {
  id: string;
  reviewerId: string;
  reviewerName: string;
  section: string;
  itemIndex?: number;
  comment: string;
  action: CommentAction;
  createdAt: string;
}

interface ReviewRecord {
  searchId: number;
  status: ReviewStatus;
  assignedTo?: string;
  assignedAt?: string;
  comments: ReviewComment[];
  finalDecision?: "approved" | "rejected";
  finalDecisionBy?: string;
  finalDecisionAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface SearchRow {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  review_status: ReviewStatus;
  created_at: string;
  report: {
    summary?: string;
    exceptions?: Array<{
      type: string;
      description: string;
      explanation?: string;
    }>;
    liens?: Array<{
      type: string;
      amount: string;
      status: string;
      claimant?: string;
      dateRecorded?: string;
      priority?: string;
    }>;
    ownershipChain?: Array<{
      grantor: string;
      grantee: string;
      date: string;
      documentType?: string;
      documentNumber?: string;
    }>;
  };
}

/* ─── Status badge ───────────────────────────────────────────── */

const STATUS_CONFIG: Record<
  ReviewStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending_review: {
    label: "Pending",
    className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    icon: <Clock className="w-3 h-3" />,
  },
  in_review: {
    label: "In Review",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <ClipboardCheck className="w-3 h-3" />,
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  revision_requested: {
    label: "Revision",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <Flag className="w-3 h-3" />,
  },
};

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending_review;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 text-xs font-semibold", cfg.className)}
    >
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

/* ─── Comment action badge ───────────────────────────────────── */

const ACTION_CONFIG: Record<
  CommentAction,
  { label: string; className: string; icon: React.ReactNode }
> = {
  approve: {
    label: "Approve",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: <ThumbsUp className="w-3 h-3" />,
  },
  reject: {
    label: "Reject",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: <ThumbsDown className="w-3 h-3" />,
  },
  flag: {
    label: "Flag",
    className: "bg-orange-50 text-orange-700 border-orange-200",
    icon: <Flag className="w-3 h-3" />,
  },
  note: {
    label: "Note",
    className: "bg-slate-50 text-slate-600 border-slate-200",
    icon: <StickyNote className="w-3 h-3" />,
  },
};

/* ─── Section label helper ───────────────────────────────────── */

const SECTION_LABELS: Record<CommentSection, string> = {
  chain_of_title: "Chain of Title",
  liens: "Liens & Encumbrances",
  exceptions: "Title Exceptions",
  summary: "Executive Summary",
  general: "General",
};

/* ─── Review Detail Panel ────────────────────────────────────── */

function ReviewDetail({
  review,
  search,
  onClose,
  onUpdate,
}: {
  review: ReviewRecord;
  search: SearchRow;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [commentText, setCommentText] = useState("");
  const [commentSection, setCommentSection] =
    useState<CommentSection>("general");
  const [commentAction, setCommentAction] = useState<CommentAction>("note");
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState<
    "approved" | "rejected" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [showReportSections, setShowReportSections] = useState({
    summary: true,
    chain: false,
    liens: false,
    exceptions: false,
  });

  const isFinalized =
    review.status === "approved" || review.status === "rejected";

  const submitComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "comment",
          searchId: review.searchId,
          section: commentSection,
          comment: commentText.trim(),
          commentAction,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit comment");
      setCommentText("");
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const submitDecision = async (decision: "approved" | "rejected") => {
    setFinalizing(decision);
    setError(null);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "finalize",
          searchId: review.searchId,
          decision,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to finalize review");
      onUpdate();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFinalizing(null);
    }
  };

  const report = search.report;
  const chainLength = report?.ownershipChain?.length ?? 0;
  const lienCount = report?.liens?.length ?? 0;
  const exceptionCount = report?.exceptions?.length ?? 0;

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
            <h2 className="text-xl font-bold text-slate-900">
              {search.address}
            </h2>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <ReviewStatusBadge status={review.status} />
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {search.county}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Search #{search.id}
              </span>
            </div>
          </div>
        </div>
        <Button
          onClick={onClose}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <X className="h-3.5 w-3.5" /> Back
        </Button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
          <div className="text-2xl font-bold text-slate-900">{chainLength}</div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Deeds
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
          <div
            className={cn(
              "text-2xl font-bold",
              lienCount > 0 ? "text-red-600" : "text-green-600"
            )}
          >
            {lienCount}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Liens
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
          <div
            className={cn(
              "text-2xl font-bold",
              exceptionCount > 0 ? "text-orange-600" : "text-green-600"
            )}
          >
            {exceptionCount}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Exceptions
          </div>
        </div>
        <div className="p-4 bg-white rounded-xl border border-slate-100 text-center shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {review.comments.length}
          </div>
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            Comments
          </div>
        </div>
      </div>

      {/* ── Report Sections ────────────────────────────────────── */}

      {/* Summary */}
      {report?.summary && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() =>
                setShowReportSections((s) => ({ ...s, summary: !s.summary }))
              }
            >
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 flex-1">
                Executive Summary
              </h3>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-slate-400 transition-transform",
                  showReportSections.summary && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence>
              {showReportSections.summary && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="text-slate-600 leading-relaxed text-sm prose prose-sm max-w-none mt-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {report.summary}
                    </ReactMarkdown>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Chain of Title */}
      {chainLength > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() =>
                setShowReportSections((s) => ({ ...s, chain: !s.chain }))
              }
            >
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 flex-1">
                Chain of Title ({chainLength} records)
              </h3>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-slate-400 transition-transform",
                  showReportSections.chain && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence>
              {showReportSections.chain && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="relative pl-4 space-y-4 mt-6">
                    <div className="absolute top-2 left-[19px] bottom-2 w-0.5 bg-slate-100" />
                    {report.ownershipChain!.map((node, i) => (
                      <div key={i} className="relative flex gap-4">
                        <div className="absolute -left-1 w-2.5 h-2.5 rounded-full bg-white border-[3px] border-slate-300 mt-1.5 z-10" />
                        <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <Badge
                              variant="outline"
                              className="bg-white text-xs font-mono"
                            >
                              {node.date}
                            </Badge>
                            {node.documentType && (
                              <span className="text-xs font-bold text-slate-400 uppercase">
                                {node.documentType}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-xs text-slate-400 font-medium uppercase">
                                Grantor
                              </span>
                              <p className="font-semibold text-slate-900 text-sm">
                                {node.grantor}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs text-slate-400 font-medium uppercase">
                                Grantee
                              </span>
                              <p className="font-semibold text-slate-900 text-sm">
                                {node.grantee}
                              </p>
                            </div>
                          </div>
                          {node.documentNumber && (
                            <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                              Doc #:{" "}
                              <span className="font-mono text-slate-700">
                                {node.documentNumber}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Liens */}
      {lienCount > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() =>
                setShowReportSections((s) => ({ ...s, liens: !s.liens }))
              }
            >
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 flex-1">
                Liens & Encumbrances ({lienCount})
              </h3>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-slate-400 transition-transform",
                  showReportSections.liens && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence>
              {showReportSections.liens && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 mt-4">
                    {report.liens!.map((lien, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-sm"
                      >
                        <div>
                          <p className="font-bold text-slate-900">
                            {lien.claimant || lien.type}
                          </p>
                          <p className="text-sm text-slate-500">
                            {lien.type} - {lien.status}
                            {lien.dateRecorded && ` - ${lien.dateRecorded}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-900">
                            {lien.amount || "N/A"}
                          </p>
                          {lien.priority === "High" && (
                            <Badge className="bg-red-500 text-white border-0 mt-1 text-xs">
                              High
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* Exceptions */}
      {exceptionCount > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <button
              className="flex items-center gap-3 w-full text-left"
              onClick={() =>
                setShowReportSections((s) => ({
                  ...s,
                  exceptions: !s.exceptions,
                }))
              }
            >
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 flex-1">
                Title Exceptions ({exceptionCount})
              </h3>
              <ChevronDown
                className={cn(
                  "h-5 w-5 text-slate-400 transition-transform",
                  showReportSections.exceptions && "rotate-180"
                )}
              />
            </button>
            <AnimatePresence>
              {showReportSections.exceptions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 mt-4">
                    {report.exceptions!.map((ex, i) => (
                      <div
                        key={i}
                        className="p-4 bg-orange-50 border border-orange-100 rounded-xl"
                      >
                        <span className="font-bold text-orange-800 text-sm">
                          {ex.type}
                        </span>
                        <p className="text-sm text-orange-900 mt-1">
                          {ex.description}
                        </p>
                        {ex.explanation && (
                          <p className="text-xs text-orange-700 mt-1">
                            {ex.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      )}

      {/* ── Comment Form ───────────────────────────────────────── */}
      {!isFinalized && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">
                Add Review Comment
              </h3>
            </div>

            {/* Section selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Report Section
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  Object.entries(SECTION_LABELS) as [CommentSection, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCommentSection(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                      commentSection === key
                        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                Comment Type
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  Object.entries(ACTION_CONFIG) as [
                    CommentAction,
                    (typeof ACTION_CONFIG)[CommentAction],
                  ][]
                ).map(([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => setCommentAction(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border flex items-center gap-1.5",
                      commentAction === key
                        ? cfg.className
                        : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Comment textarea */}
            <Textarea
              placeholder="Enter your review comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="mb-4 min-h-24 bg-slate-50 border-slate-200 focus:border-yellow-400 rounded-xl"
            />

            <Button
              onClick={submitComment}
              disabled={!commentText.trim() || submitting}
              className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold gap-2 rounded-xl"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Comment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Review Comments Timeline ───────────────────────────── */}
      {review.comments.length > 0 && (
        <Card className="border-0 shadow-lg bg-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                <MessageSquare className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">
                Review Comments ({review.comments.length})
              </h3>
            </div>

            <div className="relative pl-4 space-y-4">
              <div className="absolute top-2 left-[7px] bottom-2 w-0.5 bg-slate-100" />
              {review.comments.map((comment) => {
                const actionCfg =
                  ACTION_CONFIG[comment.action as CommentAction] ??
                  ACTION_CONFIG.note;
                return (
                  <div key={comment.id} className="relative flex gap-4">
                    <div className="absolute -left-[1px] w-2.5 h-2.5 rounded-full bg-white border-[3px] border-yellow-400 mt-2 z-10" />
                    <div className="flex-1 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                          <span className="text-sm font-semibold text-slate-700">
                            {comment.reviewerName}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] gap-1",
                              actionCfg.className
                            )}
                          >
                            {actionCfg.icon}
                            {actionCfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-white"
                          >
                            {SECTION_LABELS[
                              comment.section as CommentSection
                            ] ?? comment.section}
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            {new Date(comment.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {comment.comment}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Final Decision ─────────────────────────────────────── */}
      {isFinalized && (
        <Card
          className={cn(
            "border-0 shadow-lg overflow-hidden",
            review.status === "approved"
              ? "bg-green-50 ring-1 ring-green-200"
              : "bg-red-50 ring-1 ring-red-200"
          )}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              {review.status === "approved" ? (
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <h3
                  className={cn(
                    "text-lg font-bold",
                    review.status === "approved"
                      ? "text-green-800"
                      : "text-red-800"
                  )}
                >
                  Report{" "}
                  {review.status === "approved" ? "Approved" : "Rejected"}
                </h3>
                <p
                  className={cn(
                    "text-sm",
                    review.status === "approved"
                      ? "text-green-600"
                      : "text-red-600"
                  )}
                >
                  By {review.finalDecisionBy ?? "reviewer"} on{" "}
                  {review.finalDecisionAt
                    ? new Date(review.finalDecisionAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : "N/A"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Approve / Reject Buttons ───────────────────────────── */}
      {!isFinalized && (
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => submitDecision("approved")}
            disabled={!!finalizing}
            className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold gap-2 rounded-xl h-12 shadow-lg shadow-green-600/20"
          >
            {finalizing === "approved" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5" />
            )}
            Approve Report
          </Button>
          <Button
            onClick={() => submitDecision("rejected")}
            disabled={!!finalizing}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold gap-2 rounded-xl h-12 shadow-lg shadow-red-600/20"
          >
            {finalizing === "rejected" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
            Reject Report
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
 * Main Reviews Page
 * ═══════════════════════════════════════════════════════════════ */

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [searches, setSearches] = useState<Map<number, SearchRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">(
    "pending"
  );
  const [selectedReview, setSelectedReview] = useState<ReviewRecord | null>(
    null
  );
  const [selectedSearch, setSelectedSearch] = useState<SearchRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ── Fetch reviews ─────────────────────────────────────────── */
  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews?pending=true");
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to load");
      const data: ReviewRecord[] = json.data;
      setReviews(data);

      // Fetch search data for each review
      const searchMap = new Map<number, SearchRow>();
      await Promise.all(
        data.map(async (rev) => {
          try {
            const sRes = await fetch(`/api/searches?id=${rev.searchId}`);
            const sJson = await sRes.json();
            if (sJson.success) {
              searchMap.set(rev.searchId, sJson.data);
            }
          } catch {
            // Skip individual fetch errors
          }
        })
      );
      setSearches(searchMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  /* ── Open detail view ──────────────────────────────────────── */
  const openDetail = async (review: ReviewRecord) => {
    setDetailLoading(true);
    setError(null);

    try {
      // Fetch the latest review and search data
      const [revRes, searchRes] = await Promise.all([
        fetch(`/api/reviews?searchId=${review.searchId}`),
        fetch(`/api/searches?id=${review.searchId}`),
      ]);
      const revJson = await revRes.json();
      const searchJson = await searchRes.json();

      if (!revJson.success) throw new Error(revJson.error || "Review not found");
      if (!searchJson.success)
        throw new Error(searchJson.error || "Search not found");

      setSelectedReview(revJson.data);
      setSelectedSearch(searchJson.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── Refresh detail after action ───────────────────────────── */
  const refreshDetail = async () => {
    if (!selectedReview) return;
    try {
      const res = await fetch(
        `/api/reviews?searchId=${selectedReview.searchId}`
      );
      const json = await res.json();
      if (json.success) {
        setSelectedReview(json.data);
        // Also refresh the list
        fetchReviews();
      }
    } catch {
      // Silently fail
    }
  };

  /* ── Filter reviews by tab ─────────────────────────────────── */
  const pendingReviews = reviews.filter(
    (r) => r.status === "pending_review" || r.status === "in_review"
  );
  const completedReviews = reviews.filter(
    (r) => r.status === "approved" || r.status === "rejected"
  );
  const displayedReviews =
    activeTab === "pending" ? pendingReviews : completedReviews;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white flex flex-col">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-16 flex-1 w-full">
        {/* Page Header */}
        <div className="mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600">
              <ClipboardCheck className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Report Reviews
              </h1>
              <p className="text-slate-500 mt-1">
                Human-in-the-loop review workflow for AI-generated title search
                reports
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {!selectedReview && (
          <div className="flex items-center gap-1 mb-8 bg-slate-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab("pending")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
                activeTab === "pending"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Pending Reviews
              {pendingReviews.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold">
                  {pendingReviews.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("completed")}
              className={cn(
                "px-5 py-2.5 rounded-lg text-sm font-semibold transition-all",
                activeTab === "completed"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              Completed
              {completedReviews.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                  {completedReviews.length}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && !selectedReview && (
          <div className="mb-6 p-5 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Detail loading overlay */}
        {detailLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          </div>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {selectedReview && selectedSearch && !detailLoading ? (
            <ReviewDetail
              key={selectedReview.searchId}
              review={selectedReview}
              search={selectedSearch}
              onClose={() => {
                setSelectedReview(null);
                setSelectedSearch(null);
                fetchReviews();
              }}
              onUpdate={refreshDetail}
            />
          ) : !detailLoading ? (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Loading */}
              {loading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
                </div>
              )}

              {/* Empty state */}
              {!loading && displayedReviews.length === 0 && (
                <div className="text-center py-24">
                  <ClipboardCheck className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-xl font-semibold text-slate-400 mb-2">
                    {activeTab === "pending"
                      ? "No pending reviews"
                      : "No completed reviews"}
                  </p>
                  <p className="text-slate-400">
                    {activeTab === "pending"
                      ? "All reports have been reviewed. New reviews will appear here when title searches complete."
                      : "Completed reviews will appear here after you approve or reject a report."}
                  </p>
                </div>
              )}

              {/* Review cards list */}
              {!loading && displayedReviews.length > 0 && (
                <div className="space-y-4">
                  {displayedReviews.map((review, i) => {
                    const search = searches.get(review.searchId);
                    const chainLength =
                      search?.report?.ownershipChain?.length ?? 0;
                    const lienCount = search?.report?.liens?.length ?? 0;
                    const exceptionCount =
                      search?.report?.exceptions?.length ?? 0;

                    return (
                      <motion.div
                        key={review.searchId}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <Card className="border-0 shadow-md shadow-slate-200/50 hover:shadow-lg hover:shadow-slate-200/70 transition-all bg-white overflow-hidden group cursor-pointer">
                          {/* Status strip */}
                          <div
                            className={cn(
                              "h-1",
                              review.status === "approved"
                                ? "bg-green-400"
                                : review.status === "rejected"
                                  ? "bg-red-400"
                                  : review.status === "in_review"
                                    ? "bg-blue-400"
                                    : "bg-yellow-400"
                            )}
                          />
                          <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-4 flex-1 min-w-0">
                                <div className="w-11 h-11 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                                  <Building2 className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-slate-900 text-lg truncate">
                                      {search?.address ?? `Search #${review.searchId}`}
                                    </h3>
                                    <ReviewStatusBadge
                                      status={review.status}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 text-slate-500 text-sm mt-1 flex-wrap">
                                    {search?.county && (
                                      <>
                                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                                        <span>{search.county}</span>
                                        <span className="text-slate-300">
                                          -
                                        </span>
                                      </>
                                    )}
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    <span>
                                      {new Date(
                                        review.createdAt
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    {review.assignedTo && (
                                      <>
                                        <span className="text-slate-300">
                                          -
                                        </span>
                                        <User className="h-3.5 w-3.5 shrink-0" />
                                        <span className="text-slate-500">
                                          {review.assignedTo}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                  {review.comments.length > 0 && (
                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                      <MessageSquare className="h-3 w-3" />
                                      {review.comments.length} comment
                                      {review.comments.length !== 1 ? "s" : ""}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-6 shrink-0">
                                {search && (
                                  <div className="flex gap-4 text-center">
                                    <div>
                                      <div className="text-lg font-bold text-slate-900">
                                        {chainLength}
                                      </div>
                                      <div className="text-xs text-slate-400 uppercase tracking-wide">
                                        Deeds
                                      </div>
                                    </div>
                                    <div>
                                      <div
                                        className={cn(
                                          "text-lg font-bold",
                                          lienCount > 0
                                            ? "text-red-600"
                                            : "text-green-600"
                                        )}
                                      >
                                        {lienCount}
                                      </div>
                                      <div className="text-xs text-slate-400 uppercase tracking-wide">
                                        Liens
                                      </div>
                                    </div>
                                    <div>
                                      <div
                                        className={cn(
                                          "text-lg font-bold",
                                          exceptionCount > 0
                                            ? "text-orange-600"
                                            : "text-green-600"
                                        )}
                                      >
                                        {exceptionCount}
                                      </div>
                                      <div className="text-xs text-slate-400 uppercase tracking-wide">
                                        Exc.
                                      </div>
                                    </div>
                                  </div>
                                )}

                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetail(review);
                                  }}
                                  size="sm"
                                  className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold gap-1.5 rounded-xl shadow-sm"
                                >
                                  <ClipboardCheck className="h-4 w-4" />
                                  Review
                                </Button>

                                <ArrowRight
                                  className="h-5 w-5 text-slate-300 group-hover:text-yellow-500 group-hover:translate-x-1 transition-all cursor-pointer"
                                  onClick={() => openDetail(review)}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Stats footer */}
        {!loading && !selectedReview && reviews.length > 0 && (
          <div className="mt-8 text-center text-slate-400 text-sm">
            {pendingReviews.length} pending review
            {pendingReviews.length !== 1 ? "s" : ""} -{" "}
            {completedReviews.length} completed - Powered by{" "}
            <span className="text-slate-600 font-semibold">
              Human-in-the-Loop
            </span>
            {" + "}
            <span className="text-slate-600 font-semibold">AI</span>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
