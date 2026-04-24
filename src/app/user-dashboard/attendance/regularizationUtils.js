/** India Standard Time */
const IST = "Asia/Kolkata";

function parseNaiveAsUtc(s) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return new Date(Date.UTC(
    parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10),
    parseInt(m[4], 10), parseInt(m[5], 10), parseInt(m[6] ?? "0", 10)
  ));
}

/** MySQL "YYYY-MM-DD HH:mm:ss" or ISO → value for <input type="datetime-local" />
 * The DB stores UTC, but we want to show IST wall-time in the modal.
 */
export function mysqlDatetimeToDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  
  const s = String(v).trim();
  const hasExplicitTz = /Z$/i.test(s) || /[+-]\d{2}:?\d{2}$/.test(s);
  
  let d;
  if (!hasExplicitTz) {
    d = parseNaiveAsUtc(s);
  } else {
    d = new Date(v);
  }

  if (!d || Number.isNaN(d.getTime())) return "";

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const p = {};
  parts.forEach(part => { p[part.type] = part.value; });

  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** datetime-local (IST wall-time) → MySQL datetime string in UTC */
export function datetimeLocalToMysql(v) {
  if (v == null || v === "") return null;
  const t = String(v).trim(); // "YYYY-MM-DDTHH:mm"
  if (!t) return null;

  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;

  // Interpret as IST wall-time and convert to UTC for storage
  const istIso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+05:30`;
  const d = new Date(istIso);
  
  if (Number.isNaN(d.getTime())) return null;

  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}
