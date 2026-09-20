"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Spin,
  Tag,
  Typography,
  theme as antdTheme,
  message,
} from "antd";
import {
  CalendarOutlined,
  CalendarTwoTone,
  DeleteOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "antd";
import type { RangePickerProps } from "antd/es/date-picker";

const { RangePicker } = DatePicker;

const dateFormat = "DD MMM YYYY";

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  APPROVED: "green",
  REJECTED: "red",
};

interface LeaveItem {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

const forbidPast: RangePickerProps = {
  disabledDate: (d: Dayjs) => d.isBefore(dayjs().startOf("day")),
};

export default function DayOffForm({
  roleLabel,
  accentColor,
  featureUrl,
}: {
  roleLabel: string;
  accentColor: string;
  featureUrl: string;
}) {
  const { token } = antdTheme.useToken();
  const [form] = Form.useForm();
  const [items, setItems] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelItem, setCancelItem] = useState<LeaveItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/leaves/my");
      setItems(r.data?.items ?? r.data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load your day-off requests"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (values: any) => {
    const [start, end] = values.range;
    setSubmitting(true);
    try {
      await api.post("/leaves", {
        startDate: start.startOf("day").format("YYYY-MM-DD"),
        endDate: end.startOf("day").format("YYYY-MM-DD"),
        reason: values.reason,
      });
      message.success("Day-off request submitted — an admin has been notified");
      form.resetFields();
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to submit day-off request"));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async () => {
    if (!cancelItem) return;
    try {
      await api.delete(`/leaves/${cancelItem.id}`);
      message.success("Day-off request removed");
      setCancelItem(null);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to remove day-off request"));
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Card
        title={
          <Flex align="center" gap={8}>
            <CalendarTwoTone style={{ fontSize: 16 }} />
            <Typography.Text strong style={{ fontSize: 15 }}>
              Request day off
            </Typography.Text>
          </Flex>
        }
        styles={{ body: { padding: 18 } }}
        style={{ borderRadius: 14 }}
      >
        <Alert
          type="warning"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16, borderRadius: 10 }}
          message="Your day-off days keep you out of the dispatch board"
          description={`While your request is PENDING or APPROVED, you won't be placed in any assignment on those dates. ${roleLabel || "Others"}. The admin is notified of every new request.`}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ roleLabel }}
        >
          <Form.Item
            name="roleLabel"
            hidden
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="range"
            label="Dates off"
            rules={[{ required: true, message: "Please pick the days you need off" }]}
          >
            <RangePicker
              style={{ width: "100%" }}
              format={dateFormat}
              disabledDate={
                (d: Dayjs) => d.isBefore(dayjs().startOf("day"), "day")
              }
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea rows={2} maxLength={300} placeholder="e.g. personal matters, sick leave…" />
          </Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<CalendarOutlined />}
            loading={submitting}
            block
          >
            Submit day-off request
          </Button>
        </Form>

        <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
          Note: only PENDING requests can be cancelled by the requester.
        </Typography.Text>
      </Card>

      <Card
        title="My day-off requests"
        styles={{ body: { padding: "8px 16px" } }}
        style={{ borderRadius: 14, marginTop: 16 }}
      >
        {loading ? (
          <Flex justify="center" style={{ padding: 24 }}>
            <Spin />
          </Flex>
        ) : items.length === 0 ? (
          <Typography.Text type="secondary">You have no day-off requests yet.</Typography.Text>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={items}
            renderItem={(it) => (
              <List.Item
                actions={[
                  it.status === "PENDING" && (
                    <Popconfirm
                      key="cancel"
                      title="Cancel this day-off request?"
                      okText="Yes, cancel"
                      okButtonProps={{ danger: true }}
                      onConfirm={cancel}
                    >
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                      >
                        Cancel
                      </Button>
                    </Popconfirm>
                  ),
                ].filter(Boolean) as any}
              >
                <List.Item.Meta
                  title={
                    <Flex align="center" gap={8} wrap>
                      <Typography.Text strong style={{ fontSize: 13 }}>
                        {dayjs(it.startDate).format(dateFormat)} → {dayjs(it.endDate).format(dateFormat)}
                      </Typography.Text>
                      <Tag color={STATUS_COLOR[it.status]} style={{ fontSize: 10, margin: 0 }}>
                        {STATUS_TEXT[it.status]}
                      </Tag>
                    </Flex>
                  }
                  description={
                    it.reason ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {it.reason}
                      </Typography.Text>
                    ) : null
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}
