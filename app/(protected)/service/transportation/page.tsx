"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CalendarOutlined,
  CarOutlined,
  CheckOutlined,
  DollarOutlined,
  IdcardOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import CrewAvailabilityDrawer from "@/components/dispatch-board/CrewAvailabilityDrawer";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { indexColumn } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";

const { Text } = Typography;

interface PersonOpt {
  id: string;
  name?: string | null;
  email: string;
  isActive: boolean;
  licenseNumber?: string | null;
}

interface DriverUser extends PersonOpt {
  providerId: string | null;
}

interface VehicleOpt {
  id: string;
  capacity: number;
  plateNumber?: string | null;
  brand?: string | null;
}

interface ProviderDto {
  id: string;
  name: string;
  contact: PersonOpt | null;
  vehicles: VehicleOpt[];
  drivers: PersonOpt[];
}

interface ProviderRow {
  id: string;
  name: string;
  contact: PersonOpt | null;
  vehicleCount: number;
  driverCount: number;
}

interface TourOpt {
  id: string;
  name: string;
}

interface RoutePriceRow {
  id: string;
  tour?: { name: string };
  provider?: { name: string };
  vehicle?: { capacity?: number; plateNumber?: string; brand?: string | null } | null;
  price: string | number;
  rowNo?: number;
  first?: boolean;
  providerIndex?: number;
}

interface FlatRow extends RoutePriceRow {
  rowNo: number;
  _providerIndex: number;
  _tourIndex: number;
  _first: boolean;
}

interface VehicleManageRow {
  providerId: string;
  providerName: string;
  _providerIndex: number;
  vehicle: VehicleOpt;
}

interface DriverRelationRow {
  providerId: string;
  providerName: string;
  _providerIndex: number;
  _first: boolean;
  driver: PersonOpt;
}

interface CrewAvailAssignment {
  id: string;
  code?: string | null;
  tourName?: string | null;
  status?: string;
  startDate: string;
  endDate: string;
}

interface CrewAvailLeave {
  id: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface VehicleFormState {
  mode: "create" | "edit";
  vehicleId?: string;
  providerId?: string;
  plateNumber: string;
  capacity?: number;
  brand?: string;
}

interface AssignableRow {
  providerId: string;
  providerName: string;
  vehicleId: string;
  capacity: number;
  plateNumber?: string | null;
  brand?: string | null;
  tourId: string;
  tourName: string;
  durationDays: number;
  price: number;
}

interface AssignStatementRow {
  id: string;
  code?: string;
  tourName?: string;
  vehicleLabel?: string;
  providerName?: string;
  driverName?: string;
  startDate: string;
  endDate: string;
  status: string;
  price?: number;
}

interface DriverFormState {
  mode: "create" | "edit";
  driver?: DriverUser;
  providerId?: string;
  name: string;
  email: string;
  licenseNumber: string;
  isActive: boolean;
}

const PROVIDER_HUES = [210, 350, 145, 270, 15, 190, 35, 320, 210, 90, 0, 300];

const PROVIDER_TAGS = ["blue", "volcano", "green", "purple", "orange", "cyan", "gold", "magenta"];

const centerTitle = (text: string) => (
  <div style={{ textAlign: "center", width: "100%" }}>{text}</div>
);

const tourBg = (providerIndex: number, isDark: boolean): string => {
  if (isDark) return providerIndex % 2 === 0 ? "rgba(38, 84, 212, 0.28)" : "rgba(255, 255, 255, 0.055)";
  return providerIndex % 2 === 0 ? "#e6f4ff" : "#f5f5f5";
};

const usd = (n: string | number) =>
  `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function TransportationPage() {
  const { hasPermission, theme, user } = useApp();
  const isDark = theme === "dark";
  const isProviderRole = user?.role === "TRANSPORT_PROVIDER";
  const myProviderId = isProviderRole ? (user?.providerId ?? undefined) : undefined;
  const canCreate = hasPermission("route-price.create");
  const canDelete = hasPermission("route-price.delete");
  const canVehicleCreate = hasPermission("vehicle.create");
  const canVehicleUpdate = hasPermission("vehicle.update");
  const canVehicleDelete = hasPermission("vehicle.delete");
  const canAssignDriver = hasPermission("provider-driver.assign");
  const canUnassignDriver = hasPermission("provider-driver.unassign");
  const canDriverCreate = hasPermission("driver.create");
  const canDriverUpdate = hasPermission("driver.update");
  const canAssignTour = hasPermission("assignment.create");

  const [providers, setProviders] = useState<ProviderDto[]>([]);
  const [driversAll, setDriversAll] = useState<DriverUser[]>([]);
  const [optionData, setOptionData] = useState<{
    providers: { id: string; name: string; vehicles: VehicleOpt[] }[];
    tours: TourOpt[];
  }>({ providers: [], tours: [] });
  const [routePrices, setRoutePrices] = useState<RoutePriceRow[]>([]);
  const [pricePage, setPricePage] = useState(1);
  const [pricePageSize, setPricePageSize] = useState(20);
  const [priceTotal, setPriceTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [providersLoading, setProvidersLoading] = useState(false);

  const [selProvider, setSelProvider] = useState<string | undefined>();
  const [selTour, setSelTour] = useState<string | undefined>();
  const [selSeat, setSelSeat] = useState<string | undefined>();
  const [price, setPrice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceDrawer, setPriceDrawer] = useState(false);

  const [modalProvider, setModalProvider] = useState<ProviderDto | null>(null);
  const [modalTab, setModalTab] = useState<"vehicles" | "drivers">("vehicles");

  const [vehicleForm, setVehicleForm] = useState<VehicleFormState | null>(null);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [assignProvider, setAssignProvider] = useState<string | undefined>();
  const [assignUser, setAssignUser] = useState<string | undefined>();
  const [assigning, setAssigning] = useState(false);

  const [crewCalendarOpen, setCrewCalendarOpen] = useState(false);
  const [driverTours, setDriverTours] = useState<Record<string, CrewAvailAssignment[]>>({});
  const [todayLeaves, setTodayLeaves] = useState<Record<string, CrewAvailLeave>>({});
  const [driverLeaves, setDriverLeaves] = useState<Record<string, CrewAvailLeave[]>>({});

  const [assignables, setAssignables] = useState<AssignableRow[]>([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [atProvider, setAtProvider] = useState<string | undefined>();
  const [atVehicle, setAtVehicle] = useState<string | undefined>();
  const [atTour, setAtTour] = useState<string | undefined>();
  const [atDate, setAtDate] = useState<dayjs.Dayjs | null>(null);
  const [atDriver, setAtDriver] = useState<string | undefined>();
  const [atSaving, setAtSaving] = useState(false);
  const [assignRows, setAssignRows] = useState<AssignStatementRow[]>([]);
  const [assignRowsLoading, setAssignRowsLoading] = useState(false);
  const [assignPage, setAssignPage] = useState(1);
  const [assignPageSize, setAssignPageSize] = useState(20);
  const [assignTotal, setAssignTotal] = useState(0);

  const [driverForm, setDriverForm] = useState<DriverFormState | null>(null);
  const [driverSaving, setDriverSaving] = useState(false);

  const [activeTab, setActiveTab] = useState("prices");

  const tableHeight = useFillHeight({
    rootSelector: ".transport-page",
    activeTab,
    deps: [routePrices.length, providers.length, driversAll.length],
  });

  const load = () => {
    setLoading(true);
    api
      .get("/route-prices", { params: { page: 1, limit: 1000 } })
      .then((r) => {
        const items = (r.data?.items ?? []) as RoutePriceRow[];
        setRoutePrices(items);
        setPriceTotal(items.length);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load route prices")))
      .finally(() => setLoading(false));
  };

  const loadProviders = () => {
    setProvidersLoading(true);
    api
      .get("/transportation-providers")
      .then((r) => {
        const list = r.data ?? [];
        setProviders(list);
        if (modalProvider) {
          const updated = list.find((x: ProviderDto) => x.id === modalProvider.id);
          if (updated) setModalProvider(updated);
        }
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load transportation providers")))
      .finally(() => setProvidersLoading(false));
  };

  const loadDrivers = () => {
    api
      .get("/transportation-providers/drivers")
      .then((r) => setDriversAll(r.data ?? []))
      .catch(() => {});
  };

  const loadCrewAvail = () => {
    const from = dayjs().startOf("day");
    const to = from.add(30, "day");
    api
      .get("/assignments/board/crew/availability", {
        params: {
          from: from.format("YYYY-MM-DD"),
          to: to.format("YYYY-MM-DD"),
        },
      })
      .then((r) => {
        const drivers = (r.data?.drivers ?? []) as Array<{
          id: string;
          assignments: CrewAvailAssignment[];
          leaves?: CrewAvailLeave[];
        }>;
        const toursMap: Record<string, CrewAvailAssignment[]> = {};
        const leavesMap: Record<string, CrewAvailLeave> = {};
        const allLeavesMap: Record<string, CrewAvailLeave[]> = {};
        const today = dayjs().startOf("day");
        drivers.forEach((d) => {
          toursMap[d.id] = (d.assignments ?? []).sort((a, b) =>
            a.startDate.localeCompare(b.startDate),
          );
          allLeavesMap[d.id] = (d.leaves ?? []).filter((l) => l.status !== "REJECTED");
          const off = (d.leaves ?? []).find(
            (l) =>
              l.status !== "REJECTED" &&
              today.isAfter(dayjs(l.startDate).startOf("day").subtract(1, "day")) &&
              today.isBefore(dayjs(l.endDate).startOf("day").add(1, "day")),
          );
          if (off) leavesMap[d.id] = off;
        });
        setDriverTours(toursMap);
        setTodayLeaves(leavesMap);
        setDriverLeaves(allLeavesMap);
      })
      .catch(() => {});
  };

  const loadAssignables = () => {
    setAssignableLoading(true);
    api
      .get("/route-prices/assignable")
      .then((r) => setAssignables((r.data ?? []) as AssignableRow[]))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load assignable tours")))
      .finally(() => setAssignableLoading(false));
  };

  const loadAssignments = (page = assignPage, size = assignPageSize) => {
    setAssignRowsLoading(true);
    api
      .get("/assignments", {
        params: { page, limit: size, sortOrder: "desc" },
      })
      .then((r) => {
        const items = (r.data?.items ?? []) as Array<Record<string, any>>;
        const rows: AssignStatementRow[] = items.map((it) => ({
          id: it.id,
          code: it.code,
          tourName: it.tourName,
          startDate: it.startDate,
          endDate: it.endDate,
          status: it.status,
          providerName: it.provider?.name ?? "",
          vehicleLabel: it.vehicle
            ? `${it.vehicle.capacity != null ? `${it.vehicle.capacity}-seat` : ""}${it.vehicle.brand ? ` (${it.vehicle.brand})` : ""} — ${it.vehicle.plateNumber ?? ""}`
            : "",
          driverName: it.driver?.name ?? it.driver?.email ?? "",
          price:
            it.priceOverride ??
            assignables.find(
              (a) =>
                a.providerId === it.providerId &&
                a.vehicleId === it.vehicleId &&
                a.tourId === it.tourId,
            )?.price,
        }));
        setAssignRows(rows);
        setAssignTotal(r.data?.total ?? 0);
        setAssignPage(page);
        setAssignPageSize(size);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load assignments")))
      .finally(() => setAssignRowsLoading(false));
  };

  const refreshTransport = () => {
    loadProviders();
    loadDrivers();
    loadCrewAvail();
    loadAssignables();
    loadAssignments();
    api
      .get("/route-prices/dropdown")
      .then((r) =>
        setOptionData({
          providers: r.data?.providers ?? [],
          tours: r.data?.tours ?? [],
        }),
      )
      .catch((e) => message.error(getErrorMessage(e, "Failed to load dropdowns")));
  };

  useEffect(() => {
    refreshTransport();
    load();
  }, []);

  useEffect(() => {
    if (isProviderRole) {
      setAtProvider(myProviderId);
      setAtVehicle(undefined);
      setAtTour(undefined);
      setAtDate(null);
      setAtDriver(undefined);
    }
  }, [isProviderRole, myProviderId]);

  const toggleDriverActive = async (driver: DriverUser) => {
    if (!canDriverUpdate) {
      message.warning("You need the driver.update permission to do this");
      return;
    }
    try {
      await api.put(`/transportation-providers/drivers/${driver.id}`, {
        isActive: !driver.isActive,
      });
      message.success(`${driver.name ?? driver.email} is now ${!driver.isActive ? "active" : "inactive"}`);
      loadDrivers();
      loadCrewAvail();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to update driver"));
    }
  };

  const seatOptions = useMemo(() => {
    const provider = optionData.providers.find((p) => p.id === selProvider);
    return provider?.vehicles ?? [];
  }, [optionData.providers, selProvider]);

  const unassignedDrivers = useMemo(
    () => driversAll.filter((d) => !d.providerId),
    [driversAll],
  );

  const create = async () => {
    if (!selProvider || !selTour || !selSeat || price == null) {
      message.warning("Please fill provider, tour, seats and price");
      return;
    }
    setSaving(true);
    try {
      await api.post("/route-prices", {
        tourId: selTour,
        providerId: selProvider,
        vehicleId: selSeat,
        price,
      });
      message.success("Tour price created");
      setSelProvider(undefined);
      setSelTour(undefined);
      setSelSeat(undefined);
      setPrice(null);
      setPriceDrawer(false);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create tour price"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/route-prices/${id}`);
      message.success("Deleted");
      const maxPage = Math.max(1, Math.ceil((priceTotal - 1) / pricePageSize));
      if (pricePage > maxPage) setPricePage(maxPage);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to delete"));
    }
  };

  const saveDriver = async () => {
    const f = driverForm;
    if (!f || !f.name.trim() || !f.email.trim() || !f.licenseNumber.trim()) {
      message.warning("Please fill name, email and license number");
      return;
    }
    setDriverSaving(true);
    try {
      const payload = {
        name: f.name.trim(),
        email: f.email.trim().toLowerCase(),
        licenseNumber: f.licenseNumber.trim(),
        isActive: f.mode === "edit" ? f.isActive : undefined,
        providerId: f.mode === "create" && !isProviderRole ? f.providerId : undefined,
      };
      if (f.mode === "create") {
        const r = await api.post("/transportation-providers/drivers", payload);
        message.success(`Driver created. Temp password: ${r.data?.defaultPassword ?? "driver123"}`);
      } else if (f.driver) {
        await api.put(`/transportation-providers/drivers/${f.driver.id}`, payload);
        message.success("Driver updated");
      }
      setDriverForm(null);
      refreshTransport();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save driver"));
    } finally {
      setDriverSaving(false);
    }
  };

  const saveVehicle = async () => {
    if (!vehicleForm?.providerId || !vehicleForm.plateNumber.trim()) {
      message.warning("Please fill provider and plate number");
      return;
    }
    setVehicleSaving(true);
    try {
      const payload = {
        providerId: vehicleForm.providerId,
        plateNumber: vehicleForm.plateNumber.trim(),
        capacity: vehicleForm.capacity ?? 12,
        brand: vehicleForm.brand?.trim() || undefined,
      };
      if (vehicleForm.mode === "create") {
        await api.post("/transportation-providers/vehicles", payload);
        message.success("Vehicle created");
      } else {
        await api.put(`/transportation-providers/vehicles/${vehicleForm.vehicleId}`, payload);
        message.success("Vehicle updated");
      }
      setVehicleForm(null);
      refreshTransport();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save vehicle"));
    } finally {
      setVehicleSaving(false);
    }
  };

  const deleteVehicle = async (id: string) => {
    try {
      await api.delete(`/transportation-providers/vehicles/${id}`);
      message.success("Vehicle deleted");
      refreshTransport();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to delete vehicle"));
    }
  };

  const assignDriver = async (providerId: string, userId: string) => {
    setAssigning(true);
    try {
      await api.post(`/transportation-providers/${providerId}/drivers`, { userId });
      message.success("Driver assigned");
      setAssignUser(undefined);
      refreshTransport();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to assign driver"));
    } finally {
      setAssigning(false);
    }
  };

  const unassignDriver = async (providerId: string, userId: string) => {
    try {
      await api.delete(`/transportation-providers/${providerId}/drivers/${userId}`);
      message.success("Driver unassigned");
      refreshTransport();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to unassign driver"));
    }
  };

  const openVehicleCreate = (providerId?: string) => {
    setVehicleForm({
      mode: "create",
      providerId,
      plateNumber: "",
      capacity: undefined,
      brand: undefined,
    });
  };

  const openVehicleEdit = (vehicle: VehicleOpt, providerId: string) => {
    setVehicleForm({
      mode: "edit",
      vehicleId: vehicle.id,
      providerId,
      plateNumber: vehicle.plateNumber ?? "",
      capacity: vehicle.capacity,
      brand: vehicle.brand ?? undefined,
    });
  };

  const providerRows = useMemo<ProviderRow[]>(
    () =>
      providers.map((p) => ({
        id: p.id,
        name: p.name,
        contact: p.contact,
        vehicleCount: p.vehicles?.length ?? 0,
        driverCount: p.drivers?.length ?? 0,
      })),
    [providers],
  );

  const vehicleManageRows = useMemo<VehicleManageRow[]>(() => {
    const rows: VehicleManageRow[] = [];
    providers.forEach((p, pi) => {
      (p.vehicles ?? []).forEach((v) => {
        rows.push({ providerId: p.id, providerName: p.name, _providerIndex: pi, vehicle: v });
      });
    });
    return rows;
  }, [providers]);

  const driverRelationRows = useMemo<DriverRelationRow[]>(() => {
    const rows: DriverRelationRow[] = [];
    providers.forEach((p, pi) => {
      const list = p.drivers ?? [];
      list.forEach((d, di) => {
        rows.push({
          providerId: p.id,
          providerName: p.name,
          _providerIndex: pi,
          _first: di === 0,
          driver: d,
        });
      });
    });
    return rows;
  }, [providers]);

  const openDriverCreate = () => {
    setDriverForm({
      mode: "create",
      providerId: undefined,
      name: "",
      email: "",
      licenseNumber: "",
      isActive: true,
    });
  };

  const openDriverEdit = (driver: PersonOpt) => {
    setDriverForm({
      mode: "edit",
      driver: driver as DriverUser,
      providerId: undefined,
      name: driver.name ?? "",
      email: driver.email,
      licenseNumber: driver.licenseNumber ?? "",
      isActive: driver.isActive,
    });
  };

  const atProviders = useMemo(
    () =>
      Array.from(new Map(assignables.map((a) => [a.providerId, a.providerName])).entries()).map(
        ([value, label]) => ({ value, label }),
      ),
    [assignables],
  );
  const atProviderCombos = useMemo(
    () => assignables.filter((a) => a.providerId === atProvider),
    [assignables, atProvider],
  );
  const atVehicles = useMemo(
    () =>
      Array.from(
        new Map(atProviderCombos.map((a) => [a.vehicleId, a])).values(),
      ).map((a) => ({
        value: a.vehicleId,
        label: `${a.capacity}-seat${a.brand ? ` (${a.brand})` : ""} — ${a.plateNumber ?? ""}`,
      })),
    [atProviderCombos],
  );
  const atVehicleCombos = useMemo(
    () => atProviderCombos.filter((a) => a.vehicleId === atVehicle),
    [atProviderCombos, atVehicle],
  );
  const atTours = useMemo(() => {
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    atVehicleCombos.forEach((a) => {
      if (seen.has(a.tourId)) return;
      seen.add(a.tourId);
      out.push({ value: a.tourId, label: a.tourName });
    });
    return out;
  }, [atVehicleCombos]);
  const atSelected = useMemo(
    () => atVehicleCombos.find((a) => a.tourId === atTour),
    [atVehicleCombos, atTour],
  );
  const atDrivers = useMemo(
    () =>
      driversAll
        .filter((d) => d.providerId === atProvider)
        .map((d) => ({
          value: d.id,
          label: `${d.name ?? d.email}${d.isActive ? "" : " (inactive)"}`,
          disabled: !d.isActive,
        })),
    [driversAll, atProvider],
  );
  const atEndDate = useMemo(() => {
    if (!atDate || !atSelected) return null;
    return atDate.startOf("day").add(Math.max(1, atSelected.durationDays ?? 1) - 1, "day");
  }, [atDate, atSelected]);

  const submitAssignTour = async () => {
    const combo = atSelected;
    if (!combo || !atDate || !atDriver) {
      message.warning("Please pick provider, vehicle, tour, date and driver");
      return;
    }
    const dur = Math.max(1, combo.durationDays ?? 1);
    const start = atDate.startOf("day");
    const end = start.add(dur - 1, "day");
    setAtSaving(true);
    try {
      await api.post("/assignments", {
        code: `${combo.tourName} · ${start.format("DD MMM")}`,
        tourName: combo.tourName,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        vehicleId: combo.vehicleId,
        providerId: combo.providerId,
        driverId: atDriver,
        status: "PENDING",
      });
      message.success("Tour assigned to driver");
      setAtDate(null);
      setAtDriver(undefined);
      setAssignPage(1);
      loadAssignments(1, assignPageSize);
      loadCrewAvail();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to assign tour"));
    } finally {
      setAtSaving(false);
    }
  };

  const openModal = (provider: ProviderDto, tab: "vehicles" | "drivers") => {
    setModalProvider(provider);
    setModalTab(tab);
  };

  const assignStatusTag = (s?: string) => {
    const color =
      s === "COMPLETED" ? "green" : s === "IN_PROGRESS" || s === "DISPATCHED" ? "blue" : "orange";
    return <Tag color={color}>{s ?? "—"}</Tag>;
  };

  const assignDriverColumns = [
    indexColumn(1, 20),
    {
      title: centerTitle("Name"),
      dataIndex: "name",
      key: "name",
      render: (n: string | null) => n || "—",
    },
    {
      title: centerTitle("Email"),
      dataIndex: "email",
      key: "email",
      width: 220,
    },
    {
      title: centerTitle("License"),
      dataIndex: "licenseNumber",
      key: "license",
      width: 120,
      align: "center" as const,
      render: (l: string | null) => (l ? <Text code>{l}</Text> : <Text type="secondary">—</Text>),
    },
    {
      title: centerTitle("Days off"),
      key: "daysOff",
      width: 190,
      render: (_: any, r: DriverUser) => {
        if (!r.isActive) return <Tag color="volcano">Off duty</Tag>;
        const leaves = (driverLeaves[r.id] ?? [])
          .filter((l) => l.status !== "REJECTED")
          .sort((a, b) => a.startDate.localeCompare(b.startDate));
        const upcoming = leaves.find((l) =>
          dayjs(l.endDate).startOf("day").isAfter(dayjs().startOf("day").subtract(1, "day")),
        );
        if (!upcoming) return <Text type="secondary">—</Text>;
        return (
          <Tag color="orange">
            Off {dayjs(upcoming.startDate).format("DD MMM")}–{dayjs(upcoming.endDate).format("DD MMM")}
          </Tag>
        );
      },
    },
    {
      title: centerTitle("Status"),
      key: "status",
      width: 110,
      align: "center" as const,
      render: (_: any, r: DriverUser) => (
        <Switch
          checked={r.isActive}
          onChange={() => toggleDriverActive(r)}
          checkedChildren="Active"
          unCheckedChildren="Inactive"
          disabled={!canDriverUpdate}
          size="small"
        />
      ),
    },
  ] as any[];

  const assignColumns = [
    indexColumn(assignPage, assignPageSize),
    {
      title: centerTitle("Code"),
      dataIndex: "code",
      key: "code",
      width: 200,
      render: (c: string | undefined, r: AssignStatementRow) => (
        <Text strong>
          {c || r.tourName || "—"}
        </Text>
      ),
    },
    {
      title: centerTitle("Tour"),
      dataIndex: "tourName",
      key: "tour",
      render: (t: string | undefined) => t || "—",
    },
    {
      title: centerTitle("Price"),
      dataIndex: "price",
      key: "price",
      width: 100,
      align: "right" as const,
      render: (p: number | undefined) => (p != null ? <Text strong>{usd(p)}</Text> : <Text type="secondary">—</Text>),
    },
    {
      title: centerTitle("Vehicle"),
      dataIndex: "vehicleLabel",
      key: "vehicle",
      width: 190,
      render: (v: string | undefined) => v || "—",
    },
    {
      title: centerTitle("Provider"),
      dataIndex: "providerName",
      key: "provider",
      width: 180,
      render: (p: string | undefined) => p || "—",
    },
    {
      title: centerTitle("Driver"),
      dataIndex: "driverName",
      key: "driver",
      width: 150,
      render: (d: string | undefined) => d || "—",
    },
    {
      title: centerTitle("Start"),
      dataIndex: "startDate",
      key: "startDate",
      width: 110,
      render: (d: string) => (d ? dayjs(d).format("DD MMM") : "—"),
    },
    {
      title: centerTitle("End"),
      dataIndex: "endDate",
      key: "endDate",
      width: 110,
      render: (d: string) => (d ? dayjs(d).format("DD MMM") : "—"),
    },
    {
      title: centerTitle("Status"),
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "center" as const,
      render: assignStatusTag,
    },
  ] as any[];

  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    let p = -1;
    let prev: string | undefined;
    routePrices.forEach((rp, i) => {
      const first = i === 0 || rp.provider?.name !== prev;
      if (first) p += 1;
      prev = rp.provider?.name;
      rows.push({
        ...rp,
        rowNo: (pricePage - 1) * pricePageSize + i + 1,
        _providerIndex: rp.providerIndex ?? p,
        _tourIndex: 0,
        _first: rp.first ?? first,
      });
    });
    return rows;
  }, [routePrices, pricePage, pricePageSize]);

  const providerColumns = [
    indexColumn(1, 20),
    {
      title: "Name", dataIndex: "name", key: "name",
      render: (v: string | null) => v || "—",
      filters: Array.from(new Set(providerRows.map((p) => p.name).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: ProviderRow) => (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Email", dataIndex: "contact", key: "email",
      render: (c: PersonOpt | null) => c?.email ?? "—",
      filters: Array.from(new Set(providerRows.map((p) => p.contact?.email).filter(Boolean))).sort().map((e: any) => ({ text: e, value: e })),
      onFilter: (v: any, r: ProviderRow) => (r.contact?.email ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Role",
      key: "role",
      render: () => <Tag color="purple">TRANSPORT_PROVIDER</Tag>,
    },
    {
      title: "Status",
      dataIndex: "contact",
      key: "status",
      align: "center" as const,
      render: (c: PersonOpt | null) =>
        c ? (c.isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>) : <Tag>—</Tag>,
      filters: [
        { text: "Active", value: true },
        { text: "Inactive", value: false },
      ],
      onFilter: (v: any, r: ProviderRow) => (r.contact?.isActive ?? null) === v,
    },
    {
      title: "Quick View",
      key: "quick",
      align: "center" as const,
      width: 120,
      render: (_: any, r: ProviderRow) => (
        <Space size={4}>
          <Button
            type="text"
            size="small"
            icon={<CarOutlined />}
            title="View vehicles"
            onClick={(e) => {
              e.stopPropagation();
              const p = providers.find((x) => x.id === r.id);
              if (p) openModal(p, "vehicles");
            }}
          >
            {r.vehicleCount}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IdcardOutlined />}
            title="View drivers"
            onClick={(e) => {
              e.stopPropagation();
              const p = providers.find((x) => x.id === r.id);
              if (p) openModal(p, "drivers");
            }}
          >
            {r.driverCount}
          </Button>
        </Space>
      ),
    },
  ] as any[];

  const vehicleManageColumns = [
    indexColumn(1, 50),
    {
      title: "Transportation Provider",
      dataIndex: "providerName",
      key: "provider",
      width: 260,
      render: (_: any, r: VehicleManageRow) => {
        const tag = PROVIDER_TAGS[r._providerIndex % PROVIDER_TAGS.length];
        return (
          <Space size={6}>
            <Tag color={tag} style={{ marginInlineEnd: 0 }}>
              P{r._providerIndex + 1}
            </Tag>
            <Text strong>{r.providerName}</Text>
          </Space>
        );
      },
      filters: Array.from(new Set(vehicleManageRows.map((rv) => rv.providerName).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: VehicleManageRow) => (r.providerName ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Numberplate",
      dataIndex: "vehicle",
      key: "plate",
      render: (_: any, r: VehicleManageRow) => r.vehicle.plateNumber ?? "—",
      filters: Array.from(new Set(vehicleManageRows.map((rv) => rv.vehicle.plateNumber).filter(Boolean))).sort().map((p: any) => ({ text: p, value: p })),
      onFilter: (v: any, r: VehicleManageRow) => (r.vehicle.plateNumber ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Seats",
      dataIndex: "vehicle",
      key: "seats",
      width: 110,
      align: "center" as const,
      render: (_: any, r: VehicleManageRow) =>
        r.vehicle.capacity ? `${r.vehicle.capacity}-seat` : "—",
      filters: Array.from(new Set(vehicleManageRows.map((rv) => rv.vehicle.capacity).filter(Boolean))).sort((a: any, b: any) => a - b).map((c: any) => ({ text: `${c}-seat`, value: c })),
      onFilter: (v: any, r: VehicleManageRow) => r.vehicle.capacity === v,
    },
    {
      title: "Brand",
      dataIndex: "vehicle",
      key: "brand",
      width: 160,
      render: (_: any, r: VehicleManageRow) => r.vehicle.brand ?? "—",
      filters: Array.from(new Set(vehicleManageRows.map((rv) => rv.vehicle.brand).filter(Boolean))).sort().map((b: any) => ({ text: b, value: b })),
      onFilter: (v: any, r: VehicleManageRow) => (r.vehicle.brand ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "",
      key: "actions",
      width: 110,
      align: "center" as const,
      render: (_: any, r: VehicleManageRow) => (
        <Space size={4}>
          {canVehicleUpdate && (
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              title="Edit vehicle"
              onClick={() => openVehicleEdit(r.vehicle, r.providerId)}
            />
          )}
          {canVehicleDelete && (
            <Popconfirm
              title="Delete this vehicle?"
              description="Its route prices will also be removed."
              onConfirm={() => deleteVehicle(r.vehicle.id)}
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} title="Delete vehicle" />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ] as any[];

  const driverRelationColumns = [
    indexColumn(1, 50),
    {
      title: centerTitle("Transportation Provider"),
      dataIndex: "providerName",
      key: "provider",
      width: 260,
      render: (_: any, r: DriverRelationRow) => {
        if (!r._first) return null;
        const tag = PROVIDER_TAGS[r._providerIndex % PROVIDER_TAGS.length];
        return (
          <Space size={6}>
            <Tag color={tag} style={{ marginInlineEnd: 0 }}>
              P{r._providerIndex + 1}
            </Tag>
            <Text strong>{r.providerName}</Text>
          </Space>
        );
      },
      filters: Array.from(new Set(driverRelationRows.map((rd) => rd.providerName).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: DriverRelationRow) => (r.providerName ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: centerTitle("Driver"),
      dataIndex: "driver",
      key: "driver",
      render: (_: any, r: DriverRelationRow) => r.driver.name ?? r.driver.email,
      filters: Array.from(new Set(driverRelationRows.map((rd) => rd.driver.name ?? rd.driver.email).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: DriverRelationRow) => (r.driver.name ?? r.driver.email).toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: centerTitle("Email"),
      dataIndex: "driver",
      key: "email",
      render: (_: any, r: DriverRelationRow) => r.driver.email,
      filters: Array.from(new Set(driverRelationRows.map((rd) => rd.driver.email).filter(Boolean))).sort().map((e: any) => ({ text: e, value: e })),
      onFilter: (v: any, r: DriverRelationRow) => (r.driver.email ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: centerTitle("License"),
      dataIndex: "driver",
      key: "license",
      width: 160,
      render: (_: any, r: DriverRelationRow) =>
        r.driver.licenseNumber ? (
          <Text code>{r.driver.licenseNumber}</Text>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: centerTitle("Status"),
      dataIndex: "driver",
      key: "status",
      width: 120,
      align: "center" as const,
      render: (_: any, r: DriverRelationRow) =>
        r.driver.isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
      filters: [
        { text: "Active", value: true },
        { text: "Inactive", value: false },
      ],
      onFilter: (v: any, r: DriverRelationRow) => r.driver.isActive === v,
    },
    {
      title: "Upcoming Tours",
      key: "tours",
      width: 200,
      render: (_: any, r: DriverRelationRow) => {
        const tours = driverTours[r.driver.id] ?? [];
        const onLeave = todayLeaves[r.driver.id];
        return (
          <Space size={6} wrap>
            {onLeave && (
              <Tooltip
                title={`On leave: ${dayjs(onLeave.startDate).format("DD MMM")} → ${dayjs(onLeave.endDate).format("DD MMM")} (${onLeave.status})`}
              >
                <Tag color="volcano" style={{ marginInlineEnd: 0 }}>
                  Off
                </Tag>
              </Tooltip>
            )}
            {tours.length === 0 ? (
              <Text type="secondary">No tours</Text>
            ) : (
              <Popover
                placement="left"
                title={`Upcoming ${tours.length} tour${tours.length > 1 ? "s" : ""}`}
                content={
                  <div style={{ maxWidth: 360 }}>
                    {tours.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          padding: "2px 0",
                        }}
                      >
                        <Tag
                          color={t.status === "COMPLETED" ? "default" : "blue"}
                          style={{ marginInlineEnd: 0 }}
                        >
                          {dayjs(t.startDate).format("DD MMM")}
                        </Tag>
                        <Text
                          ellipsis
                          style={{ flex: 1, maxWidth: 220 }}
                          title={t.tourName ?? t.code ?? "Tour"}
                        >
                          {t.tourName ?? t.code ?? "Tour"}
                        </Text>
                      </div>
                    ))}
                  </div>
                }
              >
                <Tag color="blue" style={{ cursor: "pointer", marginInlineEnd: 0 }}>
                  {tours.length} tour{tours.length > 1 ? "s" : ""}
                </Tag>
              </Popover>
            )}
          </Space>
        );
      },
    },
    ...(canDriverUpdate || canUnassignDriver
      ? [
          {
            title: "",
            key: "actions",
            width: 110,
            align: "center" as const,
            render: (_: any, r: DriverRelationRow) => (
              <Space size={4}>
                {canDriverUpdate && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    title="Edit driver"
                    onClick={() => openDriverEdit(r.driver)}
                  />
                )}
                {canUnassignDriver && (
                  <Popconfirm
                    title="Remove this driver from provider?"
                    onConfirm={() => unassignDriver(r.providerId, r.driver.id)}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} title="Unassign driver" />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ] as any[];

  const modalVehicleColumns = [
    indexColumn(1, 20),
    {
      title: "Plate Number", dataIndex: "plateNumber", key: "plate",
      render: (v: string | null) => v || "—",
      filters: Array.from(new Set((modalProvider?.vehicles ?? []).map((vs) => vs.plateNumber).filter(Boolean))).sort().map((p: any) => ({ text: p, value: p })),
      onFilter: (v: any, r: VehicleOpt) => (r.plateNumber ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Seats", dataIndex: "capacity", key: "seats", align: "center" as const,
      render: (v: number) => `${v}-seat`,
      filters: Array.from(new Set((modalProvider?.vehicles ?? []).map((vs) => vs.capacity).filter(Boolean))).sort((a: any, b: any) => a - b).map((c: any) => ({ text: `${c}-seat`, value: c })),
      onFilter: (v: any, r: VehicleOpt) => r.capacity === v,
    },
    {
      title: "Brand", dataIndex: "brand", key: "brand",
      render: (v: string | null) => v || "—",
      filters: Array.from(new Set((modalProvider?.vehicles ?? []).map((vs) => vs.brand).filter(Boolean))).sort().map((b: any) => ({ text: b, value: b })),
      onFilter: (v: any, r: VehicleOpt) => (r.brand ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    ...(canVehicleUpdate || canVehicleDelete
      ? [
          {
            title: "",
            key: "actions",
            width: 110,
            align: "center" as const,
            render: (_: any, v: VehicleOpt) => (
              <Space size={4}>
                {canVehicleUpdate && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    title="Edit vehicle"
                    onClick={() => openVehicleEdit(v, modalProvider?.id ?? "")}
                  />
                )}
                {canVehicleDelete && (
                  <Popconfirm
                    title="Delete this vehicle?"
                    description="Its route prices will also be removed."
                    onConfirm={() => deleteVehicle(v.id)}
                  >
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} title="Delete vehicle" />
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]
      : []),
  ] as any[];

  const modalDriverColumns = [
    indexColumn(1, 20),
    {
      title: "Name", dataIndex: "name", key: "name",
      render: (v: string | null, r: PersonOpt) => v ?? r.email,
      filters: Array.from(new Set((modalProvider?.drivers ?? []).map((d) => d.name ?? d.email).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: PersonOpt) => (r.name ?? r.email).toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Email", dataIndex: "email", key: "email",
      filters: Array.from(new Set((modalProvider?.drivers ?? []).map((d) => d.email).filter(Boolean))).sort().map((e: any) => ({ text: e, value: e })),
      onFilter: (v: any, r: PersonOpt) => (r.email ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "status",
      align: "center" as const,
      render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>),
      filters: [
        { text: "Active", value: true },
        { text: "Inactive", value: false },
      ],
      onFilter: (v: any, r: PersonOpt) => r.isActive === v,
    },
    ...(canUnassignDriver
      ? [
          {
            title: "",
            key: "actions",
            width: 90,
            align: "center" as const,
            render: (_: any, d: PersonOpt) => (
              <Popconfirm
                title="Remove this driver from provider?"
                onConfirm={() => unassignDriver(modalProvider?.id ?? "", d.id)}
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />} title="Unassign driver" />
              </Popconfirm>
            ),
          },
        ]
      : []),
  ] as any[];

  const renderDriverModal = () => {
    const f = driverForm;
    if (!f) return null;
    return (
      <Modal
        open={!!f}
        title={f.mode === "create" ? "Add Driver" : `Edit Driver: ${f.driver?.name ?? f.driver?.email}`}
        width={480}
        okText={f.mode === "create" ? "Add" : "Save"}
        okButtonProps={{ loading: driverSaving }}
        onOk={saveDriver}
        onCancel={() => {
          if (!driverSaving) setDriverForm(null);
        }}
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <FlexRow>
            <Input
              placeholder="Full name"
              value={f.name}
              onChange={(e) => setDriverForm({ ...f, name: e.target.value })}
            />
            <Input
              placeholder="Email (login)"
              value={f.email}
              onChange={(e) => setDriverForm({ ...f, email: e.target.value })}
            />
          </FlexRow>
          <FlexRow>
            <Input
              placeholder="License number"
              value={f.licenseNumber}
              onChange={(e) => setDriverForm({ ...f, licenseNumber: e.target.value })}
            />
            {!isProviderRole && f.mode === "create" && (
              <Select
                placeholder="Provider (optional — or assign later)"
                style={{ minWidth: 240 }}
                allowClear
                value={f.providerId}
                onChange={(v) => setDriverForm({ ...f, providerId: v })}
                options={providers.map((p) => ({ value: p.id, label: p.name }))}
                showSearch
                optionFilterProp="label"
              />
            )}
          </FlexRow>
          {f.mode === "edit" && (
            <FlexRow>
              <Space size={8}>
                <Switch
                  checked={f.isActive}
                  onChange={(v) => setDriverForm({ ...f, isActive: v })}
                />
                <Typography.Text>{f.isActive ? "Active" : "Inactive"}</Typography.Text>
              </Space>
            </FlexRow>
          )}
          {f.mode === "create" && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Driver will log in with a temporary password <Text code>driver123</Text>. A
              welcome-email flow can be added later.
            </Typography.Text>
          )}
        </Space>
      </Modal>
    );
  };

  const renderPriceDrawer = () => {
    return (
      <Drawer
        title="Add Tour Price"
        placement="right"
        width={420}
        open={priceDrawer}
        onClose={() => setPriceDrawer(false)}
        extra={
          <Button type="primary" icon={<PlusOutlined />} loading={saving} onClick={create}>
            Save
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Transportation Provider</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="Provider"
              value={selProvider}
              onChange={setSelProvider}
              options={optionData.providers.map((p) => ({ value: p.id, label: p.name }))}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Tour</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="Tour"
              value={selTour}
              onChange={setSelTour}
              options={optionData.tours.map((t) => ({ value: t.id, label: t.name }))}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Seats / Vehicle</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="Seats"
              value={selSeat}
              onChange={setSelSeat}
              disabled={!selProvider}
              options={seatOptions.map((v) => ({
                value: v.id,
                label: `${v.capacity}-seat${v.brand ? ` (${v.brand})` : ""} — ${v.plateNumber ?? ""}`,
              }))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Price</Text>
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Price"
              min={0}
              prefix="$"
              value={price}
              onChange={setPrice}
            />
          </div>
        </Space>
      </Drawer>
    );
  };

  const renderVehicleForm = () => {
    if (!vehicleForm) return null;
    return (
      <Modal
        open={!!vehicleForm}
        title={vehicleForm.mode === "create" ? "Add Vehicle" : "Edit Vehicle"}
        okText={vehicleForm.mode === "create" ? "Create" : "Save"}
        confirmLoading={vehicleSaving}
        onOk={saveVehicle}
        onCancel={() => setVehicleForm(null)}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Transportation Provider</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="Provider"
              value={vehicleForm.providerId}
              onChange={(v) => setVehicleForm((f) => (f ? { ...f, providerId: v } : f))}
              options={providers.map((p) => ({ value: p.id, label: p.name }))}
              showSearch
              optionFilterProp="label"
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Plate Number</Text>
            <Input
              placeholder="e.g. 43A-123.45"
              value={vehicleForm.plateNumber}
              onChange={(e) =>
                setVehicleForm((f) => (f ? { ...f, plateNumber: e.target.value } : f))
              }
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Seats</Text>
            <InputNumber
              style={{ width: "100%" }}
              placeholder="Capacity"
              min={1}
              value={vehicleForm.capacity}
              onChange={(v) => setVehicleForm((f) => (f ? { ...f, capacity: v ?? undefined } : f))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Brand</Text>
            <Input
              placeholder="e.g. Thaco"
              value={vehicleForm.brand}
              onChange={(e) =>
                setVehicleForm((f) => (f ? { ...f, brand: e.target.value } : f))
              }
            />
          </div>
        </Space>
      </Modal>
    );
  };

  const renderProviderModal = () => {
    const p = modalProvider;
    if (!p) return null;
    const vehicles = p.vehicles ?? [];
    const drivers = p.drivers ?? [];
    return (
      <Modal
        open={!!modalProvider}
        title={`Transportation Provider: ${p.name}`}
        width={1000}
        footer={null}
        onCancel={() => setModalProvider(null)}
      >
        <Tabs
          size="small"
          activeKey={modalTab}
          onChange={(k) => setModalTab(k as "vehicles" | "drivers")}
          items={[
            {
              key: "vehicles",
              label: (
                <Space size={6}>
                  <CarOutlined />
                  Vehicles ({vehicles.length})
                </Space>
              ),
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {canVehicleCreate && (
                    <FlexRow>
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openVehicleCreate(p.id)}>
                        Add Vehicle
                      </Button>
                    </FlexRow>
                  )}
                  <Table<VehicleOpt>
                    rowKey="id"
                    size="small"
                    columns={modalVehicleColumns}
                    dataSource={vehicles}
                    pagination={false}
                  />
                </Space>
              ),
            },
            {
              key: "drivers",
              label: (
                <Space size={6}>
                  <IdcardOutlined />
                  Drivers ({drivers.length})
                </Space>
              ),
              children: (
                <Space direction="vertical" style={{ width: "100%" }} size={12}>
                  {canAssignDriver && (
                    <FlexRow>
                      <Select
                        style={{ width: 320 }}
                        placeholder="Unassigned driver"
                        value={assignUser}
                        onChange={setAssignUser}
                        options={unassignedDrivers.map((d) => ({
                          value: d.id,
                          label: d.name ? `${d.name} — ${d.email}` : d.email,
                        }))}
                        showSearch
                        optionFilterProp="label"
                      />
                      <Button
                        type="primary"
                        size="small"
                        icon={<UserAddOutlined />}
                        loading={assigning}
                        disabled={!assignUser}
                        onClick={() => p.id && assignUser && assignDriver(p.id, assignUser)}
                      >
                        Assign
                      </Button>
                    </FlexRow>
                  )}
                  <Table<PersonOpt>
                    rowKey="id"
                    size="small"
                    columns={modalDriverColumns}
                    dataSource={drivers}
                    pagination={false}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Modal>
    );
  };

  const priceColumns = [
    indexColumn(pricePage, pricePageSize),
    {
      title: "Provider",
      dataIndex: "provider",
      key: "provider",
      width: 220,
      render: (_: any, r: FlatRow) => {
        if (!r._first) return null;
        const tag = PROVIDER_TAGS[r._providerIndex % PROVIDER_TAGS.length];
        return (
          <Space size={6}>
            <Tag color={tag} style={{ marginInlineEnd: 0 }}>
              P{r._providerIndex + 1}
            </Tag>
            <Text strong>{r.provider?.name ?? "—"}</Text>
          </Space>
        );
      },
      filters: Array.from(new Set(routePrices.map((rp) => rp.provider?.name).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: FlatRow) => (r.provider?.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    { title: "Tour", dataIndex: "tour", key: "tour", ellipsis: true, render: (_: any, r: FlatRow) => <span>{r.tour?.name ?? "—"}</span>,
      filters: Array.from(new Set(routePrices.map((rp) => rp.tour?.name).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: FlatRow) => (r.tour?.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Seats",
      key: "seats",
      width: 110,
      render: (_: any, r: FlatRow) => <span>{r.vehicle?.capacity ? `${r.vehicle.capacity}-seat` : "—"}</span>,
      filters: Array.from(new Set(routePrices.map((rp) => rp.vehicle?.capacity).filter(Boolean))).sort((a: any, b: any) => a - b).map((c: any) => ({ text: `${c}-seat`, value: c })),
      onFilter: (v: any, r: FlatRow) => r.vehicle?.capacity === v,
    },
    {
      title: "Brand of Bus",
      key: "brand",
      width: 140,
      render: (_: any, r: FlatRow) => <span>{r.vehicle?.brand ?? "—"}</span>,
      filters: Array.from(new Set(routePrices.map((rp) => rp.vehicle?.brand).filter(Boolean))).sort().map((b: any) => ({ text: b, value: b })),
      onFilter: (v: any, r: FlatRow) => (r.vehicle?.brand ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Price",
      dataIndex: "price",
      key: "price",
      width: 140,
      align: "right" as const,
      render: (v: string | number) => <Text strong>{usd(v)}</Text>,
    },
    ...(canDelete
      ? [
          {
            title: "",
            key: "del",
            width: 56,
            align: "center" as const,
            render: (_: any, r: FlatRow) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => remove(r.id)}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="transport-page">
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "prices",
            label: (
              <Space size={6}>
                <DollarOutlined />
                Tour Price
              </Space>
            ),
            children: (
              <Card size="small" variant="borderless">
                {canCreate && (
                  <FlexRow marginBottom={12}>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setPriceDrawer(true)}>
                      Add Tour Price
                    </Button>
                  </FlexRow>
                )}
                <Table<FlatRow>
                  rowKey="id"
                  loading={loading}
                  size="small"
                  tableLayout="fixed"
                  pagination={{
                    current: pricePage,
                    pageSize: pricePageSize,
                    total: priceTotal,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    showTotal: (t) => `${t} items`,
                    onChange: (p, s) => {
                      if (s !== pricePageSize) {
                        setPricePageSize(s);
                        setPricePage(1);
                      } else {
                        setPricePage(p);
                      }
                    },
                  }}
                  dataSource={flatRows}
                  columns={priceColumns}
                  onRow={(r) => ({
                    style: { backgroundColor: tourBg(r._providerIndex, isDark) },
                  })}
                  rowClassName={(r) =>
                    (r._providerIndex % 2 === 1 ? "transport-stripe" : "") +
                    (r._first ? " tour-price-first" : " tour-price-row")
                  }
                  scroll={{ x: 800, y: tableHeight }}
                />
              </Card>
            ),
          },
          {
            key: "providers",
            label: (
              <Space size={6}>
                <CarOutlined />
                Transportation Provider
              </Space>
            ),
            children: (
              <Card size="small" variant="borderless">
                <Table<ProviderRow>
                  rowKey="id"
                  size="small"
                  loading={providersLoading}
                  tableLayout="fixed"
                  dataSource={providerRows}
                  columns={providerColumns}
                  onRow={(r) => ({
                    onClick: () => {
                      const p = providers.find((x) => x.id === r.id);
                      if (p) openModal(p, "vehicles");
                    },
                  })}
                  rowClassName={() => "provider-row-clickable"}
                  pagination={{ pageSize: 10, showSizeChanger: true }}
                  scroll={{ x: 800, y: tableHeight }}
                />
              </Card>
            ),
          },
          {
            key: "provider-vehicles",
            label: (
              <Space size={6}>
                <CarOutlined />
                Provider &amp; Vehicles
              </Space>
            ),
            children: (
              <Card size="small" variant="borderless">
                {canVehicleCreate && (
                  <FlexRow marginBottom={12}>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openVehicleCreate()}>
                      Add Vehicle
                    </Button>
                  </FlexRow>
                )}
                <Typography.Text strong style={{ fontSize: 15 }}>
                  Manage Numberplate
                </Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Table<VehicleManageRow>
                    rowKey={(r) => r.vehicle.id}
                    size="small"
                    loading={providersLoading}
                    tableLayout="fixed"
                    dataSource={vehicleManageRows}
                    columns={vehicleManageColumns}
                    locale={{ emptyText: "No vehicles found" }}
                    pagination={{ pageSize: 20, showSizeChanger: true }}
                    scroll={{ x: 800, y: tableHeight }}
                  />
                </div>
              </Card>
            ),
          },
          {
            key: "provider-drivers",
            label: (
              <Space size={6}>
                <IdcardOutlined />
                Provider &amp; Driver
              </Space>
            ),
            children: (
              <Card size="small" variant="borderless">
                <FlexRow marginBottom={12}>
                  <Button
                    size="small"
                    icon={<CalendarOutlined />}
                    onClick={() => setCrewCalendarOpen(true)}
                  >
                    Crew availability calendar
                  </Button>
                  {canDriverCreate && (
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openDriverCreate}
                    >
                      Add Driver
                    </Button>
                  )}
                  {canAssignDriver && (
                    <>
                      <Select
                        style={{ width: 320 }}
                        placeholder="Provider"
                        value={assignProvider}
                        onChange={setAssignProvider}
                        options={providers.map((p) => ({ value: p.id, label: p.name }))}
                        showSearch
                        optionFilterProp="label"
                      />
                      <Select
                        style={{ width: 320 }}
                        placeholder="Unassigned driver"
                        value={assignUser}
                        onChange={setAssignUser}
                        options={unassignedDrivers.map((d) => ({
                          value: d.id,
                          label: d.name ? `${d.name} — ${d.email}` : d.email,
                        }))}
                        showSearch
                        optionFilterProp="label"
                      />
                      <Button
                        type="primary"
                        size="small"
                        icon={<UserAddOutlined />}
                        loading={assigning}
                        disabled={!assignProvider || !assignUser}
                        onClick={() => assignProvider && assignUser && assignDriver(assignProvider, assignUser)}
                      >
                        Assign
                      </Button>
                    </>
                  )}
                </FlexRow>
                <Table<DriverRelationRow>
                  rowKey={(r) => r.providerId + r.driver.id}
                  size="small"
                  loading={providersLoading}
                  tableLayout="fixed"
                  dataSource={driverRelationRows}
                  columns={driverRelationColumns}
                  locale={{ emptyText: "No drivers found" }}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  scroll={{ x: 800, y: tableHeight }}
                />
              </Card>
            ),
          },
          {
            key: "assign-tour",
            label: (
              <Space size={6}>
                <UserAddOutlined />
                Assign Transportation
              </Space>
            ),
            children: (
              <Card size="small" variant="borderless">
                <Alert
                  type="info"
                  showIcon
                  banner={false}
                  message="Assign a driver to a tour based on declared price"
                  style={{ fontSize: 12, paddingTop: 4, paddingBottom: 4, marginBottom: 12 }}
                />
                {!canAssignTour && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 8, marginTop: 8 }}>
                    You need the <Text code>assignment.create</Text> permission to assign tours.
                  </Typography.Paragraph>
                )}
                <Space wrap size={12} style={{ marginTop: 12 }}>
                  {isProviderRole ? (
                    <Tag color="blue" style={{ lineHeight: "24px", marginInlineEnd: 0 }}>
                      {user?.name ?? "Transportation Provider"}
                    </Tag>
                  ) : (
                    <Select
                      placeholder="Provider"
                      style={{ minWidth: 210 }}
                      value={atProvider}
                      onChange={(v) => {
                        setAtProvider(v);
                        setAtVehicle(undefined);
                        setAtTour(undefined);
                        setAtDate(null);
                        setAtDriver(undefined);
                      }}
                      options={atProviders}
                      showSearch
                      optionFilterProp="label"
                      loading={assignableLoading}
                    />
                  )}
                  <Select
                    placeholder="Vehicle"
                    style={{ minWidth: 210 }}
                    value={atVehicle}
                    onChange={(v) => {
                      setAtVehicle(v);
                      setAtTour(undefined);
                      setAtDate(null);
                    }}
                    options={atVehicles}
                    showSearch
                    optionFilterProp="label"
                    disabled={!atProvider}
                    notFoundContent="No vehicles with declared price"
                  />
                  <Select
                    placeholder="Tour"
                    style={{ minWidth: 280 }}
                    value={atTour}
                    onChange={(v) => {
                      setAtTour(v);
                      setAtDate(null);
                    }}
                    options={atTours}
                    showSearch
                    optionFilterProp="label"
                    disabled={!atVehicle}
                    notFoundContent="No tours with declared price"
                  />
                  <DatePicker
                    placeholder="Start date"
                    value={atDate}
                    onChange={setAtDate}
                    format="DD MMM YYYY"
                    style={{ width: 180 }}
                    disabled={!atTour}
                  />
                  <Select
                    placeholder="Driver"
                    style={{ minWidth: 190 }}
                    value={atDriver}
                    onChange={setAtDriver}
                    options={atDrivers}
                    showSearch
                    optionFilterProp="label"
                    disabled={!atProvider}
                    notFoundContent="No drivers in this provider — add one in Transportation Provider tab"
                  />
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    loading={atSaving}
                    disabled={!canAssignTour || !atSelected || !atDate || !atDriver}
                    onClick={submitAssignTour}
                  >
                    Assign
                  </Button>
                </Space>
                {atSelected && (
                  <Space wrap size={24} style={{ marginTop: 12 }}>
                    <Space size={6}>
                      <Typography.Text type="secondary">Tour:</Typography.Text>
                      <Text strong>
                        {atSelected.tourName}
                        {atSelected.durationDays > 1 ? ` (${atSelected.durationDays} days)` : ""}
                      </Text>
                    </Space>
                    <Space size={6}>
                      <Typography.Text type="secondary">Price:</Typography.Text>
                      <Text strong>{usd(atSelected.price)}</Text>
                    </Space>
                    <Space size={6}>
                      <Typography.Text type="secondary">Vehicle:</Typography.Text>
                      <Text>{`${atSelected.capacity}-seat${atSelected.brand ? ` (${atSelected.brand})` : ""} — ${atSelected.plateNumber ?? ""}`}</Text>
                    </Space>
                    {atEndDate && (
                      <Space size={6}>
                        <Typography.Text type="secondary">Ends:</Typography.Text>
                        <Text>{atEndDate.format("DD MMM YYYY")}</Text>
                      </Space>
                    )}
                  </Space>
                )}
                {(isProviderRole || atProvider) && (
                  <Table<DriverUser>
                    rowKey="id"
                    size="small"
                    tableLayout="fixed"
                    dataSource={driversAll.filter((d) => d.providerId === atProvider)}
                    columns={assignDriverColumns}
                    locale={{ emptyText: "No drivers for this provider yet" }}
                    pagination={false}
                    title={() => (
                      <Space wrap size={8}>
                        <Typography.Text strong style={{ fontSize: 13 }}>
                          Drivers
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          Toggle a driver to mark them off duty (days off)
                        </Typography.Text>
                      </Space>
                    )}
                    scroll={{ x: 720 }}
                  />
                )}
                <Table<AssignStatementRow>
                  rowKey="id"
                  style={{ marginTop: 16 }}
                  loading={assignRowsLoading}
                  size="small"
                  tableLayout="fixed"
                  dataSource={assignRows}
                  columns={assignColumns}
                  locale={{ emptyText: "No assignments yet — pick a combo above and click Assign" }}
                  pagination={{
                    current: assignPage,
                    pageSize: assignPageSize,
                    total: assignTotal,
                    showSizeChanger: true,
                    pageSizeOptions: [10, 20, 50, 100],
                    showTotal: (t) => `${t} items`,
                    onChange: (p, s) => loadAssignments(p, s),
                  }}
                  scroll={{ x: 950, y: tableHeight }}
                />
              </Card>
            ),
          },
        ]}
      />
      {renderPriceDrawer()}
      {renderProviderModal()}
      {renderVehicleForm()}
      {renderDriverModal()}
      <CrewAvailabilityDrawer
        open={crewCalendarOpen}
        onClose={() => setCrewCalendarOpen(false)}
      />
    </div>
  );
}

function FlexRow({
  children,
  marginBottom,
}: {
  children: React.ReactNode;
  marginBottom?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: marginBottom ?? 0,
      }}
    >
      {children}
    </div>
  );
}