"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Flex,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { indexColumn, PAGE_SIZE_OPTIONS } from "@/lib/table";
import dayjs, { Dayjs } from "dayjs";

const { RangePicker } = DatePicker;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  OFFICE: "Office",
  TOUR_GUIDE: "Tour Guide",
  DRIVER: "Driver",
  CUSTOMER: "Customer",
};

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

type DateRange = [Dayjs, Dayjs] | undefined;

function TextFilter({
  value,
  onOk,
  onReset,
}: {
  value?: string;
  onOk: (v: string | undefined) => void;
  onReset: () => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <div style={{ padding: 8 }}>
      <Input
        size="small"
        allowClear
        placeholder="Filter…"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onPressEnter={() => onOk(v || undefined)}
      />
      <Flex gap={6} style={{ marginTop: 8 }}>
        <Button size="small" onClick={onReset}>
          Reset
        </Button>
        <Button size="small" type="primary" onClick={() => onOk(v || undefined)}>
          OK
        </Button>
      </Flex>
    </div>
  );
}

function DateFilter({
  value,
  onOk,
  onReset,
}: {
  value?: DateRange;
  onOk: (v: DateRange) => void;
  onReset: () => void;
}) {
  const [v, setV] = useState<DateRange>(value);
  return (
    <div style={{ padding: 8 }}>
      <RangePicker
        size="small"
        value={v}
        onChange={(range) =>
          setV(
            range && range[0] && range[1] ? [range[0], range[1]] : undefined,
          )
        }
      />
      <Flex gap={6} style={{ marginTop: 8 }}>
        <Button size="small" onClick={onReset}>
          Reset
        </Button>
        <Button size="small" type="primary" onClick={() => onOk(v)}>
          OK
        </Button>
      </Flex>
    </div>
  );
}

const textColumn = (
  value: string | undefined,
  setValue: (v: string | undefined) => void,
) => ({
  filteredValue: value ? [value] : null,
  filterDropdown: ({ clearFilters, close }: any) => (
    <TextFilter
      value={value}
      onOk={(v) => {
        setValue(v);
        close();
      }}
      onReset={() => {
        clearFilters();
        setValue(undefined);
        close();
      }}
    />
  ),
});

const dateColumn = (
  value: DateRange,
  setValue: (v: DateRange) => void,
) => ({
  filteredValue: value ? ["1"] : null,
  filterDropdown: ({ clearFilters, close }: any) => (
    <DateFilter
      value={value}
      onOk={(v) => {
        setValue(v);
        close();
      }}
      onReset={() => {
        clearFilters();
        setValue(undefined);
        close();
      }}
    />
  ),
});

interface LeaveRow {
  id: string;
  requesterName?: string;
  requesterRole?: string | null;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByName?: string | null;
  reviewedByRole?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

export default function LeavesAdminPage() {
  const { user: me } = useApp();
  const isStaff = me?.role === "ADMIN" || me?.role === "OFFICE";

  const [items, setItems] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [staffFilter, setStaffFilter] = useState<string | undefined>();
  const [reasonFilter, setReasonFilter] = useState<string | undefined>();
  const [reviewedByFilter, setReviewedByFilter] = useState<string | undefined>();
  const [datesFilter, setDatesFilter] = useState<DateRange>(undefined);
  const [requestedFilter, setRequestedFilter] = useState<DateRange>(undefined);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [savingCreate, setSavingCreate] = useState(false);
  const [staffOptions, setStaffOptions] = useState<
    { value: string; label: string; group?: string }[]
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      if (staffFilter) params.search = staffFilter;
      if (reasonFilter) params.reason = reasonFilter;
      if (reviewedByFilter) params.reviewedBy = reviewedByFilter;
      if (datesFilter) {
        params.from = datesFilter[0].format("YYYY-MM-DD");
        params.to = datesFilter[1].format("YYYY-MM-DD");
      }
      if (requestedFilter) {
        params.createdFrom = requestedFilter[0].format("YYYY-MM-DD");
        params.createdTo = requestedFilter[1].format("YYYY-MM-DD");
      }

      const r = await api.get("/leaves", { params });
      setItems(r.data?.items ?? r.data ?? []);
      setTotal(r.data?.total ?? r.data?.items?.length ?? r.data?.length ?? 0);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load day-off requests"));
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    statusFilter,
    staffFilter,
    reasonFilter,
    reviewedByFilter,
    datesFilter,
    requestedFilter,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = useCallback(
    async (id: string, status: "APPROVED" | "REJECTED") => {
      try {
        await api.put(`/leaves/${id}/status`, { status });
        message.success(status === "APPROVED" ? "Day off approved" : "Day off rejected");
        setPage(1);
        load();
      } catch (e) {
        message.error(getErrorMessage(e, "Failed to update day-off request"));
      }
    },
    [load],
  );

  const openCreateModal = () => {
    setCreateModalOpen(true);
    if (!isStaff) return;
    Promise.all([
      api.get("/users", { params: { userType: "guide", limit: 1000 } }),
      api.get("/users", { params: { userType: "driver", limit: 1000 } }),
    ])
      .then(([g, d]) => {
        const map = (list: any[]) =>
          list
            .filter((u: any) => u.isActive !== false)
            .map((u: any) => ({
              value: u.id,
              label: u.name ?? u.email,
            }));
        setStaffOptions([
          ...map(g.data.items ?? g.data ?? []).map((o) => ({ ...o, group: "Tour Guide" })),
          ...map(d.data.items ?? d.data ?? []).map((o) => ({ ...o, group: "Driver" })),
        ]);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load staff")));
  };

  const submitCreate = async (values: any) => {
    const [start, end] = values.range;
    setSavingCreate(true);
    try {
      const payload: any = {
        startDate: start.startOf("day").format("YYYY-MM-DD"),
        endDate: end.startOf("day").format("YYYY-MM-DD"),
        reason: values.reason,
      };
      if (isStaff && values.userId) {
        payload.userId = values.userId;
      }
      await api.post("/leaves", payload);
      message.success("Day-off request submitted");
      setCreateModalOpen(false);
      createForm.resetFields();
      setPage(1);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create day-off request"));
    } finally {
      setSavingCreate(false);
    }
  };

  const columns = [
    indexColumn(page, pageSize),
    ...(isStaff
      ? [
          {
            title: "Staff",
            key: "requester",
            ...textColumn(staffFilter, (v) => {
              setStaffFilter(v);
              setPage(1);
            }),
            render: (_: any, r: LeaveRow) => (
              <Flex vertical>
                <Typography.Text strong>{r.requesterName ?? "—"}</Typography.Text>
                {r.requesterRole ? (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {ROLE_LABEL[r.requesterRole] ?? r.requesterRole}
                  </Typography.Text>
                ) : null}
              </Flex>
            ),
          },
        ]
      : []),
    {
      title: "Dates",
      key: "dates",
      ...dateColumn(datesFilter, (v) => {
        setDatesFilter(v);
        setPage(1);
      }),
      render: (_: any, r: LeaveRow) => (
        <Typography.Text>
          {dayjs(r.startDate).format("DD MMM YYYY")} → {dayjs(r.endDate).format("DD MMM YYYY")}
        </Typography.Text>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      ...textColumn(reasonFilter, (v) => {
        setReasonFilter(v);
        setPage(1);
      }),
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
      filteredValue: statusFilter ? [statusFilter] : null,
      onFilter: (v: any, r: LeaveRow) => r.status === v,
      render: (v: string) => <Tag color={STATUS_COLOR[v]}>{STATUS_TEXT[v]}</Tag>,
    },
    {
      title: "Reviewed by",
      key: "reviewedBy",
      ...textColumn(reviewedByFilter, (v) => {
        setReviewedByFilter(v);
        setPage(1);
      }),
      render: (_: any, r: LeaveRow) => {
        if (r.status === "PENDING" || !r.reviewedByName) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              —{""}
            </Typography.Text>
          );
        }
        return (
          <Flex vertical>
            <Typography.Text style={{ fontSize: 13 }}>
              {r.reviewedByName}
            </Typography.Text>
            {r.reviewedAt ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {dayjs(r.reviewedAt).format("DD MMM YYYY HH:mm")}
              </Typography.Text>
            ) : null}
          </Flex>
        );
      },
    },
    {
      title: "Requested",
      dataIndex: "createdAt",
      key: "createdAt",
      ...dateColumn(requestedFilter, (v) => {
        setRequestedFilter(v);
        setPage(1);
      }),
      render: (v: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v).format("DD MMM YYYY HH:mm")}
        </Typography.Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: LeaveRow) => {
        const actionable = isStaff && r.status === "PENDING";
        if (!isStaff) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              —{""}
            </Typography.Text>
          );
        }
        return (
          <Space>
            <Popconfirm
              title="Approve this day off?"
              okText="Approve"
              disabled={!actionable}
              onConfirm={() => setStatus(r.id, "APPROVED")}
            >
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                disabled={!actionable}
                title={actionable ? undefined : "Already handled"}
              >
                Approve
              </Button>
            </Popconfirm>
            <Popconfirm
              title="Reject this day off?"
              okText="Reject"
              okButtonProps={{ danger: true }}
              disabled={!actionable}
              onConfirm={() => setStatus(r.id, "REJECTED")}
            >
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                disabled={!actionable}
                title={actionable ? undefined : "Already handled"}
              >
                Reject
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 4 }}>
      <Card
        title={
          <Flex align="center" justify="space-between" wrap gap={8}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              {isStaff ? "Day Off Requests" : "My Day-Off Requests"}
            </Typography.Title>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              Request day off
            </Button>
          </Flex>
        }
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 14 }}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: "max-content" }}
          onChange={(_pagination, filters) => {
            const s = filters?.status?.[0] as string | undefined;
            if (s !== statusFilter) {
              setStatusFilter(s);
              setPage(1);
            }
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showQuickJumper: true,
            showTotal: (t) => `Total: ${t}`,
            onChange: (p, size) => {
              if (size !== pageSize) {
                setPageSize(size);
                setPage(1);
              } else {
                setPage(p);
              }
            },
          }}
          locale={{ emptyText: "No day-off requests found" }}
        />
      </Card>

      <Modal
        title="Request day off"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={savingCreate}
        okText="Submit request"
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={submitCreate}
          style={{ marginTop: 16 }}
        >
          {isStaff && (
            <Form.Item
              name="userId"
              label="Staff member"
              rules={[{ required: true, message: "Please choose a staff member" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Select a tour guide or driver"
                options={staffOptions}
                optionRender={(option) => (
                  <Flex justify="space-between" align="center">
                    <span>{option.label}</span>
                    <Tag color={option.data.group === "Tour Guide" ? "green" : "cyan"} style={{ margin: 0 }}>
                      {option.data.group}
                    </Tag>
                  </Flex>
                )}
              />
            </Form.Item>
          )}
          <Form.Item
            name="range"
            label="Dates off"
            rules={[{ required: true, message: "Please pick the days off" }]}
          >
            <RangePicker
              style={{ width: "100%" }}
              format="DD MMM YYYY"
              disabledDate={(d: Dayjs) =>
                d.isBefore(dayjs().startOf("day"), "day")
              }
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
      </Modal>
    </div>
  );
}