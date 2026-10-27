"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Col,
  Flex,
  Row,
  Skeleton,
  Statistic,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";

export interface LeavePeriodSummary {
  start: string;
  end: string;
  days: number;
  approvedDays: number;
  pendingDays: number;
  requests: number;
}

export interface LeaveSummary {
  week: LeavePeriodSummary;
  month: LeavePeriodSummary;
  year: LeavePeriodSummary;
}

interface LeaveSummaryProps {
  refreshKey?: number;
  accentColor?: string;
  /** Render without the outer Card/title, e.g. inside a Drawer. */
  embedded?: boolean;
}

export default function LeaveSummaryCards({
  refreshKey = 0,
  accentColor = "#6366F1",
  embedded = false,
}: LeaveSummaryProps) {
  const { token } = antdTheme.useToken();
  const [summary, setSummary] = useState<LeaveSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    api
      .get("/leaves/my-summary")
      .then((r) => {
        if (active) setSummary(r.data ?? null);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const periods = summary
    ? [
        { key: "week", label: "This week", data: summary.week },
        { key: "month", label: "This month", data: summary.month },
        { key: "year", label: "This year", data: summary.year },
      ]
    : [];

  const body = summary ? (
    <Row gutter={[12, 12]}>
      {periods.map((p) => (
        <Col xs={24} sm={embedded ? 24 : 8} key={p.key}>
          <Card
            size="small"
            style={{
              borderRadius: 10,
              borderColor: token.colorBorderSecondary,
            }}
          >
            <Statistic
              title={p.label}
              value={p.data.days}
              suffix={p.data.days === 1 ? "day" : "days"}
              valueStyle={{ fontSize: 22 }}
            />
            <Flex gap={12} wrap style={{ marginTop: 4 }}>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />{" "}
                {p.data.approvedDays} approved
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                <ClockCircleOutlined style={{ color: "#faad14" }} />{" "}
                {p.data.pendingDays} pending
              </Typography.Text>
            </Flex>
          </Card>
        </Col>
      ))}
    </Row>
  ) : failed ? (
    <Typography.Text type="secondary">
      Leave totals are unavailable right now.
    </Typography.Text>
  ) : (
    <Skeleton
      active
      paragraph={{ rows: embedded ? 6 : 1 }}
      title={false}
    />
  );

  if (embedded) return body;

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <CalendarOutlined style={{ color: accentColor, fontSize: 16 }} />
          <Typography.Text strong style={{ fontSize: 15 }}>
            My leave totals
          </Typography.Text>
        </Flex>
      }
      styles={{ body: { padding: 12 } }}
      style={{ borderRadius: 14, marginBottom: 16 }}
    >
      {body}
    </Card>
  );
}
