"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Flex,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/lib/antd-message";
import {
  BarChartOutlined,
  CalendarOutlined,
  CalendarTwoTone,
  DeleteOutlined,
  ThunderboltOutlined,
  InfoCircleOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import LeaveSummaryCards from "@/components/leave-summary";
import {
  formatLeaveDayCount,
  isLeaveDateDisabled,
  leaveDayCount,
  leaveTimingHint,
} from "@/lib/leave";
import dayjs, { Dayjs } from "dayjs";
import { DatePicker } from "antd";

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
  isEmergency?: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string | null;
  reviewedByName?: string | null;
  reviewedByRole?: string | null;
  reviewedAt?: string | null;
}

export default function DayOffForm({
  roleLabel,
  accentColor,
  featureUrl,
}: {
  roleLabel: string;
  accentColor: string;
  featureUrl: string;
}) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [form] = Form.useForm();
  const isEmergency = Form.useWatch("isEmergency", form) === true;
  const [items, setItems] = useState<LeaveItem[]>([]);
  const [summaryKey, setSummaryKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

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
        isEmergency: values.isEmergency === true,
      });
      message.success("Day-off request submitted — an admin has been notified");
      form.resetFields();
      setRequestOpen(false);
      setSummaryKey((k) => k + 1);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to submit day-off request"));
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (item: LeaveItem) => {
    try {
      await api.delete(`/leaves/${item.id}`);
      message.success("Day-off request removed");
      setSummaryKey((k) => k + 1);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to remove day-off request"));
    }
  };

  const columns: ColumnsType<LeaveItem> = [
    {
      title: "#",
      key: "__index",
      width: 56,
      align: "center",
      render: (_: unknown, __: LeaveItem, index: number) => index + 1,
    },
    {
      title: "Dates",
      key: "dates",
      render: (_, r) => (
        <Flex align="center" gap={8} wrap>
          <Typography.Text strong>
            {dayjs(r.startDate).format(dateFormat)} →{" "}
            {dayjs(r.endDate).format(dateFormat)}
          </Typography.Text>
          <Tag color="blue" style={{ margin: 0 }}>
            {formatLeaveDayCount(leaveDayCount(r.startDate, r.endDate))}
          </Tag>
          {r.isEmergency && (
            <Tag
              color="red"
              icon={<ThunderboltOutlined />}
              style={{ margin: 0, fontWeight: 600 }}
            >
              Emergency
            </Tag>
          )}
        </Flex>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (v: string | null) =>
        v ? (
          <Typography.Text ellipsis={{ tooltip: v }} style={{ fontSize: 12 }}>
            {v}
          </Typography.Text>
        ) : (
          "—"
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      filters: [
        { text: "Pending", value: "PENDING" },
        { text: "Approved", value: "APPROVED" },
        { text: "Rejected", value: "REJECTED" },
      ],
      onFilter: (value, r) => r.status === value,
      render: (v: LeaveItem["status"]) => (
        <Tag color={STATUS_COLOR[v]} style={{ margin: 0 }}>
          {STATUS_TEXT[v]}
        </Tag>
      ),
    },
    {
      title: "Requested",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string | null) =>
        v ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(v).format("DD MMM YYYY HH:mm")}
          </Typography.Text>
        ) : (
          "—"
        ),
    },
    {
      title: "Reviewed by",
      key: "reviewedBy",
      render: (_, r) =>
        r.status === "PENDING" || !r.reviewedByName ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Typography.Text>
        ) : (
          <Flex vertical>
            <Typography.Text style={{ fontSize: 13 }}>
              {r.reviewedByName}
            </Typography.Text>
            {r.reviewedAt && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(r.reviewedAt).format("DD MMM YYYY HH:mm")}
              </Typography.Text>
            )}
          </Flex>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, r) =>
        r.status === "PENDING" ? (
          <Popconfirm
            title="Cancel this day-off request?"
            okText="Yes, cancel"
            okButtonProps={{ danger: true }}
            onConfirm={() => cancel(r)}
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />}>
              Cancel
            </Button>
          </Popconfirm>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Typography.Text>
        ),
    },
  ];

  return (
    <div>
      <Drawer
        title={
          <Flex align="center" gap={8}>
            <CalendarOutlined style={{ color: accentColor, fontSize: 16 }} />
            <Typography.Text strong style={{ fontSize: 15 }}>
              My leave totals
            </Typography.Text>
          </Flex>
        }
        placement="right"
        width={isMobile ? "100%" : 360}
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
      >
        <LeaveSummaryCards
          refreshKey={summaryKey}
          accentColor={accentColor}
          embedded
        />
      </Drawer>

      <Card
        title={
          <Flex align="center" justify="space-between" gap={8} wrap>
            <Flex align="center" gap={8}>
              <CalendarOutlined style={{ color: accentColor, fontSize: 16 }} />
              <Typography.Text strong style={{ fontSize: 15 }}>
                My day-off requests
              </Typography.Text>
            </Flex>
            <Flex
              align="center"
              gap={8}
              wrap
              style={{ width: isMobile ? "100%" : undefined }}
            >
              <Button
                icon={<BarChartOutlined />}
                onClick={() => setSummaryOpen(true)}
                style={{ flex: isMobile ? 1 : undefined }}
              >
                Leave totals
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setRequestOpen(true)}
                style={{ flex: isMobile ? 1 : undefined }}
              >
                Request day off
              </Button>
            </Flex>
          </Flex>
        }
        styles={{ body: { padding: 12 } }}
        style={{ borderRadius: 14 }}
      >
        <Table
          rowKey="id"
          size={isMobile ? "small" : "middle"}
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: "max-content" }}
          pagination={{
            pageSize: isMobile ? 5 : 10,
            simple: isMobile,
            showSizeChanger: !isMobile,
            showTotal: isMobile ? undefined : (t) => `Total: ${t}`,
          }}
          locale={{ emptyText: "You have no day-off requests yet." }}
        />
      </Card>

      <Modal
        open={requestOpen}
        title={
          <Flex align="center" gap={8}>
            <CalendarTwoTone style={{ fontSize: 16 }} />
            <Typography.Text strong style={{ fontSize: 15 }}>
              Request day off
            </Typography.Text>
          </Flex>
        }
        okText="Submit request"
        cancelText="Cancel"
        confirmLoading={submitting}
        onOk={() => form.submit()}
        onCancel={() => setRequestOpen(false)}
        destroyOnClose
      >
        <Alert
          type={isEmergency ? "error" : "warning"}
          showIcon
          icon={isEmergency ? <ThunderboltOutlined /> : <InfoCircleOutlined />}
          style={{ marginBottom: 16, borderRadius: 10 }}
          message={
            isEmergency ? "Emergency leave request" : "Day-off requests need 2 days' notice"
          }
          description={`${leaveTimingHint(isEmergency)} While your request is PENDING or APPROVED, you won't be placed in any assignment on those dates. ${roleLabel || "Others"} are notified of every new request.`}
        />

        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          initialValues={{ roleLabel }}
          onValuesChange={(changed) => {
            if ("isEmergency" in changed) {
              form.setFieldValue("range", undefined);
            }
          }}
        >
          <Form.Item name="roleLabel" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="isEmergency"
            valuePropName="checked"
            style={{ marginBottom: 12 }}
          >
            <Checkbox>
              <ThunderboltOutlined style={{ color: "#cf1322", marginRight: 4 }} />
              <Typography.Text strong style={{ color: "#cf1322" }}>
                Emergency
              </Typography.Text>{" "}
              — last-minute leave
            </Checkbox>
          </Form.Item>
          <Form.Item
            name="range"
            label="Dates off"
            rules={[
              { required: true, message: "Please pick the days you need off" },
            ]}
          >
            <RangePicker
              style={{ width: "100%" }}
              format={dateFormat}
              disabledDate={(d: Dayjs) => isLeaveDateDisabled(d, isEmergency)}
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea
              rows={2}
              maxLength={300}
              placeholder="e.g. personal matters, sick leave…"
            />
          </Form.Item>
        </Form>

        <Typography.Text
          type="secondary"
          style={{ fontSize: 11, display: "block", marginTop: 8 }}
        >
          Note: only PENDING requests can be cancelled by the requester. Emergency
          requests for today are accepted only before 04:00.
        </Typography.Text>
      </Modal>
    </div>
  );
}
