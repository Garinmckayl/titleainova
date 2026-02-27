import { generateObject, generateText } from 'ai';
import { novaPro } from '@/lib/bedrock';
import { z } from 'zod';
import { OwnershipNode, Lien, TitleException, DataSourceType } from './types';
import { RetrievedDocument } from './record-retrieval';
import {
  createCitation,
  scoreOwnershipChain,
  scoreLiens,
  scoreExceptions,
} from './provenance';
import { buildScheduleA, buildScheduleB } from './alta-compliance';

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const ownershipSchema = z.object({
  chain: z.array(z.object({
    grantor: z.string().describe('Person or entity transferring ownership'),
    grantee: z.string().describe('Person or entity receiving ownership'),
    date: z.string().describe('Date of transfer (YYYY-MM-DD or human readable)'),
    documentType: z.string().describe('e.g. Warranty Deed, Grant Deed, Quitclaim Deed, Deed of Trust'),
    recordingDate: z.string().optional().describe('Date recorded at county recorder'),
    documentNumber: z.string().optional().describe('County instrument/document number'),
    bookPage: z.string().optional().describe('Book and page reference if applicable'),
    notes: z.string().optional().describe('Any relevant notes about this transfer'),
  })).describe('Chronological ownership history, oldest first'),
});

const lienSchema = z.object({
  liens: z.array(z.object({
    type: z.enum(['Tax', 'Mechanic', 'Judgment', 'HOA', 'Mortgage', 'Federal Tax', 'IRS', 'Child Support', 'Other']),
    claimant: z.string().describe('Name of lienholder or taxing authority'),
    amount: z.string().optional().describe('Dollar amount of lien if shown'),
    dateRecorded: z.string().describe('Date lien was recorded'),
    status: z.enum(['Active', 'Released', 'Pending', 'Unknown']),
    priority: z.enum(['High', 'Medium', 'Low']).optional(),
    documentNumber: z.string().optional(),
    description: z.string().optional().describe('Brief description of the lien'),
  })),
});

const exceptionSchema = z.object({
  exceptions: z.array(z.object({
    type: z.enum(['Fatal', 'Curable', 'Info']).describe(
      'Fatal = blocks title insurance; Curable = can be resolved; Info = informational only'
    ),
    description: z.string().describe('Short title of the exception'),
    explanation: z.string().describe('Detailed explanation of the issue'),
    remedy: z.string().optional().describe('How to cure this exception if applicable'),
    urgency: z.enum(['Immediate', 'Before Closing', 'Post-Closing', 'N/A']).optional(),
  })),
});

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function buildChainOfTitle(docs: RetrievedDocument[]): Promise<OwnershipNode[]> {
  if (docs.length === 0) return [];

  const context = docs
    .map(d => `[Source: ${d.source}]\n[Type: ${d.type}]\n${d.text.slice(0, 12000)}`)
    .join('\n\n---\n\n');

  try {
    const { object } = await generateObject({
      model: novaPro,
      schema: ownershipSchema,
      prompt: `You are a professional title examiner. Analyze the property documents below and construct a complete, chronological chain of title (ownership history).

Instructions:
- Extract every ownership transfer: deeds, grants, quitclaims, trustee sales, foreclosures, probate transfers
- Include both grantors (sellers/transferors) and grantees (buyers/recipients)
- Use exact names as they appear in the documents
- Sort from OLDEST to NEWEST
- Include document/instrument numbers and recording dates when available
- For Deeds of Trust, list the lender as grantor and borrower as grantee
- If the documents mention a foreclosure or trustee sale, include it
- Leave fields empty if data not available — do NOT fabricate

Property Documents:
${context}`,
    });

    return object.chain.map((node, i) => ({
      id: `node-${i}`,
      ...node,
    }));
  } catch (e) {
    console.error('Chain of Title Agent failed:', e instanceof Error ? e.message : e);
    console.error('Chain of Title Agent stack:', e instanceof Error ? e.stack : '');
    return [];
  }
}

export async function detectLiens(docs: RetrievedDocument[], county: string): Promise<Lien[]> {
  if (docs.length === 0) return [];

  const context = docs
    .map(d => `[Source: ${d.source}]\n${d.text.slice(0, 12000)}`)
    .join('\n\n---\n\n');

  try {
    const { object } = await generateObject({
      model: novaPro,
      schema: lienSchema,
      prompt: `You are a professional title examiner specializing in lien detection. Analyze the property documents for ${county} and identify ALL liens and encumbrances.

Search for:
- Tax liens (county, city, state, IRS federal tax liens)
- Mechanic's liens / contractor liens / materialman's liens
- HOA (Homeowners Association) assessments and liens
- Mortgage / Deed of Trust (first and second mortgages)
- Judgment liens (court-ordered, child support, etc.)
- Lis pendens (notice of pending litigation)
- Environmental liens
- Any other encumbrance recorded against the property

For each lien, determine status:
- Active: currently outstanding, not released
- Released: lien released or satisfaction recorded
- Unknown: status unclear from available documents

Documents:
${context}`,
    });

    return object.liens;
  } catch (e) {
    console.error('Lien Detection Agent failed:', e instanceof Error ? e.message : e);
    console.error('Lien Detection stack:', e instanceof Error ? e.stack : '');
    return [];
  }
}

export async function assessRisk(chain: OwnershipNode[], liens: Lien[]): Promise<TitleException[]> {
  const activeLiens = liens.filter(l => l.status === 'Active');

  try {
    const { object } = await generateObject({
      model: novaPro,
      schema: exceptionSchema,
      prompt: `You are a senior title attorney. Analyze the ownership chain and liens to identify title exceptions and risks for a title commitment report.

Ownership Chain (${chain.length} transfers):
${JSON.stringify(chain, null, 2)}

Active Liens (${activeLiens.length} of ${liens.length} total):
${JSON.stringify(activeLiens, null, 2)}

Examine for:
1. GAPS in chain of title — periods where ownership is unclear or missing
2. BREAKS — transfers that seem irregular (large time gaps, missing intermediate owners)
3. ACTIVE LIENS — any outstanding mortgage, tax lien, HOA, judgment (Fatal or Curable)
4. FORGED or SUSPICIOUS instruments — unusual transfers, same-day flips
5. MISSING RELEASES — paid-off mortgages where release not recorded
6. EASEMENTS or RESTRICTIONS mentioned in deeds
7. PROBATE ISSUES — transfers from estates without proper probate
8. FORECLOSURE issues — defective foreclosure procedures

Classify each exception:
- Fatal: Cannot be cured without court action or title insurance exclusion
- Curable: Can be fixed before or at closing (pay off lien, record affidavit, etc.)
- Info: Informational only, not a defect

Be specific and actionable. If chain is clean, note that as Info.`,
    });

    return object.exceptions;
  } catch (e) {
    console.error('Risk Assessment Agent failed:', e instanceof Error ? e.message : e);
    console.error('Risk Assessment stack:', e instanceof Error ? e.stack : '');
    return [];
  }
}

export async function generateSummary(
  chain: OwnershipNode[],
  liens: Lien[],
  exceptions: TitleException[]
): Promise<string> {
  const activeLiens = liens.filter(l => l.status === 'Active');
  const fatalExceptions = exceptions.filter(e => e.type === 'Fatal');
  const curableExceptions = exceptions.filter(e => e.type === 'Curable');
  const currentOwner = chain.length > 0 ? chain[chain.length - 1].grantee : 'Unknown';
  const firstTransfer = chain.length > 0 ? chain[0].date : 'Unknown';

  try {
    const { text } = await generateText({
      model: novaPro,
      prompt: `Write a professional Executive Summary for a Preliminary Title Report. Use plain English — this will be read by real estate attorneys and buyers.

Data:
- Current Owner: ${currentOwner}
- Chain of Title: ${chain.length} recorded transfers (oldest: ${firstTransfer}, most recent: ${chain[chain.length - 1]?.date || 'unknown'})
- Total Liens Found: ${liens.length} (${activeLiens.length} active, ${liens.length - activeLiens.length} released)
- Title Exceptions: ${exceptions.length} total (${fatalExceptions.length} fatal, ${curableExceptions.length} curable)

Write 2-3 concise paragraphs covering:
1. Overview of ownership history and current vesting
2. Summary of active encumbrances and their risk level
3. Overall title condition and recommended next steps

Tone: Professional title examiner. Do not use filler phrases. Be direct and specific.`,
    });
    return text;
  } catch (e) {
    return `Title examination complete. ${chain.length} ownership transfers identified. ${activeLiens.length} active liens found. ${exceptions.length} title exceptions noted. Please review the detailed findings below.`;
  }
}

// ─── Enhanced Pipeline with Provenance + ALTA ────────────────────────────────

/**
 * Run the full analysis pipeline with provenance tracking and ALTA compliance.
 * This replaces calling the individual functions separately.
 */
export async function runAnalysisPipeline(
  docs: RetrievedDocument[],
  address: string,
  county: string,
  sourceType: DataSourceType,
  opts?: {
    parcelId?: string | null;
    legalDescription?: string | null;
    preExtractedChain?: OwnershipNode[];
    preExtractedLiens?: Lien[];
  }
) {
  // Create source citations from documents
  const citations = docs.map(d =>
    createCitation(sourceType, d.source, d.url, {
      excerpt: d.text.slice(0, 500),
      documentType: d.type,
    })
  );

  // Run AI analysis
  const rawChain = opts?.preExtractedChain?.length ? opts.preExtractedChain : await buildChainOfTitle(docs);
  const rawLiens = opts?.preExtractedLiens?.length ? opts.preExtractedLiens : await detectLiens(docs, county);
  const rawExceptions = await assessRisk(rawChain, rawLiens);
  const summary = await generateSummary(rawChain, rawLiens, rawExceptions);

  // Attach confidence scores
  const chain = scoreOwnershipChain(rawChain, sourceType, citations);
  const liens = scoreLiens(rawLiens, sourceType, citations);
  const exceptions = scoreExceptions(rawExceptions, sourceType, citations);

  // Build ALTA schedules
  const altaScheduleA = buildScheduleA(
    address, county, opts?.legalDescription, chain, new Date().toLocaleDateString()
  );
  const altaScheduleB = buildScheduleB(chain, liens, exceptions);

  return {
    chain,
    liens,
    exceptions,
    summary,
    citations,
    altaScheduleA,
    altaScheduleB,
  };
}
