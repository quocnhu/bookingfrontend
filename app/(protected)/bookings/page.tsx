"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  CarOutlined,
  FieldTimeOutlined,
  CheckOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import FilterBar from "@/components/filter-bar";

const BOOKING_STATUS = ["PENDING", "ASSIGNED", "CANCELED"];
const ASSIGNMENT_STATUS = ["PENDING", "DISPATCHED", "COMPLETED", "CANCELED"];
const BOOKING_CHANNELS = ["TRIPADVISOR", "WEBSITE", "MANUAL", "AIRBNB", "BOOKING_COM"];
const PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED"];

const endDate = (start: any, days?: number | null): Date | null => {
  if (!start) return null;
  const d = new Date(start);
  const n = Number(days ?? 1);
  d.setDate(d.getDate() + Math.max(0, n - 1));
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function BookingsPage() {
  const { hasPermission } = useApp();
  const canCreateBooking = hasPermission("booking.create");
  const canUpdateBooking = hasPermission("booking.update");
  const canCreateAssignment = hasPermission("assignment.create");
  const canUpdateAssignment = hasPermission("assignment.update");
  const canManageMailbox = hasPermission("gmail.manage");

  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(10);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [filters, setFilters] = useState<{
    q?: string;
    status?: string;
    channel?: string;
    payment?: string;
  }>({});

  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsTotal, setAssignmentsTotal] = useState(0);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentsPageSize, setAssignmentsPageSize] = useState(10);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignStatus, setAssignStatus] = useState<string | undefined>();

  const [boardOpen, setBoardOpen] = useState(false);
  const [boardData, setBoardData] = useState<any[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const [tours, setTours] = useState<any[]>([]);
  const [unassignedBookings, setUnassignedBookings] = useState<any[]>([]);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm] = Form.useForm();
  const [savingBooking, setSavingBooking] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm] = Form.useForm();
  const [savingAssign, setSavingAssign] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkAssignment, setLinkAssignment] = useState<any>(null);
  const [linkSelected, setLinkSelected] = useState<string[]>([]);
  const [savingLink, setSavingLink] = useState(false);

  const [rawData, setRawData] = useState<any[]>([]);
  const [rawDataTotal, setRawDataTotal] = useState(0);
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize, setRawDataPageSize] = useState(10);
  const [rawDataLoading, setRawDataLoading] = useState(false);
  const [rawStatus, setRawStatus] = useState<string | undefined>();
  const [rawSearch, setRawSearch] = useState("");
  const [rawDetail, setRawDetail] = useState<any>(null);

  const [bookingDetail, setBookingDetail] = useState<any>(null);

  const loadRawData = () => {
    setRawDataLoading(true);
    const params: Record<string, any> = {
      page: rawDataPage,
      limit: rawDataPageSize,
    };
    if (rawStatus) params.status = rawStatus;
    if (rawSearch.trim()) params.q = rawSearch.trim();
    api
      .get("/raw-data", { params })
      .then((r) => {
        setRawData(r.data.items ?? []);
        setRawDataTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load raw mail")))
      .finally(() => setRawDataLoading(false));
  };

  useEffect(() => {
    if (canManageMailbox) loadRawData();
  }, [canManageMailbox, rawDataPage, rawDataPageSize, rawStatus, rawSearch]);

  const RAW_DATA_STATUS_COLORS: Record<string, string> = {
    pending: "geekblue",
    parsed: "green",
    unparsed: "orange",
    parse_failed: "red",
  };

  const rawDataColumns = centerColumns([
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={RAW_DATA_STATUS_COLORS[v] ?? "default"}>{v}</Tag>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (v: any) => (v ? <Typography.Text>{v}</Typography.Text> : "—"),
    },
    {
      title: "Received",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: any) => (v ? new Date(v).toLocaleString() : "—"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: any) => (
        <Space size={8}>
          <Button size="small" onClick={() => setRawDetail(r)}>
            View payload
          </Button>
          {r.bookingId && (
            <Tag color="green">→ booking {r.bookingId.slice(0, 8)}</Tag>
          )}
        </Space>
      ),
    },
  ]);

  const loadBookings = () => {
    setBookingsLoading(true);
    api
      .get("/bookings", {
        params: { page: bookingsPage, limit: bookingsPageSize, ...filters },
      })
      .then((r) => {
        setBookings(r.data.items ?? []);
        setBookingsTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setBookingsLoading(false));
  };

  const loadAssignments = () => {
    setAssignmentsLoading(true);
    api
      .get("/assignments", {
        params: {
          page: assignmentsPage,
          limit: assignmentsPageSize,
          q: assignSearch,
          status: assignStatus,
        },
      })
      .then((r) => {
        setAssignments(r.data.items ?? []);
        setAssignmentsTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setAssignmentsLoading(false));
  };

  const loadBoard = () => {
    setBoardLoading(true);
    api
      .get("/assignments/board")
      .then((r) => setBoardData(r.data ?? []))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load board")))
      .finally(() => setBoardLoading(false));
  };

  const openBoard = () => {
    setBoardOpen(true);
    loadBoard();
  };

  const confirmTour = async (assignment: any) => {
    setConfirmingId(assignment.id);
    try {
      await api.put(`/assignments/${assignment.id}/status`, { status: "COMPLETED" });
      message.success(`Tour "${assignment.tourName ?? assignment.code}" marked complete`);
      loadBoard();
      loadAssignments();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to complete tour"));
    } finally {
      setConfirmingId(null);
    }
  };

  useEffect(() => {
    if (hasPermission("booking.read")) loadBookings();
  }, [bookingsPage, bookingsPageSize, filters]);

  useEffect(() => {
    if (hasPermission("assignment.read")) loadAssignments();
  }, [assignmentsPage, assignmentsPageSize, assignSearch, assignStatus]);

  useEffect(() => {
    api.get("/tours", { params: { limit: 100 } }).then((r) => setTours(r.data.items ?? []));
  }, []);

  const openBooking = () => {
    api.get("/bookings", { params: { limit: 100 } }).then(() => {});
    bookingForm.resetFields();
    setBookingOpen(true);
  };

  const saveBooking = async () => {
    const values = await bookingForm.validateFields();
    setSavingBooking(true);
    try {
      await api.post("/bookings", {
        ...values,
        startingDate: values.startingDate?.toISOString(),
        totalPax: values.totalPax,
      });
      message.success("Booking created");
      setBookingOpen(false);
      loadBookings();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create booking"));
    } finally {
      setSavingBooking(false);
    }
  };

  const openAssignment = () => {
    assignForm.resetFields();
    setAssignOpen(true);
  };

  const saveAssignment = async () => {
    const values = await assignForm.validateFields();
    setSavingAssign(true);
    try {
      await api.post("/assignments", {
        ...values,
        startDate: values.startDate?.toISOString(),
        endDate: values.endDate?.toISOString(),
        priceOverride: values.priceOverride ?? undefined,
      });
      message.success("Assignment created");
      setAssignOpen(false);
      loadAssignments();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create assignment"));
    } finally {
      setSavingAssign(false);
    }
  };

  const openLink = async (assignment: any) => {
    setLinkAssignment(assignment);
    setLinkSelected([]);
    setLinkOpen(true);
    try {
      const r = await api.get("/bookings", {
        params: { limit: 100, status: "PENDING" },
      });
      setUnassignedBookings(r.data.items ?? []);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const saveLink = async () => {
    if (!linkAssignment || linkSelected.length === 0) return;
    setSavingLink(true);
    try {
      await api.post(`/assignments/${linkAssignment.id}/bookings`, { bookingIds: linkSelected });
      message.success("Bookings assigned");
      setLinkOpen(false);
      loadAssignments();
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSavingLink(false);
    }
  };

  const bookingColumns = centerColumns([
    { title: "Ref", dataIndex: "bookingRef", key: "bookingRef" },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      render: (v: any) => v ?? "—",
    },
    { title: "Date", dataIndex: "startingDate", key: "startingDate", render: (v: any) => (v ? new Date(v).toLocaleDateString() : "—") },
    {
      title: "End date",
      key: "endDate",
      render: (_: any, r: any) => fmtDate(endDate(r.startingDate, r.tour?.durationDays)),
    },
    {
      title: "Tour type",
      key: "tourType",
      render: (_: any, r: any) => {
        const t = r.tour?.type ?? r.tourType;
        return t ? <Tag color={t === "PRIVATE_TOUR" ? "purple" : "cyan"}>{t.replace("_", " ")}</Tag> : "—";
      },
    },
    { title: "Pax", dataIndex: "totalPax", key: "totalPax" },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
      render: (v: string) => <Tag>{v ?? "—"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Payment",
      dataIndex: "payment",
      key: "payment",
      render: (v: string | null) => (v ? <Tag color="green">{v}</Tag> : "—"),
    },
    ...(canUpdateBooking
      ? [
          {
            title: "Actions",
            key: "actions",
            render: (_: any, r: any) => (
              <Select
                size="small"
                value={r.status}
                style={{ width: 140 }}
                options={BOOKING_STATUS.map((s) => ({ value: s, label: s }))}
                onClick={(e) => e.stopPropagation()}
                onChange={async (status) => {
                  try {
                    await api.put(`/bookings/${r.id}`, { status });
                    message.success("Status updated");
                    loadBookings();
                  } catch (e) {
                    message.error(getErrorMessage(e));
                  }
                }}
              />
            ),
          },
        ]
      : []),
  ]);

  const assignmentColumns = [
    { title: "Code", dataIndex: "code", key: "code" },
    {
      title: "Start",
      dataIndex: "startDate",
      key: "startDate",
      render: (v: any) => new Date(v).toLocaleDateString(),
    },
    {
      title: "End",
      dataIndex: "endDate",
      key: "endDate",
      render: (v: any) => new Date(v).toLocaleDateString(),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: "Bookings",
      key: "bookings",
      render: (_: any, r: any) => r.bookings?.length ?? 0,
    },
    ...(canUpdateAssignment
      ? [
          {
            title: "Actions",
            key: "actions",
            render: (_: any, r: any) => (
              <Space>
                <Button size="small" onClick={() => openLink(r)}>
                  Assign bookings
                </Button>
                <Select
                  size="small"
                  value={r.status}
                  style={{ width: 130 }}
                  options={ASSIGNMENT_STATUS.map((s) => ({ value: s, label: s }))}
                  onChange={async (status) => {
                    try {
                      await api.put(`/assignments/${r.id}/status`, { status });
                      message.success("Status updated");
                      loadAssignments();
                    } catch (e) {
                      message.error(getErrorMessage(e));
                    }
                  }}
                />
              </Space>
            ),
          },
        ]
      : []),
  ];

  const canReadBookings = hasPermission("booking.read");
  const canReadAssignments = hasPermission("assignment.read");

  const renderBoardCard = (a: any) => {
    const capacity = a.vehicle?.capacity ?? 12;
    const isFull = a.totalPax >= capacity;
    const day = a.startDate ? dayjs(a.startDate).format("DD MMM YYYY") : "—";
    const today = dayjs().startOf("day").isSame(dayjs(a.startDate).startOf("day"));
    return (
      <Card
        key={a.id}
        size="small"
        style={{ marginBottom: 16, borderLeft: today ? "3px solid #f5222d" : undefined }}
        title={
          <Flex justify="space-between" align="center">
            <Space>
              <CarOutlined />
              <Typography.Text strong>{a.tourName ?? a.code}</Typography.Text>
              {today && <Tag color="red">Today</Tag>}
            </Space>
            <Tag color={a.status === "COMPLETED" ? "green" : a.status === "DISPATCHED" ? "blue" : "orange"}>
              {a.status}
            </Tag>
          </Flex>
        }
        extra={<Space>{a.code}</Space>}
      >
        <Flex vertical gap={6}>
          <Space wrap>
            <FieldTimeOutlined />
            <Typography.Text>
              {day} · {a.durationDays} day{a.durationDays > 1 ? "s" : ""}
            </Typography.Text>
          </Space>
          <Typography.Text>
            Driver: <b>{a.driver?.name ?? "—"}</b>
            {" | "}Guide: <b>{a.guide?.name ?? "—"}</b>
          </Typography.Text>
          <Typography.Text type={isFull ? "danger" : "secondary"}>
            {a.vehicle?.plateNumber ?? "No vehicle"} ({a.totalPax} / {capacity} pax)
            {isFull ? " - FULL" : ""}
          </Typography.Text>
        </Flex>
        <Divider style={{ margin: "12px 0" }} />
        <Typography.Text type="secondary">BOOKING LIST ({a.bookings?.length ?? 0}):</Typography.Text>
        <div style={{ marginTop: 8 }}>
          {a.bookings?.length ? (
            a.bookings.map((b: any) => (
              <div key={b.id} style={{ marginBottom: 8 }}>
                <Typography.Text>
                  [{b.bookingRef}] <b>{b.customerName ?? "no name"}</b> ({b.totalPax} pax)
                </Typography.Text>
                <div style={{ fontSize: 12, color: "#888" }}>
                  Pickup: {b.hotelName || b.address || "—"}
                </div>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">No bookings</Typography.Text>
          )}
        </div>
        {a.status !== "COMPLETED" && canUpdateAssignment && (
          <Button
            type="primary"
            size="small"
            block
            style={{ marginTop: 12 }}
            icon={<CheckOutlined />}
            loading={confirmingId === a.id}
            onClick={() => confirmTour(a)}
          >
            Confirm tour finished
          </Button>
        )}
        {a.status === "COMPLETED" && (
          <Tag color="green" style={{ marginTop: 12 }}>
            Completed — settlement prepared
          </Tag>
        )}
      </Card>
    );
  };

  const renderBoardColumn = (title: string, type: string, color: string) => {
    const items = boardData.filter((a) => a.tourType === type);
    const sorted = [...items].sort((a, b) =>
      dayjs(a.startDate).valueOf() - dayjs(b.startDate).valueOf(),
    );
    return (
      <div style={{ flex: 1, minWidth: 380 }}>
        <Typography.Title level={5} style={{ color, borderBottom: `2px solid ${color}`, paddingBottom: 8 }}>
          {title} ({sorted.length})
        </Typography.Title>
        {sorted.length ? sorted.map(renderBoardCard) : <Empty description={`No ${title.toLowerCase()}`} />}
      </div>
    );
  };

  return (
    <div>
      {!canReadBookings && !canReadAssignments && !canManageMailbox && (
        <Typography.Text type="secondary">You have no access to bookings.</Typography.Text>
      )}
      {(canReadBookings || canReadAssignments || canManageMailbox) && (
      <Tabs
        items={[
          ...(canManageMailbox
            ? [
                {
                  key: "rawdata",
                  label: (
                    <span>
                      <MailOutlined /> RawDataMail
                    </span>
                  ),
                  children: (
                    <Card
                      variant="borderless"
                      title="RawDataMail"
                      extra={
                        <Flex wrap gap={8} align="center">
                          <FilterBar
                            onSearch={(v) => {
                              setRawSearch(v.trim());
                              setRawDataPage(1);
                            }}
                            onReset={() => {
                              setRawSearch("");
                              setRawStatus(undefined);
                              setRawDataPage(1);
                            }}
                            searchPlaceholder="Search sourceId or email..."
                          >
                            <Select
                              allowClear
                              size="small"
                              placeholder="Status"
                              style={{ width: 130 }}
                              value={rawStatus}
                              onChange={(v) => {
                                setRawStatus(v);
                                setRawDataPage(1);
                              }}
                              options={["pending", "parsed", "unparsed", "parse_failed"].map(
                                (s) => ({ value: s, label: s }),
                              )}
                            />
                          </FilterBar>
                          <Button icon={<ReloadOutlined />} onClick={loadRawData}>
                            Refresh
                          </Button>
                        </Flex>
                      }
                    >
                      <Table
                        rowKey="id"
                        columns={rawDataColumns}
                        dataSource={rawData}
                        loading={rawDataLoading}
                        scroll={{ x: 1000 }}
                        pagination={{
                          current: rawDataPage,
                          pageSize: rawDataPageSize,
                          total: rawDataTotal,
                          showSizeChanger: true,
                          pageSizeOptions: PAGE_SIZE_OPTIONS,
                          onChange: paginationChange(
                            setRawDataPage,
                            setRawDataPageSize,
                            rawDataPageSize,
                          ),
                        }}
                      />
                    </Card>
                  ),
                },
              ]
            : []),
          {
            key: "bookings",
            label: "Bookings",
            children: (
              <Card
                variant="borderless"
                title="Bookings"
                extra={
                  <Flex wrap gap={8} align="center">
                    <FilterBar
                      onSearch={(v) => {
                        setFilters((prev) => ({ ...prev, q: v.trim() || undefined }));
                        setBookingsPage(1);
                      }}
                      onReset={() => {
                        setFilters({});
                        setBookingsPage(1);
                      }}
                      searchPlaceholder="Search ref, customer, phone..."
                    >
                      <Select
                        allowClear
                        size="small"
                        placeholder="Status"
                        style={{ width: 120 }}
                        value={filters.status}
                        onChange={(v) => {
                          setFilters((prev) => ({ ...prev, status: v }));
                          setBookingsPage(1);
                        }}
                        options={BOOKING_STATUS.map((s) => ({ value: s, label: s }))}
                      />
                      <Select
                        allowClear
                        size="small"
                        placeholder="Channel"
                        style={{ width: 130 }}
                        value={filters.channel}
                        onChange={(v) => {
                          setFilters((prev) => ({ ...prev, channel: v }));
                          setBookingsPage(1);
                        }}
                        options={BOOKING_CHANNELS.map((c) => ({ value: c, label: c }))}
                      />
                      <Select
                        allowClear
                        size="small"
                        placeholder="Payment"
                        style={{ width: 120 }}
                        value={filters.payment}
                        onChange={(v) => {
                          setFilters((prev) => ({ ...prev, payment: v }));
                          setBookingsPage(1);
                        }}
                        options={PAYMENT_STATUS.map((s) => ({ value: s, label: s }))}
                      />
                    </FilterBar>
                    {canCreateBooking && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={openBooking}>
                        Add Booking
                      </Button>
                    )}
                  </Flex>
                }
              >
                <Table
                  rowKey="id"
                  columns={bookingColumns}
                  dataSource={bookings}
                  loading={bookingsLoading}
                  onRow={(record) => ({
                    style: { cursor: "pointer" },
                    onClick: () => setBookingDetail(record),
                  })}
                  pagination={{
                    current: bookingsPage,
                    pageSize: bookingsPageSize,
                    total: bookingsTotal,
                    showSizeChanger: true,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    onChange: paginationChange(setBookingsPage, setBookingsPageSize, bookingsPageSize),
                  }}
                />
              </Card>
            ),
          },
          {
            key: "assignments",
            label: "Assignments",
            children: (
              <Card
                variant="borderless"
                title="Assignments"
                extra={
                  <Flex wrap gap={8} align="center">
                    <FilterBar
                      onSearch={(v) => {
                        setAssignSearch(v.trim());
                        setAssignmentsPage(1);
                      }}
                      onReset={() => {
                        setAssignSearch("");
                        setAssignStatus(undefined);
                        setAssignmentsPage(1);
                      }}
                      searchPlaceholder="Search code, vehicle, driver, guide..."
                    >
                      <Select
                        allowClear
                        size="small"
                        placeholder="Status"
                        style={{ width: 120 }}
                        value={assignStatus}
                        onChange={(v) => {
                          setAssignStatus(v);
                          setAssignmentsPage(1);
                        }}
                        options={ASSIGNMENT_STATUS.map((s) => ({ value: s, label: s }))}
                      />
                      </FilterBar>
                      <Button
                        icon={<ScheduleOutlined />}
                        onClick={openBoard}
                      >
                        Dispatch Board
                      </Button>
                      {canCreateAssignment && (
                        <Button type="primary" icon={<PlusOutlined />} onClick={openAssignment}>
                          Add Assignment
                        </Button>
                      )}
                    </Flex>
                  }
                >
                <Table
                  rowKey="id"
                  columns={assignmentColumns}
                  dataSource={assignments}
                  loading={assignmentsLoading}
                  pagination={{
                    current: assignmentsPage,
                    pageSize: assignmentsPageSize,
                    total: assignmentsTotal,
                    showSizeChanger: true,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    onChange: paginationChange(setAssignmentsPage, setAssignmentsPageSize, assignmentsPageSize),
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
      )}

      <Drawer title="Add Booking" open={bookingOpen} onClose={() => setBookingOpen(false)} width={480}>
        <Form form={bookingForm} layout="vertical">
          <Form.Item name="bookingRef" label="Booking Ref" rules={[{ required: true }]}>
            <Input placeholder="e.g. BK-001" />
          </Form.Item>
          <Form.Item name="tourId" label="Tour">
            <Select allowClear options={tours.map((t) => ({ value: t.id, label: t.name }))} />
          </Form.Item>
          <Form.Item name="customerName" label="Customer name">
            <Input />
          </Form.Item>
          <Form.Item name="hotelName" label="Hotel">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input />
          </Form.Item>
          <Form.Item name="mail" label="Email">
            <Input />
          </Form.Item>
          <Form.Item name="startingDate" label="Start date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="totalPax" label="Total pax">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="paxDetail" label="Pax detail">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" block loading={savingBooking} onClick={saveBooking}>
            Save
          </Button>
        </Form>
      </Drawer>

      <Drawer title="Add Assignment" open={assignOpen} onClose={() => setAssignOpen(false)} width={480}>
        <Form form={assignForm} layout="vertical">
          <Form.Item name="startDate" label="Start date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="endDate" label="End date" rules={[{ required: true }]}>
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="vehicleId" label="Vehicle ID">
            <Input />
          </Form.Item>
          <Form.Item name="driverId" label="Driver ID">
            <Input />
          </Form.Item>
          <Form.Item name="guideId" label="Guide ID">
            <Input />
          </Form.Item>
          <Form.Item name="priceOverride" label="Price override">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="tripNotes" label="Trip notes">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" block loading={savingAssign} onClick={saveAssignment}>
            Save
          </Button>
        </Form>
      </Drawer>

      <Drawer
        title={`Assign bookings to ${linkAssignment?.code ?? ""}`}
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        width={480}
      >
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="Select bookings"
          value={linkSelected}
          onChange={setLinkSelected}
          options={unassignedBookings.map((b) => ({
            value: b.id,
            label: `${b.bookingRef} — ${b.customerName ?? "no name"}`,
          }))}
        />
        <Button
          type="primary"
          block
          loading={savingLink}
          disabled={linkSelected.length === 0}
          onClick={saveLink}
          style={{ marginTop: 16 }}
        >
          Assign
        </Button>
      </Drawer>

      <Drawer
        title="Tour Operations & Dispatch Board"
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        width="100%"
        loading={boardLoading}
      >
        {boardLoading ? (
          <Flex justify="center" style={{ padding: 48 }}>
            <Typography.Text type="secondary">Loading board…</Typography.Text>
          </Flex>
        ) : boardData.length === 0 ? (
          <Empty description="No upcoming tours" />
        ) : (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {renderBoardColumn("PRIVATE TOURS", "PRIVATE_TOUR", "#1677ff")}
            {renderBoardColumn("GROUP TOURS", "GROUP_TOUR", "#722ed1")}
          </div>
        )}
      </Drawer>

      <Drawer
        title={`RawDataMail payload · ${rawDetail?.id ?? ""}`}
        open={Boolean(rawDetail)}
        onClose={() => setRawDetail(null)}
        width={720}
      >
        {rawDetail && (
          <Flex vertical gap={8}>
            <Flex wrap gap={8}>
              <Tag color={RAW_DATA_STATUS_COLORS[rawDetail.status] ?? "default"}>
                {rawDetail.status}
              </Tag>
              {rawDetail.templateTag && <Tag>{rawDetail.templateTag}</Tag>}
              {rawDetail.bookingId && (
                <Tag color="green">→ booking {rawDetail.bookingId}</Tag>
              )}
            </Flex>
            <Typography.Text>
              <Typography.Text type="secondary">Source: </Typography.Text>
              {rawDetail.sourceId}
            </Typography.Text>
            <Typography.Text>
              <Typography.Text type="secondary">From: </Typography.Text>
              {rawDetail.payload?.from ?? "—"}
            </Typography.Text>
            <Typography.Text>
              <Typography.Text type="secondary">Subject: </Typography.Text>
              {rawDetail.payload?.subject ?? "—"}
            </Typography.Text>
            <Typography.Text type="secondary">Payload:</Typography.Text>
            <pre
              style={{
                background: "#111",
                color: "#ddd",
                padding: 12,
                borderRadius: 8,
                maxHeight: 420,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
              }}
            >
              {JSON.stringify(rawDetail.payload, null, 2)}
            </pre>
          </Flex>
        )}
      </Drawer>

      <Drawer
        title={`Booking · ${bookingDetail?.bookingRef ?? ""}`}
        open={Boolean(bookingDetail)}
        onClose={() => setBookingDetail(null)}
        width={520}
      >
        {bookingDetail && (
          <Descriptions
            column={1}
            size="small"
            bordered
            items={[
              { key: "ref", label: "Ref", children: bookingDetail.bookingRef ?? "—" },
              { key: "conf", label: "Confirmation", children: bookingDetail.confirmationCode ?? "—" },
              { key: "source", label: "Source", children: bookingDetail.source ?? "—" },
              { key: "channel", label: "Channel", children: bookingDetail.channel ?? "—" },
              { key: "customer", label: "Customer", children: bookingDetail.customerName ?? "—" },
              { key: "phone", label: "Phone", children: bookingDetail.phone ?? "—" },
              { key: "mail", label: "Email", children: bookingDetail.mail ?? "—" },
              { key: "hotel", label: "Hotel", children: bookingDetail.hotelName ?? "—" },
              { key: "tour", label: "Tour", children: bookingDetail.tour?.name ?? bookingDetail.tourName ?? "—" },
              { key: "tourType", label: "Tour type", children: bookingDetail.tourType ?? "—" },
              { key: "start", label: "Start date", children: bookingDetail.startingDate ? new Date(bookingDetail.startingDate).toLocaleString() : "—" },
              { key: "end", label: "End date", children: fmtDate(endDate(bookingDetail.startingDate, bookingDetail.tour?.durationDays)) },
              { key: "pax", label: "Pax", children: `${bookingDetail.totalPax ?? 0}${bookingDetail.paxDetail ? ` · ${bookingDetail.paxDetail}` : ""}` },
              { key: "address", label: "Address", children: bookingDetail.address ?? "—" },
              { key: "location", label: "Location (lat/lng)", children: bookingDetail.latitude != null ? `${bookingDetail.latitude}, ${bookingDetail.longitude ?? ""}` : "—" },
              { key: "status", label: "Status", children: bookingDetail.status ?? "—" },
              { key: "payment", label: "Payment", children: bookingDetail.payment ?? "—" },
              { key: "noShow", label: "No-show", children: bookingDetail.isNoShow ? (bookingDetail.noShowReason ?? "Yes") : "No" },
              { key: "assignment", label: "Assignment", children: bookingDetail.assignmentId ?? "—" },
              { key: "created", label: "Created", children: new Date(bookingDetail.createdAt).toLocaleString() },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
}
