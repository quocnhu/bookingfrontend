import dayjs, { Dayjs } from "dayjs";

/** Normal leave must be requested this many calendar days before the first day off. */
export const LEAVE_NOTICE_DAYS = 2;

/** Dispatch is sealed at 21:00 HCM on the day before departure in both modes. */
export const EMERGENCY_CUTOFF_HOUR = 21;

/** Inclusive calendar days covered by a leave range. */
export function leaveDayCount(start: string | Date, end: string | Date) {
  const s = dayjs(start).startOf("day");
  const e = dayjs(end).startOf("day");
  return Math.max(0, e.diff(s, "day") + 1);
}

export function formatLeaveDayCount(count: number) {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

export function earliestNormalLeaveDate(now: Dayjs = dayjs()) {
  return now.startOf("day").add(LEAVE_NOTICE_DAYS, "day");
}

export function emergencyCutoffFor(date: Dayjs, now: Dayjs = dayjs()) {
  return dayjs(date)
    .startOf("day")
    .subtract(1, "day")
    .add(EMERGENCY_CUTOFF_HOUR, "hour")
    .valueOf();
}

/**
 * Dates that can never be picked, or cannot be picked unless the request is
 * marked as an emergency.
 */
export function isLeaveDateDisabled(
  date: Dayjs,
  isEmergency: boolean,
  now: Dayjs = dayjs(),
) {
  const day = date.startOf("day");
  const today = now.startOf("day");
  if (day.isBefore(today)) return true;

  if (isEmergency) {
    return now.valueOf() >= emergencyCutoffFor(day, now);
  }
  return day.isBefore(earliestNormalLeaveDate(now));
}

export function leaveTimingHint(isEmergency: boolean) {
  return isEmergency
    ? "Emergency requests are for last-minute leave. Submit before 21:00 HCM on the day before the first day off, when dispatch is sealed."
    : `Normal requests must start at least ${LEAVE_NOTICE_DAYS} days from today. Tick Emergency only for last-minute leave.`;
}
