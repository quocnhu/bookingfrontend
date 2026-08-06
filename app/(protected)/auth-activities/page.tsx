"use client";

import { useEffect, useState } from "react";
import { Card, Flex, Select, Table, Tag, Typography, message } from "antd";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import FilterBar from "@/components/filter-bar";

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
  const [search, setSearch] = useState("");
  const [eventType, setEventType] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!hasPermission("auth.read")) return;
    setLoading(true);
    api
      .get("/auth-activities", {
        params: { page, limit: pageSize, q: search || undefined, eventType },
      })
      .then((r) => {
        setData(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, pageSize, search, eventType]);

  const canRead = hasPermission("auth.read");

  const resetFilters = () => {
    setSearch("");
    setEventType(undefined);
    setPage(1);
  };

  const columns = centerColumns([
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Event",
      dataIndex: "eventType",
      key: "eventType",
      render: (v: string) => <Tag color={eventColor[v] ?? "default"}>{v}</Tag>,
    },
    {
      title: "User",
      key: "user",
      render: (_: any, r: AuthActivity) => r.user?.email ?? r.user?.name ?? r.userId ?? "—",
    },
    {
      title: "Provider",
      dataIndex: "authProvider",
      key: "authProvider",
      render: (v: string | null) => (v ? <Tag>{v}</Tag> : "—"),
    },
    { title: "IP", dataIndex: "ipAddress", key: "ipAddress", render: (v: string | null) => v ?? "—" },
    {
      title: "User Agent",
      dataIndex: "userAgent",
      key: "userAgent",
      ellipsis: true,
      render: (v: string | null) => v ?? "—",
    },
  ]);

  return (
    <div>
      {!canRead && (
        <Typography.Text type="secondary">You have no access to auth activity logs.</Typography.Text>
      )}
      {canRead && (
        <Card
          variant="borderless"
          title="Auth Activities"
          extra={
            <FilterBar
              onSearch={(v) => {
                setSearch(v.trim());
                setPage(1);
              }}
              onReset={resetFilters}
              searchPlaceholder="Search event, IP, user..."
            >
              <Select
                allowClear
                size="small"
                placeholder="Event type"
                style={{ width: 140 }}
                value={eventType}
                onChange={(v) => {
                  setEventType(v);
                  setPage(1);
                }}
                options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </FilterBar>
          }
        >
          <Table
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
