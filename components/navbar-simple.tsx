import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-[#fefce8]/80 backdrop-blur-md border-b border-yellow-200/50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center shadow-sm">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-900">Title AI</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/titleai">
            <Button variant="ghost" size="sm">Search</Button>
          </Link>
          <Link href="/titleai/chat">
            <Button variant="ghost" size="sm">Chat</Button>
          </Link>
          <Link href="/jobs">
            <Button variant="ghost" size="sm">Jobs</Button>
          </Link>
          <Link href="/searches">
            <Button variant="ghost" size="sm">History</Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
