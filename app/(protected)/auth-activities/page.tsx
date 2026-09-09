"use client";

import { useEffect, useState } from "react";
import { Card, Table, Tag, Typography, message } from "antd";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";

interface AuthActivity {
  id: string;
  eventType: string;
  authProvider: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
  user?: { id: string; email: string; name: string | null } | null;
  createdAt: string;
}

const EVENT_TYPES = ["LOGIN", "LOGIN_FAILED", "LOGOUT"];

const eventColor: Record<string, string> = {
  LOGIN: "green",
  LOGIN_FAILED: "red",
  LOGOUT: "blue",
};

export default function AuthActivitiesPage() {
  const { hasPermission } = useApp();
  const [data, setData] = useState<AuthActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const tableHeight = useFillHeight({
    rootSelector: ".auth-activities-page",
    activeTab: "",
    deps: [data.length],
  });

  useEffect(() => {
    if (!hasPermission("auth.read")) return;
    setLoading(true);
    api
      .get("/auth-activities", {
        params: { page, limit: pageSize },
      })
      .then((r) => {
        setData(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, pageSize]);

  const canRead = hasPermission("auth.read");

  const columns = centerColumns([
    indexColumn(page, pageSize),
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString(),
      filters: Array.from(new Set(data.map((r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : null).filter(Boolean))).map((d) => ({ text: d as string, value: d as string })),
      onFilter: (v: any, r: AuthActivity) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() === v : false,
    },
    {
      title: "Event",
      dataIndex: "eventType",
      key: "eventType",
      filters: EVENT_TYPES.map((t) => ({ text: t, value: t })),
      onFilter: (v, r) => r.eventType === v,
      render: (v: string) => <Tag color={eventColor[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "User",
      key: "user",
      onFilter: (v: any, r: AuthActivity) => {
        const name = r.user?.email ?? r.user?.name ?? "";
        return name.toLowerCase().includes(String(v).toLowerCase());
      },
      render: (_: any, r: AuthActivity) => r.user?.email ?? r.user?.name ?? r.userId ?? "—",
    },
    {
      title: "Provider",
      dataIndex: "authProvider",
      key: "authProvider",
      filters: [...new Set(data.map((r) => r.authProvider).filter(Boolean))].map((v) => ({
        text: v!,
        value: v!,
      })),
      onFilter: (v, r) => (r.authProvider ?? "") === v,
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : "—"),
    },
    {
      title: "IP",
      dataIndex: "ipAddress",
      key: "ipAddress",
      onFilter: (v: any, r: AuthActivity) => (r.ipAddress ?? "").toLowerCase().includes(String(v).toLowerCase()),
      render: (v: string | null) => v ?? "—",
    },
    {
      title: "User Agent",
      dataIndex: "userAgent",
      key: "userAgent",
      ellipsis: true,
      onFilter: (v: any, r: AuthActivity) => (r.userAgent ?? "").toLowerCase().includes(String(v).toLowerCase()),
      render: (v: string | null) => v ?? "—",
    },
  ]);

  return (
    <div className="auth-activities-page">
      {!canRead && (
        <Typography.Text type="secondary">You have no access to auth activity logs.</Typography.Text>
      )}
      {canRead && (
        <Card
          variant="borderless"
          title="Auth Activities"
        >
          <Table
            size="small"
            scroll={{ x: 900, y: tableHeight }}
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: PAGE_SIZE_OPTIONS,
              onChange: paginationChange(setPage, setPageSize, pageSize),
              showTotal: (t) => `Total: ${t}`,
            }}
          />
        </Card>
      )}
    </div>
  );
}
