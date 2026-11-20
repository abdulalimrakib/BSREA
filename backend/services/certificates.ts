import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import envConfig from "../config/env.config";
import { db, now } from "../db/database";
import { randomToken } from "../utils/security";

/*--Membership certificates with a QR code that opens the public verification page.
  Assumption until BSREA confirms: the membership year is the calendar year (1 Jan – 31 Dec).--*/

export type CertificateRow = {
  id: number;
  type: "membership" | "noc";
  number: string;
  verify_code: string;
  member_id: number;
  company: string;
  membership_type: string;
  valid_from: string;
  valid_until: string;
  status: "valid" | "revoked";
  revoked_reason: string | null;
  revoked_at: string | null;
  created_at: string;
};

export const verifyUrl = (code: string) => `${envConfig.PUBLIC_SITE_URL}/verify/${code}`;

/*--The address printed on certificates, e.g. "bsrea-demo.duckdns.org/verify". It comes from PUBLIC_SITE_URL,
  so moving to the real domain only means changing that setting (certificates issued before keep the old address).--*/
export const officialVerifyAddress = () => `${new URL(envConfig.PUBLIC_SITE_URL).host}/verify`;

// Codes are 24 url-safe characters (144 random bits): impossible to guess
export const VERIFY_CODE = /^[A-Za-z0-9_-]{24}$/;

export class CertificateExistsError extends Error {}

/*--Issue this year's membership certificate. Refuses a second valid one for the same year.--*/
export const issueMembershipCertificate = (memberId: number, issuedBy: number | null, year = new Date().getFullYear()) => {
  const member = db.prepare(`SELECT id, member_no, company, membership_type, status FROM members WHERE id = ?`).get(memberId) as
    | { id: number; member_no: string; company: string; membership_type: string; status: string }
    | undefined;
  if (!member) throw new Error("Member not found");
  if (member.status !== "active") throw new Error("Only active members can get a certificate");

  const validFrom = `${year}-01-01`;
  const existing = db
    .prepare(`SELECT id FROM certificates WHERE member_id = ? AND type = 'membership' AND valid_from = ? AND status = 'valid'`)
    .get(memberId, validFrom);
  if (existing) throw new CertificateExistsError("This member already has a valid certificate for this year");

  const issuedCount = (db.prepare(`SELECT COUNT(*) AS n FROM certificates WHERE member_id = ? AND type = 'membership' AND valid_from = ?`).get(memberId, validFrom) as { n: number }).n;
  const number = `BSREA/MC/${year}/${member.member_no.split("-").pop()}${issuedCount ? `-R${issuedCount}` : ""}`;
  const code = randomToken(18);
  const result = db
    .prepare(
      `INSERT INTO certificates (type, number, verify_code, member_id, company, membership_type, valid_from, valid_until, issued_by, created_at)
       VALUES ('membership', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(number, code, memberId, member.company, member.membership_type, validFrom, `${year}-12-31`, issuedBy, now());
  return Number(result.lastInsertRowid);
};

/*--"valid", "expired" or "revoked", as of today--*/
export const certificateState = (c: Pick<CertificateRow, "status" | "valid_until">) => {
  if (c.status === "revoked") return "revoked";
  return new Date(`${c.valid_until}T23:59:59Z`) < new Date() ? "expired" : "valid";
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/*--Draw the certificate PDF--*/
export const certificatePdf = async (c: CertificateRow) => {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`BSREA Membership Certificate ${c.number}`);
  pdf.setAuthor("Bangladesh Sustainable and Renewable Energy Association");
  pdf.setCreator("BSREA");
  const page = pdf.addPage([842, 595]); // A4 landscape
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.035, 0.471, 0.204);
  const yellow = rgb(0.984, 0.757, 0.09);
  const navy = rgb(0.098, 0.165, 0.239);
  const { width, height } = page.getSize();

  // Borders
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: green, borderWidth: 6 });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: yellow, borderWidth: 2 });

  const center = (text: string, y: number, font: typeof sans, size: number, color = navy) =>
    page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });

  center("BANGLADESH SUSTAINABLE AND RENEWABLE ENERGY ASSOCIATION", height - 90, sansBold, 16, green);
  center("BSREA", height - 118, sansBold, 22, yellow);
  center("Certificate of Membership", height - 175, serif, 38);
  center("This is to certify that", height - 220, serifItalic, 16);

  let size = 30;
  while (serif.widthOfTextAtSize(c.company, size) > width - 160 && size > 14) size -= 1;
  center(c.company, height - 265, serif, size, green);
  page.drawLine({ start: { x: 180, y: height - 278 }, end: { x: width - 180, y: height - 278 }, thickness: 1, color: yellow });

  const type = c.membership_type === "associate" ? "an Associate Member" : "a General Member";
  center(`is ${type} of the Bangladesh Sustainable and Renewable Energy Association`, height - 310, serifItalic, 16);
  center(`for the period ${formatDate(c.valid_from)} to ${formatDate(c.valid_until)}.`, height - 332, serifItalic, 16);

  // Details, bottom left
  // The member number is shown on the verify page too, as one more detail to compare with the paper
  const memberNo = (db.prepare(`SELECT member_no FROM members WHERE id = ?`).get(c.member_id) as { member_no: string } | undefined)?.member_no ?? "";
  const details = [
    ["Certificate No.", c.number],
    ["Member No.", memberNo],
    ["Issued on", formatDate(c.created_at)],
    ["Valid until", formatDate(c.valid_until)],
  ];
  details.forEach(([label, value], i) => {
    page.drawText(`${label}:`, { x: 70, y: 150 - i * 20, size: 11, font: sansBold, color: navy });
    page.drawText(value, { x: 170, y: 150 - i * 20, size: 11, font: sans, color: navy });
  });

  // Signature line, bottom middle
  page.drawLine({ start: { x: 330, y: 110 }, end: { x: 510, y: 110 }, thickness: 1, color: navy });
  center("Secretary General, BSREA", 94, sans, 11);

  // QR code, bottom right
  const qr = await QRCode.toBuffer(verifyUrl(c.verify_code), { errorCorrectionLevel: "M", margin: 1, width: 300 });
  const qrImage = await pdf.embedPng(qr);
  page.drawImage(qrImage, { x: width - 175, y: 75, width: 105, height: 105 });
  // Under the QR code: where to check it, and the code in text for typing in by hand
  const address = officialVerifyAddress();
  const underQr = (text: string, y: number, font: typeof sans, size: number) =>
    page.drawText(text, { x: width - 122.5 - font.widthOfTextAtSize(text, size) / 2, y, size, font, color: navy });
  underQr("Scan, or enter the code at", 64, sans, 8);
  underQr(address, 54, sansBold, 8);
  underQr(`Code: ${c.verify_code}`, 44, sans, 7);

  // Bottom left: a fake QR code could open a look-alike website, so say which address is the real one
  const warning = `Check this certificate only at ${address}. If a QR code opens any other address, the certificate is fake.`;
  let warningSize = 8;
  while (sans.widthOfTextAtSize(warning, warningSize) > width - 260 && warningSize > 6) warningSize -= 0.5;
  page.drawText(warning, { x: 50, y: 44, size: warningSize, font: sans, color: green });

  return Buffer.from(await pdf.save());
};
