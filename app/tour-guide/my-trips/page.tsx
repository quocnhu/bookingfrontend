"use client";

import { useEffect, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Col,
  Collapse,
  Descriptions,
  Empty,
  Flex,
  Row,
  Segmented,
  Spin,
  Statistic,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  CarOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  CalendarOutlined,
  FileTextOutlined,
  HomeOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  DISPATCHED: "blue",
  COMPLETED: "green",
  CANCELED: "red",
};

interface Assignment {
  id: string;
  code?: string | null;
  tourName?: string | null;
  tourType?: string | null;
  durationDays?: number | null;
  status: string;
  startDate: string;
  endDate: string;
  vehicle?: { plateNumber: string; capacity?: number | null } | null;
  bookings: any[];
  itinerary?: any[];
  totalPax?: number;
  pickups?: Array<{ bookingRef: string; customerName: string; pickup: string; totalPax: number }>;
  tourReport?: any;
  isDriver?: boolean;
  isGuide?: boolean;
}

export default function TourGuideMyTripsPage() {
  const { user } = useApp();
  const { token } = antdTheme.useToken();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(dayjs());
  const [calendarData, setCalendarData] = useState<any[]>([]);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const r = await api.get("/assignments/my-assignments");
      setAssignments(r.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      const r = await api.get("/assignments/my-calendar", {
        params: { year: calMonth.year(), month: calMonth.month() + 1 },
      });
      setCalendarData(r.data ?? []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    loadAssignments();
  }, []);

  useEffect(() => {
    if (view === "calendar") loadCalendar();
  }, [view, calMonth]);

  const today = dayjs();
  const upcoming = assignments.filter(
    (a) => dayjs(a.startDate).isSameOrAfter(today, "day") && a.status !== "CANCELED",
  );
  const completed = assignments.filter((a) => a.status === "COMPLETED");
  const needsReport = assignments.filter(
    (a) => a.status === "DISPATCHED" && !a.tourReport,
  );

  // Calendar grid
  const calStart = calMonth.startOf("month");
  const calEnd = calMonth.endOf("month");
  const daysInMonth = calEnd.date();
  const startDayOfWeek = calStart.day();
  const calCells: (Assignment | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = calMonth.date(d);
    const match = calendarData.filter((c) => {
      const s = dayjs(c.startDate);
      const e = dayjs(c.endDate);
      return cellDate.isSameOrAfter(s, "day") && cellDate.isSameOrBefore(e, "day");
    });
    calCells.push(match.length > 0 ? match[0] : null);
  }

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <CarOutlined /> My Trips
        </Typography.Title>
        <Flex gap={8}>
          <Button icon={<ReloadOutlined />} onClick={loadAssignments} loading={loading}>
            Refresh
          </Button>
          <Segmented
            value={view}
            onChange={(v) => setView(v as any)}
            options={[
              { label: "List", value: "list" },
              { label: "Calendar", value: "calendar" },
            ]}
          />
        </Flex>
      </Flex>

      {loading ? (
        <Flex justify="center" style={{ padding: 80 }}>
          <Spin size="large" />
        </Flex>
      ) : view === "list" ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={12} sm={8} lg={6}>
              <Card variant="borderless">
                <Statistic title="Total Trips" value={assignments.length} prefix={<CarOutlined />} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card variant="borderless">
                <Statistic title="Upcoming" value={upcoming.length} prefix={<ClockCircleOutlined />} valueStyle={{ color: token.colorWarning }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card variant="borderless">
                <Statistic title="Completed" value={completed.length} prefix={<CheckCircleOutlined />} valueStyle={{ color: token.colorSuccess }} />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card variant="borderless">
                <Statistic title="Need Report" value={needsReport.length} prefix={<FileTextOutlined />} valueStyle={{ color: needsReport.length > 0 ? token.colorError : token.colorSuccess }} />
              </Card>
            </Col>
          </Row>

          {needsReport.length > 0 && (
            <Card
              variant="borderless"
              style={{ marginTop: 16, border: `1px solid ${token.colorWarning}`, borderRadius: 12, background: token.colorWarningBg }}
            >
              <Typography.Text strong style={{ color: token.colorWarning }}>
                <FileTextOutlined /> You have {needsReport.length} trip(s) that need a tour report submitted.
              </Typography.Text>
            </Card>
          )}

          <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
            Upcoming Trips
          </Typography.Title>

          {upcoming.length === 0 ? (
            <Empty description="No upcoming trips" />
          ) : (
            upcoming.map((a) => (
              <Card key={a.id} variant="borderless" style={{ marginBottom: 12, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: 12 }}>
                <Flex justify="space-between" align="flex-start" wrap gap={16}>
                  <Flex vertical gap={4} style={{ flex: 1, minWidth: 240 }}>
                    <Flex align="center" gap={8}>
                      <Typography.Text strong style={{ fontSize: 16 }}>
                        {a.tourName ?? a.code}
                      </Typography.Text>
                      <Tag color={STATUS_COLOR[a.status]}>{a.status}</Tag>
                      {a.tourReport && (
                        <Tag color={a.tourReport.status === "VERIFIED" ? "green" : a.tourReport.status === "REJECTED" ? "red" : "orange"}>
                          Report: {a.tourReport.status}
                        </Tag>
                      )}
                    </Flex>
                    <Typography.Text type="secondary">
                      <CalendarOutlined /> {dayjs(a.startDate).format("DD/MM/YYYY")} — {dayjs(a.endDate).format("DD/MM/YYYY")}
                      {a.durationDays ? ` · ${a.durationDays} ${a.durationDays === 1 ? "Day" : "Days"}` : ""}
                    </Typography.Text>
                    {a.vehicle && (
                      <Typography.Text type="secondary">
                        <CarOutlined /> {a.vehicle.plateNumber}
                      </Typography.Text>
                    )}
                    <Typography.Text type="secondary">
                      <TeamOutlined /> {a.bookings?.length ?? 0} bookings · {a.totalPax ?? 0} pax
                    </Typography.Text>
                  </Flex>
                </Flex>

                {/* Itinerary preview */}
                {a.itinerary && a.itinerary.length > 0 && (
                  <Collapse
                    size="small"
                    style={{ marginTop: 12 }}
                    items={[{
                      key: "itinerary",
                      label: "Itinerary",
                      children: (
                        <Descriptions column={1} size="small">
                          {a.itinerary.map((item: any) => (
                            <Descriptions.Item key={item.id} label={`${item.timeSlot ?? `Day ${item.dayNumber}`} — ${item.title}`}>
                              {item.location && <><EnvironmentOutlined /> {item.location}</>}
                            </Descriptions.Item>
                          ))}
                        </Descriptions>
                      ),
                    }]}
                  />
                )}

                {/* Pickup list */}
                {a.pickups && a.pickups.length > 0 && (
                  <Collapse
                    size="small"
                    style={{ marginTop: 8 }}
                    items={[{
                      key: "pickups",
                      label: `Pickup list (${a.pickups.length} booking${a.pickups.length > 1 ? "s" : ""})`,
                      children: (
                        a.pickups.map((p, i) => (
                          <div key={i} style={{ padding: "8px 0", borderBottom: i < a.pickups!.length - 1 ? `1px solid ${token.colorBorderSecondary}` : "none" }}>
                            <Flex align="center" gap={6} style={{ marginBottom: 4 }}>
                              <Tag color="blue" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
                                {i + 1}
                              </Tag>
                              <Typography.Text strong style={{ fontSize: 13 }}>
                                {p.customerName ?? "No name"}
                              </Typography.Text>
                              <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
                                {p.totalPax} pax
                              </Tag>
                            </Flex>
                            <Flex vertical gap={2} style={{ paddingLeft: 30 }}>
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                <HomeOutlined style={{ marginRight: 4 }} />{p.pickup || "No hotel"}
                              </Typography.Text>
                              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                Ref: {p.bookingRef}
                              </Typography.Text>
                            </Flex>
                          </div>
                        ))
                      ),
                    }]}
                  />
                )}
              </Card>
            ))
          )}
        </>
      ) : (
        /* Calendar view */
        <div>
          <Flex justify="center" align="center" gap={16} style={{ marginBottom: 16 }}>
            <Button size="small" onClick={() => setCalMonth(calMonth.subtract(1, "month"))}>
              &lt;
            </Button>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {calMonth.format("MMMM YYYY")}
            </Typography.Text>
            <Button size="small" onClick={() => setCalMonth(calMonth.add(1, "month"))}>
              &gt;
            </Button>
          </Flex>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} style={{ textAlign: "center", fontWeight: 600, padding: 8, fontSize: 12, color: token.colorTextSecondary }}>
                {d}
              </div>
            ))}
            {calCells.map((cell, i) => {
              const dayNum = i - startDayOfWeek + 1;
              const isToday = calMonth.date(dayNum).isSame(today, "day");
              return (
                <div
                  key={i}
                  style={{
                    minHeight: 80,
                    padding: 4,
                    borderRadius: 8,
                    border: isToday ? `2px solid ${token.colorPrimary}` : `1px solid ${token.colorBorderSecondary}`,
                    background: isToday ? token.colorPrimaryBg : token.colorBgContainer,
                  }}
                >
                  {dayNum >= 1 && dayNum <= daysInMonth && (
                    <>
                      <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 2 }}>
                        {dayNum}
                      </div>
                      {cell && (
                        <Tag
                          color={cell.status === "DISPATCHED" ? "blue" : cell.status === "COMPLETED" ? "green" : "orange"}
                          style={{ fontSize: 10, lineHeight: "14px", padding: "0 4px", margin: 0, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                        >
                          {cell.tourName ?? cell.code}
                        </Tag>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
