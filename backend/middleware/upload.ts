import { NextFunction, Request, Response } from "express";
import multer from "multer";
import {
  DOCUMENT_KINDS,
  MAX_FILE_BYTES,
  type DocumentKind,
} from "../services/documents";
import { sendResponse } from "../utils/response";

/*--Reads the membership application's multipart form (fields + documents) into memory, with strict limits--*/

const kinds = Object.keys(DOCUMENT_KINDS) as DocumentKind[];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: kinds.length,
    fields: 40,
    fieldSize: 2000,
    parts: 60,
    fieldNameSize: 50,
  },
}).fields(kinds.map((name) => ({ name, maxCount: 1 })));

/*--Uploads are held in memory until checked and encrypted (never written to disk unencrypted).
  To keep that memory bounded, only a few applications are handled at the same time; the rest are
  asked to try again in a moment. Worst case: MAX_PARALLEL x 10 files x 5 MB.--*/
export const MAX_PARALLEL_UPLOADS = 4;
let uploadsInProgress = 0;

// Turn multer's errors into normal 400 answers
export const parseApplicationUpload = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (uploadsInProgress >= MAX_PARALLEL_UPLOADS) {
    res.setHeader("Retry-After", "30");
    return sendResponse(
      res,
      503,
      "The server is busy with other applications. Please try again in a minute.",
    );
  }
  uploadsInProgress++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      uploadsInProgress--;
    }
  };
  // The files stay in memory until the answer has been sent
  res.on("finish", release);
  res.on("close", release);

  upload(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `Each file must be ${MAX_FILE_BYTES / 1024 / 1024} MB or smaller`
          : error.code === "LIMIT_UNEXPECTED_FILE"
            ? "Unexpected file field"
            : "The upload could not be read";
      return sendResponse(
        res,
        400,
        message,
        error.field ? { [error.field]: message } : null,
      );
    }
    next(error);
  });
};
