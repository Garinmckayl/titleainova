import {
  TextractClient,
  AnalyzeDocumentCommand,
  StartDocumentTextDetectionCommand,
  GetDocumentTextDetectionCommand,
  DetectDocumentTextCommand,
  FeatureType,
} from "@aws-sdk/client-textract";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { PDFDocument } from "pdf-lib";

// --- Clients ---

const awsRegion = process.env.AWS_REGION || "us-east-1";
const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
};

if (!awsCreds.accessKeyId || !awsCreds.secretAccessKey) {
  console.warn(
    "[Textract] WARNING: AWS credentials not set. " +
      "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local"
  );
}

const textract = new TextractClient({ region: awsRegion, credentials: awsCreds });

// S3 client for Textract temp bucket (async path needs S3)
const TEXTRACT_BUCKET = process.env.TEXTRACT_S3_BUCKET || "homestand-textract-temp";
const s3Client = new S3Client({ region: awsRegion, credentials: awsCreds });

const FETCH_TIMEOUT = 60_000; // 60s to download a PDF
const MAX_PAGES = 3000; // Textract hard limit
const SYNC_PAGE_THRESHOLD = 4; // Use sync API for docs <= 4 pages
const ASYNC_TIMEOUT_MS = 300_000; // 5 min polling timeout

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

// ─── Download ────────────────────────────────────────────────────────────────

/**
 * Download a PDF from a URL and return it as a Buffer.
 * No artificial size limit — Textract async handles up to 500MB.
 * Returns null if unreachable or not a PDF.
 */
async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TitleAI/1.0)" },
    });

    if (!res.ok) {
      console.warn(`[Textract] Download failed: HTTP ${res.status} for ${url}`);
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !url.toLowerCase().endsWith(".pdf")) {
      console.warn(`[Textract] Not a PDF (content-type: ${contentType}): ${url}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate it's actually a PDF (check magic bytes)
    if (buffer.length < 5 || buffer.subarray(0, 4).toString("ascii") !== "%PDF") {
      console.warn(`[Textract] Not a valid PDF (bad magic bytes): ${url}`);
      return null;
    }

    console.log(`[Textract] Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)}MB from ${url}`);
    return buffer;
  } catch (err: any) {
    console.warn(`[Textract] Failed to download ${url}: ${err.message}`);
    return null;
  }
}

// ─── Main entry: extractTextFromPdf ──────────────────────────────────────────

/**
 * Extract text and structured data from a PDF buffer using AWS Textract.
 *
 * Strategy (mirrors homestandai/lib/ocr-amazon.ts):
 *  - PDFs <= 4 pages: sync AnalyzeDocument (gets forms + tables) per page
 *  - PDFs > 4 pages: async StartDocumentTextDetection via S3
 *    (Textract processes all pages server-side, handles up to 3000 pages)
 */
export async function extractTextFromPdf(
  pdfBuffer: Buffer
): Promise<TextractResult> {
  // Validate PDF with pdf-lib
  let pageCount = 0;
  try {
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
  } catch (e: any) {
    console.warn(`[Textract] PDF corrupt/invalid: ${e.message}`);
    // Try sending raw bytes anyway — Textract sometimes handles PDFs that pdf-lib can't
    return extractSyncSingleCall(pdfBuffer);
  }

  if (pageCount === 0) {
    return { text: "", pageCount: 0, formFields: {}, tables: [] };
  }

  if (pageCount > MAX_PAGES) {
    console.warn(`[Textract] Document too large (${pageCount} pages, max ${MAX_PAGES}). Truncating.`);
    pageCount = MAX_PAGES;
  }

  console.log(`[Textract] PDF has ${pageCount} pages`);

  // Small docs: sync path with AnalyzeDocument (gets forms + tables)
  if (pageCount <= SYNC_PAGE_THRESHOLD) {
    return extractSyncPages(pdfBuffer, pageCount);
  }

  // Large docs: async path via S3
  return extractAsync(pdfBuffer, pageCount);
}

// ─── Sync: AnalyzeDocument per page (forms + tables) ────────────────────────

/**
 * Process each page individually with AnalyzeDocument (FORMS + TABLES).
 * Gives us structured key-value pairs and table data.
 * Processes in batches of 5 to respect Textract TPS limits.
 */
async function extractSyncPages(
  pdfBuffer: Buffer,
  pageCount: number
): Promise<TextractResult> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const limit = Math.min(doc.getPageCount(), pageCount);

  console.log(`[Textract] [sync] Processing ${limit} pages with AnalyzeDocument...`);

  const allLines: string[] = [];
  const allFormFields: Record<string, string> = {};
  const allTables: string[][] = [];
  let totalPages = 0;

  const BATCH = 5;
  for (let i = 0; i < limit; i += BATCH) {
    const batch: Promise<void>[] = [];
    for (let j = 0; j < BATCH && i + j < limit; j++) {
      const pageIdx = i + j;
      batch.push(
        (async () => {
          try {
            // Extract single page as its own PDF
            const singlePdf = await PDFDocument.create();
            const [copied] = await singlePdf.copyPages(doc, [pageIdx]);
            singlePdf.addPage(copied);
            const bytes = new Uint8Array(await singlePdf.save());

            // Try AnalyzeDocument first (forms + tables)
            try {
              const response = await textract.send(
                new AnalyzeDocumentCommand({
                  Document: { Bytes: bytes },
                  FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
                })
              );

              const blocks = response.Blocks || [];
              const { lines, formFields, tables } = parseAnalyzeBlocks(blocks);

              allLines.push(`\n--- Page ${pageIdx + 1} ---`);
              allLines.push(...lines);
              Object.assign(allFormFields, formFields);
              allTables.push(...tables);
              totalPages++;
            } catch (analyzeErr: any) {
              // Fall back to DetectDocumentText if AnalyzeDocument fails
              console.warn(
                `[Textract] AnalyzeDocument failed for page ${pageIdx + 1}: ${analyzeErr.message}, trying DetectDocumentText`
              );
              const resp = await textract.send(
                new DetectDocumentTextCommand({ Document: { Bytes: bytes } })
              );
              const lines = (resp.Blocks || [])
                .filter((b) => b.BlockType === "LINE")
                .map((b) => b.Text || "")
                .filter(Boolean);

              allLines.push(`\n--- Page ${pageIdx + 1} ---`);
              allLines.push(...lines);
              totalPages++;
            }
          } catch (err: any) {
            console.warn(`[Textract] Page ${pageIdx + 1} failed: ${err.message}`);
          }
        })()
      );
    }
    await Promise.all(batch);
  }

  return {
    text: allLines.join("\n"),
    pageCount: totalPages,
    formFields: allFormFields,
    tables: allTables,
  };
}

/**
 * Fallback: send raw bytes in a single AnalyzeDocument call.
 * Used when pdf-lib can't parse the PDF but Textract might still handle it.
 */
async function extractSyncSingleCall(pdfBuffer: Buffer): Promise<TextractResult> {
  const bytes = new Uint8Array(pdfBuffer);

  try {
    const response = await textract.send(
      new AnalyzeDocumentCommand({
        Document: { Bytes: bytes },
        FeatureTypes: [FeatureType.FORMS, FeatureType.TABLES],
      })
    );

    const blocks = response.Blocks || [];
    const { lines, formFields, tables } = parseAnalyzeBlocks(blocks);
    const pageBlocks = blocks.filter((b) => b.BlockType === "PAGE");

    return {
      text: lines.join("\n"),
      pageCount: pageBlocks.length || 1,
      formFields,
      tables,
    };
  } catch (err: any) {
    // Try plain text detection as last resort
    if (
      err.name === "UnsupportedDocumentException" ||
      err.message?.includes("multi-page") ||
      err.message?.includes("unsupported")
    ) {
      console.warn(`[Textract] AnalyzeDocument failed, trying DetectDocumentText: ${err.message}`);
      try {
        const resp = await textract.send(
          new DetectDocumentTextCommand({ Document: { Bytes: bytes } })
        );
        const blocks = resp.Blocks || [];
        const textLines = blocks
          .filter((b) => b.BlockType === "LINE")
          .map((b) => b.Text || "")
          .filter(Boolean);
        const pageBlocks = blocks.filter((b) => b.BlockType === "PAGE");

        return {
          text: textLines.join("\n"),
          pageCount: pageBlocks.length || 1,
          formFields: {},
          tables: [],
        };
      } catch (detectErr: any) {
        console.error(`[Textract] DetectDocumentText also failed: ${detectErr.message}`);
      }
    }
    throw err;
  }
}

// ─── Async: S3 upload + StartDocumentTextDetection ───────────────────────────

/**
 * Upload PDF to S3, start async Textract job, poll for results.
 * Handles up to 3000 pages / 500MB. Falls back to sync on S3 failure.
 */
async function extractAsync(
  pdfBuffer: Buffer,
  pageCount: number
): Promise<TextractResult> {
  const jobKey = `textract-jobs/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;

  console.log(
    `[Textract] [async] Uploading ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB PDF to S3 (${pageCount} pages)...`
  );

  // 1. Upload to S3
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: TEXTRACT_BUCKET,
        Key: jobKey,
        Body: pdfBuffer,
        ContentType: "application/pdf",
      })
    );
  } catch (e: any) {
    console.error(`[Textract] S3 upload failed: ${e.message}`);
    console.log(`[Textract] Falling back to sync approach...`);
    return extractSyncPages(pdfBuffer, Math.min(pageCount, SYNC_PAGE_THRESHOLD));
  }

  try {
    // 2. Start async Textract job
    const startResp = await textract.send(
      new StartDocumentTextDetectionCommand({
        DocumentLocation: {
          S3Object: { Bucket: TEXTRACT_BUCKET, Name: jobKey },
        },
      })
    );

    const jobId = startResp.JobId;
    if (!jobId) throw new Error("No JobId returned from Textract");

    console.log(`[Textract] [async] Job ${jobId.slice(0, 12)}... started, polling...`);

    // 3. Poll for completion with exponential backoff
    const startTime = Date.now();
    let status = "IN_PROGRESS";
    let pollDelay = 2000;

    while (status === "IN_PROGRESS") {
      if (Date.now() - startTime > ASYNC_TIMEOUT_MS) {
        throw new Error(`Textract job timed out after ${ASYNC_TIMEOUT_MS / 1000}s`);
      }
      await new Promise((r) => setTimeout(r, pollDelay));
      pollDelay = Math.min(pollDelay * 1.3, 10000);

      const getResp = await textract.send(
        new GetDocumentTextDetectionCommand({ JobId: jobId })
      );
      status = getResp.JobStatus || "FAILED";

      if (status === "SUCCEEDED") {
        // 4. Collect all paginated result pages
        let allBlocks = getResp.Blocks || [];
        let nextToken = getResp.NextToken;

        while (nextToken) {
          const more = await textract.send(
            new GetDocumentTextDetectionCommand({
              JobId: jobId,
              NextToken: nextToken,
            })
          );
          allBlocks = allBlocks.concat(more.Blocks || []);
          nextToken = more.NextToken;
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(
          `[Textract] [async] Done in ${elapsed}s, ${allBlocks.length} blocks from ${pageCount} pages`
        );

        // Parse blocks grouped by page
        const text = parseBlocksByPage(allBlocks);
        const pageBlocks = allBlocks.filter((b) => b.BlockType === "PAGE");

        return {
          text,
          pageCount: pageBlocks.length || pageCount,
          formFields: {}, // async path is text-only (no FORMS/TABLES)
          tables: [],
        };
      }

      if (status === "FAILED") {
        console.error("[Textract] Async job failed");
        throw new Error("Textract async job failed");
      }
    }

    return { text: "", pageCount: 0, formFields: {}, tables: [] };
  } finally {
    // 5. Cleanup: delete temp S3 object
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: TEXTRACT_BUCKET, Key: jobKey })
      );
    } catch {
      /* non-critical */
    }
  }
}

// ─── Block Parsers ───────────────────────────────────────────────────────────

/** Parse blocks from async response grouped by page number */
function parseBlocksByPage(blocks: any[]): string {
  if (!blocks || blocks.length === 0) return "";

  const pageMap = new Map<number, string[]>();

  for (const block of blocks) {
    if (block.BlockType !== "LINE") continue;
    const pageNum = block.Page || 1;
    if (!pageMap.has(pageNum)) pageMap.set(pageNum, []);
    pageMap.get(pageNum)!.push(block.Text || "");
  }

  const sortedPages = [...pageMap.entries()].sort((a, b) => a[0] - b[0]);
  return sortedPages
    .map(([pageNum, lines]) => `\n--- Page ${pageNum} ---\n${lines.join("\n")}`)
    .join("");
}

/**
 * Parse AnalyzeDocument blocks into structured text, form fields, and tables.
 */
function parseAnalyzeBlocks(blocks: any[]): {
  lines: string[];
  formFields: Record<string, string>;
  tables: string[][];
} {
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
        const keyText = (block.Relationships || [])
          .filter((r: any) => r.Type === "CHILD")
          .flatMap((r: any) => r.Ids || [])
          .map((id: string) => blocks.find((b) => b.Id === id)?.Text || "")
          .join(" ")
          .trim();
        if (block.Id) keyMap.set(block.Id, keyText);

        const valueIds = (block.Relationships || [])
          .filter((r: any) => r.Type === "VALUE")
          .flatMap((r: any) => r.Ids || []);
        if (block.Id) keyValueMap.set(block.Id, valueIds);
      } else if (block.EntityTypes?.includes("VALUE")) {
        const valueText = (block.Relationships || [])
          .filter((r: any) => r.Type === "CHILD")
          .flatMap((r: any) => r.Ids || [])
          .map((id: string) => blocks.find((b) => b.Id === id)?.Text || "")
          .join(" ")
          .trim();
        if (block.Id) valueMap.set(block.Id, valueText);
      }
    }
  }

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
      .filter((r: any) => r.Type === "CHILD")
      .flatMap((r: any) => r.Ids || []);

    const cells = cellIds
      .map((id: string) => blocks.find((b) => b.Id === id))
      .filter(Boolean);

    const rowMap = new Map<number, Map<number, string>>();
    for (const cell of cells) {
      if (!cell) continue;
      const row = cell.RowIndex || 0;
      const col = cell.ColumnIndex || 0;
      const text = (cell.Relationships || [])
        .filter((r: any) => r.Type === "CHILD")
        .flatMap((r: any) => r.Ids || [])
        .map((id: string) => blocks.find((b) => b.Id === id)?.Text || "")
        .join(" ")
        .trim();

      if (!rowMap.has(row)) rowMap.set(row, new Map());
      rowMap.get(row)!.set(col, text);
    }

    for (const [, cols] of [...rowMap].sort(([a], [b]) => a - b)) {
      const row: string[] = [];
      for (const [, text] of [...cols].sort(([a], [b]) => a - b)) {
        row.push(text);
      }
      tables.push(row);
    }
  }

  return { lines, formFields, tables };
}

// ─── Public API: extractPdfFromUrl ───────────────────────────────────────────

/**
 * Download and extract text from a PDF URL using AWS Textract.
 * No size limit — handles everything from 1-page deeds to 500-page documents.
 * Returns null if the PDF can't be downloaded or processed.
 */
export async function extractPdfFromUrl(
  url: string
): Promise<TextractResult | null> {
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
