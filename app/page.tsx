import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, ShieldCheck, AlertTriangle, Building2, Zap,
  ArrowRight, CheckCircle2, Globe, TrendingUp, Clock, DollarSign,
  Users, BarChart3, Lock, Layers, Workflow, Bot, MessageSquare
} from "lucide-react";
import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fefce8]">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-20 px-6">
        <div className="container mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-full text-yellow-800 text-sm font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
            </span>
            Disrupting a $38 Billion Industry
          </div>

          <h1 className="text-6xl md:text-8xl font-bold text-slate-900 leading-[1.05] tracking-tight mb-6">
            The end of
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">
              slow title searches.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            The U.S. title insurance market is worth <span className="font-bold text-slate-900">$38 billion</span>. 
            Every real estate transaction requires a title search that takes 
            <span className="font-bold text-slate-900"> 2-4 weeks</span> and costs 
            <span className="font-bold text-slate-900"> $800-$2,000</span>.
            Title AI replaces this entire process with autonomous AI agents in 
            <span className="font-bold text-yellow-600"> 30 seconds</span>.
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
                <MessageSquare className="w-5 h-5 mr-2" />
                Chat with AI
              </Button>
            </Link>
          </div>

          {/* Market Impact Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-4 rounded-2xl bg-white/60 border border-yellow-100">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">$38B</div>
              <div className="text-sm text-slate-500 mt-1">U.S. title insurance market</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-white/60 border border-yellow-100">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">30s</div>
              <div className="text-sm text-slate-500 mt-1">vs. 2-4 week manual search</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-white/60 border border-yellow-100">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">110+</div>
              <div className="text-sm text-slate-500 mt-1">U.S. counties covered</div>
            </div>
            <div className="text-center p-4 rounded-2xl bg-white/60 border border-yellow-100">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">5.5M</div>
              <div className="text-sm text-slate-500 mt-1">U.S. home sales / year</div>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="bg-red-100 text-red-700 border-red-200 mb-4">The Problem</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Title search is broken.
            </h2>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
              Every home purchase in America requires a manual title search. The process hasn&apos;t changed in 50 years.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-8 rounded-2xl bg-red-50 border border-red-100">
              <Clock className="w-10 h-10 text-red-500 mb-4" />
              <h3 className="text-2xl font-bold text-slate-900 mb-2">2-4 Weeks</h3>
              <p className="text-slate-600">
                Title examiners manually visit courthouses, flip through deed books,
                and hand-trace ownership chains for every single property.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-orange-50 border border-orange-100">
              <DollarSign className="w-10 h-10 text-orange-500 mb-4" />
              <h3 className="text-2xl font-bold text-slate-900 mb-2">$800-$2,000</h3>
              <p className="text-slate-600">
                Homebuyers pay exorbitant fees for a process that involves
                humans reading PDFs and typing data into spreadsheets.
              </p>
            </div>
            <div className="p-8 rounded-2xl bg-yellow-50 border border-yellow-100">
              <AlertTriangle className="w-10 h-10 text-yellow-600 mb-4" />
              <h3 className="text-2xl font-bold text-slate-900 mb-2">30% Error Rate</h3>
              <p className="text-slate-600">
                Manual processes lead to missed liens, gaps in chain of title,
                and costly closing delays that affect millions of transactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-[#fefce8]">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mb-4">How It Works</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">5 autonomous agents. 30 seconds.</h2>
            <p className="text-xl text-slate-500">
              A fleet of specialized AI agents replaces the entire title search pipeline.
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {[
              { icon: Search, label: "Property Lookup", desc: "Identify county & recorder office from any address", color: "bg-blue-50 text-blue-600" },
              { icon: Bot, label: "Browser Agent", desc: "Autonomously navigate county recorder websites", color: "bg-purple-50 text-purple-600" },
              { icon: FileText, label: "Chain of Title", desc: "Analyze full ownership history from deed records", color: "bg-yellow-50 text-yellow-600" },
              { icon: AlertTriangle, label: "Lien Detection", desc: "Surface tax, HOA & mortgage encumbrances", color: "bg-orange-50 text-orange-600" },
              { icon: ShieldCheck, label: "Risk Report", desc: "Generate ALTA-compliant title commitment", color: "bg-green-50 text-green-600" },
            ].map((step, i) => (
              <div key={i} className="relative">
                {i < 4 && (
                  <div className="hidden md:block absolute top-8 left-full w-4 h-0.5 bg-slate-200 z-10" />
                )}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white border border-slate-100 shadow-sm h-full">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-3 ${step.color}`}>
                    <step.icon className="w-7 h-7" />
                  </div>
                  <div className="text-xs font-bold text-slate-400 mb-1">Agent {i + 1}</div>
                  <div className="font-bold text-slate-900 text-sm mb-1">{step.label}</div>
                  <div className="text-xs text-slate-500">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 mb-6">What You Get</Badge>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                Real searches.<br />
                Real county records.<br />
                Real results.
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                Title AI deploys autonomous browser agents that navigate county recorder
                websites -- the same databases human title examiners use. Combined with
                AI-powered document analysis, we deliver production-grade title intelligence.
              </p>
              <div className="space-y-3">
                {[
                  "Autonomous browser agents navigate 110+ county recorder portals",
                  "Full chain of title extraction with source provenance tracking",
                  "Lien detection: tax, mortgage, HOA, judgment, mechanic's liens",
                  "ALTA-compliant reports with Schedule A/B and confidence scoring",
                  "Human-in-the-loop review workflow for licensed title examiners",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-yellow-400 shrink-0" />
                    <span className="text-slate-300">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">Sample Output</div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-300 font-bold text-sm">Clear Title</span>
                  </div>
                  <p className="text-slate-400 text-xs">123 Main St, Harris County, TX</p>
                  <p className="text-slate-500 text-xs mt-1">8 deeds traced · 0 active liens · 95% confidence</p>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-300 font-bold text-sm">Liens Found</span>
                  </div>
                  <p className="text-slate-400 text-xs">456 Oak Ave, Los Angeles County, CA</p>
                  <p className="text-slate-500 text-xs mt-1">12 deeds · 2 tax liens ($4,200) · Review required</p>
                </div>
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-300 font-bold text-sm">ALTA Report Generated</span>
                  </div>
                  <p className="text-slate-400 text-xs">789 Pine Rd, Maricopa County, AZ</p>
                  <p className="text-slate-500 text-xs mt-1">Schedule A/B · Provenance citations · PDF ready</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Market Opportunity */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="bg-green-100 text-green-700 border-green-200 mb-4">Market Opportunity</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Disrupting a trillion-dollar ecosystem.
            </h2>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
              Title search is the bottleneck of the $2.3 trillion U.S. real estate market.
              Every transaction depends on it. None of it is automated.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
              <TrendingUp className="w-8 h-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">Total Addressable Market</h3>
              <div className="space-y-3 text-slate-700">
                <div className="flex justify-between items-center py-2 border-b border-yellow-200/50">
                  <span>U.S. real estate transactions</span>
                  <span className="font-bold">$2.3T / year</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-yellow-200/50">
                  <span>Title insurance premiums</span>
                  <span className="font-bold">$38B / year</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-yellow-200/50">
                  <span>Title search & examination</span>
                  <span className="font-bold">$12B / year</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span>Home sales requiring title</span>
                  <span className="font-bold">5.5M / year</span>
                </div>
              </div>
            </div>
            <div className="p-8 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
              <BarChart3 className="w-8 h-8 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">Title AI Advantage</h3>
              <div className="space-y-4">
                {[
                  { label: "Speed", value: "4,800x faster", pct: 98 },
                  { label: "Cost", value: "97% cheaper", pct: 97 },
                  { label: "Coverage", value: "110+ counties live", pct: 40 },
                  { label: "Accuracy", value: "AI + human review", pct: 90 },
                ].map((stat, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{stat.label}</span>
                      <span className="font-bold text-green-700">{stat.value}</span>
                    </div>
                    <div className="h-2 bg-green-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${stat.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features */}
      <section className="py-20 bg-[#fefce8]">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="text-center mb-16">
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-4">Platform</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Built for production. Built to last.
            </h2>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
              Enterprise-grade infrastructure that scales from individual searches
              to processing thousands of transactions per day.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Workflow,
                title: "Durable Execution",
                desc: "Long-running title searches survive browser closes, network failures, and server restarts. Come back anytime to check your results.",
                color: "bg-purple-50 border-purple-200 text-purple-600"
              },
              {
                icon: Bot,
                title: "Autonomous Browser Fleet",
                desc: "Cloud-hosted browsers navigate county recorder websites and extract structured deed, lien, and encumbrance data automatically.",
                color: "bg-blue-50 border-blue-200 text-blue-600"
              },
              {
                icon: ShieldCheck,
                title: "ALTA Compliance",
                desc: "Reports follow ALTA standard format with Schedule A (property details) and Schedule B (exceptions), ready for underwriting review.",
                color: "bg-yellow-50 border-yellow-200 text-yellow-600"
              },
              {
                icon: Users,
                title: "Human-in-the-Loop",
                desc: "Licensed title examiners can review, comment on, and approve AI-generated reports section by section before they're finalized.",
                color: "bg-green-50 border-green-200 text-green-600"
              },
              {
                icon: Lock,
                title: "Source Provenance",
                desc: "Every data point is traced back to its source document with confidence scoring. Full audit trail for regulatory compliance.",
                color: "bg-red-50 border-red-200 text-red-600"
              },
              {
                icon: Globe,
                title: "Nationwide Coverage",
                desc: "110+ counties across 20+ states with continuous expansion. County health monitoring tracks recorder site availability in real-time.",
                color: "bg-orange-50 border-orange-200 text-orange-600"
              },
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
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            See the future of title search.
          </h2>
          <p className="text-slate-800 text-xl mb-8 max-w-2xl mx-auto">
            Enter any property address and watch autonomous AI agents deliver a complete
            title report in seconds.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/titleai">
              <Button
                size="lg"
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-lg h-14 px-10 rounded-xl shadow-xl"
              >
                <Search className="w-5 h-5 mr-2" />
                Run Title Search
              </Button>
            </Link>
            <Link href="/titleai/chat">
              <Button
                size="lg"
                variant="outline"
                className="font-bold text-lg h-14 px-10 rounded-xl border-2 border-slate-800 text-slate-900 hover:bg-slate-900 hover:text-white"
              >
                <MessageSquare className="w-5 h-5 mr-2" />
                Chat with AI
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
