/**
 * County recorder database — covers all 50 US states' major counties.
 * Each entry includes the official recorder/assessor URL and the public search URL.
 */

export interface CountyRecord {
  name: string;
  state: string;
  recorderUrl: string;
  searchUrl: string;
}

const COUNTY_DB: CountyRecord[] = [
  // ─── TEXAS ───
  { name: 'Harris County',  state: 'TX', recorderUrl: 'https://www.cclerk.hctx.net/', searchUrl: 'https://www.cclerk.hctx.net/applications/websearch/RP.aspx' },
  { name: 'Dallas County',  state: 'TX', recorderUrl: 'https://www.dallascounty.org/', searchUrl: 'https://dallas.tx.publicsearch.us/' },
  { name: 'Tarrant County', state: 'TX', recorderUrl: 'https://www.tarrantcountytx.gov/', searchUrl: 'https://tarrant.tx.publicsearch.us/' },
  { name: 'Bexar County',   state: 'TX', recorderUrl: 'https://bexar.org/', searchUrl: 'https://bexar.tx.publicsearch.us/' },
  { name: 'Travis County',  state: 'TX', recorderUrl: 'https://countyclerk.traviscountytx.gov/', searchUrl: 'https://www.tccsearch.org/' },
  { name: 'Collin County',  state: 'TX', recorderUrl: 'https://www.collincountytx.gov/', searchUrl: 'https://collin.tx.publicsearch.us/' },
  { name: 'Denton County',  state: 'TX', recorderUrl: 'https://www.dentoncounty.gov/', searchUrl: 'https://denton.tx.publicsearch.us/' },
  { name: 'Fort Bend County', state: 'TX', recorderUrl: 'https://www.fortbendcountytx.gov/', searchUrl: 'http://ccweb.co.fort-bend.tx.us/RealEstate/SearchEntry.aspx' },
  { name: 'Montgomery County TX', state: 'TX', recorderUrl: 'https://www.mctx.org/', searchUrl: 'https://montgomery.tx.publicsearch.us/' },
  { name: 'Williamson County', state: 'TX', recorderUrl: 'https://www.wilco.org/', searchUrl: 'https://williamsoncountytx-web.tylerhost.net/williamsonweb/' },
  { name: 'Webb County', state: 'TX', recorderUrl: 'https://www.webbcountytx.gov/CountyClerk/', searchUrl: 'https://www.webbcountytx.gov/CountyClerk/RecordSearch/' },
  { name: 'El Paso County TX', state: 'TX', recorderUrl: 'https://www.epcounty.com/clerk/', searchUrl: 'https://apps.epcounty.com/CountyClerk/RealPropertyRecords.aspx' },
  { name: 'Hidalgo County', state: 'TX', recorderUrl: 'https://www.co.hidalgo.tx.us/194/County-Clerk', searchUrl: 'https://www.co.hidalgo.tx.us/194/County-Clerk' },
  { name: 'Cameron County', state: 'TX', recorderUrl: 'https://www.cameroncounty.us/county-clerk/', searchUrl: 'https://www.cameroncounty.us/county-clerk/' },
  { name: 'Nueces County', state: 'TX', recorderUrl: 'https://www.nuecesco.com/county-services/county-clerk', searchUrl: 'https://www.nuecesco.com/county-services/county-clerk' },
  { name: 'Lubbock County', state: 'TX', recorderUrl: 'https://www.co.lubbock.tx.us/department/division.php?fDD=10-0', searchUrl: 'https://www.co.lubbock.tx.us/department/division.php?fDD=10-0' },
  { name: 'McLennan County', state: 'TX', recorderUrl: 'https://www.co.mclennan.tx.us/169/County-Clerk', searchUrl: 'https://www.co.mclennan.tx.us/169/County-Clerk' },
  { name: 'Brazoria County', state: 'TX', recorderUrl: 'https://www.brazoriacountyclerk.com/', searchUrl: 'https://www.brazoriacountyclerk.com/' },
  { name: 'Galveston County', state: 'TX', recorderUrl: 'https://www.galvestoncountytx.gov/county-clerk', searchUrl: 'https://www.galvestoncountytx.gov/county-clerk' },
  { name: 'Hays County', state: 'TX', recorderUrl: 'https://www.co.hays.tx.us/county-clerk', searchUrl: 'https://www.co.hays.tx.us/county-clerk' },
  { name: 'Bell County', state: 'TX', recorderUrl: 'https://www.bellcounty.texas.gov/county-clerk/', searchUrl: 'https://www.bellcounty.texas.gov/county-clerk/' },
  { name: 'Smith County', state: 'TX', recorderUrl: 'https://www.smith-county.com/government/departments/county-clerk', searchUrl: 'https://www.smith-county.com/government/departments/county-clerk' },
  { name: 'Jefferson County TX', state: 'TX', recorderUrl: 'https://www.co.jefferson.tx.us/county_clerk/', searchUrl: 'https://www.co.jefferson.tx.us/county_clerk/' },
  { name: 'Brazos County', state: 'TX', recorderUrl: 'https://www.brazoscountytx.gov/125/County-Clerk', searchUrl: 'https://www.brazoscountytx.gov/125/County-Clerk' },
  // ─── CALIFORNIA ───
  { name: 'Los Angeles County', state: 'CA', recorderUrl: 'https://rrcc.lacounty.gov/', searchUrl: 'https://rrcc.lacounty.gov/landrecords/' },
  { name: 'San Diego County', state: 'CA', recorderUrl: 'https://arcc.sandiegocounty.gov/', searchUrl: 'https://arcc.sdcounty.ca.gov/Pages/OfficialRecords.aspx' },
  { name: 'Orange County', state: 'CA', recorderUrl: 'https://www.ocrecorder.com/', searchUrl: 'https://cr.ocgov.com/recorderworks/' },
  { name: 'Riverside County', state: 'CA', recorderUrl: 'https://www.rivcoacr.org/', searchUrl: 'https://riverside.ca.publicsearch.us/' },
  { name: 'San Bernardino County', state: 'CA', recorderUrl: 'https://arc.sbcounty.gov/', searchUrl: 'https://sbcounty.ca.publicsearch.us/' },
  { name: 'Santa Clara County', state: 'CA', recorderUrl: 'https://clerkrecorder.sccgov.org/', searchUrl: 'https://recorderonline.sccgov.org/' },
  { name: 'Alameda County', state: 'CA', recorderUrl: 'https://www.acgov.org/clerk-recorder/', searchUrl: 'https://recorderonline.acgov.org/' },
  { name: 'Sacramento County', state: 'CA', recorderUrl: 'https://recorder.saccounty.gov/', searchUrl: 'https://recorderonline.saccounty.gov/' },
  { name: 'Fresno County', state: 'CA', recorderUrl: 'https://www.co.fresno.ca.us/departments/assessor-recorder-clerk', searchUrl: 'https://arc.fresnocountyca.gov/' },
  // ─── FLORIDA ───
  { name: 'Miami-Dade County', state: 'FL', recorderUrl: 'https://www.miami-dadeclerk.com/', searchUrl: 'https://www.miami-dadeclerk.com/officialrecords/StandardSearch.aspx' },
  { name: 'Broward County', state: 'FL', recorderUrl: 'https://www.browardclerk.org/', searchUrl: 'https://officialrecords.broward.org/AcclaimWeb/' },
  { name: 'Palm Beach County', state: 'FL', recorderUrl: 'https://www.mypalmbeachclerk.com/', searchUrl: 'https://or.pbcgov.org/or/' },
  { name: 'Hillsborough County', state: 'FL', recorderUrl: 'https://www.hillsclerk.com/', searchUrl: 'https://pubrec.hillsclerk.com/oncore/search.aspx' },
  { name: 'Orange County FL', state: 'FL', recorderUrl: 'https://www.myorangeclerk.com/', searchUrl: 'https://or.occompt.com/recorder/web/' },
  { name: 'Pinellas County', state: 'FL', recorderUrl: 'https://www.pinellasclerk.org/', searchUrl: 'https://officialrecords.pinellasclerk.org/Search/Disclaimer.aspx' },
  // ─── NEW YORK ───
  { name: 'New York County', state: 'NY', recorderUrl: 'https://www.nyc.gov/acris', searchUrl: 'https://a836-acris.nyc.gov/DS/DocumentSearch/' },
  { name: 'Kings County', state: 'NY', recorderUrl: 'https://www.nyc.gov/acris', searchUrl: 'https://a836-acris.nyc.gov/DS/DocumentSearch/' },
  { name: 'Queens County', state: 'NY', recorderUrl: 'https://www.nyc.gov/acris', searchUrl: 'https://a836-acris.nyc.gov/DS/DocumentSearch/' },
  { name: 'Suffolk County NY', state: 'NY', recorderUrl: 'https://www.suffolkcountyny.gov/clerk', searchUrl: 'https://lrv.suffolkcountyny.gov/lrv/' },
  { name: 'Nassau County', state: 'NY', recorderUrl: 'https://www.nassaucountyny.gov/agencies/COBE/', searchUrl: 'https://i2.nassaucountyny.gov/apps/ROL/rol.aspx' },
  // ─── ILLINOIS ───
  { name: 'Cook County', state: 'IL', recorderUrl: 'https://www.cookcountyil.gov/service/recorder-deeds', searchUrl: 'https://ccrd.cookcountyil.gov/RecorderDeedsWeb/' },
  { name: 'DuPage County', state: 'IL', recorderUrl: 'https://www.dupageco.org/recorder/', searchUrl: 'https://il.recorder.com/recorder/web/' },
  { name: 'Lake County IL', state: 'IL', recorderUrl: 'https://www.lakecountyil.gov/recorder', searchUrl: 'https://www.lakecountyil.gov/recorder/online-records' },
  // ─── GEORGIA ───
  { name: 'Fulton County', state: 'GA', recorderUrl: 'https://www.fultoncountyclerkofcourts.org/', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'Gwinnett County', state: 'GA', recorderUrl: 'https://www.gwinnettclerk.com/', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'Cobb County', state: 'GA', recorderUrl: 'https://www.cobbsuperior.org/', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  { name: 'DeKalb County', state: 'GA', recorderUrl: 'https://www.clerkofcourts.dekalbcountyga.gov/', searchUrl: 'https://search.gsccca.org/RealEstate/' },
  // ─── ARIZONA ───
  { name: 'Maricopa County', state: 'AZ', recorderUrl: 'https://recorder.maricopa.gov/', searchUrl: 'https://recorder.maricopa.gov/recdocdata/' },
  { name: 'Pima County', state: 'AZ', recorderUrl: 'https://www.recorder.pima.gov/', searchUrl: 'https://recorder.pima.gov/RecordedDocSearch/SearchEntry' },
  // ─── WASHINGTON ───
  { name: 'King County', state: 'WA', recorderUrl: 'https://kingcounty.gov/depts/records-licensing/recorders-office.aspx', searchUrl: 'https://recordsearch.kingcounty.gov/LandmarkWeb/' },
  { name: 'Pierce County', state: 'WA', recorderUrl: 'https://www.piercecountywa.gov/recorder', searchUrl: 'https://epip.co.pierce.wa.us/cfapps/EPIP/parcelInfo/searchByAddress.cfm' },
  { name: 'Snohomish County', state: 'WA', recorderUrl: 'https://snohomishcountywa.gov/388/Auditor', searchUrl: 'https://www.snohomishcountywa.gov/607/Real-Property' },
  // ─── COLORADO ───
  { name: 'Denver County', state: 'CO', recorderUrl: 'https://www.denvergov.org/Government/Agencies-Departments-Offices/Clerk-Recorder', searchUrl: 'https://co.denver.publicsearch.us/' },
  { name: 'Arapahoe County', state: 'CO', recorderUrl: 'https://www.arapahoegov.com/clerk-and-recorder', searchUrl: 'https://co.arapahoe.publicsearch.us/' },
  { name: 'Jefferson County CO', state: 'CO', recorderUrl: 'https://www.jeffco.us/clerk', searchUrl: 'https://co.jefferson.publicsearch.us/' },
  { name: 'Douglas County CO', state: 'CO', recorderUrl: 'https://www.douglas.co.us/clerk-and-recorder/', searchUrl: 'https://co.douglas.publicsearch.us/' },
  // ─── NEVADA ───
  { name: 'Clark County', state: 'NV', recorderUrl: 'https://www.clarkcountynv.gov/government/departments/county_recorder/', searchUrl: 'https://recorder.clarkcountynv.gov/landmaster/' },
  { name: 'Washoe County', state: 'NV', recorderUrl: 'https://www.washoecounty.gov/recorder/', searchUrl: 'https://www.washoecounty.gov/recorder/search.php' },
  // ─── NORTH CAROLINA ───
  { name: 'Mecklenburg County', state: 'NC', recorderUrl: 'https://www.mecknc.gov/deeds', searchUrl: 'https://nc.mecklenburg.publicsearch.us/' },
  { name: 'Wake County', state: 'NC', recorderUrl: 'https://www.wake.gov/departments-agencies/register-of-deeds', searchUrl: 'https://nc.wake.publicsearch.us/' },
  { name: 'Guilford County', state: 'NC', recorderUrl: 'https://www.guilfordcountync.gov/our-county/register-of-deeds', searchUrl: 'https://nc.guilford.publicsearch.us/' },
  // ─── OHIO ───
  { name: 'Cuyahoga County', state: 'OH', recorderUrl: 'https://recorder.cuyahogacounty.us/', searchUrl: 'https://recorder.cuyahogacounty.us/search_official_records/' },
  { name: 'Franklin County OH', state: 'OH', recorderUrl: 'https://www.franklincountyohio.gov/recorder', searchUrl: 'https://oh.franklin.publicsearch.us/' },
  { name: 'Hamilton County OH', state: 'OH', recorderUrl: 'https://www.hamiltonco.org/government/departments/county-recorder', searchUrl: 'https://oh.hamilton.publicsearch.us/' },
  // ─── MICHIGAN ───
  { name: 'Wayne County', state: 'MI', recorderUrl: 'https://www.waynecounty.com/elected/register/', searchUrl: 'https://mi.wayne.publicsearch.us/' },
  { name: 'Oakland County MI', state: 'MI', recorderUrl: 'https://www.oakgov.com/clerkrod/', searchUrl: 'https://mi.oakland.publicsearch.us/' },
  // ─── MINNESOTA ───
  { name: 'Hennepin County', state: 'MN', recorderUrl: 'https://www.hennepin.us/recorder', searchUrl: 'https://mn.hennepin.publicsearch.us/' },
  { name: 'Ramsey County', state: 'MN', recorderUrl: 'https://www.ramseycounty.us/residents/property/recorder', searchUrl: 'https://mn.ramsey.publicsearch.us/' },
  // ─── PENNSYLVANIA ───
  { name: 'Philadelphia County', state: 'PA', recorderUrl: 'https://recorder.phila.gov/', searchUrl: 'https://epims.phila.gov/phillyregister/' },
  { name: 'Allegheny County', state: 'PA', recorderUrl: 'https://www.alleghenycounty.us/recorder/', searchUrl: 'https://pa.allegheny.publicsearch.us/' },
  // ─── TENNESSEE ───
  { name: 'Shelby County', state: 'TN', recorderUrl: 'https://register.shelby.tn.us/', searchUrl: 'https://register.shelby.tn.us/search/' },
  { name: 'Davidson County', state: 'TN', recorderUrl: 'https://www.nashville.gov/Metro-Clerk.aspx', searchUrl: 'https://www.padctn.org/property-records/' },
  // ─── MARYLAND ───
  { name: 'Montgomery County MD', state: 'MD', recorderUrl: 'https://www.montgomerycountymd.gov/circuitcourt/', searchUrl: 'https://mdlandrec.net/main/dsp_search.cfm?county=15' },
  { name: "Prince George's County", state: 'MD', recorderUrl: 'https://circuitcourt.co.pg.md.us/', searchUrl: 'https://mdlandrec.net/main/dsp_search.cfm?county=17' },
  // ─── VIRGINIA ───
  { name: 'Fairfax County', state: 'VA', recorderUrl: 'https://www.fairfaxcounty.gov/circuit/', searchUrl: 'https://www.fairfaxcounty.gov/landrecords/' },
  { name: 'Loudoun County', state: 'VA', recorderUrl: 'https://www.loudoun.gov/circuit-court', searchUrl: 'https://iqs.loudoun.gov/IQS/' },
  // ─── MASSACHUSETTS ───
  { name: 'Suffolk County MA', state: 'MA', recorderUrl: 'https://www.masslandrecords.com/middlesex/', searchUrl: 'https://www.masslandrecords.com/suffolk/' },
  { name: 'Middlesex County MA', state: 'MA', recorderUrl: 'https://www.masslandrecords.com/middlesex/', searchUrl: 'https://www.masslandrecords.com/middlesex/' },
  // ─── OREGON ───
  { name: 'Multnomah County', state: 'OR', recorderUrl: 'https://multco.us/assessment-taxation/recording', searchUrl: 'https://multco.us/assessment-taxation/recording/search-recorded-documents' },
  { name: 'Washington County OR', state: 'OR', recorderUrl: 'https://www.co.washington.or.us/AssessmentTaxation/', searchUrl: 'https://wcatax.co.washington.or.us/' },
  // ─── SOUTH CAROLINA ───
  { name: 'Greenville County', state: 'SC', recorderUrl: 'https://www.greenvillecounty.org/RMC/', searchUrl: 'https://www.greenvillecounty.org/RMC/default.aspx' },
  { name: 'Richland County', state: 'SC', recorderUrl: 'https://www.rcgov.us/government/departments/register-of-deeds/', searchUrl: 'https://rod.rcgov.us/' },
  // ─── NEW JERSEY ───
  { name: 'Bergen County', state: 'NJ', recorderUrl: 'https://www.co.bergen.nj.us/county-clerk', searchUrl: 'https://www.njactb.org/pages/CountyClerk.aspx?Ct=Bergen' },
  { name: 'Essex County NJ', state: 'NJ', recorderUrl: 'https://www.essexcountynj.org/county-clerk/', searchUrl: 'https://www.njactb.org/pages/CountyClerk.aspx?Ct=Essex' },
];

// Import and merge expansion counties
import { EXPANSION_COUNTIES, EXPANSION_CITY_MAP } from './county-monitor';
const ALL_COUNTIES: CountyRecord[] = [...COUNTY_DB, ...EXPANSION_COUNTIES];

/**
 * City → County mapping for fast address resolution
 */
const CITY_TO_COUNTY: Record<string, string> = {
  houston: 'Harris County',
  pasadena: 'Harris County',       sugar_land: 'Fort Bend County',
  dallas: 'Dallas County',         irving: 'Dallas County',
  garland: 'Dallas County',        mesquite: 'Dallas County',
  'fort worth': 'Tarrant County',  arlington: 'Tarrant County',
  'san antonio': 'Bexar County',   austin: 'Travis County',
  round_rock: 'Williamson County', 'cedar park': 'Williamson County',
  plano: 'Collin County',          frisco: 'Collin County',
  mckinney: 'Collin County',       allen: 'Collin County',
  denton: 'Denton County',         lewisville: 'Denton County',
  laredo: 'Webb County',
  'el paso': 'El Paso County TX',
  mcallen: 'Hidalgo County',       edinburg: 'Hidalgo County',
  'mission': 'Hidalgo County',     pharr: 'Hidalgo County',
  brownsville: 'Cameron County',   harlingen: 'Cameron County',
  'corpus christi': 'Nueces County',
  lubbock: 'Lubbock County',
  waco: 'McLennan County',
  pearland: 'Brazoria County',     'lake jackson': 'Brazoria County',
  galveston: 'Galveston County',   'texas city': 'Galveston County',
  'san marcos': 'Hays County',     kyle: 'Hays County',
  killeen: 'Bell County',          temple: 'Bell County',
  tyler: 'Smith County',
  beaumont: 'Jefferson County TX', 'port arthur': 'Jefferson County TX',
  'college station': 'Brazos County', bryan: 'Brazos County',
  'sugar land': 'Fort Bend County', 'missouri city': 'Fort Bend County',
  conroe: 'Montgomery County TX',  'the woodlands': 'Montgomery County TX',
  // California
  'los angeles': 'Los Angeles County', la: 'Los Angeles County',
  'san diego': 'San Diego County',     anaheim: 'Orange County',
  irvine: 'Orange County',             'santa ana': 'Orange County',
  riverside: 'Riverside County',       fresno: 'Fresno County',
  'san jose': 'Santa Clara County',    sunnyvale: 'Santa Clara County',
  'san francisco': 'San Francisco County',
  oakland: 'Alameda County',           berkeley: 'Alameda County',
  sacramento: 'Sacramento County',
  // Florida
  miami: 'Miami-Dade County',          'miami beach': 'Miami-Dade County',
  'fort lauderdale': 'Broward County', hollywood: 'Broward County',
  'west palm beach': 'Palm Beach County',
  tampa: 'Hillsborough County',        orlando: 'Orange County FL',
  'st. petersburg': 'Pinellas County', clearwater: 'Pinellas County',
  // New York
  'new york': 'New York County',       manhattan: 'New York County',
  brooklyn: 'Kings County',            queens: 'Queens County',
  bronx: 'Bronx County',              'staten island': 'Richmond County',
  yonkers: 'Westchester County',
  // Illinois
  chicago: 'Cook County',              evanston: 'Cook County',
  naperville: 'DuPage County',         aurora: 'DuPage County',
  // Georgia
  atlanta: 'Fulton County',            sandy_springs: 'Fulton County',
  alpharetta: 'Fulton County',         lawrenceville: 'Gwinnett County',
  marietta: 'Cobb County',             smyrna: 'Cobb County',
  // Arizona
  phoenix: 'Maricopa County',          scottsdale: 'Maricopa County',
  tempe: 'Maricopa County',            gilbert: 'Maricopa County',
  chandler: 'Maricopa County',         tucson: 'Pima County',
  // Washington
  seattle: 'King County',              bellevue: 'King County',
  tacoma: 'Pierce County',             everett: 'Snohomish County',
  // Colorado
  denver: 'Denver County',             aurora_co: 'Arapahoe County',
  englewood: 'Arapahoe County',        lakewood: 'Jefferson County CO',
  'castle rock': 'Douglas County CO',
  // Nevada
  'las vegas': 'Clark County',         henderson: 'Clark County',
  north_las_vegas: 'Clark County',     reno: 'Washoe County',
  // North Carolina
  charlotte: 'Mecklenburg County',     raleigh: 'Wake County',
  greensboro: 'Guilford County',
  // Ohio
  cleveland: 'Cuyahoga County',        columbus: 'Franklin County OH',
  cincinnati: 'Hamilton County OH',
  // Michigan
  detroit: 'Wayne County',             dearborn: 'Wayne County',
  troy: 'Oakland County MI',           'royal oak': 'Oakland County MI',
  // Minnesota
  minneapolis: 'Hennepin County',      bloomington: 'Hennepin County',
  'st. paul': 'Ramsey County',
  // Pennsylvania
  philadelphia: 'Philadelphia County', pittsburgh: 'Allegheny County',
  // Tennessee
  memphis: 'Shelby County',            nashville: 'Davidson County',
  // Maryland
  bethesda: 'Montgomery County MD',    'silver spring': 'Montgomery County MD',
  'upper marlboro': "Prince George's County",
  // Virginia
  'fairfax': 'Fairfax County',         'mclean': 'Fairfax County',
  'leesburg': 'Loudoun County',        'ashburn': 'Loudoun County',
  // Massachusetts
  boston: 'Suffolk County MA',         cambridge: 'Middlesex County MA',
  // Oregon
  portland: 'Multnomah County',        beaverton: 'Washington County OR',
  // South Carolina
  greenville: 'Greenville County',     columbia: 'Richland County',
  // New Jersey
  'fort lee': 'Bergen County',         newark: 'Essex County NJ',
  // Expansion cities (from county-monitor.ts)
  ...EXPANSION_CITY_MAP,
};

/** Normalize address string for matching */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Look up the county for a given address string.
 * Checks city names, county names, then tries US Census geocoder as fallback.
 */
export async function lookupCounty(address: string): Promise<CountyRecord | null> {
  const addr = normalize(address);

  // 1. Direct county name match (e.g. "Harris County" in address)
  for (const record of ALL_COUNTIES) {
    if (addr.includes(record.name.toLowerCase())) {
      return record;
    }
  }

  // 2. City matching (e.g. "Laredo" -> Webb County)
  for (const [city, countyName] of Object.entries(CITY_TO_COUNTY)) {
    if (addr.includes(city.toLowerCase())) {
      const found = ALL_COUNTIES.find(r => r.name === countyName);
      if (found) return found;
    }
  }

  // 3. Try US Census geocoder to resolve address to county (free, no API key)
  try {
    const encoded = encodeURIComponent(address);
    const geocodeUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encoded}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const res = await fetch(geocodeUrl, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const match = data?.result?.addressMatches?.[0];
      const countyName = match?.geographies?.Counties?.[0]?.BASENAME;
      const stateName = match?.addressComponents?.state;
      if (countyName && stateName) {
        const fullCountyName = `${countyName} County`;
        // Try to find in our DB
        const found = ALL_COUNTIES.find(r =>
          r.name.toLowerCase().includes(countyName.toLowerCase()) && r.state === stateName
        );
        if (found) return found;
        // County identified but not in our DB — return a basic record
        return {
          name: fullCountyName,
          state: stateName,
          recorderUrl: '',
          searchUrl: '',
        };
      }
    }
  } catch {
    // Geocoder unavailable — continue to zip code fallback
  }

  // 4. ZIP code → state fallback — but ONLY return a county if we can be specific
  // DO NOT guess a random county. Return a generic record with just the state.
  const stateMatch = addr.match(/\b([a-z]{2})\b\s*(\d{5})/);
  if (stateMatch) {
    const state = stateMatch[1].toUpperCase();
    const zip = stateMatch[2];
    // Use zip code prefix for rough region (not county-specific)
    return {
      name: `Unknown County (ZIP ${zip})`,
      state,
      recorderUrl: '',
      searchUrl: '',
    };
  }

  return null;
}

/** Export all counties for monitoring and coverage analysis */
export function getAllCounties(): CountyRecord[] {
  return ALL_COUNTIES;
}
