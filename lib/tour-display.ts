export type TourTiming = {
  durationDays?: number | null;
  durationValue?: number | null;
  durationUnit?: "HOUR" | "DAY" | null;
  freeCancellationHours?: number | null;
  departureTimes?: string[] | null;
};

export function departureLabel(time: string): string {
  const hour = Number(time.split(":")[0]);
  if (!Number.isFinite(hour)) return "Departure";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

export function formatDepartureTime(time: string): string {
  return `${departureLabel(time)} · ${time}`;
}

export function formatTourDuration(tour: TourTiming): string {
  const value = Number(tour.durationValue ?? 0);
  if (value > 0 && tour.durationUnit) {
    if (tour.durationUnit === "HOUR") {
      return `${value} ${value === 1 ? "Hour" : "Hours"}`;
    }
    return `${value} ${value === 1 ? "Day" : "Days"}`;
  }
  const days = Number(tour.durationDays ?? 1);
  return `${days} ${days === 1 ? "Day" : "Days"}`;
}

export function formatFreeCancellation(
  hours: number | null | undefined,
): string | null {
  if (hours == null) return null;
  if (hours <= 0) return "Free cancellation";
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `Free cancellation up to ${days} ${days === 1 ? "day" : "days"}`;
  }
  return `Free cancellation up to ${hours} ${hours === 1 ? "hour" : "hours"}`;
}
