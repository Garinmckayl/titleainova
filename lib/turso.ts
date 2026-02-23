/**
 * Title search persistence — backed by Neon PostgreSQL (same DB as legalmindznova)
 * Replaces previous Turso implementation (which required a separate auth token).
 *
 * Set DATABASE_URL in .env.local / Vercel env vars:
 *   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=require
 */
import { neon } from '@neondatabase/serverless';

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
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
