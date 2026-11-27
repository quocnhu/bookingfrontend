"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Flex,
  Input,
  Row,
  Select,
  Statistic,
  Table,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { currentMonthRange } from "@/lib/date-range";
import {
  type HotelBookingRow,
  type HotelBookingsData,
  formatVnd,
  hotelBookingStatus,
} from "@/components/hotel/hotel-shared";

const { Text } = Typography;
const { RangePicker } = DatePicker;

export default function HotelBookingsPage() {
  const { token } = antdTheme.useToken();
  const [data, setData] = useState<HotelBookingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [payment, setPayment] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(() =>
    currentMonthRange(),
  );

  const fetchBookings = useCallback(async () => {
    const params: Record<string, unknown> = { page, pageSize };
    if (search.trim()) params.search = search.trim();
    if (payment) params.payment = payment;
    if (range?.[0]) params.fromDate = range[0].format("YYYY-MM-DD");
    if (range?.[1]) params.toDate = range[1].format("YYYY-MM-DD");
    const r = await api.get("/hotels/me/bookings", { params });
    return r.data as HotelBookingsData;
  }, [page, pageSize, search, payment, range]);

  const load = useCallback(async () => {
    try {
      const next = await fetchBookings();
      setData(next);
      setError(null);
    } catch (e) {
      setError(getErrorMessage(e, "Could not load hotel bookings"));
    } finally {
      setLoading(false);
    }
  }, [fetchBookings]);

  useEffect(() => {
    let alive = true;
    fetchBookings()
      .then((next) => {
        if (!alive) return;
        setData(next);
        setError(null);
      })
      .catch((e) => {
        if (alive) setError(getErrorMessage(e, "Could not load hotel bookings"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchBookings]);

  const columns = [
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
      title: "Departure",
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
      title: "Booking value",
      dataIndex: "totalAmount",
      key: "totalAmount",
      align: "right" as const,
      render: (value: number) => formatVnd(value),
    },
    {
      title: "Commission",
      key: "commission",
      align: "right" as const,
      render: (_: unknown, row: HotelBookingRow) => (
        <Flex vertical align="end">
          <Text strong>{formatVnd(row.commissionAmount)}</Text>
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
      title: "Commission payout",
      key: "commissionPaid",
      render: (_: unknown, row: HotelBookingRow) => {
        if (!row.commissionEarned) return <Tag>Not earned</Tag>;
        if (row.commissionPaid) {
          return (
            <Flex vertical gap={2}>
              <Tag color="green" style={{ margin: 0 }}>
                Paid
              </Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {row.commissionPaidAt ? dayjs(row.commissionPaidAt).format("DD/MM/YYYY") : ""}
                {row.commissionPaymentReference ? ` · ${row.commissionPaymentReference}` : ""}
              </Text>
            </Flex>
          );
        }
        return <Tag color="gold">Unpaid</Tag>;
      },
    },
  ];

  const summary = data?.summary;
  const cards = useMemo(
    () => [
      { title: "Bookings", value: summary?.bookings ?? 0 },
      { title: "Guests", value: summary?.pax ?? 0 },
      { title: "Booking value", value: formatVnd(summary?.revenue ?? 0) },
      { title: "Earned (unpaid)", value: formatVnd(summary?.unpaid ?? 0) },
      { title: "Commission paid", value: formatVnd(summary?.paid ?? 0) },
      { title: "Pending eligibility", value: formatVnd(summary?.pending ?? 0) },
    ],
    [summary],
  );

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
            Hotel bookings
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Every guest stay linked to your hotel, with the commission for each
            tour.
          </Text>
        </Flex>
        <Flex gap={8} wrap align="center" className="portal-filters">
          <Input
            allowClear
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ref, customer, tour"
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
          />
          <Select
            allowClear
            value={payment}
            onChange={(value) => {
              setPayment(value);
              setPage(1);
            }}
            placeholder="Payment"
            style={{ width: 140 }}
            options={[
              { value: "PAID", label: "Paid" },
              { value: "PENDING", label: "Pending" },
              { value: "REFUNDED", label: "Refunded" },
            ]}
          />
          <RangePicker
            value={range}
            onChange={(value) => {
              setRange(value as [Dayjs | null, Dayjs | null] | null);
              setPage(1);
            }}
          />
        </Flex>
      </Flex>

      {error && (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Text type="danger">{error}</Text>
        </Card>
      )}

      <Row gutter={[12, 12]} className="portal-stats" style={{ marginBottom: 16 }}>
        {cards.map((card) => (
          <Col xs={12} md={8} xl={4} key={card.title}>
            <Card size="small">
              <Statistic
                title={card.title}
                value={card.value}
                valueStyle={
                  card.title === "Commission earned"
                    ? { color: token.colorSuccess }
                    : card.title === "Commission pending"
                      ? { color: token.colorWarning }
                      : undefined
                }
                loading={loading}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Card className="portal-card" size="small" styles={{ body: { padding: 0 } }}>
        <Table<HotelBookingRow>
          className="portal-table"
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={data?.items ?? []}
          columns={columns}
          scroll={{ x: "max-content" }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </Card>
    </div>
  );
}
