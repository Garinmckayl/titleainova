/**
 * Tests for the county lookup and property-lookup module.
 */
import { describe, it, expect } from 'vitest';
import { lookupCounty, getAllCounties } from '@/lib/agents/title-search/property-lookup';

describe('lookupCounty', () => {
  it('finds county by city name', () => {
    const result = lookupCounty('1400 Smith St, Houston, TX 77002');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Harris County');
    expect(result!.state).toBe('TX');
  });

  it('finds county by county name in address', () => {
    const result = lookupCounty('123 Main St, Harris County, TX');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Harris County');
  });

  it('handles California addresses', () => {
    const result = lookupCounty('350 S Grand Ave, Los Angeles, CA 90071');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Los Angeles County');
    expect(result!.state).toBe('CA');
  });

  it('handles Florida addresses', () => {
    const result = lookupCounty('100 Biscayne Blvd, Miami, FL 33132');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Miami-Dade County');
  });

  it('handles New York addresses', () => {
    const result = lookupCounty('350 5th Ave, New York, NY 10118');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('New York County');
  });

  it('returns null for unknown addresses', () => {
    // Use a string with no substring matching any city or county name
    const result = lookupCounty('99 Zzyzx Rd, Zzyzx, ZZ 00000');
    expect(result).toBeNull();
  });

  it('handles various Texas cities', () => {
    expect(lookupCounty('100 Main St, Dallas, TX 75201')!.name).toBe('Dallas County');
    expect(lookupCounty('100 Main St, Austin, TX 78701')!.name).toBe('Travis County');
    expect(lookupCounty('100 Main St, San Antonio, TX 78201')!.name).toBe('Bexar County');
    expect(lookupCounty('100 Main St, Plano, TX 75024')!.name).toBe('Collin County');
  });

  it('is case-insensitive', () => {
    const result = lookupCounty('100 MAIN ST, HOUSTON, TX 77002');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Harris County');
  });

  // Expansion county tests
  it('finds expanded counties', () => {
    const result = lookupCounty('100 Main St, Jacksonville, FL 32202');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Duval County');
  });

  it('finds expanded cities', () => {
    expect(lookupCounty('100 Main St, Colorado Springs, CO 80901')!.name).toBe('El Paso County CO');
    expect(lookupCounty('100 Main St, Spokane, WA 99201')!.name).toBe('Spokane County');
    expect(lookupCounty('100 Main St, Grand Rapids, MI 49503')!.name).toBe('Kent County MI');
  });

  it('falls back to state matching via zip code pattern', () => {
    // Address with TX state code but no matching city
    const result = lookupCounty('999 Unknown St, Tinyville, tx 77777');
    expect(result).not.toBeNull();
    expect(result!.state).toBe('TX');
  });
});

describe('getAllCounties', () => {
  it('returns more than 65 counties (original DB)', () => {
    const counties = getAllCounties();
    expect(counties.length).toBeGreaterThan(65);
  });

  it('includes expansion counties', () => {
    const counties = getAllCounties();
    const duval = counties.find(c => c.name === 'Duval County');
    expect(duval).toBeDefined();
    expect(duval!.state).toBe('FL');
  });

  it('all counties have required fields', () => {
    const counties = getAllCounties();
    for (const c of counties) {
      expect(c.name).toBeTruthy();
      expect(c.state).toBeTruthy();
      expect(c.recorderUrl).toBeTruthy();
      expect(c.searchUrl).toBeTruthy();
    }
  });

  it('has no duplicate county names', () => {
    const counties = getAllCounties();
    const names = counties.map(c => `${c.name}-${c.state}`);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
