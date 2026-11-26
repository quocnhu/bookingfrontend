"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Flex,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";

type HotelCommissionRow = {
  id: string;
  bookingRef: string;
  customerName?: string | null;
  hotelId: string;
  hotelName: string;
  startingDate?: string | null;
  totalPax?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  payment?: string | null;
  status?: string | null;
  assignmentStatus?: string | null;
  tourName?: string | null;
  commissionPercent: number;
  commissionAmount: number;
  commissionEarned: boolean;
  commissionPaid: boolean;
  payoutId?: string | null;
  paidAt?: string | null;
  paidByName?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  payoutNote?: string | null;
};

const vnd = (value?: number | null) =>
  `${Number(value ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} ₫`;

export default function HotelCommissionsTab() {
  const { modal, message } = App.useApp();
  const [rows, setRows] = useState<HotelCommissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hotelId, setHotelId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>("UNPAID");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/accounting/hotel-commissions", {
        params: hotelId ? { hotelId } : {},
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load hotel commissions"));
    } finally {
      setLoading(false);
    }
  }, [hotelId, message]);

  useEffect(() => {
    load();
  }, [load]);

  const hotels = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.hotelId) map.set(row.hotelId, row.hotelName);
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (status === "UNPAID" && !(row.commissionEarned && !row.commissionPaid)) return false;
      if (status === "PAID" && !row.commissionPaid) return false;
      if (status === "EARNED" && !row.commissionEarned) return false;
      if (status === "PENDING" && row.commissionEarned) return false;
      if (!q) return true;
      return [row.bookingRef, row.customerName, row.hotelName, row.tourName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [rows, search, status]);

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, row) => {
        if (row.commissionEarned && !row.commissionPaid) acc.unpaid += row.commissionAmount;
        if (row.commissionPaid) acc.paid += row.commissionAmount;
        if (!row.commissionEarned) acc.pending += row.commissionAmount;
        return acc;
      },
      { unpaid: 0, paid: 0, pending: 0 },
    );
  }, [filtered]);

  const markPaid = (row: HotelCommissionRow) => {
    let reference = "";
    let note = "";
    modal.confirm({
      title: `Mark hotel commission as paid?`,
      content: (
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Typography.Text>
            {row.hotelName} · {row.bookingRef} · {vnd(row.commissionAmount)}
          </Typography.Text>
          <Input
            placeholder="Payment reference (optional)"
            onChange={(e) => {
              reference = e.target.value;
            }}
          />
          <Input.TextArea
            rows={2}
            placeholder="Note (optional)"
            onChange={(e) => {
              note = e.target.value;
            }}
          />
        </Space>
      ),
      okText: "Mark paid",
      onOk: async () => {
        try {
          await api.post(`/accounting/hotel-commissions/${row.id}/mark-paid`, {
            method: "BANK_TRANSFER",
            reference: reference.trim() || undefined,
            note: note.trim() || undefined,
          });
          message.success("Hotel commission marked as paid");
          load();
        } catch (e) {
          message.error(getErrorMessage(e, "Could not mark hotel commission as paid"));
          throw e;
        }
      },
    });
  };

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Flex gap={8} wrap>
        <Card size="small"><Typography.Text type="secondary">Earned unpaid</Typography.Text><div><Typography.Text strong>{vnd(summary.unpaid)}</Typography.Text></div></Card>
        <Card size="small"><Typography.Text type="secondary">Paid to hotels</Typography.Text><div><Typography.Text strong style={{ color: "#389e0d" }}>{vnd(summary.paid)}</Typography.Text></div></Card>
        <Card size="small"><Typography.Text type="secondary">Pending eligibility</Typography.Text><div><Typography.Text strong>{vnd(summary.pending)}</Typography.Text></div></Card>
      </Flex>

      <Card size="small">
        <Flex gap={8} wrap align="center" justify="space-between">
          <Space wrap>
            <Input
              allowClear
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search booking, hotel, tour, customer"
              prefix={<SearchOutlined />}
              style={{ width: 280 }}
            />
            <Select
              allowClear
              value={hotelId}
              onChange={setHotelId}
              placeholder="All hotels"
              style={{ width: 220 }}
              options={hotels}
            />
            <Select
              value={status}
              onChange={setStatus}
              style={{ width: 190 }}
              options={[
                { value: "UNPAID", label: "Earned - unpaid" },
                { value: "PAID", label: "Paid" },
                { value: "PENDING", label: "Pending eligibility" },
                { value: "EARNED", label: "All earned" },
                { value: undefined, label: "All bookings" },
              ]}
            />
          </Space>
          <Typography.Text type="secondary">{filtered.length} booking(s)</Typography.Text>
        </Flex>
      </Card>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<HotelCommissionRow>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: "max-content" }}
          columns={[
            {
              title: "Booking",
              render: (_, row) => (
                <Flex vertical gap={0}>
                  <Typography.Text strong>{row.bookingRef}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.customerName || "—"}
                  </Typography.Text>
                </Flex>
              ),
            },
            { title: "Hotel", dataIndex: "hotelName" },
            { title: "Tour", dataIndex: "tourName", render: (v) => v || "—" },
            {
              title: "Date",
              dataIndex: "startingDate",
              render: (v) => (v ? dayjs(v).format("DD/MM/YYYY") : "—"),
            },
            {
              title: "Booking value",
              dataIndex: "totalAmount",
              align: "right",
              render: (v) => vnd(v),
            },
            {
              title: "Commission",
              align: "right",
              render: (_, row) => (
                <Flex vertical align="end">
                  <Typography.Text strong>{vnd(row.commissionAmount)}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {row.commissionPercent}%
                  </Typography.Text>
                </Flex>
              ),
            },
            {
              title: "Eligibility",
              render: (_, row) =>
                row.commissionEarned ? (
                  <Tag color="blue">Earned</Tag>
                ) : (
                  <Tag>Pending</Tag>
                ),
            },
            {
              title: "Payout",
              render: (_, row) => {
                if (!row.commissionEarned) return <Tag>Not earned</Tag>;
                if (row.commissionPaid) {
                  return (
                    <Flex vertical gap={2}>
                      <Tag color="green" style={{ margin: 0 }}>Paid</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {row.paidAt ? dayjs(row.paidAt).format("DD/MM/YYYY HH:mm") : ""}
                        {row.paymentReference ? ` · ${row.paymentReference}` : ""}
                      </Typography.Text>
                    </Flex>
                  );
                }
                return <Tag color="gold">Unpaid</Tag>;
              },
            },
            {
              title: "Action",
              align: "right",
              render: (_, row) =>
                row.commissionEarned && !row.commissionPaid ? (
                  <Button type="primary" size="small" onClick={() => markPaid(row)}>
                    Mark paid
                  </Button>
                ) : null,
            },
          ]}
        />
      </Card>
    </Space>
  );
}