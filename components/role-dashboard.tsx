"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Divider,
  Drawer,
  Empty,
  Flex,
  Grid,
  Row,
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
  EnvironmentOutlined,
  FileTextOutlined,
  PhoneOutlined,
  PlusOutlined,
  RightOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import dayjs from "dayjs";
import { api } from "@/lib/api";
import type { LeaveSummary } from "@/components/leave-summary";
import { formatLeaveDayCount, leaveDayCount } from "@/lib/leave";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  DISPATCHED: "blue",
  VERIFYING: "purple",
  COMPLETED: "green",
  CANCELED: "red",
};

const LEAVE_STATUS: Record<string, { text: string; color: string }> = {
  PENDING: { text: "Pending", color: "orange" },
  APPROVED: { text: "Approved", color: "green" },
  REJECTED: { text: "Rejected", color: "red" },
};

export default function RoleDashboard({
  mode,
  title,
  subtitle,
  tripsHref,
  accent,
}: {
  mode: "guide" | "driver" | "provider";
  title: string;
  subtitle: string;
  tripsHref: string;
  accent: string;
}) {
  const { token } = antdTheme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [leave, setLeave] = useState<LeaveSummary | null>(null);
  const [leaveItems, setLeaveItems] = useState<any[]>([]);
  const [statsOpen, setStatsOpen] = useState(false);

  useEffect(() => {
    api
      .get("/assignments/my-assignments")
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (mode === "provider") return;
    api
      .get("/leaves/my-summary")
      .then((r) => setLeave(r.data ?? null))
      .catch(() => setLeave(null));
    api
      .get("/leaves/my")
      .then((r) => setLeaveItems(r.data ?? []))
      .catch(() => setLeaveItems([]));
  }, [mode]);

  const dayOffHref = mode === "guide" ? "/tour-guide/day-off" : "/driver/day-off";

  const today = dayjs();
  const upcoming = useMemo(
    () =>
      items
        .filter(
          (a) => dayjs(a.startDate).isSame(today, "day") || dayjs(a.startDate).isAfter(today, "day"),
        )
        .filter((a) => a.status !== "CANCELED")
        .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );
  const completed = useMemo(
    () => items.filter((a) => a.status === "COMPLETED"),
    [items],
  );
  const needReport = useMemo(
    () =>
      mode === "guide"
        ? items.filter((a) => a.status === "DISPATCHED" && !a.tourReport)
        : [],
    [items, mode],
  );

  const statCards = [
    { title: "Total trips", value: items.length, icon: <CarOutlined /> },
    { title: "Upcoming", value: upcoming.length, icon: <ClockCircleOutlined /> },
    { title: "Completed", value: completed.length, icon: <CheckCircleOutlined /> },
    ...(mode === "guide"
      ? [{ title: "Need report", value: needReport.length, icon: <FileTextOutlined /> }]
      : []),
  ];

  const upcomingBookings = useMemo(
    () =>
      upcoming
        .flatMap((a) =>
          (a.bookings ?? []).map((b: any) => ({ ...b, trip: a })),
        )
        .slice(0, 8),
    [upcoming],
  );

  const leavePeriods = leave
    ? [
        { key: "week", label: "This week", data: leave.week },
        { key: "month", label: "This month", data: leave.month },
        { key: "year", label: "This year", data: leave.year },
      ]
    : [];

  const todayDispatch = useMemo(
    () =>
      items.filter(
        (a) =>
          a.status === "DISPATCHED" &&
          dayjs().isSameOrAfter(dayjs(a.startDate), "day") &&
          dayjs().isSameOrBefore(dayjs(a.endDate), "day"),
      ),
    [items],
  );

  const bookingColumns: ColumnsType<any> = [
    {
      title: "#",
      key: "__index",
      width: 48,
      align: "center",
      render: (_: unknown, __: any, index: number) => index + 1,
    },
    {
      title: "Customer",
      key: "customer",
      render: (_: unknown, b: any) => (
        <Flex vertical gap={1}>
          <Typography.Text strong style={{ fontSize: 13 }}>
            {b.customerName || "—"}
          </Typography.Text>
          {b.phone && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              <PhoneOutlined /> {b.phone}
            </Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Trip",
      key: "trip",
      responsive: ["md"],
      render: (_: unknown, b: any) => (
        <Flex vertical gap={1}>
          <Typography.Text style={{ fontSize: 13 }}>
            {b.trip?.tourName ?? b.trip?.code ?? "—"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {dayjs(b.trip?.startDate).format("DD MMM YYYY")}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Hotel / pickup",
      key: "hotel",
      render: (_: unknown, b: any) => (
        <Typography.Text
          ellipsis={{ tooltip: b.hotelName || b.address || "—" }}
          style={{ fontSize: 13, maxWidth: 220, display: "inline-block" }}
        >
          {b.hotelName || b.address || "—"}
        </Typography.Text>
      ),
    },
    {
      title: "Pax",
      dataIndex: "totalPax",
      key: "pax",
      width: 60,
      align: "center",
      render: (v: number | null) => v ?? 0,
    },
  ];

  if (loading) {
    return (
      <Flex justify="center" style={{ padding: 80 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {subtitle}
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8} wrap style={{ width: isMobile ? "100%" : undefined }}>
          <Button
            icon={<BarChartOutlined />}
            onClick={() => setStatsOpen(true)}
            style={{ flex: isMobile ? 1 : undefined }}
          >
            Stats
          </Button>
          <Link href={tripsHref} style={{ flex: isMobile ? 1 : undefined }}>
            <Button type="primary" ghost icon={<CarOutlined />} block={isMobile}>
              My trips
            </Button>
          </Link>
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
          {statCards.map((s) => (
            <Card
              key={s.title}
              variant="borderless"
              styles={{ body: { padding: 16 } }}
            >
              <Statistic title={s.title} value={s.value} prefix={s.icon} />
            </Card>
          ))}
        </Flex>
      </Drawer>

      {todayDispatch.length > 0 && (
        <Card
          variant="borderless"
          style={{
            marginBottom: 16,
            border: `1px solid ${accent}40`,
            background: `${accent}0d`,
          }}
          styles={{ body: { padding: 14 } }}
        >
          <Flex align="center" justify="space-between" wrap gap={8}>
            <Flex align="center" gap={8}>
              <CarOutlined style={{ color: accent }} />
              <Typography.Text strong>Today's dispatch</Typography.Text>
              <Tag color="blue" style={{ margin: 0 }}>
                {todayDispatch.length}
              </Tag>
            </Flex>
            <Link href={tripsHref}>
              <Button type="link" size="small" style={{ padding: 0 }}>
                Open My Trips
              </Button>
            </Link>
          </Flex>

          <Flex vertical gap={8} style={{ marginTop: 10 }}>
            {todayDispatch.slice(0, 3).map((a) => (
              <Flex
                key={a.id}
                align="center"
                justify="space-between"
                wrap
                gap={8}
                style={{
                  background: token.colorBgContainer,
                  border: `1px solid ${token.colorSplit}`,
                  borderRadius: 10,
                  padding: "8px 12px",
                }}
              >
                <Flex vertical gap={2} style={{ minWidth: 0 }}>
                  <Typography.Text strong ellipsis style={{ maxWidth: "100%" }}>
                    {a.tourName ?? a.code}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {dayjs(a.startDate).format("DD/MM")} —{" "}
                    {dayjs(a.endDate).format("DD/MM")}
                    {a.vehicle?.plateNumber ? ` · ${a.vehicle.plateNumber}` : ""}
                    {typeof a.totalPax === "number" ? ` · ${a.totalPax} pax` : ""}
                  </Typography.Text>
                </Flex>
                {mode === "guide" ? (
                  <Link href={`/tour-guide/submit-report?assignmentId=${a.id}`}>
                    <Button size="small" type="primary" icon={<FileTextOutlined />}>
                      Submit report
                    </Button>
                  </Link>
                ) : (
                  <Link href={tripsHref}>
                    <Button size="small">Open</Button>
                  </Link>
                )}
              </Flex>
            ))}
          </Flex>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={mode === "provider" ? 24 : 15}>
          {mode === "guide" && needReport.length > 0 && (
            <Card
              variant="borderless"
              style={{
                marginBottom: 16,
                border: `1px solid ${token.colorWarningBorder}`,
                background: token.colorWarningBg,
              }}
              styles={{ body: { padding: 14 } }}
            >
              <Flex align="center" justify="space-between" wrap gap={8}>
                <Typography.Text strong style={{ color: token.colorWarning }}>
                  <FileTextOutlined /> {needReport.length} trip(s) need a tour report
                </Typography.Text>
                <Link href="/tour-guide/submit-report">
                  <Button size="small" type="primary">
                    Submit now
                  </Button>
                </Link>
              </Flex>
            </Card>
          )}

          <Card
            variant="borderless"
            title={
              <Flex align="center" gap={8}>
                <CarOutlined style={{ color: accent }} />
                <Typography.Text strong>Upcoming trips</Typography.Text>
                <Tag style={{ margin: 0 }}>{upcoming.length}</Tag>
              </Flex>
            }
            extra={
              upcoming.length > 0 ? (
                <Link href={tripsHref}>
                  <Button type="link" size="small" style={{ padding: 0 }}>
                    View all
                  </Button>
                </Link>
              ) : null
            }
            styles={{ body: { padding: 0 } }}
          >
            {upcoming.length === 0 ? (
              <Empty style={{ padding: 24 }} description="No upcoming trips" />
            ) : (
              upcoming.slice(0, 4).map((a, index) => (
                <Flex
                  key={a.id}
                  align="center"
                  gap={12}
                  style={{
                    padding: "12px 16px",
                    borderTop: index === 0 ? "none" : `1px solid ${token.colorSplit}`,
                  }}
                >
                  <Flex
                    vertical
                    align="center"
                    justify="center"
                    style={{
                      width: 52,
                      minWidth: 52,
                      height: 52,
                      borderRadius: 12,
                      background: token.colorFillQuaternary,
                      color: accent,
                      lineHeight: 1,
                    }}
                  >
                    <span style={{ fontSize: 18, fontWeight: 800 }}>
                      {dayjs(a.startDate).format("DD")}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>
                      {dayjs(a.startDate).format("MMM")}
                    </span>
                  </Flex>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" gap={6} wrap>
                      <Typography.Text strong ellipsis style={{ fontSize: 14, maxWidth: "100%" }}>
                        {a.tourName ?? a.code}
                      </Typography.Text>
                      <Tag color={STATUS_COLOR[a.status] ?? "default"} style={{ margin: 0 }}>
                        {a.status}
                      </Tag>
                    </Flex>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(a.startDate).format("DD/MM/YYYY")} —{" "}
                      {dayjs(a.endDate).format("DD/MM/YYYY")}
                      {a.durationDays ? ` · ${a.durationDays}d` : ""}
                    </Typography.Text>
                    <Flex align="center" gap={12} wrap style={{ marginTop: 2 }}>
                      {a.vehicle?.plateNumber && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          <CarOutlined /> {a.vehicle.plateNumber}
                        </Typography.Text>
                      )}
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        <UserOutlined /> {a.totalPax ?? 0} pax
                      </Typography.Text>
                      {(a.bookings?.length ?? 0) > 0 && (
                        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                          <EnvironmentOutlined /> {a.bookings.length} pickup(s)
                        </Typography.Text>
                      )}
                    </Flex>
                  </div>
                  <Link href={tripsHref}>
                    <Button
                      size="small"
                      type={isMobile ? "text" : "default"}
                      icon={isMobile ? <RightOutlined /> : undefined}
                      style={isMobile ? undefined : { borderColor: accent, color: accent }}
                    >
                      {isMobile ? "" : "Details"}
                    </Button>
                  </Link>
                </Flex>
              ))
            )}
          </Card>

          <Card
            variant="borderless"
            style={{ marginTop: 16 }}
            title={
              <Flex align="center" gap={8}>
                <TeamOutlined style={{ color: accent }} />
                <Typography.Text strong>Upcoming bookings</Typography.Text>
                <Tag style={{ margin: 0 }}>{upcomingBookings.length}</Tag>
              </Flex>
            }
            extra={
              <Link href={tripsHref}>
                <Button type="link" size="small" style={{ padding: 0 }}>
                  Open trips
                </Button>
              </Link>
            }
            styles={{ body: { padding: upcomingBookings.length === 0 ? 24 : 0 } }}
          >
            {upcomingBookings.length === 0 ? (
              <Empty description="No passenger bookings on upcoming trips" />
            ) : (
              <Table
                rowKey="id"
                size={isMobile ? "small" : "middle"}
                columns={bookingColumns}
                dataSource={upcomingBookings}
                pagination={false}
                scroll={{ x: "max-content" }}
              />
            )}
          </Card>
        </Col>

        {mode !== "provider" && (
          <Col xs={24} lg={9}>
            <Card
              variant="borderless"
              title={
                <Flex align="center" gap={8}>
                  <CalendarOutlined style={{ color: accent }} />
                  <Typography.Text strong>My leave</Typography.Text>
                </Flex>
              }
              extra={
                <Link href={dayOffHref}>
                  <Button type="link" size="small" style={{ padding: 0 }}>
                    Manage
                  </Button>
                </Link>
              }
              styles={{ body: { padding: 16 } }}
            >
              <Row gutter={[8, 8]}>
                {leavePeriods.length === 0
                  ? [0, 1, 2].map((i) => (
                      <Col span={8} key={i}>
                        <div
                          style={{
                            height: 70,
                            borderRadius: 10,
                            background: token.colorFillQuaternary,
                          }}
                        />
                      </Col>
                    ))
                  : leavePeriods.map((p) => (
                      <Col span={8} key={p.key}>
                        <div
                          style={{
                            borderRadius: 10,
                            background: token.colorFillQuaternary,
                            padding: "10px 6px",
                            textAlign: "center",
                          }}
                        >
                          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                            {p.label}
                          </Typography.Text>
                          <div style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1.2 }}>
                            {p.data.days}
                            <span style={{ fontSize: 11, marginLeft: 2 }}>d</span>
                          </div>
                        </div>
                      </Col>
                    ))}
              </Row>

              <Divider style={{ margin: "12px 0" }} />

              <Flex justify="space-between" align="center">
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  <CheckCircleOutlined style={{ color: token.colorSuccess }} />{" "}
                  {leave?.year.approvedDays ?? 0} approved
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  <ClockCircleOutlined style={{ color: token.colorWarning }} />{" "}
                  {leave?.year.pendingDays ?? 0} pending
                </Typography.Text>
              </Flex>

              <Flex gap={8} style={{ marginTop: 12 }}>
                <Link href={dayOffHref} style={{ flex: 1 }}>
                  <Button type="primary" block icon={<PlusOutlined />}>
                    Request
                  </Button>
                </Link>
                <Link href={dayOffHref} style={{ flex: 1 }}>
                  <Button block>History</Button>
                </Link>
              </Flex>
            </Card>

            <Card
              variant="borderless"
              style={{ marginTop: 16 }}
              title={
                <Flex align="center" gap={8}>
                  <ClockCircleOutlined style={{ color: accent }} />
                  <Typography.Text strong>Leave requests</Typography.Text>
                </Flex>
              }
              extra={
                <Link href={dayOffHref}>
                  <Button type="link" size="small" style={{ padding: 0 }}>
                    View all
                  </Button>
                </Link>
              }
              styles={{ body: { padding: 0 } }}
            >
              {leaveItems.length === 0 ? (
                <Empty style={{ padding: 24 }} description="No leave requests yet" />
              ) : (
                leaveItems.slice(0, 4).map((l, index) => {
                  const status = LEAVE_STATUS[l.status] ?? {
                    text: l.status,
                    color: "default",
                  };
                  return (
                    <div
                      key={l.id}
                      style={{
                        padding: "10px 16px",
                        borderTop: index === 0 ? "none" : `1px solid ${token.colorSplit}`,
                      }}
                    >
                      <Flex justify="space-between" align="flex-start" gap={8}>
                        <div style={{ minWidth: 0 }}>
                          <Typography.Text strong style={{ fontSize: 13 }}>
                            {dayjs(l.startDate).format("DD MMM")} —{" "}
                            {dayjs(l.endDate).format("DD MMM")}
                          </Typography.Text>
                          <div>
                            <Typography.Text
                              type="secondary"
                              ellipsis={{ tooltip: l.reason || undefined }}
                              style={{ fontSize: 11, maxWidth: 180, display: "inline-block" }}
                            >
                              {formatLeaveDayCount(leaveDayCount(l.startDate, l.endDate))}
                              {l.reason ? ` · ${l.reason}` : ""}
                            </Typography.Text>
                          </div>
                        </div>
                        <Flex gap={4} wrap justify="flex-end">
                          {l.isEmergency && (
                            <Tag
                              color="red"
                              icon={<ThunderboltOutlined />}
                              style={{ margin: 0, fontWeight: 600 }}
                            >
                              Emergency
                            </Tag>
                          )}
                          <Tag color={status.color} style={{ margin: 0 }}>
                            {status.text}
                          </Tag>
                        </Flex>
                      </Flex>
                    </div>
                  );
                })
              )}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
