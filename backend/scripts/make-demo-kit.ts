/*--Make the sample documents for the demo (docs/demo-kit/files). Run again only if they need changing:

    npm run demo-kit-files

  Every file is clearly marked SAMPLE - DEMO ONLY. Each company gets its own set (different files),
  so the "same document uploaded twice" check doesn't add noise to the demo.--*/

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

const OUT = path.resolve(__dirname, "../../docs/demo-kit/files");

const DOCS = [
  ["trade-licence.pdf", "Trade Licence"],
  ["tax-acknowledgement.pdf", "Tax Submission Acknowledgement"],
  ["bin-certificate.pdf", "BIN Certificate"],
  ["applicant-nid.pdf", "National ID (Applicant)"],
  ["payment-receipt.pdf", "Pay Order / Fund Transfer Receipt"],
] as const;

const samplePdf = async (title: string, company: string) => {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`SAMPLE - ${title}`);
  const page = pdf.addPage([595, 842]); // A4
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const red = rgb(0.8, 0.1, 0.1);
  page.drawText("SAMPLE - DEMO ONLY", { x: 70, y: 420, size: 54, font: bold, color: rgb(0.95, 0.8, 0.8), rotate: degrees(35) });
  page.drawText("SAMPLE - DEMO ONLY - NOT A REAL DOCUMENT", { x: 60, y: 780, size: 14, font: bold, color: red });
  page.drawText(title, { x: 60, y: 730, size: 24, font: bold });
  page.drawText(`Company: ${company}`, { x: 60, y: 690, size: 13, font });
  page.drawText("Made for demonstrating the BSREA membership system.", { x: 60, y: 665, size: 11, font });
  return Buffer.from(await pdf.save());
};

/*--A plain "passport photo" placeholder: grey with a darker head-and-shoulders shape, as a real PNG--*/
const samplePhoto = (shade: number) => {
  const w = 240;
  const h = 300;
  const rows: Buffer[] = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const head = (x - 120) ** 2 + (y - 110) ** 2 < 55 ** 2;
      const body = y > 180 && Math.abs(x - 120) < 30 + (y - 180) * 0.8;
      const v = head || body ? shade - 90 : shade;
      row.set([v, v, v + 10], 1 + x * 3);
    }
    rows.push(row);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

(async () => {
  for (const [folder, company, shade] of [
    ["1-sunrise", "Demo Sunrise Solar Ltd", 215],
    ["3-sunnrise", "Demo Sunnrise Solar Ltd", 200],
  ] as const) {
    const dir = path.join(OUT, folder);
    fs.mkdirSync(dir, { recursive: true });
    for (const [file, title] of DOCS) {
      // The look-alike company has no payment receipt, to show the "no receipt" warning
      if (folder === "3-sunnrise" && file === "payment-receipt.pdf") continue;
      fs.writeFileSync(path.join(dir, file), await samplePdf(title, company));
    }
    fs.writeFileSync(path.join(dir, "applicant-photo.png"), samplePhoto(shade));
  }
  // Looks like a PDF by its name, but starts like a Windows program ("MZ"): the upload check must refuse it
  fs.writeFileSync(path.join(OUT, "fake.pdf"), "MZ\x90\x00 This is not a PDF. It is a program pretending to be one (demo file, harmless).\n");
  console.log(`Demo files written to ${OUT}`);
})();
