"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  HistoryOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  UndoOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";
import TourTemplateModal from "@/components/dispatch-board/TourTemplateModal";

const vnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n ?? 0);

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("vi-VN") : "—";

const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("vi-VN") : "—";

const todayIso = () => new Date().toISOString().slice(0, 10);
const addDaysIso = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// ── Types ────────────────────────────────────────────────────────────
export type Role = "TOUR_GUIDE" | "DRIVER";

export type PayeeType =
  | "TRANSPORT_PROVIDER"
  | "COMPANY_GUIDE"
  | "COMPANY_DRIVER"
  | "FREELANCE";

export const PAYEE_GROUP_LABELS: Record<PayeeType, string> = {
  TRANSPORT_PROVIDER: "Transportation Provider",
  COMPANY_GUIDE: "Company Tour Guide",
  COMPANY_DRIVER: "Company Driver",
  FREELANCE: "Freelance (driver & guide)",
};

export interface Person {
  id: string;
  /** PERSON = an individual payee; PROVIDER = an entire transport company (many drivers). */
  kind: "PERSON" | "PROVIDER";
  name: string;
  email: string | null;
  role: Role;
  userType?: string | null;
  providerName?: string | null;
  providerIsCompany?: boolean | null;
  payeeType: PayeeType;
  paidThrough?: string | null;
}

export interface PayeeGroup {
  payeeType: PayeeType;
  label: string;
  payees: Person[];
}

export type Direction = "PERSON_TO_COMPANY" | "COMPANY_TO_PERSON" | "SETTLED";

export interface PeriodLine {
  /** Line amount: the route price (transport provider) or the net settlement (person). */
  amount: number;
  basis: "ROUTE_PRICE" | "NET_SETTLEMENT";
  flow?: "COLLECT_MONEY" | "PAY_MONEY";
  direction: Direction;
  assignmentId: string;
  code?: string | null;
  tourName?: string | null;
  plateNumber?: string | null;
  guide?: { id: string; name: string } | null;
  driver?: { id: string; name: string } | null;
  provider?: { id: string; name: string; isCompany: boolean } | null;
  tourDate: string | null;
  verifiedAt?: string | null;
  /** Trip has no price in the transport provider's price list. */
  priceMissing?: boolean;
}

export interface PeriodPreview {
  mode: "ROUTE_PRICE" | "SETTLEMENT";
  direction: Direction;
  paidThrough: string | null;
  lines: PeriodLine[];
  tourCount: number;
  person: { id: string; name: string; role: string; kind?: string; payeeType?: string } | null;
  /** Transport provider: total per the tour price list. */
  totalPrice?: number;
  companyReturnsToProvider?: number;
  /** Person: total collected/paid. */
  totalNet?: number;
  personReturnsToCompany?: number;
  companyReturnsToPerson?: number;
}

export interface QueueItem {
  direction: Direction;
  flow: "COLLECT_MONEY" | "PAY_MONEY";
  net: number;
  assignmentId: string;
  code?: string | null;
  tourName?: string | null;
  tourType?: string | null;
  finalizedAt: string | null;
  guide?: { id: string; name: string } | null;
  driver?: { id: string; name: string } | null;
  suggestedPayableTo?: {
    id: string;
    name: string;
    basis?: "ASSIGNMENT_GUIDE";
  } | null;
  plateNumber?: string | null;
  collected: number;
  paid: number;
  entryCount: number;
  waitingDays: number;
}

export interface HistoryRow {
  direction: Direction;
  totalNet: number;
  id: string;
  person: { id: string; name: string; role: string | null };
  payeeType?: PayeeType | null;
  fromDate: string;
  toDate: string;
  tourCount: number;
  personReturnsToCompany: number;
  companyReturnsToPerson: number;
  note?: string | null;
  createdByName?: string | null;
  createdAt: string;
  lines: Array<{
    assignmentId: string;
    tourName?: string | null;
    tourDate: string;
    netAmount: number;
    flow: "COLLECT_MONEY" | "PAY_MONEY";
    note?: string | null;
  }>;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  flowType: "COLLECT_MONEY" | "PAY_MONEY";
}

export interface Settlement {
  id: string;
  amount: number;
  note?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string; flowType: string; code: string } | null;
  booking?: { bookingRef: string; customerName: string } | null;
  createdByName?: string | null;
  createdAt: string;
  reversedBy?: { id: string } | null;
}

// ── Shared bits ──────────────────────────────────────────────────────
const DirectionTag = ({ direction }: { direction: string }) => {
  if (direction === "PERSON_TO_COMPANY")
    return <Tag color="orange">Guide/driver pays company</Tag>;
  if (direction === "COMPANY_TO_PERSON")
    return <Tag color="blue">Company pays guide/driver</Tag>;
  if (direction === "COMPANY_TO_PROVIDER")
    return <Tag color="blue">Company pays transport provider</Tag>;
  return <Tag color="green">Balanced</Tag>;
};

// ── Period check & export ───────────────────────────────────────────
export function PeriodTab({
  people,
  canExport,
  onExported,
}: {
  people: Person[];
  canExport: boolean;
  onExported: () => Promise<void>;
}) {
  const { modal } = App.useApp();
  const [payeeId, setPayeeId] = useState<string | undefined>();
  const [payeeType, setPayeeType] = useState<PayeeType | undefined>();
  const [from, setFrom] = useState(todayIso);
  const [to, setTo] = useState(todayIso);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<PeriodPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const person = people.find((p) => p.id === payeeId);
  const PAYEE_GROUPS = useMemo(
    () =>
      (Object.keys(PAYEE_GROUP_LABELS) as PayeeType[]).map((t) => ({
        payeeType: t,
        label: PAYEE_GROUP_LABELS[t],
        payees: people.filter((p) => p.payeeType === t),
      })),
    [people],
  );

  // By default fromDate = the day right after "Paid through" (that person's watermark).
  useEffect(() => {
    if (!person) return;
    if (person.paidThrough) {
      const d = new Date(person.paidThrough);
      d.setDate(d.getDate() + 1);
      setFrom(d.toISOString().slice(0, 10));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payeeId]);

  const load = useCallback(async () => {
    if (!payeeId) {
      setPreview(null);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/accounting/period/preview", {
        params: { fromDate: from, toDate: to, payeeId, payeeType },
      });
      setPreview(data);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [payeeId, payeeType, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const doExport = async () => {
    if (!person || !preview) return;
    const go = async () => {
      setExporting(true);
      try {
        await api.post("/accounting/period/export", {
          fromDate: from,
          toDate: to,
          payeeId: person.id,
          payeeType: person.payeeType,
          note: note || undefined,
        });
        message.success(
          preview.mode === "ROUTE_PRICE"
            ? `Exported transport provider period: ${preview.tourCount} trips, ${vnd(preview.totalPrice ?? 0)} ₫`
            : `Exported period: ${preview.tourCount} trips, ${vnd(Math.abs(preview.totalNet ?? 0))} ₫`,
        );
        setNote("");
        await load();
        await onExported();
      } catch (e) {
        message.error(getErrorMessage(e));
      } finally {
        setExporting(false);
      }
    };

    // Default #4: allow override, but warn about a double payment.
    const watermark = preview.paidThrough;
    const risky = watermark && new Date(from) <= new Date(watermark);
    if (risky) {
      modal.confirm({
        title: "Does this range overlap an already paid period?",
        content: `This person has been paid up to ${fmtDate(watermark)}. Starting from ${fmtDate(from)} may double-pay. Export anyway?`,
        okText: "Export anyway",
        okButtonProps: { danger: true },
        cancelText: "Pick another date",
        onOk: go,
      });
      return;
    }
    go();
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={7}>
        <Card title="Filters" size="small">
          <Space orientation="vertical" style={{ width: "100%" }} size={12}>
            <div>
              <Typography.Text strong>Payee</Typography.Text>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                placeholder="Select a transport provider, guide or driver"
                value={payeeId}
                onChange={(v: string) => {
                  setPayeeId(v);
                  setPayeeType(people.find((x) => x.id === v)?.payeeType);
                }}
                showSearch
                optionFilterProp="label"
                options={PAYEE_GROUPS.map((g) => ({
                  label: g.label,
                  options: g.payees.map((p) => ({
                    value: p.id,
                    label:
                      p.kind === "PROVIDER"
                        ? `${p.name} · external transport provider`
                        : `${p.name} · ${p.role === "DRIVER" ? "driver" : "guide"}`,
                  })),
                }))}
              />
            </div>

            {person?.paidThrough && (
              <Alert
                type="info"
                showIcon
                message={
                  <Typography.Text style={{ fontSize: 12 }}>
                    Paid through <b>{fmtDate(person.paidThrough)}</b> — the default
                    range starts the following day.
                  </Typography.Text>
                }
              />
            )}

            <Flex gap={8}>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ flex: 1 }}
              />
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ flex: 1 }}
              />
            </Flex>

            {canExport && (
              <Input.TextArea
                rows={2}
                placeholder="Period note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}

            <Button
              type="primary"
              icon={<DownloadOutlined />}
              block
              disabled={!canExport || !payeeId || !preview?.tourCount}
              loading={exporting}
              onClick={doExport}
            >
              Export payment period
            </Button>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Export freezes the details and moves “Paid through” to the end of the period.
            </Typography.Text>
          </Space>
        </Card>
      </Col>

      <Col xs={24} lg={17}>
        <Card
          size="small"
          title={
            <Flex justify="space-between" align="center">
              <span>Period details</span>
              {preview && <DirectionTag direction={preview.direction} />}
            </Flex>
          }
          extra={
            <Button size="small" onClick={load} loading={loading}>
              Refresh
            </Button>
          }
        >
          {!payeeId ? (
            <Empty description="Select a payee to view the period" />
          ) : !preview || preview.tourCount === 0 ? (
            <Empty
              description={
                preview?.mode === "ROUTE_PRICE"
                  ? "No transport provider trips in this range"
                  : "No trips with locked, unpaid money in this range"
              }
            />
          ) : (
            <>
              {preview.mode === "ROUTE_PRICE" ? (
                <>
                  <Row gutter={12} style={{ marginBottom: 16 }}>
                    <Col xs={12}>
                      <Statistic title="Trips" value={preview.tourCount} />
                    </Col>
                    <Col xs={12}>
                      <Statistic
                        title="Company owes provider"
                        value={preview.totalPrice ?? 0}
                        suffix="₫"
                        valueStyle={{ color: "#1677FF" }}
                      />
                    </Col>
                  </Row>

                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={
                      <b>
                        Total from the transport provider's tour price list ({vnd(preview.totalPrice ?? 0)}{" "}
                        ₫), not derived from the trip's collected/paid amounts.
                      </b>
                    }
                  />

                  {preview.lines.some((l) => l.priceMissing) && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      message="Some trips have no price in the transport provider's price list — prices must be entered before exporting the period."
                    />
                  )}

                  <Table<PeriodLine>
                    rowKey="assignmentId"
                    size="small"
                    dataSource={preview.lines}
                    pagination={false}
                    columns={[
                      {
                        title: "Trip",
                        render: (_: unknown, r: PeriodLine) => (
                          <>
                            <Typography.Text strong>{r.tourName ?? "—"}</Typography.Text>
                            <br />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {fmtDate(r.tourDate)}
                              {r.plateNumber ? ` · ${r.plateNumber}` : ""}
                              {r.driver ? ` · ${r.driver.name}` : ""}
                            </Typography.Text>
                          </>
                        ),
                      },
                      {
                        title: "Price",
                        dataIndex: "amount",
                        align: "right",
                        render: (v: number, r: PeriodLine) => (
                          <Typography.Text strong type={r.priceMissing ? "danger" : undefined}>
                            {vnd(v)} ₫
                          </Typography.Text>
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <>
                  <Row gutter={12} style={{ marginBottom: 16 }}>
                    <Col xs={8}>
                      <Statistic title="Trips" value={preview.tourCount} />
                    </Col>
                    <Col xs={8}>
                      <Statistic
                        title="Person pays company"
                        value={preview.personReturnsToCompany ?? 0}
                        suffix="₫"
                        valueStyle={{ color: "#D46B08" }}
                      />
                    </Col>
                    <Col xs={8}>
                      <Statistic
                        title="Company pays person"
                        value={preview.companyReturnsToPerson ?? 0}
                        suffix="₫"
                        valueStyle={{ color: "#1677FF" }}
                      />
                    </Col>
                  </Row>

                  <Alert
                    type={
                      (preview.totalNet ?? 0) > 0
                        ? "warning"
                        : (preview.totalNet ?? 0) < 0
                          ? "info"
                          : "success"
                    }
                    showIcon
                    style={{ marginBottom: 16 }}
                    message={
                      <b>
                        {(preview.totalNet ?? 0) > 0
                          ? `The trip creator must pay the company ${vnd(preview.totalNet ?? 0)} ₫`
                          : (preview.totalNet ?? 0) < 0
                            ? `The company must pay the trip creator ${vnd(Math.abs(preview.totalNet ?? 0))} ₫`
                            : "This period is balanced, no money due"}
                      </b>
                    }
                  />

                  <Table<PeriodLine>
                    rowKey="assignmentId"
                    size="small"
                    dataSource={preview.lines}
                    pagination={false}
                    columns={[
                      {
                        title: "Trip",
                        render: (_: unknown, r: PeriodLine) => (
                          <>
                            <Typography.Text strong>{r.code ?? "—"}</Typography.Text>
                            <br />
                            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                              {r.tourName} · {fmtDate(r.tourDate)}
                            </Typography.Text>
                          </>
                        ),
                      },
                      {
                        title: "Direction",
                        render: (_: unknown, r: PeriodLine) => (
                          <DirectionTag direction={r.direction} />
                        ),
                      },
                      {
                        title: "Net",
                        dataIndex: "amount",
                        align: "right",
                        render: (v: number) => <Typography.Text strong>{vnd(v)}</Typography.Text>,
                      },
                    ]}
                  />
                </>
              )}
            </>
          )}
        </Card>
      </Col>
    </Row>
  );
}

// ── Verification queue ─────────────────────────────────────────────
export function QueueTab({
  canVerify,
  canReject,
  canSettle,
  categories,
}: {
  canVerify: boolean;
  canReject: boolean;
  canSettle: boolean;
  categories: Category[];
}) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<QueueItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/accounting/verification-queue");
      setItems(data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card
      size="small"
      title="Waiting for Accounting to verify &amp; lock money"
      extra={
        <Button size="small" onClick={load} loading={loading}>
          Refresh
        </Button>
      }
    >
      <Alert
        type="warning"
        showIcon
        icon={<LockOutlined />}
        style={{ marginBottom: 16 }}
        message="Once locked, the trip's money is immutable — no further edits."
        description="To correct something, create a reversal entry instead of deleting/editing the old line. Only locked trips can be exported in a period."
      />

      <Table<QueueItem>
        rowKey="assignmentId"
        size="small"
        loading={loading}
        dataSource={items}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: "No trips waiting for verification 🎉" }}
        columns={[
          {
            title: "Trip",
            render: (_: unknown, r: QueueItem) => (
              <>
                <Typography.Text strong>{r.code ?? "—"}</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.tourName} · closed at {fmtDate(r.finalizedAt)}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "Guide / Driver",
            render: (_: unknown, r: QueueItem) => (
              <>
                {r.guide?.name ?? "—"}
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.driver?.name ?? "—"}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "Collect",
            align: "right",
            render: (_: unknown, r: QueueItem) => vnd(r.collected),
          },
          {
            title: "Company expense",
            align: "right",
            render: (_: unknown, r: QueueItem) => vnd(r.paid),
          },
          {
            title: "Net",
            align: "right",
            render: (_: unknown, r: QueueItem) => (
              <Typography.Text strong style={{ color: r.net > 0 ? "#D46B08" : r.net < 0 ? "#1677FF" : undefined }}>
                {vnd(r.net)}
              </Typography.Text>
            ),
          },
          {
            title: "Waiting",
            align: "center",
            render: (_: unknown, r: QueueItem) => (
              <Tag color={r.waitingDays > 7 ? "red" : r.waitingDays > 3 ? "orange" : "default"}>
                {r.waitingDays} days
              </Tag>
            ),
          },
          {
            title: "",
            align: "right",
            render: (_: unknown, r: QueueItem) => (
              <Space>
                {canSettle && (
                  <Button size="small" icon={<PlusOutlined />} onClick={() => setEditing(r)}>
                    Entry
                  </Button>
                )}
                {canVerify && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={r.entryCount === 0}
                    onClick={() => setEditing(r)}
                  >
                    Review &amp; decide
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />

      {editing && (
        <TourMoneyDrawer
          item={editing}
          categories={categories}
          canSettle={canSettle}
          canVerify={canVerify}
          canReject={canReject}
          onClose={() => setEditing(null)}
          onChanged={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

interface TourReportData {
  notes?: string | null;
  moneyVerifiedAt?: string | null;
}

export function TourMoneyDrawer({
  item,
  categories,
  canSettle,
  canVerify,
  canReject,
  onClose,
  onChanged,
}: {
  item: QueueItem;
  categories: Category[];
  canSettle: boolean;
  canVerify: boolean;
  canReject: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { modal } = App.useApp();
  const [rows, setRows] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [verifyNote, setVerifyNote] = useState("");
  const [tourReport, setTourReport] = useState<TourReportData | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/accounting/assignments/${item.assignmentId}/settlements`);
      setRows(data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [item.assignmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get(`/assignments/${item.assignmentId}/tour-report`)
      .then((r) => setTourReport(r.data ?? null))
      .catch(() => setTourReport(null));
  }, [item.assignmentId]);

  const addRow = async () => {
    if (!amount || amount <= 0) {
      message.warning("Enter an amount greater than 0");
      return;
    }
    try {
      await api.post(`/accounting/assignments/${item.assignmentId}/settlements`, {
        amount,
        note: note || undefined,
        categoryId,
      });
      message.success("Entry added");
      setAmount(null);
      setNote("");
      load();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const reverse = (r: Settlement) => {
    let reason = "";
    modal.confirm({
      title: "Reverse this entry?",
      content: (
        <Input.TextArea
          rows={2}
          placeholder="Reversal reason (required)"
          onChange={(e) => (reason = e.target.value)}
        />
      ),
      okText: "Reverse",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        if (!reason.trim()) {
          message.warning("A reversal reason is required");
          throw new Error("missing reason");
        }
        await api.post(`/accounting/settlements/${r.id}/reverse`, { note: reason.trim() });
        message.success("Reversal entry created");
        load();
      },
    });
  };

  const verify = () => {
    modal.confirm({
      title: "Lock money for this trip?",
      icon: <WarningOutlined />,
      content: (
        <>
          <p>
            After this step every collected/paid amount of the trip becomes{" "}
            <b>immutable</b> — it can no longer be edited or deleted, not even by an
            Admin.
          </p>
          <p>
            The trip becomes eligible for period export for <b>{item.guide?.name}</b>.
          </p>
          <Input.TextArea
            rows={2}
            placeholder="Verification note (optional)"
            onChange={(e) => setVerifyNote(e.target.value)}
          />
        </>
      ),
      okText: "Lock money",
      cancelText: "Cancel",
      onOk: async () => {
        await api.post(`/accounting/assignments/${item.assignmentId}/verify-money`, {
          note: verifyNote || undefined,
        });
        message.success("Trip money locked");
        onChanged();
      },
    });
  };

  /**
   * Send the money sheet back to the submitter for re-checking. A reason is
   * mandatory because they read it in the notification to know what to fix.
   */
  const reject = () => {
    let reason = "";
    modal.confirm({
      title: "Return this money sheet?",
      icon: <CloseCircleOutlined />,
      okText: "Return",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      content: (
        <>
          <p>
            The trip will leave the queue and <b>{item.suggestedPayableTo?.name ?? "the submitter"}</b>{" "}
            will be notified so they can re-check it. Money is not locked yet.
          </p>
          <Input.TextArea
            rows={3}
            placeholder="Return reason (required) — the submitter will see this text"
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        </>
      ),
      onOk: async () => {
        if (reason.trim().length < 5) {
          message.warning("A reason is required (at least 5 characters)");
          throw new Error("reason required");
        }
        try {
          await api.post(
            `/accounting/assignments/${item.assignmentId}/reject-money`,
            { reason: reason.trim() },
          );
          message.success("Returned — the submitter has been notified");
          onChanged();
        } catch (e) {
          message.error(getErrorMessage(e));
          throw e;
        }
      },
    });
  };

return (
    <Modal
      open
      onCancel={onClose}
      width={760}
      title={`Collected/paid amounts — ${item.code ?? "trip"}`}
      footer={
        <Flex justify="space-between" gap={8} wrap>
          <Button onClick={onClose}>Close</Button>
          <Space>
            <Button icon={<FileTextOutlined />} onClick={() => setShowTemplate(!showTemplate)}>
              {showTemplate ? "Hide Template" : "View Template"}
            </Button>
            {canReject && (
              <Button danger icon={<CloseCircleOutlined />} onClick={reject}>
                Return
              </Button>
            )}
            {canVerify && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={rows.length === 0 || !item.guide}
                onClick={verify}
              >
                Verify & lock money
              </Button>
            )}
          </Space>
        </Flex>
      }
    >
      {showTemplate && (
        <TourTemplateModal
          assignment={item as any}
          open={true}
          onClose={() => setShowTemplate(false)}
        />
      )}
      <Divider style={{ margin: "16px 0" }} />
      <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Tour">{item.tourName ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="Closed at">{fmtDate(item.finalizedAt)}</Descriptions.Item>
        <Descriptions.Item label="Guide">{item.guide?.name ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="Driver">{item.driver?.name ?? "—"}</Descriptions.Item>
      </Descriptions>

      {canSettle && (
        <Card size="small" title="Add entry" style={{ marginBottom: 16 }}>
          <Space wrap>
            <InputNumber
              placeholder="Amount (₫)"
              value={amount}
              onChange={setAmount}
              min={0}
              style={{ width: 160 }}
              formatter={(v) => v?.toLocaleString("vi-VN") ?? ""}
              parser={(v) => Number(v?.replace(/\./g, "") ?? 0)}
            />
            <Select
              placeholder="Category"
              value={categoryId}
              onChange={setCategoryId}
              style={{ width: 200 }}
              options={categories.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.flowType === "COLLECT_MONEY" ? "Collect" : "Company expense"})`,
              }))}
            />
            <Input
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ width: 200 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={addRow}>
              Add
            </Button>
          </Space>
        </Card>
      )}

      <Table<Settlement>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: "No entries yet" }}
        columns={[
          {
            title: "Category",
            render: (_: unknown, r: Settlement) => r.category?.name ?? "—",
          },
          { title: "Note", dataIndex: "note", render: (v) => v ?? "—" },
          {
            title: "Amount",
            align: "right",
            render: (_: unknown, r: Settlement) => (
              <Typography.Text
                strong
                style={{ color: Number(r.amount) < 0 ? "#1677FF" : undefined }}
              >
                {vnd(Number(r.amount))}
              </Typography.Text>
            ),
          },
          { title: "Created by", dataIndex: "createdByName", render: (v) => v ?? "—" },
          {
            title: "",
            align: "right",
            render: (_: unknown, r: Settlement) =>
              r.reversedBy ? (
                <Tag>Reversed</Tag>
              ) : (
                <Button size="small" icon={<UndoOutlined />} onClick={() => reverse(r)}>
                  Reverse
                </Button>
              ),
          },
        ]}
      />

      {canVerify && (
        <Card size="small" style={{ marginTop: 16 }} title="Payee for this trip">
          <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
            Taken from the guide on the assignment template. Each trip has exactly one payee
            within a payment period.
          </Typography.Text>
          {item.guide ? (
            <Alert
              type="success"
              showIcon
              message={
                <span>
                  <b>Guide: {item.guide.name}</b>
                </span>
              }
              description="This trip's collected/paid amounts will be settled with the person above."
            />
          ) : (
            <Alert
              type="error"
              showIcon
              message="This trip has no guide"
              description="The payee could not be determined — a guide must be assigned to the trip before verification."
            />
          )}
        </Card>
      )}
    </Modal>
  );
}

// ── Payment history ─────────────────────────────────────────────────
export function HistoryTab({ people }: { people: Person[] }) {
  const [payeeId, setPayeeId] = useState<string | undefined>();
  const [payeeType, setPayeeType] = useState<PayeeType | undefined>();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<HistoryRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/accounting/period/history", {
        params: payeeId ? { personId: payeeId } : {},
      });
      setRows(data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [payeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const totalByPerson = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.person.name, (m.get(r.person.name) ?? 0) + r.totalNet);
    }
    return m;
  }, [rows]);

  return (
    <Card
      size="small"
      title="Period export history"
      extra={
        <Space>
          <Select
            allowClear
            placeholder="All people"
            style={{ width: 220 }}
            value={payeeId}
            onChange={setPayeeId}
            options={(Object.keys(PAYEE_GROUP_LABELS) as PayeeType[]).flatMap((t) =>
              people
                .filter((p) => p.payeeType === t)
                .map((p) => ({ value: p.id, label: `${p.name} · ${PAYEE_GROUP_LABELS[t]}` })),
            )}
          />
          <Button size="small" onClick={load} loading={loading}>
            Refresh
          </Button>
        </Space>
      }
    >
      <Table<HistoryRow>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: "No periods exported yet" }}
        expandable={{
          expandedRowRender: (r) => (
            <Table
              rowKey="assignmentId"
              size="small"
              pagination={false}
              dataSource={r.lines}
              columns={[
                { title: "Trip", dataIndex: "tourName", render: (v) => v ?? "—" },
                { title: "Date", dataIndex: "tourDate", render: (v) => fmtDate(v) },
                {
                  title: "Direction",
                  dataIndex: "flow",
                  render: (v) => (
                    <Tag color={v === "PAY_MONEY" ? "blue" : "orange"}>
                      {v === "PAY_MONEY" ? "Company pays" : "Person pays"}
                    </Tag>
                  ),
                },
                {
                  title: "Net",
                  align: "right",
                  dataIndex: "netAmount",
                  render: (v: number) => vnd(v),
                },
              ]}
            />
          ),
        }}
        columns={[
          {
            title: "Person",
            render: (_: unknown, r: HistoryRow) => (
              <>
                <Typography.Text strong>{r.person.name}</Typography.Text>
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.person.role === "TRANSPORT_PROVIDER"
                    ? "External transport provider"
                    : r.person.role === "DRIVER"
                      ? "Driver"
                      : "Guide"}
                  {" · "}
                  {r.payeeType ? PAYEE_GROUP_LABELS[r.payeeType as PayeeType] : "—"}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "Period",
            render: (_: unknown, r: HistoryRow) => `${fmtDate(r.fromDate)} → ${fmtDate(r.toDate)}`,
          },
          { title: "Trip", dataIndex: "tourCount", align: "center" },
          {
            title: "Person pays company",
            align: "right",
            render: (_: unknown, r: HistoryRow) => vnd(r.personReturnsToCompany),
          },
          {
            title: "Company pays person",
            align: "right",
            render: (_: unknown, r: HistoryRow) => vnd(r.companyReturnsToPerson),
          },
          {
            title: "Net",
            align: "right",
            render: (_: unknown, r: HistoryRow) => (
              <Typography.Text strong>{vnd(r.totalNet)}</Typography.Text>
            ),
          },
          {
            title: "Direction",
            render: (_: unknown, r: HistoryRow) => <DirectionTag direction={r.direction} />,
          },
          {
            title: "Exported by",
            render: (_: unknown, r: HistoryRow) => (
              <>
                {r.createdByName ?? "—"}
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {fmtDateTime(r.createdAt)}
                </Typography.Text>
              </>
            ),
          },
          {
            title: "",
            align: "right",
            render: (_: unknown, r: HistoryRow) => (
              <Button size="small" onClick={() => setOpen(r)}>
                Export copy
              </Button>
            ),
          },
        ]}
        summary={() =>
          payeeId ? null : (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0}>
                  <Typography.Text strong>Total (unfiltered)</Typography.Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1} colSpan={6}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {[...totalByPerson.entries()].map(([n, v]) => `${n}: ${vnd(v)}`).join(" · ") || "—"}
                  </Typography.Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )
        }
      />

      {open && (
        <Modal
          open
          onCancel={() => setOpen(null)}
          footer={<Button onClick={() => setOpen(null)}>Close</Button>}
          title={`Exported period — ${open.person.name}`}
          width={720}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="The figures below are the frozen snapshot taken at export time — they do not change with later tour data."
          />
          <Descriptions size="small" column={2} bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Period">
              {fmtDate(open.fromDate)} → {fmtDate(open.toDate)}
            </Descriptions.Item>
            <Descriptions.Item label="Trips">{open.tourCount}</Descriptions.Item>
            <Descriptions.Item label="Person pays company">
              {vnd(open.personReturnsToCompany)} ₫
            </Descriptions.Item>
            <Descriptions.Item label="Company pays person">
              {vnd(open.companyReturnsToPerson)} ₫
            </Descriptions.Item>
            <Descriptions.Item label="Exported by">
              {open.createdByName ?? "—"} · {fmtDateTime(open.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="Note">{open.note ?? "—"}</Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="assignmentId"
            size="small"
            pagination={false}
            dataSource={open.lines}
            columns={[
              { title: "Trip", dataIndex: "tourName", render: (v) => v ?? "—" },
              { title: "Ngày", dataIndex: "tourDate", render: (v) => fmtDate(v) },
              {
                title: "Net",
                align: "right",
                dataIndex: "netAmount",
                render: (v: number) => vnd(v),
              },
            ]}
          />
        </Modal>
      )}
    </Card>
  );
}
