"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Building2, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/titleai", label: "Search" },
  { href: "/titleai/chat", label: "Chat" },
  { href: "/jobs", label: "Jobs" },
  { href: "/searches", label: "History" },
  { href: "/reviews", label: "Reviews" },
  { href: "/monitoring", label: "Monitoring" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#fefce8]/80 backdrop-blur-md border-b border-yellow-200/50">
      <div className="container mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Title AI</span>
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
          <div className="w-px h-6 bg-slate-200 mx-2" />
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="text-slate-500 text-sm">
              Alerts
            </Button>
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-yellow-100 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-yellow-200/50 bg-[#fefce8]/95 backdrop-blur-md px-6 py-4 space-y-1">
          {[...NAV_LINKS, { href: "/notifications", label: "Alerts" }].map((link) => {
            const isActive = pathname === link.href;
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
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
