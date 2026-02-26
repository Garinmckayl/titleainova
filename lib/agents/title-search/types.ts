/**
 * Core types for Title AI Nova
 * Includes provenance tracking, confidence scoring, and ALTA compliance
 */

// ─── Source Provenance ──────────────────────────────────────────────────────

export type DataSourceType = 'nova_act' | 'tavily_search' | 'web_scrape' | 'mock_demo' | 'manual_entry';

export interface SourceCitation {
  /** Unique ID for this source reference */
  id: string;
  /** Where the data came from */
  sourceType: DataSourceType;
  /** Human-readable source name (e.g. "Harris County Clerk - Official Records") */
  sourceName: string;
  /** URL of the source document/page */
  url: string;
  /** Timestamp when this data was retrieved */
  retrievedAt: string;
  /** Raw text excerpt supporting this claim (max 500 chars) */
  excerpt?: string;
  /** Document type if identifiable */
  documentType?: string;
  /** County instrument/recording number if available */
  instrumentNumber?: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unverified';

export interface ConfidenceScore {
  /** Overall confidence: high (official record), medium (web search), low (inferred), unverified (mock/demo) */
  level: ConfidenceLevel;
  /** Numeric score 0-100 */
  score: number;
  /** Factors that contributed to this score */
  factors: string[];
  /** Source citations backing this data point */
  citations: string[]; // IDs referencing SourceCitation[]
}

// ─── Core Data Types (Enhanced) ─────────────────────────────────────────────

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
  /** Provenance: how confident are we in this data */
  confidence?: ConfidenceScore;
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
  /** Provenance: how confident are we in this data */
  confidence?: ConfidenceScore;
}

export interface TitleException {
  type: 'Fatal' | 'Curable' | 'Info';
  description: string;
  explanation: string;
  remedy?: string;
  urgency?: 'Immediate' | 'Before Closing' | 'Post-Closing' | 'N/A';
  /** Provenance: how confident are we in this data */
  confidence?: ConfidenceScore;
}

// ─── ALTA Compliance ────────────────────────────────────────────────────────

export interface ALTAScheduleA {
  /** Effective date of commitment */
  effectiveDate: string;
  /** Policy amount (proposed insured amount) */
  policyAmount?: string;
  /** Type of estate (Fee Simple, Leasehold, etc.) */
  estateType: string;
  /** Current vested owner(s) */
  vestedOwner: string;
  /** Legal description of the property */
  legalDescription: string;
  /** Title commitment number */
  commitmentNumber: string;
}

export interface ALTAScheduleB {
  /** Requirements to be satisfied before policy issuance */
  requirements: ALTARequirement[];
  /** Exceptions from coverage */
  exceptions: ALTAExceptionItem[];
}

export interface ALTARequirement {
  /** Requirement number (B-1, B-2, etc.) */
  number: string;
  /** Description of the requirement */
  description: string;
  /** Whether this has been satisfied */
  satisfied: boolean;
  /** Reference to related lien or exception */
  relatedItemId?: string;
}

export interface ALTAExceptionItem {
  /** Exception number (1, 2, 3, etc.) */
  number: string;
  /** Standard or special exception */
  category: 'standard' | 'special';
  /** Description of the exception */
  description: string;
  /** Whether this can be removed */
  removable: boolean;
  /** Reference to related TitleException */
  relatedExceptionIndex?: number;
}

// ─── Review Workflow ────────────────────────────────────────────────────────

export type ReviewStatus = 'pending_review' | 'in_review' | 'approved' | 'rejected' | 'revision_requested';

export interface ReviewComment {
  id: string;
  reviewerId: string;
  reviewerName: string;
  section: 'chain_of_title' | 'liens' | 'exceptions' | 'summary' | 'schedule_a' | 'schedule_b' | 'general';
  itemIndex?: number;
  comment: string;
  action: 'approve' | 'reject' | 'flag' | 'note';
  createdAt: string;
}

export interface ReviewRecord {
  searchId: number;
  status: ReviewStatus;
  assignedTo?: string;
  assignedAt?: string;
  comments: ReviewComment[];
  finalDecision?: 'approved' | 'rejected';
  finalDecisionBy?: string;
  finalDecisionAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Enhanced Report ────────────────────────────────────────────────────────

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

  /** Source provenance tracking */
  sources?: SourceCitation[];
  /** Overall report confidence */
  overallConfidence?: ConfidenceScore;
  /** ALTA Schedule A data */
  altaScheduleA?: ALTAScheduleA;
  /** ALTA Schedule B data */
  altaScheduleB?: ALTAScheduleB;
  /** Review status */
  reviewStatus?: ReviewStatus;
}

// ─── Notification Types ─────────────────────────────────────────────────────

export type NotificationChannel = 'email' | 'webhook' | 'in_app';
export type NotificationEvent = 'job_completed' | 'job_failed' | 'job_progress' | 'review_requested' | 'review_completed';

export interface NotificationConfig {
  userId: string;
  channel: NotificationChannel;
  event: NotificationEvent;
  /** Webhook URL (for webhook channel) */
  webhookUrl?: string;
  /** Email address (for email channel) */
  email?: string;
  enabled: boolean;
}

// ─── County Monitoring ──────────────────────────────────────────────────────

export interface CountyHealthStatus {
  countyName: string;
  state: string;
  recorderUrl: string;
  lastChecked: string;
  isOnline: boolean;
  responseTimeMs: number;
  lastSuccessfulSearch?: string;
  failureCount: number;
  /** Whether the site structure has changed (may break scraping) */
  structureChanged: boolean;
  notes?: string;
}
