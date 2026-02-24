/**
 * Tests for ALTA compliance module.
 */
import { describe, it, expect } from 'vitest';
import { buildScheduleA, buildScheduleB } from '@/lib/agents/title-search/alta-compliance';
import type { OwnershipNode, Lien, TitleException } from '@/lib/agents/title-search/types';

describe('buildScheduleA', () => {
  it('builds schedule A with correct vested owner from chain', () => {
    const chain: OwnershipNode[] = [
      { id: 'n1', grantor: 'John Seller', grantee: 'Jane Buyer', date: '2020-01-15', documentType: 'Warranty Deed' },
      { id: 'n2', grantor: 'Jane Buyer', grantee: 'Bob Owner', date: '2023-06-01', documentType: 'Grant Deed' },
    ];

    const sa = buildScheduleA('123 Main St, Houston, TX', 'Harris County', 'Lot 5, Block B', chain, '2/24/2026');
    expect(sa.vestedOwner).toBe('Bob Owner');
    expect(sa.estateType).toBe('Fee Simple');
    expect(sa.effectiveDate).toBe('2/24/2026');
    expect(sa.legalDescription).toBe('Lot 5, Block B');
    expect(sa.commitmentNumber).toMatch(/^TAINOVA-/);
  });

  it('handles empty chain gracefully', () => {
    const sa = buildScheduleA('123 Main St', 'Harris County', null, [], '2/24/2026');
    expect(sa.vestedOwner).toContain('Unknown');
    expect(sa.legalDescription).toContain('123 Main St');
  });

  it('generates unique commitment numbers', () => {
    const sa1 = buildScheduleA('A', 'X', null, [], '1/1/2026');
    const sa2 = buildScheduleA('B', 'Y', null, [], '1/1/2026');
    expect(sa1.commitmentNumber).not.toBe(sa2.commitmentNumber);
  });
});

describe('buildScheduleB', () => {
  it('generates requirements from active liens', () => {
    const liens: Lien[] = [
      { type: 'Mortgage', claimant: 'First National Bank', amount: '$250,000', dateRecorded: '2020-01-15', status: 'Active', documentNumber: 'MORT-001' },
      { type: 'Tax', claimant: 'Harris County', amount: '$5,000', dateRecorded: '2023-01-01', status: 'Active' },
      { type: 'Mechanic', claimant: 'Roofers Inc', amount: '$3,000', dateRecorded: '2022-06-01', status: 'Released' },
    ];

    const sb = buildScheduleB([], liens, []);
    // Should have requirements for the 2 active liens + 2 standard requirements
    const lienRequirements = sb.requirements.filter(r => r.description.includes('lien'));
    expect(lienRequirements.length).toBe(2);
    expect(lienRequirements[0].description).toContain('First National Bank');
    expect(lienRequirements[0].description).toContain('$250,000');
    expect(lienRequirements[0].satisfied).toBe(false);
  });

  it('generates requirements from curable exceptions', () => {
    const exceptions: TitleException[] = [
      { type: 'Curable', description: 'Missing release of mortgage', explanation: 'Details here', remedy: 'Record a satisfaction of mortgage' },
      { type: 'Fatal', description: 'Gap in chain', explanation: 'Cannot be resolved easily' },
      { type: 'Info', description: 'Standard easement', explanation: 'Utility easement noted' },
    ];

    const sb = buildScheduleB([], [], exceptions);
    const curableReqs = sb.requirements.filter(r => r.description.includes('mortgage'));
    expect(curableReqs.length).toBeGreaterThan(0);
  });

  it('includes standard exceptions', () => {
    const sb = buildScheduleB([], [], []);
    const standards = sb.exceptions.filter(e => e.category === 'standard');
    expect(standards.length).toBe(5);
    expect(standards[0].description).toContain('parties in possession');
  });

  it('adds special exceptions for active liens', () => {
    const liens: Lien[] = [
      { type: 'Mortgage', claimant: 'Bank', dateRecorded: '2020', status: 'Active' },
    ];

    const sb = buildScheduleB([], liens, []);
    const special = sb.exceptions.filter(e => e.category === 'special');
    expect(special.length).toBeGreaterThan(0);
    expect(special[0].description).toContain('Mortgage');
    expect(special[0].description).toContain('[ACTIVE]');
  });

  it('detects gaps in chain of title', () => {
    const chain: OwnershipNode[] = [
      { id: 'n1', grantor: 'Alice', grantee: 'Bob', date: '2020', documentType: 'Deed' },
      { id: 'n2', grantor: 'Charlie', grantee: 'David', date: '2022', documentType: 'Deed' },
      // Gap: Bob -> Charlie missing
    ];

    const sb = buildScheduleB(chain, [], []);
    const gapExceptions = sb.exceptions.filter(e => e.description.includes('Gap in chain'));
    expect(gapExceptions.length).toBe(1);
    expect(gapExceptions[0].description).toContain('Bob');
    expect(gapExceptions[0].description).toContain('Charlie');
  });

  it('does not flag gaps when chain is continuous', () => {
    const chain: OwnershipNode[] = [
      { id: 'n1', grantor: 'Alice', grantee: 'Bob', date: '2020', documentType: 'Deed' },
      { id: 'n2', grantor: 'Bob', grantee: 'Charlie', date: '2022', documentType: 'Deed' },
    ];

    const sb = buildScheduleB(chain, [], []);
    const gapExceptions = sb.exceptions.filter(e => e.description.includes('Gap in chain'));
    expect(gapExceptions.length).toBe(0);
  });

  it('always includes standard payment and deed requirements', () => {
    const sb = buildScheduleB([], [], []);
    const paymentReq = sb.requirements.find(r => r.description.includes('real property taxes'));
    const deedReq = sb.requirements.find(r => r.description.includes('deed of conveyance'));
    expect(paymentReq).toBeDefined();
    expect(deedReq).toBeDefined();
  });
});
