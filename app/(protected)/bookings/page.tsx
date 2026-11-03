"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  CarOutlined,
  MailOutlined,
  PlusOutlined,
  ReloadOutlined,
  ScheduleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import DispatchBoard from "@/components/dispatch-board";

const BOOKING_STATUS = ["PENDING", "ASSIGNED", "CANCELED"];
const ASSIGNMENT_STATUS = ["PENDING", "DISPATCHED", "COMPLETED", "CANCELED"];
const BOOKING_CHANNELS = ["TRIPADVISOR", "GETYOURGUIDE", "WEBSITE", "MANUAL", "AIRBNB", "BOOKING_COM", "VIATOR"];
const PAYMENT_STATUS = ["PENDING", "PAID", "REFUNDED"];
const TOUR_TYPES = ["PRIVATE_TOUR", "GROUP_TOUR"];

/**
 * A booking can only be cancelled while the tour is still more than 24h away
 * — inside the window the vehicle, the guide and the tickets are committed.
 * The backend enforces this (HTTP 400 "Cancellation window closed"); the
 * frontend only has to react to it and offer the admin override.
 */
const CANCEL_WINDOW_HOURS = 24;

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

const MAX_GROUP_BOOKING_PAX = 12;
const buildGroupBuses = (total: number) => {
  const rows: Array<{ key: string; pax: number }> = [];
  let left = Math.max(1, Math.floor(Number(total) || 1));
  let index = 0;
  while (left > 0) {
    const pax = Math.min(12, left);
    rows.push({ key: `bus-${index}-${Date.now()}`, pax });
    left -= pax;
    index += 1;
  }
  return rows;
};

const maxPaxForTour = (tour: any, tourType?: string | null) => {
  if (tourType !== "PRIVATE_TOUR") return MAX_GROUP_BOOKING_PAX;
  const tiers = (tour?.privatePaxPrices ?? [])
    .filter((row: any) => Number(row.pricePerPerson ?? 0) > 0)
    .map((row: any) => Number(row.pax));
  return tiers.length ? Math.max(...tiers) : MAX_GROUP_BOOKING_PAX;
};

const fmtDate = (d: Date | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function BookingsPage() {
  const { hasPermission, user } = useApp();
  const canCreateBooking = hasPermission("booking.create");
  const canUpdateBooking = hasPermission("booking.update");
  const canUpdateAssignment = hasPermission("assignment.update");
  const canManageMailbox = hasPermission("gmail.manage");
  const isAdmin = user?.role === "ADMIN";
  const canCollectPayment = isAdmin || hasPermission("accounting.read");
  const canConfirmPayment =
    isAdmin || hasPermission("accounting.money.verify");

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
  const [groupBuses, setGroupBuses] = useState<
    Array<{
      key: string;
      pax: number;
      driverId?: string;
      guideId?: string;
      vehicleId?: string;
      providerId?: string;
      note?: string;
    }>
  >([]);
  const [groupCrew, setGroupCrew] = useState<{ guides: any[]; drivers: any[] }>({
    guides: [],
    drivers: [],
  });
  const [groupProviders, setGroupProviders] = useState<any[]>([]);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupOptionsLoaded, setGroupOptionsLoaded] = useState(false);
  const [newGroupEnabled, setNewGroupEnabled] = useState(false);
  const [newGroupBuses, setNewGroupBuses] = useState<
    Array<{
      key: string;
      pax: number;
      driverId?: string;
      guideId?: string;
      vehicleId?: string;
      providerId?: string;
      note?: string;
    }>
  >([]);
  const watchedTourId = Form.useWatch("tourId", bookingForm);
  const watchedTourType = Form.useWatch("tourType", bookingForm);
  const watchedTotalPax = Form.useWatch("totalPax", bookingForm);
  const selectedBookingTour = tours.find((t) => t.id === watchedTourId);
  const bookingMaxPax = maxPaxForTour(
    selectedBookingTour,
    watchedTourType ?? selectedBookingTour?.type,
  );

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkAssignment, setLinkAssignment] = useState<any>(null);
  const [linkSelected, setLinkSelected] = useState<string[]>([]);
  const [savingLink, setSavingLink] = useState(false);

  const [bookingDetail, setBookingDetail] = useState<any>(null);

  const loadGroupOptions = () => {
    if (groupOptionsLoaded) return;
    Promise.all([
      api
        .get("/assignments/board/crew")
        .then((r) => r.data)
        .catch(() => ({ guides: [], drivers: [] })),
      api
        .get("/transportation-providers")
        .then((r) => r.data)
        .catch(() => []),
    ]).then(([crew, providers]) => {
      setGroupCrew(crew ?? { guides: [], drivers: [] });
      setGroupProviders(Array.isArray(providers) ? providers : []);
      setGroupOptionsLoaded(true);
    });
  };

  useEffect(() => {
    const b = bookingDetail;
    if (!b) {
      setGroupBuses([]);
      return;
    }
    const isPrivate =
      (b.tourType ?? b.tour?.type) === "PRIVATE_TOUR";
    const removableAssignment =
      Boolean(b.assignment) &&
      (b.assignment._count?.bookings ?? 0) === 1 &&
      ["PENDING", "DRAFT_ASSIGNED", "TRANSFERRED"].includes(
        b.assignment.status,
      );
    const canSplit =
      isPrivate &&
      !b.parentBookingId &&
      (b.childBookings?.length ?? 0) === 0 &&
      (!b.assignmentId || removableAssignment);
    if (!canSplit) {
      setGroupBuses([]);
      return;
    }
    setGroupBuses(buildGroupBuses(Number(b.totalPax ?? 1)));
    loadGroupOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bookingDetail?.id,
    bookingDetail?.assignmentId,
    bookingDetail?.parentBookingId,
    bookingDetail?.childBookings?.length,
  ]);

  const [paymentBusy, setPaymentBusy] = useState(false);
  const [otaOpen, setOtaOpen] = useState(false);
  const [otaSaving, setOtaSaving] = useState(false);
  const [otaBooking, setOtaBooking] = useState<any>(null);
  const [otaForm] = Form.useForm();

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

  /**
   * What the email was: a new booking, an amendment or a cancellation.
   * `outcome` is what the system did with it (created / updated / cancelled /
   * unchanged / skipped).
   */
  const RAW_DATA_ACTION_LABELS: Record<string, string> = {
    CREATE: "New booking",
    MODIFY: "Amended",
    CANCEL: "Cancelled",
    DUPLICATE: "Duplicate",
  };

  const RAW_DATA_ACTION_COLORS: Record<string, string> = {
    CREATE: "blue",
    MODIFY: "gold",
    CANCEL: "red",
    DUPLICATE: "orange",
  };

  const RAW_DATA_OUTCOME_LABELS: Record<string, string> = {
    CREATED: "created",
    UPDATED: "updated",
    CANCELLED: "cancelled",
    UNCHANGED: "no change",
    SKIPPED: "ignored",
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
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (v: any, r: any) =>
        v ? (
          <Space size={4}>
            <Tag color={RAW_DATA_ACTION_COLORS[v] ?? "default"}>
              {RAW_DATA_ACTION_LABELS[v] ?? v}
            </Tag>
            {r.outcome ? (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {RAW_DATA_OUTCOME_LABELS[r.outcome] ?? r.outcome}
              </Typography.Text>
            ) : null}
          </Space>
        ) : (
          "—"
        ),
      filters: Object.keys(RAW_DATA_ACTION_LABELS).map((a) => ({
        text: RAW_DATA_ACTION_LABELS[a],
        value: a,
      })),
      onFilter: (v: any, r: any) => r.action === v,
    },
    {
      title: "Booking Ref",
      key: "bookingRef",
      render: (_: any, r: any) => {
        const ref = r.bookingRef ?? r.linkedBooking?.bookingRef ?? r.booking?.bookingRef;
        return ref ? <Typography.Text copyable>{ref}</Typography.Text> : "—";
      },
      filters: Array.from(
        new Set(
          rawData
            .map((r: any) => r.bookingRef ?? r.linkedBooking?.bookingRef ?? r.booking?.bookingRef)
            .filter(Boolean),
        ),
      )
        .sort()
        .map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => {
        const ref = r.bookingRef ?? r.linkedBooking?.bookingRef ?? r.booking?.bookingRef;
        return ref === v;
      },
    },
    {
      title: "History ID",
      key: "historyId",
      width: 110,
      render: (_: any, r: any) => {
        const hid = r.payload?.historyId ?? r.historyId;
        return hid ? <Typography.Text copyable style={{ fontSize: 12 }}>{hid}</Typography.Text> : "—";
      },
      onFilter: (v: any, r: any) => {
        const hid = r.payload?.historyId ?? r.historyId;
        return String(hid ?? "").includes(String(v));
      },
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
      title: "Payload",
      key: "payload",
      render: (_: any, r: any) => (
        <Space size={8}>
          <Button size="small" onClick={() => setRawDetail(r)}>
            View
          </Button>
        </Space>
      ),
    },
  ]);

  const openBookingDetail = async (record: any) => {
    setBookingDetail(record);
    if (!record?.id) return;
    try {
      const res = await api.get(`/bookings/${record.id}`);
      setBookingDetail(res.data);
    } catch {
      // Keep the row snapshot when the detail endpoint is unavailable.
    }
  };

  const reloadBookingDetail = async (id: string) => {
    try {
      const res = await api.get(`/bookings/${id}`);
      setBookingDetail(res.data);
      loadBookings();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not reload booking"));
    }
  };

  const collectBookingPayment = async () => {
    if (!bookingDetail?.id) return;
    setPaymentBusy(true);
    try {
      await api.post(`/bookings/${bookingDetail.id}/payment/collect`, {
        method: "CASH",
      });
      message.success("Cash collection recorded. Accounting must confirm it.");
      await reloadBookingDetail(bookingDetail.id);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not record the collection"));
    } finally {
      setPaymentBusy(false);
    }
  };

  const confirmBookingPayment = async () => {
    if (!bookingDetail?.id) return;
    setPaymentBusy(true);
    try {
      await api.post(`/bookings/${bookingDetail.id}/payment/confirm`, {
        method: bookingDetail.paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
      });
      message.success("Payment confirmed");
      await reloadBookingDetail(bookingDetail.id);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not confirm the payment"));
    } finally {
      setPaymentBusy(false);
    }
  };

  const openOtaRemittance = (booking: any) => {
    setOtaBooking(booking);
    otaForm.resetFields();
    otaForm.setFieldsValue({ netAmount: undefined });
    setOtaOpen(true);
  };

  const saveOtaRemittance = async () => {
    const values = await otaForm.validateFields();
    if (!otaBooking?.id) return;
    setOtaSaving(true);
    try {
      await api.post("/payments/ota/remittance", {
        bookingId: otaBooking.id,
        netAmount: values.netAmount,
        grossAmount: values.grossAmount,
        commissionAmount: values.commissionAmount,
        paidAt: values.paidAt?.format("YYYY-MM-DD"),
        reference: values.reference,
        note: values.note,
      });
      message.success("OTA remittance recorded");
      setOtaOpen(false);
      await reloadBookingDetail(otaBooking.id);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not record the remittance"));
    } finally {
      setOtaSaving(false);
    }
  };

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

  /**
   * Cancel a booking.
   *
   * The 24h cancellation window is enforced by the backend: it answers with
   * 400 "Cancellation window closed" when the tour departs too soon. Only an
   * administrator may override it (the override is recorded in the audit
   * trail), so a non-admin simply gets the error.
   */
  const cancelBooking = async (r: any) => {
    const cancel = async (override: boolean) =>
      api.put(`/bookings/${r.id}`, {
        status: "CANCELED",
        ...(override ? { overrideCancelWindow: true } : {}),
      });

    try {
      await cancel(false);
      message.success("Booking canceled");
      loadBookings();
    } catch (e) {
      const text = getErrorMessage(e);
      if (!/cancellation window closed/i.test(text)) {
        message.error(text);
        return;
      }
      if (!isAdmin) {
        message.error(text);
        return;
      }
      Modal.confirm({
        title: "Cancellation window closed",
        content: `${text} You are an administrator, so you can cancel anyway — the override is recorded in the audit trail.`,
        okText: "Cancel anyway",
        okButtonProps: { danger: true },
        cancelText: "Keep booking",
        onOk: async () => {
          try {
            await cancel(true);
            message.success("Booking canceled (window override)");
            loadBookings();
          } catch (e2) {
            message.error(getErrorMessage(e2));
            throw e2;
          }
        },
      });
    }
  };

  /** The last moment this booking could be cancelled without an override. */
  const cancelDeadline = (r: any): Date | null => {
    if (!r?.startingDate) return null;
    const d = new Date(r.startingDate);
    if (Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() - CANCEL_WINDOW_HOURS * 60 * 60 * 1000);
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
    setNewGroupEnabled(false);
    setNewGroupBuses([]);
    loadGroupOptions();
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
    if (newGroupEnabled) {
      if (newGroupBuses.some((bus) => Number(bus.pax ?? 0) < 1)) {
        message.warning("Each group bus needs at least 1 pax");
        return;
      }
      const busPaxTotal = newGroupBuses.reduce(
        (sum, bus) => sum + Number(bus.pax ?? 0),
        0,
      );
      if (busPaxTotal !== Number(values.totalPax ?? 0)) {
        message.warning(
          `Bus pax total (${busPaxTotal}) must equal the booking total pax (${values.totalPax})`,
        );
        return;
      }
    }
    setSavingBooking(true);
    try {
      const { data: created } = await api.post("/bookings", {
        ...values,
        startingDate: values.startingDate?.format("YYYY-MM-DD"),
        totalPax: values.totalPax,
      });
      if (newGroupEnabled && newGroupBuses.length > 0) {
        try {
          await api.post(`/bookings/${created.id}/private-group`, {
            buses: newGroupBuses.map(({ key, ...bus }) => bus),
          });
        } catch (e) {
          message.warning(
            `${created.bookingRef} was created, but the group buses failed: ${getErrorMessage(e)}`,
          );
          setBookingOpen(false);
          loadBookings();
          return;
        }
      }
      message.success(
        newGroupEnabled ? "Booking and group buses created" : "Booking created",
      );
      setBookingOpen(false);
      loadBookings();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create booking"));
    } finally {
      setSavingBooking(false);
    }
  };

  const groupPaxTotal = groupBuses.reduce(
    (sum, bus) => sum + Number(bus.pax ?? 0),
    0,
  );
  const groupParentPax = Number(bookingDetail?.totalPax ?? 0);
  const removableGroupAssignment =
    Boolean(bookingDetail?.assignment) &&
    (bookingDetail.assignment._count?.bookings ?? 0) === 1 &&
    ["PENDING", "DRAFT_ASSIGNED", "TRANSFERRED"].includes(
      bookingDetail.assignment.status,
    );
  const groupCanSplit =
    Boolean(bookingDetail) &&
    (bookingDetail.tourType ?? bookingDetail.tour?.type) === "PRIVATE_TOUR" &&
    !bookingDetail.parentBookingId &&
    (bookingDetail.childBookings?.length ?? 0) === 0 &&
    (!bookingDetail.assignmentId || removableGroupAssignment);
  const updateGroupBus = (
    key: string,
    patch: Partial<(typeof groupBuses)[number]>,
  ) => {
    setGroupBuses((prev) =>
      prev.map((bus) => (bus.key === key ? { ...bus, ...patch } : bus)),
    );
  };
  const newGroupPaxTotal = newGroupBuses.reduce(
    (sum, bus) => sum + Number(bus.pax ?? 0),
    0,
  );
  const newGroupParentPax = Number(watchedTotalPax ?? 0);
  const updateNewGroupBus = (
    key: string,
    patch: Partial<(typeof newGroupBuses)[number]>,
  ) => {
    setNewGroupBuses((prev) =>
      prev.map((bus) => (bus.key === key ? { ...bus, ...patch } : bus)),
    );
  };
  const saveGroupBuses = async () => {
    if (!bookingDetail) return;
    if (groupBuses.some((bus) => Number(bus.pax ?? 0) < 1)) {
      message.warning("Each bus needs at least 1 pax");
      return;
    }
    if (groupPaxTotal !== groupParentPax) {
      message.warning(
        `Bus pax total (${groupPaxTotal}) must equal the booking total pax (${groupParentPax})`,
      );
      return;
    }
    setGroupSaving(true);
    try {
      const { data } = await api.post(
        `/bookings/${bookingDetail.id}/private-group`,
        {
          buses: groupBuses.map(({ key, ...bus }) => bus),
        },
      );
      setBookingDetail(data);
      loadBookings();
      message.success("Group buses created");
    } catch (e) {
      message.error(getErrorMessage(e, "Could not create group buses"));
    } finally {
      setGroupSaving(false);
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
      setUnassignedBookings(
        (r.data.items ?? []).filter(
          (booking: any) => !(booking.childBookings?.length > 0),
        ),
      );
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
        const systemName = r.tour?.name;
        const externalName = r.tourName;
        const name = systemName ?? externalName;
        const type = r.tour?.type ?? r.tourType;
        const days = r.tour?.durationDays ?? r.durationDays;
        const unmatched = Boolean(externalName) && !r.tour;
        return (
          <Flex vertical gap={2}>
            <Flex align="center" gap={4} style={{ minWidth: 0 }}>
              <Typography.Text
                strong
                style={{ fontSize: 12 }}
                ellipsis={{ tooltip: name ?? "—" }}
              >
                {name ?? "—"}
              </Typography.Text>
              {unmatched && (
                <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>
                  Unmatched
                </Tag>
              )}
            </Flex>
            {systemName && externalName && systemName !== externalName && (
              <Typography.Text
                type="secondary"
                style={{ fontSize: 10 }}
                ellipsis={{ tooltip: externalName }}
              >
                OTA: {externalName}
              </Typography.Text>
            )}
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
              {r.parentBooking && (
                <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>
                  Group child · {r.parentBooking.bookingRef}
                </Tag>
              )}
              {r.childBookings?.length ? (
                <Tag color="purple" style={{ margin: 0, fontSize: 10 }}>
                  Group parent · {r.childBookings.length} buses
                </Tag>
              ) : null}
            </Space>
          </Flex>
        );
      },
      onFilter: (v: any, r: any) =>
        [r.tour?.name, r.tourName]
          .filter(Boolean)
          .some((name: string) => name.toLowerCase().includes(v.toLowerCase())),
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
            render: (_: any, r: any) => {
              const deadline = cancelDeadline(r);
              const windowClosed =
                deadline !== null && Date.now() > deadline.getTime();
              return (
                <div style={{ whiteSpace: "nowrap" }}>
                  <Select
                    size="small"
                    value={r.status}
                    style={{ width: 130 }}
                    options={BOOKING_STATUS.map((s) => ({ value: s, label: s }))}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (status) => {
                      if (status === "CANCELED") {
                        await cancelBooking(r);
                        return;
                      }
                      try {
                        await api.put(`/bookings/${r.id}`, { status });
                        message.success("Status updated");
                        loadBookings();
                      } catch (e) {
                        message.error(getErrorMessage(e));
                      }
                    }}
                  />
                  {windowClosed && r.status !== "CANCELED" ? (
                    <Tooltip title={`Cancellation window closed ${deadline!.toLocaleString()} — cancelling needs an admin override`}>
                      <WarningOutlined
                        style={{ color: "#faad14", marginLeft: 6 }}
                      />
                    </Tooltip>
                  ) : null}
                </div>
              );
            },
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
                    onClick: () => void openBookingDetail(record),
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
                  const max = maxPaxForTour(t, t.type);
                  const current = Number(bookingForm.getFieldValue("totalPax") ?? 1);
                  bookingForm.setFieldsValue({
                    tourType: t.type,
                    ...(current > max ? { totalPax: max } : {}),
                  });
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
              onChange={(t) => {
                const tour = tours.find(
                  (x) => x.id === bookingForm.getFieldValue("tourId"),
                );
                const max = maxPaxForTour(tour, t);
                const current = Number(bookingForm.getFieldValue("totalPax") ?? 1);
                if (current > max) bookingForm.setFieldValue("totalPax", max);
                fillBookingRef(t);
              }}
            />
          </Form.Item>
          {watchedTourType === "PRIVATE_TOUR" && (
            <Form.Item label="Private group (multiple buses)">
              <Flex align="center" gap={10}>
                <Switch
                  checked={newGroupEnabled}
                  onChange={(checked) => {
                    setNewGroupEnabled(checked);
                    if (checked) {
                      setNewGroupBuses(
                        buildGroupBuses(
                          Number(bookingForm.getFieldValue("totalPax") ?? 1),
                        ),
                      );
                    }
                  }}
                />
                <Typography.Text type="secondary">
                  One representative booking, separate bus rows
                </Typography.Text>
              </Flex>
            </Form.Item>
          )}
          {newGroupEnabled && (
            <Card
              size="small"
              title="Group buses"
              style={{ marginBottom: 16 }}
              extra={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setNewGroupBuses((prev) => [
                      ...prev,
                      { key: `new-bus-${prev.length}-${Date.now()}`, pax: 1 },
                    ])
                  }
                >
                  Add bus
                </Button>
              }
            >
              <Flex vertical gap={10}>
                {newGroupBuses.map((bus, index) => {
                  const provider = groupProviders.find(
                    (p: any) => p.id === bus.providerId,
                  );
                  const vehicles = provider
                    ? (provider.vehicles ?? [])
                    : groupProviders.flatMap((p: any) => p.vehicles ?? []);
                  return (
                    <Card
                      key={bus.key}
                      size="small"
                      styles={{ body: { padding: 10 } }}
                    >
                      <Flex
                        justify="space-between"
                        align="center"
                        style={{ marginBottom: 8 }}
                      >
                        <Typography.Text strong>
                          Bus {index + 1}
                        </Typography.Text>
                        <Button
                          danger
                          type="text"
                          size="small"
                          disabled={newGroupBuses.length <= 1}
                          onClick={() =>
                            setNewGroupBuses((prev) =>
                              prev.filter((row) => row.key !== bus.key),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </Flex>
                      <Row gutter={[8, 8]}>
                        <Col xs={24} sm={8}>
                          <InputNumber
                            min={1}
                            max={45}
                            value={bus.pax}
                            onChange={(value) =>
                              updateNewGroupBus(bus.key, {
                                pax: Number(value ?? 1),
                              })
                            }
                            addonAfter="pax"
                            style={{ width: "100%" }}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Select
                            allowClear
                            placeholder="Driver"
                            style={{ width: "100%" }}
                            value={bus.driverId}
                            onChange={(value) =>
                              updateNewGroupBus(bus.key, { driverId: value })
                            }
                            options={groupCrew.drivers.map((driver: any) => ({
                              value: driver.id,
                              label: driver.name,
                            }))}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Select
                            allowClear
                            placeholder="Tour guide"
                            style={{ width: "100%" }}
                            value={bus.guideId}
                            onChange={(value) =>
                              updateNewGroupBus(bus.key, { guideId: value })
                            }
                            options={groupCrew.guides.map((guide: any) => ({
                              value: guide.id,
                              label: guide.name,
                            }))}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Select
                            allowClear
                            placeholder="Provider"
                            style={{ width: "100%" }}
                            value={bus.providerId}
                            onChange={(value) =>
                              updateNewGroupBus(bus.key, {
                                providerId: value,
                                vehicleId: undefined,
                              })
                            }
                            options={groupProviders.map((p: any) => ({
                              value: p.id,
                              label: p.name,
                            }))}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Select
                            allowClear
                            placeholder="Vehicle"
                            style={{ width: "100%" }}
                            value={bus.vehicleId}
                            onChange={(value) =>
                              updateNewGroupBus(bus.key, { vehicleId: value })
                            }
                            options={vehicles.map((vehicle: any) => ({
                              value: vehicle.id,
                              label: `${vehicle.plateNumber} · ${vehicle.capacity} seats`,
                            }))}
                          />
                        </Col>
                        <Col xs={24} sm={8}>
                          <Input
                            placeholder="Note (optional)"
                            value={bus.note}
                            onChange={(event) =>
                              updateNewGroupBus(bus.key, {
                                note: event.target.value,
                              })
                            }
                          />
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </Flex>
              <Flex justify="space-between" style={{ marginTop: 10 }}>
                <Typography.Text
                  type={
                    newGroupPaxTotal === newGroupParentPax
                      ? "secondary"
                      : "danger"
                  }
                >
                  Total {newGroupPaxTotal} / {newGroupParentPax} pax
                </Typography.Text>
              </Flex>
            </Card>
          )}
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
            extra={`Maximum ${bookingMaxPax} people for this tour`}
            rules={[
              { required: true, message: "Total pax is required" },
              { validator: (_, value) => value > 0 && value <= bookingMaxPax ? Promise.resolve() : Promise.reject(new Error(`Total pax must be 1-${bookingMaxPax}`)) },
            ]}
          >
            <InputNumber min={1} max={bookingMaxPax} precision={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="paxDetail"
            label="Pax detail"
            required
            rules={[
              { required: true, whitespace: true, message: "Pax detail is required" },
              { max: 1000, message: "Pax detail max 1000 characters" },
            ]}
          >
            <Input.TextArea
              rows={3}
              placeholder="e.g. 2 adults, 1 child"
              maxLength={1000}
            />
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
              ...(bookingDetail.tour?.name &&
              bookingDetail.tourName &&
              bookingDetail.tour.name !== bookingDetail.tourName
                ? [{ key: "otaTour", label: "OTA tour name", children: bookingDetail.tourName }]
                : []),
              { key: "tourType", label: "Tour type", children: bookingDetail.tourType ?? "—" },
              ...(bookingDetail.parentBooking
                ? [
                    {
                      key: "parentBooking",
                      label: "Group parent",
                      children: bookingDetail.parentBooking.bookingRef,
                    },
                  ]
                : []),
              ...(bookingDetail.childBookings?.length
                ? [
                    {
                      key: "groupBuses",
                      label: "Group buses",
                      children: `${bookingDetail.childBookings.length} bus(es)`,
                    },
                  ]
                : []),
              { key: "duration", label: "Duration", children: bookingDetail.tour?.durationDays ? `${bookingDetail.tour.durationDays} ${bookingDetail.tour.durationDays === 1 ? 'Day' : 'Days'}` : "—" },
              { key: "start", label: "Start date", children: bookingDetail.startingDate ? new Date(bookingDetail.startingDate).toLocaleString() : "—" },
              { key: "departureTime", label: "Departure time", children: bookingDetail.departureTime ?? "—" },
              { key: "end", label: "End date", children: fmtDate(endDate(bookingDetail.startingDate, bookingDetail.tour?.durationDays)) },
              { key: "pax", label: "Pax", children: `${bookingDetail.totalPax ?? 0}` },
              { key: "notes", label: "Note", children: bookingDetail.notes ?? "—" },
              { key: "address", label: "Address", children: bookingDetail.address ?? "—" },
              { key: "location", label: "Location (lat/lng)", children: bookingDetail.latitude != null ? `${bookingDetail.latitude}, ${bookingDetail.longitude ?? ""}` : "—" },
              { key: "status", label: "Status", children: bookingDetail.status ?? "—" },
              { key: "payment", label: "Payment", children: bookingDetail.payment ?? "—" },
              ...(bookingDetail.channel === "WEBSITE" || bookingDetail.totalAmount
                ? [
                    { key: "totalAmount", label: "Total", children: bookingDetail.totalAmount != null ? `${Number(bookingDetail.totalAmount).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ${bookingDetail.currency ?? "VND"}` : "—" },
                    { key: "paymentMethod", label: "Method", children: bookingDetail.paymentMethod ?? (bookingDetail.payLater ? "Pay later" : "—") },
                    { key: "payLater", label: "Pay later", children: bookingDetail.payLater ? "Yes" : "No" },
                    { key: "paymentDue", label: "Payment due", children: bookingDetail.paymentDueAt ? new Date(bookingDetail.paymentDueAt).toLocaleString() : "—" },
                    { key: "collected", label: "Collected", children: bookingDetail.paymentCollectedAt ? `${new Date(bookingDetail.paymentCollectedAt).toLocaleString()}${bookingDetail.paymentCollectedByName ? ` · ${bookingDetail.paymentCollectedByName}` : ""}` : "—" },
                    { key: "confirmed", label: "Confirmed", children: bookingDetail.paymentConfirmedAt ? `${new Date(bookingDetail.paymentConfirmedAt).toLocaleString()}${bookingDetail.paymentConfirmedByName ? ` · ${bookingDetail.paymentConfirmedByName}` : ""}` : "—" },
                    { key: "paymentNote", label: "Payment note", children: bookingDetail.paymentNote ?? "—" },
                  ]
                : []),
              { key: "noShow", label: "No-show", children: bookingDetail.isNoShow ? (bookingDetail.noShowReason ?? "Yes") : "No" },
              { key: "assignment", label: "Assignment", children: bookingDetail.assignmentId ?? "—" },
              { key: "created", label: "Created", children: new Date(bookingDetail.createdAt).toLocaleString() },
            ]}
          />
        )}
        {bookingDetail?.parentBooking && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 16 }}
            message={`Group child of ${bookingDetail.parentBooking.bookingRef}`}
            description="Customer paid on the parent booking. Submit this bus's report; Accounting locks each bus separately."
          />
        )}
        {bookingDetail?.childBookings?.length ? (
          <Card
            size="small"
            title={`Group buses (${bookingDetail.childBookings.length})`}
            style={{ marginTop: 16 }}
          >
            <Flex vertical gap={8}>
              {bookingDetail.childBookings.map((child: any) => (
                <Flex
                  key={child.id}
                  justify="space-between"
                  align="center"
                  gap={8}
                >
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    {child.bookingRef}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {child.assignment?.code ?? "—"}
                  </Typography.Text>
                  <Tag style={{ margin: 0, fontSize: 10 }}>
                    {child.totalPax ?? 0} pax
                  </Tag>
                  <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>
                    {child.assignment?.status ?? "—"}
                  </Tag>
                </Flex>
              ))}
            </Flex>
          </Card>
        ) : null}
        {groupCanSplit && (
          <Card
            size="small"
            title="Private group buses"
            style={{ marginTop: 16 }}
            extra={
              <Button
                size="small"
                icon={<PlusOutlined />}
                onClick={() =>
                  setGroupBuses((prev) => [
                    ...prev,
                    { key: `bus-${prev.length}-${Date.now()}`, pax: 1 },
                  ])
                }
              >
                Add bus
              </Button>
            }
          >
            <Alert
              type="info"
              showIcon
              message="Customer payment stays on this parent booking"
              description="Each bus is dispatched and settled separately. Set the pax per bus so the total matches the booking."
            />
            {removableGroupAssignment && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
                message={`This booking is currently on ${bookingDetail.assignment?.code ?? "an auto bus"}`}
                description="Creating the group buses will remove that auto-created bus."
              />
            )}
            <Flex vertical gap={10} style={{ marginTop: 12 }}>
              {groupBuses.map((bus, index) => {
                const provider = groupProviders.find(
                  (p: any) => p.id === bus.providerId,
                );
                const vehicles = provider
                  ? (provider.vehicles ?? [])
                  : groupProviders.flatMap((p: any) => p.vehicles ?? []);
                return (
                  <Card
                    key={bus.key}
                    size="small"
                    styles={{ body: { padding: 10 } }}
                  >
                    <Flex
                      justify="space-between"
                      align="center"
                      style={{ marginBottom: 8 }}
                    >
                      <Typography.Text strong>Bus {index + 1}</Typography.Text>
                      <Button
                        danger
                        type="text"
                        size="small"
                        disabled={groupBuses.length <= 1}
                        onClick={() =>
                          setGroupBuses((prev) =>
                            prev.filter((row) => row.key !== bus.key),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </Flex>
                    <Row gutter={[8, 8]}>
                      <Col xs={24} sm={8}>
                        <InputNumber
                          min={1}
                          max={45}
                          value={bus.pax}
                          onChange={(value) =>
                            updateGroupBus(bus.key, {
                              pax: Number(value ?? 1),
                            })
                          }
                          addonAfter="pax"
                          style={{ width: "100%" }}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Select
                          allowClear
                          placeholder="Driver"
                          style={{ width: "100%" }}
                          value={bus.driverId}
                          onChange={(value) =>
                            updateGroupBus(bus.key, { driverId: value })
                          }
                          options={groupCrew.drivers.map((driver: any) => ({
                            value: driver.id,
                            label: driver.name,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Select
                          allowClear
                          placeholder="Tour guide"
                          style={{ width: "100%" }}
                          value={bus.guideId}
                          onChange={(value) =>
                            updateGroupBus(bus.key, { guideId: value })
                          }
                          options={groupCrew.guides.map((guide: any) => ({
                            value: guide.id,
                            label: guide.name,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Select
                          allowClear
                          placeholder="Provider"
                          style={{ width: "100%" }}
                          value={bus.providerId}
                          onChange={(value) =>
                            updateGroupBus(bus.key, {
                              providerId: value,
                              vehicleId: undefined,
                            })
                          }
                          options={groupProviders.map((p: any) => ({
                            value: p.id,
                            label: p.name,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Select
                          allowClear
                          placeholder="Vehicle"
                          style={{ width: "100%" }}
                          value={bus.vehicleId}
                          onChange={(value) =>
                            updateGroupBus(bus.key, { vehicleId: value })
                          }
                          options={vehicles.map((vehicle: any) => ({
                            value: vehicle.id,
                            label: `${vehicle.plateNumber} · ${vehicle.capacity} seats`,
                          }))}
                        />
                      </Col>
                      <Col xs={24} sm={8}>
                        <Input
                          placeholder="Note (optional)"
                          value={bus.note}
                          onChange={(event) =>
                            updateGroupBus(bus.key, {
                              note: event.target.value,
                            })
                          }
                        />
                      </Col>
                    </Row>
                  </Card>
                );
              })}
            </Flex>
            <Flex
              justify="space-between"
              align="center"
              style={{ marginTop: 12 }}
            >
              <Typography.Text
                type={groupPaxTotal === groupParentPax ? "secondary" : "danger"}
              >
                Total {groupPaxTotal} / {groupParentPax} pax
              </Typography.Text>
              <Button
                type="primary"
                loading={groupSaving}
                disabled={groupPaxTotal !== groupParentPax}
                onClick={saveGroupBuses}
              >
                Create buses
              </Button>
            </Flex>
          </Card>
        )}
        {bookingDetail?.payLater && bookingDetail?.payment === "PENDING" && (
          <Flex gap={8} style={{ marginTop: 16 }} wrap>
            {canCollectPayment && !bookingDetail.paymentCollectedAt && (
              <Popconfirm
                title="Record cash collected?"
                description="This does not mark the booking paid. Accounting must confirm it."
                onConfirm={collectBookingPayment}
                okText="Record"
              >
                <Button loading={paymentBusy}>Mark cash collected</Button>
              </Popconfirm>
            )}
            {canConfirmPayment && (
              <Popconfirm
                title="Confirm payment received?"
                description="This marks the booking PAID and writes the receipt."
                onConfirm={confirmBookingPayment}
                okText="Confirm"
              >
                <Button type="primary" loading={paymentBusy}>
                  Confirm payment
                </Button>
              </Popconfirm>
            )}
          </Flex>
        )}
        {Array.isArray(bookingDetail?.payments) && bookingDetail.payments.length > 0 && (
          <Card size="small" title="Payment records" style={{ marginTop: 16 }}>
            {bookingDetail.payments.map((p: any) => (
              <Flex key={p.id} justify="space-between" gap={8} style={{ marginBottom: 8 }}>
                <Typography.Text style={{ fontSize: 12 }}>
                  {p.method} · {p.payerType} · {p.provider ?? "internal"}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 12 }}>
                  {Number(p.amount).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}{" "}
                  {p.currency} · <Tag style={{ margin: 0 }}>{p.status}</Tag>
                </Typography.Text>
              </Flex>
            ))}
          </Card>
        )}
        {bookingDetail &&
          !["WEBSITE", "MANUAL"].includes(bookingDetail.channel) &&
          (isAdmin || hasPermission("accounting.money.verify")) && (
            <Button
              style={{ marginTop: 16 }}
              block
              onClick={() => openOtaRemittance(bookingDetail)}
            >
              Record OTA remittance
            </Button>
          )}
      </Drawer>

      <Modal
        title={`Record OTA remittance · ${otaBooking?.bookingRef ?? ""}`}
        open={otaOpen}
        onCancel={() => setOtaOpen(false)}
        onOk={saveOtaRemittance}
        confirmLoading={otaSaving}
        okText="Record remittance"
        width={460}
      >
        <Form form={otaForm} layout="vertical">
          <Form.Item
            name="netAmount"
            label="Net received (VND)"
            rules={[{ required: true, message: "Net amount is required" }]}
          >
            <InputNumber<number>
              min={1}
              precision={0}
              style={{ width: "100%" }}
              formatter={(v) =>
                `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }
              parser={(v) => Number(String(v ?? "").replace(/,/g, ""))}
            />
          </Form.Item>
          <Flex gap={8}>
            <Form.Item name="grossAmount" label="Gross (optional)" style={{ flex: 1 }}>
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="commissionAmount"
              label="Commission (optional)"
              style={{ flex: 1 }}
            >
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Flex>
          <Form.Item name="paidAt" label="Received date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="reference" label="Reference">
            <Input placeholder="Bank / OTA remittance reference" />
          </Form.Item>
          <Form.Item name="note" label="Note">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}