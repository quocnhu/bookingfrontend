"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Flex, Table, Tag, Typography } from "antd";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";

const { Text } = Typography;

interface HotelRow {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  commissionPercent: number;
  isActive: boolean;
  bookingsCount: number;
  users?: Array<{
    id: string;
    email: string;
    name?: string | null;
    isActive?: boolean;
  }>;
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHotels = useCallback(async () => {
    const r = await api.get("/hotels");
    return (r.data ?? []) as HotelRow[];
  }, []);

  useEffect(() => {
    let alive = true;
    fetchHotels()
      .then((rows) => {
        if (alive) setHotels(rows);
      })
      .catch((e) => {
        if (alive) message.error(getErrorMessage(e, "Could not load hotels"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [fetchHotels]);



  const columns = [
    {
      title: "Hotel",
      dataIndex: "name",
      key: "name",
      render: (value: string, row: HotelRow) => (
        <Flex vertical gap={2}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.address || "No address"}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Commission",
      dataIndex: "commissionPercent",
      key: "commissionPercent",
      align: "center" as const,
      render: (value: number) => <Tag color="gold">{value}%</Tag>,
    },
    {
      title: "Contact",
      key: "contact",
      render: (_: unknown, row: HotelRow) => (
        <Flex vertical gap={2}>
          <Text style={{ fontSize: 12 }}>{row.contactName || "—"}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.phone || row.email || "—"}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Portal account",
      key: "account",
      render: (_: unknown, row: HotelRow) =>
        row.users?.[0] ? (
          <Text style={{ fontSize: 12 }}>{row.users[0].email}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Bookings",
      dataIndex: "bookingsCount",
      key: "bookingsCount",
      align: "center" as const,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      align: "center" as const,
      render: (value: boolean) => (
        <Tag color={value ? "green" : "red"}>{value ? "Active" : "Inactive"}</Tag>
      ),
    },

  ];

  return (
    <div>
      <Flex vertical gap={2} style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Hotels
        </Typography.Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Hotel accounts and commission rates. Commission applies to every completed,
          paid booking linked to the hotel. Manage hotel accounts in Users.
        </Text>
      </Flex>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<HotelRow>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={hotels}
          columns={columns}
          pagination={false}
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
