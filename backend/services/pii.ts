import { blindIndex, decryptText, encryptText } from "../utils/security";
import { normalizeEmail, normalizePhone } from "../utils/normalize";

/*--Personal data helpers.
  Personal values (names, emails, phone numbers, ID numbers) are stored encrypted (columns ending in _enc).
  To find duplicates without decrypting, each one also gets a keyed fingerprint (columns ending in _idx):
  equal values give equal fingerprints, but the fingerprint can't be turned back into the value.--*/

export const emailIdx = (email: string | null | undefined) => {
  const v = email ? normalizeEmail(email) : "";
  return v ? blindIndex(`email:${v}`) : null;
};

// Numbers shorter than 6 digits are too vague to match on
export const phoneIdx = (phone: string | null | undefined) => {
  const v = phone ? normalizePhone(phone) : "";
  return v.length >= 6 ? blindIndex(`phone:${v}`) : null;
};

export const encryptOptional = (value: string | null | undefined) => (value ? encryptText(value) : null);

export const decryptOptional = (value: unknown) => (typeof value === "string" && value ? decryptText(value) : null);
