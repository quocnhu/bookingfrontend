"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Collapse,
  DatePicker,
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
  CalendarOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HomeOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import GuideBookingsPanel, {
  type GuideBooking,
} from "@/components/tour-guide/guide-bookings-panel";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isBetween from "dayjs/plugin/isBetween";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);

const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  DISPATCHED: "blue",
  VERIFYING: "purple",
  COMPLETED: "green",
  CANCELED: "red",
};

const mapsSearchUrl = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

const directionsUrl = (pickups: Array<{ pickup?: string | null }>) => {
  const stops = pickups
    .map((p) => p.pickup)
    .filter((x): x is string => !!x && x.trim().length > 0);
  if (!stops.length) return null;
  const params = new URLSearchParams({ api: "1", destination: stops[0] });
  if (stops.length > 1) params.set("waypoints", stops.slice(1).join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

export type TripsMode = "driver" | "guide" | "provider";

interface Trip {
  id: string;
  code?: string | null;
  tourName?: string | null;
  tourType?: string | null;
  durationDays?: number | null;
  status: string;
  startDate: string;
  endDate: string;
  vehicle?: { plateNumber: string; capacity?: number | null } | null;
  driver?: { id: string; name: string; email?: string } | null;
  guide?: { id: string; name: string; email?: string } | null;
  bookings: GuideBooking[];
  itinerary?: any[];
  totalPax?: number;
  pickups?: Array<{
    bookingRef?: string;
    customerName?: string;
    pickup?: string;
    totalPax?: number;
  }>;
  tourReport?: any;
}

interface RoleTripsProps {
  mode: TripsMode;
  title: string;
  titleIcon: React.ReactNode;
  subtitle?: string;
}

export default function RoleTripsPage({
  mode,
  title,
  titleIcon,
  subtitle,
}: RoleTripsProps) {
  const { token } = antdTheme.useToken();
  const [assignments, setAssignments] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(dayjs());
  const [range, setRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [calendarData, setCalendarData] = useState<{
    assignments: any[];
    leaves: any[];
  }>({ assignments: [], leaves: [] });

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
      setCalendarData(r.data ?? { assignments: [], leaves: [] });
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

  const filtered = useMemo(() => {
    if (!range || !range[0] || !range[1]) return assignments;
    const s0 = range[0];
    const s1 = range[1];
    return assignments.filter((a) => {
      const s = dayjs(a.startDate);
      const e = dayjs(a.endDate);
      return (
        s.isBetween(s0, s1, "day", "[]") ||
        e.isBetween(s0, s1, "day", "[]") ||
        (s.isBefore(s0, "day") && e.isAfter(s1, "day"))
      );
    });
  }, [assignments, range]);

  const today = dayjs();
  const upcoming = filtered.filter(
    (a) => dayjs(a.startDate).isSameOrAfter(today, "day") && a.status !== "CANCELED",
  );
  const completed = filtered.filter((a) => a.status === "COMPLETED");
  const needsReport =
    mode === "guide"
      ? assignments.filter((a) => a.status === "DISPATCHED" && !a.tourReport)
      : [];

  // Calendar grid
  const calStart = calMonth.startOf("month");
  const calEnd = calMonth.endOf("month");
  const daysInMonth = calEnd.date();
  const startDayOfWeek = calStart.day();
  const calCells: (Trip | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) calCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = calMonth.date(d);
    const match = calendarData.assignments.filter((c) => {
      const s = dayjs(c.startDate);
      const e = dayjs(c.endDate);
      return cellDate.isSameOrAfter(s, "day") && cellDate.isSameOrBefore(e, "day");
    });
    calCells.push(match.length > 0 ? match[0] : null);
  }

  const coversDay = (
    start: string,
    end: string,
    cellDate: dayjs.Dayjs,
  ): boolean =>
    cellDate.isSameOrAfter(dayjs(start), "day") &&
    cellDate.isSameOrBefore(dayjs(end), "day");

  const DOT_RED = "#ff4d4f";
  const DOT_ORANGE = "#fa8c16";
  const DOT_GREEN = "#52c41a";

  const renderTripCard = (a: Trip) => {
    const route = directionsUrl(a.pickups ?? []);
    /** The booking's note, looked up by bookingRef — pickups is the shortened version. */
    const noteOf = (ref?: string) =>
      a.bookings?.find((b) => b.bookingRef === ref)?.notes?.trim() || null;
    return (
      <Card
        key={a.id}
        variant="borderless"
        style={{
          marginBottom: 12,
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 12,
        }}
      >
        <Flex justify="space-between" align="flex-start" wrap gap={16}>
          <Flex vertical gap={4} style={{ flex: 1, minWidth: 240 }}>
            <Flex align="center" gap={8} wrap>
              <Typography.Text strong style={{ fontSize: 16 }}>
                {a.tourName ?? a.code}
              </Typography.Text>
              <Tag color={STATUS_COLOR[a.status]} style={{ margin: 0 }}>
                {a.status}
              </Tag>
              {mode === "guide" && a.tourReport && (
                <Tag
                  color={
                    a.tourReport.status === "VERIFIED"
                      ? "green"
                      : a.tourReport.status === "REJECTED"
                        ? "red"
                        : "orange"
                  }
                  style={{ margin: 0 }}
                >
                  Report: {a.tourReport.status}
                </Tag>
              )}
            </Flex>
            <Typography.Text type="secondary">
              <CalendarOutlined /> {dayjs(a.startDate).format("DD/MM/YYYY")} —{" "}
              {dayjs(a.endDate).format("DD/MM/YYYY")}
              {a.durationDays
                ? ` · ${a.durationDays} ${a.durationDays === 1 ? "Day" : "Days"}`
                : ""}
            </Typography.Text>
            {a.vehicle && (
              <Typography.Text type="secondary">
                <CarOutlined /> {a.vehicle.plateNumber}
              </Typography.Text>
            )}
            {mode === "provider" && (
              <Typography.Text type="secondary">
                <UserOutlined /> Driver: {a.driver?.name ?? "Not assigned"} · Guide:{" "}
                {a.guide?.name ?? "Not assigned"}
              </Typography.Text>
            )}
            <Typography.Text type="secondary">
              <TeamOutlined /> {a.bookings?.length ?? 0} bookings · {a.totalPax ?? 0} pax
            </Typography.Text>
          </Flex>
          {route && (
            <Flex gap={8}>
              <Button
                type="primary"
                ghost
                icon={<EnvironmentOutlined />}
                onClick={() => window.open(route, "_blank")}
              >
                Where to go
              </Button>
            </Flex>
          )}
        </Flex>

        {mode === "guide" && a.itinerary && a.itinerary.length > 0 && (
          <Collapse
            size="small"
            style={{ marginTop: 12 }}
            items={[
              {
                key: "itinerary",
                label: "Itinerary",
                children: (
                  <Descriptions column={1} size="small">
                    {a.itinerary.map((item: any) => (
                      <Descriptions.Item
                        key={item.id}
                        label={`${item.timeSlot ?? `Day ${item.dayNumber}`} — ${item.title}`}
                      >
                        {item.location && (
                          <>
                            <EnvironmentOutlined /> {item.location}
                            <a
                              href={mapsSearchUrl(item.location)}
                              target="_blank"
                              rel="noreferrer"
                              style={{ marginLeft: 8 }}
                            >
                              Map
                            </a>
                          </>
                        )}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                ),
              },
            ]}
          />
        )}

        {a.pickups && a.pickups.length > 0 && (
          <Collapse
            size="small"
            style={{ marginTop: mode === "guide" && a.itinerary?.length ? 8 : 12 }}
            items={[
              {
                key: "pickups",
                label: `Pickup list (${a.pickups.length} booking${a.pickups.length > 1 ? "s" : ""})`,
                children: a.pickups.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "8px 0",
                      borderBottom:
                        i < (a.pickups?.length ?? 0) - 1
                          ? `1px solid ${token.colorBorderSecondary}`
                          : "none",
                    }}
                  >
                    <Flex align="center" gap={6} style={{ marginBottom: 4 }} wrap>
                      <Tag color="blue" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>
                        {i + 1}
                      </Tag>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {p.customerName ?? "No name"}
                      </Typography.Text>
                      <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
                        {p.totalPax ?? 0} pax
                      </Tag>
                      {p.pickup && (
                        <a
                          href={mapsSearchUrl(p.pickup)}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11 }}
                        >
                          Map
                        </a>
                      )}
                    </Flex>
                    <Flex vertical gap={2} style={{ paddingLeft: 30 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        <HomeOutlined style={{ marginRight: 4 }} />
                        {p.pickup || "No hotel"}
                      </Typography.Text>
                      {p.bookingRef && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          Ref: {p.bookingRef}
                        </Typography.Text>
                      )}
                      {noteOf(p.bookingRef) && (
                        <Typography.Text
                          style={{ fontSize: 11, color: "#faad14", fontWeight: 500 }}
                        >
                          <FileTextOutlined style={{ marginRight: 4 }} />
                          {noteOf(p.bookingRef)}
                        </Typography.Text>
                      )}
                    </Flex>
                  </div>
                )),
              },
            ]}
          />
        )}

        {(mode === "guide" || mode === "driver") && (a.bookings?.length ?? 0) > 0 && (
          <Collapse
            size="small"
            style={{ marginTop: 8 }}
            items={[
              {
                key: "bookings",
                label: `Booking & Money (${a.bookings?.length ?? 0})`,
                children: (
                  <GuideBookingsPanel
                    assignmentId={a.id}
                    bookings={a.bookings ?? []}
                    readOnlyNotes={mode === "driver"}
                    onBookingsChanged={loadAssignments}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>
    );
  };

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {titleIcon} {title}
          </Typography.Title>
          {subtitle && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {subtitle}
            </Typography.Text>
          )}
        </Flex>
        <Flex align="center" gap={8} wrap>
          <DatePicker.RangePicker
            allowClear
            value={range}
            onChange={(v) => setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            placeholder={["From", "To"]}
            size="middle"
          />
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
                <Statistic
                  title="Total Trips"
                  value={filtered.length}
                  prefix={<CarOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card variant="borderless">
                <Statistic
                  title="Upcoming"
                  value={upcoming.length}
                  prefix={<ClockCircleOutlined />}
                  styles={{ content: { color: token.colorWarning } }}
                />
              </Card>
            </Col>
            <Col xs={12} sm={8} lg={6}>
              <Card variant="borderless">
                <Statistic
                  title="Completed"
                  value={completed.length}
                  prefix={<CheckCircleOutlined />}
                  styles={{ content: { color: token.colorSuccess } }}
                />
              </Card>
            </Col>
            {mode === "guide" && (
              <Col xs={12} sm={8} lg={6}>
                <Card variant="borderless">
                  <Statistic
                    title="Need Report"
                    value={needsReport.length}
                    prefix={<FileTextOutlined />}
                    styles={{
                      content: {
                        color: needsReport.length > 0 ? token.colorError : token.colorSuccess,
                      },
                    }}
                  />
                </Card>
              </Col>
            )}
          </Row>

          {mode === "guide" && needsReport.length > 0 && (
            <Card
              variant="borderless"
              style={{
                marginTop: 16,
                border: `1px solid ${token.colorWarning}`,
                borderRadius: 12,
                background: token.colorWarningBg,
              }}
            >
              <Typography.Text strong style={{ color: token.colorWarning }}>
                <FileTextOutlined /> You have {needsReport.length} trip(s) that need a tour
                report submitted.
              </Typography.Text>
            </Card>
          )}

          <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
            Upcoming Trips
          </Typography.Title>

          {upcoming.length === 0 ? (
            <Empty description="No upcoming trips in this period" />
          ) : (
            upcoming.map(renderTripCard)
          )}
        </>
      ) : (
        /* Calendar view */
        <div>
          <Flex justify="center" align="center" gap={16} style={{ marginBottom: 16 }}>
            <Button
              size="small"
              onClick={() => setCalMonth(calMonth.subtract(1, "month"))}
            >
              &lt;
            </Button>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {calMonth.format("MMMM YYYY")}
            </Typography.Text>
            <Button size="small" onClick={() => setCalMonth(calMonth.add(1, "month"))}>
              &gt;
            </Button>
          </Flex>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              marginBottom: 12,
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DOT_GREEN,
                  marginRight: 5,
                }}
              />
              Available
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DOT_ORANGE,
                  marginRight: 5,
                }}
              />
              On tour
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: DOT_RED,
                  marginRight: 5,
                }}
              />
              Day off
            </Typography.Text>
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(46px, 1fr))",
                gap: 4,
                minWidth: 340,
              }}
            >
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  style={{
                    textAlign: "center",
                    fontWeight: 600,
                    padding: 8,
                    fontSize: 12,
                    color: token.colorTextSecondary,
                  }}
                >
                  {d}
                </div>
              ))}
              {calCells.map((cell, i) => {
                const dayNum = i - startDayOfWeek + 1;
                const isToday = calMonth.date(dayNum).isSame(today, "day");
                const cellDate = calMonth.date(dayNum);
                const onLeave =
                  dayNum >= 1 &&
                  dayNum <= daysInMonth &&
                  calendarData.leaves.find((l) =>
                    coversDay(l.startDate, l.endDate, cellDate),
                  );
                const onTour = dayNum >= 1 && dayNum <= daysInMonth && cell;
                return (
                  <div
                    key={i}
                    style={{
                      minHeight: 80,
                      padding: 4,
                      borderRadius: 8,
                      border: isToday
                        ? `2px solid ${token.colorPrimary}`
                        : `1px solid ${token.colorBorderSecondary}`,
                      background: isToday
                        ? token.colorPrimaryBg
                        : token.colorBgContainer,
                    }}
                  >
                    {onLeave ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                          height: "100%",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: DOT_RED,
                            }}
                          />
                          <span style={{ fontSize: 11, fontWeight: 600, color: DOT_RED }}>
                            OFF
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            color: token.colorTextSecondary,
                            lineHeight: 1.3,
                          }}
                        >
                          {onLeave.reason || "On leave"}
                        </span>
                      </div>
                    ) : onTour ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: DOT_ORANGE,
                            }}
                          />
                          <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400 }}>
                            {dayNum}
                          </span>
                        </div>
                        <Tag
                          color={
                            cell.status === "COMPLETED"
                              ? "green"
                              : cell.status === "DISPATCHED"
                                ? "blue"
                                : "orange"
                          }
                          style={{
                            fontSize: 10,
                            lineHeight: "14px",
                            padding: "0 4px",
                            margin: 0,
                            display: "block",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {cell.tourName ?? cell.code}
                        </Tag>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: DOT_GREEN,
                            }}
                          />
                          <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400 }}>
                            {dayNum}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}