"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  SettingOutlined,
  StopOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";
import { useSocket } from "@/lib/use-socket";

const { Text, Title } = Typography;

type RequestStatus =
  | "NOT_REQUIRED"
  | "REQUESTED"
  | "VIEWED"
  | "ASSIGNED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

interface TransportRequest {
  id: string;
  code?: string | null;
  tourName?: string | null;
  tourCode?: string | null;
  totalPax?: number | null;
  startDate: string;
  endDate: string;
  status: string;
  provider?: { id: string; name: string; isCompany?: boolean } | null;
  driver?: { id: string; name?: string | null } | null;
  vehicle?: { id: string; plateNumber?: string | null; capacity?: number | null } | null;
  pickups?: Array<{ pickup?: string | null; customerName?: string | null }>;
  providerRequestStatus: RequestStatus;
  providerRequestedAt?: string | null;
  providerDeadline?: string | null;
  providerRequestNote?: string | null;
  providerResponseNote?: string | null;
  providerDeclineReason?: string | null;
}

interface ProviderOption {
  id: string;
  name: string;
}

interface CandidateDriver {
  id: string;
  name?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  rating?: number;
  workloadDays?: number;
  workloadTrips?: number;
  available: boolean;
  busy: boolean;
  onLeave: boolean;
}

interface CandidateVehicle {
  id: string;
  plateNumber?: string | null;
  capacity?: number | null;
  brand?: string | null;
  available: boolean;
  busy: boolean;
}

interface Candidates {
  drivers: CandidateDriver[];
  vehicles: CandidateVehicle[];
  recommendedDriverId?: string | null;
  recommendedVehicleId?: string | null;
  workloadWindow?: { days: number };
}

interface Settings {
  enabled: boolean;
  sendDaysBefore: number;
  sendTime: string;
  deadlineTime: string;
  minLeadHours: number;
}

const STATUS_COLOR: Record<RequestStatus, string> = {
  NOT_REQUIRED: "default",
  REQUESTED: "orange",
  VIEWED: "gold",
  ASSIGNED: "green",
  DECLINED: "red",
  EXPIRED: "volcano",
  CANCELLED: "default",
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  NOT_REQUIRED: "Not requested",
  REQUESTED: "Requested",
  VIEWED: "Viewed",
  ASSIGNED: "Assigned",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

const timeToDayjs = (value: string) => dayjs(`2000-01-01T${value}:00`);

export default function AdminTransportRequests() {
  const { on } = useSocket();
  const [rows, setRows] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | undefined>();
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [sendTarget, setSendTarget] = useState<TransportRequest | null>(null);
  const [sendProviderId, setSendProviderId] = useState<string | undefined>();
  const [sendNote, setSendNote] = useState("");
  const [sending, setSending] = useState(false);

  const [overrideTarget, setOverrideTarget] = useState<TransportRequest | null>(null);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [overrideDriverId, setOverrideDriverId] = useState<string | undefined>();
  const [overrideVehicleId, setOverrideVehicleId] = useState<string | undefined>();
  const [overrideNote, setOverrideNote] = useState("");
  const [overriding, setOverriding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      if (range?.[0]) params.from = range[0].format("YYYY-MM-DD");
      if (range?.[1]) params.to = range[1].format("YYYY-MM-DD");
      const { data } = await api.get("/transport-requests", { params });
      setRows(data ?? []);
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load transport requests"));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, range]);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/transport-requests/settings");
      setSettings(data);
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load settings"));
    }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      const { data } = await api.get("/transportation-providers");
      setProviders(
        (data ?? []).map((p: ProviderOption) => ({ id: p.id, name: p.name })),
      );
    } catch {
      setProviders([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings();
    loadProviders();
  }, [loadSettings, loadProviders]);

  useEffect(() => {
    const off = on("transport:refresh", () => load());
    return () => off();
  }, [on, load]);

  const openSend = (row: TransportRequest) => {
    setSendTarget(row);
    setSendProviderId(row.provider?.id);
    setSendNote(row.providerRequestNote ?? "");
  };

  const submitSend = async () => {
    if (!sendTarget) return;
    if (!sendProviderId) {
      message.warning("Select a transportation provider");
      return;
    }
    setSending(true);
    try {
      await api.post(`/transport-requests/${sendTarget.id}/send`, {
        providerId: sendProviderId,
        note: sendNote.trim() || undefined,
      });
      message.success("Transport request sent");
      setSendTarget(null);
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, "Could not send the request"));
    } finally {
      setSending(false);
    }
  };

  const cancelRequest = (row: TransportRequest) => {
    Modal.confirm({
      title: "Cancel this transport request?",
      content: `${row.tourName ?? row.code ?? "Trip"} will no longer ask the provider for a driver.`,
      okText: "Cancel request",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.post(`/transport-requests/${row.id}/cancel`, {});
          message.success("Transport request cancelled");
          await load();
        } catch (error) {
          message.error(getErrorMessage(error, "Could not cancel the request"));
        }
      },
    });
  };

  const openOverride = async (row: TransportRequest) => {
    setOverrideTarget(row);
    setCandidates(null);
    setOverrideDriverId(row.driver?.id);
    setOverrideVehicleId(row.vehicle?.id);
    setOverrideNote("");
    setCandidatesLoading(true);
    try {
      const { data } = await api.get(`/transport-requests/candidates/${row.id}`);
      setCandidates(data);
      setOverrideDriverId(data?.recommendedDriverId ?? row.driver?.id);
      setOverrideVehicleId(data?.recommendedVehicleId ?? row.vehicle?.id);
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load drivers and vehicles"));
    } finally {
      setCandidatesLoading(false);
    }
  };

  const submitOverride = async () => {
    if (!overrideTarget) return;
    if (!overrideDriverId) {
      message.warning("Select a driver");
      return;
    }
    if (!overrideVehicleId) {
      message.warning("Select a vehicle");
      return;
    }
    setOverriding(true);
    try {
      await api.post(`/transport-requests/${overrideTarget.id}/override`, {
        providerId: overrideTarget.provider?.id,
        driverId: overrideDriverId,
        vehicleId: overrideVehicleId,
        note: overrideNote.trim() || undefined,
      });
      message.success("Driver and vehicle assigned");
      setOverrideTarget(null);
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, "Could not assign the driver"));
    } finally {
      setOverriding(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      const { data } = await api.put("/transport-requests/settings", settings);
      setSettings(data);
      message.success("Transport request settings saved");
    } catch (error) {
      message.error(getErrorMessage(error, "Could not save settings"));
    } finally {
      setSettingsSaving(false);
    }
  };

  const driverOptions = useMemo(
    () =>
      (candidates?.drivers ?? []).map((driver) => ({
        value: driver.id,
        label: `${driver.name ?? driver.email ?? driver.id} · ${driver.workloadDays ?? 0} tour day(s)${
          driver.available ? "" : driver.onLeave ? " · on leave" : " · busy"
        }`,
        disabled: !driver.available,
      })),
    [candidates],
  );

  const vehicleOptions = useMemo(
    () =>
      (candidates?.vehicles ?? []).map((vehicle) => ({
        value: vehicle.id,
        label: `${vehicle.plateNumber ?? vehicle.id} · ${vehicle.capacity ?? 0} seats${
          vehicle.available ? "" : " · busy"
        }`,
        disabled: !vehicle.available,
      })),
    [candidates],
  );

  const columns: ColumnsType<TransportRequest> = [
    {
      title: "Tour",
      key: "tour",
      render: (_, row) => (
        <Flex vertical>
          <Text strong>{row.tourName ?? row.code ?? "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.tourCode ? `${row.tourCode} · ` : ""}
            {dayjs(row.startDate).format("DD MMM YYYY")} · {row.totalPax ?? 0} pax
          </Text>
        </Flex>
      ),
    },
    {
      title: "Provider",
      key: "provider",
      render: (_, row) =>
        row.provider ? (
          <Flex vertical>
            <Text>{row.provider.name}</Text>
            {row.provider.isCompany === false && (
              <Tag color="purple" style={{ alignSelf: "flex-start", marginTop: 2 }}>
                Third-party
              </Tag>
            )}
          </Flex>
        ) : (
          <Text type="secondary">Not selected</Text>
        ),
    },
    {
      title: "Status",
      dataIndex: "providerRequestStatus",
      width: 130,
      render: (status: RequestStatus) => (
        <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "Driver & vehicle",
      key: "crew",
      render: (_, row) => (
        <Flex vertical>
          <Text>{row.driver?.name ?? "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.vehicle
              ? `${row.vehicle.plateNumber ?? row.vehicle.id} · ${row.vehicle.capacity ?? 0} seats`
              : "No vehicle"}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Deadline",
      dataIndex: "providerDeadline",
      width: 170,
      render: (value?: string | null) =>
        value ? (
          <Flex vertical>
            <Text>{dayjs(value).format("DD MMM YYYY HH:mm")}</Text>
            {dayjs(value).isBefore(dayjs()) && (
              <Text type="danger" style={{ fontSize: 12 }}>
                Passed
              </Text>
            )}
          </Flex>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 230,
      render: (_, row) => {
        const closed = row.status === "COMPLETED";
        const open =
          row.providerRequestStatus === "REQUESTED" ||
          row.providerRequestStatus === "VIEWED";
        const canSend =
          !closed &&
          (row.providerRequestStatus === "NOT_REQUIRED" ||
            row.providerRequestStatus === "DECLINED" ||
            row.providerRequestStatus === "EXPIRED" ||
            row.providerRequestStatus === "CANCELLED");
        return (
          <Space wrap size={4}>
            {canSend && (
              <Button size="small" icon={<SendOutlined />} onClick={() => openSend(row)}>
                {row.providerRequestStatus === "NOT_REQUIRED" ? "Send" : "Resend"}
              </Button>
            )}
            {open && !closed && (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                onClick={() => cancelRequest(row)}
              >
                Cancel
              </Button>
            )}
            {!!row.provider?.id && !closed && (
              <Tooltip title="Assign a driver/vehicle directly, without waiting for the provider">
                <Button
                  size="small"
                  icon={<UserSwitchOutlined />}
                  onClick={() => openOverride(row)}
                >
                  Override
                </Button>
              </Tooltip>
            )}
            {closed && <Text type="secondary">Closed</Text>}
          </Space>
        );
      },
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card
        title={
          <Space>
            <SettingOutlined />
            <span>Transport request schedule</span>
          </Space>
        }
        size="small"
      >
        {settings ? (
          <Flex wrap gap={20} align="end">
            <Flex vertical gap={4}>
              <Text type="secondary">Automatic requests</Text>
              <Switch
                checked={settings.enabled}
                onChange={(enabled) => setSettings({ ...settings, enabled })}
                checkedChildren="On"
                unCheckedChildren="Off"
              />
            </Flex>
            <Flex vertical gap={4}>
              <Text type="secondary">Send</Text>
              <Space>
                <InputNumber
                  min={0}
                  max={30}
                  value={settings.sendDaysBefore}
                  onChange={(value) =>
                    setSettings({ ...settings, sendDaysBefore: Number(value ?? 0) })
                  }
                  style={{ width: 80 }}
                />
                <Text>day(s) before at</Text>
                <TimePicker
                  format="HH:mm"
                  allowClear={false}
                  value={timeToDayjs(settings.sendTime)}
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      sendTime: value ? value.format("HH:mm") : settings.sendTime,
                    })
                  }
                />
              </Space>
            </Flex>
            <Flex vertical gap={4}>
              <Text type="secondary">Provider deadline</Text>
              <TimePicker
                format="HH:mm"
                allowClear={false}
                value={timeToDayjs(settings.deadlineTime)}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    deadlineTime: value ? value.format("HH:mm") : settings.deadlineTime,
                  })
                }
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                Day before departure
              </Text>
            </Flex>
            <Flex vertical gap={4}>
              <Text type="secondary">Minimum lead time</Text>
              <InputNumber
                min={0}
                max={72}
                addonAfter="hours"
                value={settings.minLeadHours}
                onChange={(value) =>
                  setSettings({ ...settings, minLeadHours: Number(value ?? 0) })
                }
                style={{ width: 130 }}
              />
            </Flex>
            <Button type="primary" loading={settingsSaving} onClick={saveSettings}>
              Save settings
            </Button>
          </Flex>
        ) : (
          <Text type="secondary">Loading settings…</Text>
        )}
        <Alert
          style={{ marginTop: 12 }}
          type="info"
          showIcon
          message="Requests are sent automatically to the assigned third-party provider with a suggested driver and vehicle. The provider accepts the suggestion or swaps in another driver. The standard deadline is 23:00 the day before; travel-agent changes are locked at the 06:00 recall cutoff on the departure day."
        />
      </Card>

      <Card
        title={
          <Space>
            <CarOutlined />
            <span>Transport requests</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      >
        <Flex wrap gap={8} style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="Search tour, bus, provider or driver"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onSearch={() => load()}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="All statuses"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 180 }}
            options={Object.entries(STATUS_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <DatePicker.RangePicker
            value={range}
            onChange={(value) => setRange(value as [Dayjs | null, Dayjs | null] | null)}
          />
          <Button type="primary" icon={<ClockCircleOutlined />} onClick={load}>
            Apply
          </Button>
        </Flex>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1000 }}
          pagination={{ pageSize: 12, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title="Send transport request"
        open={!!sendTarget}
        onCancel={() => setSendTarget(null)}
        onOk={submitSend}
        okText="Send request"
        confirmLoading={sending}
      >
        <Flex vertical gap={12}>
          <div>
            <Text strong>{sendTarget?.tourName ?? sendTarget?.code}</Text>
            <div>
              <Text type="secondary">
                {sendTarget
                  ? `${dayjs(sendTarget.startDate).format("DD MMM YYYY")} · ${sendTarget.totalPax ?? 0} pax`
                  : ""}
              </Text>
            </div>
          </div>
          <div>
            <Text type="secondary">Transportation provider</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="Select a provider"
              value={sendProviderId}
              onChange={setSendProviderId}
              options={providers.map((provider) => ({
                value: provider.id,
                label: provider.name,
              }))}
            />
          </div>
          <div>
            <Text type="secondary">Note for the provider</Text>
            <Input.TextArea
              rows={3}
              value={sendNote}
              onChange={(event) => setSendNote(event.target.value)}
              placeholder="Vehicle type, pickup notes, contact person…"
              style={{ marginTop: 4 }}
            />
          </div>
        </Flex>
      </Modal>

      <Drawer
        title="Assign driver & vehicle"
        open={!!overrideTarget}
        onClose={() => setOverrideTarget(null)}
        width={480}
        extra={
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={overriding}
            onClick={submitOverride}
          >
            Assign
          </Button>
        }
      >
        {overrideTarget && (
          <Flex vertical gap={16}>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                {overrideTarget.tourName ?? overrideTarget.code}
              </Title>
              <Text type="secondary">
                {dayjs(overrideTarget.startDate).format("DD MMM YYYY")} ·{" "}
                {overrideTarget.totalPax ?? 0} pax ·{" "}
                {overrideTarget.provider?.name ?? "No provider"}
              </Text>
            </div>
            {overrideTarget.providerRequestNote && (
              <Alert
                type="info"
                showIcon
                message="Request note"
                description={overrideTarget.providerRequestNote}
              />
            )}
            {!!overrideTarget.pickups?.length && (
              <div>
                <Text strong>Pickups</Text>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {overrideTarget.pickups.map((pickup, index) => (
                    <li key={`${pickup.pickup}-${index}`}>
                      {pickup.customerName ? `${pickup.customerName}: ` : ""}
                      {pickup.pickup ?? "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <Text type="secondary">
                Drivers are ranked by least tour days in the last{" "}
                {candidates?.workloadWindow?.days ?? 30} days.
              </Text>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: "100%", marginTop: 4 }}
                placeholder="Select a driver"
                loading={candidatesLoading}
                value={overrideDriverId}
                onChange={setOverrideDriverId}
                options={driverOptions}
              />
            </div>
            <div>
              <Text type="secondary">Vehicle</Text>
              <Select
                allowClear
                style={{ width: "100%", marginTop: 4 }}
                placeholder="Select a vehicle"
                loading={candidatesLoading}
                value={overrideVehicleId}
                onChange={setOverrideVehicleId}
                options={vehicleOptions}
              />
            </div>
            <div>
              <Text type="secondary">Note</Text>
              <Input.TextArea
                rows={3}
                value={overrideNote}
                onChange={(event) => setOverrideNote(event.target.value)}
                style={{ marginTop: 4 }}
              />
            </div>
          </Flex>
        )}
      </Drawer>
    </Flex>
  );
}
