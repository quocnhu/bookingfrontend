import dayjs, { Dayjs } from "dayjs";

/** Normal leave must be requested this many calendar days before the first day off. */
export const LEAVE_NOTICE_DAYS = 2;

/** Automatic dispatch runs at 04:00, so same-day emergencies must be in before then. */
export const EMERGENCY_CUTOFF_HOUR = 4;

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

export function isEmergencyCutoffPassed(now: Dayjs = dayjs()) {
  return now.hour() >= EMERGENCY_CUTOFF_HOUR;
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
    return day.isSame(today, "day") && isEmergencyCutoffPassed(now);
  }
  return day.isBefore(earliestNormalLeaveDate(now));
}

export function leaveTimingHint(isEmergency: boolean) {
  return isEmergency
    ? "Emergency requests are for last-minute leave. Same-day requests must be submitted before 04:00, before automatic dispatch runs."
    : `Normal requests must start at least ${LEAVE_NOTICE_DAYS} days from today. Tick Emergency only for last-minute leave.`;
}
