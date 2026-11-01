"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Popconfirm,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";

export interface AdminTourCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  isActive: boolean;
  _count?: { tours: number };
}

export default function TourCategoryManager({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [form] = Form.useForm();
  const [rows, setRows] = useState<AdminTourCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<AdminTourCategory | null>(null);

  const reset = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/tour-categories/admin");
      setRows(res.data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load categories"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    reset();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const payload = {
        name: values.name.trim(),
        slug: values.slug?.trim() || undefined,
        description: values.description?.trim() || undefined,
        sortOrder: values.sortOrder ?? undefined,
        isActive: values.isActive ?? true,
      };
      if (editing) {
        await api.put(`/tour-categories/${editing.id}`, payload);
        message.success("Category updated");
      } else {
        await api.post("/tour-categories", payload);
        message.success("Category created");
      }
      reset();
      await load();
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save category"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: AdminTourCategory) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    });
  };

  const remove = async (row: AdminTourCategory) => {
    try {
      await api.delete(`/tour-categories/${row.id}`);
      message.success("Category deleted");
      if (editing?.id === row.id) reset();
      await load();
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to delete category"));
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      render: (value: string, row: AdminTourCategory) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            /{row.slug}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Tours",
      dataIndex: "_count",
      width: 80,
      render: (value?: { tours?: number }) => (
        <Tag color="blue">{value?.tours ?? 0}</Tag>
      ),
    },
    {
      title: "Sort order",
      dataIndex: "sortOrder",
      width: 90,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      width: 90,
      render: (value: boolean) =>
        value ? <Tag color="green">Active</Tag> : <Tag>Hidden</Tag>,
    },
    {
      title: "",
      key: "actions",
      width: 130,
      render: (_: unknown, row: AdminTourCategory) => (
        <Flex gap={4}>
          <Button size="small" onClick={() => startEdit(row)}>
            Edit
          </Button>
          <Popconfirm
            title="Delete this category?"
            description="Tours keep their other categories."
            onConfirm={() => remove(row)}
          >
            <Button danger size="small">
              Delete
            </Button>
          </Popconfirm>
        </Flex>
      ),
    },
  ];

  return (
    <Modal
      title="Tour categories"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
    >
      <Form form={form} layout="vertical" initialValues={{ isActive: true }}>
        <Row gutter={12}>
          <Col span={10}>
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: "Category name required" }]}
            >
              <Input placeholder="e.g. Mekong Delta" />
            </Form.Item>
          </Col>
          <Col span={7}>
            <Form.Item name="slug" label="Slug (optional)">
              <Input placeholder="Auto from name" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="sortOrder" label="Sort order">
              <InputNumber
                min={0}
                placeholder="Auto"
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
          <Col span={3}>
            <Form.Item
              name="isActive"
              label="Active"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="description"
          label="Description (optional)"
          style={{ marginBottom: 12 }}
        >
          <Input placeholder="Shown in the admin only" />
        </Form.Item>
        <Flex gap={8} style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={saving}
            onClick={submit}
          >
            {editing ? "Save category" : "Add category"}
          </Button>
          {editing && <Button onClick={reset}>Cancel edit</Button>}
        </Flex>
      </Form>

      <Table
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={false}
        scroll={{ y: 320 }}
      />
    </Modal>
  );
}
