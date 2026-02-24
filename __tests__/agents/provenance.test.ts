/**
 * Tests for the provenance tracking and confidence scoring system.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCitation,
  computeConfidence,
  scoreOwnershipChain,
  scoreLiens,
  scoreExceptions,
  computeOverallConfidence,
  resetCitationCounter,
} from '@/lib/agents/title-search/provenance';
import type { OwnershipNode, Lien, TitleException, SourceCitation } from '@/lib/agents/title-search/types';

beforeEach(() => {
  resetCitationCounter();
});

describe('createCitation', () => {
  it('creates a citation with required fields', () => {
    const citation = createCitation('nova_act', 'Harris County Clerk', 'https://cclerk.hctx.net/');
    expect(citation.id).toMatch(/^src-/);
    expect(citation.sourceType).toBe('nova_act');
    expect(citation.sourceName).toBe('Harris County Clerk');
    expect(citation.url).toBe('https://cclerk.hctx.net/');
    expect(citation.retrievedAt).toBeTruthy();
  });

  it('includes optional fields when provided', () => {
    const citation = createCitation('tavily_search', 'Web Result', 'https://example.com', {
      excerpt: 'WARRANTY DEED dated 2020-01-15...',
      documentType: 'Warranty Deed',
      instrumentNumber: 'DOC-2020-12345',
    });
    expect(citation.excerpt).toBe('WARRANTY DEED dated 2020-01-15...');
    expect(citation.documentType).toBe('Warranty Deed');
    expect(citation.instrumentNumber).toBe('DOC-2020-12345');
  });

  it('truncates excerpt to 500 chars', () => {
    const longExcerpt = 'A'.repeat(600);
    const citation = createCitation('web_scrape', 'Test', 'https://test.com', { excerpt: longExcerpt });
    expect(citation.excerpt!.length).toBe(500);
  });

  it('generates unique IDs', () => {
    const c1 = createCitation('nova_act', 'A', 'https://a.com');
    const c2 = createCitation('nova_act', 'B', 'https://b.com');
    expect(c1.id).not.toBe(c2.id);
  });
});

describe('computeConfidence', () => {
  it('scores nova_act sources as high confidence', () => {
    const score = computeConfidence('nova_act', ['src-1']);
    expect(score.level).toBe('high');
    expect(score.score).toBeGreaterThanOrEqual(75);
    expect(score.citations).toEqual(['src-1']);
  });

  it('scores tavily_search as medium confidence', () => {
    const score = computeConfidence('tavily_search', ['src-1']);
    expect(score.level).toBe('medium');
    expect(score.score).toBeGreaterThanOrEqual(40);
    expect(score.score).toBeLessThan(75);
  });

  it('scores mock_demo as unverified', () => {
    const score = computeConfidence('mock_demo', ['src-1']);
    expect(score.level).toBe('unverified');
    expect(score.score).toBeLessThan(20);
  });

  it('adds bonus for document number', () => {
    const without = computeConfidence('tavily_search', ['src-1']);
    const with_ = computeConfidence('tavily_search', ['src-1'], { hasDocumentNumber: true });
    expect(with_.score).toBeGreaterThan(without.score);
    expect(with_.factors).toContain('Document/instrument number present');
  });

  it('adds bonus for recording date', () => {
    const without = computeConfidence('tavily_search', ['src-1']);
    const with_ = computeConfidence('tavily_search', ['src-1'], { hasRecordingDate: true });
    expect(with_.score).toBeGreaterThan(without.score);
  });

  it('adds bonus for corroborated sources', () => {
    const single = computeConfidence('tavily_search', ['src-1']);
    const multiple = computeConfidence('tavily_search', ['src-1', 'src-2'], { corroboratedSources: 3 });
    expect(multiple.score).toBeGreaterThan(single.score);
  });

  it('reduces score for AI-generated content', () => {
    const human = computeConfidence('nova_act', ['src-1']);
    const ai = computeConfidence('nova_act', ['src-1'], { isAIGenerated: true });
    expect(ai.score).toBeLessThan(human.score);
  });

  it('clamps score between 0 and 100', () => {
    const maxed = computeConfidence('nova_act', ['src-1'], {
      hasDocumentNumber: true,
      hasRecordingDate: true,
      corroboratedSources: 10,
    });
    expect(maxed.score).toBeLessThanOrEqual(100);

    const mocked = computeConfidence('mock_demo', ['src-1'], { isAIGenerated: true });
    expect(mocked.score).toBeGreaterThanOrEqual(0);
  });
});

describe('scoreOwnershipChain', () => {
  it('attaches confidence to each node', () => {
    const chain: OwnershipNode[] = [
      { id: 'n1', grantor: 'Alice', grantee: 'Bob', date: '2020-01-01', documentType: 'Warranty Deed', documentNumber: 'DOC-001' },
      { id: 'n2', grantor: 'Bob', grantee: 'Charlie', date: '2022-06-15', documentType: 'Grant Deed' },
    ];
    const citations: SourceCitation[] = [
      createCitation('nova_act', 'County Records', 'https://county.gov'),
    ];

    const scored = scoreOwnershipChain(chain, 'nova_act', citations);
    expect(scored).toHaveLength(2);
    expect(scored[0].confidence).toBeDefined();
    expect(scored[0].confidence!.level).toBe('high'); // nova_act + document number
    expect(scored[1].confidence).toBeDefined();
  });
});

describe('scoreLiens', () => {
  it('attaches confidence to each lien', () => {
    const liens: Lien[] = [
      { type: 'Mortgage', claimant: 'Bank', dateRecorded: '2020-01-01', status: 'Active', documentNumber: 'MORT-001' },
      { type: 'Tax', claimant: 'IRS', dateRecorded: 'Unknown', status: 'Unknown' },
    ];
    const citations: SourceCitation[] = [
      createCitation('tavily_search', 'Web Search', 'https://search.com'),
    ];

    const scored = scoreLiens(liens, 'tavily_search', citations);
    expect(scored).toHaveLength(2);
    expect(scored[0].confidence).toBeDefined();
    // First lien has doc number and recording date — higher confidence
    expect(scored[0].confidence!.score).toBeGreaterThan(scored[1].confidence!.score);
  });
});

describe('computeOverallConfidence', () => {
  it('computes average confidence across all data points', () => {
    const chain: OwnershipNode[] = [
      { id: 'n1', grantor: 'A', grantee: 'B', date: '2020', documentType: 'Deed', confidence: { level: 'high', score: 90, factors: [], citations: [] } },
    ];
    const liens: Lien[] = [
      { type: 'Mortgage', claimant: 'Bank', dateRecorded: '2020', status: 'Active', confidence: { level: 'medium', score: 60, factors: [], citations: [] } },
    ];
    const exceptions: TitleException[] = [];
    const citations: SourceCitation[] = [createCitation('nova_act', 'Test', 'https://test.com')];

    const overall = computeOverallConfidence(chain, liens, exceptions, 'nova_act', citations);
    expect(overall.score).toBe(75); // (90 + 60) / 2
    expect(overall.level).toBe('high');
  });

  it('falls back to source-based score when no individual scores exist', () => {
    const overall = computeOverallConfidence([], [], [], 'mock_demo', []);
    expect(overall.level).toBe('unverified');
  });
});
