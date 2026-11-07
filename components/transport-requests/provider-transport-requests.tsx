"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Flex,
  Input,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
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

type AssignmentMode = "MANUAL" | "AUTO_SUGGEST" | "FULLY_AUTO";

interface TransportRequest {
  id: string;
  code?: string | null;
  tourName?: string | null;
  tourCode?: string | null;
  totalPax?: number | null;
  startDate: string;
  endDate: string;
  status: string;
  provider?: { id: string; name: string } | null;
  driver?: { id: string; name?: string | null } | null;
  vehicle?: { id: string; plateNumber?: string | null; capacity?: number | null } | null;
  guide?: { id: string; name?: string | null } | null;
  pickups?: Array<{ pickup?: string | null; customerName?: string | null; totalPax?: number }>;
  providerRequestStatus: RequestStatus;
  providerDeadline?: string | null;
  providerRequestNote?: string | null;
  providerResponseNote?: string | null;
  providerDeclineReason?: string | null;
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

interface ProviderSettings {
  id: string;
  name: string;
  assignmentMode: AssignmentMode;
}

interface WorkloadDriver {
  id: string;
  name?: string | null;
  email?: string | null;
  licenseNumber?: string | null;
  rating?: number;
  workloadDays: number;
  workloadTrips: number;
  busyToday: boolean;
  onLeaveToday: boolean;
  availableToday: boolean;
}

interface DriverWorkload {
  workloadWindow?: { from: string; to: string; days: number };
  drivers: WorkloadDriver[];
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
  NOT_REQUIRED: "New",
  REQUESTED: "New",
  VIEWED: "Seen",
  ASSIGNED: "Assigned",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export default function ProviderTransportRequests() {
  const { on } = useSocket();
  const [rows, setRows] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ProviderSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const [workloadOpen, setWorkloadOpen] = useState(false);
  const [workload, setWorkload] = useState<DriverWorkload | null>(null);
  const [workloadLoading, setWorkloadLoading] = useState(false);

  const [target, setTarget] = useState<TransportRequest | null>(null);
  const [candidates, setCandidates] = useState<Candidates | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [driverId, setDriverId] = useState<string | undefined>();
  const [vehicleId, setVehicleId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [declineTarget, setDeclineTarget] = useState<TransportRequest | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/transport-requests");
      setRows(data ?? []);
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load transport requests"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/transport-requests/provider-settings");
      setSettings(data);
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load provider settings"));
    }
  }, []);

  const loadWorkload = useCallback(async () => {
    setWorkloadLoading(true);
    try {
      const { data } = await api.get("/transport-requests/workload");
      setWorkload(data);
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load driver workload"));
    } finally {
      setWorkloadLoading(false);
    }
  }, []);

  const openWorkload = () => {
    setWorkloadOpen(true);
    loadWorkload();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    loadSettings();
  }, [load, loadSettings]);

  useEffect(() => {
    const off = on("transport:refresh", () => load());
    return () => off();
  }, [on, load]);

  const openRequest = async (row: TransportRequest) => {
    setTarget(row);
    setCandidates(null);
    setDriverId(row.driver?.id);
    setVehicleId(row.vehicle?.id);
    setNote("");
    setCandidatesLoading(true);
    try {
      if (row.providerRequestStatus === "REQUESTED") {
        await api.post(`/transport-requests/${row.id}/view`, {});
      }
      const { data } = await api.get(`/transport-requests/candidates/${row.id}`);
      setCandidates(data);
      setDriverId(data?.recommendedDriverId ?? row.driver?.id);
      setVehicleId(data?.recommendedVehicleId ?? row.vehicle?.id);
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, "Could not load drivers and vehicles"));
    } finally {
      setCandidatesLoading(false);
    }
  };

  const assign = async () => {
    if (!target) return;
    if (!driverId) {
      message.warning("Select a driver");
      return;
    }
    if (!vehicleId) {
      message.warning("Select a vehicle");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/transport-requests/${target.id}/assign`, {
        driverId,
        vehicleId,
        note: note.trim() || undefined,
      });
      message.success("Driver and vehicle assigned");
      setTarget(null);
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, "Could not assign the driver"));
    } finally {
      setSaving(false);
    }
  };

  const autoAssign = async () => {
    if (!target) return;
    setSaving(true);
    try {
      await api.post(`/transport-requests/${target.id}/auto-assign`, {});
      message.success("Best available driver and vehicle assigned");
      setTarget(null);
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, "Could not auto-assign the request"));
    } finally {
      setSaving(false);
    }
  };

  const submitDecline = async () => {
    if (!declineTarget) return;
    if (!declineReason.trim()) {
      message.warning("Please give a reason");
      return;
    }
    setDeclining(true);
    try {
      await api.post(`/transport-requests/${declineTarget.id}/decline`, {
        reason: declineReason.trim(),
      });
      message.success("Request declined");
      setDeclineTarget(null);
      setDeclineReason("");
      await load();
    } catch (error) {
      message.error(getErrorMessage(error, "Could not decline the request"));
    } finally {
      setDeclining(false);
    }
  };

  const saveMode = async (assignmentMode: AssignmentMode) => {
    if (!settings) return;
    setSettingsSaving(true);
    try {
      const { data } = await api.put("/transport-requests/provider-settings", {
        assignmentMode,
      });
      setSettings(data);
      message.success("Assignment mode saved");
    } catch (error) {
      message.error(getErrorMessage(error, "Could not save the assignment mode"));
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

  const open = (row: TransportRequest) =>
    row.providerRequestStatus === "REQUESTED" || row.providerRequestStatus === "VIEWED";

  const suggestedDriver = useMemo(
    () =>
      candidates?.drivers.find((d) => d.id === candidates.recommendedDriverId) ??
      null,
    [candidates],
  );
  const suggestedVehicle = useMemo(
    () =>
      candidates?.vehicles.find((v) => v.id === candidates.recommendedVehicleId) ??
      null,
    [candidates],
  );
  const usingSuggestion =
    !!suggestedDriver &&
    driverId === suggestedDriver.id &&
    (!suggestedVehicle || vehicleId === suggestedVehicle.id);
  const useSuggestion = () => {
    if (!suggestedDriver) return;
    setDriverId(suggestedDriver.id);
    if (suggestedVehicle) setVehicleId(suggestedVehicle.id);
  };

  const columns: ColumnsType<TransportRequest> = [
    {
      title: "Tour",
      key: "tour",
      render: (_, row) => (
        <Flex vertical>
          <Text strong>{row.tourName ?? row.code ?? "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(row.startDate).format("DD MMM YYYY")} · {row.totalPax ?? 0} pax
          </Text>
        </Flex>
      ),
    },
    {
      title: "Pickup",
      key: "pickup",
      render: (_, row) => (
        <Text type="secondary">
          {row.pickups?.[0]?.pickup ?? "—"}
          {row.pickups && row.pickups.length > 1 ? ` +${row.pickups.length - 1}` : ""}
        </Text>
      ),
    },
    {
      title: "Status",
      dataIndex: "providerRequestStatus",
      width: 120,
      render: (status: RequestStatus) => (
        <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>
      ),
    },
    {
      title: "Deadline",
      dataIndex: "providerDeadline",
      width: 170,
      render: (value?: string | null) =>
        value ? (
          <Flex vertical>
            <Text>{dayjs(value).format("DD MMM HH:mm")}</Text>
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
      title: "Driver & vehicle",
      key: "crew",
      render: (_, row) => (
        <Flex vertical>
          <Text>{row.driver?.name ?? "—"}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {row.vehicle ? `${row.vehicle.plateNumber ?? row.vehicle.id} · ${row.vehicle.capacity ?? 0} seats` : "No vehicle"}
          </Text>
        </Flex>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 210,
      render: (_, row) => (
        <Space wrap size={4}>
          <Button size="small" icon={<CarOutlined />} onClick={() => openRequest(row)}>
            {open(row) ? "Assign" : "View"}
          </Button>
          {open(row) && (
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => {
                setDeclineTarget(row);
                setDeclineReason("");
              }}
            >
              Decline
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Card
        title="Assignment mode"
        size="small"
        extra={
          settings ? (
            <Segmented<AssignmentMode>
              value={settings.assignmentMode}
              disabled={settingsSaving}
              onChange={(value) => saveMode(value)}
              options={[
                { value: "MANUAL", label: "Manual" },
                { value: "AUTO_SUGGEST", label: "Suggest" },
                { value: "FULLY_AUTO", label: "Fully automatic" },
              ]}
            />
          ) : null
        }
      >
        <Text type="secondary">
          The travel agent suggests one available driver and vehicle per request.
          Manual: you choose. Suggest: the suggested pick is pre-filled and you
          can accept or swap it. Fully automatic: requests are assigned
          immediately with the suggested pick. The standard deadline is 23:00 the
          day before; travel-agent changes lock at 06:00 on the departure day.
        </Text>
      </Card>

      <Card
        title={
          <Space>
            <CarOutlined />
            <span>Transport requests</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<TeamOutlined />} onClick={openWorkload}>
              Driver workload
            </Button>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              Refresh
            </Button>
          </Space>
        }
      >
        {!rows.length && !loading && (
          <Alert
            type="info"
            showIcon
            message="No transport requests yet. New requests will appear here and notify you live."
            style={{ marginBottom: 12 }}
          />
        )}
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 900 }}
          pagination={{ pageSize: 12, showSizeChanger: true }}
        />
      </Card>

      <Drawer
        title="Driver workload"
        open={workloadOpen}
        onClose={() => setWorkloadOpen(false)}
        width={620}
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={loadWorkload}
            loading={workloadLoading}
          >
            Refresh
          </Button>
        }
      >
        <Text type="secondary">
          Tour days = distinct calendar days a driver is on a trip in the last /
          next {workload?.workloadWindow?.days ?? 30} days. Today shows whether
          the driver is already on tour or on leave.
        </Text>
        <Table
          rowKey="id"
          size="small"
          loading={workloadLoading}
          dataSource={workload?.drivers ?? []}
          pagination={false}
          style={{ marginTop: 12 }}
          columns={[
            {
              title: "Driver",
              dataIndex: "name",
              render: (_: unknown, driver: WorkloadDriver) => (
                <div>
                  <div>{driver.name ?? driver.email ?? driver.id}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {driver.email}
                  </Text>
                </div>
              ),
            },
            {
              title: "License",
              dataIndex: "licenseNumber",
              width: 90,
              render: (value: string | null) => value ?? "—",
            },
            {
              title: "Tour days",
              dataIndex: "workloadDays",
              align: "center",
              width: 90,
            },
            {
              title: "Trips",
              dataIndex: "workloadTrips",
              align: "center",
              width: 70,
            },
            {
              title: "Today",
              width: 110,
              render: (_: unknown, driver: WorkloadDriver) =>
                driver.onLeaveToday ? (
                  <Tag color="gold">On leave</Tag>
                ) : driver.busyToday ? (
                  <Tag color="orange">On tour</Tag>
                ) : (
                  <Tag color="green">Available</Tag>
                ),
            },
          ]}
        />
      </Drawer>

      <Drawer
        open={!!target}
        onClose={() => setTarget(null)}
        width={480}
        extra={
          target && open(target) ? (
            <Space>
              <Button
                icon={<ThunderboltOutlined />}
                loading={saving}
                onClick={autoAssign}
              >
                Auto
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={saving}
                onClick={assign}
              >
                Assign
              </Button>
            </Space>
          ) : null
        }
      >
        {target && (
          <Flex vertical gap={16}>
            <div>
              <Title level={5} style={{ margin: 0 }}>
                {target.tourName ?? target.code}
              </Title>
              <Text type="secondary">
                {dayjs(target.startDate).format("DD MMM YYYY")} · {target.totalPax ?? 0} pax
              </Text>
            </div>
            <Flex gap={8} wrap>
              <Tag color={STATUS_COLOR[target.providerRequestStatus]}>
                {STATUS_LABEL[target.providerRequestStatus]}
              </Tag>
              {target.providerDeadline && (
                <Tag icon={<ClockCircleOutlined />}>
                  Deadline {dayjs(target.providerDeadline).format("DD MMM HH:mm")}
                </Tag>
              )}
            </Flex>
            {target.providerRequestNote && (
              <Alert
                type="info"
                showIcon
                message="Note from the travel agent"
                description={target.providerRequestNote}
              />
            )}
            {!!target.pickups?.length && (
              <div>
                <Text strong>Pickups</Text>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {target.pickups.map((pickup, index) => (
                    <li key={`${pickup.pickup}-${index}`}>
                      {pickup.customerName ? `${pickup.customerName}: ` : ""}
                      {pickup.pickup ?? "—"}
                      {pickup.totalPax ? ` (${pickup.totalPax} pax)` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {open(target) ? (
              <>
                {suggestedDriver ? (
                  <Alert
                    type="info"
                    showIcon
                    message="Suggested by the travel agent"
                    description={
                      <Flex vertical gap={6}>
                        <Text strong>
                          {suggestedDriver.name ??
                            suggestedDriver.email ??
                            suggestedDriver.id}
                          {suggestedVehicle
                            ? ` · ${suggestedVehicle.plateNumber ?? suggestedVehicle.id}`
                            : ""}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Accept this pick, or choose another driver/vehicle
                          below. Assign by 23:00; changes lock at 06:00 on the
                          departure day.
                        </Text>
                        {!usingSuggestion && (
                          <Button size="small" onClick={useSuggestion}>
                            Use suggestion
                          </Button>
                        )}
                      </Flex>
                    }
                    action={
                      usingSuggestion ? <Tag color="green">Selected</Tag> : null
                    }
                  />
                ) : (
                  <Alert
                    type="warning"
                    showIcon
                    message="No available driver from your fleet for this trip — please add one or decline."
                  />
                )}
                <div>
                  <Text type="secondary">
                    Least-busy first (tour days in the last{" "}
                    {candidates?.workloadWindow?.days ?? 30} days).
                  </Text>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: "100%", marginTop: 4 }}
                    placeholder="Select a driver"
                    loading={candidatesLoading}
                    value={driverId}
                    onChange={setDriverId}
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
                    value={vehicleId}
                    onChange={setVehicleId}
                    options={vehicleOptions}
                  />
                </div>
                <div>
                  <Text type="secondary">Note</Text>
                  <Input.TextArea
                    rows={3}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    style={{ marginTop: 4 }}
                  />
                </div>
              </>
            ) : (
              <Flex vertical gap={4}>
                <Text strong>Assigned crew</Text>
                <Text>
                  Driver: {target.driver?.name ?? "—"} · Vehicle:{" "}
                  {target.vehicle?.plateNumber ?? "—"}
                </Text>
                {target.providerResponseNote && (
                  <Text type="secondary">{target.providerResponseNote}</Text>
                )}
                {target.providerDeclineReason && (
                  <Text type="danger">{target.providerDeclineReason}</Text>
                )}
              </Flex>
            )}
          </Flex>
        )}
      </Drawer>

      <Modal
        title="Decline transport request"
        open={!!declineTarget}
        onCancel={() => setDeclineTarget(null)}
        onOk={submitDecline}
        okText="Decline request"
        okButtonProps={{ danger: true }}
        confirmLoading={declining}
      >
        <Text type="secondary">
          Tell the travel agent why this trip cannot be covered. They will be notified immediately.
        </Text>
        <Input.TextArea
          rows={4}
          value={declineReason}
          onChange={(event) => setDeclineReason(event.target.value)}
          placeholder="No driver available, vehicle is in maintenance…"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </Flex>
  );
}
