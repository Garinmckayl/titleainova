import {
  TextractClient,
  AnalyzeDocumentCommand,
  DetectDocumentTextCommand,
  FeatureType,
} from "@aws-sdk/client-textract";

const textract = new TextractClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const MAX_PDF_SIZE = 10 * 1024 * 1024; // Textract sync limit: 10MB
const FETCH_TIMEOUT = 30_000; // 30s to download a PDF

/**
 * Download a PDF from a URL and return it as a Buffer.
 * Returns null if the file is too large, unreachable, or not a PDF.
 */
async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TitleAI/1.0)" },
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      return null;
    }

    // Check content-length before downloading
    const contentLength = parseInt(res.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_PDF_SIZE) {
      console.warn(`[Textract] Skipping ${url} — too large (${(contentLength / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_PDF_SIZE) {
      console.warn(`[Textract] Downloaded PDF too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
      return null;
    }

    return buffer;
  } catch (err: any) {
    console.warn(`[Textract] Failed to download ${url}: ${err.message}`);
    return null;
  }
}

export interface TextractResult {
  /** Extracted raw text from the PDF */
  text: string;
  /** Number of pages processed */
  pageCount: number;
  /** Key-value pairs extracted from forms (if any) */
  formFields: Record<string, string>;
  /** Tables extracted (if any) */
  tables: string[][];
}

/**
 * Extract text and structured data from a PDF using AWS Textract.
 * Uses synchronous AnalyzeDocument for PDFs under 10MB (single-page)
 * or DetectDocumentText for multi-page text extraction.
 *
 * For documents under 10MB, Textract's synchronous API handles them
 * in a single call. For the title search use case, most county recorder
 * PDFs are 1-5 pages (deeds, liens, tax certs).
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<TextractResult> {
  const bytes = new Uint8Array(pdfBuffer);

  // Use AnalyzeDocument with FORMS + TABLES for structured extraction
  // This gets us key-value pairs (grantor/grantee names, dates, amounts)
  // plus any tabular data (lien schedules, ownership tables)
  try {
    const response = await textract.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: bytes },
        FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
      })
    );

    const blocks = response.Blocks || [];

    // Extract raw text from LINE blocks
    const lines = blocks
      .filter((b) => b.BlockType === "LINE")
      .map((b) => b.Text || "")
      .filter(Boolean);

    // Extract form key-value pairs
    const formFields: Record<string, string> = {};
    const keyMap = new Map<string, string>();
    const valueMap = new Map<string, string>();
    const keyValueMap = new Map<string, string[]>();

    for (const block of blocks) {
      if (block.BlockType === "KEY_VALUE_SET") {
        if (block.EntityTypes?.includes("KEY")) {
          // Get the key text
          const keyText = (block.Relationships || [])
            .filter((r) => r.Type === "CHILD")
            .flatMap((r) => r.Ids || [])
            .map((id) => blocks.find((b) => b.Id === id)?.Text || "")
            .join(" ")
            .trim();
          if (block.Id) keyMap.set(block.Id, keyText);

          // Get the associated value IDs
          const valueIds = (block.Relationships || [])
            .filter((r) => r.Type === "VALUE")
            .flatMap((r) => r.Ids || []);
          if (block.Id) keyValueMap.set(block.Id, valueIds);
        } else if (block.EntityTypes?.includes("VALUE")) {
          const valueText = (block.Relationships || [])
            .filter((r) => r.Type === "CHILD")
            .flatMap((r) => r.Ids || [])
            .map((id) => blocks.find((b) => b.Id === id)?.Text || "")
            .join(" ")
            .trim();
          if (block.Id) valueMap.set(block.Id, valueText);
        }
      }
    }

    // Link keys to values
    for (const [keyId, keyText] of keyMap) {
      const valueIds = keyValueMap.get(keyId) || [];
      for (const vid of valueIds) {
        const valueText = valueMap.get(vid);
        if (keyText && valueText) {
          formFields[keyText] = valueText;
        }
      }
    }

    // Extract tables
    const tables: string[][] = [];
    const tableBlocks = blocks.filter((b) => b.BlockType === "TABLE");
    for (const table of tableBlocks) {
      const cellIds = (table.Relationships || [])
        .filter((r) => r.Type === "CHILD")
        .flatMap((r) => r.Ids || []);

      const cells = cellIds
        .map((id) => blocks.find((b) => b.Id === id))
        .filter(Boolean);

      // Group by row
      const rowMap = new Map<number, Map<number, string>>();
      for (const cell of cells) {
        if (!cell) continue;
        const row = cell.RowIndex || 0;
        const col = cell.ColumnIndex || 0;
        const text = (cell.Relationships || [])
          .filter((r) => r.Type === "CHILD")
          .flatMap((r) => r.Ids || [])
          .map((id) => blocks.find((b) => b.Id === id)?.Text || "")
          .join(" ")
          .trim();

        if (!rowMap.has(row)) rowMap.set(row, new Map());
        rowMap.get(row)!.set(col, text);
      }

      // Convert to array
      for (const [, cols] of [...rowMap].sort(([a], [b]) => a - b)) {
        const row: string[] = [];
        for (const [, text] of [...cols].sort(([a], [b]) => a - b)) {
          row.push(text);
        }
        tables.push(row);
      }
    }

    // Count pages
    const pageBlocks = blocks.filter((b) => b.BlockType === "PAGE");
    const pageCount = pageBlocks.length || 1;

    return {
      text: lines.join("\n"),
      pageCount,
      formFields,
      tables,
    };
  } catch (err: any) {
    // If AnalyzeDocument fails (e.g. multi-page PDF), fall back to DetectDocumentText
    if (err.name === "UnsupportedDocumentException" || err.message?.includes("multi-page")) {
      console.warn("[Textract] AnalyzeDocument failed, falling back to DetectDocumentText");
      return extractTextOnly(bytes);
    }
    throw err;
  }
}

/**
 * Simple text-only extraction using DetectDocumentText.
 * Works for single-page documents when AnalyzeDocument fails.
 */
async function extractTextOnly(bytes: Uint8Array): Promise<TextractResult> {
  const response = await textract.send(
    new DetectDocumentTextCommand({
      Document: { Bytes: bytes },
    })
  );

  const blocks = response.Blocks || [];
  const lines = blocks
    .filter((b) => b.BlockType === "LINE")
    .map((b) => b.Text || "")
    .filter(Boolean);

  const pageBlocks = blocks.filter((b) => b.BlockType === "PAGE");

  return {
    text: lines.join("\n"),
    pageCount: pageBlocks.length || 1,
    formFields: {},
    tables: [],
  };
}

/**
 * Download and extract text from a PDF URL using AWS Textract.
 * Returns null if the PDF can't be downloaded or processed.
 */
export async function extractPdfFromUrl(url: string): Promise<TextractResult | null> {
  const buffer = await downloadPdf(url);
  if (!buffer) return null;

  try {
    const result = await extractTextFromPdf(buffer);
    console.log(
      `[Textract] Extracted ${result.text.length} chars, ${result.pageCount} pages, ` +
      `${Object.keys(result.formFields).length} form fields, ${result.tables.length} table rows from ${url}`
    );
    return result;
  } catch (err: any) {
    console.error(`[Textract] Failed to process ${url}: ${err.message}`);
    return null;
  }
}
