interface CountyInfo {
  name: string;
  recorderUrl: string;
  searchUrl: string;
}

const COUNTRIES_DB: Record<string, CountyInfo> = {
  'HARRIS': {
    name: 'Harris County',
    recorderUrl: 'https://www.cclerk.hctx.net/',
    searchUrl: 'https://media.cclerk.hctx.net/RealEstate/Search'
  },
  'DALLAS': {
    name: 'Dallas County',
    recorderUrl: 'https://dallas.tx.publicsearch.us/',
    searchUrl: 'https://dallas.tx.publicsearch.us/'
  },
  'TARRANT': {
    name: 'Tarrant County',
    recorderUrl: 'https://countyclerk.tarrantcounty.com/',
    searchUrl: 'https://tarrant.tx.publicsearch.us/'
  },
  'BEXAR': {
    name: 'Bexar County',
    recorderUrl: 'https://gov.bexar.org/county-clerk/',
    searchUrl: 'https://bexar.tx.publicsearch.us/'
  },
  'TRAVIS': {
    name: 'Travis County',
    recorderUrl: 'https://countyclerk.traviscountytx.gov/',
    searchUrl: 'https://www.tccsearch.org/RealEstate/SearchEntry.aspx'
  }
};

export async function lookupCounty(address: string): Promise<CountyInfo | null> {
  // Simple heuristic: check if address contains county name
  const upperAddr = address.toUpperCase();
  
  for (const [key, info] of Object.entries(COUNTRIES_DB)) {
    if (upperAddr.includes(key)) {
      return info;
    }
  }

  // Fallback: If city matches a major city in these counties
  if (upperAddr.includes('HOUSTON')) return COUNTRIES_DB['HARRIS'];
  if (upperAddr.includes('DALLAS')) return COUNTRIES_DB['DALLAS'];
  if (upperAddr.includes('FORT WORTH')) return COUNTRIES_DB['TARRANT'];
  if (upperAddr.includes('SAN ANTONIO')) return COUNTRIES_DB['BEXAR'];
  if (upperAddr.includes('AUSTIN')) return COUNTRIES_DB['TRAVIS'];

  return null;
}
