import Link from "next/link";
import { Building2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 py-12 mt-auto">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-yellow-500 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold text-lg">Title AI</span>
            </div>
            <p className="text-sm leading-relaxed">
              AI-powered title search and risk assessment. ALTA-compliant reports
              with source provenance and human-in-the-loop review.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">Product</h4>
            <div className="space-y-2 text-sm">
              <Link href="/titleai" className="block hover:text-white transition-colors">Instant Search</Link>
              <Link href="/titleai/chat" className="block hover:text-white transition-colors">AI Chat</Link>
              <Link href="/jobs" className="block hover:text-white transition-colors">Durable Jobs</Link>
              <Link href="/searches" className="block hover:text-white transition-colors">Search History</Link>
            </div>
          </div>

          {/* Enterprise */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">Enterprise</h4>
            <div className="space-y-2 text-sm">
              <Link href="/reviews" className="block hover:text-white transition-colors">Review Workflow</Link>
              <Link href="/monitoring" className="block hover:text-white transition-colors">County Monitoring</Link>
              <Link href="/notifications" className="block hover:text-white transition-colors">Notifications</Link>
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">Powered By</h4>
            <div className="space-y-2 text-sm">
              <span className="block">Amazon Nova Act</span>
              <span className="block">Amazon Nova Pro</span>
              <span className="block">AWS Bedrock</span>
              <span className="block">Inngest Durable Execution</span>
              <span className="block">Turso (libSQL)</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500">
            &copy; 2026 Title AI Nova. Built for Amazon Nova AI Hackathon. Not legal advice.
          </p>
          <p className="text-xs text-slate-600">
            AI-generated reports require review by a licensed title examiner before reliance.
          </p>
        </div>
      </div>
    </footer>
  );
}
