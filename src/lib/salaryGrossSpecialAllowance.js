export function floorInr(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.floor(x);
}

export function parseRupeeAmount(v) {
  if (v == null || v === "") return null;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function getEffectiveGrossSalary(structure) {
  if (!structure) return null;
  const sum =
    floorInr(structure.basic_salary) +
    floorInr(structure.hra) +
    floorInr(structure.transport_allowance) +
    floorInr(structure.medical_allowance) +
    floorInr(structure.special_allowance) +
    floorInr(structure.bonus);
  if (sum > 0) return sum;
  const manual = parseRupeeAmount(structure.gross_salary);
  if (manual != null && manual > 0) return floorInr(manual);
  return null;
}

export const LOW_GROSS_PF_MONTHLY_MAX = 21000;
export const LOW_GROSS_PF_RATE = 0.0075;
export const FIXED_HEALTH_INSURANCE_INR = 277;

export function isLowGrossPfMonthly(monthlyGross) {
  const g = floorInr(monthlyGross);
  return g > 0 && g <= LOW_GROSS_PF_MONTHLY_MAX;
}

export function computePfFromGrossAndBasic(_monthlyGrossFromStructure, basicSalary) {
  return floorInr(0.12 * (Number(basicSalary) || 0));
}
