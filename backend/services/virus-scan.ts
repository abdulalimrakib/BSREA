import net from "net";
import envConfig from "../config/env.config";

/*--Virus scanning with ClamAV (the clamd service), using its INSTREAM command.
  Turned on by setting CLAMAV_HOST. When it is on and the scanner can't be reached, uploads are
  refused rather than let through unscanned.--*/

export type ScanResult = { clean: true } | { clean: false; virus: string };

export class ScannerUnavailable extends Error {}

export const scanningEnabled = () => envConfig.CLAMAV_HOST !== "";

const CHUNK = 64 * 1024;
const TIMEOUT_MS = 30_000;

/*--Send the file to clamd and read its verdict ("stream: OK" or "stream: <name> FOUND")--*/
export const scanBuffer = (
  data: Buffer,
  host = envConfig.CLAMAV_HOST,
  port = envConfig.CLAMAV_PORT,
): Promise<ScanResult> =>
  new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const replies: Buffer[] = [];
    let settled = false;
    const finish = (error: Error | null, result?: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result!);
    };

    socket.setTimeout(TIMEOUT_MS, () =>
      finish(
        new ScannerUnavailable("The virus scanner did not answer in time"),
      ),
    );
    socket.on("error", (error) =>
      finish(
        new ScannerUnavailable(
          `The virus scanner can't be reached: ${error.message}`,
        ),
      ),
    );
    socket.on("data", (chunk) => replies.push(chunk));
    socket.on("end", () => {
      const reply = Buffer.concat(replies)
        .toString("utf8")
        .replace(/\0/g, "")
        .trim();
      if (/^stream: OK$/.test(reply)) return finish(null, { clean: true });
      const found = reply.match(/^stream: (.+) FOUND$/);
      if (found) return finish(null, { clean: false, virus: found[1] });
      finish(
        new ScannerUnavailable(`The virus scanner gave an unexpected answer`),
      );
    });
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < data.length; offset += CHUNK) {
        const part = data.subarray(offset, offset + CHUNK);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(part.length);
        socket.write(size);
        socket.write(part);
      }
      socket.write(Buffer.alloc(4)); // a zero-length chunk ends the stream
    });
  });
