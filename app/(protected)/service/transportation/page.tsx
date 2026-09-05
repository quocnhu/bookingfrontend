"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CarOutlined,
  DollarOutlined,
  IdcardOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
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

interface VehicleFormState {
  mode: "create" | "edit";
  vehicleId?: string;
  providerId?: string;
  plateNumber: string;
  capacity?: number;
  brand?: string;
}

const PROVIDER_HUES = [210, 350, 145, 270, 15, 190, 35, 320, 210, 90, 0, 300];

const PROVIDER_TAGS = ["blue", "volcano", "green", "purple", "orange", "cyan", "gold", "magenta"];

const tourBg = (providerIndex: number, isDark: boolean): string => {
  if (isDark) return providerIndex % 2 === 0 ? "rgba(38, 84, 212, 0.28)" : "rgba(255, 255, 255, 0.055)";
  return providerIndex % 2 === 0 ? "#e6f4ff" : "#f5f5f5";
};

const usd = (n: string | number) =>
  `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function TransportationPage() {
  const { hasPermission, theme } = useApp();
  const isDark = theme === "dark";
  const canCreate = hasPermission("route-price.create");
  const canDelete = hasPermission("route-price.delete");
  const canVehicleCreate = hasPermission("vehicle.create");
  const canVehicleUpdate = hasPermission("vehicle.update");
  const canVehicleDelete = hasPermission("vehicle.delete");
  const canProviderCreate = hasPermission("provider.create");
  const canAssignDriver = hasPermission("provider-driver.assign");
  const canUnassignDriver = hasPermission("provider-driver.unassign");

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

  const [providerDrawer, setProviderDrawer] = useState(false);
  const [providerForm, setProviderForm] = useState<{
    name: string;
    email: string;
    password: string;
  }>({ name: "", email: "", password: "" });
  const [providerSaving, setProviderSaving] = useState(false);

  const [modalProvider, setModalProvider] = useState<ProviderDto | null>(null);
  const [modalTab, setModalTab] = useState<"vehicles" | "drivers">("vehicles");

  const [vehicleForm, setVehicleForm] = useState<VehicleFormState | null>(null);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [assignProvider, setAssignProvider] = useState<string | undefined>();
  const [assignUser, setAssignUser] = useState<string | undefined>();
  const [assigning, setAssigning] = useState(false);

  const [activeTab, setActiveTab] = useState("prices");

  const tableHeight = useFillHeight({
    rootSelector: ".transport-page",
    activeTab,
    deps: [routePrices.length, providers.length, driversAll.length],
  });

  const load = (page = pricePage, pageSize = pricePageSize) => {
    setLoading(true);
    setPricePage(page);
    api
      .get("/route-prices", { params: { page, limit: pageSize } })
      .then((r) => {
        setRoutePrices((r.data?.items ?? []) as RoutePriceRow[]);
        setPriceTotal(r.data?.total ?? 0);
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

  const refreshTransport = () => {
    loadProviders();
    loadDrivers();
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
      load(1, pricePageSize);
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
      if (routePrices.length <= 1 && pricePage > 1) {
        load(pricePage - 1, pricePageSize);
      } else {
        load(pricePage, pricePageSize);
      }
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to delete"));
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

  const createProvider = async () => {
    if (!providerForm.name.trim() || !providerForm.email.trim()) {
      message.warning("Please fill provider name and email");
      return;
    }
    setProviderSaving(true);
    try {
      const res = await api.post("/transportation-providers", {
        name: providerForm.name.trim(),
        email: providerForm.email.trim(),
        password: providerForm.password.trim() || undefined,
      });
      if (res.data?.defaultPassword) {
        message.success(
          `Provider created. Default password: ${res.data.defaultPassword}. User will appear on the Users table.`,
          6,
        );
      } else {
        message.success("Provider created. A TRANSPORT_PROVIDER user will appear on the Users table.");
      }
      setProviderDrawer(false);
      setProviderForm({ name: "", email: "", password: "" });
      refreshTransport();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create provider"));
    } finally {
      setProviderSaving(false);
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

  const openModal = (provider: ProviderDto, tab: "vehicles" | "drivers") => {
    setModalProvider(provider);
    setModalTab(tab);
  };

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
      title: "Transportation Provider",
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
      title: "Driver",
      dataIndex: "driver",
      key: "driver",
      render: (_: any, r: DriverRelationRow) => r.driver.name ?? r.driver.email,
      filters: Array.from(new Set(driverRelationRows.map((rd) => rd.driver.name ?? rd.driver.email).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: DriverRelationRow) => (r.driver.name ?? r.driver.email).toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Email",
      dataIndex: "driver",
      key: "email",
      render: (_: any, r: DriverRelationRow) => r.driver.email,
      filters: Array.from(new Set(driverRelationRows.map((rd) => rd.driver.email).filter(Boolean))).sort().map((e: any) => ({ text: e, value: e })),
      onFilter: (v: any, r: DriverRelationRow) => (r.driver.email ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Status",
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
    ...(canUnassignDriver
      ? [
          {
            title: "",
            key: "actions",
            width: 90,
            align: "center" as const,
            render: (_: any, r: DriverRelationRow) => (
              <Popconfirm
                title="Remove this driver from provider?"
                onConfirm={() => unassignDriver(r.providerId, r.driver.id)}
              >
                <Button type="text" danger size="small" icon={<DeleteOutlined />} title="Unassign driver" />
              </Popconfirm>
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

  const renderProviderDrawer = () => {
    return (
      <Drawer
        title="Add Transportation Provider"
        placement="right"
        width={420}
        open={providerDrawer}
        onClose={() => setProviderDrawer(false)}
        extra={
          <Button type="primary" icon={<PlusOutlined />} loading={providerSaving} onClick={createProvider}>
            Save
          </Button>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }} size={16}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Provider Name</Text>
            <Input
              placeholder="e.g. Da Nang Bus Co."
              value={providerForm.name}
              onChange={(e) => setProviderForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Contact Email</Text>
            <Input
              placeholder="e.g. contact@danangbus.local"
              value={providerForm.email}
              onChange={(e) => setProviderForm((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Text strong>Password (optional)</Text>
            <Input.Password
              placeholder="Default: provider123"
              value={providerForm.password}
              onChange={(e) => setProviderForm((f) => ({ ...f, password: e.target.value }))}
            />
          </div>
          <Typography.Text type="secondary">
            A TRANSPORT_PROVIDER user is created with this email — it will also appear on the Users table.
          </Typography.Text>
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
                    pageSizeOptions: [10, 20, 50, 100],
                    showTotal: (t) => `${t} items`,
                    onChange: (p, s) => load(p, s),
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
                {canProviderCreate && (
                  <FlexRow marginBottom={12}>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setProviderDrawer(true)}>
                      Add Provider
                    </Button>
                  </FlexRow>
                )}
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
                {canAssignDriver && (
                  <FlexRow marginBottom={12}>
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
                  </FlexRow>
                )}
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
        ]}
      />
      {renderPriceDrawer()}
      {renderProviderDrawer()}
      {renderProviderModal()}
      {renderVehicleForm()}
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