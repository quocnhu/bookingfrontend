"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Collapse,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Grid,
  Segmented,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BarChartOutlined,
  CalendarOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HomeOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";
import GuideBookingsPanel, {
  type GuideBooking,
} from "@/components/tour-guide/guide-bookings-panel";
import MyTripsBoard from "@/components/tour-guide/my-trips-board";
import type { BoardItem } from "@/components/dispatch-board/types";
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
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [assignments, setAssignments] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar" | "board">("list");
  const [statsOpen, setStatsOpen] = useState(false);
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

  const exportCsv = () => {
    try {
      const head = [
        "Trip code",
        "Tour",
        "Start",
        "End",
        "Status",
        "Vehicle",
        "Customer",
        "Booking ref",
        "Pickup / Hotel",
        "Pax",
      ];
      const esc = (v: unknown) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [head.map(esc).join(",")];
      for (const a of filtered) {
        const base = [
          a.code ?? "",
          a.tourName ?? "",
          dayjs(a.startDate).format("DD/MM/YYYY"),
          dayjs(a.endDate).format("DD/MM/YYYY"),
          a.status,
          a.vehicle?.plateNumber ?? "",
        ];
        if (a.pickups?.length) {
          for (const p of a.pickups) {
            lines.push(
              [...base, p.customerName ?? "", p.bookingRef ?? "", p.pickup ?? "", p.totalPax ?? 0]
                .map(esc)
                .join(","),
            );
          }
        } else {
          lines.push([...base, "", "", "", ""].map(esc).join(","));
        }
      }
      const blob = new Blob(["\ufeff" + lines.join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = `my-trips-${dayjs().format("YYYY-MM-DD")}.csv`;
      el.click();
      URL.revokeObjectURL(url);
      message.success(`Exported ${filtered.length} trip(s)`);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not export trips"));
    }
  };

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

  const renderTripDetails = (a: Trip) => {
    /** The booking's note, looked up by bookingRef — pickups is the shortened version. */
    const noteOf = (ref?: string) =>
      a.bookings?.find((b) => b.bookingRef === ref)?.notes?.trim() || null;
    return (
      <div>
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
                    readOnlyNotes={mode !== "guide"}
                    onBookingsChanged={loadAssignments}
                  />
                ),
              },
            ]}
          />
        )}
      </div>
    );
  };

  const tripColumns: ColumnsType<Trip> = [
    {
      title: "#",
      key: "__index",
      width: 56,
      align: "center",
      render: (_: unknown, __: Trip, index: number) => index + 1,
    },
    {
      title: "Tour",
      key: "tour",
      render: (_: unknown, a: Trip) => (
        <Flex vertical gap={2}>
          <Flex align="center" gap={6} wrap>
            <Typography.Text strong>{a.tourName ?? a.code ?? "—"}</Typography.Text>
            {a.tourType && (
              <Tag
                color={a.tourType === "GROUP_TOUR" ? "blue" : "purple"}
                style={{ margin: 0, fontSize: 10 }}
              >
                {a.tourType === "GROUP_TOUR" ? "Group" : "Private"}
              </Tag>
            )}
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {a.code ?? "—"}
            {a.durationDays ? ` · ${a.durationDays} day${a.durationDays > 1 ? "s" : ""}` : ""}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Dates",
      key: "dates",
      render: (_: unknown, a: Trip) => (
        <Typography.Text style={{ whiteSpace: "nowrap" }}>
          {dayjs(a.startDate).format("DD/MM/YYYY")} →{" "}
          {dayjs(a.endDate).format("DD/MM/YYYY")}
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: Object.keys(STATUS_COLOR).map((v) => ({ text: v, value: v })),
      onFilter: (v, a) => a.status === v,
      render: (v: string) => (
        <Tag color={STATUS_COLOR[v] ?? "default"} style={{ margin: 0 }}>
          {v}
        </Tag>
      ),
    },
    {
      title: "Crew",
      key: "crew",
      render: (_: unknown, a: Trip) => (
        <Flex vertical gap={2}>
          <Typography.Text style={{ fontSize: 12, whiteSpace: "nowrap" }}>
            <UserOutlined /> {a.guide?.name ?? "—"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
            <TeamOutlined /> {a.driver?.name ?? "—"}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Assignment",
      key: "assignment",
      render: (_: unknown, a: Trip) => (
        <Flex vertical gap={2}>
          <Typography.Text strong style={{ fontSize: 12 }}>
            {a.code ?? "—"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
            <CarOutlined /> {a.vehicle?.plateNumber ?? "No vehicle"}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Bookings / Pax",
      key: "pax",
      render: (_: unknown, a: Trip) =>
        `${a.bookings?.length ?? 0} / ${a.totalPax ?? 0}`,
    },
    ...(mode === "guide"
      ? [
          {
            title: "Report",
            key: "report",
            render: (_: unknown, a: Trip) =>
              a.tourReport ? (
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
                  {a.tourReport.status}
                </Tag>
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              ),
          },
        ]
      : []),
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, a: Trip) => {
        const route = directionsUrl(a.pickups ?? []);
        return (
          <Flex gap={6} wrap>
            {route && (
              <Button
                size="small"
                icon={<EnvironmentOutlined />}
                onClick={() => window.open(route, "_blank")}
              >
                Route
              </Button>
            )}
            {mode === "guide" && (
              <Link href={`/tour-guide/submit-report?assignmentId=${a.id}`}>
                <Button
                  size="small"
                  type={
                    a.status === "DISPATCHED" && !a.tourReport
                      ? "primary"
                      : "default"
                  }
                  icon={<FileTextOutlined />}
                >
                  {a.status === "DISPATCHED" && !a.tourReport
                    ? "Report"
                    : "View report"}
                </Button>
              </Link>
            )}
          </Flex>
        );
      },
    },
  ];

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
        <Flex
          align="center"
          gap={8}
          wrap
          style={{ width: isMobile ? "100%" : undefined }}
        >
          <Button
            icon={<BarChartOutlined />}
            onClick={() => setStatsOpen(true)}
            style={{ flex: isMobile ? 1 : undefined }}
          >
            Stats
          </Button>
          {view !== "board" && (
            <DatePicker.RangePicker
              allowClear
              value={range}
              onChange={(v) => setRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
              placeholder={["From", "To"]}
              size={isMobile ? "small" : "middle"}
              style={{ width: isMobile ? "100%" : undefined }}
            />
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAssignments}
            loading={loading}
            style={{ flex: isMobile ? 1 : undefined }}
          >
            Refresh
          </Button>
          {mode === "driver" && (
            <Button
              icon={<DownloadOutlined />}
              onClick={exportCsv}
              style={{ flex: isMobile ? 1 : undefined }}
            >
              Export
            </Button>
          )}
          <Segmented
            block={isMobile}
            value={view}
            onChange={(v) => setView(v as any)}
            options={[
              { label: "List", value: "list" },
              { label: "Board", value: "board" },
              { label: "Calendar", value: "calendar" },
            ]}
            style={isMobile ? { width: "100%" } : undefined}
          />
        </Flex>
      </Flex>

      <Drawer
        title={
          <Flex align="center" gap={8}>
            <BarChartOutlined />
            <Typography.Text strong>Trip stats</Typography.Text>
          </Flex>
        }
        placement="right"
        width={isMobile ? "100%" : 360}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      >
        <Flex vertical gap={12}>
          <Card variant="borderless" styles={{ body: { padding: 16 } }}>
            <Statistic title="Total Trips" value={filtered.length} prefix={<CarOutlined />} />
          </Card>
          <Card variant="borderless" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="Upcoming"
              value={upcoming.length}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: token.colorWarning } }}
            />
          </Card>
          <Card variant="borderless" styles={{ body: { padding: 16 } }}>
            <Statistic
              title="Completed"
              value={completed.length}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: token.colorSuccess } }}
            />
          </Card>
          {mode === "guide" && (
            <Card variant="borderless" styles={{ body: { padding: 16 } }}>
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
          )}
        </Flex>
      </Drawer>

      {loading ? (
        <Flex justify="center" style={{ padding: 80 }}>
          <Spin size="large" />
        </Flex>
      ) : view === "list" ? (
        <>
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
            My Trips
          </Typography.Title>

          <Table
            rowKey="id"
            size={isMobile ? "small" : "middle"}
            columns={tripColumns}
            dataSource={filtered}
            scroll={{ x: "max-content" }}
            expandable={{
              expandedRowRender: (a) => renderTripDetails(a),
              rowExpandable: (a) =>
                Boolean(
                  a.itinerary?.length || a.pickups?.length || a.bookings?.length,
                ),
            }}
            pagination={{
              pageSize: isMobile ? 5 : 10,
              simple: isMobile,
              showSizeChanger: !isMobile,
              showTotal: isMobile ? undefined : (t) => `Total: ${t}`,
            }}
            locale={{
              emptyText: range
                ? "No trips in this period"
                : mode === "provider"
                  ? "No fleet trips yet"
                  : "No tours assigned to you yet — ask your admin or operator",
            }}
          />
        </>
      ) : view === "board" ? (
        <MyTripsBoard
          assignments={assignments as unknown as BoardItem[]}
          loading={loading}
          onRefresh={loadAssignments}
        />
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