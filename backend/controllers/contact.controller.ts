import { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import envConfig from "../config/env.config";
import { encryptText } from "../utils/security";
import { sendResponse } from "../utils/response";

/*--Contact form messages from the website's Contact page--*/
// Each message is added as one JSON line to storage/contact-messages.jsonl, encrypted, until there is a database.
// Read them with decryptText(line.data) from utils/security.

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[+\d][\d\s\-()]{5,29}$/;

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/*--Check the form and give back { field: "what is wrong" } (empty when all is fine)--*/
export const validateContact = (body: Record<string, unknown>) => {
  const errors: Record<string, string> = {};
  const name = text(body.name);
  const email = text(body.email);
  const phone = text(body.phone);
  const message = text(body.message);

  if (!name) errors.name = "Please enter your name";
  else if (name.length > 100) errors.name = "Name is too long";
  if (!email) errors.email = "Please enter your email";
  else if (!EMAIL.test(email) || email.length > 150)
    errors.email = "Please enter a valid email address";
  if (phone && !PHONE.test(phone))
    errors.phone = "Please enter a valid phone number";
  if (!message) errors.message = "Please write a message";
  else if (message.length > 5000)
    errors.message = "Message is too long (5000 characters at most)";

  return { errors, values: { name, email, phone, message } };
};

/*--POST /api/v1/contact--*/
export const sendContactMessage = async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;

  // Spam trap: the hidden "website" field is only filled in by bots. Pretend it worked.
  if (text(body.website))
    return sendResponse(res, 201, "Message sent", { id: "ok" });

  const { errors, values } = validateContact(body);
  if (Object.keys(errors).length)
    return sendResponse(
      res,
      400,
      "Please check the form and try again",
      errors,
    );

  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  // Messages hold names, emails and phone numbers: each one is stored encrypted (AES-256-GCM)
  const line = {
    id,
    receivedAt,
    data: encryptText(JSON.stringify({ ...values, ip: req.ip })),
  };
  await fs.mkdir(envConfig.STORAGE_DIR, { recursive: true, mode: 0o700 });
  await fs.appendFile(
    path.join(envConfig.STORAGE_DIR, "contact-messages.jsonl"),
    JSON.stringify(line) + "\n",
    { encoding: "utf8", mode: 0o600 },
  );

  return sendResponse(res, 201, "Message sent", { id });
};
