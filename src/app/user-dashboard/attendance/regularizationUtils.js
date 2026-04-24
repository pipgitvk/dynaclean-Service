/** India Standard Time */
const IST = "Asia/Kolkata";

/** MySQL "YYYY-MM-DD HH:mm:ss" or ISO → value for <input type="datetime-local" />
 * If the input is a UTC string (which it is in our DB), we convert it to IST wall-time.
 */
export function mysqlDatetimeToDatetimeLocalValue(v) {
  if (v == null || v === "") return "";
  
  let d;
  const s = String(v).trim();
  
  // If it's a naive MySQL string "YYYY-MM-DD HH:mm:ss", assume it's UTC if that's our convention
  const isNaive = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s);
  if (isNaive) {
    // Parse as UTC: "2024-01-01 12:00:00" -> Date object at 12:00 UTC
    const parts = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (parts) {
      d = new Date(Date.UTC(
        parseInt(parts[1], 10),
        parseInt(parts[2], 10) - 1,
        parseInt(parts[3], 10),
        parseInt(parts[4], 10),
        parseInt(parts[5], 10),
        parseInt(parts[6], 10)
      ));
    }
  } else {
    d = new Date(v);
  }

  if (!d || Number.isNaN(d.getTime())) return "";

  // Convert to IST wall-time string for <input type="datetime-local" /> (YYYY-MM-DDTHH:mm)
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

  // Intl.DateTimeFormat with en-CA and hour24: true gives "YYYY-MM-DD, HH:mm" or similar
  // We want "YYYY-MM-DDTHH:mm"
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** datetime-local (IST wall-time) → MySQL datetime string in UTC */
export function datetimeLocalToMysql(v) {
  if (v == null || v === "") return null;
  const t = String(v).trim(); // "YYYY-MM-DDTHH:mm"
  if (!t) return null;

  // This is IST wall-time. We need to convert it BACK to UTC for the database.
  const d = new Date(t); // Note: new Date("YYYY-MM-DDTHH:mm") parses as local time
  if (Number.isNaN(d.getTime())) return null;

  // We need to tell JS this string is IST.
  // A simple way is to append the IST offset or use a formatter.
  // But wait, the browser's `new Date(t)` will parse it using the browser's local timezone.
  // If the user is in India, it's already IST. If not, it's problematic.
  
  // To be safe, let's parse it as IST wall-time explicitly.
  const parts = t.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!parts) return null;

  // Create a Date object in IST
  const dateStr = `${parts[1]}-${parts[2]}-${parts[3]}T${parts[4]}:${parts[5]}:00`;
  const istDate = new Date(dateStr + "+05:30"); // Force IST offset

  if (Number.isNaN(istDate.getTime())) return null;

  // Convert to UTC MySQL string "YYYY-MM-DD HH:mm:ss"
  const iso = istDate.toISOString(); // "YYYY-MM-DDTHH:mm:ss.sssZ"
  return iso.replace("T", " ").slice(0, 19);
}
