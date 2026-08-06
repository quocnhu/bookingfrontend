"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  DatePicker,
  Drawer,
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
import { PlusOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import FilterBar from "@/components/filter-bar";

const BOOKING_STATUS = ["PENDING", "ASSIGNED", "CANCELED"];
const ASSIGNMENT_STATUS = ["PENDING", "DISPATCHED", "COMPLETED", "CANCELED"];
const BOOKING_CHANNELS = ["TRIPADVISOR", "WEBSITE", "MANUAL"];
const PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED"];

export default function BookingsPage() {
  const { hasPermission } = useApp();
  const canCreateBooking = hasPermission("booking.create");
  const canUpdateBooking = hasPermission("booking.update");
  const canCreateAssignment = hasPermission("assignment.create");
  const canUpdateAssignment = hasPermission("assignment.update");

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

  return (
    <div>
      {!canReadBookings && !canReadAssignments && (
        <Typography.Text type="secondary">You have no access to bookings.</Typography.Text>
      )}
      {(canReadBookings || canReadAssignments) && (
      <Tabs
        items={[
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
    </div>
  );
}
