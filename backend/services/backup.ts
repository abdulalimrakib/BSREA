import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import envConfig from "../config/env.config";
import {
  decryptBuffer,
  encryptBuffer,
  randomToken,
  sha256,
} from "../utils/security";

/*--Backups of everything the system stores:
    database.enc            the database, encrypted with ENCRYPTION_KEY (AES-256-GCM)
    documents/*.enc         uploaded documents (already encrypted, copied as they are)
    contact-messages.jsonl  contact-form messages (each already encrypted)
    manifest.json           SHA-256 of every file, so damage or tampering is noticed

  A backup is useless without ENCRYPTION_KEY, so keep the key safe somewhere else
  (a password manager), never next to the backups.

  This file does not open the live database itself: the caller passes it in, so restoring
  works even when there is no database yet.--*/

type Manifest = {
  createdAt: string;
  schemaVersion: number;
  files: Record<string, string>;
};

const STAMP = () =>
  new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/*--A temporary file next to the live database (the same protected folder), removed afterwards--*/
const tempFile = (storageDir: string) =>
  path.join(storageDir, `tmp-${randomToken(9)}.db`);

const removeQuietly = (file: string) => {
  for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`])
    fs.rmSync(f, { force: true });
};

/*--Make a backup folder in backupDir and give back its path--*/
export const createBackup = (
  db: DatabaseSync,
  storageDir = envConfig.STORAGE_DIR,
  backupDir = envConfig.BACKUP_DIR,
) => {
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDir, 0o700);
  const name = `bsrea-${STAMP()}`;
  const partial = path.join(backupDir, `${name}.partial`);
  fs.mkdirSync(partial, { mode: 0o700 });
  const files: Record<string, string> = {};
  const put = (relative: string, data: Buffer) => {
    fs.mkdirSync(path.dirname(path.join(partial, relative)), {
      recursive: true,
      mode: 0o700,
    });
    fs.writeFileSync(path.join(partial, relative), data, { mode: 0o600 });
    files[relative] = sha256(data);
  };

  try {
    // A consistent copy of the database, even while the server is running
    const snapshot = tempFile(storageDir);
    try {
      db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`);
      put("database.enc", encryptBuffer(fs.readFileSync(snapshot)));
    } finally {
      removeQuietly(snapshot);
    }

    const documentsDir = path.join(storageDir, "documents");
    if (fs.existsSync(documentsDir)) {
      for (const file of fs
        .readdirSync(documentsDir)
        .filter((f) => f.endsWith(".enc"))) {
        put(
          path.join("documents", file),
          fs.readFileSync(path.join(documentsDir, file)),
        );
      }
    }
    const messages = path.join(storageDir, "contact-messages.jsonl");
    if (fs.existsSync(messages))
      put("contact-messages.jsonl", fs.readFileSync(messages));

    const version = (
      db.prepare(`PRAGMA user_version`).get() as { user_version: number }
    ).user_version;
    const manifest: Manifest = {
      createdAt: new Date().toISOString(),
      schemaVersion: version,
      files,
    };
    fs.writeFileSync(
      path.join(partial, "manifest.json"),
      JSON.stringify(manifest, null, 2),
      { mode: 0o600 },
    );

    // Only a complete backup gets its final name
    const final = path.join(backupDir, name);
    fs.renameSync(partial, final);
    return final;
  } catch (error) {
    fs.rmSync(partial, { recursive: true, force: true });
    throw error;
  }
};

/*--The backups in backupDir, newest first--*/
export const listBackups = (backupDir = envConfig.BACKUP_DIR) =>
  fs.existsSync(backupDir)
    ? fs
        .readdirSync(backupDir)
        .filter(
          (name) =>
            /^bsrea-\d{8}-\d{6}$/.test(name) &&
            fs.existsSync(path.join(backupDir, name, "manifest.json")),
        )
        .sort()
        .reverse()
        .map((name) => path.join(backupDir, name))
    : [];

/*--Delete all but the newest `keep` backups (and any left-over unfinished ones)--*/
export const pruneBackups = (
  keep = envConfig.BACKUP_KEEP,
  backupDir = envConfig.BACKUP_DIR,
) => {
  const removed: string[] = [];
  for (const folder of listBackups(backupDir).slice(Math.max(1, keep))) {
    fs.rmSync(folder, { recursive: true, force: true });
    removed.push(path.basename(folder));
  }
  if (fs.existsSync(backupDir)) {
    for (const name of fs
      .readdirSync(backupDir)
      .filter((n) => n.endsWith(".partial")))
      fs.rmSync(path.join(backupDir, name), { recursive: true, force: true });
  }
  return removed;
};

export type VerifyReport = {
  ok: boolean;
  problems: string[];
  counts: Record<string, number>;
};

/*--Check a backup really can be restored: every file matches the manifest, the database decrypts
  and passes SQLite's integrity check, and every document it lists is present.
  Reports counts only, never contents.--*/
export const verifyBackup = (
  folder: string,
  storageDir = envConfig.STORAGE_DIR,
): VerifyReport => {
  const problems: string[] = [];
  const counts: Record<string, number> = {};
  const manifestFile = path.join(folder, "manifest.json");
  if (!fs.existsSync(manifestFile))
    return { ok: false, problems: ["manifest.json is missing"], counts };
  const manifest = JSON.parse(
    fs.readFileSync(manifestFile, "utf8"),
  ) as Manifest;

  for (const [relative, hash] of Object.entries(manifest.files)) {
    const file = path.join(folder, relative);
    if (!path.resolve(file).startsWith(path.resolve(folder) + path.sep))
      problems.push(`bad path in manifest: ${relative}`);
    else if (!fs.existsSync(file)) problems.push(`missing: ${relative}`);
    else if (sha256(fs.readFileSync(file)) !== hash)
      problems.push(`changed or damaged: ${relative}`);
  }
  if (!manifest.files["database.enc"]) problems.push("database.enc is missing");
  if (problems.length) return { ok: false, problems, counts };

  fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 });
  const temp = tempFile(storageDir);
  try {
    fs.writeFileSync(
      temp,
      decryptBuffer(fs.readFileSync(path.join(folder, "database.enc"))),
      { mode: 0o600 },
    );
    const copy = new DatabaseSync(temp, { readOnly: true });
    try {
      const check = copy.prepare(`PRAGMA integrity_check`).get() as {
        integrity_check: string;
      };
      if (check.integrity_check !== "ok")
        problems.push("the database failed its integrity check");
      for (const table of [
        "members",
        "applications",
        "application_documents",
        "certificates",
        "staff_users",
        "audit_log",
      ]) {
        counts[table] = (
          copy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
            n: number;
          }
        ).n;
      }
      const documents = copy
        .prepare(`SELECT storage_name FROM application_documents`)
        .all() as { storage_name: string }[];
      const missing = documents.filter(
        (d) => !manifest.files[path.join("documents", d.storage_name)],
      ).length;
      if (missing)
        problems.push(
          `${missing} document(s) listed in the database are not in the backup`,
        );
    } finally {
      copy.close();
    }
  } catch (error) {
    problems.push(
      `the database can't be decrypted or opened (wrong ENCRYPTION_KEY?): ${(error as Error).message}`,
    );
  } finally {
    removeQuietly(temp);
  }
  return { ok: problems.length === 0, problems, counts };
};

/*--Put a backup back. The server must be stopped first. An existing database is kept beside it
  (renamed .before-restore-<time>) rather than deleted.--*/
export const restoreBackup = (
  folder: string,
  databaseFile = envConfig.DATABASE_FILE,
  storageDir = envConfig.STORAGE_DIR,
) => {
  const report = verifyBackup(folder, storageDir);
  if (!report.ok)
    throw new Error(
      `The backup can't be restored:\n- ${report.problems.join("\n- ")}`,
    );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(folder, "manifest.json"), "utf8"),
  ) as Manifest;

  fs.mkdirSync(path.dirname(databaseFile), { recursive: true, mode: 0o700 });
  const keptAs = fs.existsSync(databaseFile)
    ? `${databaseFile}.before-restore-${STAMP()}`
    : null;
  if (keptAs) {
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(databaseFile + suffix))
        fs.renameSync(databaseFile + suffix, keptAs + suffix);
    }
  }
  fs.writeFileSync(
    databaseFile,
    decryptBuffer(fs.readFileSync(path.join(folder, "database.enc"))),
    { mode: 0o600 },
  );

  const documentsDir = path.join(storageDir, "documents");
  fs.mkdirSync(documentsDir, { recursive: true, mode: 0o700 });
  for (const relative of Object.keys(manifest.files).filter((f) =>
    f.startsWith(`documents${path.sep}`),
  )) {
    fs.copyFileSync(
      path.join(folder, relative),
      path.join(documentsDir, path.basename(relative)),
    );
    fs.chmodSync(path.join(documentsDir, path.basename(relative)), 0o600);
  }
  if (manifest.files["contact-messages.jsonl"]) {
    const target = path.join(storageDir, "contact-messages.jsonl");
    if (fs.existsSync(target))
      fs.renameSync(target, `${target}.before-restore-${STAMP()}`);
    fs.copyFileSync(path.join(folder, "contact-messages.jsonl"), target);
    fs.chmodSync(target, 0o600);
  }
  return { counts: report.counts, keptAs };
};
