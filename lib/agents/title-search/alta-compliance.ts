/**
 * ALTA (American Land Title Association) compliance module.
 *
 * Generates Schedule A (property & coverage details) and Schedule B
 * (requirements and exceptions) from analyzed title data.
 *
 * Reference: ALTA 2021 Commitment Form
 */

import {
  ALTAScheduleA,
  ALTAScheduleB,
  ALTARequirement,
  ALTAExceptionItem,
  OwnershipNode,
  Lien,
  TitleException,
} from './types';

/**
 * Standard exceptions that appear on virtually every title commitment.
 * These are boilerplate items per ALTA guidelines.
 */
const STANDARD_EXCEPTIONS: ALTAExceptionItem[] = [
  {
    number: '1',
    category: 'standard',
    description: 'Rights or claims of parties in possession not shown by the public records.',
    removable: true,
  },
  {
    number: '2',
    category: 'standard',
    description: 'Encroachments, overlaps, boundary line disputes, and any other matters which would be disclosed by an accurate survey and inspection of the premises.',
    removable: true,
  },
  {
    number: '3',
    category: 'standard',
    description: 'Easements, or claims of easements, not shown by the public records.',
    removable: true,
  },
  {
    number: '4',
    category: 'standard',
    description: 'Any lien, or right to a lien, for services, labor, or material heretofore or hereafter furnished, imposed by law and not shown by the public records.',
    removable: false,
  },
  {
    number: '5',
    category: 'standard',
    description: 'Taxes or special assessments which are not yet due and payable or which are not shown as existing liens by the public records.',
    removable: false,
  },
];

/** Generate a commitment number */
function generateCommitmentNumber(): string {
  const prefix = 'TAINOVA';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Build ALTA Schedule A from analyzed title data.
 */
export function buildScheduleA(
  propertyAddress: string,
  county: string,
  legalDescription: string | null | undefined,
  ownershipChain: OwnershipNode[],
  reportDate: string
): ALTAScheduleA {
  // Current owner is the most recent grantee
  const currentOwner = ownershipChain.length > 0
    ? ownershipChain[ownershipChain.length - 1].grantee
    : 'Unknown — unable to determine from available records';

  return {
    effectiveDate: reportDate,
    estateType: 'Fee Simple',
    vestedOwner: currentOwner,
    legalDescription: legalDescription || `Property located at ${propertyAddress}, ${county}. Full legal description to be confirmed by survey.`,
    commitmentNumber: generateCommitmentNumber(),
  };
}

/**
 * Build ALTA Schedule B from liens, exceptions, and ownership analysis.
 *
 * Schedule B has two parts:
 *   Part I:  Requirements — conditions that must be met before policy issuance
 *   Part II: Exceptions — matters excluded from coverage
 */
export function buildScheduleB(
  ownershipChain: OwnershipNode[],
  liens: Lien[],
  exceptions: TitleException[]
): ALTAScheduleB {
  const requirements: ALTARequirement[] = [];
  const specialExceptions: ALTAExceptionItem[] = [];

  let reqNum = 1;
  let excNum = STANDARD_EXCEPTIONS.length + 1;

  // ── Generate Requirements from Active Liens ────────────────────────────

  const activeLiens = liens.filter(l => l.status === 'Active');
  for (const lien of activeLiens) {
    requirements.push({
      number: `B-${reqNum++}`,
      description: buildLienRequirement(lien),
      satisfied: false,
    });
  }

  // ── Generate Requirements from Curable Exceptions ─────────────────────

  for (let i = 0; i < exceptions.length; i++) {
    const ex = exceptions[i];
    if (ex.type === 'Curable') {
      requirements.push({
        number: `B-${reqNum++}`,
        description: ex.remedy
          ? `${ex.description}: ${ex.remedy}`
          : `Resolve the following before closing: ${ex.description}. ${ex.explanation}`,
        satisfied: false,
        relatedItemId: `exception-${i}`,
      });
    }
  }

  // Standard requirement: pay all taxes and assessments
  requirements.push({
    number: `B-${reqNum++}`,
    description: 'Payment of all real property taxes, assessments, and water/sewer charges that are due and payable.',
    satisfied: false,
  });

  // Standard requirement: deliver executed deed
  requirements.push({
    number: `B-${reqNum++}`,
    description: 'Delivery of a properly executed deed of conveyance to the proposed insured.',
    satisfied: false,
  });

  // ── Generate Special Exceptions ───────────────────────────────────────

  // Add exceptions for all liens (active and released — released as informational)
  for (const lien of liens) {
    specialExceptions.push({
      number: String(excNum++),
      category: 'special',
      description: buildLienException(lien),
      removable: lien.status !== 'Active',
    });
  }

  // Add fatal and informational title exceptions
  for (let i = 0; i < exceptions.length; i++) {
    const ex = exceptions[i];
    if (ex.type === 'Fatal' || ex.type === 'Info') {
      specialExceptions.push({
        number: String(excNum++),
        category: 'special',
        description: `${ex.description}: ${ex.explanation}`,
        removable: ex.type === 'Info',
        relatedExceptionIndex: i,
      });
    }
  }

  // Check for gaps in chain of title
  if (ownershipChain.length > 1) {
    for (let i = 1; i < ownershipChain.length; i++) {
      const prev = ownershipChain[i - 1];
      const curr = ownershipChain[i];
      if (prev.grantee !== curr.grantor) {
        specialExceptions.push({
          number: String(excNum++),
          category: 'special',
          description: `Gap in chain of title: ${prev.grantee} (grantee of transfer #${i}) does not match ${curr.grantor} (grantor of transfer #${i + 1}). This discrepancy must be resolved.`,
          removable: false,
        });
      }
    }
  }

  return {
    requirements,
    exceptions: [...STANDARD_EXCEPTIONS, ...specialExceptions],
  };
}

function buildLienRequirement(lien: Lien): string {
  const parts: string[] = [];
  parts.push(`Satisfaction or release of ${lien.type} lien`);
  if (lien.claimant) parts.push(`held by ${lien.claimant}`);
  if (lien.amount) parts.push(`in the amount of ${lien.amount}`);
  if (lien.dateRecorded) parts.push(`recorded ${lien.dateRecorded}`);
  if (lien.documentNumber) parts.push(`(Instrument No. ${lien.documentNumber})`);
  parts.push('.');
  return parts.join(' ');
}

function buildLienException(lien: Lien): string {
  const status = lien.status === 'Released' ? '[RELEASED] ' : lien.status === 'Active' ? '[ACTIVE] ' : '';
  const parts: string[] = [];
  parts.push(`${status}${lien.type} lien`);
  if (lien.claimant) parts.push(`by ${lien.claimant}`);
  if (lien.amount) parts.push(`for ${lien.amount}`);
  if (lien.dateRecorded) parts.push(`recorded ${lien.dateRecorded}`);
  if (lien.documentNumber) parts.push(`Instrument No. ${lien.documentNumber}`);
  if (lien.description) parts.push(`— ${lien.description}`);
  return parts.join(' ');
}
