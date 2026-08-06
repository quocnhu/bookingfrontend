"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar, Card, Col, Flex, Row, Segmented, Statistic, Table, Tag, Typography, theme as antdTheme } from "antd";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  CalendarOutlined,
  CarOutlined,
  DollarOutlined,
  FileTextOutlined,
  LockOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns } from "@/lib/table";

function formatVND(value: number | undefined | null) {
  return `${new Intl.NumberFormat("vi-VN").format(Number(value ?? 0))} ₫`;
}

export default function DashboardPage() {
  const { hasPermission } = useApp();
  const { token } = antdTheme.useToken();
  const [stats, setStats] = useState<any>(null);
  const [widgets, setWidgets] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [range, setRange] = useState<"day" | "week" | "month">("week");

  const COLORS = [token.colorPrimary, token.colorInfo, token.colorError, token.colorWarning, token.colorSuccess];
  const ACCENTS = [token.colorPrimary, token.colorInfo, token.colorSuccess, token.colorWarning, token.colorError];

  const tooltipStyle = {
    background: token.colorBgElevated,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: 10,
    boxShadow: token.boxShadowSecondary,
  };

  useEffect(() => {
    if (!hasPermission("dashboard.read")) return;
    api.get("/dashboard/stats").then((r) => setStats(r.data));
    api.get("/dashboard/widgets").then((r) => setWidgets(r.data));
  }, []);

  useEffect(() => {
    if (!hasPermission("dashboard.read")) return;
    api.get(`/dashboard/charts?range=${range}`).then((r) => setCharts(r.data));
  }, [range]);

  const statusColor: Record<string, string> = {
    PAID: "green",
    PENDING: "orange",
    REFUNDED: "red",
    ASSIGNED: "blue",
    CANCELED: "red",
  };

  const authColumns = centerColumns([
    {
      title: "Event",
      dataIndex: "eventType",
      key: "eventType",
      render: (v: string) => (
        <Tag color={v.includes("FAILED") ? "red" : v === "LOGIN" ? "green" : "blue"}>{v}</Tag>
      ),
    },
    {
      title: "User",
      key: "user",
      render: (_: any, r: any) => r.user?.email ?? r.user?.name ?? r.userId ?? "—",
    },
    { title: "Time", dataIndex: "createdAt", key: "createdAt", render: (v: string) => new Date(v).toLocaleString() },
  ]);

  const authActivity = useMemo(() => {
    if (!widgets?.recentAuthActivity) return [];
    return widgets.recentAuthActivity.map((l: any) => ({ ...l, key: l.id }));
  }, [widgets]);

  const canRead = hasPermission("dashboard.read");

  const statCards = [    { title: "Total Bookings", value: stats?.totalBookings ?? 0, icon: <FileTextOutlined /> },
    { title: "Today", value: stats?.todayBookings ?? 0, icon: <CalendarOutlined /> },
    { title: "Pending Bookings", value: stats?.pendingBookings ?? 0, icon: <FileTextOutlined /> },
    { title: "Dispatched Today", value: stats?.todayDispatched ?? 0, icon: <CarOutlined /> },
    { title: "Pending Settlements", value: stats?.pendingSettlements ?? 0, icon: <DollarOutlined /> },
    { title: "Tours", value: stats?.totalTours ?? 0, icon: <FileTextOutlined /> },
    { title: "Users", value: stats?.totalUsers ?? 0, icon: <UserOutlined /> },
    { title: "Roles", value: stats?.totalRoles ?? 0, icon: <TeamOutlined /> },
    { title: "Permissions", value: stats?.totalPermissions ?? 0, icon: <LockOutlined /> },
    { title: "Assignments", value: stats?.totalAssignments ?? 0, icon: <CarOutlined /> },
    { title: "Logins Today", value: stats?.todayLogins ?? 0, icon: <UserOutlined /> },
    { title: "Locked Accounts", value: stats?.lockedAccounts ?? 0, icon: <LockOutlined /> },
  ];

  const revenueData = charts?.revenueByBucket ?? [];
  const bookingsData = charts?.bookingsByBucket ?? [];
  const loginsData = charts?.loginsByBucket ?? [];

  return (
    <div>
      {!canRead && (
        <Typography.Text type="secondary">You have no access to the dashboard.</Typography.Text>
      )}

      {canRead && (
        <>
      <Row gutter={[16, 16]}>
        {statCards.map((s, i) => (
          <Col xs={12} sm={8} lg={6} xl={4} key={s.title}>
            <Card variant="borderless">
              <Flex align="center" gap={12}>
                <Avatar
                  shape="square"
                  size={44}
                  icon={s.icon}
                  style={{
                    background: ACCENTS[i % ACCENTS.length],
                    color: "#fff",
                    borderRadius: 12,
                  }}
                />
                <Statistic title={s.title} value={s.value} valueStyle={{ fontWeight: 700 }} />
              </Flex>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Revenue & Payments" variant="borderless" style={{ marginTop: 16 }}>
        <Flex align="flex-end" justify="space-between" wrap gap={16} style={{ marginBottom: 16 }}>
          <Flex wrap gap={32}>
            <Statistic title="Revenue Today" value={formatVND(stats?.revenueToday)} />
            <Statistic title="Revenue This Week" value={formatVND(stats?.revenueWeek)} />
            <Statistic title="Revenue This Month" value={formatVND(stats?.revenueMonth)} />
          </Flex>
          <Segmented
            value={range}
            onChange={(v) => setRange(v as any)}
            options={[
              { label: "Day", value: "day" },
              { label: "Week", value: "week" },
              { label: "Month", value: "month" },
            ]}
          />
        </Flex>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Typography.Text strong>Revenue by Time</Typography.Text>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <XAxis dataKey="label" stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <YAxis stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: token.colorText }} itemStyle={{ color: token.colorText }} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill={token.colorPrimary} radius={[6, 6, 0, 0]} />
                <Bar dataKey="collected" name="Collected" fill={token.colorInfo} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Col>
          <Col xs={24} lg={10}>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={12}>
                <Typography.Text strong>Payment Status</Typography.Text>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts?.paymentStatusDistribution ?? []} dataKey="value" nameKey="status" innerRadius={40} outerRadius={80} paddingAngle={3}>
                      {(charts?.paymentStatusDistribution ?? []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: token.colorText }} itemStyle={{ color: token.colorText }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Col>
              <Col xs={24} sm={12} lg={12}>
                <Typography.Text strong>Booking Status</Typography.Text>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={charts?.bookingStatusDistribution ?? []} dataKey="value" nameKey="status" innerRadius={40} outerRadius={80} paddingAngle={3}>
                      {(charts?.bookingStatusDistribution ?? []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[(i + 1) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: token.colorText }} itemStyle={{ color: token.colorText }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Col>
            </Row>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Typography.Text strong>Bookings</Typography.Text>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={bookingsData}>
                <XAxis dataKey="label" stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <YAxis stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: token.colorText }} itemStyle={{ color: token.colorText }} />
                <Line type="monotone" dataKey="count" name="Bookings" stroke={token.colorPrimary} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Col>
          <Col xs={24} lg={12}>
            <Typography.Text strong>Logins</Typography.Text>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={loginsData}>
                <XAxis dataKey="label" stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <YAxis stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: token.colorText }} itemStyle={{ color: token.colorText }} />
                <Line type="monotone" dataKey="count" name="Logins" stroke={token.colorError} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Auth History" variant="borderless">
            <Table
              rowKey="key"
              columns={authColumns}
              dataSource={authActivity}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Actions" variant="borderless">
            <Table
              rowKey="id"
              dataSource={(widgets?.recentActions ?? []).map((l: any) => ({ ...l, key: l.id }))}
              pagination={false}
              size="small"
              columns={[
                {
                  title: "Action",
                  dataIndex: "action",
                  key: "action",
                  render: (v: string) => <Tag>{v}</Tag>,
                },
                {
                  title: "User",
                  key: "user",
                  render: (_: any, r: any) => r.user?.email ?? r.changedBy ?? "—",
                },
                { title: "Time", dataIndex: "createdAt", key: "createdAt", render: (v: string) => new Date(v).toLocaleString() },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Activity by Action (7 days)" variant="borderless" style={{ marginTop: 16 }}>
        <Row>
          <Col xs={24} lg={14}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={charts?.activityByAction ?? []}>
                <XAxis dataKey="action" stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <YAxis stroke={token.colorTextSecondary} tick={{ fill: token.colorTextSecondary }} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: token.colorText }} itemStyle={{ color: token.colorText }} />
                <Bar dataKey="count" name="Count" fill={token.colorInfo} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
      </Card>

      <Card title="Recent Bookings" variant="borderless" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          dataSource={widgets?.recentBookings ?? []}
          pagination={false}
          size="small"
          columns={[
            { title: "Booking Ref", dataIndex: "bookingRef", key: "bookingRef" },
            { title: "Customer", dataIndex: "customerName", key: "customerName" },
            { title: "Tour", dataIndex: ["tour", "name"], key: "tour", render: (v: any) => v ?? "—" },
            {
              title: "Status",
              dataIndex: "status",
              key: "status",
              render: (v: string) => <Tag color={statusColor[v] ?? "default"}>{v}</Tag>,
            },
            { title: "Total Pax", dataIndex: "totalPax", key: "totalPax" },
          ]}
        />
      </Card>
      </>
      )}
    </div>
  );
}
