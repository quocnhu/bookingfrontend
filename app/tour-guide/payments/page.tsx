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
  message,
  theme as antdTheme,
} from "antd";
import {
  CarOutlined,
  DollarOutlined,
  ReloadOutlined,
  WalletOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
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
  items: SettlementItem[];
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
    summary: { tours: number; totalCollected: number; totalPaid: number; totalNet: number };
    lines: PaymentLine[];
  }>({ guideType: "", summary: { tours: 0, totalCollected: 0, totalPaid: 0, totalNet: 0 }, lines: [] });

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
              valueStyle={{ color: token.colorSuccess }}
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
              valueStyle={{ color: token.colorError }}
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
              valueStyle={{ color: data.summary.totalNet >= 0 ? token.colorSuccess : token.colorError, fontWeight: 700 }}
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
    </div>
  );
}
