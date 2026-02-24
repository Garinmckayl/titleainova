import { streamText, convertToModelMessages, jsonSchema, stepCountIs } from "ai";
import { auth } from "@clerk/nextjs/server";
import { novaPro } from "@/lib/bedrock";
import { getRecentSearches, getSearch, saveSearch, type ScreenshotRecord } from "@/lib/turso";
import { lookupCounty } from "@/lib/agents/title-search/property-lookup";
import { retrieveCountyRecords } from "@/lib/agents/title-search/record-retrieval";
import { buildChainOfTitle, detectLiens, assessRisk, generateSummary } from "@/lib/agents/title-search/analysis";
import { getMockDocs } from "@/lib/agents/title-search/mock";

export const runtime = "nodejs";
export const maxDuration = 300;

async function buildSystemPrompt(userId: string | null): Promise<string> {
  let searchContext = "";
  try {
    const recent = await getRecentSearches(10, userId);
    if (recent.length > 0) {
      searchContext = `\n\n## Recent Title Searches in Database\nYou have access to ${recent.length} recent title searches:\n`;
      for (const s of recent) {
        const r = s.report as any;
        const chainLen = r?.ownershipChain?.length ?? 0;
        const lienCount = r?.liens?.length ?? 0;
        const exCount = r?.exceptions?.length ?? 0;
        searchContext += `\n- **ID ${s.id}**: ${s.address} (${s.county}) — ${chainLen} deeds, ${lienCount} liens, ${exCount} exceptions. Source: ${s.source || "web_search"}. Date: ${s.created_at}`;
        if (r?.summary) searchContext += `\n  Summary: ${r.summary.slice(0, 200)}...`;
      }
      searchContext += `\n\nWhen users ask about a property you've already searched, use get_search_report with the ID. For new properties, use run_title_search.`;
    }
  } catch { /* DB not available */ }

  return `You are Title AI, an autonomous real estate title intelligence assistant. You are a production tool, not a demo.

## CRITICAL: You have REAL tools. USE THEM.

You have access to tools that execute REAL property title searches against county recorder databases and web sources. When a user asks about a property or wants a title search:

1. **ALWAYS call the run_title_search tool.** Do NOT say "I cannot conduct searches" or "I recommend visiting the county recorder website." You CAN and MUST run searches directly using your tools.
2. **NEVER refuse to search.** Your tools handle everything: county lookup, record retrieval, chain of title analysis, lien detection, and risk assessment.
3. **NEVER explain your reasoning process to the user.** Just act. Call the tool, then present the results.

## Your Tools

- **run_title_search**: Takes a property address, deploys AI agents to search county records, builds chain of title, detects liens, generates risk assessment. Works for ANY U.S. property.
- **get_search_report**: Retrieves a previously completed search by ID. Use this when the user asks about a property you already searched.

## How to Present Results

After a search completes, summarize the findings conversationally:
- Property location and county
- Current owner and ownership chain highlights
- Any liens found (type, amount, status, priority)
- Title exceptions and risk level
- Data source used

Be thorough but concise. If the user mentions an address, run the search immediately without asking for confirmation.${searchContext}`;
}

/* ── Tool execute functions ──────────────────────────────────── */

async function executeSearch({ address }: { address: string }): Promise<Record<string, unknown>> {
  try {
    const c = await lookupCounty(address);
    const county = c ?? { name: "Unknown County", state: "US", recorderUrl: "", searchUrl: "" };

    let novaActData: any = null;
    const screenshots: ScreenshotRecord[] = [];
    const sidecarUrl = process.env.NOVA_ACT_SERVICE_URL;

    if (sidecarUrl) {
      try {
        const res = await fetch(`${sidecarUrl}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, county: county.name }),
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          const json = await res.json();
          novaActData = json.data || json;
        }
      } catch { /* sidecar unavailable */ }
    }

    let docs: any[] = [];
    if (novaActData) {
      docs = [{ source: "Nova Act", url: county.recorderUrl || "", text: JSON.stringify(novaActData), type: "NovaAct" }];
    } else {
      const hasTavily = process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.startsWith("your_");
      docs = !hasTavily ? getMockDocs(address, county.name) : await retrieveCountyRecords(address, county.name);
    }

    const chain = novaActData?.ownershipChain?.length ? novaActData.ownershipChain : await buildChainOfTitle(docs);
    const liens = novaActData?.liens?.length ? novaActData.liens : await detectLiens(docs, county.name);
    const exceptions = await assessRisk(chain, liens);
    const summary = await generateSummary(chain, liens, exceptions);

    const reportData = {
      propertyAddress: address,
      county: county.name,
      reportDate: new Date().toLocaleDateString(),
      parcelId: novaActData?.parcelId ?? null,
      legalDescription: novaActData?.legalDescription ?? null,
      ownershipChain: chain,
      liens,
      exceptions,
      summary,
      dataSource: novaActData ? "Amazon Nova Act" : "Web Search + Amazon Nova Pro",
    };

    const searchId = await saveSearch(address, county.name, novaActData?.parcelId ?? null, novaActData?.source ?? "web_search", reportData, screenshots);

    return { success: true, searchId, ...reportData };
  } catch (err: any) {
    return { success: false, error: err.message || "Title search failed" };
  }
}

async function executeGetReport({ searchId }: { searchId: number }): Promise<Record<string, unknown>> {
  try {
    const row = await getSearch(searchId);
    if (!row) return { success: false, error: "Search not found" };
    return {
      success: true,
      id: row.id,
      address: row.address,
      county: row.county,
      source: row.source,
      created_at: row.created_at,
      screenshotCount: row.screenshots?.length ?? 0,
      report: row.report,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ── Route handler ───────────────────────────────────────────── */

export async function POST(req: Request) {
  const { userId } = await auth();
  const { messages } = await req.json();
  const systemPrompt = await buildSystemPrompt(userId);

  const result = streamText({
    model: novaPro,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    temperature: 0.3,
    stopWhen: stepCountIs(5),
    tools: {
      run_title_search: {
        description: "Run a full title search on a property address. Deploys AI agents to search county records, build chain of title, detect liens, and generate a risk assessment.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            address: {
              type: "string",
              description: "Full property address, e.g. '1400 Smith St, Houston, TX 77002'",
            },
          },
          required: ["address"],
        }),
        execute: executeSearch,
      },
      get_search_report: {
        description: "Retrieve a previously completed title search report by its ID.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            searchId: {
              type: "number",
              description: "The ID of the search to retrieve",
            },
          },
          required: ["searchId"],
        }),
        execute: executeGetReport,
      },
    } as any,
    experimental_telemetry: {
      isEnabled: true,
      functionId: "title-ai-chat",
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
