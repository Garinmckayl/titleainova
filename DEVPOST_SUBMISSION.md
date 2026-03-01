# Title AI — Devpost Submission Fields

Copy-paste each section directly into the Devpost form.
Category: **UI Automation**
Hashtag: #AmazonNova

---

## Inspiration

Every residential real estate transaction in America requires a title search. A human examiner manually navigates county recorder websites to trace ownership history and find liens. It takes 5 to 14 days. Costs $300–$600. For every single transaction.

There are 3,600 counties in the US. None have a standardized API. The only way into the data is through a web browser — forms, pagination, inconsistent layouts, session state. No scraper survives it. No traditional automation handles it.

That is exactly the problem Amazon Nova Act was built to solve.

---

## What it does

Title AI is the fastest automated real estate title search platform ever built — Nova Act handles the browser, Nova Pro handles the analysis, and weeks of manual work collapse into minutes.

Enter any property address. Six agents execute immediately:

1. **County Lookup** — resolves the address to the correct county recorder website from a database of 65+ verified counties across 14 states
2. **Nova Act Browser Agent** — deploys a cloud Chromium session via AgentCore Browser Tool, navigates the live county recorder website, searches the property, extracts deed records and parcel history — on the actual government site, in real time, with screenshots streaming to the UI at every step
3. **Chain of Title Agent (Nova Pro)** — extracts every ownership transfer: grantor, grantee, document type, recording date, instrument number — returned as structured `OwnershipNode[]`
4. **Lien Detection Agent (Nova Pro)** — identifies tax liens, mortgages, HOA liens, judgments, encumbrances — returned as structured `Lien[]`
5. **Risk Assessment Agent (Nova Pro)** — classifies title exceptions by severity, flags issues, generates recommendations — returned as structured `TitleException[]`
6. **Report Agent (Nova Pro)** — executive summary and branded Title Commitment Report PDF

The browser screenshots from Nova Act stream live to the UI as the agent works. You watch a real browser, on a real government website, controlled by AI — not a simulation, not cached data, not a mock. Live.

14 days of manual title search work. Done in minutes. With a full audit trail.

---

## How we built it

**Nova Act — the core that makes it possible:**

Nova Act runs on an EC2 sidecar service and connects to AgentCore Browser Tool, which provisions cloud-hosted Chromium sessions with live view URLs and CDP WebSocket access. Nova Act navigates the county recorder website, executes the property search, and captures screenshots at each step.

The screenshot streaming architecture runs browser work on a background thread, puts screenshots into a `queue.Queue`, and the SSE generator polls and yields each screenshot event to the client in real time. Users see the AI working through the government site frame by frame as it happens.

**Nova Pro — structured output pipeline:**

Four Nova Pro agents run after the browser agent returns raw document text. Every agent uses `generateObject()` with a typed schema — structured JSON output, not free text. Chain of title returns `OwnershipNode[]`. Lien detection returns `Lien[]`. Risk assessment returns `TitleException[]`. Structured output means the UI never fails to render — there's no free-text parsing that can break.

**Chat with tool calling:**

A Nova Pro chat agent exposes `run_title_search` and `get_search_report` as tools. Users can run searches and review results entirely through natural language conversation.

**Durable background jobs:**

Long searches run via Inngest — durable execution with per-step retries and real-time progress updates to the UI. Each step updates a Turso (libSQL) job row with percentage, logs, and screenshots.

**Stack:**
- **Amazon Nova Act** — browser automation on live county recorder websites
- **Amazon Nova Pro** (`us.amazon.nova-pro-v1:0`) — chain of title, lien detection, risk assessment, report generation, chat tool calling
- **Amazon Nova Sonic** — voice interface
- **AgentCore Browser Tool** — cloud Chromium, CDP WebSocket, live view URLs
- **Amazon Bedrock** — model hosting
- **EC2** — Nova Act sidecar
- **Next.js 15 + Vercel AI SDK v6** — frontend and streaming
- **Turso (libSQL)** — search history, job state
- **Inngest** — durable background job execution

---

## Challenges we ran into

**Every county recorder site is different.** No standard forms, no consistent URL patterns, no uniform field names. Some require parcel numbers before showing deed history. Some use JavaScript-heavy search interfaces that break traditional automation. Nova Act handles the variation — but we still had to build and validate a county database with verified recorder URLs and tested navigation flows for each site. Tavily web search serves as fallback when a live site is unreachable.

**Streaming screenshots from a blocking browser agent.** Nova Act's browser work is synchronous — it can't yield screenshots mid-execution. Running it on a background thread with a `queue.Queue` as the communication channel lets the SSE generator stream screenshots to the client while the agent is still working through the county site.

**Four sequential Nova Pro calls after an already-slow browser step.** We parallelized chain-of-title and lien detection since both operate on the same raw documents independently — cutting the analysis phase roughly in half while keeping the structured output guarantee.

---

## Accomplishments that we're proud of

- Live browser automation on real US county recorder websites via Nova Act — actual government sites, real property data, no mocks
- Six-agent pipeline from address to full PDF title report with complete chain of custody
- Real-time screenshot streaming — judges and users watch Nova Act navigate government websites frame by frame
- Structured output from every Nova Pro agent — typed schemas guarantee the UI always renders correctly
- Natural language chat interface that runs full title searches through Nova Pro tool calling
- 65+ counties across 14 states with verified recorder URLs
- 5–14 days of manual examiner work replaced by minutes of automated Nova Act execution

---

## What we learned

Nova Act is genuinely capable of navigating government websites that no scraper survives. The critical insight: write the task instruction at the right abstraction level — specific enough that the agent knows what to find, general enough that it adapts to layout variation between county sites. Too prescriptive and it breaks on any deviation. Too vague and it wanders.

Typed schemas with `generateObject()` are non-negotiable for production pipelines. Free-text generation from Nova Pro is powerful for summarization, but for anything that feeds a UI or gets stored as structured data, schema-constrained output eliminates an entire class of runtime failures.

---

## What's next

- Expand to all 3,600 US counties — the architecture scales, it's a validation and URL-curation problem
- Automated monitoring — run title searches on a schedule, alert when new liens or ownership changes appear on a tracked property
- Direct integration with title insurance underwriting platforms — feed structured Nova Pro output into underwriting workflows
- International expansion — land registry automation in countries where property records are online but inaccessible without manual navigation
- Commercial property support — more complex ownership chains, easements, CC&Rs, zoning records
