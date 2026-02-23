import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://title-garinmckayl.aws-eu-west-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

let _client: ReturnType<typeof createClient> | null = null;

export function getTursoClient() {
  if (!_client) {
    _client = createClient({
      url: TURSO_URL,
      authToken: TURSO_TOKEN,
    });
  }
  return _client;
}

export async function initDB() {
  const db = getTursoClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS title_searches (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      address   TEXT NOT NULL,
      county    TEXT NOT NULL,
      parcel_id TEXT,
      source    TEXT,
      report    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export interface TitleSearchRow {
  id: number;
  address: string;
  county: string;
  parcel_id: string | null;
  source: string | null;
  report: string;
  created_at: string;
}

export async function saveSearch(
  address: string,
  county: string,
  parcelId: string | null,
  source: string | null,
  report: object
): Promise<number> {
  await initDB();
  const db = getTursoClient();
  const result = await db.execute({
    sql: `INSERT INTO title_searches (address, county, parcel_id, source, report)
          VALUES (?, ?, ?, ?, ?)`,
    args: [address, county, parcelId ?? null, source ?? null, JSON.stringify(report)],
  });
  return Number(result.lastInsertRowid);
}

export async function getRecentSearches(limit = 10): Promise<TitleSearchRow[]> {
  await initDB();
  const db = getTursoClient();
  const result = await db.execute({
    sql: `SELECT id, address, county, parcel_id, source, report, created_at
          FROM title_searches
          ORDER BY id DESC
          LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((r: any) => ({
    id: r.id as number,
    address: r.address as string,
    county: r.county as string,
    parcel_id: r.parcel_id as string | null,
    source: r.source as string | null,
    report: r.report as string,
    created_at: r.created_at as string,
  }));
}

export async function getSearch(id: number): Promise<TitleSearchRow | null> {
  await initDB();
  const db = getTursoClient();
  const result = await db.execute({
    sql: `SELECT * FROM title_searches WHERE id = ?`,
    args: [id],
  });
  if (!result.rows.length) return null;
  const r = result.rows[0] as any;
  return {
    id: r.id as number,
    address: r.address as string,
    county: r.county as string,
    parcel_id: r.parcel_id as string | null,
    source: r.source as string | null,
    report: r.report as string,
    created_at: r.created_at as string,
  };
}
