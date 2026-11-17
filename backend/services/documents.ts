import fs from "fs";
import path from "path";
import envConfig from "../config/env.config";
import { decryptBuffer, encryptBuffer, randomToken, sha256 } from "../utils/security";

/*--Uploaded application documents.
  Files are checked by their real content (not the name or the browser's claim), encrypted with
  AES-256-GCM and stored under random names outside any public folder.--*/

export const DOCUMENT_KINDS = {
  trade_license: { label: "Trade Licence", required: true },
  tax_acknowledgement: { label: "Tax Submission Acknowledgement", required: true },
  bin_certificate: { label: "BIN Certificate", required: true },
  applicant_id: { label: "NID or Passport (Applicant)", required: true },
  applicant_photo: { label: "Passport-size Photo (Applicant)", required: true },
  payment_receipt: { label: "Pay Order or Fund Transfer Receipt", required: true },
  memorandum: { label: "Memorandum and Articles of Association", required: false },
  incorporation_certificate: { label: "Certificate of Incorporation", required: false },
  visiting_card: { label: "Visiting Card", required: false },
  other: { label: "Other Certificate", required: false },
} as const;

export type DocumentKind = keyof typeof DOCUMENT_KINDS;

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/*--What the file really is, judged from its first bytes. Anything else is refused.--*/
export const detectFileType = (data: Buffer): { mime: string; ext: string } | null => {
  if (data.length >= 5 && data.subarray(0, 5).toString("latin1") === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  return null;
};

const documentsDir = () => path.join(envConfig.STORAGE_DIR, "documents");

/*--Keep only safe characters of the original file name (it is shown to staff, never used as a path)--*/
export const safeFileName = (name: string) =>
  (path.basename(name).normalize("NFKC").replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(-120) || "file").trim();

export type StoredDocument = { kind: DocumentKind; originalName: string; mime: string; size: number; sha256: string; storageName: string };

export const storeDocument = (kind: DocumentKind, originalName: string, data: Buffer, mime: string): StoredDocument => {
  fs.mkdirSync(documentsDir(), { recursive: true, mode: 0o700 });
  const storageName = `${randomToken(18)}.enc`;
  fs.writeFileSync(path.join(documentsDir(), storageName), encryptBuffer(data), { mode: 0o600, flag: "wx" });
  return { kind, originalName: safeFileName(originalName), mime, size: data.length, sha256: sha256(data), storageName };
};

export const readDocument = (storageName: string) => {
  if (!/^[A-Za-z0-9_-]+\.enc$/.test(storageName)) throw new Error("Bad document name");
  return decryptBuffer(fs.readFileSync(path.join(documentsDir(), storageName)));
};

export const deleteDocument = (storageName: string) => {
  try {
    fs.unlinkSync(path.join(documentsDir(), storageName));
  } catch {
    // already gone
  }
};
