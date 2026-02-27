/**
 * County health monitoring and coverage expansion framework.
 *
 * Provides tools to:
 * 1. Check if county recorder websites are online and responsive
 * 2. Detect structural changes that would break scraping
 * 3. Track success/failure rates per county
 * 4. Identify coverage gaps for expansion
 */

import { CountyHealthStatus } from './types';

// ─── In-Memory Health Cache ─────────────────────────────────────────────────
// In production, this would be backed by a database table.

const healthCache = new Map<string, CountyHealthStatus>();

/**
 * Check the health of a county recorder website.
 * Returns whether the site is reachable and responsive.
 */
export async function checkCountyHealth(
  countyName: string,
  state: string,
  recorderUrl: string
): Promise<CountyHealthStatus> {
  const cacheKey = `${countyName}-${state}`;
  const existing = healthCache.get(cacheKey);

  // Don't re-check within 5 minutes
  if (existing && Date.now() - new Date(existing.lastChecked).getTime() < 5 * 60 * 1000) {
    return existing;
  }

  const startTime = Date.now();
  let isOnline = false;
  let responseTimeMs = 0;
  let structureChanged = false;
  let notes: string | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(recorderUrl, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TitleAI-Monitor/1.0)' },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);
    responseTimeMs = Date.now() - startTime;
    isOnline = res.ok || res.status === 403; // 403 often means the site is up but blocking bots

    if (res.status === 301 || res.status === 302) {
      structureChanged = true;
      notes = `Redirecting to: ${res.headers.get('location')}`;
    }
  } catch (err: any) {
    responseTimeMs = Date.now() - startTime;
    isOnline = false;
    notes = err.message || 'Connection failed';
  }

  const status: CountyHealthStatus = {
    countyName,
    state,
    recorderUrl,
    lastChecked: new Date().toISOString(),
    isOnline,
    responseTimeMs,
    failureCount: isOnline ? 0 : (existing?.failureCount ?? 0) + 1,
    structureChanged,
    lastSuccessfulSearch: isOnline
      ? new Date().toISOString()
      : existing?.lastSuccessfulSearch,
    notes,
  };

  healthCache.set(cacheKey, status);
  return status;
}

/**
 * Get all cached health statuses.
 */
export function getAllHealthStatuses(): CountyHealthStatus[] {
  return Array.from(healthCache.values());
}

/**
 * Run health checks on all counties in the database.
 * Returns a summary of results.
 */
export async function runFullHealthCheck(
  counties: Array<{ name: string; state: string; recorderUrl: string }>
): Promise<{
  total: number;
  online: number;
  offline: number;
  slow: number;
  structureChanged: number;
  results: CountyHealthStatus[];
}> {
  // Run in batches of 10 to avoid overwhelming networks
  const batchSize = 10;
  const results: CountyHealthStatus[] = [];

  for (let i = 0; i < counties.length; i += batchSize) {
    const batch = counties.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(c => checkCountyHealth(c.name, c.state, c.recorderUrl))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
  }

  return {
    total: results.length,
    online: results.filter(r => r.isOnline).length,
    offline: results.filter(r => !r.isOnline).length,
    slow: results.filter(r => r.responseTimeMs > 5000).length,
    structureChanged: results.filter(r => r.structureChanged).length,
    results,
  };
}

// ─── Coverage Gap Analysis ──────────────────────────────────────────────────

/**
 * US states and their approximate county counts, for coverage reporting.
 */
const US_STATE_COUNTY_COUNTS: Record<string, number> = {
  TX: 254, CA: 58, FL: 67, NY: 62, IL: 102, GA: 159, AZ: 15, WA: 39,
  CO: 64, NV: 17, NC: 100, OH: 88, MI: 83, MN: 87, PA: 67, TN: 95,
  MD: 24, VA: 95, MA: 14, OR: 36, SC: 46, NJ: 21,
};

/**
 * Analyze coverage gaps — which states have the most uncovered counties.
 */
export function analyzeCoverageGaps(
  coveredCounties: Array<{ name: string; state: string }>
): Array<{
  state: string;
  totalCounties: number;
  coveredCounties: number;
  coveragePercent: number;
  priority: 'high' | 'medium' | 'low';
}> {
  const byState = new Map<string, number>();
  for (const c of coveredCounties) {
    byState.set(c.state, (byState.get(c.state) ?? 0) + 1);
  }

  const gaps = Object.entries(US_STATE_COUNTY_COUNTS).map(([state, total]) => {
    const covered = byState.get(state) ?? 0;
    const pct = Math.round((covered / total) * 100);
    // High priority if we have some coverage but it's low — users expect it to work
    const priority = covered > 0 && pct < 20 ? 'high' as const
      : covered > 0 && pct < 50 ? 'medium' as const
      : 'low' as const;
    return { state, totalCounties: total, coveredCounties: covered, coveragePercent: pct, priority };
  });

  return gaps.sort((a, b) => {
    const pri = { high: 0, medium: 1, low: 2 };
    return pri[a.priority] - pri[b.priority] || b.coveredCounties - a.coveredCounties;
  });
}

// ─── Expanded County Database ───────────────────────────────────────────────

/**
 * Additional counties to expand coverage. These are high-population counties
 * not in the original database. Add to COUNTY_DB via property-lookup.ts.
 */
export const EXPANSION_COUNTIES = [
  // TEXAS — additional
  { name: 'El Paso County', state: 'TX', recorderUrl: 'https://www.epcounty.com/clerk/', searchUrl: 'https://elpaso.tx.publicsearch.us/' },
  { name: 'Hidalgo County', state: 'TX', recorderUrl: 'https://www.co.hidalgo.tx.us/150/County-Clerk', searchUrl: 'https://hidalgo.tx.publicsearch.us/' },
  { name: 'Nueces County', state: 'TX', recorderUrl: 'https://www.nuecesco.com/county-clerk', searchUrl: 'https://nueces.tx.publicsearch.us/' },
  { name: 'Bell County', state: 'TX', recorderUrl: 'https://www.bellcountytx.com/county_government/county_clerk/', searchUrl: 'https://bell.tx.publicsearch.us/' },
  { name: 'Brazoria County', state: 'TX', recorderUrl: 'https://www.brazoriacountytx.gov/departments/county-clerk', searchUrl: 'https://brazoria.tx.publicsearch.us/' },
  // CALIFORNIA — additional
  { name: 'Contra Costa County', state: 'CA', recorderUrl: 'https://www.contracosta.ca.gov/183/Clerk-Recorder', searchUrl: 'https://contracosta.ca.publicsearch.us/' },
  { name: 'San Mateo County', state: 'CA', recorderUrl: 'https://www.smcacre.org/', searchUrl: 'https://sanmateo.ca.publicsearch.us/' },
  { name: 'Kern County', state: 'CA', recorderUrl: 'https://www.co.kern.ca.us/recorder/', searchUrl: 'https://kern.ca.publicsearch.us/' },
  { name: 'Ventura County', state: 'CA', recorderUrl: 'https://recorder.countyofventura.org/', searchUrl: 'https://ventura.ca.publicsearch.us/' },
  { name: 'San Joaquin County', state: 'CA', recorderUrl: 'https://www.sjgov.org/recorder/', searchUrl: 'https://sanjoaquin.ca.publicsearch.us/' },
  // FLORIDA — additional
  { name: 'Duval County', state: 'FL', recorderUrl: 'https://www.duvalclerk.com/', searchUrl: 'https://core.duvalclerk.com/CoreWeb/OR/Search' },
  { name: 'Lee County FL', state: 'FL', recorderUrl: 'https://www.leeclerk.org/', searchUrl: 'https://www.leeclerk.org/official-records' },
  { name: 'Brevard County', state: 'FL', recorderUrl: 'https://www.brevardclerk.us/', searchUrl: 'https://officialrecords.brevardclerk.us/' },
  { name: 'Volusia County', state: 'FL', recorderUrl: 'https://www.clerk.org/', searchUrl: 'https://records.clerk.org/' },
  { name: 'Seminole County FL', state: 'FL', recorderUrl: 'https://www.seminoleclerk.org/', searchUrl: 'https://www.seminoleclerk.org/public-records-search/' },
  // NEW YORK — additional
  { name: 'Bronx County', state: 'NY', recorderUrl: 'https://www.nyc.gov/acris', searchUrl: 'https://a836-acris.nyc.gov/DS/DocumentSearch/' },
  { name: 'Richmond County', state: 'NY', recorderUrl: 'https://www.nyc.gov/acris', searchUrl: 'https://a836-acris.nyc.gov/DS/DocumentSearch/' },
  { name: 'Westchester County', state: 'NY', recorderUrl: 'https://www.westchestergov.com/county-clerk', searchUrl: 'https://westchestergov.com/county-clerk/land-records' },
  { name: 'Erie County NY', state: 'NY', recorderUrl: 'https://www.erie.gov/clerk/', searchUrl: 'https://www.erie.gov/clerk/land-records' },
  { name: 'Monroe County NY', state: 'NY', recorderUrl: 'https://www.monroecounty.gov/clerk', searchUrl: 'https://www.monroecounty.gov/clerk-land-records' },
  // GEORGIA — additional
  { name: 'Chatham County', state: 'GA', recorderUrl: 'https://www.chathamcounty.org/clerk-of-court', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'Richmond County GA', state: 'GA', recorderUrl: 'https://www.augustaga.gov/', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'Cherokee County', state: 'GA', recorderUrl: 'https://www.cherokeega.com/Clerk-of-Court/', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'Forsyth County GA', state: 'GA', recorderUrl: 'https://www.forsythco.com/Departments-Offices/Clerk-of-Court', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'Henry County GA', state: 'GA', recorderUrl: 'https://www.co.henry.ga.us/clerk-of-courts', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  // ILLINOIS — additional
  { name: 'Will County IL', state: 'IL', recorderUrl: 'https://www.willcountyillinois.com/County-Offices/Recorder-of-Deeds', searchUrl: 'https://willcounty.devnetwedge.com/' },
  { name: 'Kane County IL', state: 'IL', recorderUrl: 'https://www.countyofkane.org/Recorder/', searchUrl: 'https://il.kane.publicsearch.us/' },
  { name: 'McHenry County IL', state: 'IL', recorderUrl: 'https://www.mchenrycountyil.gov/county-government/departments-a-i/county-recorder', searchUrl: 'https://il.mchenry.publicsearch.us/' },
  // WASHINGTON — additional
  { name: 'Clark County WA', state: 'WA', recorderUrl: 'https://clark.wa.gov/auditor', searchUrl: 'https://clark.wa.gov/auditor/recording-document-search' },
  { name: 'Spokane County', state: 'WA', recorderUrl: 'https://www.spokanecounty.org/auditor', searchUrl: 'https://www.spokanecounty.org/DocumentCenter/Index/340' },
  { name: 'Thurston County', state: 'WA', recorderUrl: 'https://www.thurstoncountywa.gov/auditor', searchUrl: 'https://www.thurstoncountywa.gov/departments/auditor/recording/search-documents' },
  // COLORADO — additional
  { name: 'El Paso County CO', state: 'CO', recorderUrl: 'https://clerkandrecorder.elpasoco.com/', searchUrl: 'https://co.elpaso.publicsearch.us/' },
  { name: 'Adams County CO', state: 'CO', recorderUrl: 'https://www.adcogov.org/clerk-and-recorder', searchUrl: 'https://co.adams.publicsearch.us/' },
  { name: 'Larimer County', state: 'CO', recorderUrl: 'https://www.larimer.gov/clerk-recorder', searchUrl: 'https://co.larimer.publicsearch.us/' },
  { name: 'Boulder County', state: 'CO', recorderUrl: 'https://www.bouldercounty.gov/records/', searchUrl: 'https://co.boulder.publicsearch.us/' },
  // NEVADA — additional
  { name: 'Lyon County NV', state: 'NV', recorderUrl: 'https://www.lyon-county.org/recorder', searchUrl: 'https://nv.lyon.publicsearch.us/' },
  // OHIO — additional
  { name: 'Summit County OH', state: 'OH', recorderUrl: 'https://fiscaloffice.summitoh.net/', searchUrl: 'https://oh.summit.publicsearch.us/' },
  { name: 'Montgomery County OH', state: 'OH', recorderUrl: 'https://www.mcohio.org/recorder/', searchUrl: 'https://oh.montgomery.publicsearch.us/' },
  { name: 'Butler County OH', state: 'OH', recorderUrl: 'https://recorder.butlercountyohio.org/', searchUrl: 'https://oh.butler.publicsearch.us/' },
  // MICHIGAN — additional
  { name: 'Macomb County', state: 'MI', recorderUrl: 'https://rod.macombgov.org/', searchUrl: 'https://mi.macomb.publicsearch.us/' },
  { name: 'Kent County MI', state: 'MI', recorderUrl: 'https://www.accesskent.com/Departments/RegisterOfDeeds/', searchUrl: 'https://mi.kent.publicsearch.us/' },
  { name: 'Washtenaw County', state: 'MI', recorderUrl: 'https://www.washtenaw.org/339/Register-of-Deeds', searchUrl: 'https://mi.washtenaw.publicsearch.us/' },
];

/**
 * Additional city-to-county mappings for expanded coverage.
 */
export const EXPANSION_CITY_MAP: Record<string, string> = {
  // Texas
  'el paso': 'El Paso County',
  'corpus christi': 'Nueces County',
  killeen: 'Bell County',
  mcallen: 'Hidalgo County',
  // California
  bakersfield: 'Kern County',
  'thousand oaks': 'Ventura County',
  stockton: 'San Joaquin County',
  concord: 'Contra Costa County',
  'san mateo': 'San Mateo County',
  'walnut creek': 'Contra Costa County',
  // Florida
  jacksonville: 'Duval County',
  'cape coral': 'Lee County FL',
  'fort myers': 'Lee County FL',
  melbourne: 'Brevard County',
  daytona: 'Volusia County',
  'daytona beach': 'Volusia County',
  sanford: 'Seminole County FL',
  // New York
  'white plains': 'Westchester County',
  buffalo: 'Erie County NY',
  rochester: 'Monroe County NY',
  // Georgia
  savannah: 'Chatham County',
  augusta: 'Richmond County GA',
  canton: 'Cherokee County',
  // Illinois
  joliet: 'Will County IL',
  elgin: 'Kane County IL',
  // Washington
  vancouver: 'Clark County WA',
  spokane: 'Spokane County',
  olympia: 'Thurston County',
  // Colorado
  'colorado springs': 'El Paso County CO',
  westminster: 'Adams County CO',
  'fort collins': 'Larimer County',
  boulder: 'Boulder County',
  // Ohio
  akron: 'Summit County OH',
  dayton: 'Montgomery County OH',
  // Michigan
  'grand rapids': 'Kent County MI',
  'ann arbor': 'Washtenaw County',
  warren: 'Macomb County',
};
