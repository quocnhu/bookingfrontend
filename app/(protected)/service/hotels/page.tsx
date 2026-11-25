"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

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
  const { user } = useApp();
  const isAdmin = user?.role === "ADMIN";
  const [hotels, setHotels] = useState<HotelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<HotelRow | null>(null);
  const [form] = Form.useForm();

  const fetchHotels = useCallback(async () => {
    const r = await api.get("/hotels");
    return (r.data ?? []) as HotelRow[];
  }, []);

  const load = useCallback(async () => {
    try {
      setHotels(await fetchHotels());
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load hotels"));
    } finally {
      setLoading(false);
    }
  }, [fetchHotels]);

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

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ commissionPercent: 10, isActive: true });
    setOpen(true);
  };

  const openEdit = (hotel: HotelRow) => {
    setEditing(hotel);
    form.resetFields();
    form.setFieldsValue({
      name: hotel.name,
      contactName: hotel.contactName ?? undefined,
      phone: hotel.phone ?? undefined,
      email: hotel.email ?? undefined,
      address: hotel.address ?? undefined,
      commissionPercent: hotel.commissionPercent,
      isActive: hotel.isActive,
      accountEmail: hotel.users?.[0]?.email ?? undefined,
      accountName: hotel.users?.[0]?.name ?? undefined,
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const payload = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== "" && value !== undefined),
      );
      setSaving(true);
      if (editing) {
        await api.put(`/hotels/${editing.id}`, payload);
        message.success("Hotel updated");
      } else {
        await api.post("/hotels", payload);
        message.success("Hotel and login account created");
      }
      setOpen(false);
      await load();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      message.error(getErrorMessage(e, "Could not save the hotel"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (hotel: HotelRow) => {
    try {
      const r = await api.delete(`/hotels/${hotel.id}`);
      message.success(
        r.data?.deactivated
          ? "Hotel has bookings — account deactivated instead of deleted"
          : "Hotel deleted",
      );
      await load();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not delete the hotel"));
    }
  };

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
      title: "Login account",
      key: "account",
      render: (_: unknown, row: HotelRow) =>
        row.users?.[0] ? (
          <Flex vertical gap={2}>
            <Text style={{ fontSize: 12 }}>{row.users[0].email}</Text>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.users[0].isActive ? "Active" : "Inactive"}
            </Text>
          </Flex>
        ) : (
          <Text type="secondary">No account</Text>
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
    {
      title: "Actions",
      key: "actions",
      width: 140,
      render: (_: unknown, row: HotelRow) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(row)}
          />
          {isAdmin && (
            <Popconfirm
              title="Delete or deactivate this hotel?"
              description="Hotels with bookings are deactivated instead of deleted."
              okText="Confirm"
              onConfirm={() => remove(row)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Hotels
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Hotel partners, their commission rate, and the login account they
            use to see their bookings.
          </Text>
        </Flex>
        <Flex gap={8}>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              void load();
            }}
            loading={loading}
          >
            Refresh
          </Button>
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Add hotel
            </Button>
          )}
        </Flex>
      </Flex>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table<HotelRow>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={hotels}
          columns={columns}
          pagination={false}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={editing ? `Edit ${editing.name}` : "Add hotel"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={save}
        okText={editing ? "Save changes" : "Create hotel"}
        confirmLoading={saving}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Hotel name"
            rules={[{ required: true, message: "Hotel name is required" }]}
          >
            <Input placeholder="e.g. Riverside Hotel" maxLength={200} />
          </Form.Item>
          <Flex gap={12} wrap>
            <Form.Item
              name="commissionPercent"
              label="Commission %"
              rules={[{ required: true, message: "Commission is required" }]}
              style={{ flex: "1 1 160px" }}
            >
              <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="isActive" label="Active" valuePropName="checked" style={{ flex: "0 0 100px" }}>
              <Switch />
            </Form.Item>
          </Flex>
          <Flex gap={12} wrap>
            <Form.Item name="contactName" label="Contact name" style={{ flex: "1 1 220px" }}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item name="phone" label="Phone" style={{ flex: "1 1 180px" }}>
              <Input maxLength={40} />
            </Form.Item>
          </Flex>
          <Flex gap={12} wrap>
            <Form.Item name="email" label="Hotel email" style={{ flex: "1 1 260px" }}>
              <Input type="email" maxLength={120} />
            </Form.Item>
            <Form.Item name="address" label="Address" style={{ flex: "1 1 260px" }}>
              <Input maxLength={300} />
            </Form.Item>
          </Flex>

          <Typography.Title level={5} style={{ marginTop: 4 }}>
            Login account
          </Typography.Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            One account per hotel. It sees only this hotel&apos;s bookings and
            commission.
          </Text>
          <Flex gap={12} wrap style={{ marginTop: 10 }}>
            <Form.Item
              name="accountEmail"
              label="Login email"
              rules={[{ type: "email", message: "Enter a valid email" }]}
              style={{ flex: "1 1 260px" }}
            >
              <Input type="email" maxLength={120} />
            </Form.Item>
            <Form.Item name="accountName" label="Account name" style={{ flex: "1 1 220px" }}>
              <Input maxLength={120} />
            </Form.Item>
            <Form.Item
              name="accountPassword"
              label={editing ? "New password (optional)" : "Password"}
              rules={
                editing
                  ? [{ min: 6, message: "At least 6 characters" }]
                  : [{ required: true, min: 6, message: "At least 6 characters" }]
              }
              style={{ flex: "1 1 220px" }}
            >
              <Input.Password maxLength={100} />
            </Form.Item>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
}
