"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";

type ConfirmationStatus = "AWAITING" | "CONFIRMED" | "DECLINED";

interface GuideConfirmationRow {
  id: string;
  code?: string | null;
  tourName?: string | null;
  startDate: string;
  endDate: string;
  totalPax?: number | null;
  status: string;
  guide?: {
    id: string;
    name?: string | null;
    email?: string | null;
    guideProfile?: { type?: "OFFICIAL" | "FREELANCE" | null } | null;
  } | null;
  driver?: { id: string; name?: string | null } | null;
  provider?: { id: string; name: string; isCompany?: boolean } | null;
  vehicle?: { id: string; plateNumber?: string | null } | null;
  confirmationStatus: ConfirmationStatus;
  guideConfirmationRequestedAt?: string | null;
  guideConfirmationEmailSentAt?: string | null;
  guideConfirmedAt?: string | null;
  guideDeclinedAt?: string | null;
  guideDeclineReason?: string | null;
}

const STATUS_COLOR: Record<ConfirmationStatus, string> = {
  AWAITING: "orange",
  CONFIRMED: "green",
  DECLINED: "red",
};

export default function AdminGuideConfirmations() {
  const [rows, setRows] = useState<GuideConfirmationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ConfirmationStatus | undefined>("AWAITING");
  const [guideType, setGuideType] = useState<string | undefined>("FREELANCE");
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async (p = page, ps = pageSize) => {
    try {
      setLoading(true);
      const { data } = await api.get("/guide-confirmations", {
        params: {
          page: p,
          limit: ps,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(status ? { status } : {}),
          ...(guideType ? { guideType } : {}),
        },
      });
      setRows(data?.items ?? []);
      setTotal(data?.total ?? 0);
      setPage(data?.page ?? p);
      setPageSize(data?.limit ?? ps);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load guide confirmations"));
    } finally {
      setLoading(false);
    }
  }, [guideType, page, pageSize, search, status]);

  useEffect(() => {
    load(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, guideType]);

  const resend = async (row: GuideConfirmationRow) => {
    try {
      setActingId(row.id);
      await api.post(`/guide-confirmations/${row.id}/resend`);
      message.success("Confirmation reminder sent");
      load(page, pageSize);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to resend confirmation"));
    } finally {
      setActingId(null);
    }
  };

  const confirmOnBehalf = (row: GuideConfirmationRow) => {
    Modal.confirm({
      title: "Confirm on behalf of guide?",
      content: `${row.guide?.name || "Guide"} will be marked as confirmed for ${row.code || row.tourName || "this trip"}.`,
      okText: "Confirm",
      onOk: async () => {
        try {
          setActingId(row.id);
          await api.post(`/guide-confirmations/${row.id}/confirm`);
          message.success("Guide confirmed");
          load(page, pageSize);
        } catch (e) {
          message.error(getErrorMessage(e, "Failed to confirm guide"));
        } finally {
          setActingId(null);
        }
      },
    });
  };

  const decline = (row: GuideConfirmationRow) => {
    let reason = "";
    Modal.confirm({
      title: "Mark guide as unavailable?",
      content: (
        <Flex vertical gap={8}>
          <Typography.Text type="secondary">
            This blocks dispatch until the guide is changed or confirmed. Use this when the guide declined by phone/message.
          </Typography.Text>
          <Input.TextArea
            placeholder="Reason (optional)"
            autoSize={{ minRows: 2, maxRows: 4 }}
            onChange={(e) => { reason = e.target.value; }}
          />
        </Flex>
      ),
      okText: "Mark unavailable",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setActingId(row.id);
          await api.post(`/guide-confirmations/${row.id}/decline`, { reason });
          message.success("Guide marked unavailable");
          load(page, pageSize);
        } catch (e) {
          message.error(getErrorMessage(e, "Failed to update guide confirmation"));
        } finally {
          setActingId(null);
        }
      },
    });
  };

  const columns: ColumnsType<GuideConfirmationRow> = [
    {
      title: "#",
      width: 56,
      align: "center",
      render: (_, __, i) => (page - 1) * pageSize + i + 1,
    },
    {
      title: "Trip",
      key: "trip",
      width: 220,
      render: (_, r) => (
        <Flex vertical gap={0}>
          <Typography.Text strong>{r.code || "—"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.tourName || "—"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(r.startDate).format("DD MMM YYYY HH:mm")}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Guide",
      key: "guide",
      width: 220,
      render: (_, r) => (
        <Flex vertical gap={0}>
          <Space size={4} wrap>
            <Typography.Text strong>{r.guide?.name || "—"}</Typography.Text>
            <Tag color={r.guide?.guideProfile?.type === "FREELANCE" ? "volcano" : "blue"} style={{ marginInlineEnd: 0 }}>
              {r.guide?.guideProfile?.type || "GUIDE"}
            </Tag>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.guide?.email || "No email"}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Driver / Provider",
      key: "driver",
      width: 200,
      render: (_, r) => (
        <Flex vertical gap={0}>
          <Typography.Text>{r.driver?.name || "No driver"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {[r.provider?.name, r.vehicle?.plateNumber].filter(Boolean).join(" · ") || "—"}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Confirmation",
      key: "confirmation",
      width: 190,
      render: (_, r) => (
        <Flex vertical gap={2}>
          <Tag color={STATUS_COLOR[r.confirmationStatus]} style={{ width: "fit-content" }}>
            {r.confirmationStatus}
          </Tag>
          {r.guideConfirmationRequestedAt && (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              Requested {dayjs(r.guideConfirmationRequestedAt).format("DD MMM HH:mm")}
            </Typography.Text>
          )}
          {r.guideDeclineReason && (
            <Typography.Text type="danger" style={{ fontSize: 11 }}>{r.guideDeclineReason}</Typography.Text>
          )}
        </Flex>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_, r) => (
        <Space size={4} wrap>
          <Button size="small" onClick={() => resend(r)} loading={actingId === r.id}>Resend</Button>
          {r.confirmationStatus !== "CONFIRMED" && (
            <Button size="small" type="primary" ghost onClick={() => confirmOnBehalf(r)} loading={actingId === r.id}>Confirm</Button>
          )}
          {r.confirmationStatus !== "DECLINED" && (
            <Button size="small" danger onClick={() => decline(r)} loading={actingId === r.id}>Unavailable</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card styles={{ body: { padding: 16 } }}>
      <Flex gap={8} wrap style={{ marginBottom: 12 }}>
        <Input.Search
          allowClear
          placeholder="Search code, tour, guide, provider"
          style={{ width: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={() => load(1, pageSize)}
        />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
          options={[
            { value: "AWAITING", label: "Awaiting" },
            { value: "CONFIRMED", label: "Confirmed" },
            { value: "DECLINED", label: "Declined" },
          ]}
        />
        <Select
          allowClear
          placeholder="Guide type"
          style={{ width: 160 }}
          value={guideType}
          onChange={setGuideType}
          options={[
            { value: "FREELANCE", label: "Freelance" },
            { value: "OFFICIAL", label: "Company/Official" },
          ]}
        />
        <Button onClick={() => load(1, pageSize)}>Filter</Button>
      </Flex>

      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1100 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50],
          onChange: (p, ps) => load(p, ps),
          showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} guide confirmations`,
        }}
      />
    </Card>
  );
}
