import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, ShieldCheck, AlertTriangle, Building2, Zap, Bot, ArrowRight, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fefce8]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-[#fefce8]/80 backdrop-blur-md border-b border-yellow-200/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900">Title AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/titleai">
              <Button variant="ghost" className="font-medium text-slate-700 hover:text-slate-900">
                Search
              </Button>
            </Link>
            <Link href="/titleai/chat">
              <Button variant="ghost" className="font-medium text-slate-700 hover:text-slate-900">
                Chat
              </Button>
            </Link>
            <Link href="/titleai">
              <Button className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold shadow-md shadow-yellow-500/25 rounded-xl">
                Try Free
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-full text-yellow-800 text-sm font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
            </span>
            Powered by Amazon Nova Act + Nova Pro
          </div>

          <h1 className="text-6xl md:text-8xl font-bold text-slate-900 leading-[1.05] tracking-tight mb-6">
            Title reports
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">
              in seconds.
            </span>
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Replace weeks of manual courthouse searches with AI-powered title intelligence.
            Ownership chains, lien detection, and risk assessment — all automated.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/titleai">
              <Button
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold text-lg h-14 px-8 rounded-xl shadow-xl shadow-yellow-500/30"
              >
                <Search className="w-5 h-5 mr-2" />
                Run Title Search
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/titleai/chat">
              <Button
                size="lg"
                variant="outline"
                className="font-bold text-lg h-14 px-8 rounded-xl border-2 border-slate-300 text-slate-700 hover:border-yellow-400 hover:text-slate-900"
              >
                Chat with Title AI
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-900">30s</div>
              <div className="text-sm text-slate-500 mt-1">vs. 2–4 week manual search</div>
            </div>
            <div className="text-center border-x border-yellow-200">
              <div className="text-4xl font-bold text-slate-900">$99</div>
              <div className="text-sm text-slate-500 mt-1">vs. $800+ traditional title</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-900">5</div>
              <div className="text-sm text-slate-500 mt-1">AI agents working in parallel</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mb-4">How It Works</Badge>
            <h2 className="text-4xl font-bold text-slate-900">5 AI agents. 30 seconds. Complete title intelligence.</h2>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {[
              { icon: Search, label: "Property Lookup", desc: "Identify county & recorder office", color: "bg-blue-50 text-blue-600" },
              { icon: Bot, label: "Nova Act Browser", desc: "Automates county recorder search", color: "bg-purple-50 text-purple-600" },
              { icon: FileText, label: "Chain of Title", desc: "Full ownership history analysis", color: "bg-yellow-50 text-yellow-600" },
              { icon: AlertTriangle, label: "Lien Scan", desc: "Tax, HOA & mortgage liens", color: "bg-orange-50 text-orange-600" },
              { icon: ShieldCheck, label: "Risk Report", desc: "PDF commitment generated", color: "bg-green-50 text-green-600" },
            ].map((step, i) => (
              <div key={i} className="relative">
                {i < 4 && (
                  <div className="hidden md:block absolute top-8 left-full w-4 h-0.5 bg-slate-200 z-10" />
                )}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 border border-slate-100 h-full">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${step.color}`}>
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 mb-1">Step {i + 1}</div>
                  <div className="font-bold text-slate-900 text-sm mb-1">{step.label}</div>
                  <div className="text-xs text-slate-500">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Nova Act Highlight */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 mb-6">Amazon Nova Act</Badge>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                Real browser automation.<br />
                Real county records.
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                Unlike competitors who just search Google, Title AI deploys Nova Act agents 
                to directly navigate county recorder websites — the same way a human title 
                examiner would, but in seconds.
              </p>
              <div className="space-y-3">
                {[
                  "Navigate Harris, Dallas, Tarrant, Bexar & Travis county portals",
                  "Extract deed documents, instrument numbers, and grantor/grantee data",
                  "Detect tax liens from county appraisal district sites",
                  "Download and OCR PDF deed documents",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-yellow-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 font-mono text-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-500 ml-2 text-xs">nova-act-agent.py</span>
              </div>
              <div className="space-y-1 text-slate-300">
                <div><span className="text-yellow-400">from</span> nova_act <span className="text-yellow-400">import</span> NovaAct</div>
                <div className="mt-2 text-slate-500"># Navigate county recorder</div>
                <div><span className="text-blue-400">with</span> NovaAct() <span className="text-blue-400">as</span> agent:</div>
                <div className="pl-4">agent.goto(county_url)</div>
                <div className="pl-4">agent.act(<span className="text-green-400">&quot;Search for &#123;address&#125;&quot;</span>)</div>
                <div className="pl-4">deeds = agent.act(<span className="text-green-400">"Extract all deed records"</span>)</div>
                <div className="pl-4">liens = agent.act(<span className="text-green-400">"Find active tax liens"</span>)</div>
                <div className="mt-2 text-slate-500"># Returns structured JSON</div>
                <div><span className="text-yellow-400">return</span> TitleReport(deeds, liens)</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 bg-[#fefce8]">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-slate-900">Everything a title examiner does, automated.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: "Chain of Title", desc: "Complete ownership history from grantor/grantee deed records, with dates and instrument numbers.", color: "bg-yellow-50 border-yellow-200 text-yellow-600" },
              { icon: AlertTriangle, title: "Lien Detection", desc: "Tax liens, HOA dues, mechanic's liens, mortgage encumbrances — all surfaced automatically.", color: "bg-orange-50 border-orange-200 text-orange-600" },
              { icon: ShieldCheck, title: "Risk Assessment", desc: "AI-powered exception analysis that flags title defects, gaps in chain, and priority conflicts.", color: "bg-green-50 border-green-200 text-green-600" },
              { icon: Building2, title: "5 Texas Counties", desc: "Harris, Dallas, Tarrant, Bexar & Travis — the top 5 counties covering 60% of Texas real estate volume.", color: "bg-blue-50 border-blue-200 text-blue-600" },
              { icon: Zap, title: "PDF Commitment", desc: "Download a professional title commitment PDF report ready for lenders and underwriters.", color: "bg-purple-50 border-purple-200 text-purple-600" },
              { icon: Bot, title: "Nova Pro Chat", desc: "Ask any title question in natural language — powered by Amazon Nova Pro for expert answers.", color: "bg-pink-50 border-pink-200 text-pink-600" },
            ].map((f, i) => (
              <div key={i} className={`p-6 rounded-2xl border ${f.color.split(' ').slice(0, 2).join(' ')} bg-white`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color.split(' ').slice(0, 1).join(' ')}`}>
                  <f.icon className={`w-6 h-6 ${f.color.split(' ')[2]}`} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-yellow-500">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Run your first title search free.
          </h2>
          <p className="text-slate-800 text-xl mb-8">
            Enter any Texas property address and get a full title report in under 60 seconds.
          </p>
          <Link href="/titleai">
            <Button
              size="lg"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg h-14 px-10 rounded-xl shadow-xl"
            >
              Start Now — No Signup Required
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-yellow-500 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">Title AI</span>
          </div>
          <p className="text-sm">Built for Amazon Nova AI Hackathon 2026 • Powered by Amazon Nova Act + Nova Pro</p>
          <div className="flex gap-6 text-sm">
            <Link href="/titleai" className="hover:text-white transition">Search</Link>
            <Link href="/titleai/chat" className="hover:text-white transition">Chat</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
