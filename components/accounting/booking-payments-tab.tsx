"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Flex,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";

type BookingPaymentRecord = {
  id: string;
  method?: string | null;
  payerType?: string | null;
  status?: string | null;
  provider?: string | null;
  providerOrderId?: string | null;
  providerCaptureId?: string | null;
  amount?: string | number | null;
  currency?: string | null;
  providerAmount?: string | number | null;
  providerCurrency?: string | null;
  paidAt?: string | null;
  note?: string | null;
  createdAt?: string | null;
};

type BookingPaymentRow = {
  id: string;
  bookingRef?: string | null;
  confirmationCode?: string | null;
  customerName?: string | null;
  mail?: string | null;
  phone?: string | null;
  channel?: string | null;
  status?: string | null;
  payment?: string | null;
  paymentMethod?: string | null;
  payLater?: boolean | null;
  paymentDueAt?: string | null;
  paymentCollectedAt?: string | null;
  paymentCollectedByName?: string | null;
  paymentConfirmedAt?: string | null;
  paymentConfirmedByName?: string | null;
  paymentNote?: string | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  totalPax?: number | null;
  startingDate?: string | null;
  createdAt?: string | null;
  tour?: { id: string; name: string; type?: string | null } | null;
  customerUser?: { id: string; name?: string | null; email?: string | null } | null;
  payments?: BookingPaymentRecord[];
};

const PAYMENT_COLORS: Record<string, string> = {
  PENDING: "orange",
  PAID: "green",
  REFUNDED: "purple",
  FAILED: "red",
};

const vnd = (value: string | number | null | undefined) =>
  `${Number(value ?? 0).toLocaleString("vi-VN", {
    maximumFractionDigits: 0,
  })} ₫`;

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

export default function BookingPaymentsTab() {
  const [rows, setRows] = useState<BookingPaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState({ current: 1, pageSize: 10 });
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<string | undefined>();
  const [channel, setChannel] = useState<string | undefined>("WEBSITE");
  const [selected, setSelected] = useState<BookingPaymentRow | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/payments/bookings", {
        params: {
          page: page.current,
          limit: page.pageSize,
          payment,
          channel,
          search: search.trim() || undefined,
        },
      });
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load booking payments"));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.current, page.pageSize, payment, channel, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const openRow = async (row: BookingPaymentRow) => {
    try {
      const { data } = await api.get(`/bookings/${row.id}`);
      setSelected(data);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load the booking payment"));
    }
  };

  const syncPayPal = async () => {
    if (!selected) return;
    const latest = (selected.payments ?? []).find(
      (p) => p.provider === "PAYPAL" && p.providerOrderId,
    );
    if (!latest?.providerOrderId) {
      message.warning("No PayPal order is attached to this booking");
      return;
    }
    setSyncing(true);
    try {
      await api.post("/payments/paypal/capture", {
        bookingId: selected.id,
        orderId: latest.providerOrderId,
      });
      message.success("PayPal payment checked and captured");
      await openRow(selected);
      load();
    } catch (e) {
      message.error(
        getErrorMessage(
          e,
          "PayPal is not approved/captured yet. Ask the customer to complete the payment.",
        ),
      );
    } finally {
      setSyncing(false);
    }
  };

  const latestPayPal = (row: BookingPaymentRow) =>
    (row.payments ?? []).find((p) => p.provider === "PAYPAL") ?? null;

  return (
    <Card
      size="small"
      styles={{ body: { padding: 16 } }}
      style={{ borderRadius: 12 }}
    >
      <Row gutter={[8, 8]} align="middle" style={{ marginBottom: 12 }}>
        <Col xs={24} md={12}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search booking ref, customer, email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage((p) => ({ ...p, current: 1 }));
            }}
          />
        </Col>
        <Col xs={12} md={6}>
          <Select
            allowClear
            placeholder="Payment status"
            value={payment}
            onChange={(v) => {
              setPayment(v);
              setPage((p) => ({ ...p, current: 1 }));
            }}
            style={{ width: "100%" }}
            options={["PENDING", "PAID", "REFUNDED"].map((v) => ({
              value: v,
              label: v,
            }))}
          />
        </Col>
        <Col xs={12} md={6}>
          <Select
            allowClear
            placeholder="Channel"
            value={channel}
            onChange={(v) => {
              setChannel(v);
              setPage((p) => ({ ...p, current: 1 }));
            }}
            style={{ width: "100%" }}
            options={[
              { value: "WEBSITE", label: "Website" },
              { value: "MANUAL", label: "Manual" },
              { value: "OTA", label: "OTA" },
            ]}
          />
        </Col>
      </Row>

      <Table<BookingPaymentRow>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        scroll={{ x: 900 }}
        pagination={{
          current: page.current,
          pageSize: page.pageSize,
          total,
          showSizeChanger: false,
          onChange: (current, pageSize) => setPage({ current, pageSize }),
        }}
        locale={{ emptyText: "No booking payments found" }}
        columns={[
          {
            title: "Booking",
            align: "center",
            render: (_: unknown, r) => (
              <>
                <Typography.Text strong>
                  {r.bookingRef ?? "—"}
                </Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {fmtDate(r.createdAt)}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "Customer",
            align: "center",
            render: (_: unknown, r) => (
              <>
                {r.customerName ?? "—"}
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {r.mail ?? "—"}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "Tour",
            align: "center",
            render: (_: unknown, r) => (
              <>
                {r.tour?.name ?? "—"}
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {r.totalPax ?? 0} pax · {r.startingDate ?? "—"}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "Total",
            align: "center",
            render: (_: unknown, r) =>
              r.totalAmount != null
                ? `${vnd(r.totalAmount)} ${r.currency ?? ""}`
                : "—",
          },
          {
            title: "Payment",
            align: "center",
            render: (_: unknown, r) => (
              <>
                <Tag color={PAYMENT_COLORS[r.payment ?? ""] ?? "default"}>
                  {r.payment ?? "—"}
                </Tag>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {r.paymentMethod ?? (r.payLater ? "Pay later" : "—")}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "PayPal",
            align: "center",
            render: (_: unknown, r) => {
              const p = latestPayPal(r);
              if (!p) return <Tag>No record</Tag>;
              return (
                <>
                  <Tag color={PAYMENT_COLORS[p.status ?? ""] ?? "default"}>
                    {p.status ?? "—"}
                  </Tag>
                  <br />
                  <Typography.Text
                    type="secondary"
                    style={{ fontSize: 10 }}
                    copyable={!!p.providerOrderId}
                  >
                    {(p.providerOrderId ?? "").slice(0, 16) || "—"}
                  </Typography.Text>
                </>
              );
            },
          },
          {
            title: "",
            align: "center",
            render: (_: unknown, r) => (
              <Button size="small" onClick={() => openRow(r)}>
                View
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        size={620}
        title={`Booking payment · ${selected?.bookingRef ?? ""}`}
      >
        {selected && (
          <Flex vertical gap={16}>
            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                {
                  key: "customer",
                  label: "Customer",
                  children: selected.customerName ?? "—",
                },
                { key: "mail", label: "Email", children: selected.mail ?? "—" },
                { key: "phone", label: "Phone", children: selected.phone ?? "—" },
                {
                  key: "tour",
                  label: "Tour",
                  children: selected.tour?.name ?? "—",
                },
                {
                  key: "pax",
                  label: "Pax",
                  children: `${selected.totalPax ?? 0}`,
                },
                {
                  key: "channel",
                  label: "Channel",
                  children: selected.channel ?? "—",
                },
                {
                  key: "total",
                  label: "Total",
                  children:
                    selected.totalAmount != null
                      ? `${vnd(selected.totalAmount)} ${selected.currency ?? ""}`
                      : "—",
                },
                {
                  key: "payment",
                  label: "Payment",
                  children: selected.payment ?? "—",
                },
                {
                  key: "method",
                  label: "Method",
                  children:
                    selected.paymentMethod ??
                    (selected.payLater ? "Pay later" : "—"),
                },
                {
                  key: "payLater",
                  label: "Pay later",
                  children: selected.payLater ? "Yes" : "No",
                },
                {
                  key: "due",
                  label: "Due",
                  children: fmtDate(selected.paymentDueAt),
                },
                {
                  key: "collected",
                  label: "Collected",
                  children: selected.paymentCollectedAt
                    ? `${fmtDate(selected.paymentCollectedAt)}${selected.paymentCollectedByName ? ` · ${selected.paymentCollectedByName}` : ""}`
                    : "—",
                },
                {
                  key: "confirmed",
                  label: "Confirmed",
                  children: selected.paymentConfirmedAt
                    ? `${fmtDate(selected.paymentConfirmedAt)}${selected.paymentConfirmedByName ? ` · ${selected.paymentConfirmedByName}` : ""}`
                    : "—",
                },
                {
                  key: "note",
                  label: "Note",
                  children: selected.paymentNote ?? "—",
                  span: 2,
                },
              ]}
            />

            {selected.payLater && selected.payment === "PENDING" && (
              <Alert
                type="warning"
                showIcon
                message="Pay-later booking"
                description="Use the Bookings page to record the collection, then confirm it in Accounting."
              />
            )}

            <Card
              size="small"
              title="Payment records"
              extra={
                <Space>
                  <Button size="small" icon={<ReloadOutlined />} onClick={load}>
                    Refresh
                  </Button>
                  {latestPayPal(selected)?.providerOrderId &&
                    selected.payment !== "PAID" && (
                      <Button
                        size="small"
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        loading={syncing}
                        onClick={syncPayPal}
                      >
                        Check & capture PayPal
                      </Button>
                    )}
                </Space>
              }
            >
              <Table<BookingPaymentRecord>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={selected.payments ?? []}
                locale={{ emptyText: "No payment records" }}
                columns={[
                  {
                    title: "Method",
                    render: (_: unknown, p) =>
                      `${p.method ?? "—"} · ${p.provider ?? "internal"}`,
                  },
                  {
                    title: "Status",
                    align: "center",
                    render: (_: unknown, p) => (
                      <Tag color={PAYMENT_COLORS[p.status ?? ""] ?? "default"}>
                        {p.status ?? "—"}
                      </Tag>
                    ),
                  },
                  {
                    title: "Amount",
                    align: "right",
                    render: (_: unknown, p) =>
                      `${vnd(p.amount)} ${p.currency ?? ""}`,
                  },
                  {
                    title: "PayPal order",
                    render: (_: unknown, p) => (
                      <Typography.Text
                        style={{ fontSize: 11 }}
                        copyable={!!p.providerOrderId}
                      >
                        {p.providerOrderId ?? "—"}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: "Capture",
                    render: (_: unknown, p) => (
                      <Typography.Text
                        style={{ fontSize: 11 }}
                        copyable={!!p.providerCaptureId}
                      >
                        {p.providerCaptureId ?? "—"}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: "Paid at",
                    render: (_: unknown, p) => fmtDate(p.paidAt),
                  },
                ]}
              />
            </Card>
          </Flex>
        )}
      </Drawer>
    </Card>
  );
}
