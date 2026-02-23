/**
 * Title search persistence — backed by Turso (libSQL).
 *
 * Required env vars (set in Vercel):
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=your-token
 */
import { createClient, type Client } from '@libsql/client';

let _client: Client | null = null;

function getClient(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set');
  _client = createClient({ url, authToken });
  return _client;
}

// ─── Schema ────────────────────────────────────────────────────

async function ensureTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS title_searches (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      address    TEXT NOT NULL,
      county     TEXT NOT NULL,
      parcel_id  TEXT,
      source     TEXT,
      report     TEXT NOT NULL DEFAULT '{}',
      screenshots TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migrate: add screenshots column to existing tables that lack it
  try {
    await db.execute(`ALTER TABLE title_searches ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists — ignore "duplicate column" error
  }
}

async function ensureJobsTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS title_jobs (
      id           TEXT PRIMARY KEY,
      address      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'queued',
      current_step TEXT,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      logs         TEXT NOT NULL DEFAULT '[]',
      result       TEXT,
      screenshots  TEXT NOT NULL DEFAULT '[]',
      error        TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  try {
    await db.execute(`ALTER TABLE title_jobs ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists — ignore
  }
}

// ─── Types ─────────────────────────────────────────────────────

export interface ScreenshotRecord {
  label: string;
  step: string;
  data: string; // base64 jpeg
}

export interface TitleSearchRow {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  report: any;
  screenshots: ScreenshotRecord[];
  created_at: string;
}

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface TitleJobRow {
  id: string;
  address: string;
  status: JobStatus;
  current_step: string | null;
  progress_pct: number;
  logs: string[];
  result: any | null;
  screenshots: ScreenshotRecord[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function parseJson(val: unknown, fallback: any = null): any {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val as string); } catch { return fallback; }
}

// ─── Title Searches CRUD ───────────────────────────────────────

export async function saveSearch(
  address: string,
  county: string,
  parcelId: string | null,
  source: string | null,
  report: object,
  screenshots: ScreenshotRecord[] = [],
): Promise<number> {
  await ensureTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `INSERT INTO title_searches (address, county, parcel_id, source, report, screenshots)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [address, county, parcelId, source, JSON.stringify(report), JSON.stringify(screenshots)],
  });
  return rs.rows[0].id as number;
}

export async function getRecentSearches(limit = 20): Promise<TitleSearchRow[]> {
  await ensureTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `SELECT id, address, county, parcel_id, source, report, screenshots, created_at
          FROM title_searches ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return rs.rows.map(r => ({
    id: r.id as number,
    address: r.address as string,
    county: r.county as string,
    parcel_id: r.parcel_id as string | null,
    source: r.source as string | null,
    report: parseJson(r.report, {}),
    screenshots: parseJson(r.screenshots, []),
    created_at: String(r.created_at),
  }));
}

export async function getSearch(id: number): Promise<TitleSearchRow | null> {
  await ensureTable();
  const db = getClient();
  const rs = await db.execute({ sql: `SELECT * FROM title_searches WHERE id = ?`, args: [id] });
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return {
    id: r.id as number,
    address: r.address as string,
    county: r.county as string,
    parcel_id: r.parcel_id as string | null,
    source: r.source as string | null,
    report: parseJson(r.report, {}),
    screenshots: parseJson(r.screenshots, []),
    created_at: String(r.created_at),
  };
}

// ─── Durable Jobs CRUD ────────────────────────────────────────

export async function createJob(id: string, address: string): Promise<void> {
  await ensureJobsTable();
  const db = getClient();
  await db.execute({
    sql: `INSERT INTO title_jobs (id, address, status, progress_pct, logs, screenshots)
          VALUES (?, ?, 'queued', 0, '[]', '[]')`,
    args: [id, address],
  });
}

export async function updateJob(
  id: string,
  patch: {
    status?: JobStatus;
    current_step?: string;
    progress_pct?: number;
    log?: string;
    result?: object;
    screenshots?: ScreenshotRecord[];
    error?: string;
  },
): Promise<void> {
  await ensureJobsTable();
  const db = getClient();

  // Build SET clauses dynamically
  const sets: string[] = [];
  const args: any[] = [];

  if (patch.status !== undefined) { sets.push('status = ?'); args.push(patch.status); }
  if (patch.current_step !== undefined) { sets.push('current_step = ?'); args.push(patch.current_step); }
  if (patch.progress_pct !== undefined) { sets.push('progress_pct = ?'); args.push(patch.progress_pct); }
  if (patch.error !== undefined) { sets.push('error = ?'); args.push(patch.error); }
  if (patch.result !== undefined) { sets.push('result = ?'); args.push(JSON.stringify(patch.result)); }

  if (patch.log) {
    // Append log entry: read current, parse, append, write back
    sets.push("logs = json_insert(logs, '$[#]', ?)");
    args.push(patch.log);
  }
  if (patch.screenshots && patch.screenshots.length > 0) {
    // Append screenshots
    for (const s of patch.screenshots) {
      sets.push("screenshots = json_insert(screenshots, '$[#]', json(?))");
      args.push(JSON.stringify(s));
    }
  }

  sets.push("updated_at = datetime('now')");

  if (sets.length === 1) return; // only updated_at, skip

  args.push(id);
  await db.execute({
    sql: `UPDATE title_jobs SET ${sets.join(', ')} WHERE id = ?`,
    args,
  });
}

export async function getJob(id: string): Promise<TitleJobRow | null> {
  await ensureJobsTable();
  const db = getClient();
  const rs = await db.execute({ sql: `SELECT * FROM title_jobs WHERE id = ?`, args: [id] });
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return {
    id: r.id as string,
    address: r.address as string,
    status: r.status as JobStatus,
    current_step: r.current_step as string | null,
    progress_pct: r.progress_pct as number,
    logs: parseJson(r.logs, []),
    result: parseJson(r.result, null),
    screenshots: parseJson(r.screenshots, []),
    error: r.error as string | null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getRecentJobs(limit = 20): Promise<TitleJobRow[]> {
  await ensureJobsTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `SELECT * FROM title_jobs ORDER BY created_at DESC LIMIT ?`,
    args: [limit],
  });
  return rs.rows.map(r => ({
    id: r.id as string,
    address: r.address as string,
    status: r.status as JobStatus,
    current_step: r.current_step as string | null,
    progress_pct: r.progress_pct as number,
    logs: parseJson(r.logs, []),
    result: parseJson(r.result, null),
    screenshots: parseJson(r.screenshots, []),
    error: r.error as string | null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}
