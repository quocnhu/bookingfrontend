export interface HotelBookingRow {
  id: string;
  bookingRef: string;
  customerName: string | null;
  hotelName: string;
  startingDate: string | null;
  totalPax: number;
  totalAmount: number;
  currency: string;
  payment: string;
  status: string;
  assignmentStatus: string | null;
  tourId: string | null;
  tourName: string | null;
  commissionPercent: number;
  commissionAmount: number;
  commissionEarned: boolean;
  commissionPaid?: boolean;
  commissionPaidAt?: string | null;
  commissionPaidByName?: string | null;
  commissionPaymentMethod?: string | null;
  commissionPaymentReference?: string | null;
}

export interface HotelTourSummary {
  tourId: string | null;
  tourName: string;
  bookings: number;
  pax: number;
  revenue: number;
  earned: number;
  pending: number;
  paid?: number;
  unpaid?: number;
}

export interface HotelDashboardData {
  hotel: { id: string; name: string; commissionPercent: number };
  totals: {
    bookings: number;
    pax: number;
    revenue: number;
    earned: number;
    pending: number;
    paid?: number;
    unpaid?: number;
    tours: number;
  };
  byTour: HotelTourSummary[];
  recentBookings: HotelBookingRow[];
}

export interface HotelBookingsData {
  items: HotelBookingRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    bookings: number;
    pax: number;
    revenue: number;
    earned: number;
    pending: number;
    paid?: number;
    unpaid?: number;
  };
}

export const formatVnd = (value: number | string | null | undefined) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Number(value ?? 0),
  )} ₫`;

export const hotelBookingStatus = (row: HotelBookingRow) => {
  if (row.status === "CANCELED") return { label: "Canceled", color: "red" };
  if (row.commissionEarned && row.commissionPaid)
    return { label: "Commission paid", color: "green" };
  if (row.commissionEarned) return { label: "Earned - unpaid", color: "gold" };
  if (row.assignmentStatus === "COMPLETED") {
    return { label: "Awaiting payment", color: "orange" };
  }
  if (row.assignmentStatus === "DISPATCHED" || row.assignmentStatus === "VERIFYING") {
    return { label: "Tour in progress", color: "blue" };
  }
  if (row.status === "ASSIGNED") return { label: "Assigned", color: "geekblue" };
  return { label: "Pending", color: "default" };
};
