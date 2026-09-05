"use client";

import { useEffect, useState } from "react";
import { Card, Flex, Table, Tag, Typography, message } from "antd";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";
import FilterBar from "@/components/filter-bar";

interface AuditLog {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  before?: any;
  after?: any;
  metadata?: any;
  changedBy?: any;
  createdAt: string;
}

const ENTITY_TYPES = ["Booking", "Assignment", "Settlement", "Tour", "User", "Role"];

export default function AuditPage() {
  const { hasPermission } = useApp();
  const [data, setData] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const tableHeight = useFillHeight({
    rootSelector: ".audit-page",
    activeTab: "",
    deps: [data.length],
  });

  useEffect(() => {
    if (!hasPermission("audit.read")) return;
    setLoading(true);
    api
      .get("/audit-logs", {
        params: {
          page,
          limit: pageSize,
          q: search || undefined,
        },
      })
      .then((r) => {
        setData(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, pageSize, search]);

  const canRead = hasPermission("audit.read");

  const resetFilters = () => {
    setSearch("");
    setPage(1);
  };

  const columns = centerColumns([
    indexColumn<AuditLog>(page, pageSize),
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString(),
      filters: Array.from(new Set(data.map((r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : null).filter(Boolean))).map((d) => ({ text: d as string, value: d as string })),
      onFilter: (v: any, r: AuditLog) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() === v : false,
    },
    {
      title: "Entity",
      dataIndex: "entityType",
      key: "entityType",
      filters: ENTITY_TYPES.map((t) => ({ text: t, value: t })),
      onFilter: (v: any, r: AuditLog) => r.entityType === v,
      render: (v: string) => <Tag color="geekblue">{v}</Tag>,
    },
    {
      title: "Entity ID",
      dataIndex: "entityId",
      key: "entityId",
      onFilter: (v: any, r: AuditLog) => (r.entityId ?? "").toLowerCase().includes(String(v).toLowerCase()),
      render: (v: any) => v ?? "—",
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      filters: ["CREATE", "UPDATE", "DELETE"].map((a) => ({ text: a, value: a })),
      onFilter: (v: any, r: AuditLog) => r.action === v,
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: "Changed by",
      dataIndex: "changedBy",
      key: "changedBy",
      onFilter: (v: any, r: AuditLog) => {
        const email = r.changedBy?.email ?? "";
        return email.toLowerCase().includes(String(v).toLowerCase());
      },
      render: (v: any) => v?.email ?? v ?? "—",
    },
    {
      title: "Details",
      key: "details",
      onFilter: (v: any, r: AuditLog) => {
        const s = JSON.stringify(r.after ?? r.before ?? "").toLowerCase();
        return s.includes(String(v).toLowerCase());
      },
      render: (_: any, r: AuditLog) => {
        const parts = [
          r.after ? { label: "after", value: r.after } : null,
          r.before ? { label: "before", value: r.before } : null,
        ].filter(Boolean);
        return parts.map((p: any, i) => (
          <Typography.Text
            key={i}
            code
            type="secondary"
            style={{
              display: "block",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              fontSize: 11,
            }}
          >
            {p.label}: {JSON.stringify(p.value)}
          </Typography.Text>
        ));
      },
    },
  ]);

  return (
    <div className="audit-page">
      {!canRead && (
        <Typography.Text type="secondary">You have no access to audit logs.</Typography.Text>
      )}
      {canRead && (
      <Card
        variant="borderless"
        title="Audit Logs"
        extra={
          <FilterBar
            onSearch={(v) => {
              setSearch(v.trim());
              setPage(1);
            }}
            onReset={resetFilters}
            searchPlaceholder="Search entity, id, action..."
          />
        }
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
