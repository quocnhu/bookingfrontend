"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Segmented,
  Spin,
  Statistic,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  CarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import dayjs from "dayjs";
import VerifyReportModal from "@/components/dispatch-board/VerifyReportModal";
import type { BoardItem } from "@/components/dispatch-board/types";

const REPORT_STATUS_COLOR: Record<string, string> = {
  SUBMITTED: "orange",
  VERIFYING: "purple",
  VERIFIED: "green",
  REJECTED: "red",
};

const toBoardItem = (a: any): BoardItem => ({
  id: a.id,
  code: a.code ?? a.id,
  tourName: a.tourName ?? a.code ?? "Tour",
  tourType: a.tourType ?? null,
  startDate: a.startDate,
  endDate: a.endDate,
  durationDays: a.durationDays ?? 1,
  status: a.status,
  totalPax:
    a.totalPax ?? a.bookings?.reduce((s: number, b: any) => s + (b.totalPax ?? 0), 0) ?? 0,
  vehicle: a.vehicle ?? null,
  provider: a.provider ?? null,
  driver: a.driver ?? null,
  guide: a.guide ?? null,
  reportVerifier: a.reportVerifier ?? null,
  bookings: a.bookings ?? [],
  settlements: a.settlements ?? [],
  tourReport: a.tourReport ?? null,
});

export default function AccountingVerifyPage() {
  const { token } = antdTheme.useToken();
  const [tab, setTab] = useState<"pending" | "reviewed">("pending");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<BoardItem[]>([]);
  const [reviewed, setReviewed] = useState<BoardItem[]>([]);
  const [selected, setSelected] = useState<BoardItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([
        api.get("/assignments", { params: { status: "VERIFYING", limit: 200 } }),
        api.get("/assignments", { params: { status: "COMPLETED", limit: 200 } }),
      ]);
      setPending((p.data?.items ?? []).map(toBoardItem));
      setReviewed(
        (r.data?.items ?? [])
          .map(toBoardItem)
          .filter((a: BoardItem) => a.tourReport),
      );
    } catch {
      setPending([]);
      setReviewed([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const verified = reviewed.filter((a) => a.tourReport?.status === "VERIFIED");
  const rejected = reviewed.filter((a) => a.tourReport?.status === "REJECTED");
  const list = tab === "pending" ? pending : reviewed;

  const openCard = (a: BoardItem) => {
    setSelected(a);
    setModalOpen(true);
  };

  const renderCard = (a: BoardItem) => (
    <Card
      key={a.id}
      variant="borderless"
      style={{
        marginBottom: 12,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 12,
      }}
    >
      <Flex justify="space-between" align="flex-start" wrap gap={16}>
        <Flex vertical gap={4} style={{ flex: 1, minWidth: 240 }}>
          <Flex align="center" gap={8} wrap>
            <Typography.Text strong style={{ fontSize: 15 }}>
              {a.tourName}
            </Typography.Text>
            <Tag color={REPORT_STATUS_COLOR[a.tourReport?.status ?? a.status]}>
              {a.tourReport?.status ?? a.status}
            </Tag>
          </Flex>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(a.startDate).format("DD/MM/YYYY")} —{" "}
            {dayjs(a.endDate).format("DD/MM/YYYY")}
            {a.code ? ` · ${a.code}` : ""}
          </Typography.Text>
          <Flex gap={16} wrap>
            {a.vehicle?.plateNumber && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                <CarOutlined /> {a.vehicle.plateNumber}
              </Typography.Text>
            )}
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              <UserOutlined /> Guide: {a.guide?.name ?? "—"}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Pax: {a.totalPax}
            </Typography.Text>
          </Flex>
          {a.tourReport && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Submitted by {a.tourReport.submittedByName ?? "guide"} ·{" "}
              {a.tourReport.submittedAt
                ? dayjs(a.tourReport.submittedAt).format("DD/MM/YYYY HH:mm")
                : ""}
              {a.tourReport.verifiedByName
                ? ` · Verified by ${a.tourReport.verifiedByName}`
                : ""}
            </Typography.Text>
          )}
        </Flex>
        <Button type="primary" ghost onClick={() => openCard(a)}>
          {tab === "pending" ? "Verify" : "View"}
        </Button>
      </Flex>
    </Card>
  );

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <FileDoneOutlined /> Report Verification
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Check tour guides' submitted reports — approve to complete the tour, or reject to
            send back for resubmission.
          </Typography.Text>
        </Flex>
        <Flex align="center" gap={8} wrap>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        </Flex>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Pending review"
              value={pending.length}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: token.colorWarning } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Verified"
              value={verified.length}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: token.colorSuccess } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Rejected"
              value={rejected.length}
              prefix={<CloseCircleOutlined />}
              styles={{ content: { color: token.colorError } }}
            />
          </Card>
        </Col>
      </Row>

      <Flex align="center" justify="space-between" wrap gap={12} style={{ margin: "20px 0 12px" }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {tab === "pending" ? "Pending reports" : "Reviewed reports"}
        </Typography.Title>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as any)}
          options={[
            { label: `Pending (${pending.length})`, value: "pending" },
            { label: `Reviewed (${reviewed.length})`, value: "reviewed" },
          ]}
        />
      </Flex>

      {loading ? (
        <Flex justify="center" style={{ padding: 80 }}>
          <Spin size="large" />
        </Flex>
      ) : list.length === 0 ? (
        <Empty description={tab === "pending" ? "No reports waiting for verification." : "No reviewed reports yet."} />
      ) : (
        <>
          {list.map(renderCard)}
        </>
      )}

      <VerifyReportModal
        assignment={selected}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onDone={load}
      />
    </div>
  );
}