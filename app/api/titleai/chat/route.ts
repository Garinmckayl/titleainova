import { streamText, convertToModelMessages } from "ai";
import { novaPro } from "@/lib/bedrock";

export const runtime = "edge";

const TITLE_AI_SYSTEM = `You are a Title AI assistant powered by Amazon Nova Pro. You help users understand property titles, ownership history, liens, and title issues.

Your capabilities:
- Explain property title concepts
- Analyze ownership chains
- Identify potential title issues
- Explain lien types and priorities
- Provide guidance on title insurance
- Answer questions about property records

Always:
- Show your reasoning process
- Cite relevant property law when applicable
- Explain complex title concepts clearly
- Suggest when professional title examination is needed
- Be thorough but concise

You have access to multi-agent title research capabilities including:
- Property lookup agents
- Document retrieval agents
- Chain of title analysis
- Lien detection
- Risk assessment`;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: novaPro,
    system: TITLE_AI_SYSTEM,
    messages: await convertToModelMessages(messages),
    temperature: 0.3,
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'title-ai-chat',
    },
  });

  return result.toUIMessageStreamResponse();
}
