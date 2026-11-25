"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  DatePicker,
  Drawer,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/lib/antd-message";
import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { api, getErrorMessage } from "@/lib/api";

const { RangePicker } = DatePicker;

type HoldStatus = "ACTIVE" | "RELEASED";

interface GuideHold {
  id: string;
  guideId: string;
  guide?: { id: string; name?: string | null; email?: string | null } | null;
  startDate: string;
  endDate: string;
  note?: string | null;
  status: HoldStatus;
  createdBy?: { name?: string | null; email?: string | null } | null;
  releasedBy?: { name?: string | null; email?: string | null } | null;
  releasedAt?: string | null;
  createdAt: string;
}

interface GuideOption {
  value: string;
  label: string;
}

const fmt = (value?: string | null) =>
  value ? dayjs(value).format("DD MMM YYYY") : "—";

export default function GuideHoldsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [holds, setHolds] = useState<GuideHold[]>([]);
  const [guides, setGuides] = useState<GuideOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | HoldStatus>("ACTIVE");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<GuideHold | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = statusFilter === "ALL" ? {} : { status: statusFilter };
      const [holdsRes, crewRes] = await Promise.all([
        api.get<GuideHold[]>("/guide-holds", { params }),
        api.get("/assignments/board/crew").catch(() => ({ data: { guides: [] } })),
      ]);
      setHolds(holdsRes.data ?? []);
      const rows = (crewRes.data?.guides ?? []) as Array<{
        id: string;
        name?: string | null;
        type?: string;
      }>;
      setGuides(
        rows.map((guide) => ({
          value: guide.id,
          label: `${guide.name ?? guide.id}${guide.type ? ` · ${guide.type === "OFFICIAL" ? "Company" : "Freelance"}` : ""}`,
        })),
      );
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load guide holds"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      guideId: undefined,
      range: [dayjs().add(1, "day"), dayjs().add(7, "day")],
      note: "",
    });
    setEditorOpen(true);
  };

  const openEdit = (hold: GuideHold) => {
    setEditing(hold);
    form.setFieldsValue({
      guideId: hold.guideId,
      range: [dayjs(hold.startDate), dayjs(hold.endDate)],
      note: hold.note ?? "",
    });
    setEditorOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const range = values.range as [Dayjs, Dayjs];
      setSaving(true);
      const payload = {
        guideId: values.guideId as string,
        startDate: range[0].format("YYYY-MM-DD"),
        endDate: range[1].format("YYYY-MM-DD"),
        note: (values.note as string | undefined)?.trim() || undefined,
      };
      if (editing) {
        await api.put(`/guide-holds/${editing.id}`, {
          startDate: payload.startDate,
          endDate: payload.endDate,
          note: payload.note,
        });
        message.success("Guide hold updated");
      } else {
        await api.post("/guide-holds", payload);
        message.success("Guide hold created");
      }
      setEditorOpen(false);
      setEditing(null);
      await load();
    } catch (e) {
      if (e && typeof e === "object" && "errorFields" in e) return;
      message.error(getErrorMessage(e, "Could not save the guide hold"));
    } finally {
      setSaving(false);
    }
  };

  const release = async (hold: GuideHold) => {
    try {
      await api.post(`/guide-holds/${hold.id}/release`);
      message.success("Guide hold released");
      await load();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not release the guide hold"));
    }
  };

  const columns: ColumnsType<GuideHold> = [
      {
        title: "Guide",
        key: "guide",
        render: (_, row) => (
          <Flex vertical gap={0}>
            <Typography.Text strong style={{ fontSize: 12 }}>
              {row.guide?.name ?? row.guide?.email ?? row.guideId}
            </Typography.Text>
            {row.guide?.email ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {row.guide.email}
              </Typography.Text>
            ) : null}
          </Flex>
        ),
      },
      {
        title: "From",
        dataIndex: "startDate",
        key: "startDate",
        width: 130,
        render: (value: string) => fmt(value),
      },
      {
        title: "To",
        dataIndex: "endDate",
        key: "endDate",
        width: 130,
        render: (value: string) => fmt(value),
      },
      {
        title: "Note",
        dataIndex: "note",
        key: "note",
        ellipsis: true,
        render: (value: string | null) => value || "—",
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 110,
        render: (value: HoldStatus) => (
          <Tag color={value === "ACTIVE" ? "magenta" : "default"} style={{ margin: 0 }}>
            {value === "ACTIVE" ? "Held" : "Released"}
          </Tag>
        ),
      },
      {
        title: "Created by",
        key: "createdBy",
        width: 150,
        render: (_, row) =>
          row.createdBy?.name ?? row.createdBy?.email ?? "—",
      },
      {
        title: "Actions",
        key: "actions",
        width: 150,
        render: (_, row) =>
          row.status === "ACTIVE" ? (
            <Space size={6}>
              <Button size="small" onClick={() => openEdit(row)}>
                Edit
              </Button>
              <Popconfirm
                title="Release this hold?"
                description="The guide becomes available for assignment again."
                okText="Release"
                onConfirm={() => release(row)}
              >
                <Button size="small" danger>
                  Release
                </Button>
              </Popconfirm>
            </Space>
          ) : (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.releasedAt ? `Released ${dayjs(row.releasedAt).format("DD MMM")}` : "—"}
            </Typography.Text>
          ),
      },
  ];

  return (
    <Drawer
      title="Guide holds"
      placement="right"
      width={900}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">
          A hold reserves a tour guide for a date range. Auto-crew skips held
          guides, and manual assignment is blocked until the hold is released.
          Holds are not day-off requests.
        </Typography.Text>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Segmented
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as "ALL" | HoldStatus)}
            options={[
              { label: "Active holds", value: "ACTIVE" },
              { label: "Released", value: "RELEASED" },
              { label: "All", value: "ALL" },
            ]}
          />
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void load()}>
              Refresh
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              New hold
            </Button>
          </Space>
        </Flex>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={holds}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          scroll={{ x: 900 }}
        />
      </Flex>

      <Modal
        title={editing ? "Edit guide hold" : "New guide hold"}
        open={editorOpen}
        onCancel={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onOk={() => void save()}
        confirmLoading={saving}
        okText={editing ? "Save changes" : "Create hold"}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item
            name="guideId"
            label="Tour guide"
            rules={[{ required: true, message: "Select a tour guide" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select a tour guide"
              options={guides}
              disabled={!!editing}
            />
          </Form.Item>
          <Form.Item
            name="range"
            label="Hold dates"
            rules={[{ required: true, message: "Select the hold dates" }]}
          >
            <RangePicker style={{ width: "100%" }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="note" label="Note (optional)">
            <Input.TextArea
              rows={3}
              maxLength={1000}
              placeholder="e.g. Reserved for the 2-day Mekong tour or personal request"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Drawer>
  );
}
