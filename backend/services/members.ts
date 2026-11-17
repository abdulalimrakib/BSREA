import { db } from "../db/database";

/*--Members--*/

/*--The next member number for this year: BSREA-M-2026-0001, BSREA-M-2026-0002, …--*/
export const nextMemberNo = () => {
  const year = new Date().getFullYear();
  const last = db.prepare(`SELECT member_no FROM members WHERE member_no LIKE ? ORDER BY member_no DESC LIMIT 1`).get(`BSREA-M-${year}-%`) as { member_no: string } | undefined;
  const n = last ? Number(last.member_no.split("-").pop()) + 1 : 1;
  return `BSREA-M-${year}-${String(n).padStart(4, "0")}`;
};
