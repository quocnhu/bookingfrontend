"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  List,
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
  EnvironmentOutlined,
  FileTextOutlined,
  PhoneOutlined,
  PlusOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UndoOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import dayjs, { Dayjs } from "dayjs";
import type { BoardCrew, BoardItem, TourMeta } from "./types";
import { STATUS_COLORS, LEAVE_COLOR } from "./types";

const { Text } = Typography;

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
  ) => void;
  onTemplate: (assignment: BoardItem) => void;
  onVerify?: (assignment: BoardItem) => void;
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
  const [hoverRow, setHoverRow] = useState<string | null>(null);
  const { color, accent } = meta;
  const capacity = a.vehicle?.capacity ?? 12;
  const isFull = a.totalPax >= capacity;
  const isToday = dayjs(a.startDate).startOf("day").isSame(today);
  const isEven = index % 2 === 0;
  const tint = isEven ? `${accent}12` : `${accent}1c`;
  const tintStrong = `${accent}2e`;
  const border = `${accent}59`;
  const day = a.startDate ? dayjs(a.startDate).format("DD MMM YYYY") : "—";
  const isRejected = a.tourReport?.status === "REJECTED";
  const procStatus = isRejected ? "REJECTED" : a.status;
  const procColor = isRejected ? "red" : STATUS_COLORS[a.status];
  const interactive =
    canConfirm && a.status !== "COMPLETED" && a.status !== "CANCELED";
  const hasMovedBooking =
    a.bookings?.some((b) => b.movedFromBus) ?? false;

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      setHoverRow(null);
      if (!interactive) return;
      const bookingId = e.dataTransfer.getData("text/plain");
      if (bookingId) onMoveBooking(bookingId, a.id, null);
    },
    [interactive, onMoveBooking, a.id],
  );

  const handleRowDrop = useCallback(
    (e: React.DragEvent, beforeBookingId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      setHoverRow(null);
      if (!interactive) return;
      const bookingId = e.dataTransfer.getData("text/plain");
      if (bookingId) onMoveBooking(bookingId, a.id, beforeBookingId);
    },
    [interactive, onMoveBooking, a.id],
  );

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

  // HDV/tài xế có nghỉ phép trùng khớp ngày chạy của chuyến này → tô màu riêng.
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

  return (
    <Card
      size="small"
      onDragOver={(e) => {
        if (!interactive) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
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
        <Tag
          color={color === "blue" ? "geekblue" : "magenta"}
          style={{ margin: 0 }}
        >
          {a.totalPax}/{capacity} pax
        </Tag>
        <Tooltip title="Print tour template for accounting (stamp for year-end audit)">
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
        BOOKING LIST ({a.bookings?.length ?? 0})
      </Text>
      <div className="board-booking-table" style={{ marginTop: 6 }}>
        {a.bookings?.length ? (
          <>
<div
                className="board-bk-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "20px minmax(90px,1.05fr) 70px minmax(150px,1.6fr) 64px 36px 24px",
                  alignItems: "center",
                  gap: 8,
                  padding: "2px 8px",
                }}
              >
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
              dataSource={a.bookings}
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
                  e.dataTransfer.setData("text/plain", b.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragOver(false);
                  setHoverRow(null);
                }}
                onDragOver={(e) => {
                  if (!interactive) return;
                  e.preventDefault();
                  e.stopPropagation();
                  setHoverRow(b.id);
                }}
                onDragLeave={() =>
                  setHoverRow((h) => (h === b.id ? null : h))
                }
                onDrop={(e) => handleRowDrop(e, b.id)}
                style={{
                  padding: "8px 4px",
                  borderBottom: `1px solid ${isMoved ? "#ff4d4f" : token.colorSplit}`,
                  borderTop:
                    hoverRow === b.id
                      ? `2px solid ${accent}`
                      : "2px solid transparent",
                  borderRadius: 4,
                  background: isMoved
                    ? "rgba(255, 77, 79, 0.14)"
                    : hoverRow === b.id
                      ? `${accent}14`
                      : "transparent",
                  cursor: interactive ? "grab" : "default",
                  opacity: interactive ? 1 : 0.75,
                  transition: "background 0.15s ease",
                }}
              >
                <div
                  className="board-bk-grid"
                  style={{
                    width: "100%",
                    display: "grid",
gridTemplateColumns:
                    "20px minmax(90px,1.05fr) 70px minmax(150px,1.6fr) 64px 36px 24px",
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
                    {b.notes ||
                    (b.collectAmount ?? 0) > 0 ||
                    (b.refundAmount ?? 0) > 0 ? (
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
                            {(b.collectAmount ?? 0) > 0 && (
                              <div style={{ marginBottom: 6 }}>
                                <Text strong style={{ color: "#389e0d" }}>
                                  Collect:{" "}
                                </Text>
                                <Text strong>
                                  $
                                  {Number(b.collectAmount).toLocaleString(
                                    "en-US",
                                    { maximumFractionDigits: 2 },
                                  )}
                                </Text>
                              </div>
                            )}
                            {(b.refundAmount ?? 0) > 0 && (
                              <div>
                                <Text strong type="danger">
                                  Refund:{" "}
                                </Text>
                                <Text strong>
                                  $
                                  {Number(b.refundAmount).toLocaleString(
                                    "en-US",
                                    { maximumFractionDigits: 2 },
                                  )}
                                </Text>
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
          <Button
            type="primary"
            size="small"
            style={{ flex: 1 }}
            icon={<SendOutlined />}
            loading={dispatching}
            onClick={() => onDispatch(a)}
          >
            Dispatch bus
          </Button>
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
                ? "⚠️ Kế toán từ chối. HDV cần nộp lại."
                : "⏳ Đang chờ Admin / Kế toán xác minh"}
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
              ? "HDV cần gửi lại báo cáo và bằng chứng trên trang Submit Report."
              : "HDV đã nộp báo cáo. Bộ phận kế toán đang xác minh số liệu quyết toán…"}
          </Text>
          {canConfirm && (
            <Button
              type="primary"
              size="small"
              icon={<CheckOutlined />}
              style={{ marginTop: 8, borderRadius: 8 }}
              onClick={() => onVerify?.(a)}
            >
              {a.tourReport?.status === "REJECTED" ? "Review resubmitted report" : "Verify report"}
            </Button>
          )}
        </div>
      ) : a.status === "COMPLETED" ? (
        <Alert
          type="success"
          showIcon
          icon={<CheckCircleOutlined />}
          message="Completed — settlement prepared"
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
          <Button
            type="default"
            size="small"
            danger
            icon={<UndoOutlined />}
            loading={recalling}
            onClick={() => onRecall(a)}
            style={{ borderRadius: 8 }}
          >
            Recall
          </Button>
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
