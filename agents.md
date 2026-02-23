# Title AI Nova — Architecture & Agent System

## Overview

AI-powered real estate title search platform that uses **Amazon Nova Act** for browser automation of county recorder websites, **Amazon Nova Pro** for multi-agent document analysis, and **AgentCore Browser Tool** for cloud-hosted browser sessions with real-time screenshot streaming.

## Infrastructure

```
┌─────────────────────────────────────────────────────────────┐
│                     Vercel (Next.js 16)                     │
│  /titleai         — One-click title search UI               │
│  /titleai/chat    — Agentic chat with tool calling          │
│  /searches        — Search history (Turso DB)               │
│  /jobs            — Background job dashboard                │
└──────┬────────────────────────────┬─────────────────────────┘
       │ SSE /api/titleai           │ streamText /api/titleai/chat
       ▼                            ▼
┌──────────────────┐    ┌───────────────────────────┐
│  Nova Act Sidecar│    │  Amazon Bedrock            │
│  (Flask, EC2)    │    │  Nova Pro v1 (LLM)         │
│  Port 8001       │    │  Nova Sonic v1 (Voice)     │
│  98.92.77.193    │    │  Titan Embed v2            │
└──────┬───────────┘    └───────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│  AgentCore Browser Tool (AWS-managed)        │
│  Cloud Chromium → CDP WebSocket → Nova Act   │
│  Live view URL + screenshot capture          │
└──────────────────────────────────────────────┘
```

## AWS Services

| Service | Model / Resource | Purpose |
|---|---|---|
| **Bedrock — Nova Pro** | `us.amazon.nova-pro-v1:0` | Chain-of-title analysis, lien detection, risk assessment, summary, chat |
| **Bedrock — Nova Sonic** | `amazon.nova-sonic-v1:0` | Real-time speech-to-speech voice (shared Sonic bridge) |
| **Bedrock — Titan Embed v2** | `amazon.titan-embed-text-v2:0` | Text embeddings |
| **Nova Act** | Workflow `title`, model `nova-act-latest` | Browser automation on county recorder websites |
| **AgentCore Browser Tool** | `bedrock-agentcore` SDK | Cloud-hosted Chromium, CDP WebSocket, live view URLs |

## Agent Architecture

### 1. Title Search Pipeline (6 Agents)

Triggered by `POST /api/titleai` — runs as an SSE stream.

```
Agent 1: County Lookup
  └─ Local DB of 65+ US counties, city-to-county mapping
  └─ Resolves address → county name + recorder website URL

Agent 2: Nova Act Browser Agent (EC2 Sidecar)
  └─ AgentCore Browser Tool starts cloud Chromium session
  └─ Nova Act navigates county recorder website
  └─ Steps: search property → extract parcel → deed history → lien search
  └─ Screenshots captured at each step, streamed via queue.Queue in real-time
  └─ Fallback: Tavily web search → mock demo data

Agent 3: Chain of Title (Nova Pro)
  └─ generateObject() — extracts ownership chain from documents
  └─ Output: OwnershipNode[] (grantor, grantee, date, type, number)

Agent 4: Lien Detection (Nova Pro)
  └─ generateObject() — identifies liens, tax notices, encumbrances
  └─ Output: Lien[] (type, claimant, amount, status, priority)

Agent 5: Risk Assessment (Nova Pro)
  └─ generateObject() — identifies title exceptions and severity
  └─ Output: TitleException[] (type, description, severity, recommendation)

Agent 6: Summary & PDF (Nova Pro + jsPDF)
  └─ generateText() — executive summary of title status
  └─ jsPDF generates branded Title Commitment Report PDF
```

### 2. Chat Agent (Tool-Calling)

Triggered by `POST /api/titleai/chat` — uses AI SDK `streamText` with tools.

```
Nova Pro Chat Agent
  ├─ Tool: run_title_search
  │    └─ Runs full pipeline (sidecar → web search → mock fallback)
  │    └─ Returns structured report data
  │    └─ Saves to Turso DB
  │
  └─ Tool: get_search_report
       └─ Retrieves saved search from Turso by ID
       └─ Returns report + screenshot count

System prompt includes recent search history for context.
```

### 3. Background Job Agent (Inngest)

Triggered by `POST /api/jobs` — durable execution with retries.

```
Inngest Function: title-search-run
  Step 1: county-lookup     (retries: 2)
  Step 2: document-retrieval (retries: 2)
  Step 3: chain-of-title    (retries: 1)
  Step 4: lien-detection    (retries: 1)
  Step 5: risk-assessment   (retries: 1)
  Step 6: generate-report   (retries: 1)

Each step updates Turso job row (progress_pct, logs, screenshots).
Falls back to direct async execution if Inngest not configured.
```

## EC2 Sidecar: Nova Act Service

**Location:** `nova-act-service/main.py` (Flask, port 8001)

### Routes

| Route | Method | Description |
|---|---|---|
| `/health` | GET | SDK status, credentials check, workflow info |
| `/search` | POST | Synchronous title search (blocking) |
| `/search-stream` | POST | SSE streaming search with real-time screenshots |
| `/browse-law` | POST | Browses Ethiopian law sites (used by legalmindznova) |

### Screenshot Streaming Architecture

```
Main Thread (SSE Generator)          Background Thread (Browser)
         │                                     │
         ├─ yield progress "starting"          │
         │                                     ├─ BrowserClient.start()
         ├─ poll for live_view_url ────────────├─ generate_live_view_url()
         │                                     ├─ generate_ws_headers()
         ├─ yield live_view event              │
         │                                     ├─ NovaAct searches county site
         │  ┌─── queue.Queue ◄─────────────────├─ screenshot → queue.put()
         ├──┤ poll queue, yield screenshot      │
         │  │                                   ├─ NovaAct extracts deeds
         │  │  ◄───────────────────────────────├─ screenshot → queue.put()
         ├──┤ poll queue, yield screenshot      │
         │  │                                   ├─ NovaAct searches liens
         │  │  ◄───────────────────────────────├─ screenshot → queue.put()
         ├──┤ poll queue, yield screenshot      │
         │  └─────────────────────────────────SENTINEL
         ├─ yield progress, result
         └─ done
```

## Database: Turso (libSQL)

### Tables

**`title_searches`** — completed search reports
```sql
id, user_id, address, county, parcel_id, source, report (JSON), screenshots (JSON), created_at
```

**`title_jobs`** — durable background jobs
```sql
id, user_id, address, status, current_step, progress_pct, logs (JSON), result (JSON), screenshots (JSON), error, created_at, updated_at
```

## Auth

- **Clerk** (`@clerk/nextjs`) — conditionally enabled
- When `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set: full auth with sign-in/sign-up
- When not set: middleware becomes no-op (open access for hackathon)
- `lib/auth.ts` provides `getUserId()` / `requireAuth()` wrappers

## Environment Variables

```bash
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1

# EC2 Services
NOVA_ACT_SERVICE_URL=https://98.92.77.193.nip.io/nova-act
NEXT_PUBLIC_SONIC_WS_URL=wss://98.92.77.193.nip.io/sonic

# Database
TURSO_DATABASE_URL=libsql://...turso.io
TURSO_AUTH_TOKEN=

# Search (fallback)
TAVILY_API_KEY=

# Auth (optional)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```

## Deployment

- **Frontend:** Vercel (https://titleainova.vercel.app)
- **EC2 Sidecar:** systemd service `nova-act-sidecar` on 98.92.77.193
- **TLS:** Nginx + Let's Encrypt via nip.io domain
- **Branch:** `master` → auto-deploy on push
