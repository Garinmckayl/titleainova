import { generateObject } from 'ai';
import { novaPro } from '@/lib/bedrock';
import { z } from 'zod';
import { OwnershipNode, Lien, TitleException } from './types';
import { RetrievedDocument } from './record-retrieval';

// Schemas for AI generation
const ownershipSchema = z.object({
  chain: z.array(z.object({
    grantor: z.string(),
    grantee: z.string(),
    date: z.string(),
    documentType: z.string(),
    recordingDate: z.string().optional(),
    documentNumber: z.string().optional(),
    notes: z.string().optional()
  }))
});

const lienSchema = z.object({
  liens: z.array(z.object({
    type: z.enum(['Tax', 'Mechanic', 'Judgment', 'HOA', 'Mortgage', 'Other']),
    claimant: z.string(),
    amount: z.string().optional(),
    dateRecorded: z.string(),
    status: z.enum(['Active', 'Released', 'Unknown']),
    priority: z.enum(['High', 'Medium', 'Low']).optional(),
    description: z.string().optional()
  }))
});

const exceptionSchema = z.object({
  exceptions: z.array(z.object({
    type: z.enum(['Fatal', 'Curable', 'Info']),
    description: z.string(),
    explanation: z.string(),
    remedy: z.string().optional()
  }))
});

export async function buildChainOfTitle(docs: RetrievedDocument[]): Promise<OwnershipNode[]> {
  if (docs.length === 0) return [];

  const context = docs.map(d => `Source: ${d.source}\nType: ${d.type}\nText: ${d.text.slice(0, 15000)}`).join('\n\n---\n\n');

  try {
    const { object } = await generateObject({
      model: novaPro,
      schema: ownershipSchema,
      prompt: `Analyze the following property documents and construct a chronological chain of title (ownership history). 
      Identify grantors, grantees, dates, and document types (Deed, Warranty Deed, Quitclaim, etc.).
      Sort from oldest to newest.
      
      Documents:
      ${context}`
    });

    return object.chain.map((node, i) => ({
      id: `node-${i}`,
      ...node
    }));
  } catch (e) {
    console.error('Chain of Title Agent failed:', e);
    return [];
  }
}

export async function detectLiens(docs: RetrievedDocument[], county: string): Promise<Lien[]> {
  if (docs.length === 0) return [];

  const context = docs.map(d => `Source: ${d.source}\nText: ${d.text.slice(0, 15000)}`).join('\n\n---\n\n');

  try {
    const { object } = await generateObject({
      model: novaPro,
      schema: lienSchema,
      prompt: `Analyze the following property documents for ${county} and identify any liens or encumbrances.
      Look for: Tax liens, Mechanic's liens, HOA liens, Mortgages/Deeds of Trust, Judgments.
      Determine if they appear Active or Released.
      
      Documents:
      ${context}`
    });

    return object.liens;
  } catch (e) {
    console.error('Lien Detection Agent failed:', e);
    return [];
  }
}

export async function assessRisk(chain: OwnershipNode[], liens: Lien[]): Promise<TitleException[]> {
  try {
    const { object } = await generateObject({
      model: novaPro,
      schema: exceptionSchema,
      prompt: `Analyze the ownership chain and active liens to identify title risks and exceptions.
      
      Chain of Title:
      ${JSON.stringify(chain, null, 2)}
      
      Liens:
      ${JSON.stringify(liens, null, 2)}
      
      Identify:
      1. Gaps in ownership (missing links).
      2. Active liens that need to be paid off (High priority).
      3. Breaks in chain or suspicious transfers.
      4. Unknown or unresolved items.`
    });

    return object.exceptions;
  } catch (e) {
    console.error('Risk Assessment Agent failed:', e);
    return [];
  }
}

export async function generateSummary(chain: OwnershipNode[], liens: Lien[], exceptions: TitleException[]): Promise<string> {
  try {
    const { generateText } = await import('ai');
    const { novaPro } = await import('@/lib/bedrock');
    const { text } = await generateText({
      model: novaPro,
      prompt: `Write a concise Executive Summary for a Preliminary Title Report based on:
      - ${chain.length} ownership transfers found.
      - ${liens.filter(l => l.status === 'Active').length} active liens.
      - ${exceptions.length} exceptions/risks identified.
      
      Summarize the current owner, major issues, and overall title cleanliness in 2-3 paragraphs.`
    });
    return text;
  } catch (e) {
    return "Summary generation failed.";
  }
}
