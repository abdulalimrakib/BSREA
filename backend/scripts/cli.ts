import readline from "readline";

/*--Small helpers for the command-line scripts--*/

/*--The value after --name on the command line--*/
export const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};

/*--Ask a question on the terminal. All questions share one reader, so answers typed (or pasted) ahead
  are not lost between questions. With hidden = true the typing is shown as stars.--*/
let reader: readline.Interface | undefined;
let hideTyping = false;
let currentQuestion = "";
const lines: string[] = [];
const waiting: ((line: string) => void)[] = [];

const getReader = () => {
  if (!reader) {
    reader = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY ?? false });
    const r = reader as unknown as { _writeToOutput: (s: string) => void };
    const write = r._writeToOutput.bind(reader);
    r._writeToOutput = (s: string) => write(hideTyping && !s.startsWith(currentQuestion) && s !== "\r\n" && s !== "\n" ? "*".repeat(s.length) : s);
    reader.on("line", (line) => {
      const next = waiting.shift();
      if (next) next(line);
      else lines.push(line);
    });
  }
  return reader;
};

export const ask = (question: string, hidden = false) =>
  new Promise<string>((resolve) => {
    const r = getReader();
    hideTyping = hidden;
    currentQuestion = question;
    process.stdout.write(question);
    const queued = lines.shift();
    if (queued !== undefined) return resolve(queued);
    waiting.push(resolve);
    r.resume();
  }).finally(() => {
    hideTyping = false;
  });

/*--Let the script end once all questions are answered--*/
export const closePrompt = () => {
  reader?.close();
  reader = undefined;
};
