"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Webhook,
  Mail,
  MessageSquare,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Send,
  BellRing,
  Inbox,
  Clock,
  FileText,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";

/* ─── Types ──────────────────────────────────────────────────── */
type Channel = "webhook" | "email" | "in_app";
type EventType =
  | "job_completed"
  | "job_failed"
  | "review_requested"
  | "review_completed";

interface NotificationConfig {
  id: string;
  channel: Channel;
  event: EventType;
  destination: string;
  enabled: boolean;
  created_at: string;
}

/* ─── Constants ──────────────────────────────────────────────── */
const CHANNELS: { value: Channel; label: string; icon: React.ReactNode; color: string }[] = [
  { value: "webhook", label: "Webhook", icon: <Webhook className="h-4 w-4" />, color: "bg-purple-100 text-purple-600 border-purple-200" },
  { value: "email", label: "Email", icon: <Mail className="h-4 w-4" />, color: "bg-blue-100 text-blue-600 border-blue-200" },
  { value: "in_app", label: "In-App", icon: <MessageSquare className="h-4 w-4" />, color: "bg-slate-100 text-slate-600 border-slate-200" },
];

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "job_completed", label: "Job Completed" },
  { value: "job_failed", label: "Job Failed" },
  { value: "review_requested", label: "Review Requested" },
  { value: "review_completed", label: "Review Completed" },
];

const CHANNEL_BADGE_STYLES: Record<Channel, string> = {
  webhook: "bg-purple-50 text-purple-700 border-purple-200",
  email: "bg-blue-50 text-blue-700 border-blue-200",
  in_app: "bg-slate-50 text-slate-700 border-slate-200",
};

const CHANNEL_ICONS: Record<Channel, React.ReactNode> = {
  webhook: <Webhook className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  in_app: <MessageSquare className="h-3 w-3" />,
};

/* ─── Channel badge ──────────────────────────────────────────── */
function ChannelBadge({ channel }: { channel: Channel }) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 text-xs font-semibold", CHANNEL_BADGE_STYLES[channel])}
    >
      {CHANNEL_ICONS[channel]}
      {channel === "in_app" ? "In-App" : channel.charAt(0).toUpperCase() + channel.slice(1)}
    </Badge>
  );
}

/* ─── Event label helper ─────────────────────────────────────── */
function eventLabel(event: EventType): string {
  return EVENT_TYPES.find((e) => e.value === event)?.label ?? event;
}

/* ═══════════════════════════════════════════════════════════════
 * Main Notifications Page
 * ═══════════════════════════════════════════════════════════════ */
export default function NotificationsPage() {
  /* ── State: subscriptions list ─────────────────────────────── */
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── State: inbox ──────────────────────────────────────────── */
  const [inbox, setInbox] = useState<Array<{ id: number; event: string; payload: any; status: string; created_at: string }>>([]);
  const [inboxLoading, setInboxLoading] = useState(true);

  /* ── State: add form ───────────────────────────────────────── */
  const [channel, setChannel] = useState<Channel>("webhook");
  const [event, setEvent] = useState<EventType>("job_completed");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  /* ── Fetch configs ─────────────────────────────────────────── */
  const fetchConfigs = async () => {
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (json.success) {
        setConfigs(json.data);
      } else {
        setError(json.error || "Failed to load notifications");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  /* ── Fetch inbox ───────────────────────────────────────────── */
  const fetchInbox = async () => {
    try {
      const res = await fetch("/api/notifications?inbox=true&limit=20");
      const json = await res.json();
      if (json.success) {
        setInbox(json.data);
      }
    } catch {
      // Silent fail for inbox
    }
  };

  useEffect(() => {
    Promise.all([fetchConfigs(), fetchInbox()]).finally(() => {
      setLoading(false);
      setInboxLoading(false);
    });
  }, []);

  /* ── Submit new config ─────────────────────────────────────── */
  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(false);

    if (channel === "webhook" && !webhookUrl.trim()) {
      setSubmitError("Webhook URL is required");
      return;
    }
    if (channel === "email" && !email.trim()) {
      setSubmitError("Email address is required");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = { channel, event };
      if (channel === "webhook") body.webhookUrl = webhookUrl.trim();
      if (channel === "email") body.email = email.trim();

      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.error || "Failed to create notification");

      setSubmitSuccess(true);
      setWebhookUrl("");
      setEmail("");
      await fetchConfigs();

      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (e: any) {
      setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Delete config ─────────────────────────────────────────── */
  const deleteConfig = async (id: string) => {
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      setConfigs((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silent fail — will refresh on next load
    }
  };

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fefce8] to-white flex flex-col">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 py-16 flex-1 w-full">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-yellow-100 flex items-center justify-center text-yellow-600">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Notifications</h1>
              <p className="text-slate-500 mt-1">
                In-app notifications are enabled by default. Add webhooks or email alerts for additional channels.
              </p>
            </div>
          </div>
        </div>

        {/* ── Section 0: Recent Notifications (Inbox) ──────────── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <Inbox className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-bold text-slate-900">Recent Notifications</h2>
            {inbox.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                {inbox.length}
              </Badge>
            )}
          </div>

          {inboxLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
            </div>
          )}

          {!inboxLoading && inbox.length === 0 && (
            <Card className="border-0 shadow-md bg-white">
              <CardContent className="py-8">
                <div className="text-center">
                  <Inbox className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-400 mb-1">No notifications yet</p>
                  <p className="text-xs text-slate-400">
                    Notifications are enabled by default. You&apos;ll see updates here when searches complete, fail, or need review.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {!inboxLoading && inbox.length > 0 && (
            <div className="space-y-2">
              {inbox.map((notif) => {
                const eventIcons: Record<string, React.ReactNode> = {
                  job_completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
                  job_failed: <XCircle className="h-4 w-4 text-red-500" />,
                  review_requested: <FileText className="h-4 w-4 text-blue-500" />,
                  review_completed: <CheckCircle2 className="h-4 w-4 text-purple-500" />,
                };
                const eventColors: Record<string, string> = {
                  job_completed: "border-l-green-400",
                  job_failed: "border-l-red-400",
                  review_requested: "border-l-blue-400",
                  review_completed: "border-l-purple-400",
                };
                return (
                  <Card key={notif.id} className={cn("border-0 shadow-sm bg-white overflow-hidden border-l-4", eventColors[notif.event] || "border-l-slate-300")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {eventIcons[notif.event] || <Bell className="h-4 w-4 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{notif.payload?.title || eventLabel(notif.event as EventType)}</p>
                          {notif.payload?.message && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.payload.message}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
                          <Clock className="h-3 w-3" />
                          {new Date(notif.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 1: Active Subscriptions ──────────────────── */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <BellRing className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-bold text-slate-900">Active Subscriptions</h2>
            {!loading && configs.length > 0 && (
              <Badge variant="outline" className="ml-2 bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">
                {configs.length}
              </Badge>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-5 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3 mb-6">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && configs.length === 0 && (
            <Card className="border-0 shadow-md bg-white">
              <CardContent className="py-12">
                <div className="text-center">
                  <Bell className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-slate-400 mb-1">
                    No active subscriptions
                  </p>
                  <p className="text-sm text-slate-400">
                    Add a notification below to start receiving alerts
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subscriptions list */}
          {!loading && !error && configs.length > 0 && (
            <div className="space-y-3">
              <AnimatePresence>
                {configs.map((config, i) => (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-white overflow-hidden">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div
                              className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                config.channel === "webhook"
                                  ? "bg-purple-100 text-purple-600"
                                  : config.channel === "email"
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-slate-100 text-slate-600"
                              )}
                            >
                              {CHANNEL_ICONS[config.channel]}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm">
                                  {eventLabel(config.event)}
                                </span>
                                <ChannelBadge channel={config.channel} />
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs gap-1",
                                    config.enabled
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-slate-50 text-slate-400 border-slate-200"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "w-1.5 h-1.5 rounded-full",
                                      config.enabled ? "bg-green-500" : "bg-slate-300"
                                    )}
                                  />
                                  {config.enabled ? "Active" : "Paused"}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-400 mt-1 truncate font-mono">
                                {config.destination}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-slate-400 hidden sm:block">
                              {new Date(config.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteConfig(config.id)}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 h-8 w-8 p-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Section 2: Add Notification ──────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Plus className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-bold text-slate-900">Add Notification</h2>
          </div>

          <Card className="border-0 shadow-lg bg-white overflow-hidden">
            <CardContent className="p-6 space-y-6">
              {/* Channel selector */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-3 block">
                  Channel
                </label>
                <div className="flex gap-2">
                  {CHANNELS.map((ch) => (
                    <button
                      key={ch.value}
                      onClick={() => setChannel(ch.value)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                        channel === ch.value
                          ? cn(ch.color, "ring-2 ring-offset-1",
                              ch.value === "webhook" ? "ring-purple-300" :
                              ch.value === "email" ? "ring-blue-300" : "ring-slate-300"
                            )
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      {ch.icon}
                      {ch.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Event selector */}
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-3 block">
                  Event
                </label>
                <Select value={event} onValueChange={(v) => setEvent(v as EventType)}>
                  <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white text-slate-900 text-sm font-medium">
                    <SelectValue placeholder="Select event type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((evt) => (
                      <SelectItem key={evt.value} value={evt.value}>
                        {evt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional destination field */}
              {channel === "webhook" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="text-sm font-semibold text-slate-700 mb-3 block">
                    Webhook URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/webhook"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </motion.div>
              )}

              {channel === "email" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="text-sm font-semibold text-slate-700 mb-3 block">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="alerts@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                  />
                </motion.div>
              )}

              {channel === "in_app" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-500 flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 shrink-0 text-slate-400" />
                    In-app notifications will appear in your dashboard. No additional configuration needed.
                  </div>
                </motion.div>
              )}

              {/* Submit error */}
              {submitError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 flex items-center gap-3 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Submit success */}
              <AnimatePresence>
                {submitSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 flex items-center gap-3 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="font-medium">Notification subscription created successfully</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-12 bg-[#fbbf24] hover:bg-[#f59e0b] text-slate-900 font-bold text-base rounded-xl shadow-lg shadow-yellow-500/20 gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
                {submitting ? "Creating..." : "Create Subscription"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Stats footer */}
        {!loading && configs.length > 0 && (
          <div className="mt-8 text-center text-slate-400 text-sm">
            {configs.filter((c) => c.enabled).length} active subscription
            {configs.filter((c) => c.enabled).length !== 1 ? "s" : ""} across{" "}
            {new Set(configs.map((c) => c.channel)).size} channel
            {new Set(configs.map((c) => c.channel)).size !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
