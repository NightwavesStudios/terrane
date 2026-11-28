import type { D1Database } from "./d1";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    units TEXT NOT NULL DEFAULT 'imperial',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_records (
    user_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)",
  `CREATE TABLE IF NOT EXISTS webauthn_credentials (
    credential_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT NOT NULL DEFAULT '[]',
    device_type TEXT NOT NULL,
    backed_up INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS webauthn_credentials_user ON webauthn_credentials(user_id)",
  `CREATE TABLE IF NOT EXISTS webauthn_flows (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    user_id TEXT,
    challenge TEXT NOT NULL,
    payload TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS webauthn_flows_expiry ON webauthn_flows(expires_at)",
  `CREATE TABLE IF NOT EXISTS recovery_keys (
    user_id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )`,
];

const ready = new WeakMap<object, Promise<void>>();

export function ensureSchema(db: D1Database): Promise<void> {
  let pending = ready.get(db);
  if (!pending) {
    pending = db.batch(SCHEMA.map((statement) => db.prepare(statement))).then(() => undefined);
    ready.set(db, pending);
  }
  return pending;
}
