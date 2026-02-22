export interface OwnershipNode {
  id: string;
  grantor: string;
  grantee: string;
  date: string;
  documentType: string;
  recordingDate?: string;
  documentNumber?: string;
  bookPage?: string;
  notes?: string;
}

export interface Lien {
  type: 'Tax' | 'Mechanic' | 'Judgment' | 'HOA' | 'Mortgage' | 'Federal Tax' | 'IRS' | 'Child Support' | 'Other';
  claimant: string;
  amount?: string;
  dateRecorded: string;
  status: 'Active' | 'Released' | 'Pending' | 'Unknown';
  priority?: 'High' | 'Medium' | 'Low';
  documentNumber?: string;
  description?: string;
}

export interface TitleException {
  type: 'Fatal' | 'Curable' | 'Info';
  description: string;
  explanation: string;
  remedy?: string;
  urgency?: 'Immediate' | 'Before Closing' | 'Post-Closing' | 'N/A';
}

export interface TitleReportData {
  propertyAddress: string;
  parcelId?: string | null;
  county: string;
  legalDescription?: string | null;
  reportDate: string;
  ownershipChain: OwnershipNode[];
  liens: Lien[];
  exceptions: TitleException[];
  summary: string;
  dataSource?: string;
}
