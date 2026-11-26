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
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  BankOutlined,
  DollarOutlined,
  PercentageOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import {
  type HotelBookingRow,
  type HotelDashboardData,
  type HotelTourSummary,
  formatVnd,
  hotelBookingStatus,
} from "@/components/hotel/hotel-shared";

const { Text } = Typography;

export default function HotelDashboardPage() {
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
        if (alive) setError(getErrorMessage(e, "Could not load the hotel dashboard"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const tourColumns = [
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
      title: "Revenue",
      dataIndex: "revenue",
      key: "revenue",
      align: "right" as const,
      render: (value: number) => formatVnd(value),
    },
    {
      title: "Commission earned",
      dataIndex: "earned",
      key: "earned",
      align: "right" as const,
      render: (value: number) => (
        <Text type="success" strong>
          {formatVnd(value)}
        </Text>
      ),
    },
    {
      title: "Commission pending",
      dataIndex: "pending",
      key: "pending",
      align: "right" as const,
      render: (value: number) => <Text type="warning">{formatVnd(value)}</Text>,
    },
  ];

  const bookingColumns = [
    {
      title: "Ref",
      dataIndex: "bookingRef",
      key: "bookingRef",
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      render: (value: string | null) => value || "—",
    },
    {
      title: "Tour",
      dataIndex: "tourName",
      key: "tourName",
      render: (value: string | null) => value || "—",
    },
    {
      title: "Date",
      dataIndex: "startingDate",
      key: "startingDate",
      render: (value: string | null) =>
        value ? dayjs(value).format("DD/MM/YYYY") : "—",
    },
    {
      title: "Pax",
      dataIndex: "totalPax",
      key: "totalPax",
      align: "center" as const,
    },
    {
      title: "Total",
      dataIndex: "totalAmount",
      key: "totalAmount",
      align: "right" as const,
      render: (value: number) => formatVnd(value),
    },
    {
      title: "Commission",
      dataIndex: "commissionAmount",
      key: "commissionAmount",
      align: "right" as const,
      render: (value: number, row: HotelBookingRow) => (
        <Flex vertical align="end">
          <Text strong>{formatVnd(value)}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.commissionPercent}%
          </Text>
        </Flex>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_: unknown, row: HotelBookingRow) => {
        const meta = hotelBookingStatus(row);
        return (
          <Tag color={meta.color} style={{ margin: 0 }}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: "Payout",
      key: "payout",
      render: (_: unknown, row: HotelBookingRow) =>
        !row.commissionEarned ? (
          <Tag>Not earned</Tag>
        ) : row.commissionPaid ? (
          <Tag color="green">Paid</Tag>
        ) : (
          <Tag color="gold">Unpaid</Tag>
        ),
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
            <BankOutlined /> {data?.hotel?.name ?? "Hotel dashboard"}
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Your bookings and the commission earned per tour. Commission is
            counted after the tour is completed and the customer payment is paid.
          </Text>
        </Flex>
        {data?.hotel && (
          <Tag color="gold" style={{ margin: 0, padding: "4px 10px" }}>
            <PercentageOutlined /> {data.hotel.commissionPercent}% commission
          </Tag>
        )}
      </Flex>

      {error && (
        <Card style={{ marginBottom: 16 }}>
          <Text type="danger">{error}</Text>
        </Card>
      )}

      <Row gutter={[12, 12]} className="portal-stats" style={{ marginBottom: 16 }}>
        <Col xs={12} md={8} xl={4}>
          <Card size="small">
            <Statistic
              title="Bookings"
              value={data?.totals.bookings ?? 0}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small">
            <Statistic
              title="Guests"
              value={data?.totals.pax ?? 0}
              prefix={<TeamOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small">
            <Statistic
              title="Tours"
              value={data?.totals.tours ?? 0}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Card size="small">
            <Statistic
              title="Booking value"
              value={data?.totals.revenue ?? 0}
              formatter={(value) => formatVnd(value)}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={12} md={8} xl={4}>
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
        <Col xs={12} md={8} xl={4}>
          <Card size="small">
            <Statistic
              title="Commission paid"
              value={data?.totals.paid ?? 0}
              valueStyle={{ color: token.colorSuccess }}
              prefix={<DollarOutlined />}
              formatter={(value) => formatVnd(value)}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card
        className="portal-card"
        size="small"
        title="Commission by tour"
        style={{ marginBottom: 16 }}
        styles={{ body: { padding: 0 } }}
      >
        <Table<HotelTourSummary>
          className="portal-table"
          rowKey={(row) => row.tourId ?? row.tourName}
          size="small"
          loading={loading}
          dataSource={data?.byTour ?? []}
          columns={tourColumns}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty description="No bookings linked to this hotel yet" /> }}
        />
      </Card>

      <Card className="portal-card" size="small" title="Recent bookings" styles={{ body: { padding: 0 } }}>
        <Table<HotelBookingRow>
          className="portal-table"
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={data?.recentBookings ?? []}
          columns={bookingColumns}
          pagination={false}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty description="No bookings yet" /> }}
        />
      </Card>
    </div>
  );
}
