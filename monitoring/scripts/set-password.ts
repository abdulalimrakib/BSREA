/*--Set (or change) the dashboard password. Everyone signed in is signed out.

    npm run set-password

  Use at least 12 characters. Share it only with the people who look after the website.
  The typing is hidden (a * per character). Only public Node.js features are used, so it keeps working
  across Node.js updates. When not run in a terminal, two lines are read from the input instead.--*/

import { setPassword } from "../src/auth.ts";

/*--Ask in a terminal, showing * for each character--*/
const askHidden = (question: string) =>
  new Promise<string>((resolve) => {
    const input = process.stdin;
    process.stdout.write(question);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const done = (answer: string) => {
      input.setRawMode(false);
      input.pause();
      input.off("data", onData);
      process.stdout.write("\n");
      resolve(answer);
    };
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") return done(value);
        if (char === "\u0003") {
          // Ctrl+C
          input.setRawMode(false);
          process.stdout.write("\nCancelled. Nothing changed.\n");
          process.exit(130);
        }
        if (char === "\u007f" || char === "\b") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (char >= " ") {
          value += char;
          process.stdout.write("*");
        }
      }
    };
    input.on("data", onData);
  });

/*--Not a terminal (piped input): read the first two lines--*/
const readLines = async () => {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  const [first = "", second = ""] = text.split(/\r?\n/);
  return [first, second];
};

const [first, second] = process.stdin.isTTY
  ? [await askHidden("New dashboard password: "), await askHidden("Again, to check:       ")]
  : await readLines();

if (first !== second) {
  console.error("The two passwords are different. Nothing changed.");
  process.exit(1);
}
if (first.length < 12) {
  console.error("Use at least 12 characters. Nothing changed.");
  process.exit(1);
}
setPassword(first);
console.log("Password saved. Sign in at the dashboard address.");
