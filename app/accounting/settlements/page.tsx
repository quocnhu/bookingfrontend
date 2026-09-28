"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Flex,
  Popconfirm,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExportOutlined,
  ReloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import dayjs, { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

const money = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

interface GuideOption {
  id: string;
  name: string;
  email?: string;
  type?: string;
  isBusy?: boolean;
}

interface Period {
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

interface SummaryLine {
  id: string;
  code?: string;
  tourName?: string;
  vehiclePlate?: string;
  endDate: string;
  netAmount: number;
  settlementFlow?: string | null;
  isPaid: boolean;
  guidePaidAt?: string | null;
}

export default function AccountingSettlementsPage() {
  const { token } = antdTheme.useToken();
  const [guides, setGuides] = useState<GuideOption[]>([]);
  const [guideId, setGuideId] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [lines, setLines] = useState<SummaryLine[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loadingGuides, setLoadingGuides] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exporting, setExporting] = useState(false);

  const guide = guides.find((g) => g.id === guideId);

  const watermark = useMemo(
    () => (periods.length ? dayjs(Math.max(...periods.map((p) => +dayjs(p.toDate)))) : null),
    [periods],
  );

  const loadGuides = async () => {
    setLoadingGuides(true);
    try {
      const r = await api.get("/assignments/board/crew");
      setGuides(r.data?.guides ?? []);
    } catch {
      setGuides([]);
    } finally {
      setLoadingGuides(false);
    }
  };

  const loadPeriods = async (gid: string) => {
    try {
      const r = await api.get("/assignments/settlement/guide-payments", {
        params: { guideId: gid },
      });
      setPeriods(r.data ?? []);
    } catch {
      setPeriods([]);
    }
  };

  useEffect(() => {
    loadGuides();
  }, []);

  const onGuideChange = (gid: string) => {
    setGuideId(gid);
    setSummary(null);
    setLines([]);
    loadPeriods(gid);
    setRange([
      dayjs().startOf("year"),
      dayjs().endOf("day"),
    ]);
  };

  // After periods load, nudge the default range to start right after the paid watermark.
  useEffect(() => {
    if (guideId && watermark && range) {
      const nextFrom = watermark.add(1, "day");
      if (nextFrom.isAfter(range[0])) {
        setRange([nextFrom, range[1]]);
      }
    }
  }, [guideId, watermark]);

  const preview = async (unpaidOnly = false) => {
    if (!guideId || !range || !range[0] || !range[1]) {
      message.warning("Select a guide and a date range first");
      return;
    }
    setLoadingSummary(true);
    try {
      const r = await api.get("/assignments/settlement-summary", {
        params: {
          guideId,
          from: range[0].format("YYYY-MM-DD"),
          to: range[1].format("YYYY-MM-DD"),
          unpaidOnly: unpaidOnly || undefined,
        },
      });
      setSummary(r.data);
      setLines(r.data?.lines ?? []);
      if (r.data?.guidePayments?.periods) {
        setPeriods(r.data.guidePayments.periods);
      }
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load settlement preview"));
    } finally {
      setLoadingSummary(false);
    }
  };

  const doExport = async () => {
    if (!guideId || !range || !range[0] || !range[1]) return;
    setExporting(true);
    try {
      const r = await api.post("/assignments/settlement/export", {
        guideId,
        fromDate: range[0].format("YYYY-MM-DD"),
        toDate: range[1].format("YYYY-MM-DD"),
      });
      message.success(
        `Marked ${r.data.exportedCount} tour(s) as paid for ${guide?.name ?? "this guide"}`,
      );
      await Promise.all([loadPeriods(guideId), preview(false)]);
    } catch (e) {
      message.error(getErrorMessage(e, "Export failed"));
    } finally {
      setExporting(false);
    }
  };

  const paidCount = lines.filter((l) => l.isPaid).length;
  const unpaid = lines.filter((l) => !l.isPaid);
  const unpaidTotal = unpaid.reduce((s, l) => s + l.netAmount, 0);

  const columns = [
    {
      title: "Tour",
      key: "tour",
      render: (_: any, r: SummaryLine) => (
        <Typography.Text strong>{r.tourName ?? r.code ?? "—"}</Typography.Text>
      ),
    },
    { title: "Vehicle", dataIndex: "vehiclePlate", key: "vehicle", render: (v: string | null) => v ?? "—" },
    {
      title: "End date",
      dataIndex: "endDate",
      key: "endDate",
      render: (v: string) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: "Net",
      dataIndex: "netAmount",
      key: "net",
      align: "right" as const,
      render: (v: number, r: SummaryLine) => (
        <span
          style={{
            color: r.settlementFlow === "PAY_MONEY" ? token.colorError : token.colorSuccess,
            fontWeight: 700,
          }}
        >
          {money(v)}
        </span>
      ),
    },
    {
      title: "Flow",
      dataIndex: "settlementFlow",
      key: "flow",
      render: (f: string | null) =>
        f ? (
          <Tag color={f === "PAY_MONEY" ? "red" : "green"}>
            {f === "PAY_MONEY" ? "Co. → Guide" : "Guide → Co."}
          </Tag>
        ) : (
          "—"
        ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: any, r: SummaryLine) =>
        r.isPaid ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            Paid {r.guidePaidAt ? dayjs(r.guidePaidAt).format("DD/MM/YYYY") : ""}
          </Tag>
        ) : (
          <Tag color="orange" icon={<ClockCircleOutlined />}>
            Unpaid
          </Tag>
        ),
    },
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <DollarOutlined /> Guide Settlements — Handle Payment
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Export a payment period for a tour guide. It marks every settled tour in the range as
            paid, so next time you continue from after the watermark instead of recalculating.
          </Typography.Text>
        </Flex>
        <Button icon={<ReloadOutlined />} onClick={loadGuides} loading={loadingGuides}>
          Refresh
        </Button>
      </Flex>

      <Card variant="borderless">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Tour guide
            </Typography.Text>
            <Select
              showSearch
              style={{ width: "100%" }}
              placeholder="Select tour guide"
              loading={loadingGuides}
              value={guideId}
              onChange={onGuideChange}
              optionFilterProp="label"
              options={guides.map((g) => ({
                value: g.id,
                label: `${g.name}${g.email ? ` (${g.email})` : ""}`,
              }))}
              suffixIcon={<UserOutlined />}
            />
          </Col>
          <Col xs={24} md={10}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Payment period ({guide?.name ?? "guide"})
            </Typography.Text>
            <RangePicker
              style={{ width: "100%" }}
              allowClear={false}
              value={range}
              onChange={(v) => {
                if (v && v[0] && v[1]) setRange([v[0], v[1]]);
              }}
            />
          </Col>
          <Col xs={24} md={6}>
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              &nbsp;
            </Typography.Text>
            <Flex gap={8}>
              <Button type="primary" icon={<DollarOutlined />} loading={loadingSummary} onClick={() => preview(false)} style={{ flex: 1 }}>
                Preview
              </Button>
              <Popconfirm
                title="Export this payment period?"
                description={`Mark ${unpaid.length} unpaid tour(s) as paid for ${guide?.name ?? "this guide"}?`}
                onConfirm={doExport}
                disabled={unpaid.length === 0 || exporting}
              >
                <Button
                  danger
                  icon={<ExportOutlined />}
                  loading={exporting}
                  disabled={unpaid.length === 0}
                >
                  Mark as paid
                </Button>
              </Popconfirm>
            </Flex>
          </Col>
        </Row>

        {watermark && (
          <Flex gap={8} wrap style={{ marginTop: 12 }}>
            <Tag color="green">
              Last paid period ended {watermark.format("DD/MM/YYYY")}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Suggested next period starts {watermark.add(1, "day").format("DD/MM/YYYY")}.
            </Typography.Text>
          </Flex>
        )}
      </Card>

      {summary && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} lg={6}>
            <Card variant="borderless">
              <Statistic
                title="Guide returns to company"
                value={summary.summary.guideReturnsToCompany?.total ?? 0}
                prefix={<ArrowUpOutlined />}
                styles={{ content: { color: token.colorSuccess } }}
                formatter={(v) => money(Number(v))}
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card variant="borderless">
              <Statistic
                title="Company returns to guide"
                value={summary.summary.companyReturnsToGuide?.total ?? 0}
                prefix={<ArrowDownOutlined />}
                styles={{ content: { color: token.colorError } }}
                formatter={(v) => money(Number(v))}
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card variant="borderless">
              <Statistic
                title="Paid tours"
                value={paidCount}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: token.colorSuccess } }}
              />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card variant="borderless" style={{ border: `1px solid ${unpaidTotal ? token.colorError : token.colorSuccess}` }}>
              <Statistic
                title="Unpaid total (pending)"
                value={unpaidTotal}
                styles={{ content: { color: unpaidTotal ? token.colorError : token.colorSuccess, fontWeight: 700 } }}
                formatter={() => money(unpaidTotal)}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card variant="borderless" style={{ marginTop: 16 }}>
        <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 12 }}>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Settled tours in period{unpaid.length ? ` · ${unpaid.length} pending` : ""}
          </Typography.Title>
          {!guideId && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Select a guide and press Preview.
            </Typography.Text>
          )}
        </Flex>
        {loadingSummary ? (
          <Flex justify="center" style={{ padding: 60 }}>
            <Spin size="large" />
          </Flex>
        ) : guideId && !summary ? null : lines.length === 0 && guideId ? (
          <Empty description="No settled tours in this period." />
        ) : (
          <Table<SummaryLine>
            rowKey="id"
            size="small"
            dataSource={lines}
            columns={columns}
            pagination={false}
          />
        )}
      </Card>

      <Card
        variant="borderless"
        title={`Payment history · ${periods.length} period${periods.length === 1 ? "" : "s"}`}
        style={{ marginTop: 16 }}
      >
        {periods.length === 0 ? (
          <Empty description="No payment periods exported yet for this guide." />
        ) : (
          <Table<Period>
            rowKey="id"
            size="small"
            dataSource={periods}
            pagination={false}
            columns={[
              {
                title: "Period",
                key: "period",
                render: (_: any, p: Period) => (
                  <span style={{ whiteSpace: "nowrap" }}>
                    {dayjs(p.fromDate).format("DD/MM/YYYY")} — {dayjs(p.toDate).format("DD/MM/YYYY")}
                  </span>
                ),
              },
              { title: "Tours", dataIndex: "tourCount", key: "tours", width: 90 },
              {
                title: "Guide → Co.",
                dataIndex: "guideReturnsToCompany",
                key: "g2c",
                align: "right" as const,
                render: (v: number) => <span style={{ color: token.colorSuccess, fontWeight: 600 }}>{money(v)}</span>,
              },
              {
                title: "Co. → Guide",
                dataIndex: "companyReturnsToGuide",
                key: "c2g",
                align: "right" as const,
                render: (v: number) => <span style={{ color: token.colorError, fontWeight: 600 }}>{money(v)}</span>,
              },
              {
                title: "Net",
                dataIndex: "totalNet",
                key: "net",
                align: "right" as const,
                render: (v: number) => (
                  <span style={{ color: v >= 0 ? token.colorSuccess : token.colorError, fontWeight: 700 }}>{money(v)}</span>
                ),
              },
              {
                title: "Marked by",
                key: "by",
                render: (_: any, p: Period) => (
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

      {summary && summary.guideName && (
        <Descriptions
          size="small"
          column={1}
          style={{ marginTop: 16 }}
          items={[
            { key: "by", label: "Previewed for", children: `${summary.guideName}` },
          ]}
        />
      )}
    </div>
  );
}