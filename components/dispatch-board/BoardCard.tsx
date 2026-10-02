"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  List,
  message,
  Select,
  Progress,
  Popover,
  Space,
  Tag,
  Tooltip,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  CalendarOutlined,
  CarOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  DownOutlined,
  PhoneOutlined,
  PlusOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  LockOutlined,
  SendOutlined,
  UndoOutlined,
  UpOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import dayjs, { Dayjs } from "dayjs";
import type { BoardCrew, BoardItem, TourMeta } from "./types";
import { STATUS_COLORS, LEAVE_COLOR } from "./types";

const { Text } = Typography;

// Module-level on purpose: a cross-bus drag starts in one card and drops in a
// different one, so a per-component ref cannot carry the id. dataTransfer alone
// is not enough either - getData() can come back empty at drop time (Safari,
// and some touch/pen paths), which made the whole board look inert.
let draggingBookingId: string | null = null;

function readDraggedBookingId(e: React.DragEvent): string | null {
  return draggingBookingId ?? e.dataTransfer.getData("text/plain") ?? null;
}

function clearDraggedBooking() {
  draggingBookingId = null;
}

// Root coordinate (office/depot) used for geo-sorted pickup order.
const ROOT_COORD = { lat: 10.765555329583654, lng: 106.70405681003786 };

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bookingKm(lat?: number | null, lng?: number | null): string {
  if (lat == null || lng == null) return "—";
  const km = haversineKm(ROOT_COORD.lat, ROOT_COORD.lng, lat, lng);
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

const GUIDE_FAILBACK = "#52c41a";
const DRIVER_FAILBACK = "#1677ff";
const GUIDE_COMPANY_COLOR = "#0caf7a";
const GUIDE_FREELANCE_COLOR = "#8a3ffc";
const DRIVER_PALETTE = ["#1677ff", "#13c2c2", "#fa8c16", "#eb2f96", "#722ed1", "#a0d911", "#f5222d"];

function boxStyle(color: string) {
  return {
    color,
    background: `${color}1a`,
    border: `${color}40`,
  };
}

function statusText(status?: string) {
  if (!status) return null;
  const color =
    status === "On duty" ? "#fa8c16" : status === "On leave" ? LEAVE_COLOR : "#52c41a";
  return (
    <Text style={{ fontSize: 11, fontWeight: 600, color, whiteSpace: "nowrap" }}>
      {status}
    </Text>
  );
}

function optionLabel(option: {
  name?: string | null;
  attr?: string;
  color: string;
  status?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: option.color,
          flex: "none",
        }}
      />
      <span>{option.name ?? "Unnamed"}</span>
      {option.attr && (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {option.attr}
        </Text>
      )}
      {statusText(option.status)}
    </span>
  );
}

function useElementMetrics<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [metrics, setMetrics] = useState({ over: false, shift: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const over = el.scrollWidth > el.clientWidth + 1;
      setMetrics({ over, shift: over ? el.scrollWidth - el.clientWidth : 0 });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...metrics };
}

function Marquee({
  children,
  strong = false,
  fill = false,
}: {
  children: ReactNode;
  strong?: boolean;
  fill?: boolean;
}) {
  const { ref, over, shift } = useElementMetrics<HTMLSpanElement>();
  const base: React.CSSProperties = {
    fontWeight: strong ? 600 : undefined,
    display: "inline-block",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    ...(fill ? { flex: 1 } : {}),
  };
  return (
    <span ref={ref} style={base}>
      <span
        className="board-marquee"
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          willChange: "transform",
          animation: over
            ? `board-marquee-x ${Math.max(5, shift / 30)}s linear infinite`
            : undefined,
          ["--shift" as string]: `-${shift}px`,
        }}
      >
        {children}
      </span>
    </span>
  );
}

function PersonSelect({
  label,
  icon,
  boxColor,
  currentId,
  currentName,
  options,
  canEdit,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  boxColor: string;
  currentId?: string | null;
  currentName?: string | null;
  options: Array<{
    id: string;
    name?: string | null;
    color: string;
    attr?: string;
    plain?: string;
    isBusy?: boolean;
    onLeave?: boolean;
    disabled?: boolean;
  }>;
  canEdit: boolean;
  onChange: (id: string | null) => void;
}) {
  const box = boxStyle(boxColor);
  const visible = options.filter(
    (o) => !o.isBusy || o.id === currentId || o.onLeave,
  );
  const selectOptions = visible.map((o) => {
    const status = o.onLeave ? "On leave" : o.id === currentId ? "On duty" : "Available";
    return {
      value: o.id,
      label: optionLabel({
        name: o.name,
        attr: o.attr,
        color: o.onLeave ? LEAVE_COLOR : o.color,
        status,
      }),
      plain: [o.plain, o.attr, status].filter(Boolean).join(" "),
      disabled: o.onLeave === true || o.disabled === true,
    };
  });

  return (
    <div
      style={{
        flex: 1,
        minWidth: 180,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        background: box.background,
        borderRadius: 8,
        border: `1px solid ${box.border}`,
      }}
    >
      <span style={{ color: box.color, fontSize: 14, display: "inline-flex" }}>
        {icon}
      </span>
      <Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
        {label}
      </Text>
      {canEdit ? (
        <Select
          size="middle"
          variant="borderless"
          showSearch
          allowClear
          style={{ flex: 1, minWidth: 0 }}
          popupMatchSelectWidth={false}
          dropdownStyle={{ minWidth: 380 }}
          placeholder={currentName ?? "Unassigned"}
          value={currentId ?? null}
          onChange={(id) => onChange((id as string | undefined) ?? null)}
          filterOption={(input, option) =>
            (option?.plain ?? "").toLowerCase().includes(input.toLowerCase())
          }
          labelRender={(props) => {
            if (!props.value) return null;
            const picked = visible.find((o) => o.id === props.value);
            if (!picked) return props.label;
            return (
              <Marquee>
                {optionLabel({
                  name: picked.name,
                  attr: picked.attr,
                  color: picked.onLeave ? LEAVE_COLOR : picked.color,
                })}
              </Marquee>
            );
          }}
          options={selectOptions}
        />
      ) : (
        <Marquee strong fill>
          {currentName ?? "Unassigned"}
        </Marquee>
      )}
      {(() => {
        const current = visible.find((o) => o.id === currentId);
        if (!current?.onLeave) return null;
        return (
          <Text
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: LEAVE_COLOR,
              background: `${LEAVE_COLOR}1a`,
              border: `1px solid ${LEAVE_COLOR}55`,
              borderRadius: 6,
              padding: "2px 6px",
              whiteSpace: "nowrap",
            }}
          >
            {current.attr}
          </Text>
        );
      })()}
    </div>
  );
}

export default function BoardCard({
  assignment: a,
  index,
  meta,
  today,
  confirming,
  canConfirm,
  onConfirm,
  onDispatch,
  dispatching,
  recalling,
  onRecall,
  onMoveBooking,
  onTemplate,
  onVerify,
  onReject,
  onAdditions,
  crew,
  onCrewChange,
}: {
  assignment: BoardItem;
  index: number;
  meta: TourMeta;
  today: Dayjs;
  confirming: boolean;
  canConfirm: boolean;
  onConfirm: (assignment: BoardItem) => void;
  onDispatch: (assignment: BoardItem) => void;
  dispatching: boolean;
  recalling: boolean;
  onRecall: (assignment: BoardItem) => void;
  onMoveBooking: (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
    position?: "before" | "after",
  ) => void;
  onTemplate: (assignment: BoardItem) => void;
  onVerify?: (assignment: BoardItem) => void;
  onReject?: (assignment: BoardItem) => void;
  onAdditions?: (assignment: BoardItem) => void;
  crew?: BoardCrew;
  onCrewChange?: (
    assignment: BoardItem,
    field: "guideId" | "driverId",
    userId: string | null,
  ) => void;
}) {
  const { token } = antdTheme.useToken();
  const [dragOver, setDragOver] = useState(false);
  // The insertion position is shown (above/below the hovered row) instead of
  // highlighting the whole row, which was misleading - it looked like that
  // booking would be replaced. rowId + pos live in one state so they can
  // never drift apart.
  const [dropTarget, setDropTarget] = useState<{
    rowId: string;
    pos: "before" | "after";
  } | null>(null);
  // dragenter/dragleave fire again for every child element the pointer
  // crosses, so a naive onDragLeave={() => setDragOver(false)} flickers the
  // highlight off mid-drag. Count enters/leaves and only clear at zero.
  const dragDepth = useRef(0);
  const { color, accent } = meta;
  const capacity = a.vehicle?.capacity ?? 12;
  const isFull = a.totalPax >= capacity;
  const isToday = dayjs(a.startDate).startOf("day").isSame(today);
  const activeTodayMs = today.startOf("day").valueOf();
  const startDayMs = dayjs(a.startDate).startOf("day").valueOf();
  const endDayMs = dayjs(a.endDate ?? a.startDate).startOf("day").valueOf();
  const isActiveToday = startDayMs <= activeTodayMs && endDayMs >= activeTodayMs;
  const recallLocked = Date.now() > dayjs(a.startDate).startOf("day").add(5, "hour").valueOf();
  const isEven = index % 2 === 0;
  const tint = isEven ? `${accent}12` : `${accent}1c`;
  const tintStrong = `${accent}2e`;
  const border = `${accent}59`;
  const day = a.startDate ? dayjs(a.startDate).format("DD MMM YYYY") : "—";
  const isRejected = a.tourReport?.status === "REJECTED";
  const procStatus = isRejected ? "REJECTED" : a.status;
  const procColor = isRejected ? "red" : STATUS_COLORS[a.status];
  // A trip that has already ended (endDate < today) counts as done: it cannot
  // be dragged/dropped, even if someone forgot to press Complete so the status
  // is still PENDING.
  const isPastTour = dayjs(a.endDate).endOf("day").isBefore(
    dayjs().startOf("day"),
  );
  const interactive =
    canConfirm &&
    a.status !== "COMPLETED" &&
    a.status !== "CANCELED" &&
    !isPastTour;
  const hasMovedBooking =
    a.bookings?.some((b) => b.movedFromBus) ?? false;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragOver(false);
      setDropTarget(null);
      if (!interactive) return;
      const bookingId = readDraggedBookingId(e);
      clearDraggedBooking();
      if (!bookingId) {
        message.error("Could not read the dragged assignment - try again");
        return;
      }
      onMoveBooking(bookingId, a.id, null);
    },
    [interactive, onMoveBooking, a.id],
  );

  const handleRowDrop = useCallback(
    (e: React.DragEvent, beforeBookingId: string) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepth.current = 0;
      setDragOver(false);
      const pos = dropTarget?.rowId === beforeBookingId ? dropTarget.pos : null;
      setDropTarget(null);
      if (!interactive) return;
      const bookingId = readDraggedBookingId(e);
      clearDraggedBooking();
      if (!bookingId) {
        message.error("Could not read the dragged assignment - try again");
        return;
      }
      if (bookingId === beforeBookingId) return;
      onMoveBooking(bookingId, a.id, beforeBookingId, pos ?? "before");
    },
    [interactive, onMoveBooking, a.id, dropTarget],
  );

  /** Arrow button: move a booking up/down one slot within the same bus. */
  const nudge = useCallback(
    (bookingId: string, dir: "up" | "down") => {
      if (!interactive) return;
      const ids = (a.bookings ?? []).map((b) => b.id);
      const at = ids.indexOf(bookingId);
      if (at === -1) return;
      if (dir === "up") {
        if (at === 0) return;
        onMoveBooking(bookingId, a.id, ids[at - 1], "before");
      } else {
        if (at === ids.length - 1) return;
        onMoveBooking(bookingId, a.id, ids[at + 1], "after");
      }
    },
    [interactive, onMoveBooking, a.id, a.bookings],
  );

  /** The top/bottom half of the row decides whether to insert before or after. */
  const rowDropPos = (e: React.DragEvent): "before" | "after" => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };

  const driverProviderColors = useMemo(() => {
    const map: Record<string, string> = {};
    const names = Array.from(
      new Set(
        (crew?.drivers ?? [])
          .map((d) => d.provider?.name)
          .filter((n): n is string => !!n),
      ),
    ).sort();
    names.forEach((n, i) => {
      map[n] = DRIVER_PALETTE[i % DRIVER_PALETTE.length];
    });
    return map;
  }, [crew]);

  // A guide/driver whose leave overlaps this trip's running dates → own colour.
  const onLeaveForDate = useCallback(
    (leaves?: BoardCrew["guides"][number]["leaves"]): string | null => {
      if (!leaves?.length) return null;
      const s = dayjs(a.startDate).startOf("day").valueOf();
      const e = dayjs(a.endDate).startOf("day").valueOf();
      const hit = leaves.find((l) => {
        const ls = dayjs(l.startDate).startOf("day").valueOf();
        const le = dayjs(l.endDate).startOf("day").valueOf();
        return ls <= e && le >= s;
      });
      return hit
        ? `${dayjs(hit.startDate).format("DD MMM")} → ${dayjs(hit.endDate).format("DD MMM")} (${hit.status})`
        : null;
    },
    [a.startDate, a.endDate],
  );

  const guidMembers = useMemo(
    () =>
      (crew?.guides ?? []).map((g) => {
        const leaveText = onLeaveForDate(g.leaves);
        const onLeave = !!leaveText;
        const base = g.type === "OFFICIAL" ? "Company" : "Freelance";
        const attr = onLeave ? `On leave ${leaveText}` : base;
        return {
          ...g,
          color: onLeave
            ? LEAVE_COLOR
            : g.type === "OFFICIAL"
              ? GUIDE_COMPANY_COLOR
              : GUIDE_FREELANCE_COLOR,
          attr,
          plain: [g.name, attr, onLeave ? "On leave" : ""]
            .filter(Boolean)
            .join(" "),
          isBusy: !!g.isBusy,
          onLeave,
          disabled: onLeave,
        };
      }),
    [crew, onLeaveForDate],
  );

  const driverMembers = useMemo(
    () =>
      (crew?.drivers ?? []).map((d) => {
        const leaveText = onLeaveForDate(d.leaves);
        const onLeave = !!leaveText;
        const color = onLeave
          ? LEAVE_COLOR
          : d.provider?.name
            ? (driverProviderColors[d.provider.name] ?? DRIVER_FAILBACK)
            : DRIVER_FAILBACK;
        return {
          ...d,
          color,
          attr: onLeave
            ? `On leave ${leaveText}`
            : d.provider?.name ?? undefined,
          plain: [d.name, onLeave ? "On leave" : d.provider?.name, leaveText]
            .filter(Boolean)
            .join(" "),
          isBusy: !!d.isBusy,
          onLeave,
          disabled: onLeave,
        };
      }),
    [crew, driverProviderColors, onLeaveForDate],
  );

  const currentGuide = guidMembers.find((g) => g.id === a.guide?.id);
  const currentDriver = driverMembers.find((d) => d.id === a.driver?.id);
  const guideBoxColor = currentGuide?.color ?? GUIDE_FAILBACK;
  const driverBoxColor = currentDriver?.color ?? DRIVER_FAILBACK;

  const activeBookings = a.bookings?.filter((b) => b.status !== "CANCELED") ?? [];

  return (
    <Card
      size="small"
      // A card that can't accept a drop used to fail silently - the browser
      // just showed the "not allowed" cursor. Say why instead.
      title={
        !canConfirm
          ? "You do not have permission to move bookings"
          : isPastTour
            ? "This trip has already run - assignments cannot be changed"
            : a.status === "COMPLETED" || a.status === "CANCELED"
              ? "This bus is closed and cannot take new bookings"
              : undefined
      }
      onDragEnter={(e) => {
        if (!interactive) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragOver(true);
      }}
      onDragOver={(e) => {
        if (!interactive) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => {
        if (!interactive) return;
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragOver(false);
        }
      }}
      onDrop={handleDrop}
      style={{
        marginBottom: 12,
        borderRadius: 12,
        border: `1px solid ${dragOver ? accent : border}`,
        borderLeft: `4px solid ${
          isToday || hasMovedBooking ? "#ff4d4f" : accent
        }`,
        background: dragOver ? `${accent}26` : tint,
        boxShadow: hasMovedBooking
          ? "0 0 0 2px rgba(255, 77, 79, 0.5), 0 2px 6px rgba(255, 77, 79, 0.25)"
          : dragOver
            ? `0 0 0 2px ${accent}40`
            : `0 2px 6px ${accent}22`,
        transition: "box-shadow 0.15s ease, background 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          padding: "8px 12px",
          background: `linear-gradient(90deg, ${accent}38 0%, ${accent}14 100%)`,
          border: `1px solid ${border}`,
          borderRadius: 8,
          flexWrap: "wrap",
        }}
      >
        <Tag color={color} style={{ margin: 0, fontWeight: 600 }}>
          {a.code}
        </Tag>
        {a.vehicle?.plateNumber && (
          <Tag
            icon={<CarOutlined />}
            color="default"
            style={{ margin: 0, fontWeight: 600 }}
          >
            {a.vehicle.plateNumber}
          </Tag>
        )}
        <Text strong style={{ flex: 1, whiteSpace: "normal", fontSize: 14 }}>
          {a.tourName}
        </Text>
        {isToday && (
          <Tag color="red" style={{ fontSize: 10, margin: 0 }}>
            Today
          </Tag>
        )}
        {a.tourReport?.status === "VERIFIED" && a.reportVerifier?.name && (
          <Tag
            icon={<SafetyCertificateOutlined />}
            color="success"
            style={{ margin: 0, fontWeight: 600 }}
          >
            Verified by {a.reportVerifier.name}
          </Tag>
        )}
        {a.tourReport?.status === "REJECTED" && (
          <Tag color="error" style={{ margin: 0, fontWeight: 600 }}>
            Need to verify again
          </Tag>
        )}
        {/* Watermark Accounting: money locked = no longer editable.
            Exported period = already paid, gone from the queue entirely. */}
        {a.tourReport?.moneyVerifiedAt && (
          <Tooltip
            title={
              a.tourReport.moneyVerifiedByName
                ? `Money locked by ${a.tourReport.moneyVerifiedByName} — ${new Date(
                    a.tourReport.moneyVerifiedAt,
                  ).toLocaleDateString("vi-VN")}. Amounts are now immutable.`
                : "Money locked by Accounting — amounts are now immutable."
            }
          >
            <Tag
              icon={<LockOutlined />}
              color="purple"
              style={{ margin: 0, fontWeight: 600 }}
            >
              Money locked
            </Tag>
          </Tooltip>
        )}
        {a.tourReport?.moneyVerifiedAt && a.tourReport.netAmount != null && (
          <Tag
            color={
              Number(a.tourReport.netAmount) > 0 ? "orange" : "blue"
            }
            style={{ margin: 0, fontSize: 10, fontWeight: 600 }}
          >
            {Number(a.tourReport.netAmount) > 0
              ? "Guide/Driver pays company"
              : Number(a.tourReport.netAmount) < 0
                ? "Company pays Guide/Driver"
                : "Settled"}
          </Tag>
        )}
        {a.paymentLines && a.paymentLines.length > 0 && (
          <Tooltip
            title={`Paid in period(s): ${a.paymentLines
              .map(
                (l) =>
                  `${l.payableTo?.name ?? "—"} · ${new Date(l.tourDate).toLocaleDateString("vi-VN")}`,
              )
              .join(" · ")}`}
          >
            <Tag
              icon={<CheckCircleOutlined />}
              color="success"
              style={{ margin: 0, fontWeight: 600 }}
            >
              Paid
            </Tag>
          </Tooltip>
        )}
        <Tag
          color={color === "blue" ? "geekblue" : "magenta"}
          style={{ margin: 0 }}
        >
          {a.totalPax}/{capacity} pax
        </Tag>
        <Tooltip title="Print the tour manifest (stamp for year-end audit)">
          <Button
            type="text"
            size="small"
            icon={<PrinterOutlined />}
            style={{ margin: 0, height: 28, width: 28 }}
            onClick={() => onTemplate(a)}
          />
        </Tooltip>
        <Tag
          color={procColor ?? "default"}
          style={{ fontSize: 10, margin: 0 }}
        >
          {procStatus}
        </Tag>
      </div>

      <Flex wrap gap={6} align="center" style={{ marginBottom: 10 }}>
        <Tag icon={<CalendarOutlined />} style={{ marginInlineEnd: 0 }}>
          {day} · {a.durationDays} day{a.durationDays > 1 ? "s" : ""}
        </Tag>
        {a.provider?.name && (
          <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>
            {a.provider.name}
          </Tag>
        )}
        {isFull && (
          <Tag color="red" style={{ marginInlineEnd: 0 }}>
            FULL
          </Tag>
        )}
        {a.origin && (
          <Tag
            color={a.origin === "AUTO_ASSIGN" ? "geekblue" : "green"}
            style={{ marginInlineEnd: 0, fontSize: 10 }}
          >
            {a.origin === "AUTO_ASSIGN" ? "Auto-Assign System" : "Manual"}
          </Tag>
        )}
      </Flex>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <PersonSelect
          label="Guide"
          icon={<UserOutlined />}
          boxColor={guideBoxColor}
          currentId={a.guide?.id}
          currentName={a.guide?.name}
          options={guidMembers}
          canEdit={a.status === "PENDING" && !!onCrewChange}
          onChange={(id) => onCrewChange?.(a, "guideId", id)}
        />
        <PersonSelect
          label="Driver"
          icon={<CarOutlined />}
          boxColor={driverBoxColor}
          currentId={a.driver?.id}
          currentName={a.driver?.name}
          options={driverMembers}
          canEdit={a.status === "PENDING" && !!onCrewChange}
          onChange={(id) => onCrewChange?.(a, "driverId", id)}
        />
      </div>
      <Text
        type="secondary"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4 }}
      >
        BOOKING LIST ({activeBookings.length})
      </Text>
      <div className="board-booking-table" style={{ marginTop: 6 }}>
        {activeBookings.length ? (
          <>
<div
                className="board-bk-grid"
                style={{
                  display: "grid",
                  // Must match the template of the rows below, otherwise the
                  // column labels drift away from the data.
                  gridTemplateColumns:
                    (interactive && activeBookings.length > 1
                      ? "18px "
                      : "") +
                    "20px minmax(0,1.05fr) 70px minmax(0,1.6fr) 64px 36px 24px",
                  alignItems: "center",
                  gap: 8,
                  padding: "2px 8px",
                }}
              >
              {interactive && activeBookings.length > 1 && <span />}
              <Text
                type="secondary"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                #
              </Text>
              <Text type="secondary" style={{ fontSize: 9, fontWeight: 700 }}>
                CUSTOMER
              </Text>
              <Text
                type="secondary"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                REF
              </Text>
              <Text type="secondary" style={{ fontSize: 9, fontWeight: 700 }}>
                HOTEL / PICKUP / PHONE
              </Text>
              <Text
                type="secondary"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                DISTANCE
              </Text>
              <Text
                type="secondary"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                PAX
              </Text>
              <Text
                type="secondary"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  display: "block",
                  width: "100%",
                  textAlign: "center",
                }}
              >
                INFO
              </Text>
            </div>
            <List
              size="small"
              dataSource={a.bookings?.filter((b) => b.status !== "CANCELED") ?? []}
              renderItem={(b, i) => {
              const fromLabel = b.movedFromBus
                ? b.movedFromBus.code ||
                  b.movedFromBus.vehicle?.plateNumber ||
                  "another bus"
                : null;
              const isMoved = !!fromLabel;
              return (
              <List.Item
                key={b.id}
                draggable={interactive}
                onDragStart={(e) => {
                  draggingBookingId = b.id;
                  e.dataTransfer.setData("text/plain", b.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  clearDraggedBooking();
                  dragDepth.current = 0;
                  setDragOver(false);
                  setDropTarget(null);
                }}
                onDragEnter={(e) => {
                  if (!interactive) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTarget({ rowId: b.id, pos: rowDropPos(e) });
                  setDragOver(true);
                }}
                onDragOver={(e) => {
                  if (!interactive) return;
                  // No stopPropagation here: the card-level handler still needs
                  // to run so the bus highlight stays lit while over a row.
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget({ rowId: b.id, pos: rowDropPos(e) });
                }}
                onDragLeave={(e) => {
                  if (!interactive) return;
                  e.stopPropagation();
                  setDropTarget((d) => (d?.rowId === b.id ? null : d));
                }}
                onDrop={(e) => handleRowDrop(e, b.id)}
                style={{
                  padding: "8px 4px",
                  borderBottom: `1px solid ${isMoved ? "#ff4d4f" : token.colorSplit}`,
                  borderTop: "2px solid transparent",
                  borderRadius: 4,
                  background: isMoved ? "rgba(255, 77, 79, 0.14)" : "transparent",
                  position: "relative",
                  cursor: interactive ? "grab" : "default",
                  opacity: interactive ? 1 : 0.75,
                  transition: "background 0.15s ease",
                }}
              >
                {/* Insertion line: shows exactly where the booking will land. */}
                {dropTarget?.rowId === b.id && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      height: 3,
                      borderRadius: 2,
                      background: accent,
                      boxShadow: `0 0 0 1px ${accent}55`,
                      pointerEvents: "none",
                      zIndex: 2,
                      [dropTarget.pos === "before" ? "top" : "bottom"]: -2,
                    }}
                  />
                )}
                <div
                  className="board-bk-grid"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "grid",
                    // The first column is the up/down arrow. The "fr" columns use minmax(0)
                    // so they can shrink - hard minimums used to make the grid
                    // overflow and wrap the text, making rows taller and
                    // pushing the buses below down on every reorder.
                    // The first column only exists when the arrows are
                    // rendered, so the column count always matches the child
                    // count.
                    gridTemplateColumns:
                      (interactive && activeBookings.length > 1
                        ? "18px "
                        : "") +
                      "20px minmax(0,1.05fr) 70px minmax(0,1.6fr) 64px 36px 24px",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 4px",
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    fontSize: 12,
                    borderRadius: 6,
                  }}
                  title={
                    [
                      `${b.customerName ?? "no name"} · ${b.bookingRef}`,
                      b.hotelName || b.address || "No pickup",
                      b.address,
                      b.phone,
                      b.latitude != null && b.longitude != null
                        ? `${b.latitude.toFixed(6)}, ${b.longitude.toFixed(6)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join("\n")
                  }
                >
                  {/* Up/down arrow: fine-tune one slot at a time, no drag and drop
                      needed. Lives inside the grid (not as a flex sibling) so it
                      cannot shift the layout; disabled at both ends of the
                      list. */}
                  {interactive && activeBookings.length > 1 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        gap: 0,
                      }}
                    >
                      <Button
                        size="small"
                        type="text"
                        aria-label="Move booking up"
                        disabled={i === 0}
                        onClick={() => nudge(b.id, "up")}
                        style={{
                          height: 13,
                          width: 18,
                          minWidth: 0,
                          padding: 0,
                          lineHeight: 1,
                        }}
                        icon={<UpOutlined style={{ fontSize: 8 }} />}
                      />
                      <Button
                        size="small"
                        type="text"
                        aria-label="Move booking down"
                        disabled={i === activeBookings.length - 1}
                        onClick={() => nudge(b.id, "down")}
                        style={{
                          height: 13,
                          width: 18,
                          minWidth: 0,
                          padding: 0,
                          lineHeight: 1,
                        }}
                        icon={<DownOutlined style={{ fontSize: 8 }} />}
                      />
                    </div>
                  )}
                  {interactive ? (
                    <Text
                      strong
                      style={{
                        fontSize: 11,
                        width: "100%",
                        textAlign: "center",
                        color: token.colorTextTertiary,
                      }}
                    >
                      {i + 1}
                    </Text>
                  ) : (
                    <Text
                      strong
                      style={{
                        fontSize: 11,
                        width: "100%",
                        textAlign: "center",
                        color: token.colorTextTertiary,
                      }}
                    >
                      {i + 1}
                    </Text>
                  )}

                  <Flex vertical gap={2} style={{ minWidth: 0 }}>
                    <Text
                      strong
                      ellipsis
                      style={{ fontSize: 12, flex: 1, minWidth: 0 }}
                    >
                      {b.customerName ?? "no name"}
                    </Text>
                    {isMoved && (
                      <Tag
                        color="red"
                        title={`Moved from ${fromLabel}`}
                        style={{
                          margin: 0,
                          fontSize: 9,
                          lineHeight: "16px",
                          padding: "0 4px",
                          width: "fit-content",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        MOVED from {fromLabel}
                      </Tag>
                    )}
                  </Flex>

                  <Text
                    type="secondary"
                    style={{
                      fontSize: 10,
                      display: "block",
                      width: "100%",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {b.bookingRef}
                  </Text>

                  <span
                    style={{
                      display: "inline-flex",
                      flexDirection: "column",
                      gap: 3,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        minWidth: 0,
                        color: token.colorTextSecondary,
                      }}
                    >
                      <EnvironmentOutlined
                        style={{
                          color: "#ff4d4f",
                          flexShrink: 0,
                          fontSize: 11,
                        }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 600,
                          color: token.colorText,
                          minWidth: 0,
                        }}
                      >
                        {b.hotelName || "No pickup"}
                      </span>
                    </span>
                    {b.address &&
                      (!b.hotelName || b.address !== b.hotelName) && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            minWidth: 0,
                            color: token.colorTextSecondary,
                            fontSize: 11,
                            paddingLeft: 16,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {b.address}
                        </span>
                      )}
                    {b.phone && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          minWidth: 0,
                        }}
                      >
                        <PhoneOutlined
                          style={{
                            color: "#52c41a",
                            flexShrink: 0,
                            fontSize: 11,
                          }}
                        />
                        <a
                          href={`tel:${b.phone}`}
                          title={b.phone}
                          style={{
                            color: "#389e0d",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            minWidth: 0,
                          }}
                        >
                          {b.phone}
                        </a>
                      </span>
                    )}
                  </span>

                  <Text
                    type="secondary"
                    style={{
                      fontSize: 10,
                      display: "block",
                      width: "100%",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {bookingKm(b.latitude, b.longitude)}
                  </Text>

                  <Tag
                    color="orange"
                    style={{
                      margin: 0,
                      fontSize: 10,
                      justifySelf: "center",
                      textAlign: "center",
                      minWidth: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {b.totalPax}
                  </Tag>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      justifySelf: "center",
                      width: "100%",
                    }}
                  >
                    {b.notes ? (
                      <Popover
                        trigger="click"
                        placement="leftTop"
                        title="Booking details"
                        content={
                          <div style={{ maxWidth: 260 }}>
                            {b.notes && (
                              <div style={{ marginBottom: 6 }}>
                                <Text strong>Note: </Text>
                                <Text>{b.notes}</Text>
                              </div>
                            )}
                          </div>
                        }
                      >
                        <span
                          style={{
                            color: "#faad14",
                            fontSize: 12,
                            lineHeight: 1,
                            display: "inline-flex",
                            cursor: "pointer",
                          }}
                        >
                          <FileTextOutlined />
                        </span>
                      </Popover>
                    ) : null}
                  </span>
                </div>
              </List.Item>
              );
            }}
          />
          </>
        ) : (
          <Text type="secondary">No bookings</Text>
        )}
      </div>

      {interactive && a.status === "PENDING" ? (
        <Flex gap={8} style={{ marginTop: 12 }}>
          <Tooltip
            title={
              isActiveToday
                ? undefined
                : "Only tours active today can be dispatched — future departures wait until their tour day."
            }
          >
            <Button
              type="primary"
              size="small"
              style={{ flex: 1 }}
              icon={<SendOutlined />}
              loading={dispatching}
              disabled={!isActiveToday}
              onClick={() => onDispatch(a)}
            >
              Dispatch bus
            </Button>
          </Tooltip>
          <Tooltip title="Dispatch the bus first to confirm finished">
            <Button
              type="default"
              size="small"
              style={{ flex: 1 }}
              icon={<CheckOutlined />}
              disabled
            >
              Confirm finished
            </Button>
          </Tooltip>
        </Flex>
      ) : a.status === "VERIFYING" ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: a.tourReport?.status === "REJECTED"
              ? "rgba(220,38,38,0.08)"
              : "rgba(114, 46, 209, 0.08)",
            border: `1px solid ${a.tourReport?.status === "REJECTED"
              ? "rgba(220,38,38,0.25)"
              : "rgba(114, 46, 209, 0.25)"}`,
          }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
            <Text strong style={{ fontSize: 12 }}>
              {a.tourReport?.status === "REJECTED"
                ? "⚠️ Report rejected. The guide must submit again."
                : "⏳ Waiting for Admin verification"}
            </Text>
            <Tag color={a.tourReport?.status === "REJECTED" ? "red" : "purple"} style={{ margin: 0, fontSize: 10 }}>
              {a.tourReport?.status === "REJECTED" ? "REJECTED" : "VERIFYING"}
            </Tag>
          </Flex>
          <Progress
            percent={a.tourReport?.status === "REJECTED" ? 30 : 60}
            size="small"
            status="active"
            strokeColor={
              a.tourReport?.status === "REJECTED"
                ? "#ff4d4f"
                : { from: "#722ed1", to: "#1677ff" }
            }
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            {a.tourReport?.status === "REJECTED"
              ? "The guide must resend the report and its evidence on the Submit Report page."
              : "The guide has submitted the report. Waiting for an administrator to verify it…"}
          </Text>
          {canConfirm && (
            <Space wrap style={{ marginTop: 8 }}>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => onVerify?.(a)}
              >
                {a.tourReport?.status === "REJECTED" ? "Review resubmitted report" : "Verify report"}
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => onReject?.(a)}
              >
                Reject report
              </Button>
            </Space>
          )}
        </div>
      ) : a.status === "COMPLETED" ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Completed"
          style={{ marginTop: 12, borderRadius: 8 }}
        />
      ) : a.status === "DISPATCHED" && canConfirm ? (
        <Space.Compact block style={{ marginTop: 12 }}>
          <Button
            type="primary"
            size="small"
            block
            icon={<CheckOutlined />}
            loading={confirming}
            onClick={() => onConfirm(a)}
          >
            Confirm tour finished
          </Button>
          <Tooltip
            title={
              recallLocked
                ? "Recall is locked — the 05:00 cutoff has passed. The bus is considered departed."
                : undefined
            }
          >
            <Button
              type="default"
              size="small"
              danger
              icon={<UndoOutlined />}
              loading={recalling}
              disabled={recallLocked}
              onClick={() => onRecall(a)}
              style={{ borderRadius: 8 }}
            >
              Recall
            </Button>
          </Tooltip>
        </Space.Compact>
      ) : null}
      {canConfirm && (
        <Button
          type="dashed"
          size="small"
          block
          icon={<PlusOutlined />}
          style={{ marginTop: 12, borderRadius: 8 }}
          onClick={() => onAdditions?.(a)}
        >
          Booking details — notes, collect & refund
        </Button>
      )}
    </Card>
  );
}
