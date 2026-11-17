import { NextFunction, Request, Response } from "express";
import { sendResponse } from "../utils/response";

/*--Unknown route--*/
export const notFound = (req: Request, res: Response) => {
  sendResponse(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);
};

/*--Any error thrown in a route ends up here--*/
// Express needs all four parameters to know this is an error handler.
export const errorHandler = (
  err: Error & { type?: string; status?: number },
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Problems with the request body itself are the sender's fault, not a server error
  if (err.type === "entity.parse.failed")
    return sendResponse(res, 400, "The request body is not valid JSON");
  if (err.type === "entity.too.large")
    return sendResponse(res, 413, "The request is too large");
  console.error(err);
  // Never send error details to the browser: they can reveal how the system works
  sendResponse(res, 500, "Internal server error");
};
