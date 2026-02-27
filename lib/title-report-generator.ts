import { jsPDF } from 'jspdf';
import { TitleReportData } from '@/lib/agents/title-search/types';

const BRAND = {
  primary: [15, 118, 110] as [number, number, number],
  dark: [17, 24, 39] as [number, number, number],
  accent: [245, 158, 11] as [number, number, number],
  lightBg: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  green: [22, 163, 74] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  yellow: [234, 179, 8] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
};

const PW = 210;
const PH = 297;
const ML = 15;
const MR = 15;
const CW = PW - ML - MR;

function newPage(doc: jsPDF): number {
  doc.addPage();
  return 20;
}

function checkPage(doc: jsPDF, y: number, needed = 30): number {
  if (y > PH - needed) return newPage(doc);
  return y;
}

function sectionHeader(doc: jsPDF, title: string, y: number): number {
  y = checkPage(doc, y, 40);
  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(ML, y, CW, 8, 1, 1, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title, ML + 4, y + 5.5);
  doc.setTextColor(...BRAND.text);
  return y + 13;
}

function drawBadge(doc: jsPDF, text: string, x: number, y: number, color: [number, number, number]) {
  const w = doc.getStringUnitWidth(text) * 7 / doc.internal.scaleFactor + 4;
  doc.setFillColor(...color);
  doc.roundedRect(x, y - 3.5, w, 5, 1, 1, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text(text, x + 2, y + 0.2);
  doc.setTextColor(...BRAND.text);
  return w;
}

function confidenceBadge(doc: jsPDF, level: string, score: number, x: number, y: number) {
  const color = level === 'high' ? BRAND.green
    : level === 'medium' ? BRAND.yellow
    : level === 'low' ? BRAND.red
    : BRAND.muted;
  const label = `${level.toUpperCase()} ${score}%`;
  return drawBadge(doc, label, x, y, color);
}

export async function generateTitleReportPDF(data: TitleReportData): Promise<Buffer> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = 0;

  // ── Cover Header ──────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.dark);
  doc.rect(0, 0, PW, 44, 'F');
  doc.setFillColor(...BRAND.accent);
  doc.rect(0, 44, PW, 1.5, 'F');

  // Logo box
  doc.setFillColor(...BRAND.primary);
  doc.roundedRect(ML, 9, 22, 22, 3, 3, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TI', ML + 7, 23);

  // Title text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...BRAND.white);
  doc.text('PRELIMINARY TITLE COMMITMENT', ML + 28, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 200, 215);
  doc.text('Title AI  ·  AI-Powered  ·  ALTA Compliant Format', ML + 28, 26);
  doc.text(`Report Date: ${data.reportDate}`, ML + 28, 33);
  if (data.altaScheduleA?.commitmentNumber) {
    doc.text(`Commitment No: ${data.altaScheduleA.commitmentNumber}`, ML + 28, 39);
  }

  y = 54;

  // ── Overall Confidence Banner ─────────────────────────────────────────────
  if (data.overallConfidence) {
    y = checkPage(doc, y, 18);
    const conf = data.overallConfidence;
    const confColor = conf.level === 'high' ? BRAND.green
      : conf.level === 'medium' ? BRAND.yellow
      : conf.level === 'low' ? BRAND.red
      : BRAND.muted;

    doc.setFillColor(...confColor);
    doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
    doc.setTextColor(...BRAND.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(
      `DATA CONFIDENCE: ${conf.level.toUpperCase()} (${conf.score}%)  ·  ${data.sources?.length ?? 0} source(s) cited`,
      PW / 2, y + 4.5, { align: 'center' }
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text(
      conf.factors.slice(0, 2).join('  ·  '),
      PW / 2, y + 8.5, { align: 'center', maxWidth: CW - 10 }
    );
    y += 14;
  }

  // ── Property Card ─────────────────────────────────────────────────────────
  const propH = (data.parcelId || data.legalDescription) ? 34 : 24;
  doc.setFillColor(...BRAND.lightBg);
  doc.roundedRect(ML, y, CW, propH, 2, 2, 'F');
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.25);
  doc.roundedRect(ML, y, CW, propH, 2, 2, 'D');

  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...BRAND.primary);
  doc.text('SUBJECT PROPERTY', ML + 4, y);
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.dark);
  doc.text(data.propertyAddress, ML + 4, y, { maxWidth: CW - 8 });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.muted);
  let propLine = `County: ${data.county}`;
  if (data.parcelId) propLine += `   |   Parcel ID: ${data.parcelId}`;
  doc.text(propLine, ML + 4, y);
  y += 5;

  if (data.legalDescription) {
    const descLines = doc.splitTextToSize(`Legal Desc: ${data.legalDescription}`, CW - 8);
    doc.text(descLines.slice(0, 2), ML + 4, y);
    y += descLines.slice(0, 2).length * 3.5 + 2;
  }

  y += 2;
  doc.setFontSize(7);
  doc.text(`Data Source: ${data.dataSource || 'AI Analysis'}`, ML, y);
  y += 7;

  // ── ALTA Schedule A ───────────────────────────────────────────────────────
  if (data.altaScheduleA) {
    y = sectionHeader(doc, 'SCHEDULE A — COVERED TITLE & ESTATE', y);
    const sa = data.altaScheduleA;

    const rows = [
      ['Effective Date:', sa.effectiveDate],
      ['Estate Type:', sa.estateType],
      ['Vested Owner:', sa.vestedOwner],
      ['Commitment No:', sa.commitmentNumber],
    ];
    if (sa.policyAmount) rows.push(['Policy Amount:', sa.policyAmount]);

    for (const [label, value] of rows) {
      y = checkPage(doc, y, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.muted);
      doc.text(label, ML + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND.text);
      doc.text(value, ML + 40, y, { maxWidth: CW - 42 });
      y += 5;
    }

    // Legal description
    y = checkPage(doc, y, 15);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.muted);
    doc.text('Legal Description:', ML + 2, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...BRAND.text);
    const ldLines = doc.splitTextToSize(sa.legalDescription, CW - 6);
    doc.text(ldLines.slice(0, 4), ML + 2, y);
    y += ldLines.slice(0, 4).length * 4 + 5;
  }

  // ── Executive Summary ─────────────────────────────────────────────────────
  y = sectionHeader(doc, 'EXECUTIVE SUMMARY', y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.text);
  const summLines = doc.splitTextToSize(data.summary || 'No summary available.', CW - 4);
  for (const line of summLines) {
    y = checkPage(doc, y, 12);
    doc.text(line, ML + 2, y);
    y += 4.5;
  }
  y += 3;

  // ── Risk Banner ───────────────────────────────────────────────────────────
  y = checkPage(doc, y, 20);
  const activeLiens = data.liens.filter((l: any) => l.status === 'Active').length;
  const fatalEx = data.exceptions.filter((e: any) => e.type === 'Fatal').length;
  const riskColor = fatalEx > 0 ? BRAND.red : activeLiens > 0 ? BRAND.yellow : BRAND.green;
  const riskLabel = fatalEx > 0 ? 'HIGH RISK' : activeLiens > 0 ? 'MODERATE RISK' : 'LOW RISK';

  doc.setFillColor(...riskColor);
  doc.roundedRect(ML, y, CW, 11, 2, 2, 'F');
  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`OVERALL TITLE RISK: ${riskLabel}`, PW / 2, y + 5.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `${data.ownershipChain.length} ownership transfers  ·  ${activeLiens} active liens  ·  ${fatalEx} fatal exceptions`,
    PW / 2, y + 9.5, { align: 'center' }
  );
  y += 16;

  // ── Chain of Title ────────────────────────────────────────────────────────
  y = sectionHeader(doc, 'CHAIN OF TITLE  (OWNERSHIP HISTORY)', y);

  if (data.ownershipChain.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.muted);
    doc.text('No ownership records found in available documents.', ML + 2, y);
    y += 10;
  } else {
    data.ownershipChain.forEach((node: any, i: number) => {
      y = checkPage(doc, y, 28);
      const hasConfidence = !!node.confidence;
      const cardH = node.notes ? 28 : hasConfidence ? 24 : 20;

      doc.setFillColor(...BRAND.lightBg);
      doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, 'F');
      doc.setDrawColor(...BRAND.border);
      doc.setLineWidth(0.25);
      doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, 'D');

      // Number circle
      doc.setFillColor(...BRAND.primary);
      doc.circle(ML + 7, y + cardH / 2, 4, 'F');
      doc.setTextColor(...BRAND.white);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(String(i + 1), ML + 7, y + cardH / 2 + 1, { align: 'center' });

      // Connector line
      if (i < data.ownershipChain.length - 1) {
        doc.setDrawColor(...BRAND.primary);
        doc.setLineWidth(0.4);
        doc.line(ML + 7, y + cardH, ML + 7, y + cardH + 4);
      }

      const tx = ML + 15;
      doc.setTextColor(...BRAND.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const dateStr = `${node.date || ''}${node.recordingDate ? '  (Rec: ' + node.recordingDate + ')' : ''}`;
      doc.text(dateStr, tx, y + 5);

      // Confidence badge
      if (hasConfidence) {
        confidenceBadge(doc, node.confidence.level, node.confidence.score, PW - MR - 28, y + 3);
      }

      doc.setTextColor(...BRAND.dark);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`${node.grantor || '?'}  →  ${node.grantee || '?'}`, tx, y + 10, { maxWidth: CW - 45 });

      doc.setTextColor(...BRAND.muted);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const docInfo = [
        node.documentType,
        node.documentNumber ? `#${node.documentNumber}` : null,
        node.bookPage ? `Bk/Pg: ${node.bookPage}` : null,
      ].filter(Boolean).join('  ·  ');
      doc.text(docInfo || '', tx, y + 15, { maxWidth: CW - 20 });

      if (node.notes) {
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.muted);
        doc.text(`Note: ${node.notes}`, tx, y + 20, { maxWidth: CW - 20 });
      }

      y += cardH + 5;
    });
  }
  y += 3;

  // ── Liens ─────────────────────────────────────────────────────────────────
  y = sectionHeader(doc, 'LIENS & ENCUMBRANCES', y);

  if (data.liens.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.green);
    doc.text('No liens or encumbrances found in available documents.', ML + 2, y);
    y += 10;
  } else {
    // Table header
    doc.setFillColor(...BRAND.dark);
    doc.rect(ML, y - 1, CW, 6.5, 'F');
    doc.setTextColor(...BRAND.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const c = { status: ML + 1, type: ML + 22, claimant: ML + 44, amount: ML + 110, date: ML + 137, conf: ML + 163 };
    doc.text('STATUS', c.status, y + 3.5);
    doc.text('TYPE', c.type, y + 3.5);
    doc.text('CLAIMANT', c.claimant, y + 3.5);
    doc.text('AMOUNT', c.amount, y + 3.5);
    doc.text('RECORDED', c.date, y + 3.5);
    doc.text('CONF', c.conf, y + 3.5);
    y += 8;

    data.liens.forEach((lien: any, i: number) => {
      y = checkPage(doc, y, 12);
      doc.setFillColor(...(i % 2 === 0 ? BRAND.lightBg : BRAND.white));
      doc.rect(ML, y - 3, CW, 7.5, 'F');

      const sc = lien.status === 'Active' ? BRAND.red : lien.status === 'Released' ? BRAND.green : BRAND.yellow;
      drawBadge(doc, lien.status || 'Unknown', c.status, y + 1, sc);

      doc.setTextColor(...BRAND.text);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(String(lien.type || '-'), c.type, y + 1, { maxWidth: 20 });
      doc.text(String(lien.claimant || '-'), c.claimant, y + 1, { maxWidth: 64 });
      doc.text(String(lien.amount || '-'), c.amount, y + 1, { maxWidth: 24 });
      doc.text(String(lien.dateRecorded || '-'), c.date, y + 1, { maxWidth: 24 });

      // Confidence indicator
      if (lien.confidence) {
        const cl = lien.confidence.level === 'high' ? BRAND.green
          : lien.confidence.level === 'medium' ? BRAND.yellow : BRAND.red;
        doc.setFontSize(6.5);
        doc.setTextColor(...cl);
        doc.text(`${lien.confidence.score}%`, c.conf, y + 1);
      }

      y += 7.5;
    });
    y += 4;
  }

  // ── ALTA Schedule B — Requirements ────────────────────────────────────────
  if (data.altaScheduleB?.requirements && data.altaScheduleB.requirements.length > 0) {
    y = checkPage(doc, y, 40);
    y = sectionHeader(doc, 'SCHEDULE B — PART I: REQUIREMENTS', y);

    for (const req of data.altaScheduleB.requirements) {
      y = checkPage(doc, y, 14);
      const statusColor = req.satisfied ? BRAND.green : BRAND.yellow;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...statusColor);
      doc.text(req.number, ML + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.text);
      const reqLines = doc.splitTextToSize(req.description, CW - 20);
      doc.text(reqLines.slice(0, 2), ML + 16, y);
      y += Math.max(reqLines.slice(0, 2).length * 4, 5) + 3;
    }
    y += 3;
  }

  // ── ALTA Schedule B — Exceptions ──────────────────────────────────────────
  y = checkPage(doc, y, 50);
  y = sectionHeader(doc, 'SCHEDULE B — PART II: EXCEPTIONS FROM COVERAGE', y);

  if (data.altaScheduleB?.exceptions && data.altaScheduleB.exceptions.length > 0) {
    for (const ex of data.altaScheduleB.exceptions) {
      y = checkPage(doc, y, 14);

      const catColor = ex.category === 'standard' ? BRAND.muted : BRAND.accent;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...catColor);
      doc.text(`${ex.number}.`, ML + 2, y);

      if (ex.category === 'standard') {
        drawBadge(doc, 'STANDARD', ML + 10, y, BRAND.muted);
      } else {
        drawBadge(doc, 'SPECIAL', ML + 10, y, BRAND.accent);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.text);
      const exLines = doc.splitTextToSize(ex.description, CW - 30);
      doc.text(exLines.slice(0, 3), ML + 28, y);
      y += Math.max(exLines.slice(0, 3).length * 4, 5) + 3;
    }
  } else if (data.exceptions.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...BRAND.green);
    doc.text('No title exceptions identified. Title appears marketable.', ML + 2, y);
    y += 10;
  } else {
    // Fallback to old-style exception rendering if no ALTA data
    data.exceptions.forEach((ex: any, i: number) => {
      y = checkPage(doc, y, 38);
      const exColor = ex.type === 'Fatal' ? BRAND.red : ex.type === 'Curable' ? BRAND.yellow : BRAND.primary;
      const cardH = ex.remedy ? 30 : 24;

      doc.setFillColor(...BRAND.lightBg);
      doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, 'F');
      doc.setDrawColor(...exColor);
      doc.setLineWidth(0.7);
      doc.line(ML, y + 2, ML, y + cardH - 2);
      doc.setDrawColor(...BRAND.border);
      doc.setLineWidth(0.25);
      doc.roundedRect(ML, y, CW, cardH, 1.5, 1.5, 'D');

      const tx = ML + 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...BRAND.dark);
      doc.text(`${i + 1}. ${ex.description}`, tx, y + 5.5, { maxWidth: CW - 25 });
      drawBadge(doc, ex.type.toUpperCase(), PW - MR - 25, y + 3, exColor);

      // Confidence badge for exception
      if (ex.confidence) {
        confidenceBadge(doc, ex.confidence.level, ex.confidence.score, PW - MR - 55, y + 3);
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.text);
      const expLines = doc.splitTextToSize(ex.explanation, CW - 9);
      expLines.slice(0, 2).forEach((line: string, li: number) => {
        doc.text(line, tx, y + 11 + li * 4.5);
      });

      if (ex.remedy) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND.muted);
        doc.text(`Remedy: ${ex.remedy}`, tx, y + 25, { maxWidth: CW - 9 });
      }

      y += cardH + 5;
    });
  }

  // ── Source Citations ──────────────────────────────────────────────────────
  if (data.sources && data.sources.length > 0) {
    y = checkPage(doc, y, 40);
    y = sectionHeader(doc, 'SOURCE CITATIONS & PROVENANCE', y);

    for (let i = 0; i < data.sources.length; i++) {
      const src = data.sources[i];
      y = checkPage(doc, y, 16);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.blue);
      doc.text(`[${i + 1}]`, ML + 2, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND.text);
      doc.text(src.sourceName, ML + 10, y, { maxWidth: CW - 15 });
      y += 4;

      doc.setFontSize(6.5);
      doc.setTextColor(...BRAND.muted);
      const sourceTypeBadge = src.sourceType === 'nova_act' ? 'OFFICIAL RECORDS'
        : src.sourceType === 'tavily_search' ? 'WEB SEARCH'
        : src.sourceType === 'mock_demo' ? 'DEMO DATA'
        : src.sourceType.toUpperCase();
      doc.text(`Source: ${sourceTypeBadge}  |  Retrieved: ${src.retrievedAt}`, ML + 10, y);
      y += 3.5;

      if (src.url && src.url !== 'http://mock-registry.gov/') {
        doc.setTextColor(...BRAND.blue);
        doc.text(src.url.slice(0, 80), ML + 10, y, { maxWidth: CW - 15 });
        y += 3.5;
      }

      if (src.excerpt) {
        doc.setTextColor(...BRAND.muted);
        doc.setFontSize(6);
        const excerptLines = doc.splitTextToSize(`"${src.excerpt.slice(0, 200)}..."`, CW - 15);
        doc.text(excerptLines.slice(0, 2), ML + 10, y);
        y += excerptLines.slice(0, 2).length * 3 + 2;
      }

      y += 3;
    }
  }

  // ── Review Status ─────────────────────────────────────────────────────────
  if (data.reviewStatus) {
    y = checkPage(doc, y, 20);
    const reviewColor = data.reviewStatus === 'approved' ? BRAND.green
      : data.reviewStatus === 'rejected' ? BRAND.red
      : BRAND.yellow;
    const reviewLabel = data.reviewStatus.replace(/_/g, ' ').toUpperCase();

    doc.setFillColor(...BRAND.lightBg);
    doc.roundedRect(ML, y, CW, 10, 2, 2, 'F');
    doc.setDrawColor(...reviewColor);
    doc.setLineWidth(0.5);
    doc.roundedRect(ML, y, CW, 10, 2, 2, 'D');

    doc.setTextColor(...reviewColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(`REVIEW STATUS: ${reviewLabel}`, ML + 4, y + 6);

    if (data.reviewStatus === 'pending_review') {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...BRAND.muted);
      doc.text('This report awaits review by a licensed title examiner before it can be relied upon.', ML + 60, y + 6);
    }
    y += 15;
  }

  // ── Page Footers ──────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFillColor(...BRAND.dark);
    doc.rect(0, PH - 11, PW, 11, 'F');
    doc.setTextColor(140, 160, 180);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(
      'DISCLAIMER: AI-generated report for informational purposes only. Not a legal opinion or title insurance commitment. Must be reviewed by a licensed title examiner.',
      PW / 2, PH - 6.5, { align: 'center', maxWidth: PW - 30 }
    );
    doc.text(`Page ${p} of ${pageCount}  ·  Title AI Nova  ·  ${data.reportDate}  ·  ALTA-Format Preliminary Report`, PW / 2, PH - 2.5, { align: 'center' });
  }

  return Buffer.from(doc.output('arraybuffer'));
}
