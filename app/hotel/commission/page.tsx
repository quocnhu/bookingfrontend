"use client";

import { useEffect, useState } from "react";
import {
  Card,
  Col,
  Empty,
  Flex,
  Row,
  Statistic,
  Table,
  Typography,
  theme as antdTheme,
} from "antd";
import { DollarOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import {
  type HotelDashboardData,
  type HotelTourSummary,
  formatVnd,
} from "@/components/hotel/hotel-shared";

const { Text } = Typography;

export default function HotelCommissionPage() {
  const { token } = antdTheme.useToken();
  const [data, setData] = useState<HotelDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get("/hotels/me/dashboard")
      .then((r) => {
        if (alive) setData(r.data);
      })
      .catch((e) => {
        if (alive) setError(getErrorMessage(e, "Could not load commission data"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const columns = [
    {
      title: "Tour",
      dataIndex: "tourName",
      key: "tourName",
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: "Bookings",
      dataIndex: "bookings",
      key: "bookings",
      align: "center" as const,
    },
    { title: "Guests", dataIndex: "pax", key: "pax", align: "center" as const },
    {
      title: "Booking value",
      dataIndex: "revenue",
      key: "revenue",
      align: "right" as const,
      render: (value: number) => formatVnd(value),
    },
    {
      title: "Earned (unpaid)",
      dataIndex: "unpaid",
      key: "unpaid",
      align: "right" as const,
      render: (value: number) => <Text type="warning">{formatVnd(value ?? 0)}</Text>,
    },
    {
      title: "Paid to hotel",
      dataIndex: "paid",
      key: "paid",
      align: "right" as const,
      render: (value: number) => (
        <Text type="success" strong>
          {formatVnd(value ?? 0)}
        </Text>
      ),
    },
    {
      title: "Pending eligibility",
      dataIndex: "pending",
      key: "pending",
      align: "right" as const,
      render: (value: number) => <Text>{formatVnd(value)}</Text>,
    },
  ];

  return (
    <div className="portal-page hotel-page">
      <Flex
        justify="space-between"
        align="center"
        wrap
        gap={12}
        className="portal-page-header"
        style={{ marginBottom: 16 }}
      >
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <DollarOutlined /> Commission
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Commission rate: {data?.hotel?.commissionPercent ?? 0}% of the
            booking value. Earned after the tour is completed and the customer
            payment is paid.
          </Text>
        </Flex>
      </Flex>

      {error && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Text type="danger">{error}</Text>
        </Card>
      )}

      <Row gutter={[12, 12]} className="portal-stats" style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Earned (unpaid)"
              value={data?.totals.unpaid ?? 0}
              valueStyle={{ color: token.colorWarning }}
              formatter={(value) => formatVnd(value)}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Paid to hotel"
              value={data?.totals.paid ?? 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: token.colorSuccess }}
              formatter={(value) => formatVnd(value)}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Pending eligibility"
              value={data?.totals.pending ?? 0}
              formatter={(value) => formatVnd(value)}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Total earned"
              value={data?.totals.earned ?? 0}
              formatter={(value) => formatVnd(value)}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card className="portal-card" size="small" styles={{ body: { padding: 0 } }}>
        <Table<HotelTourSummary>
          className="portal-table"
          rowKey={(row) => row.tourId ?? row.tourName}
          size="small"
          loading={loading}
          dataSource={data?.byTour ?? []}
          columns={columns}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{
            emptyText: <Empty description="No commission yet — no tours are linked to this hotel" />,
          }}
        />
      </Card>
    </div>
  );
}
