import dayjs from "dayjs";

export interface BookingItem {
  id: string;
  bookingRef?: string;
  customerName?: string;
  totalPax?: number;
  hotelName?: string;
  address?: string;
  phone?: string;
  payment?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  collectAmount?: number | null;
  refundAmount?: number | null;
  // Bằng chứng nguồn gốc: bus đã bị chuyển ra khỏi (giữ màu đỏ trên board)
  movedFromBus?: { code?: string; vehicle?: { plateNumber?: string } } | null;
  // Lớp 1 quyết toán: các khoản thu/chi gắn theo booking này
  settlements?: SettlementItem[];
}

export interface SettlementItem {
  id: string;
  amount: number;
  note?: string | null;
  imageUrl?: string | null;
  category?: { name?: string; flowType?: "COLLECT_MONEY" | "PAY_MONEY" } | null;
  customCategoryName?: string | null;
  createdById?: string;
}

export interface PickupInfoItem {
  bookingRef?: string;
  customerName?: string;
  pickup?: string;
  totalPax?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface BoardItem {
  id: string;
  code: string;
  tourName: string;
  tourType: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  origin?: "MANUAL" | "AUTO_ASSIGN";
  totalPax: number;
  latitude?: number | null;
  longitude?: number | null;
  pickupInfo?: PickupInfoItem[] | null;
  vehicle?: { plateNumber?: string; capacity?: number } | null;
  provider?: { name?: string } | null;
  driver?: { id?: string; name?: string } | null;
  guide?: { id?: string; name?: string } | null;
  reportVerifier?: { name?: string } | null;
  bookings?: BookingItem[];
  // Lớp 2 quyết toán: khoản chi theo toàn bộ chuyến
  settlements?: SettlementItem[];
  // Báo cáo tour + quyết toán (đi với Dispatch Board / accounting verify)
  tourReport?: {
    status?: string;
    verifiedByName?: string | null;
    verifiedAt?: string | null;
    submittedByName?: string | null;
    submittedAt?: string | null;
    verificationNotes?: string | null;
    actualPax?: number | null;
    distanceKm?: number | null;
    fuelCost?: number | null;
    tollParking?: number | null;
    pickupNotes?: string | null;
    notes?: string | null;
    collectedAmount?: number | null;
    refundedAmount?: number | null;
    servicesTotal?: number | null;
    netAmount?: number | null;
    settlementFlow?: "COLLECT_MONEY" | "PAY_MONEY" | null;
    evidenceImages?: Array<{ name?: string; url: string; uploadedAt?: string; uploadedByName?: string }>;
  } | null;
  createdWho?: string;
}

export interface TourMeta {
  label: string;
  color: "blue" | "purple";
  accent: string;
}

export interface LeaveRange {
  id: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

export interface CrewMember {
  id: string;
  name?: string | null;
  email?: string;
  type?: "OFFICIAL" | "FREELANCE";
  languages?: string[];
  rating?: number | null;
  provider?: { id?: string; name?: string } | null;
  isBusy?: boolean;
  leaves?: LeaveRange[];
}

export interface BoardCrew {
  guides: CrewMember[];
  drivers: CrewMember[];
}

// Màu riêng cho nhân sự đang nghỉ phép — admin nhìn board dễ phân biệt.
export const LEAVE_COLOR = "#fa541c";

export const STATUS_COLORS: Record<string, string> = {
  DRAFT_ASSIGNED: "gold",
  PENDING: "orange",
  TRANSFERRED: "volcano",
  DISPATCHED: "blue",
  VERIFYING: "purple",
  COMPLETED: "green",
  CANCELED: "red",
};

export const TYPE_META: Record<string, TourMeta> = {
  GROUP_TOUR: { label: "Group", color: "blue", accent: "#1677ff" },
  PRIVATE_TOUR: { label: "Private", color: "purple", accent: "#722ed1" },
  OTHER: { label: "Other", color: "purple", accent: "#8c8c8c" },
};

export const sortByDate = (a: BoardItem, b: BoardItem) =>
  dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf();
