import { RetrievedDocument } from './record-retrieval';

export function getMockDocs(address: string, county: string): RetrievedDocument[] {
  return [
    {
      source: 'Mock County Recorder',
      url: 'http://mock-registry.gov/deed1.pdf',
      type: 'PDF',
      text: `
        WARRANTY DEED
        State of Texas
        County of ${county}
        
        Date: January 15, 2020
        Grantor: John D. Seller
        Grantee: Jane A. Buyer
        Address: ${address}
        
        For and in consideration of the sum of $10.00 and other good and valuable consideration, Grantor grants, sells, and conveys to Grantee the property described as Lot 5, Block B, Highland Park Addition.
        
        Subject to:
        1. Utility easements of record.
        2. HOA assessments for Highland Park HOA.
      `
    },
    {
      source: 'Mock County Recorder',
      url: 'http://mock-registry.gov/lien.pdf',
      type: 'PDF',
      text: `
        NOTICE OF LIEN
        Claimant: Quality Roofers Inc.
        Debtor: Jane A. Buyer
        Amount: $5,200.00
        Date Recorded: March 10, 2022
        
        Claimant files this lien against the property at ${address} for unpaid labor and materials for roof replacement.
      `
    }
  ];
}
