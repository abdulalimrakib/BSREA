import { Request, Response } from "express";
import { audit } from "../services/audit";
import {
  applicationSchema,
  createApplication,
  DuplicateError,
  fieldErrors,
} from "../services/applications";
import {
  deleteDocument,
  detectFileType,
  DOCUMENT_KINDS,
  isRequired,
  storeDocument,
  type DocumentKind,
  type StoredDocument,
} from "../services/documents";
import {
  scanBuffer,
  ScannerUnavailable,
  scanningEnabled,
} from "../services/virus-scan";
import { sendResponse } from "../utils/response";

/*--Public: submit a membership application (multipart form with documents)--*/

const kinds = Object.keys(DOCUMENT_KINDS) as DocumentKind[];

/*--POST /api/v1/applications--*/
export const submitApplication = async (req: Request, res: Response) => {
  // Spam trap: only bots fill the hidden "website2" field
  if (typeof req.body?.website2 === "string" && req.body.website2.trim()) {
    return sendResponse(res, 201, "Application received", {
      reference: "APP-RECEIVED",
    });
  }

  const parsed = applicationSchema.safeParse(req.body ?? {});
  const errors: Record<string, string> = parsed.success
    ? {}
    : fieldErrors(parsed.error);

  // Check every file: required ones present, and each really a PDF, JPG or PNG
  const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
  const accepted: {
    kind: DocumentKind;
    file: Express.Multer.File;
    mime: string;
  }[] = [];
  for (const kind of kinds) {
    const file = files[kind]?.[0];
    if (!file) {
      if (isRequired(kind))
        errors[kind] = `Please upload the ${DOCUMENT_KINDS[kind].label}`;
      continue;
    }
    const type = detectFileType(file.buffer);
    if (!type) errors[kind] = "Only PDF, JPG or PNG files are accepted";
    else accepted.push({ kind, file, mime: type.mime });
  }

  if (!parsed.success || Object.keys(errors).length) {
    return sendResponse(
      res,
      400,
      "Please check the form and try again",
      errors,
    );
  }

  // Virus scan (when a scanner is configured), before anything is stored
  if (scanningEnabled()) {
    try {
      for (const { kind, file } of accepted) {
        const result = await scanBuffer(file.buffer);
        if (!result.clean) {
          audit(req, "application.virus_found", undefined, {
            kind,
            virus: result.virus,
          });
          return sendResponse(res, 400, "Please check the form and try again", {
            [kind]: "This file was refused by the virus scanner",
          });
        }
      }
    } catch (error) {
      if (!(error instanceof ScannerUnavailable)) throw error;
      console.error(error.message);
      return sendResponse(
        res,
        503,
        "Uploads can't be checked right now. Please try again later.",
      );
    }
  }

  const stored: StoredDocument[] = accepted.map(({ kind, file, mime }) =>
    storeDocument(kind, file.originalname, file.buffer, mime),
  );
  try {
    const result = createApplication(parsed.data, stored);
    audit(
      req,
      "application.submitted",
      { type: "application", id: result.id },
      { reference: result.reference, reviewFlags: result.reviewFlags },
    );
    return sendResponse(res, 201, "Application received", {
      reference: result.reference,
    });
  } catch (error) {
    stored.forEach((d) => deleteDocument(d.storageName));
    if (
      error instanceof DuplicateError ||
      (error instanceof Error && /UNIQUE constraint failed/.test(error.message))
    ) {
      // Staff see exactly what matched in the audit log; the public gets a general answer only
      audit(req, "application.blocked_duplicate", undefined, {
        company: parsed.data.company,
        matches:
          error instanceof DuplicateError
            ? error.matches.filter((m) => m.level === "block")
            : "unique index",
      });
      return sendResponse(
        res,
        409,
        "A membership or an open application with these company details already exists. If you think this is a mistake, please contact the BSREA secretariat.",
      );
    }
    throw error;
  }
};
