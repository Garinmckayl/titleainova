"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Building2, Menu, X, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/titleai", label: "Search" },
  { href: "/titleai/chat", label: "Chat" },
  { href: "/jobs", label: "Jobs" },
  { href: "/searches", label: "History" },
  { href: "/reviews", label: "Reviews" },
  { href: "/monitoring", label: "Monitoring" },
];

/* ── Clerk components loaded client-side only ────────────────── */

const ClerkDesktopUser = dynamic(
  () => import("./navbar-clerk").then((m) => m.ClerkDesktopUser),
  { ssr: false }
);

const ClerkMobileUser = dynamic(
  () => import("./navbar-clerk").then((m) => m.ClerkMobileUser),
  { ssr: false }
);

const ClerkMobileSignIn = dynamic(
  () => import("./navbar-clerk").then((m) => m.ClerkMobileSignIn),
  { ssr: false }
);

/* ── Main Navbar ─────────────────────────────────────────────── */

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count
  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true');
      const json = await res.json();
      if (json.success) {
        setUnreadCount(json.count || 0);
      }
    } catch {
      // Silently fail - non-critical
    }
  }, []);

  useEffect(() => {
    fetchUnread();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  return (
    <nav className="sticky top-0 z-50 bg-[#fefce8]/80 backdrop-blur-md border-b border-yellow-200/50">
      <div className="container mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="Title AI" className="h-8 w-auto" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "font-medium text-sm",
                    isActive
                      ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </div>

        {/* Right side: alerts + profile */}
        <div className="hidden md:flex items-center gap-2">
          <Link href="/notifications">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "text-sm gap-1.5 relative",
                pathname === "/notifications"
                  ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Bell className="w-4 h-4" />
              <span className="hidden lg:inline">Alerts</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <ClerkDesktopUser />
        </div>

        {/* Mobile: profile + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <Link href="/notifications" className="relative p-2">
            <Bell className="w-5 h-5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <ClerkMobileUser />
          <button
            className="p-2 rounded-lg hover:bg-yellow-100 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-yellow-200/50 bg-[#fefce8]/95 backdrop-blur-md px-4 py-3 space-y-1">
          {[...NAV_LINKS, { href: "/notifications", label: "Alerts" }].map((link) => {
            const isActive = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                <div
                  className={cn(
                    "block px-4 py-3 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-yellow-100 text-yellow-800"
                      : "text-slate-600 hover:bg-yellow-50 hover:text-slate-900"
                  )}
                >
                  {link.label}
                  {link.href === "/notifications" && unreadCount > 0 && (
                    <span className="ml-2 inline-flex min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
          <ClerkMobileSignIn />
        </div>
      )}
    </nav>
  );
}
