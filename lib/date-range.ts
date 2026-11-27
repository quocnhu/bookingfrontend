import dayjs, { type Dayjs } from "dayjs";

export type DateRange = [Dayjs, Dayjs];

export function currentMonthRange(): DateRange {
  return [dayjs().startOf("month"), dayjs().endOf("month")];
}

export function currentMonthDateStrings(): [string, string] {
  const [from, to] = currentMonthRange();
  return [from.format("YYYY-MM-DD"), to.format("YYYY-MM-DD")];
}
