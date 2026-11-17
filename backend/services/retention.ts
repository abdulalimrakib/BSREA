import { DatabaseSync } from "node:sqlite";
import envConfig from "../config/env.config";
import { now, transaction } from "../db/database";
import { audit } from "./audit";
import { deleteDocument } from "./documents";

/*--Data retention: don't keep personal documents longer than needed.
  Rejected applications lose their uploaded documents RETENTION_DAYS after the decision. The encrypted
  application record itself stays, so the duplicate checks and the audit trail still work.--*/

export const purgeExpired = (
  db: DatabaseSync,
  { dryRun = false, days = envConfig.RETENTION_DAYS, time = Date.now() } = {},
) => {
  const cutoff = new Date(time - days * 86_400_000).toISOString();
  const applications = db
    .prepare(
      `SELECT id FROM applications WHERE status = 'rejected' AND documents_purged_at IS NULL AND reviewed_at IS NOT NULL AND reviewed_at < ?`,
    )
    .all(cutoff) as { id: number }[];

  let documents = 0;
  for (const { id } of applications) {
    const docs = db
      .prepare(
        `SELECT storage_name FROM application_documents WHERE application_id = ?`,
      )
      .all(id) as { storage_name: string }[];
    documents += docs.length;
    if (dryRun) continue;
    transaction(() => {
      db.prepare(
        `DELETE FROM application_documents WHERE application_id = ?`,
      ).run(id);
      db.prepare(
        `UPDATE applications SET documents_purged_at = ? WHERE id = ?`,
      ).run(now(), id);
      audit(
        null,
        "retention.documents_deleted",
        { type: "application", id },
        { documents: docs.length, afterDays: days },
      );
    });
    // Files go after the database change is saved (secure_delete is on, so database pages are wiped too)
    docs.forEach((d) => deleteDocument(d.storage_name));
  }

  const nowIso = new Date(time).toISOString();
  const idleCutoff = new Date(
    time - envConfig.SESSION_HOURS * 3_600_000,
  ).toISOString();
  const dayAgo = new Date(time - 86_400_000).toISOString();
  const count = (sql: string, ...params: string[]) =>
    (
      db
        .prepare(sql.replace("DELETE", "SELECT COUNT(*) AS n"))
        .get(...params) as { n: number }
    ).n;
  const sessionsSql = `DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?`;
  const failuresSql = `DELETE FROM login_failures WHERE updated_at < ? AND (locked_until IS NULL OR locked_until < ?)`;
  const sessions = count(sessionsSql, nowIso, idleCutoff);
  const loginFailures = count(failuresSql, dayAgo, nowIso);
  if (!dryRun) {
    db.prepare(sessionsSql).run(nowIso, idleCutoff);
    db.prepare(failuresSql).run(dayAgo, nowIso);
  }
  return {
    applications: applications.length,
    documents,
    sessions,
    loginFailures,
  };
};
