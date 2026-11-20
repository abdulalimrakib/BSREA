import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import envConfig from "../config/env.config";

/*--The database: one SQLite file (built into Node.js, nothing to install).
  All SQL lives in the files in db/ and services/, so moving to PostgreSQL later stays contained.--*/

// Files this process creates (database, documents, messages) are readable by this user only
process.umask(0o077);

const SCHEMA_VERSION = 4; // 2 = personal contact details encrypted, 3 = two-factor login, per-IP lockout, document retention, 4 = certificate scan log

if (envConfig.DATABASE_FILE !== ":memory:") {
  fs.mkdirSync(path.dirname(envConfig.DATABASE_FILE), { recursive: true, mode: 0o700 });
  fs.chmodSync(path.dirname(envConfig.DATABASE_FILE), 0o700);
}

export const db = new DatabaseSync(envConfig.DATABASE_FILE);

if (envConfig.DATABASE_FILE !== ":memory:") {
  for (const file of [envConfig.DATABASE_FILE, `${envConfig.DATABASE_FILE}-wal`, `${envConfig.DATABASE_FILE}-shm`]) {
    if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
  }
}

// Refuse to run on a database made by an older version, instead of silently mixing plain and encrypted data
const existingTables = (db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'`).get() as { n: number }).n;
const version = (db.prepare(`PRAGMA user_version`).get() as { user_version: number }).user_version;
// Versions 2 and 3 can be upgraded in place (only new columns and tables are added); anything older can't.
// 3 -> 4 only adds the certificate_scans table, which CREATE TABLE IF NOT EXISTS below takes care of.
const upgradeFrom2 = existingTables > 0 && version === 2;
const upgradeable = existingTables > 0 && (version === 2 || version === 3);
if (existingTables > 0 && version !== SCHEMA_VERSION && !upgradeable) {
  throw new Error(
    `The database at ${envConfig.DATABASE_FILE} uses an older layout (version ${version}, expected ${SCHEMA_VERSION}). ` +
      `It must be migrated, or deleted and re-created with "npm run seed" if it holds no real data.`
  );
}

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
  PRAGMA secure_delete = ON;
`);

/*--Run several statements as one unit: all of them happen or none do.
  BEGIN IMMEDIATE takes the write lock first, so "check for a duplicate, then insert" can't be raced.--*/
export const transaction = <T>(work: () => T): T => {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

export const now = () => new Date().toISOString();

/*--Upgrade a version 2 database: add the new columns (new tables are created below)--*/
if (upgradeFrom2) {
  transaction(() => db.exec(`
    ALTER TABLE staff_users ADD COLUMN totp_secret_enc TEXT;
    ALTER TABLE staff_users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE staff_users ADD COLUMN totp_last_step INTEGER;
    ALTER TABLE applications ADD COLUMN documents_purged_at TEXT;
  `));
}

/*--Tables--*/
// Columns ending in _enc are encrypted (AES-256-GCM). Columns ending in _idx are blind indexes
// (keyed fingerprints) used to find duplicates. company_norm is the normalised company name (not personal data).
db.exec(`
  CREATE TABLE IF NOT EXISTS staff_users (
    id              INTEGER PRIMARY KEY,
    email           TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('admin', 'approver', 'staff')),
    password_hash   TEXT NOT NULL,
    failed_logins   INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL,
    last_login_at   TEXT,
    totp_secret_enc TEXT,              -- authenticator-app secret, encrypted
    totp_enabled    INTEGER NOT NULL DEFAULT 0,
    totp_last_step  INTEGER            -- last code used, so a code can't be used twice
  );

  -- Wrong passwords are counted per account AND per IP address. Someone guessing from their own
  -- address locks only themselves out, so they can't lock real staff out of their accounts.
  CREATE TABLE IF NOT EXISTS login_failures (
    user_id         INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    ip              TEXT NOT NULL,
    failures        INTEGER NOT NULL DEFAULT 0,
    locked_until    TEXT,
    updated_at      TEXT NOT NULL,
    PRIMARY KEY (user_id, ip)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash      TEXT PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    created_at      TEXT NOT NULL,
    last_seen_at    TEXT NOT NULL,
    expires_at      TEXT NOT NULL,
    ip              TEXT,
    user_agent      TEXT
  );

  CREATE TABLE IF NOT EXISTS members (
    id                INTEGER PRIMARY KEY,
    member_no         TEXT NOT NULL UNIQUE,
    company           TEXT NOT NULL,
    company_norm      TEXT NOT NULL,
    contact_name      TEXT NOT NULL DEFAULT '',
    designation       TEXT NOT NULL DEFAULT '',
    mobile_enc        TEXT,
    mobile_idx        TEXT,
    email_enc         TEXT,
    email_idx         TEXT,
    address           TEXT NOT NULL DEFAULT '',
    website           TEXT,
    membership_type   TEXT NOT NULL DEFAULT 'general' CHECK (membership_type IN ('general', 'associate')),
    origin            TEXT NOT NULL DEFAULT 'local' CHECK (origin IN ('local', 'foreign')),
    trade_license_idx TEXT,
    bin_idx           TEXT,
    tin_idx           TEXT,
    status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
    source            TEXT NOT NULL CHECK (source IN ('import', 'application')),
    application_id    INTEGER,
    joined_at         TEXT NOT NULL,
    created_at        TEXT NOT NULL
  );
  -- The same company, trade licence, BIN or TIN can never be two members
  CREATE UNIQUE INDEX IF NOT EXISTS members_company_norm ON members(company_norm);
  CREATE UNIQUE INDEX IF NOT EXISTS members_trade_license ON members(trade_license_idx) WHERE trade_license_idx IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS members_bin ON members(bin_idx) WHERE bin_idx IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS members_tin ON members(tin_idx) WHERE tin_idx IS NOT NULL;
  CREATE INDEX IF NOT EXISTS members_email ON members(email_idx);
  CREATE INDEX IF NOT EXISTS members_mobile ON members(mobile_idx);

  CREATE TABLE IF NOT EXISTS applications (
    id                    INTEGER PRIMARY KEY,
    reference             TEXT NOT NULL UNIQUE,
    status                TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),
    membership_type       TEXT NOT NULL CHECK (membership_type IN ('general', 'associate')),
    origin                TEXT NOT NULL CHECK (origin IN ('local', 'foreign')),
    company               TEXT NOT NULL,
    company_norm          TEXT NOT NULL,
    trade_license_enc     TEXT NOT NULL,
    trade_license_idx     TEXT NOT NULL,
    bin_enc               TEXT NOT NULL,
    bin_idx               TEXT NOT NULL,
    tin_enc               TEXT,
    tin_idx               TEXT,
    company_email_enc     TEXT NOT NULL,
    company_email_idx     TEXT,
    company_phone_enc     TEXT NOT NULL,
    company_phone_idx     TEXT,
    address               TEXT NOT NULL,
    website               TEXT,
    applicant_name_enc    TEXT NOT NULL,
    applicant_designation TEXT NOT NULL,
    applicant_email_enc   TEXT NOT NULL,
    applicant_email_idx   TEXT,
    applicant_mobile_enc  TEXT NOT NULL,
    applicant_mobile_idx  TEXT,
    applicant_nid_enc     TEXT NOT NULL,
    applicant_nid_idx     TEXT NOT NULL,
    contact_enc           TEXT, -- JSON { name, mobile, email }, encrypted
    duplicate_report      TEXT NOT NULL DEFAULT '[]',
    duplicates_checked_by INTEGER REFERENCES staff_users(id),
    reviewed_by           INTEGER REFERENCES staff_users(id),
    reviewed_at           TEXT,
    decision_note         TEXT,
    member_id             INTEGER REFERENCES members(id),
    documents_purged_at   TEXT, -- documents deleted under the retention rule
    created_at            TEXT NOT NULL,
    updated_at            TEXT NOT NULL
  );
  -- Two open applications can't share a company name, trade licence or BIN
  CREATE UNIQUE INDEX IF NOT EXISTS applications_open_company ON applications(company_norm) WHERE status IN ('submitted', 'under_review');
  CREATE UNIQUE INDEX IF NOT EXISTS applications_open_trade_license ON applications(trade_license_idx) WHERE status IN ('submitted', 'under_review');
  CREATE UNIQUE INDEX IF NOT EXISTS applications_open_bin ON applications(bin_idx) WHERE status IN ('submitted', 'under_review');
  CREATE INDEX IF NOT EXISTS applications_status ON applications(status, created_at);
  CREATE INDEX IF NOT EXISTS applications_nid ON applications(applicant_nid_idx);
  CREATE INDEX IF NOT EXISTS applications_company_email ON applications(company_email_idx);
  CREATE INDEX IF NOT EXISTS applications_applicant_email ON applications(applicant_email_idx);
  CREATE INDEX IF NOT EXISTS applications_company_phone ON applications(company_phone_idx);
  CREATE INDEX IF NOT EXISTS applications_applicant_mobile ON applications(applicant_mobile_idx);

  CREATE TABLE IF NOT EXISTS application_documents (
    id              INTEGER PRIMARY KEY,
    application_id  INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    original_name   TEXT NOT NULL,
    mime            TEXT NOT NULL,
    size            INTEGER NOT NULL,
    sha256          TEXT NOT NULL,
    storage_name    TEXT NOT NULL UNIQUE,
    created_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS documents_sha256 ON application_documents(sha256);

  CREATE TABLE IF NOT EXISTS certificates (
    id              INTEGER PRIMARY KEY,
    type            TEXT NOT NULL CHECK (type IN ('membership', 'noc')),
    number          TEXT NOT NULL UNIQUE,
    verify_code     TEXT NOT NULL UNIQUE,
    member_id       INTEGER NOT NULL REFERENCES members(id),
    company         TEXT NOT NULL,
    membership_type TEXT NOT NULL,
    valid_from      TEXT NOT NULL,
    valid_until     TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
    revoked_reason  TEXT,
    revoked_by      INTEGER REFERENCES staff_users(id),
    revoked_at      TEXT,
    issued_by       INTEGER REFERENCES staff_users(id),
    created_at      TEXT NOT NULL
  );
  -- One valid membership certificate per member per period
  CREATE UNIQUE INDEX IF NOT EXISTS certificates_one_valid ON certificates(member_id, type, valid_from) WHERE status = 'valid' AND type = 'membership';

  -- Every public check of a certificate (QR scan or typed code). A revoked or expired certificate that keeps being
  -- checked is a sign that someone is still showing it to people; staff see these on the dashboard.
  -- Only a shortened IP address is kept (e.g. 203.0.113.x), and rows are deleted after a year ("npm run retention").
  CREATE TABLE IF NOT EXISTS certificate_scans (
    id              INTEGER PRIMARY KEY,
    certificate_id  INTEGER NOT NULL REFERENCES certificates(id),
    at              TEXT NOT NULL,
    state           TEXT NOT NULL CHECK (state IN ('valid', 'expired', 'revoked')), -- what the checker was shown
    ip_masked       TEXT
  );
  CREATE INDEX IF NOT EXISTS certificate_scans_certificate ON certificate_scans(certificate_id, at);
  CREATE INDEX IF NOT EXISTS certificate_scans_state ON certificate_scans(state, at);

  CREATE TABLE IF NOT EXISTS audit_log (
    id            INTEGER PRIMARY KEY,
    at            TEXT NOT NULL,
    actor_id      INTEGER,
    actor_email   TEXT,
    action        TEXT NOT NULL,
    target_type   TEXT,
    target_id     TEXT,
    ip            TEXT,
    details       TEXT
  );
  CREATE INDEX IF NOT EXISTS audit_at ON audit_log(at);

  -- The audit log can only grow: rows can't be changed or deleted
  CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
  CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
`);

db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
