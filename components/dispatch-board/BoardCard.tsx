"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  List,
  Popover,
  Progress,
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
  HolderOutlined,
  PayCircleOutlined,
  PhoneOutlined,
  PrinterOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import dayjs, { Dayjs } from "dayjs";
import type { BoardItem, TourMeta } from "./types";
import { STATUS_COLORS } from "./types";

const { Text } = Typography;

const GUIDE_BOX = {
  color: "#52c41a",
  background: "rgba(82, 196, 26, 0.10)",
  border: "rgba(82, 196, 26, 0.25)",
};

const DRIVER_BOX = {
  color: "#1677ff",
  background: "rgba(22, 119, 255, 0.10)",
  border: "rgba(22, 119, 255, 0.25)",
};

function PersonBox({
  label,
  icon,
  box,
  value,
}: {
  label: string;
  icon: ReactNode;
  box: { color: string; background: string; border: string };
  value?: string | null;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 160,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
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
      <Text strong ellipsis style={{ flex: 1, fontSize: 13 }}>
        {value ?? "Unassigned"}
      </Text>
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
  onMoveBooking,
  onTemplate,
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
  onMoveBooking: (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
  ) => void;
  onTemplate: (assignment: BoardItem) => void;
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
        <Popover
          trigger="click"
          placement="top"
          title={<Text strong>Who verifies the tour guide?</Text>}
          content={
            <div style={{ minWidth: 200 }}>
              <div style={{ marginBottom: 10 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tour guide
                </Text>
                <div>
                  <Text strong>{a.guide?.name ?? "Unassigned"}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Report verifier
                </Text>
                <div>
                  <Text
                    strong
                    style={{
                      color: a.reportVerifier ? "#389e0d" : undefined,
                    }}
                  >
                    {a.reportVerifier?.name ?? "Not assigned"}
                  </Text>
                </div>
              </div>
            </div>
          }
        >
          <Button
            size="small"
            icon={<SafetyCertificateOutlined />}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              fontWeight: 600,
              color: "#fa541c",
              borderColor: "#fa541c",
              background: "rgba(250, 84, 28, 0.08)",
            }}
          >
            Verifier
          </Button>
        </Popover>
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
          color={STATUS_COLORS[a.status] ?? "default"}
          style={{ fontSize: 10, margin: 0 }}
        >
          {a.status}
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
        <PersonBox
          label="Guide"
          icon={<UserOutlined />}
          box={GUIDE_BOX}
          value={a.guide?.name}
        />
        <PersonBox
          label="Driver"
          icon={<CarOutlined />}
          box={DRIVER_BOX}
          value={a.driver?.name}
        />
      </div>

      <Text
        type="secondary"
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4 }}
      >
        BOOKING LIST ({a.bookings?.length ?? 0})
      </Text>
      <div style={{ marginTop: 6 }}>
        {a.bookings?.length ? (
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
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns:
                      "20px minmax(100px,1.1fr) 74px minmax(120px,1.6fr) 34px auto",
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
                    <HolderOutlined
                      style={{ color: token.colorTextQuaternary }}
                    />
                  ) : (
                    <span />
                  )}

                  <Flex gap={4} align="center" style={{ minWidth: 0 }}>
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
                        }}
                      >
                        MOVED from {fromLabel}
                      </Tag>
                    )}
                  </Flex>

                  <Text type="secondary" style={{ fontSize: 10 }}>
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
                          }}
                        >
                          {b.phone}
                        </a>
                      </span>
                    )}
                  </span>

                  <Tag
                    color="orange"
                    style={{ margin: 0, fontSize: 10, justifySelf: "start" }}
                  >
                    {b.totalPax}
                  </Tag>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {b.settlements && b.settlements.length > 0 ? (
                      <Tooltip
                        title={`Thu tiền khách: ${b.settlements
                          .map((s) => `${s.category?.name ?? s.customCategoryName ?? "Thu hộ"} ${s.amount}`)
                          .join(", ")}`}
                      >
                        <PayCircleOutlined
                          style={{ color: "#52c41a", fontSize: 14 }}
                        />
                      </Tooltip>
                    ) : (
                      <Tooltip title="Chưa thu tiền từ booking này">
                        <PayCircleOutlined
                          style={{ color: "#d3d3d3", fontSize: 14 }}
                        />
                      </Tooltip>
                    )}
                    {b.payment === "PAID" && (
                      <CheckCircleOutlined
                        style={{ color: "#1677ff", fontSize: 13 }}
                      />
                    )}
                    {b.latitude != null && b.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`${b.latitude.toFixed(6)}, ${b.longitude.toFixed(6)}`}
                        style={{
                          color: "#ff4d4f",
                          fontSize: 12,
                          lineHeight: 1,
                        }}
                      >
                        <EnvironmentOutlined />
                      </a>
                    )}
                  </span>
                </div>
              </List.Item>
              );
            }}
          />
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
          <Button
            type="default"
            size="small"
            style={{ flex: 1 }}
            icon={<CheckOutlined />}
            loading={confirming}
            onClick={() => onConfirm(a)}
          >
            Confirm finished
          </Button>
        </Flex>
      ) : a.status === "VERIFYING" ? (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(114, 46, 209, 0.08)",
            border: "1px solid rgba(114, 46, 209, 0.25)",
          }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
            <Text strong style={{ fontSize: 12 }}>
              ⏳ Đang chờ Admin / Kế toán xác minh
            </Text>
            <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>
              VERIFYING
            </Tag>
          </Flex>
          <Progress
            percent={60}
            size="small"
            status="active"
            strokeColor={{ from: "#722ed1", to: "#1677ff" }}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            HDV đã nộp báo cáo. Bộ phận kế toán đang xác minh số liệu quyết toán…
          </Text>
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
        <Button
          type="primary"
          size="small"
          block
          style={{ marginTop: 12 }}
          icon={<CheckOutlined />}
          loading={confirming}
          onClick={() => onConfirm(a)}
        >
          Confirm tour finished
        </Button>
      ) : null}
    </Card>
  );
}
