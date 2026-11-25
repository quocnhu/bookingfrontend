export type UnpaidBookingLike = {
  channel?: string | null;
  status?: string | null;
  payment?: string | null;
  paymentMethod?: string | null;
  payLater?: boolean | null;
};

export const UNPAID_CANCELLATION_REASON = "PayPal payment not completed";

export function isUnpaidPayPalBooking(booking: UnpaidBookingLike | null | undefined): boolean {
  if (!booking) return false;
  return (
    booking.channel === "WEBSITE" &&
    booking.payment === "PENDING" &&
    booking.paymentMethod === "PAYPAL" &&
    booking.payLater !== true &&
    booking.status !== "CANCELED"
  );
}

export function formatUnpaidDeadline(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
}

export function formatVnd(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0 ₫";
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount)} ₫`;
}
