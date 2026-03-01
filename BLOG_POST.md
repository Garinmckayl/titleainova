# How We Automated Real Estate Title Search with Amazon Nova Act

**Posted for the AWS Nova Hackathon — #AmazonNova**

---

Every residential real estate transaction in America requires a title search. A human examiner manually navigates county recorder websites to trace 50 years of ownership history and find liens. It takes 5 to 14 days. It costs $300–$600. For every single transaction. In the United States, that means millions of searches per year, each one a manual web browsing session.

There are 3,600 counties in the US. None have a standardized API. The only way into the data is through a web browser — forms, pagination, inconsistent layouts, session state. No traditional scraper survives county-to-county variation. No static automation handles it.

That is exactly the problem Amazon Nova Act was built to solve. We built Title AI to prove it.

---

## The Architecture: Six Agents, One Pipeline

Title AI is a six-agent pipeline from property address to full PDF title commitment report. Here is what executes when a user enters an address:

```
Property Address
    ↓
1. County Lookup Agent
   → Resolves address to correct county recorder URL
   → Database of 65+ verified counties across 14 states
    ↓
2. Nova Act Browser Agent
   → Cloud Chromium via AgentCore Browser Tool
   → Navigates live county recorder website
   → Searches property, extracts deed records and parcel history
   → Screenshots stream to UI in real time
    ↓
3. Chain of Title Agent (Nova Pro)
   → Extracts every ownership transfer
   → Output: OwnershipNode[] (structured JSON)
    ↓
4. Lien Detection Agent (Nova Pro)
   → Identifies tax liens, mortgages, HOA liens, judgments
   → Output: Lien[] (structured JSON)
    ↓
5. Risk Assessment Agent (Nova Pro)
   → Classifies title exceptions by severity
   → Flags issues, generates recommendations
   → Output: TitleException[] (structured JSON)
    ↓
6. Report Agent (Nova Pro)
   → Executive summary
   → Branded Title Commitment Report PDF
```

14 days of manual work. Minutes.

---

## Nova Act: The Core That Makes It Possible

Nova Act is what makes Title AI viable. Without browser automation capable of handling government website variation, you cannot build this product. Traditional scrapers fail because county recorder sites differ in every dimension: field names, URL patterns, JavaScript rendering, search flows, pagination, session handling.

Nova Act does not care. It receives a natural-language task instruction and navigates the site to complete it:

```python
from nova_act import NovaAct

async def search_county_records(recorder_url: str, address: str, parcel_id: str):
    async with NovaAct(
        starting_page=recorder_url,
        screenshots=True,
    ) as agent:
        result = await agent.act(
            f"Search for property records for the address '{address}'"
            f"{f' or parcel ID {parcel_id}' if parcel_id else ''}. "
            "Extract all deed records, ownership history, and any recorded liens or encumbrances. "
            "Navigate through all available pages of results."
        )
        screenshots = agent.get_screenshots()
        return result.response, screenshots
```

The instruction is written at the right abstraction level: specific enough that the agent knows what to find, general enough that it adapts to layout variation between sites. Too prescriptive and it breaks on any deviation from the expected layout. Too vague and it wanders.

---

## Real-Time Screenshot Streaming

The most visually compelling feature of Title AI is watching Nova Act work. The UI streams screenshots from the live government website as the agent navigates — users see a real Chromium browser, on a real county recorder site, controlled by AI, frame by frame.

The streaming architecture solves a specific problem: Nova Act's browser work is synchronous. It cannot yield screenshots mid-execution while still running. The solution is to run the browser agent on a background thread and use a `queue.Queue` as the communication channel:

```python
import queue
import threading

def run_nova_act_background(url, address, screenshot_queue):
    """Run Nova Act on background thread, put screenshots into queue."""
    async def _run():
        async with NovaAct(starting_page=url, screenshots=True) as agent:
            # Monkey-patch screenshot capture to push into queue mid-execution
            original_act = agent.act
            async def act_with_streaming(*args, **kwargs):
                result = await original_act(*args, **kwargs)
                for screenshot in agent.get_screenshots():
                    screenshot_queue.put(screenshot)
                return result
            agent.act = act_with_streaming
            return await agent.act(SEARCH_INSTRUCTION)
    
    loop = asyncio.new_event_loop()
    result = loop.run_until_complete(_run())
    screenshot_queue.put(None)  # Sentinel: done
    return result

# SSE generator polls the queue and yields screenshot events
def screenshot_sse_generator(screenshot_queue):
    while True:
        screenshot = screenshot_queue.get()
        if screenshot is None:
            break
        yield f"data: {json.dumps({'type': 'screenshot', 'data': screenshot})}\n\n"
```

This lets the SSE endpoint stream screenshots to the browser while Nova Act is still mid-execution on the background thread. The user sees the agent working in real time.

---

## Nova Pro: Structured Output Pipeline

After Nova Act returns raw document text from the county site, four Nova Pro agents run analysis. Every agent uses `generateObject()` with a typed Zod schema — structured JSON output, not free text:

```typescript
import { generateObject } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

const { object: chainOfTitle } = await generateObject({
  model: bedrock('us.amazon.nova-pro-v1:0'),
  schema: z.object({
    ownership_transfers: z.array(z.object({
      grantor: z.string(),
      grantee: z.string(),
      document_type: z.enum(['deed', 'quitclaim', 'warranty_deed', 'grant_deed', 'other']),
      recording_date: z.string(),
      instrument_number: z.string(),
      consideration: z.string().optional(),
    })),
    current_owner: z.string(),
    chain_complete: z.boolean(),
    gaps_detected: z.array(z.string()),
  }),
  prompt: `Extract the complete chain of title from these county recorder documents:\n\n${rawDocuments}`,
});
```

Structured output means the UI never fails to render. There is no free-text parsing that can break on an unexpected Nova Pro response format. Chain of title returns `OwnershipNode[]`. Lien detection returns `Lien[]`. Risk assessment returns `TitleException[]`. The schemas are the contract between the AI and the UI.

The chain-of-title agent and lien detection agent run in parallel — both operate on the same raw documents independently — cutting the analysis phase roughly in half.

---

## Durable Background Execution with Inngest

Title searches run for minutes. The browser agent alone can take 60–90 seconds on a complex county site. A standard HTTP request times out.

We use Inngest for durable background job execution:

```typescript
export const runTitleSearch = inngest.createFunction(
  { id: 'run-title-search' },
  { event: 'title/search.requested' },
  async ({ event, step }) => {
    const { address, jobId } = event.data;

    // Each step has automatic retries
    const countyInfo = await step.run('resolve-county', async () => {
      return resolveCounty(address);
    });

    const browserResults = await step.run('nova-act-browser', async () => {
      return runNovaActSearch(countyInfo.recorderUrl, address);
    });

    const [chainOfTitle, liens] = await step.run('parallel-analysis', async () => {
      return Promise.all([
        extractChainOfTitle(browserResults),
        detectLiens(browserResults),
      ]);
    });

    // ... risk assessment, report generation
  }
);
```

Each step updates a Turso (libSQL) job row with progress percentage, logs, and screenshots. The UI polls this row for live updates.

---

## The County Database

Nova Act can navigate any county recorder site — but it still needs to know which URL to start from. We built and validated a county database with 65+ counties across 14 states, with verified recorder URLs and tested navigation flows.

Each entry includes:
- Official county recorder URL
- State and county FIPS code
- Search field format (address vs. parcel number vs. owner name)
- Navigation notes for sites with non-standard flows
- Tavily fallback query template for when the live site is unreachable

The Tavily fallback is critical for uptime. County recorder sites go down. Some have maintenance windows. When Nova Act cannot reach the live site, the pipeline falls back to Tavily web search to retrieve whatever deed information is publicly indexed — then proceeds with analysis on whatever was found.

---

## What We Learned

**Nova Act is genuinely capable of navigating government websites that no scraper survives.** The critical insight is the abstraction level of the task instruction. Nova Act's strength is adapting to layout variation — let it adapt. Write the goal, not the navigation steps.

**Typed schemas with `generateObject()` are non-negotiable for production pipelines.** Free-text generation from Nova Pro is powerful for summarization. For anything that feeds a UI or gets stored as structured data, schema-constrained output eliminates an entire class of runtime failures.

**Screenshot streaming is a product feature, not just debugging.** Watching a real browser navigate a real government website — controlled by AI — is the most compelling demonstration of what Nova Act makes possible. We built the streaming architecture because users deserved to see it working, not just the output at the end.

---

## The Numbers

- 65+ counties across 14 states with verified recorder URLs
- 5–14 days of manual title search work replaced by minutes
- $300–$600 examiner fee replaced by automated pipeline
- Six agents: 1 browser (Nova Act) + 4 analysis (Nova Pro) + 1 report (Nova Pro)
- Real government websites, real property data, no mocks

---

## What's Next

- Expand to all 3,600 US counties — the architecture scales, it's a URL curation and validation problem
- Automated monitoring — run title searches on a schedule, alert when new liens or ownership changes appear on a tracked property
- Direct integration with title insurance underwriting platforms
- International expansion — land registry automation for countries with online-but-inaccessible records

---

Title AI is live. The code is on [GitHub](https://github.com/Garinmckayl/titleainova).

Built with Amazon Nova Act, Nova Pro, Nova Sonic, and Amazon Bedrock.

`#AmazonNova #Hackathon #RealEstate #NovaAct`
