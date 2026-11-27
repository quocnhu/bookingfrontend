const HCM_OFFSET_MS = 7 * 60 * 60 * 1000;

export function hcmDateKey(
  value: string | number | Date | null | undefined,
): string {
  if (value == null) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() + HCM_OFFSET_MS).toISOString().slice(0, 10);
}

export function hcmDayValue(
  value: string | number | Date | null | undefined,
): number {
  const key = hcmDateKey(value);
  if (!key) return Number.NaN;
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function isSameHcmDay(
  first: string | number | Date | null | undefined,
  second: string | number | Date | null | undefined,
): boolean {
  const a = hcmDateKey(first);
  const b = hcmDateKey(second);
  return Boolean(a && b && a === b);
}

export function hcmDayRangesOverlap(
  firstStart: string | number | Date | null | undefined,
  firstEnd: string | number | Date | null | undefined,
  secondStart: string | number | Date | null | undefined,
  secondEnd: string | number | Date | null | undefined,
): boolean {
  const aStart = hcmDayValue(firstStart);
  const aEnd = hcmDayValue(firstEnd);
  const bStart = hcmDayValue(secondStart);
  const bEnd = hcmDayValue(secondEnd);
  if (
    Number.isNaN(aStart) ||
    Number.isNaN(aEnd) ||
    Number.isNaN(bStart) ||
    Number.isNaN(bEnd)
  ) {
    return false;
  }
  return aStart <= bEnd && bStart <= aEnd;
}
