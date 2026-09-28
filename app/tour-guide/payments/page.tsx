"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Row,
  Statistic,
  Table,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  CarOutlined,
  DollarOutlined,
  ReloadOutlined,
  WalletOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import dayjs, { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

interface SettlementItem {
  id: string;
  category: string;
  flowType: string;
  amount: number;
  note?: string | null;
}

interface PaymentLine {
  id: string;
  code?: string | null;
  tourName?: string | null;
  vehiclePlate?: string | null;
  startDate: string;
  endDate: string;
  collected: number;
  paid: number;
  net: number;
  isPaid: boolean;
  paidAt?: string | null;
  items: SettlementItem[];
}

interface PaymentPeriod {
  id: string;
  fromDate: string;
  toDate: string;
  tourCount: number;
  guideReturnsToCompany: number;
  companyReturnsToGuide: number;
  totalNet: number;
  note?: string | null;
  createdByName?: string | null;
  createdAt: string;
}

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function TourGuidePaymentsPage() {
  const { user } = useApp();
  const { token } = antdTheme.useToken();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("year"),
    dayjs().endOf("year"),
  ]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    guideType: string;
    summary: {
      tours: number;
      totalCollected: number;
      totalPaid: number;
      totalNet: number;
      paidNet: number;
      unpaidNet: number;
      lastPaidAt?: string | null;
    };
    periods: PaymentPeriod[];
    lines: PaymentLine[];
  }>({
    guideType: "",
    summary: {
      tours: 0,
      totalCollected: 0,
      totalPaid: 0,
      totalNet: 0,
      paidNet: 0,
      unpaidNet: 0,
      lastPaidAt: null,
    },
    periods: [],
    lines: [],
  });

  const load = async (start?: Dayjs, end?: Dayjs) => {
    setLoading(true);
    const s = (start ?? range[0]).format("YYYY-MM-DD");
    const e = (end ?? range[1]).format("YYYY-MM-DD");
    try {
      const r = await api.get("/assignments/my-payments", {
        params: { startDate: s, endDate: e },
      });
      setData(r.data);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load payments"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isOfficial = data.guideType === "OFFICIAL";

  const columns = [
    {
      title: "Tour",
      key: "tour",
      render: (_: any, r: PaymentLine) => (
        <Typography.Text strong>{r.tourName ?? r.code ?? "—"}</Typography.Text>
      ),
    },
    { title: "Vehicle", dataIndex: "vehiclePlate", key: "vehicle", render: (v: string | null) => v ?? "—" },
    {
      title: "Dates",
      key: "dates",
      render: (_: any, r: PaymentLine) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {dayjs(r.endDate).format("DD/MM/YYYY")}
        </span>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: any, r: PaymentLine) =>
        r.isPaid ? (
          <Tag color="green">
            Paid{r.paidAt ? ` · ${dayjs(r.paidAt).format("DD/MM/YYYY")}` : ""}
          </Tag>
        ) : (
          <Tag color="orange">Unpaid</Tag>
        ),
    },
    {
      title: "Collected",
      dataIndex: "collected",
      key: "collected",
      align: "right" as const,
      render: (v: number) => <span style={{ color: token.colorSuccess, fontWeight: 600 }}>{money(v)}</span>,
    },
    {
      title: "Paid",
      dataIndex: "paid",
      key: "paid",
      align: "right" as const,
      render: (v: number) => <span style={{ color: token.colorError, fontWeight: 600 }}>{money(v)}</span>,
    },
    {
      title: "Net",
      dataIndex: "net",
      key: "net",
      align: "right" as const,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? token.colorSuccess : token.colorError, fontWeight: 700 }}>
          {money(v)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <WalletOutlined /> Payments
        </Typography.Title>
        <Flex gap={8} align="center" wrap>
          <RangePicker
            allowClear={false}
            value={range}
            onChange={(v) => {
              if (v && v[0] && v[1]) setRange([v[0], v[1]]);
            }}
          />
          <Button type="primary" icon={<DollarOutlined />} loading={loading} onClick={() => load()}>
            Apply
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => load()} loading={loading} />
        </Flex>
      </Flex>

      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        {isOfficial
          ? "You are an official guide — the net amount below is what you return to the company for this period."
          : "You are a freelance guide — the net amount below is what you collect for this period."}
      </Typography.Text>

      {data.summary.lastPaidAt && (
        <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          <Tag color="green" style={{ marginInlineEnd: 8 }}>
            Marked paid up to {dayjs(data.summary.lastPaidAt).format("DD/MM/YYYY")}
          </Tag>
          This is accounting's watermark — earlier periods are settled, so only the unpaid lines below are pending.
        </Typography.Text>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={12} lg={6}>
          <Card variant="borderless">
            <Statistic title="Tours" value={data.summary.tours} prefix={<CarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Collected"
              value={data.summary.totalCollected}
              prefix={<ArrowUpOutlined />}
              styles={{ content: { color: token.colorSuccess } }}
              formatter={(v) => money(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Paid (expenses)"
              value={data.summary.totalPaid}
              prefix={<ArrowDownOutlined />}
              styles={{ content: { color: token.colorError } }}
              formatter={(v) => money(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card
            variant="borderless"
            style={{ border: `1px solid ${data.summary.totalNet >= 0 ? token.colorSuccess : token.colorError}` }}
          >
            <Statistic
              title={isOfficial ? "To return to company" : "Money to collect"}
              value={data.summary.totalNet}
              styles={{ content: { color: data.summary.totalNet >= 0 ? token.colorSuccess : token.colorError, fontWeight: 700 } }}
              formatter={(v) => money(Number(v))}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={12} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Marked paid (net)"
              value={data.summary.paidNet}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: token.colorSuccess } }}
              formatter={(v) => money(Number(v))}
            />
          </Card>
        </Col>
        <Col xs={12} lg={6}>
          <Card
            variant="borderless"
            style={{ border: `1px solid ${data.summary.unpaidNet ? token.colorWarning : token.colorSuccess}` }}
          >
            <Statistic
              title="Pending — unpaid"
              value={data.summary.unpaidNet}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: data.summary.unpaidNet ? token.colorWarning : token.colorSuccess, fontWeight: 700 } }}
              formatter={(v) => money(Number(v))}
            />
          </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ marginTop: 16 }}>
        <Table<PaymentLine>
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={data.lines}
          pagination={false}
          expandable={{
            expandedRowRender: (r) =>
              r.items.length === 0 ? (
                <Typography.Text type="secondary">No settlement items recorded.</Typography.Text>
              ) : (
                <Table<SettlementItem>
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={r.items}
                  columns={[
                    { title: "Category", dataIndex: "category", key: "category" },
                    {
                      title: "Type",
                      dataIndex: "flowType",
                      key: "flowType",
                      width: 180,
                      render: (f: string) => (
                        <Tag color={f === "COLLECT_MONEY" ? "green" : "red"}>{f}</Tag>
                      ),
                    },
                    {
                      title: "Amount",
                      dataIndex: "amount",
                      key: "amount",
                      align: "right" as const,
                      render: (v: number) => money(v),
                    },
                    { title: "Note", dataIndex: "note", key: "note", render: (v: string | null) => v ?? "—" },
                  ]}
                />
              ),
          }}
        />
      </Card>

      <Card
        variant="borderless"
        title={`Paid periods (${data.periods.length})`}
        style={{ marginTop: 16 }}
      >
        {data.periods.length === 0 ? (
          <Typography.Text type="secondary">
            No payment period has been exported for you yet. Once accounting marks a range as paid,
            it will appear here so you can confirm you won't be settled twice.
          </Typography.Text>
        ) : (
          <Table<PaymentPeriod>
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={data.periods}
            columns={[
              {
                title: "Period",
                key: "period",
                render: (_: any, p: PaymentPeriod) => (
                  <span style={{ whiteSpace: "nowrap" }}>
                    {dayjs(p.fromDate).format("DD/MM/YYYY")} — {dayjs(p.toDate).format("DD/MM/YYYY")}
                  </span>
                ),
              },
              { title: "Tours", dataIndex: "tourCount", key: "tours", width: 90 },
              {
                title: "Net",
                dataIndex: "totalNet",
                key: "net",
                align: "right" as const,
                render: (v: number) => (
                  <span style={{ color: v >= 0 ? token.colorSuccess : token.colorError, fontWeight: 700 }}>
                    {money(v)}
                  </span>
                ),
              },
              {
                title: "Marked by",
                key: "by",
                render: (_: any, p: PaymentPeriod) => (
                  <span style={{ fontSize: 12 }}>
                    {p.createdByName ?? "—"}
                    <Typography.Text type="secondary" style={{ display: "block", fontSize: 11 }}>
                      {dayjs(p.createdAt).format("DD/MM/YYYY HH:mm")}
                    </Typography.Text>
                  </span>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
