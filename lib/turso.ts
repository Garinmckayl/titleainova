/**
 * Title search persistence — backed by Turso (libSQL).
 *
 * Required env vars (set in Vercel):
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=your-token
 */
import { createClient, type Client } from '@libsql/client';
import type {
  ReviewStatus,
  ReviewComment,
  ReviewRecord,
  NotificationChannel,
  NotificationEvent,
  NotificationConfig,
} from '@/lib/agents/title-search/types';

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
      user_id    TEXT,
      address    TEXT NOT NULL,
      county     TEXT NOT NULL,
      parcel_id  TEXT,
      source     TEXT,
      report     TEXT NOT NULL DEFAULT '{}',
      screenshots TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Migrate existing tables
  const migrations = [
    `ALTER TABLE title_searches ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE title_searches ADD COLUMN user_id TEXT`,
    `ALTER TABLE title_searches ADD COLUMN review_status TEXT DEFAULT 'pending_review'`,
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
}

async function ensureJobsTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS title_jobs (
      id           TEXT PRIMARY KEY,
      user_id      TEXT,
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
  const migrations = [
    `ALTER TABLE title_jobs ADD COLUMN screenshots TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE title_jobs ADD COLUMN user_id TEXT`,
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
}

async function ensureReviewsTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS title_reviews (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      search_id       INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending_review',
      assigned_to     TEXT,
      assigned_at     TEXT,
      comments        TEXT NOT NULL DEFAULT '[]',
      final_decision  TEXT,
      final_decision_by TEXT,
      final_decision_at TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (search_id) REFERENCES title_searches(id)
    )
  `);
}

async function ensureNotificationsTable() {
  const db = getClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notification_configs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      channel     TEXT NOT NULL,
      event       TEXT NOT NULL,
      webhook_url TEXT,
      email       TEXT,
      enabled     INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notification_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT,
      event       TEXT NOT NULL,
      channel     TEXT NOT NULL,
      payload     TEXT NOT NULL DEFAULT '{}',
      status      TEXT NOT NULL DEFAULT 'sent',
      error       TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
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
  review_status: ReviewStatus;
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
  userId: string | null = null,
): Promise<number> {
  await ensureTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `INSERT INTO title_searches (user_id, address, county, parcel_id, source, report, screenshots, review_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_review') RETURNING id`,
    args: [userId, address, county, parcelId, source, JSON.stringify(report), JSON.stringify(screenshots)],
  });
  return rs.rows[0].id as number;
}

export async function getRecentSearches(limit = 20, userId: string | null = null): Promise<TitleSearchRow[]> {
  await ensureTable();
  const db = getClient();
  const rs = userId
    ? await db.execute({
        sql: `SELECT id, address, county, parcel_id, source, report, screenshots, review_status, created_at
              FROM title_searches WHERE user_id = ? ORDER BY id DESC LIMIT ?`,
        args: [userId, limit],
      })
    : await db.execute({
        sql: `SELECT id, address, county, parcel_id, source, report, screenshots, review_status, created_at
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
    review_status: (r.review_status as ReviewStatus) || 'pending_review',
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
    review_status: (r.review_status as ReviewStatus) || 'pending_review',
    created_at: String(r.created_at),
  };
}

export async function updateSearchReviewStatus(id: number, status: ReviewStatus): Promise<void> {
  await ensureTable();
  const db = getClient();
  await db.execute({
    sql: `UPDATE title_searches SET review_status = ? WHERE id = ?`,
    args: [status, id],
  });
}

// ─── Durable Jobs CRUD ────────────────────────────────────────

export async function createJob(id: string, address: string, userId: string | null = null): Promise<void> {
  await ensureJobsTable();
  const db = getClient();
  await db.execute({
    sql: `INSERT INTO title_jobs (id, user_id, address, status, progress_pct, logs, screenshots)
          VALUES (?, ?, ?, 'queued', 0, '[]', '[]')`,
    args: [id, userId, address],
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

export async function getRecentJobs(limit = 20, userId: string | null = null): Promise<TitleJobRow[]> {
  await ensureJobsTable();
  const db = getClient();
  const rs = userId
    ? await db.execute({
        sql: `SELECT * FROM title_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
        args: [userId, limit],
      })
    : await db.execute({
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

// ─── Reviews CRUD ─────────────────────────────────────────────

export async function createReview(searchId: number, assignedTo?: string): Promise<number> {
  await ensureReviewsTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `INSERT INTO title_reviews (search_id, status, assigned_to, assigned_at)
          VALUES (?, 'pending_review', ?, ?) RETURNING id`,
    args: [searchId, assignedTo ?? null, assignedTo ? new Date().toISOString() : null],
  });
  await updateSearchReviewStatus(searchId, 'pending_review');
  return rs.rows[0].id as number;
}

export async function getReview(searchId: number): Promise<ReviewRecord | null> {
  await ensureReviewsTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `SELECT * FROM title_reviews WHERE search_id = ? ORDER BY id DESC LIMIT 1`,
    args: [searchId],
  });
  if (!rs.rows.length) return null;
  const r = rs.rows[0];
  return {
    searchId: r.search_id as number,
    status: r.status as ReviewStatus,
    assignedTo: r.assigned_to as string | undefined,
    assignedAt: r.assigned_at as string | undefined,
    comments: parseJson(r.comments, []),
    finalDecision: r.final_decision as 'approved' | 'rejected' | undefined,
    finalDecisionBy: r.final_decision_by as string | undefined,
    finalDecisionAt: r.final_decision_at as string | undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function addReviewComment(
  searchId: number,
  comment: ReviewComment
): Promise<void> {
  await ensureReviewsTable();
  const db = getClient();
  await db.execute({
    sql: `UPDATE title_reviews
          SET comments = json_insert(comments, '$[#]', json(?)),
              status = 'in_review',
              updated_at = datetime('now')
          WHERE search_id = ?`,
    args: [JSON.stringify(comment), searchId],
  });
  await updateSearchReviewStatus(searchId, 'in_review');
}

export async function finalizeReview(
  searchId: number,
  decision: 'approved' | 'rejected',
  decidedBy: string
): Promise<void> {
  await ensureReviewsTable();
  const db = getClient();
  const newStatus: ReviewStatus = decision === 'approved' ? 'approved' : 'rejected';
  await db.execute({
    sql: `UPDATE title_reviews
          SET status = ?, final_decision = ?, final_decision_by = ?,
              final_decision_at = datetime('now'), updated_at = datetime('now')
          WHERE search_id = ?`,
    args: [newStatus, decision, decidedBy, searchId],
  });
  await updateSearchReviewStatus(searchId, newStatus);
}

export async function getPendingReviews(limit = 50): Promise<ReviewRecord[]> {
  await ensureReviewsTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `SELECT * FROM title_reviews WHERE status IN ('pending_review', 'in_review')
          ORDER BY created_at ASC LIMIT ?`,
    args: [limit],
  });
  return rs.rows.map(r => ({
    searchId: r.search_id as number,
    status: r.status as ReviewStatus,
    assignedTo: r.assigned_to as string | undefined,
    assignedAt: r.assigned_at as string | undefined,
    comments: parseJson(r.comments, []),
    finalDecision: r.final_decision as 'approved' | 'rejected' | undefined,
    finalDecisionBy: r.final_decision_by as string | undefined,
    finalDecisionAt: r.final_decision_at as string | undefined,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

// ─── Notifications CRUD ───────────────────────────────────────

export async function saveNotificationConfig(config: NotificationConfig): Promise<number> {
  await ensureNotificationsTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `INSERT INTO notification_configs (user_id, channel, event, webhook_url, email, enabled)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [config.userId, config.channel, config.event, config.webhookUrl ?? null, config.email ?? null, config.enabled ? 1 : 0],
  });
  return rs.rows[0].id as number;
}

export async function getNotificationConfigs(
  userId: string,
  event?: NotificationEvent
): Promise<NotificationConfig[]> {
  await ensureNotificationsTable();
  const db = getClient();
  const rs = event
    ? await db.execute({
        sql: `SELECT * FROM notification_configs WHERE user_id = ? AND event = ? AND enabled = 1`,
        args: [userId, event],
      })
    : await db.execute({
        sql: `SELECT * FROM notification_configs WHERE user_id = ?`,
        args: [userId],
      });
  return rs.rows.map(r => ({
    userId: r.user_id as string,
    channel: r.channel as NotificationChannel,
    event: r.event as NotificationEvent,
    webhookUrl: r.webhook_url as string | undefined,
    email: r.email as string | undefined,
    enabled: r.enabled === 1,
  }));
}

export async function logNotification(
  userId: string | null,
  event: string,
  channel: string,
  payload: object,
  status: 'sent' | 'failed' = 'sent',
  error?: string
): Promise<void> {
  await ensureNotificationsTable();
  const db = getClient();
  await db.execute({
    sql: `INSERT INTO notification_log (user_id, event, channel, payload, status, error)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, event, channel, JSON.stringify(payload), status, error ?? null],
  });
}

/**
 * Ensure default in_app notification configs exist for a user.
 * Creates configs for all event types if none exist yet.
 */
export async function ensureDefaultNotificationConfigs(userId: string): Promise<void> {
  await ensureNotificationsTable();
  const db = getClient();

  // Check if user already has any in_app configs
  const existing = await db.execute({
    sql: `SELECT COUNT(*) as cnt FROM notification_configs WHERE user_id = ? AND channel = 'in_app'`,
    args: [userId],
  });

  const count = (existing.rows[0]?.cnt as number) || 0;
  if (count > 0) return; // Already has configs

  // Create default in_app configs for all events
  const events = ['job_completed', 'job_failed', 'review_requested', 'review_completed'];
  for (const event of events) {
    await db.execute({
      sql: `INSERT INTO notification_configs (user_id, channel, event, enabled)
            VALUES (?, 'in_app', ?, 1)`,
      args: [userId, event],
    });
  }
}

/**
 * Get recent in-app notifications for a user.
 */
export async function getInAppNotifications(
  userId: string,
  limit: number = 20
): Promise<Array<{ id: number; event: string; payload: any; status: string; created_at: string }>> {
  await ensureNotificationsTable();
  const db = getClient();
  const rs = await db.execute({
    sql: `SELECT id, event, payload, status, created_at
          FROM notification_log
          WHERE (user_id = ? OR user_id IS NULL) AND channel = 'in_app'
          ORDER BY created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  return rs.rows.map(r => ({
    id: r.id as number,
    event: r.event as string,
    payload: parseJson(r.payload, {}),
    status: r.status as string,
    created_at: String(r.created_at),
  }));
}

/**
 * Get count of in-app notifications since a given timestamp.
 */
export async function getUnreadNotificationCount(
  userId: string,
  since?: string
): Promise<number> {
  await ensureNotificationsTable();
  const db = getClient();
  const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const rs = await db.execute({
    sql: `SELECT COUNT(*) as cnt
          FROM notification_log
          WHERE (user_id = ? OR user_id IS NULL) AND channel = 'in_app' AND created_at > ?`,
    args: [userId, sinceDate],
  });
  return (rs.rows[0]?.cnt as number) || 0;
}
