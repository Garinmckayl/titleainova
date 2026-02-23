/**
 * Title search persistence — backed by Neon PostgreSQL (same DB as legalmindznova)
 *
 * Accepts either DATABASE_URL or TURSO_DATABASE_URL (for Vercel deployments
 * where the env var was originally named after Turso).
 *
 * Set one of these in .env.local / Vercel env vars:
 *   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
 *   TURSO_DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
 */
import { neon } from '@neondatabase/serverless';

function getSql() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL (or TURSO_DATABASE_URL) is not set. Add the Neon PostgreSQL connection string to your environment.');
  return neon(url);
}

// Create table on first use
async function ensureTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS title_searches (
      id         SERIAL PRIMARY KEY,
      address    TEXT NOT NULL,
      county     TEXT NOT NULL,
      parcel_id  TEXT,
      source     TEXT,
      report     JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export interface TitleSearchRow {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  report: object;
  created_at: string;
}

export async function saveSearch(
  address: string,
  county: string,
  parcelId: string | null,
  source: string | null,
  report: object,
): Promise<number> {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO title_searches (address, county, parcel_id, source, report)
    VALUES (${address}, ${county}, ${parcelId}, ${source}, ${JSON.stringify(report)})
    RETURNING id
  `;
  return rows[0].id as number;
}

export async function getRecentSearches(limit = 20): Promise<TitleSearchRow[]> {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`
    SELECT id, address, county, parcel_id, source, report, created_at
    FROM title_searches
    ORDER BY id DESC
    LIMIT ${limit}
  `;
  return rows.map(r => ({
    id: r.id as number,
    address: r.address as string,
    county: r.county as string,
    parcel_id: r.parcel_id as string | null,
    source: r.source as string | null,
    report: typeof r.report === 'string' ? JSON.parse(r.report) : r.report as object,
    created_at: String(r.created_at),
  }));
}

export async function getSearch(id: number): Promise<TitleSearchRow | null> {
  await ensureTable();
  const sql = getSql();
  const rows = await sql`SELECT * FROM title_searches WHERE id = ${id}`;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id as number,
    address: r.address as string,
    county: r.county as string,
    parcel_id: r.parcel_id as string | null,
    source: r.source as string | null,
    report: typeof r.report === 'string' ? JSON.parse(r.report) : r.report as object,
    created_at: String(r.created_at),
  };
}

/* ──────────────────────────────────────────────────────────────────
 * Durable Jobs — tracks long-running Inngest title search jobs
 * ────────────────────────────────────────────────────────────────── */

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface TitleJobRow {
  id: string;           // nanoid — also used as Inngest event correlation id
  address: string;
  status: JobStatus;
  current_step: string | null;
  progress_pct: number;
  logs: string[];       // JSON text[]
  result: object | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

async function ensureJobsTable() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS title_jobs (
      id           TEXT PRIMARY KEY,
      address      TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'queued',
      current_step TEXT,
      progress_pct INTEGER NOT NULL DEFAULT 0,
      logs         JSONB NOT NULL DEFAULT '[]',
      result       JSONB,
      error        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function createJob(id: string, address: string): Promise<void> {
  await ensureJobsTable();
  const sql = getSql();
  await sql`
    INSERT INTO title_jobs (id, address, status, progress_pct, logs)
    VALUES (${id}, ${address}, 'queued', 0, '[]'::jsonb)
  `;
}

export async function updateJob(
  id: string,
  patch: {
    status?: JobStatus;
    current_step?: string;
    progress_pct?: number;
    log?: string;
    result?: object;
    error?: string;
  },
): Promise<void> {
  await ensureJobsTable();
  const sql = getSql();

  if (patch.log) {
    // Append a single log entry (Neon JSONB concat)
    await sql`
      UPDATE title_jobs SET
        logs = logs || ${JSON.stringify([patch.log])}::jsonb,
        status = COALESCE(${patch.status ?? null}, status),
        current_step = COALESCE(${patch.current_step ?? null}, current_step),
        progress_pct = COALESCE(${patch.progress_pct ?? null}, progress_pct),
        result = COALESCE(${patch.result ? JSON.stringify(patch.result) : null}::jsonb, result),
        error = COALESCE(${patch.error ?? null}, error),
        updated_at = NOW()
      WHERE id = ${id}
    `;
  } else {
    await sql`
      UPDATE title_jobs SET
        status = COALESCE(${patch.status ?? null}, status),
        current_step = COALESCE(${patch.current_step ?? null}, current_step),
        progress_pct = COALESCE(${patch.progress_pct ?? null}, progress_pct),
        result = COALESCE(${patch.result ? JSON.stringify(patch.result) : null}::jsonb, result),
        error = COALESCE(${patch.error ?? null}, error),
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }
}

export async function getJob(id: string): Promise<TitleJobRow | null> {
  await ensureJobsTable();
  const sql = getSql();
  const rows = await sql`SELECT * FROM title_jobs WHERE id = ${id}`;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    address: r.address as string,
    status: r.status as JobStatus,
    current_step: r.current_step as string | null,
    progress_pct: r.progress_pct as number,
    logs: (typeof r.logs === 'string' ? JSON.parse(r.logs) : r.logs) as string[],
    result: r.result ? (typeof r.result === 'string' ? JSON.parse(r.result) : r.result) as object : null,
    error: r.error as string | null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

export async function getRecentJobs(limit = 20): Promise<TitleJobRow[]> {
  await ensureJobsTable();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM title_jobs ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows.map(r => ({
    id: r.id as string,
    address: r.address as string,
    status: r.status as JobStatus,
    current_step: r.current_step as string | null,
    progress_pct: r.progress_pct as number,
    logs: (typeof r.logs === 'string' ? JSON.parse(r.logs) : r.logs) as string[],
    result: r.result ? (typeof r.result === 'string' ? JSON.parse(r.result) : r.result) as object : null,
    error: r.error as string | null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }));
}
