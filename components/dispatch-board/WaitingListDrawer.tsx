"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Empty,
  Flex,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoginOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { BoardItem } from "./types";

const { Text } = Typography;

function canFit(target: BoardItem, pax: number) {
  const used = (target.bookings ?? []).reduce(
    (sum, booking) => sum + (booking.totalPax ?? 0),
    0,
  );
  const cap = Math.min(target.vehicle?.capacity ?? 12, 12);
  return used + pax <= cap;
}

export default function WaitingListDrawer({
  open,
  onClose,
  items,
  boardItems,
  onAssign,
  assigningKey,
  sealed,
}: {
  open: boolean;
  onClose: () => void;
  items: BoardItem[];
  boardItems: BoardItem[];
  onAssign: (bookingId: string, toAssignmentId: string) => void;
  assigningKey?: string | null;
  sealed?: boolean;
}) {
  const [targets, setTargets] = useState<Record<string, string | undefined>>(
    {},
  );
  const pax = useMemo(
    () =>
      items.reduce(
        (sum, bus) =>
          sum +
          (bus.bookings ?? []).reduce(
            (inner, booking) => inner + (booking.totalPax ?? 0),
            0,
          ),
        0,
      ),
    [items],
  );

  const eligibleBuses = useMemo(
    () =>
      boardItems.filter(
        (bus) =>
          bus.status === "PENDING" || bus.status === "DISPATCHED",
      ),
    [boardItems],
  );

  return (
    <Drawer
      className="waiting-list-drawer"
      title={
        <Space>
          <ClockCircleOutlined style={{ color: "#fa8c16" }} />
          <Text strong>Late booking waiting list</Text>
          <Tag color="orange" style={{ margin: 0 }}>
            {items.length} bus(es) · {pax} pax
          </Tag>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={520}
      destroyOnClose
    >
      <Alert
        type={sealed ? "warning" : "info"}
        showIcon
        style={{ marginBottom: 14 }}
        message={
          sealed
            ? "The board is sealed. Only waiting-list bookings can be placed."
            : "These are late bookings held after the dispatch cutoff."
        }
        description="Place them on an open bus from 05:00 on the departure day. The customer confirmation mail is sent automatically once the booking reaches a real bus."
      />

      {items.length === 0 ? (
        <Empty description="No late bookings are waiting for this date" />
      ) : (
        <Flex vertical gap={12}>
          {items.map((bus) => (
            <Card
              key={bus.id}
              size="small"
              style={{
                borderRadius: 12,
                border: "1px solid #ff9c6e",
                background: "#fff2e8",
              }}
              title={
                <Space direction="vertical" size={0}>
                  <Text strong style={{ fontSize: 13, color: "#5b1a00" }}>
                    {bus.code}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11, color: "#8c4a1f" }}>
                    {bus.tourName} · {dayjs(bus.startDate).format("DD MMM YYYY")}
                  </Text>
                </Space>
              }
              extra={
                <Tag icon={<TeamOutlined />} color="orange">
                  {bus.totalPax ?? 0} pax
                </Tag>
              }
            >
              {(bus.bookings ?? []).length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Flex vertical gap={10}>
                  {(bus.bookings ?? []).map((booking) => {
                    const key = `${bus.id}:${booking.id}`;
                    const options = eligibleBuses
                      .filter(
                        (target) =>
                          target.tourName === bus.tourName &&
                          (target.tourType ?? null) ===
                            (bus.tourType ?? null) &&
                          canFit(target, booking.totalPax ?? 0),
                      )
                      .map((target) => {
                        const used = (target.bookings ?? []).reduce(
                          (sum, item) => sum + (item.totalPax ?? 0),
                          0,
                        );
                        const cap = Math.min(
                          target.vehicle?.capacity ?? 12,
                          12,
                        );
                        return {
                          value: target.id,
                          label: `${target.code} · ${used}/${cap} pax · ${target.status}`,
                        };
                      });
                    const noFit = options.length === 0;
                    const rowTextColor = noFit ? "#fff1f0" : "#1f1f1f";
                    const rowSecondaryColor = noFit ? "#ffd6d6" : "#595959";
                    return (
                      <div
                        key={booking.id}
                        style={{
                          border: noFit
                            ? "1px solid #ff7875"
                            : "1px solid #ffd591",
                          borderRadius: 10,
                          padding: 10,
                          background: noFit ? "#7a1f2b" : "#fff7e6",
                        }}
                      >
                        <Flex justify="space-between" align="start" gap={8}>
                          <Space direction="vertical" size={1}>
                            <Space size={6} wrap>
                              <Text strong style={{ fontSize: 12, color: rowTextColor }}>
                                {booking.customerName ?? "Guest"}
                              </Text>
                              <Tag color="orange" style={{ margin: 0 }}>
                                LATE
                              </Tag>
                              <Tag
                                style={{
                                  margin: 0,
                                  color: rowTextColor,
                                  background: noFit
                                    ? "rgba(255,255,255,0.14)"
                                    : undefined,
                                  borderColor: noFit
                                    ? "rgba(255,255,255,0.28)"
                                    : undefined,
                                }}
                              >
                                {booking.bookingRef}
                              </Tag>
                            </Space>
                            <Text
                              type="secondary"
                              style={{ fontSize: 11, color: rowSecondaryColor }}
                            >
                              {(booking.totalPax ?? 0)} pax ·{" "}
                              {booking.hotelName ||
                                booking.address ||
                                "No pickup"}
                              {booking.departureTime
                                ? ` · ${booking.departureTime}`
                                : ""}
                            </Text>
                          </Space>
                        </Flex>
                        {noFit ? (
                          <div
                            style={{
                              marginTop: 8,
                              background: "linear-gradient(135deg, #4a1118, #9b2c3a)",
                              border: "1px solid #ffa39e",
                              borderRadius: 8,
                              padding: 10,
                            }}
                          >
                            <Flex align="start" gap={8}>
                              <ExclamationCircleOutlined
                                style={{ color: "#ffccc7", fontSize: 16, marginTop: 1 }}
                              />
                              <div>
                                <div
                                  style={{
                                    color: "#fff1f0",
                                    fontWeight: 700,
                                    fontSize: 12,
                                  }}
                                >
                                  No open bus fits this booking
                                </div>
                                <div
                                  style={{
                                    color: "#ffd6d6",
                                    fontSize: 11,
                                    marginTop: 4,
                                  }}
                                >
                                  Create an open bus for this tour/date or free a
                                  seat, then reopen this list.
                                </div>
                              </div>
                            </Flex>
                          </div>
                        ) : (
                          <Space.Compact style={{ width: "100%", marginTop: 8 }}>
                            <Select
                              size="small"
                              style={{ flex: 1 }}
                              placeholder="Select an open bus"
                              value={targets[key]}
                              onChange={(value) =>
                                setTargets((prev) => ({ ...prev, [key]: value }))
                              }
                              options={options}
                              showSearch
                              optionFilterProp="label"
                            />
                            <Button
                              size="small"
                              type="primary"
                              icon={<LoginOutlined />}
                              disabled={!targets[key]}
                              loading={assigningKey === key}
                              onClick={() =>
                                targets[key] &&
                                onAssign(booking.id, targets[key] as string)
                              }
                            >
                              Assign
                            </Button>
                          </Space.Compact>
                        )}
                      </div>
                    );
                  })}
                </Flex>
              )}
            </Card>
          ))}
        </Flex>
      )}
    </Drawer>
  );
}
