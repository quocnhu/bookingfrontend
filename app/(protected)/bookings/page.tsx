"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AutoComplete,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  CarOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import DispatchBoard from "@/components/dispatch-board";

const BOOKING_STATUS = ["PENDING", "ASSIGNED", "CANCELED"];
const ASSIGNMENT_STATUS = ["PENDING", "DISPATCHED", "COMPLETED", "CANCELED"];
const BOOKING_CHANNELS = ["TRIPADVISOR", "GETYOURGUIDE", "WEBSITE", "MANUAL", "AIRBNB", "BOOKING_COM"];
const PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED"];
const TOUR_TYPES = ["PRIVATE_TOUR", "GROUP_TOUR"];

/**
 * Fixed table body height so every page reserves a full page of rows:
 * 2 items → same height as 10 items, leftover is empty space, pagination
 * stays at the same line. No mid-row cut: y is an exact multiple of the
 * small-row height, so a full page fits without cropping.
 */
const ROW_H = 41;
const bodyY = (pageSize: number) => pageSize * ROW_H;

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
  const canUpdateAssignment = hasPermission("assignment.update");
  const canManageMailbox = hasPermission("gmail.manage");

  const [bookings, setBookings] = useState<any[]>([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPageSize, setBookingsPageSize] = useState(20);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentsPageSize, setAssignmentsPageSize] = useState(20);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  const [boardOpen, setBoardOpen] = useState(false);


  const [tours, setTours] = useState<any[]>([]);
  const [coordinates, setCoordinates] = useState<any[]>([]);
  const [unassignedBookings, setUnassignedBookings] = useState<any[]>([]);

  const [bookingOpen, setBookingOpen] = useState(false);
  /** The auto-generated ref currently sitting in the form — used to tell whether it may be overwritten when the Tour type changes. */
  const autoRef = useRef("");
  const [bookingForm] = Form.useForm();
  const [savingBooking, setSavingBooking] = useState(false);

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkAssignment, setLinkAssignment] = useState<any>(null);
  const [linkSelected, setLinkSelected] = useState<string[]>([]);
  const [savingLink, setSavingLink] = useState(false);

  const [bookingDetail, setBookingDetail] = useState<any>(null);

  const [rawData, setRawData] = useState<any[]>([]);
  const [rawDataTotal, setRawDataTotal] = useState(0);
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize, setRawDataPageSize] = useState(20);
  const [rawDataLoading, setRawDataLoading] = useState(false);
  const [rawDetail, setRawDetail] = useState<any>(null);

  const [activeTab, setActiveTab] = useState(() => {
    // Keep the tab position across refreshes: reload on Assignments must
    // land back on Assignments, not kick to Bookings. URL param wins (shareable),
    // then localStorage (last position), else default.
    if (typeof window !== "undefined") {
      const urlTab = new URLSearchParams(window.location.search).get("tab");
      if (urlTab && ["rawdata", "bookings", "assignments"].includes(urlTab)) return urlTab;
      const saved = window.localStorage.getItem("bookings-tab");
      if (saved && ["rawdata", "bookings", "assignments"].includes(saved)) return saved;
    }
    return "bookings";
  });

  const changeTab = (key: string) => {
    setActiveTab(key);
    try {
      window.localStorage.setItem("bookings-tab", key);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", key);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* storage/URL sync is best-effort */
    }
  };

  const loadRawData = () => {
    setRawDataLoading(true);
    const params: Record<string, any> = {
      page: rawDataPage,
      limit: rawDataPageSize,
    };
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
  }, [canManageMailbox, rawDataPage, rawDataPageSize]);

  const RAW_DATA_STATUS_COLORS: Record<string, string> = {
    pending: "geekblue",
    parsed: "green",
    unparsed: "orange",
    parse_failed: "red",
  };

  const rawDataColumns = centerColumns([
    indexColumn(rawDataPage, rawDataPageSize),
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v: string) => (
        <Tag color={RAW_DATA_STATUS_COLORS[v] ?? "default"}>{v}</Tag>
      ),
      filters: ["pending", "parsed", "unparsed", "parse_failed"].map((s) => ({ text: s, value: s })),
      onFilter: (v: any, r: any) => r.status === v,
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (v: any) => (v ? <Typography.Text>{v}</Typography.Text> : "—"),
      onFilter: (v: any, r: any) => (r.email ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Received",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: any) => (v ? new Date(v).toLocaleString() : "—"),
      filters: Array.from(new Set(rawData.map((r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : null).filter(Boolean))).map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() === v : false,
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
        params: { page: bookingsPage, limit: bookingsPageSize },
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
          page: 1,
          limit: 1000,
          sortOrder: "asc",
        },
      })
      .then((r) => {
        setAssignments(r.data.items ?? []);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setAssignmentsLoading(false));
  };

  useEffect(() => {
    if (hasPermission("booking.read")) loadBookings();
  }, [bookingsPage, bookingsPageSize]);

  useEffect(() => {
    if (hasPermission("assignment.read")) loadAssignments();
  }, [assignmentsPage, assignmentsPageSize]);

  useEffect(() => {
    api.get("/tours", { params: { limit: 100 } }).then((r) => setTours(r.data.items ?? []));
    api.get("/coordinates", { params: { limit: 1000 } }).then((r) => setCoordinates(r.data.items ?? []));
  }, []);

  /**
   * Fill in the Booking Ref according to the tour type.
   *
   * Overwritten only when the field is empty OR when the current value is exactly
   * the code we generated ourselves earlier (autoRef) — otherwise changing the tour
   * type would not change the prefix, and the ref would keep `MB-` even after
   * Private has been selected.
   *
   * If the user has typed one by hand, never touch it: respect their intent.
   * `autoRef` is cleared when they edit the field, so the next tour type change
   * does not generate another one.
   */
  const fillBookingRef = async (tourType?: string | null) => {
    const current = String(bookingForm.getFieldValue("bookingRef") ?? "").trim();
    if (current && current !== autoRef.current) return;
    try {
      const { data } = await api.get("/bookings/next-ref", {
        params: tourType ? { tourType } : undefined,
      });
      autoRef.current = data;
      bookingForm.setFieldValue("bookingRef", data);
    } catch {
      // If it cannot be fetched, leave it empty — the server generates one on save.
    }
  };

  const openBooking = () => {
    bookingForm.resetFields();
    autoRef.current = "";
    setBookingOpen(true);
    void fillBookingRef();
  };

  const saveBooking = async () => {
    // Block at the form level: report the per-field errors and scroll to the first invalid field at the same time.
    try {
      await bookingForm.scrollToField(["tourId"], { block: "center", behavior: "smooth" });
    } catch {
      /* if it has not rendered yet, skip it */
    }
    const values = await bookingForm.validateFields();
    setSavingBooking(true);
    try {
      await api.post("/bookings", {
        ...values,
        startingDate: values.startingDate?.format("YYYY-MM-DD"),
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
    indexColumn(bookingsPage, bookingsPageSize),
    {
      title: "Ref",
      dataIndex: "bookingRef",
      key: "bookingRef",
      width: 110,
      ellipsis: true,
      render: (v: any) => (
        <Typography.Text strong style={{ fontSize: 12 }}>
          {v ?? "—"}
        </Typography.Text>
      ),
      onFilter: (v: any, r: any) => (r.bookingRef ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      width: 150,
      ellipsis: true,
      render: (v: any) =>
        v ? (
          <Typography.Text style={{ fontSize: 12 }} title={v}>
            {v}
          </Typography.Text>
        ) : "—",
      onFilter: (v: any, r: any) => (r.customerName ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Hotel",
      key: "hotel",
      width: 200,
      ellipsis: true,
      render: (_: any, r: any) => {
        const h = r.hotelName;
        return h ? (
          <Typography.Text style={{ fontSize: 12 }} title={h}>
            {h}
          </Typography.Text>
        ) : "—";
      },
      filters: Array.from(new Set(bookings.map((b: any) => b.hotelName).filter(Boolean))).sort().map((h: any) => ({ text: h, value: h })),
      onFilter: (v: any, r: any) => (r.hotelName ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Address",
      key: "address",
      width: 260,
      ellipsis: true,
      render: (_: any, r: any) => {
        const a = r.address;
        return a ? (
          <Typography.Text style={{ fontSize: 12 }} title={a}>
            {a}
          </Typography.Text>
        ) : "—";
      },
      filters: Array.from(new Set(bookings.map((b: any) => b.address).filter(Boolean))).sort().map((a: any) => ({ text: a, value: a })),
      onFilter: (v: any, r: any) => (r.address ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Phone",
      key: "phone",
      width: 140,
      render: (_: any, r: any) => {
        const p = r.phone;
        return p ? (
          <Typography.Text style={{ fontSize: 12 }} title={p}>
            {p}
          </Typography.Text>
        ) : "—";
      },
      onFilter: (v: any, r: any) => (r.phone ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Tour",
      key: "tourInfo",
      width: 220,
      render: (_: any, r: any) => {
        const name = r.tourName ?? r.tour?.name;
        const type = r.tour?.type ?? r.tourType;
        const days = r.tour?.durationDays ?? r.durationDays;
        return (
          <Flex vertical gap={2}>
            <Typography.Text
              style={{ fontSize: 12 }}
              ellipsis={{ tooltip: name ?? "—" }}
            >
              {name ?? "—"}
            </Typography.Text>
            <Space size={4} wrap>
              {type && (
                <Tag
                  color={type === "PRIVATE_TOUR" ? "purple" : "cyan"}
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {type.replace("_", " ")}
                </Tag>
              )}
              {days ? (
                <Tag style={{ margin: 0, fontSize: 10 }}>
                  {days === 1 ? "1 Day" : `${days} Days`}
                </Tag>
              ) : null}
            </Space>
          </Flex>
        );
      },
      onFilter: (v: any, r: any) => ((r.tourName ?? r.tour?.name) ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Date",
      dataIndex: "startingDate",
      key: "startingDate",
      width: 100,
      render: (v: any) => (v ? new Date(v).toLocaleDateString() : "—"),
      sorter: (a: any, b: any) =>
        new Date(a.startingDate).getTime() - new Date(b.startingDate).getTime(),
    },
    {
      title: "Pax",
      dataIndex: "totalPax",
      key: "totalPax",
      width: 60,
      render: (v: number) => (v ? <Typography.Text strong>{v}</Typography.Text> : "—"),
    },
    {
      title: "Channel",
      dataIndex: "channel",
      key: "channel",
      width: 110,
      render: (v: string) => <Tag style={{ margin: 0, fontSize: 10 }}>{v ?? "—"}</Tag>,
      filters: BOOKING_CHANNELS.map((c) => ({ text: c, value: c })),
      onFilter: (v: any, r: any) => r.channel === v,
    },
{
      title: "Payment",
      dataIndex: "payment",
      key: "payment",
      width: 90,
      render: (v: string | null) => (v ? <Tag color="green" style={{ margin: 0, fontSize: 10 }}>{v}</Tag> : "—"),
      filters: PAYMENT_STATUS.map((s) => ({ text: s, value: s })),
      onFilter: (v: any, r: any) => r.payment === v,
    },
    {
      title: "Note",
      key: "notes",
      width: 200,
      ellipsis: true,
      render: (_: any, r: any) => {
        const n = r.notes;
        return n ? (
          <Typography.Text style={{ fontSize: 12 }} title={n}>
            {n}
          </Typography.Text>
        ) : "—";
      },
      onFilter: (v: any, r: any) => (r.notes ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (v: string) => (
        <Tag color={v === "CANCELED" ? "red" : "blue"} style={{ margin: 0, fontSize: 10 }}>
          {v}
        </Tag>
      ),
      filters: BOOKING_STATUS.map((s) => ({ text: s, value: s })),
      onFilter: (v: any, r: any) => r.status === v,
    },
    ...(canUpdateBooking
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 140,
            fixed: "right" as const,
            render: (_: any, r: any) => (
              <div style={{ whiteSpace: "nowrap" }}>
                <Select
                  size="small"
                  value={r.status}
                  style={{ width: 130 }}
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
              </div>
            ),
          },
        ]
      : []),
  ]);

  const ASSIGNMENT_STATUS_COLORS: Record<string, string> = {
    DRAFT_ASSIGNED: "gold",
    PENDING: "orange",
    TRANSFERRED: "volcano",
    DISPATCHED: "blue",
    COMPLETED: "green",
    CANCELED: "red",
  };

  const BOOKING_STATUS_COLORS: Record<string, string> = {
    PENDING: "gold",
    ASSIGNED: "green",
    CANCELED: "red",
  };

  // Flatten assignments → per-booking rows for the manifest table
  const assignmentRows = useMemo(() => {
    const rows: any[] = [];
    for (const a of assignments) {
      if (!a.bookings || a.bookings.length === 0) {
        rows.push({
          key: `${a.id}-empty`,
          assignmentId: a.id,
          assignmentCode: a.code,
          assignmentStatus: a.status,
          startDate: a.startDate,
          endDate: a.endDate,
          vehiclePlate: a.vehicle?.plateNumber ?? "—",
          guideName: a.guide?.name ?? "—",
          driverName: a.driver?.name ?? "—",
          tourName: a.tourName ?? "—",
          tourType: a.tourType,
          latitude: a.latitude,
          longitude: a.longitude,
          bookingRef: "—",
          customerName: "—",
          hotelName: "—",
          totalPax: 0,
          paxSequence: 0,
          bookingStatus: "—",
          payment: "—",
          isEmpty: true,
        });
      } else {
        for (const b of a.bookings) {
          rows.push({
            key: b.id,
            assignmentId: a.id,
            assignmentCode: a.code,
            assignmentStatus: a.status,
            startDate: a.startDate,
            endDate: a.endDate,
            vehiclePlate: a.vehicle?.plateNumber ?? "—",
            guideName: a.guide?.name ?? "—",
            driverName: a.driver?.name ?? "—",
            tourName: a.tourName ?? b.tourName ?? "—",
            tourType: a.tourType ?? b.tourType,
            latitude: a.latitude ?? b.latitude,
            longitude: a.longitude ?? b.longitude,
            bookingRef: b.bookingRef ?? "—",
            customerName: b.customerName ?? "—",
            hotelName: b.hotelName ?? "—",
            totalPax: b.totalPax ?? 0,
            paxSequence: b.paxSequence ?? 0,
          bookingStatus: b.status ?? "—",
          payment: b.payment ?? "—",
          isEmpty: false,
          });
        }
      }
    }
    return rows;
  }, [assignments]);

  const assignmentColumns = centerColumns([
    indexColumn(assignmentsPage, assignmentsPageSize),
    {
      title: "Vehicle",
      key: "vehicle",
      width: 130,
      render: (_: any, r: any) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography.Text strong style={{ fontSize: 12 }}>
            {r.assignmentCode}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            <CarOutlined /> {r.vehiclePlate}
          </Typography.Text>
        </div>
      ),
      onFilter: (v: any, r: any) => (r.assignmentCode ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Date",
      key: "date",
      width: 95,
      render: (_: any, r: any) => (
        <Typography.Text style={{ fontSize: 12 }}>
          {new Date(r.startDate).toLocaleDateString()}
        </Typography.Text>
      ),
      filters: Array.from(new Set(assignmentRows.map((r: any) => r.startDate).filter(Boolean))).sort().map((d: any) => ({ text: new Date(d).toLocaleDateString(), value: d })),
      onFilter: (v: any, r: any) => r.startDate === v,
    },
    {
      title: "Tour",
      dataIndex: "tourName",
      key: "tourName",
      width: 220,
      render: (v: string, r: any) => (
        <Typography.Text style={{ fontSize: 12 }}>
          {v}
          {r.tourType ? (
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {` · ${r.tourType === "GROUP_TOUR" ? "Group" : r.tourType === "PRIVATE_TOUR" ? "Private" : r.tourType}`}
            </Typography.Text>
          ) : null}
        </Typography.Text>
      ),
      filters: Array.from(new Set(assignmentRows.map((r: any) => r.tourName).filter((v: any) => v && v !== "—"))).sort().map((t: any) => ({ text: t, value: t })),
      onFilter: (v: any, r: any) => r.tourName === v,
    },
    {
      title: "Tour Type",
      dataIndex: "tourType",
      key: "tourType",
      width: 120,
      render: (v: string) =>
        v ? (
          <Tag
            color={v === "GROUP_TOUR" ? "blue" : v === "PRIVATE_TOUR" ? "purple" : "default"}
            style={{ margin: 0, fontSize: 11, fontWeight: 600 }}
          >
            {v === "GROUP_TOUR" ? "Group" : v === "PRIVATE_TOUR" ? "Private" : v}
          </Tag>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
      filters: [
        { text: "Group", value: "GROUP_TOUR" },
        { text: "Private", value: "PRIVATE_TOUR" },
      ],
      onFilter: (v: any, r: any) => r.tourType === v,
    },
    {
      title: "Guide",
      dataIndex: "guideName",
      key: "guideName",
      width: 120,
      render: (v: string) => (
        <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
          {v}
        </Tag>
      ),
      filters: Array.from(new Set(assignmentRows.map((r: any) => r.guideName).filter(Boolean))).sort().map((g: any) => ({ text: g, value: g })),
      onFilter: (v: any, r: any) => r.guideName === v,
    },
    {
      title: "Driver",
      dataIndex: "driverName",
      key: "driverName",
      width: 110,
      ellipsis: true,
      render: (v: string) => (
        <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
          {v}
        </Tag>
      ),
      filters: Array.from(new Set(assignmentRows.map((r: any) => r.driverName).filter(Boolean))).sort().map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => r.driverName === v,
    },
    {
      title: "Booking",
      key: "bookingRef",
      width: 100,
      render: (_: any, r: any) => (
        <Typography.Text strong style={{ fontSize: 12 }}>
          {r.bookingRef}
        </Typography.Text>
      ),
      onFilter: (v: any, r: any) => (r.bookingRef ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      width: 150,
      render: (v: string) => <Typography.Text style={{ fontSize: 12 }}>{v}</Typography.Text>,
      onFilter: (v: any, r: any) => (r.customerName ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Hotel / Room",
      dataIndex: "hotelName",
      key: "hotelName",
      width: 170,
      render: (v: string) => (
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>{v}</Typography.Text>
      ),
      onFilter: (v: any, r: any) => (r.hotelName ?? "").toLowerCase().includes(v.toLowerCase()),
    },
    {
      title: "Coordinates",
      key: "coordinates",
      width: 170,
      render: (_: any, r: any) =>
        r.latitude != null && r.longitude != null ? (
          <a
            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 12 }}
          >
            📍 {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}
          </a>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Typography.Text>
        ),
    },
    {
      title: "Pax",
      dataIndex: "totalPax",
      key: "totalPax",
      width: 72,
      align: "center" as const,
      render: (v: number) => <Typography.Text strong>{v}</Typography.Text>,
      filters: Array.from(new Set(assignmentRows.map((r: any) => r.totalPax).filter(Boolean))).sort((a: number, b: number) => a - b).map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => r.totalPax === v,
    },
    {
      title: "Seq",
      dataIndex: "paxSequence",
      key: "paxSequence",
      width: 72,
      align: "center" as const,
      render: (v: number) => <Typography.Text type="secondary">{v > 0 ? v : ""}</Typography.Text>,
      filters: Array.from(new Set(assignmentRows.map((r: any) => r.paxSequence).filter((v: any) => v > 0))).sort((a: number, b: number) => a - b).map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => r.paxSequence === v,
    },
    {
      title: "Booking Status",
      dataIndex: "bookingStatus",
      key: "bookingStatus",
      width: 140,
      render: (v: string) => (
        <Tag
          color={BOOKING_STATUS_COLORS[v] ?? "default"}
          style={{ margin: 0, fontSize: 10, fontWeight: 600 }}
        >
          {v}
        </Tag>
      ),
      filters: BOOKING_STATUS.map((s) => ({ text: s, value: s })),
      onFilter: (v: any, r: any) => r.bookingStatus === v,
    },
    {
      title: "Bus Status",
      dataIndex: "assignmentStatus",
      key: "assignmentStatus",
      width: 130,
      render: (v: string) => (
        <Tag
          color={ASSIGNMENT_STATUS_COLORS[v] ?? "default"}
          style={{ margin: 0, fontSize: 10 }}
        >
          {v}
        </Tag>
      ),
      filters: ASSIGNMENT_STATUS.map((s) => ({ text: s, value: s })),
      onFilter: (v: any, r: any) => r.assignmentStatus === v,
    },
    ...(canUpdateAssignment
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 160,
            fixed: "right" as const,
            render: (_: any, r: any) => (
              <Space size={4} style={{ whiteSpace: "nowrap" }}>
                <Button size="small" onClick={() => {
                  const a = assignments.find((x: any) => x.id === r.assignmentId);
                  if (a) openLink(a);
                }}>
                  Reassign
                </Button>
                <Select
                  size="small"
                  value={r.assignmentStatus}
                  style={{ width: 90 }}
                  options={ASSIGNMENT_STATUS.map((s) => ({ value: s, label: s }))}
                  onClick={(e) => e.stopPropagation()}
                  onChange={async (status) => {
                    try {
                      await api.put(`/assignments/${r.assignmentId}/status`, { status });
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
  ]);

  const canReadBookings = hasPermission("booking.read");
  const canReadAssignments = hasPermission("assignment.read");

  return (
    <div
      className="bookings-page"
      style={{
        minHeight: "calc(100vh - 96px)",
      }}
    >
      <style>{`
        .bookings-page .ant-tabs-tabpane .ant-card-body { padding-bottom: 8px; }
        .bookings-page .ant-table-pagination { margin-bottom: 0; padding: 8px 0 4px; }
        .bookings-page .ant-empty { margin: 48px 0; }
      `}</style>
      {!canReadBookings && !canReadAssignments && !canManageMailbox && (
        <Typography.Text type="secondary">You have no access to bookings.</Typography.Text>
      )}
      {(canReadBookings || canReadAssignments || canManageMailbox) && (
      <Tabs
        activeKey={activeTab}
        onChange={changeTab}
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
                        scroll={{ x: 1000, y: bodyY(rawDataPageSize) }}
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
                  size="small"
                  columns={bookingColumns}
                  dataSource={bookings}
                  loading={bookingsLoading}
                  scroll={{ x: 1660, y: bodyY(bookingsPageSize) }}
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
                  <Button
                    icon={<ScheduleOutlined />}
                    onClick={() => setBoardOpen(true)}
                  >
                    Dispatch Board
                  </Button>
                }
                >
                <Table
                  rowKey="key"
                  size="small"
                  columns={assignmentColumns}
                  dataSource={assignmentRows}
                  loading={assignmentsLoading}
                  scroll={{ x: 1500, y: bodyY(assignmentsPageSize) }}
                  pagination={{
                    current: assignmentsPage,
                    pageSize: assignmentsPageSize,
                    total: assignmentRows.length,
                    showSizeChanger: true,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    showTotal: (t) => `${t} booking(s)`,
                    onChange: paginationChange(setAssignmentsPage, setAssignmentsPageSize, assignmentsPageSize),
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
      )}

      <Drawer title="Add Booking" open={bookingOpen} onClose={() => setBookingOpen(false)} size={480}>
        <Form form={bookingForm} layout="vertical">
          <Form.Item
            name="bookingRef"
            label="Booking Ref"
            extra="Auto-generated based on Tour type. Delete it to have the system generate a different code on save."
          >
            <Input
              placeholder="GR-3f2b8c1a-11d2-4f3a-9c8b-7e6d5c4b3a2f"
              onChange={(e) => {
                // Typed by hand → treat it as the user's own, do not generate again.
                autoRef.current = "";
                bookingForm.setFieldValue("bookingRef", e.target.value);
              }}
            />
          </Form.Item>
          <Form.Item
            name="tourId"
            label="Tour"
            required
            rules={[{ required: true, message: "Please pick a tour" }]}
          >
            <Select
              allowClear
              placeholder="Pick a tour"
              options={tours.map((t) => ({ value: t.id, label: t.name }))}
              onChange={async (id) => {
                const t = tours.find((x) => x.id === id);
                if (t?.type) {
                  bookingForm.setFieldValue("tourType", t.type);
                  await fillBookingRef(t.type);
                }
              }}
            />
          </Form.Item>
          <Form.Item
            name="tourType"
            label="Tour type"
            required
            rules={[{ required: true, message: "Please pick a tour type" }]}
          >
            <Select
              allowClear
              placeholder="Auto-filled from tour, change if needed"
              options={[
                { value: "PRIVATE_TOUR", label: "Private Tour" },
                { value: "GROUP_TOUR", label: "Group Tour" },
              ]}
              onChange={(t) => fillBookingRef(t)}
            />
          </Form.Item>
          <Form.Item
            name="customerName"
            label="Customer name"
            required
            rules={[
              { required: true, message: "Customer name is required" },
              { max: 200, message: "Customer name max 200 characters" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="hotelName"
            label="Hotel"
            rules={[{ required: true, message: "Please pick a hotel from the list or type a new one" }, { max: 200, message: "Hotel name max 200 characters" }]}
            required
          >
            <AutoComplete
              options={coordinates.map((c: any) => ({ value: c.hotelName }))}
              filterOption={(input, option) =>
                String(option?.value ?? "").toLowerCase().includes(input.toLowerCase())
              }
              onChange={(value) => {
                const c = coordinates.find(
                  (x: any) => x.hotelName.toLowerCase() === String(value ?? "").trim().toLowerCase(),
                );
                if (c) {
                  bookingForm.setFieldsValue({
                    address: c.address,
                    latitude: c.latitude,
                    longitude: c.longitude,
                  });
                } else {
                  bookingForm.setFieldsValue({
                    address: undefined,
                    latitude: undefined,
                    longitude: undefined,
                  });
                }
              }}
              placeholder="Type to search hotels, or enter a new one"
            />
          </Form.Item>
          <Form.Item
            name="address"
            label="Address"
            required
            rules={[
              { required: true, message: "Address is required" },
              { max: 200, message: "Address max 200 characters" },
            ]}
          >
            <Input placeholder="Auto-filled when the hotel is picked from the list" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Phone"
            required
            rules={[
              { required: true, message: "Phone is required" },
              { pattern: /^[+]?[\d\s\-()]{7,20}$/, message: "Invalid phone format (7-20 chars, digits, spaces, +, -, parentheses)" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="mail"
            label="Email"
            required
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Please enter a valid email address" },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="startingDate"
            label="Start date"
            required
            rules={[{ required: true, message: "Start date is required" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="totalPax"
            label="Total pax"
            required
            rules={[
              { required: true, message: "Total pax is required" },
              { validator: (_, value) => value > 0 && value <= 12 ? Promise.resolve() : Promise.reject(new Error("Total pax must be 1-12")) },
            ]}
          >
            <InputNumber min={1} max={12} precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="notes"
            label="Note"
            extra="A note specific to this booking. Optional."
            rules={[{ max: 1000, message: "Notes max 1000 characters" }]}
          >
            <Input.TextArea rows={3} placeholder="Optional note" maxLength={1000} />
          </Form.Item>
          <Form.Item name="latitude" hidden>
            <InputNumber min={-90} max={90} precision={6} />
          </Form.Item>
          <Form.Item name="longitude" hidden>
            <InputNumber min={-180} max={180} precision={6} />
          </Form.Item>
          <Button type="primary" block loading={savingBooking} onClick={saveBooking}>
            Save
          </Button>

        </Form>
      </Drawer>

      <Drawer
        title={`Assign bookings to ${linkAssignment?.code ?? ""}`}
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        size={480}
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

      <DispatchBoard
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        canUpdateAssignment={canUpdateAssignment}
        onChanged={loadAssignments}
      />

      <Drawer
        title={`RawDataMail payload · ${rawDetail?.id ?? ""}`}
        open={Boolean(rawDetail)}
        onClose={() => setRawDetail(null)}
        size={720}
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
        size={520}
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
              { key: "duration", label: "Duration", children: bookingDetail.tour?.durationDays ? `${bookingDetail.tour.durationDays} ${bookingDetail.tour.durationDays === 1 ? 'Day' : 'Days'}` : "—" },
              { key: "start", label: "Start date", children: bookingDetail.startingDate ? new Date(bookingDetail.startingDate).toLocaleString() : "—" },
              { key: "end", label: "End date", children: fmtDate(endDate(bookingDetail.startingDate, bookingDetail.tour?.durationDays)) },
              { key: "pax", label: "Pax", children: `${bookingDetail.totalPax ?? 0}` },
              { key: "notes", label: "Note", children: bookingDetail.notes ?? "—" },
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