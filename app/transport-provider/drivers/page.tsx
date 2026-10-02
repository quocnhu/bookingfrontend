"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import { DeleteOutlined, PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

interface DriverRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  providerId?: string | null;
  licenseNumber?: string | null;
}

export default function ProviderDriversPage() {
  const { user } = useApp();
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/transportation-providers/drivers");
      setRows(r.data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load drivers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    try {
      const v = await form.validateFields();
      const { data } = await api.post("/transportation-providers/drivers", v);
      form.resetFields();
      setCreating(false);
      if (data?.defaultPassword) {
        Modal.success({
          title: "Driver created",
          content: `First-login password for ${data.email}: ${data.defaultPassword}`,
        });
      } else {
        message.success("Driver created");
      }
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not create driver"));
    }
  };

  const toggleActive = async (r: DriverRow, active: boolean) => {
    try {
      await api.put(`/transportation-providers/drivers/${r.id}`, { isActive: active });
      message.success(active ? "Driver activated" : "Driver deactivated");
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not update driver"));
    }
  };

  const unassign = (r: DriverRow) => {
    Modal.confirm({
      title: `Remove ${r.name} from your fleet?`,
      content: "The driver account stays, but is no longer linked to your provider.",
      okText: "Remove",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await api.delete(
            `/transportation-providers/${user?.providerId}/drivers/${r.id}`,
          );
          message.success("Driver removed from fleet");
          load();
        } catch (e) {
          message.error(getErrorMessage(e, "Could not remove driver"));
          throw e;
        }
      },
    });
  };

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        <Flex vertical gap={2}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            <TeamOutlined /> My Drivers
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Drivers running under your fleet.
          </Typography.Text>
        </Flex>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Add driver
        </Button>
      </Flex>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Roster freezes at 22:00 daily"
        description="Finish assigning drivers before 10pm — the 4am auto crew + dispatch runs on the settled roster."
      />

      <Card size="small">
        <Table<DriverRow>
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          locale={{ emptyText: "No drivers yet" }}
          columns={[
            {
              title: "Name",
              render: (_: unknown, r: DriverRow) => (
                <>
                  <Typography.Text strong>{r.name}</Typography.Text>
                  <br />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {r.email}
                  </Typography.Text>
                </>
              ),
            },
            {
              title: "License",
              dataIndex: "licenseNumber",
              render: (v) => v ?? "—",
            },
            {
              title: "Status",
              align: "center",
              render: (_: unknown, r: DriverRow) =>
                r.isActive ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>,
            },
            {
              title: "Actions",
              align: "right",
              render: (_: unknown, r: DriverRow) => (
                <Space>
                  <Switch
                    size="small"
                    checked={r.isActive}
                    onChange={(v) => toggleActive(r, v)}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => unassign(r)}
                  >
                    Remove
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="Add driver"
        open={creating}
        onCancel={() => setCreating(false)}
        onOk={create}
        okText="Create"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Full name" rules={[{ required: true }]}>
            <Input placeholder="Nguyen Van Tai" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input placeholder="tai.driver@example.com" />
          </Form.Item>
          <Form.Item
            name="licenseNumber"
            label="License number"
            rules={[{ required: true }]}
          >
            <Input placeholder="DL-001" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
