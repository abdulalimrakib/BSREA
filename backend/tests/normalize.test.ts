import { describe, expect, it } from "vitest";
import { nameSimilarity, normalizeCompanyName, normalizeId, normalizePhone } from "../utils/normalize";

describe("normalising for duplicate checks", () => {
  it("treats company names that differ only in legal form or punctuation as the same", () => {
    expect(normalizeCompanyName("M/S. Bengal Renewable Energy Ltd.")).toBe(normalizeCompanyName("Bengal Renewable Energy Limited"));
    expect(normalizeCompanyName("Rahimafrooz Renewable Energy (Pvt.) Ltd")).toBe("rahimafroozrenewableenergy");
    expect(normalizeCompanyName("Solar & Wind Co.")).toBe(normalizeCompanyName("Solar and Wind Company"));
    expect(normalizeCompanyName("Sun Rise Power Ltd")).toBe(normalizeCompanyName("Sunrise Power Limited"));
  });

  it("finds near-identical names in the real member list", () => {
    const a = normalizeCompanyName("Humayun Trading Corporation (Safari Solar)");
    const b = normalizeCompanyName("Humayun Trading Corporation");
    expect(a).toBe(b);
    expect(nameSimilarity(normalizeCompanyName("Sherpa Power Engineering"), normalizeCompanyName("Sherpa Power Engineerng Ltd"))).toBeGreaterThan(0.85);
    expect(nameSimilarity(normalizeCompanyName("Solar Power Limited"), normalizeCompanyName("Paramount Textile"))).toBeLessThan(0.5);
  });

  it("writes Bangladesh phone numbers one way", () => {
    expect(normalizePhone("+880 1711-523423")).toBe("01711523423");
    expect(normalizePhone("8801711523423")).toBe("01711523423");
    expect(normalizePhone("01711 523 423")).toBe("01711523423");
  });

  it("keeps only letters and digits of registration numbers", () => {
    expect(normalizeId("trad/dncc/12345/2026")).toBe("TRADDNCC123452026");
  });
});
