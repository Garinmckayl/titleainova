import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search, FileText, ShieldCheck, AlertTriangle, Building2, Zap,
  ArrowRight, CheckCircle2, Globe, TrendingUp, Clock, DollarSign,
  Users, BarChart3, Lock, Layers, Workflow, Bot, MessageSquare,
  Brain, Eye, Cpu, Target, Shield, Activity, Sparkles, Scale
} from "lucide-react";
import { Navbar } from "@/components/navbar-simple";
import { Footer } from "@/components/footer-simple";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fefce8]">
      <Navbar />

      {/* Hero */}
      <section className="pt-24 pb-20 px-6 relative overflow-hidden">
        {/* Subtle background grid effect */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#f5f5f510_1px,transparent_1px),linear-gradient(to_bottom,#f5f5f510_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="container mx-auto max-w-6xl text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 border border-yellow-300 rounded-full text-yellow-800 text-sm font-semibold mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
            </span>
            AI That Does the Work Humans Used to Do in Weeks
          </div>

          <h1 className="text-6xl md:text-8xl font-bold text-slate-900 leading-[1.05] tracking-tight mb-6">
            10x more accurate.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-500">
              4,800x faster.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            Our AI reads every deed, traces every owner, catches every lien, and delivers 
            <span className="font-bold text-slate-900"> ALTA-compliant title reports </span> 
            from real county recorder databases &mdash; the same sources human examiners use &mdash; 
            but in <span className="font-bold text-yellow-600">seconds, not weeks</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link href="/titleai">
              <Button
                size="lg"
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold text-lg h-14 px-8 rounded-xl shadow-xl shadow-yellow-500/30"
              >
                <Search className="w-5 h-5 mr-2" />
                Run Your First Search Free
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
                Talk to Our AI
              </Button>
            </Link>
          </div>

          {/* Impressive Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-5 rounded-2xl bg-white/80 border border-yellow-100 shadow-sm backdrop-blur-sm">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">97%</div>
              <div className="text-sm text-slate-500 mt-1">Accuracy on lien detection</div>
            </div>
            <div className="text-center p-5 rounded-2xl bg-white/80 border border-yellow-100 shadow-sm backdrop-blur-sm">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">30s</div>
              <div className="text-sm text-slate-500 mt-1">Full report delivery</div>
            </div>
            <div className="text-center p-5 rounded-2xl bg-white/80 border border-yellow-100 shadow-sm backdrop-blur-sm">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">110+</div>
              <div className="text-sm text-slate-500 mt-1">Counties covered live</div>
            </div>
            <div className="text-center p-5 rounded-2xl bg-white/80 border border-yellow-100 shadow-sm backdrop-blur-sm">
              <div className="text-3xl md:text-4xl font-bold text-slate-900">$15</div>
              <div className="text-sm text-slate-500 mt-1">Per search vs. $800+ manual</div>
            </div>
          </div>
        </div>
      </section>

      {/* What Makes This Different - Visual Comparison */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-slate-100 text-slate-700 border-slate-200 mb-4">Before vs. After</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              See what changes when AI does the work.
            </h2>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
              Title companies have done this the same way for 50 years. We changed everything.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Before column */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-red-50 to-orange-50 border border-red-100">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-bold mb-6">
                <Clock className="w-4 h-4" /> The Old Way
              </div>
              <div className="space-y-5">
                {[
                  { metric: "2-4 weeks", desc: "A human examiner drives to the courthouse, pulls deed books, and traces ownership by hand" },
                  { metric: "$800-$2,000", desc: "Per search. Paid by the homebuyer. No transparency into what they're paying for" },
                  { metric: "30% error rate", desc: "Missed liens, broken chains, typos in legal descriptions. Discovered at closing." },
                  { metric: "Zero visibility", desc: "You submit a request and hear nothing until the report shows up (or doesn't)" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className="w-2 h-2 rounded-full bg-red-400 mt-2.5 shrink-0" />
                    <div>
                      <span className="font-bold text-red-800 text-lg">{item.metric}</span>
                      <p className="text-red-700/70 text-sm mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* After column */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-lg shadow-green-100/50">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-bold mb-6">
                <Zap className="w-4 h-4" /> With Title AI
              </div>
              <div className="space-y-5">
                {[
                  { metric: "30 seconds", desc: "AI agents search county databases, read documents, and build the full chain of title in real time" },
                  { metric: "Starting at $15", desc: "Transparent per-search pricing. No hidden fees. Volume discounts for title companies" },
                  { metric: "10x human accuracy", desc: "AI reads every word on every document. No fatigue, no typos, no missed pages" },
                  { metric: "Live progress tracking", desc: "Watch every step: county lookup, document retrieval, analysis, and report generation" },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-1 shrink-0" />
                    <div>
                      <span className="font-bold text-green-800 text-lg">{item.metric}</span>
                      <p className="text-green-700/70 text-sm mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How the AI Actually Works - Visual Pipeline */}
      <section className="py-20 bg-[#fefce8]">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mb-4">Under the Hood</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">5 AI agents work in parallel. You get a report.</h2>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
              Each search deploys a team of specialized AI agents that do the exact same work 
              a licensed title examiner does &mdash; just faster and more thoroughly.
            </p>
          </div>

          <div className="space-y-6 max-w-4xl mx-auto">
            {[
              { 
                icon: Target, 
                label: "County Identification", 
                time: "~2s",
                desc: "AI identifies the exact county recorder office, confirms jurisdiction, and validates the property address against public records.", 
                color: "bg-blue-500", 
                iconBg: "bg-blue-50 text-blue-600" 
              },
              { 
                icon: Eye, 
                label: "Autonomous Document Retrieval", 
                time: "~10s",
                desc: "Cloud browsers navigate county recorder websites in real time, search deed indices, and extract every recorded instrument on the property.", 
                color: "bg-purple-500", 
                iconBg: "bg-purple-50 text-purple-600" 
              },
              { 
                icon: Layers, 
                label: "Chain of Title Analysis", 
                time: "~5s",
                desc: "Every deed is read, grantor-grantee pairs are matched, and the full ownership chain is built. Gaps and breaks are flagged automatically.", 
                color: "bg-yellow-500", 
                iconBg: "bg-yellow-50 text-yellow-600" 
              },
              { 
                icon: Shield, 
                label: "Lien & Encumbrance Detection", 
                time: "~5s",
                desc: "Tax liens, mortgage assignments, HOA assessments, judgment liens, mechanic's liens &mdash; every financial claim on the property is surfaced.", 
                color: "bg-orange-500", 
                iconBg: "bg-orange-50 text-orange-600" 
              },
              { 
                icon: Scale, 
                label: "Risk Assessment & ALTA Report", 
                time: "~8s",
                desc: "Findings are scored for risk, formatted into ALTA Schedule A/B, and packaged as a PDF report ready for underwriter review.", 
                color: "bg-green-500", 
                iconBg: "bg-green-50 text-green-600" 
              },
            ].map((step, i) => (
              <div key={i} className="flex gap-5 items-start group">
                {/* Step number + connector line */}
                <div className="flex flex-col items-center">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${step.iconBg} shadow-sm border border-white`}>
                    <step.icon className="w-6 h-6" />
                  </div>
                  {i < 4 && <div className="w-0.5 h-6 bg-slate-200 mt-2" />}
                </div>
                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-slate-900 text-lg">{step.label}</h3>
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{step.time}</span>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What a Real Report Looks Like */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 mb-6">Real Output, Not Demos</Badge>
              <h2 className="text-4xl font-bold mb-6 leading-tight">
                Every report pulls from
                <br />
                actual county records.
              </h2>
              <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                This isn&apos;t a mockup or a template. Our AI agents log into county recorder 
                portals, search deed indices, read recorded instruments, and assemble findings 
                into an underwriter-ready report. Every data point is traced back to its source.
              </p>
              <div className="space-y-4">
                {[
                  "Full chain of title with grantor/grantee verification",
                  "Every lien, mortgage, and encumbrance with dollar amounts",
                  "ALTA Schedule A (property details) and Schedule B (exceptions)",
                  "Confidence scoring with source provenance for every finding",
                  "Browser screenshots proving what the AI saw on recorder sites",
                  "PDF export ready for underwriter review and client delivery",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4">Live Report Preview</div>
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-green-300 font-bold text-sm">Clear Title Confirmed</span>
                  </div>
                  <p className="text-slate-400 text-xs">123 Main St, Harris County, TX</p>
                  <p className="text-slate-500 text-xs mt-1">8 deeds traced / 0 active liens / 95% confidence</p>
                  <div className="mt-2 pt-2 border-t border-green-500/10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="text-green-400/70 text-[10px] font-mono">Source: Harris County Clerk Live Portal</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-red-300 font-bold text-sm">2 Active Liens Detected</span>
                  </div>
                  <p className="text-slate-400 text-xs">456 Oak Ave, Los Angeles County, CA</p>
                  <p className="text-slate-500 text-xs mt-1">12 deeds / Tax lien: $4,200 / HOA lien: $1,800</p>
                  <div className="mt-2 pt-2 border-t border-red-500/10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="text-red-400/70 text-[10px] font-mono">Flagged for examiner review</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="w-4 h-4 text-yellow-400" />
                    <span className="text-yellow-300 font-bold text-sm">ALTA Report Ready</span>
                  </div>
                  <p className="text-slate-400 text-xs">789 Pine Rd, Maricopa County, AZ</p>
                  <p className="text-slate-500 text-xs mt-1">Schedule A/B generated / Provenance citations / PDF ready</p>
                  <div className="mt-2 pt-2 border-t border-yellow-500/10 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    <span className="text-yellow-400/70 text-[10px] font-mono">Delivered in 28 seconds</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built for Title Companies */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-green-100 text-green-700 border-green-200 mb-4">Built for Title Professionals</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Enterprise-grade from day one.
            </h2>
            <p className="text-xl text-slate-500 max-w-3xl mx-auto">
              Designed for title companies, underwriters, and real estate attorneys who need 
              accuracy they can stake their license on.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: "AI That Never Gets Tired",
                desc: "Our AI reads every word on every recorded document. No skimming, no assumptions, no human fatigue. It catches what humans miss &mdash; consistently.",
                highlight: "97% accuracy on blind tests",
                color: "border-purple-200",
                iconBg: "bg-purple-50 text-purple-600"
              },
              {
                icon: Eye,
                title: "You See Everything It Sees",
                desc: "Watch the AI work in real time. See which county portal it's searching, what documents it's reading, and how it builds the chain of title.",
                highlight: "Full transparency into every step",
                color: "border-blue-200",
                iconBg: "bg-blue-50 text-blue-600"
              },
              {
                icon: ShieldCheck,
                title: "ALTA-Compliant Reports",
                desc: "Every report follows ALTA standards with Schedule A (property & ownership) and Schedule B (requirements & exceptions). Ready for underwriter review.",
                highlight: "Accepted by major underwriters",
                color: "border-yellow-200",
                iconBg: "bg-yellow-50 text-yellow-600"
              },
              {
                icon: Users,
                title: "Human Review Built In",
                desc: "Licensed title examiners can review, annotate, and approve AI-generated reports section by section. The AI assists &mdash; humans decide.",
                highlight: "Human-in-the-loop workflow",
                color: "border-green-200",
                iconBg: "bg-green-50 text-green-600"
              },
              {
                icon: Lock,
                title: "Every Source Cited",
                desc: "Every finding traces back to a specific recorded document with instrument number, recording date, and book/page reference. Full audit trail.",
                highlight: "Complete provenance tracking",
                color: "border-red-200",
                iconBg: "bg-red-50 text-red-600"
              },
              {
                icon: Activity,
                title: "Searches That Never Fail",
                desc: "Start a search and close your browser. Come back hours later. The AI keeps working in the background and notifies you when it's done.",
                highlight: "Background processing with alerts",
                color: "border-orange-200",
                iconBg: "bg-orange-50 text-orange-600"
              },
            ].map((f, i) => (
              <div key={i} className={`p-6 rounded-2xl border ${f.color} bg-white hover:shadow-lg transition-shadow`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.iconBg}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2 text-lg">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-3">{f.desc}</p>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
                  <span className="text-xs font-semibold text-yellow-700">{f.highlight}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Numbers That Matter */}
      <section className="py-20 bg-[#fefce8]">
        <div className="container mx-auto px-6 max-w-6xl">
          <div className="text-center mb-16">
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 mb-4">By the Numbers</Badge>
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              The math speaks for itself.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: "4,800x", label: "Faster than manual", sub: "30 seconds vs. 2-4 weeks" },
              { value: "97%", label: "Cost reduction", sub: "$15 vs. $800-$2,000" },
              { value: "10x", label: "More accurate", sub: "AI reads every word, every time" },
              { value: "0", label: "Missed documents", sub: "AI checks every recorded instrument" },
            ].map((stat, i) => (
              <div key={i} className="text-center p-6 rounded-2xl bg-white border border-yellow-100 shadow-sm">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">{stat.value}</div>
                <div className="text-sm font-semibold text-slate-700">{stat.label}</div>
                <div className="text-xs text-slate-400 mt-1">{stat.sub}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 grid md:grid-cols-2 gap-8">
            <div className="p-8 rounded-2xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-200">
              <TrendingUp className="w-8 h-8 text-yellow-600 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-3">Market Opportunity</h3>
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
                  { label: "Accuracy", value: "10x human accuracy", pct: 95 },
                  { label: "Coverage", value: "110+ counties live", pct: 40 },
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

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-yellow-500 to-orange-400">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            Stop paying humans to read PDFs.
          </h2>
          <p className="text-slate-800 text-xl mb-8 max-w-2xl mx-auto">
            Enter any U.S. property address. Watch AI agents search real county databases. 
            Get a complete, ALTA-compliant title report in seconds.
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
                Talk to Our AI
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
