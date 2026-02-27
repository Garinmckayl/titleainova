/**
 * Source provenance tracking and confidence scoring.
 *
 * Every data point in a title report must trace back to its source.
 * This module creates citations and computes confidence scores
 * based on data source type, corroboration, and document specificity.
 */

import {
  SourceCitation,
  ConfidenceScore,
  ConfidenceLevel,
  DataSourceType,
  OwnershipNode,
  Lien,
  TitleException,
} from './types';

let _citationCounter = 0;

/** Generate a unique citation ID */
function nextCitationId(): string {
  return `src-${++_citationCounter}-${Date.now().toString(36)}`;
}

/** Reset counter (for testing) */
export function resetCitationCounter(): void {
  _citationCounter = 0;
}

/**
 * Create a source citation for a retrieved document.
 */
export function createCitation(
  sourceType: DataSourceType,
  sourceName: string,
  url: string,
  opts?: {
    excerpt?: string;
    documentType?: string;
    instrumentNumber?: string;
  }
): SourceCitation {
  return {
    id: nextCitationId(),
    sourceType,
    sourceName,
    url,
    retrievedAt: new Date().toISOString(),
    excerpt: opts?.excerpt?.slice(0, 500),
    documentType: opts?.documentType,
    instrumentNumber: opts?.instrumentNumber,
  };
}

/**
 * Compute a confidence score based on the data source and available evidence.
 *
 * Scoring rubric:
 *   - nova_act (official county recorder):     80-95
 *   - county_records (county tax office):      75-90
 *   - tavily_search / llmlayer_search (web):   40-70
 *   - web_scrape (direct page scrape):         50-75
 *   - manual_entry (user provided):            60-80
 *   - mock_demo (demonstration data):          0-10
 *
 * Bonuses:
 *   +10 if document number present
 *   +5  if recording date present
 *   +5  if corroborated by multiple sources
 *   -20 if data source is mock
 */
export function computeConfidence(
  sourceType: DataSourceType,
  citationIds: string[],
  opts?: {
    hasDocumentNumber?: boolean;
    hasRecordingDate?: boolean;
    corroboratedSources?: number;
    isAIGenerated?: boolean;
  }
): ConfidenceScore {
  const factors: string[] = [];
  let score = 0;

  // Base score by source type
  switch (sourceType) {
    case 'nova_act':
      score = 85;
      factors.push('Official county recorder accessed via browser agent');
      break;
    case 'county_records':
      score = 80;
      factors.push('County tax office records (direct query)');
      break;
    case 'web_scrape':
      score = 60;
      factors.push('Direct web page scraping');
      break;
    case 'llmlayer_search':
      score = 50;
      factors.push('Web search result (LLMLayer)');
      break;
    case 'tavily_search':
      score = 50;
      factors.push('Web search result (indirect source)');
      break;
    case 'manual_entry':
      score = 70;
      factors.push('Manually entered data');
      break;
    case 'mock_demo':
      score = 5;
      factors.push('Demonstration/mock data — not from real records');
      break;
  }

  // Bonuses
  if (opts?.hasDocumentNumber) {
    score += 10;
    factors.push('Document/instrument number present');
  }
  if (opts?.hasRecordingDate) {
    score += 5;
    factors.push('Official recording date available');
  }
  if (opts?.corroboratedSources && opts.corroboratedSources > 1) {
    score += Math.min(opts.corroboratedSources * 3, 10);
    factors.push(`Corroborated by ${opts.corroboratedSources} sources`);
  }
  if (opts?.isAIGenerated) {
    score -= 10;
    factors.push('AI-extracted (may contain interpretation errors)');
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Map to level
  let level: ConfidenceLevel;
  if (score >= 75) level = 'high';
  else if (score >= 50) level = 'medium';
  else if (score >= 20) level = 'low';
  else level = 'unverified';

  return { level, score, factors, citations: citationIds };
}

/**
 * Attach confidence scores to ownership chain nodes based on their source.
 */
export function scoreOwnershipChain(
  chain: OwnershipNode[],
  sourceType: DataSourceType,
  citations: SourceCitation[]
): OwnershipNode[] {
  const citationIds = citations.map(c => c.id);

  return chain.map(node => ({
    ...node,
    confidence: computeConfidence(sourceType, citationIds, {
      hasDocumentNumber: !!node.documentNumber,
      hasRecordingDate: !!node.recordingDate,
      isAIGenerated: sourceType !== 'manual_entry',
    }),
  }));
}

/**
 * Attach confidence scores to liens based on their source.
 */
export function scoreLiens(
  liens: Lien[],
  sourceType: DataSourceType,
  citations: SourceCitation[]
): Lien[] {
  const citationIds = citations.map(c => c.id);

  return liens.map(lien => ({
    ...lien,
    confidence: computeConfidence(sourceType, citationIds, {
      hasDocumentNumber: !!lien.documentNumber,
      hasRecordingDate: !!lien.dateRecorded && lien.dateRecorded !== 'Unknown',
      isAIGenerated: sourceType !== 'manual_entry',
    }),
  }));
}

/**
 * Attach confidence scores to exceptions based on their source.
 */
export function scoreExceptions(
  exceptions: TitleException[],
  sourceType: DataSourceType,
  citations: SourceCitation[]
): TitleException[] {
  const citationIds = citations.map(c => c.id);

  return exceptions.map(ex => ({
    ...ex,
    confidence: computeConfidence(sourceType, citationIds, {
      isAIGenerated: true, // Risk assessment is always AI-generated
    }),
  }));
}

/**
 * Compute an overall report confidence score from all individual scores.
 */
export function computeOverallConfidence(
  chain: OwnershipNode[],
  liens: Lien[],
  exceptions: TitleException[],
  sourceType: DataSourceType,
  citations: SourceCitation[]
): ConfidenceScore {
  const allScores: number[] = [];

  for (const node of chain) {
    if (node.confidence) allScores.push(node.confidence.score);
  }
  for (const lien of liens) {
    if (lien.confidence) allScores.push(lien.confidence.score);
  }
  for (const ex of exceptions) {
    if (ex.confidence) allScores.push(ex.confidence.score);
  }

  if (allScores.length === 0) {
    return computeConfidence(sourceType, citations.map(c => c.id));
  }

  const avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
  const minScore = Math.min(...allScores);

  const factors: string[] = [
    `Average confidence across ${allScores.length} data points: ${avgScore}%`,
    `Lowest individual confidence: ${minScore}%`,
  ];

  if (sourceType === 'mock_demo') {
    factors.push('WARNING: Report based on demonstration data, not real records');
  }

  let level: ConfidenceLevel;
  if (avgScore >= 75) level = 'high';
  else if (avgScore >= 50) level = 'medium';
  else if (avgScore >= 20) level = 'low';
  else level = 'unverified';

  return {
    level,
    score: avgScore,
    factors,
    citations: citations.map(c => c.id),
  };
}
