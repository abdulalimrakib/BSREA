/*--Normalising values so that small differences in typing don't hide a duplicate--*/

// Words that don't tell two companies apart ("Solar Power Ltd." = "Solar Power Limited")
const COMPANY_NOISE = new Set([
  "ltd", "limited", "pvt", "private", "plc", "inc", "co", "company", "corp", "corporation",
  "the", "and", "of", "bd", "bangladesh", "m", "s", "ms",
]);

/*--"M/S. Bengal Renewable Energy Ltd." -> "bengalrenewableenergy"
  Spaces are dropped too, so "Sun Rise Power" and "Sunrise Power" are the same company.--*/
export const normalizeCompanyName = (name: string) =>
  name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ") // drop bracketed extras: "Humayun Trading (Safari Solar)"
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((word) => word && !COMPANY_NOISE.has(word))
    .join("");

export const normalizeEmail = (email: string) => email.normalize("NFKC").trim().toLowerCase();

/*--Bangladesh mobile numbers: "+880 1711-523423", "8801711523423" and "01711523423" are the same number--*/
export const normalizePhone = (phone: string) => {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("00880")) digits = "0" + digits.slice(5);
  return digits;
};

/*--Registration numbers (trade licence, BIN, TIN, NID, passport): only letters and digits, upper case--*/
export const normalizeId = (value: string) => value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");

/*--How alike two normalised company names are, 0 (nothing alike) to 1 (the same).
  Uses letter pairs (Sørensen–Dice), which copes with typos and word order.--*/
const pairs = (text: string) => {
  const s = text.replace(/ /g, "");
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const pair = s.slice(i, i + 2);
    out.set(pair, (out.get(pair) ?? 0) + 1);
  }
  return out;
};

export const nameSimilarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const pa = pairs(a);
  const pb = pairs(b);
  let shared = 0;
  let total = 0;
  for (const count of pa.values()) total += count;
  for (const count of pb.values()) total += count;
  for (const [pair, count] of pa) shared += Math.min(count, pb.get(pair) ?? 0);
  return total ? (2 * shared) / total : 0;
};
