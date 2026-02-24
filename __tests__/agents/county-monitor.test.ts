/**
 * Tests for the county health monitoring system.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeCoverageGaps,
  EXPANSION_COUNTIES,
  EXPANSION_CITY_MAP,
} from '@/lib/agents/title-search/county-monitor';

describe('EXPANSION_COUNTIES', () => {
  it('has valid structure for all entries', () => {
    for (const county of EXPANSION_COUNTIES) {
      expect(county.name).toBeTruthy();
      expect(county.state).toMatch(/^[A-Z]{2}$/);
      expect(county.recorderUrl).toMatch(/^https?:\/\//);
      expect(county.searchUrl).toMatch(/^https?:\/\//);
    }
  });

  it('has at least 30 expansion counties', () => {
    expect(EXPANSION_COUNTIES.length).toBeGreaterThanOrEqual(30);
  });
});

describe('EXPANSION_CITY_MAP', () => {
  it('maps cities to valid county names', () => {
    const countyNames = new Set(EXPANSION_COUNTIES.map(c => c.name));
    for (const [city, county] of Object.entries(EXPANSION_CITY_MAP)) {
      expect(city).toBeTruthy();
      expect(countyNames.has(county)).toBe(true);
    }
  });
});

describe('analyzeCoverageGaps', () => {
  it('returns coverage analysis for all tracked states', () => {
    const covered = [
      { name: 'Harris County', state: 'TX' },
      { name: 'Dallas County', state: 'TX' },
      { name: 'Los Angeles County', state: 'CA' },
    ];

    const gaps = analyzeCoverageGaps(covered);
    expect(gaps.length).toBeGreaterThan(0);

    const txGap = gaps.find(g => g.state === 'TX');
    expect(txGap).toBeDefined();
    expect(txGap!.coveredCounties).toBe(2);
    expect(txGap!.totalCounties).toBe(254);
    expect(txGap!.coveragePercent).toBe(1);
  });

  it('marks states with partial coverage as high priority', () => {
    const covered = [
      { name: 'Harris County', state: 'TX' },
    ];

    const gaps = analyzeCoverageGaps(covered);
    const txGap = gaps.find(g => g.state === 'TX');
    expect(txGap!.priority).toBe('high'); // 1/254 = <1% coverage
  });

  it('returns zero coverage for uncovered states', () => {
    const gaps = analyzeCoverageGaps([]);
    for (const gap of gaps) {
      expect(gap.coveredCounties).toBe(0);
      expect(gap.coveragePercent).toBe(0);
    }
  });

  it('sorts results by priority', () => {
    const covered = [
      { name: 'Harris County', state: 'TX' },
      // No CA coverage
    ];

    const gaps = analyzeCoverageGaps(covered);
    // High priority should come first
    const priorities = gaps.map(g => g.priority);
    const highIdx = priorities.indexOf('high');
    const lowIdx = priorities.lastIndexOf('low');
    if (highIdx >= 0 && lowIdx >= 0) {
      expect(highIdx).toBeLessThan(lowIdx);
    }
  });
});
