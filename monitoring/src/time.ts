import { config } from "./config.ts";

/*--Time helpers. Stored times are Unix seconds; "days" are calendar days in config.TIMEZONE.--*/

export const nowSec = () => Math.floor(Date.now() / 1000);
export const minuteOf = (sec: number) => sec - (sec % 60);
export const hourOf = (sec: number) => sec - (sec % 3600);

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: config.TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
let lastDaySec = -1;
let lastDay = "";
/*--"2026-11-17" for a time in seconds--*/
export const dayKey = (sec: number) => {
  const minute = minuteOf(sec);
  if (minute !== lastDaySec) {
    lastDay = dayFormat.format(new Date(minute * 1000));
    lastDaySec = minute;
  }
  return lastDay;
};

/*--Seconds the time zone is ahead of UTC (Asia/Dhaka: 21600). Used to group by local day in SQL.--*/
export const tzOffsetSec = (at = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: config.TIMEZONE, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((local - (at.getTime() - (at.getTime() % 60000))) / 1000);
};

/*--Start of the local day containing `sec`, in seconds--*/
export const dayStart = (sec: number) => {
  const offset = tzOffsetSec(new Date(sec * 1000));
  return Math.floor((sec + offset) / 86400) * 86400 - offset;
};
