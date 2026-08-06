"use client";

import { useEffect, useState } from "react";
import { Card, Flex, Select, Table, Tag, Typography, message } from "antd";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
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
  const [entityType, setEntityType] = useState<string | undefined>();
  const [action, setAction] = useState<string | undefined>();

  useEffect(() => {
    if (!hasPermission("audit.read")) return;
    setLoading(true);
    api
      .get("/audit-logs", {
        params: {
          page,
          limit: pageSize,
          q: search || undefined,
          entityType,
          action,
        },
      })
      .then((r) => {
        setData(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [page, pageSize, search, entityType, action]);

  const canRead = hasPermission("audit.read");

  const resetFilters = () => {
    setSearch("");
    setEntityType(undefined);
    setAction(undefined);
    setPage(1);
  };

  const columns = centerColumns([
    indexColumn<AuditLog>(page, pageSize),
    {
      title: "Time",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Entity",
      dataIndex: "entityType",
      key: "entityType",
      render: (v: string) => <Tag color="geekblue">{v}</Tag>,
    },
    { title: "Entity ID", dataIndex: "entityId", key: "entityId", render: (v: any) => v ?? "—" },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (v: string) => <Tag color="cyan">{v}</Tag>,
    },
    {
      title: "Changed by",
      dataIndex: "changedBy",
      key: "changedBy",
      render: (v: any) => v?.email ?? v ?? "—",
    },
    {
      title: "Details",
      key: "details",
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
    <div>
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
          >
            <Select
              allowClear
              size="small"
              placeholder="Entity type"
              style={{ width: 140 }}
              value={entityType}
              onChange={(v) => {
                setEntityType(v);
                setPage(1);
              }}
              options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <Select
              allowClear
              size="small"
              placeholder="Action"
              style={{ width: 120 }}
              value={action}
              onChange={(v) => {
                setAction(v);
                setPage(1);
              }}
              options={["CREATE", "UPDATE", "DELETE"].map((a) => ({ value: a, label: a }))}
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
