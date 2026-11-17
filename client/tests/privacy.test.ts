import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { site } from "@/lib/site";

/*--The public website must not publish personal mobile numbers (members', committee's or staff's).
  Only BSREA's own official numbers are allowed.--*/

const MOBILE = /(?:\+?88[ -]?)?0[ -]?1[3-9](?:[ -]?\d){8}/g;
const digits = (s: string) => s.replace(/\D/g, "").replace(/^88/, "");
const official = new Set([site.phone, site.whatsapp].map(digits));

const files = (dir: string): string[] =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.(tsx?|json|md)$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );

describe("privacy", () => {
  it("publishes no personal mobile numbers", () => {
    const found = files(path.join(__dirname, "..", "src")).flatMap((file) => {
      // File names of uploaded images can contain long digit runs; they are not phone numbers
      const text = fs
        .readFileSync(file, "utf8")
        .replace(/\/uploads\/[^"'\s)]+/g, "");
      return [...text.matchAll(MOBILE)]
        .filter((m) => !official.has(digits(m[0])))
        .map(() => path.relative(path.join(__dirname, ".."), file));
    });
    // Only file names are reported, never the numbers themselves
    expect(found).toEqual([]);
  });
});
