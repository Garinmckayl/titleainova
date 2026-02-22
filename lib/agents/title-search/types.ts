export interface OwnershipNode {
  id: string;
  grantor: string;
  grantee: string;
  date: string;
  documentType: string;
  recordingDate?: string;
  documentNumber?: string;
  notes?: string;
}

export interface Lien {
  type: 'Tax' | 'Mechanic' | 'Judgment' | 'HOA' | 'Mortgage' | 'Other';
  claimant: string;
  amount?: string;
  dateRecorded: string;
  status: 'Active' | 'Released' | 'Unknown';
  priority?: 'High' | 'Medium' | 'Low';
  description?: string;
}

export interface TitleException {
  type: 'Fatal' | 'Curable' | 'Info';
  description: string;
  explanation: string; // Plain English
  remedy?: string;
}

export interface TitleReportData {
  propertyAddress: string;
  parcelId?: string;
  county: string;
  legalDescription?: string;
  reportDate: string;
  ownershipChain: OwnershipNode[];
  liens: Lien[];
  exceptions: TitleException[];
  summary: string;
}
