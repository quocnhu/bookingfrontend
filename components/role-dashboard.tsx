"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Spin,
  Statistic,
  Tag,
  Typography,
} from "antd";
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import dayjs from "dayjs";
import { api } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  DISPATCHED: "blue",
  VERIFYING: "purple",
  COMPLETED: "green",
  CANCELED: "red",
};

export default function RoleDashboard({
  mode,
  title,
  subtitle,
  tripsHref,
  accent,
}: {
  mode: "guide" | "driver" | "provider";
  title: string;
  subtitle: string;
  tripsHref: string;
  accent: string;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/assignments/my-assignments")
      .then((r) => setItems(r.data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const today = dayjs();
  const upcoming = useMemo(
    () =>
      items
        .filter(
          (a) => dayjs(a.startDate).isSame(today, "day") || dayjs(a.startDate).isAfter(today, "day"),
        )
        .filter((a) => a.status !== "CANCELED")
        .sort((a, b) => dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items],
  );
  const completed = useMemo(
    () => items.filter((a) => a.status === "COMPLETED"),
    [items],
  );
  const needReport = useMemo(
    () =>
      mode === "guide"
        ? items.filter((a) => a.status === "DISPATCHED" && !a.tourReport)
        : [],
    [items, mode],
  );

  if (loading) {
    return (
      <Flex justify="center" style={{ padding: 80 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {title}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {subtitle}
          </Typography.Text>
        </Flex>
        <Link href={tripsHref}>
          <Button type="primary" ghost icon={<CarOutlined />}>
            My trips
          </Button>
        </Link>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} lg={6}>
          <Card variant="borderless">
            <Statistic title="Total trips" value={items.length} prefix={<CarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Upcoming"
              value={upcoming.length}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={6}>
          <Card variant="borderless">
            <Statistic
              title="Completed"
              value={completed.length}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        {mode === "guide" && (
          <Col xs={12} sm={8} lg={6}>
            <Card variant="borderless">
              <Statistic
                title="Need report"
                value={needReport.length}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
        )}
      </Row>

      <Typography.Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
        Next trips
      </Typography.Title>
      {upcoming.length === 0 ? (
        <Empty description="No upcoming trips" />
      ) : (
        upcoming.slice(0, 5).map((a) => (
          <Card key={a.id} variant="borderless" style={{ marginBottom: 12 }}>
            <Flex justify="space-between" align="center" wrap gap={8}>
              <Flex vertical gap={2}>
                <Flex align="center" gap={8} wrap>
                  <Typography.Text strong style={{ fontSize: 15 }}>
                    {a.tourName ?? a.code}
                  </Typography.Text>
                  <Tag color={STATUS_COLOR[a.status] ?? "default"} style={{ margin: 0 }}>
                    {a.status}
                  </Tag>
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(a.startDate).format("DD/MM/YYYY")} —{" "}
                  {dayjs(a.endDate).format("DD/MM/YYYY")}
                  {a.vehicle?.plateNumber ? ` · ${a.vehicle.plateNumber}` : ""}
                  {typeof a.totalPax === "number" ? ` · ${a.totalPax} pax` : ""}
                </Typography.Text>
              </Flex>
              <Link href={tripsHref}>
                <Button size="small" style={{ borderColor: accent, color: accent }}>
                  Details
                </Button>
              </Link>
            </Flex>
          </Card>
        ))
      )}
    </div>
  );
}
