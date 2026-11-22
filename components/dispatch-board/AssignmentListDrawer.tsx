"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Input,
  Segmented,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme as antdTheme,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  LockOutlined,
  SearchOutlined,
  UnlockOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import { api } from "@/lib/api";
import type { BoardItem } from "./types";
import { STATUS_COLORS, TYPE_META, sortByDate } from "./types";

const { Text } = Typography;

type SealInfo = {
  sealed: boolean;
  urgent: boolean;
  autoMode: boolean;
  cutoffTime: string;
  cutoffAt: string;
  timezone: string;
};

type Leave = {
  id: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
};

type AvailabilityMember = {
  id: string;
  leaves?: Leave[];
};

type FilterKey = "all" | "issues" | "missing" | "provider" | "leave" | "waiting";

const EMPTY_LEAVES = new Map<string, Leave[]>();

const PROVIDER_STATUS_META: Record<string, { label: string; color: string }> = {
  NOT_REQUIRED: { label: "No request", color: "default" },
  REQUESTED: { label: "Requested", color: "processing" },
  VIEWED: { label: "Viewed", color: "blue" },
  ASSIGNED: { label: "Assigned", color: "green" },
  DECLINED: { label: "Declined", color: "red" },
  EXPIRED: { label: "Expired", color: "red" },
  CANCELLED: { label: "Cancelled", color: "default" },
};

interface Readiness {
  red: string[];
  orange: string[];
  info: string[];
  missingCrew: boolean;
  providerIssue: boolean;
  leaveIssue: boolean;
  waiting: boolean;
  ready: boolean;
}

interface ReadinessRow {
  key: string;
  item: BoardItem;
  readiness: Readiness;
}

function overlaps(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
) {
  const aStart = dayjs(startA).startOf("day").valueOf();
  const aEnd = dayjs(endA).startOf("day").valueOf();
  const bStart = dayjs(startB).startOf("day").valueOf();
  const bEnd = dayjs(endB).startOf("day").valueOf();
  return aStart <= bEnd && aEnd >= bStart;
}

function formatRemaining(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const hours = Math.floor(minutes / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function isOutsourced(item: BoardItem) {
  return (
    item.executionMode === "OUTSOURCED_PARTNER" ||
    item.partnerStatus === "HANDED_OFF" ||
    item.partnerStatus === "CLOSED"
  );
}

function findLeave(
  leaves: Map<string, Leave[]>,
  item: BoardItem,
  userId?: string | null,
) {
  if (!userId) return null;
  const match = (leaves.get(userId) ?? []).find((leave) =>
    overlaps(leave.startDate, leave.endDate, item.startDate, item.endDate),
  );
  return match ?? null;
}

function evaluate(item: BoardItem, leaves: Map<string, Leave[]>): Readiness {
  const red: string[] = [];
  const orange: string[] = [];
  const info: string[] = [];
  let missingCrew = false;
  let providerIssue = false;
  let leaveIssue = false;

  const waiting = item.status === "WAITING_LIST";
  const outsourced = isOutsourced(item);
  const driverOnly = item.executionMode === "COMPANY_DRIVER_ONLY";
  const externalProvider =
    !!item.providerId && item.provider?.isCompany === false;
  const providerStatus = item.providerRequestStatus ?? "NOT_REQUIRED";
  const providerAwaiting =
    externalProvider &&
    (providerStatus === "REQUESTED" || providerStatus === "VIEWED");
  const providerDead =
    externalProvider &&
    (providerStatus === "DECLINED" ||
      providerStatus === "EXPIRED" ||
      providerStatus === "CANCELLED" ||
      providerStatus === "NOT_REQUIRED");

  if (waiting) orange.push("Waiting list — place after 05:00");

  if (outsourced) {
    info.push("Outsourced partner");
  } else if (!waiting) {
    if (!driverOnly) {
      if (!item.guide?.id) {
        red.push("No guide assigned");
        missingCrew = true;
      } else {
        const leave = findLeave(leaves, item, item.guide.id);
        if (leave) {
          leaveIssue = true;
          const label = `Guide on ${leave.status === "APPROVED" ? "approved" : "pending"} leave`;
          (leave.status === "APPROVED" ? red : orange).push(label);
        }
      }
    }

    if (externalProvider) {
      if (providerStatus === "DECLINED") {
        red.push("Provider declined the request");
        providerIssue = true;
      } else if (providerStatus === "EXPIRED") {
        red.push("Provider request expired");
        providerIssue = true;
      } else if (providerStatus === "CANCELLED") {
        red.push("Provider request cancelled");
        providerIssue = true;
      } else if (providerStatus === "NOT_REQUIRED") {
        red.push("Provider request not sent");
        providerIssue = true;
      } else if (providerAwaiting) {
        const deadline = item.providerDeadline
          ? dayjs(item.providerDeadline)
          : null;
        if (deadline && deadline.isBefore(dayjs())) {
          red.push("Provider deadline passed");
          providerIssue = true;
        } else if (deadline && deadline.diff(dayjs(), "hour", true) <= 3) {
          orange.push(`Provider deadline ${deadline.format("HH:mm")}`);
          providerIssue = true;
        } else {
          info.push("Awaiting provider");
        }
      }
    }

    if (!item.driver?.id) {
      if (providerAwaiting) {
        if (!providerIssue) {
          orange.push("Driver pending from provider");
          providerIssue = true;
        }
      } else if (externalProvider && providerStatus === "ASSIGNED") {
        red.push("Provider assigned — no driver");
        missingCrew = true;
        providerIssue = true;
      } else if (!providerDead) {
        red.push("No driver assigned");
        missingCrew = true;
      }
    } else {
      const leave = findLeave(leaves, item, item.driver.id);
      if (leave) {
        leaveIssue = true;
        const label = `Driver on ${leave.status === "APPROVED" ? "approved" : "pending"} leave`;
        (leave.status === "APPROVED" ? red : orange).push(label);
      }
      if (
        externalProvider &&
        providerStatus === "ASSIGNED" &&
        !item.vehicle?.plateNumber
      ) {
        red.push("Provider assigned — no vehicle");
        providerIssue = true;
      }
    }
  }

  if ((item.lateBookings ?? 0) > 0) {
    info.push(
      `${item.lateBookings} late booking${item.lateBookings === 1 ? "" : "s"}`,
    );
  }

  return {
    red,
    orange,
    info,
    missingCrew,
    providerIssue,
    leaveIssue,
    waiting,
    ready: !waiting && red.length === 0 && orange.length === 0,
  };
}

export default function AssignmentListDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: BoardItem[];
}) {
  const { token } = antdTheme.useToken();
  const [date, setDate] = useState<Dayjs>(() =>
    dayjs().add(1, "day").startOf("day"),
  );
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [sealState, setSealState] = useState<{
    key: string;
    info: SealInfo | null;
  } | null>(null);
  const [leavesState, setLeavesState] = useState<{
    key: string;
    map: Map<string, Leave[]>;
  }>({ key: "", map: EMPTY_LEAVES });
  const [now, setNow] = useState(() => Date.now());

  const dayKey = date.format("YYYY-MM-DD");
  const seal = sealState?.key === dayKey ? sealState.info : null;
  const leaves = leavesState.key === dayKey ? leavesState.map : EMPTY_LEAVES;

  const resetView = () => {
    setDate(dayjs().add(1, "day").startOf("day"));
    setFilter("all");
    setQuery("");
    setNow(Date.now());
  };

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    api
      .get("/assignments/board/seal", { params: { date: dayKey } })
      .then((r) => {
        if (alive) setSealState({ key: dayKey, info: r.data ?? null });
      })
      .catch(() => {
        if (alive) setSealState({ key: dayKey, info: null });
      });

    api
      .get("/assignments/board/crew/availability", {
        params: { from: dayKey, to: dayKey },
      })
      .then((r) => {
        if (!alive) return;
        const map = new Map<string, Leave[]>();
        const members = [
          ...(r.data?.guides ?? []),
          ...(r.data?.drivers ?? []),
        ] as AvailabilityMember[];
        for (const member of members) {
          if (member?.id) map.set(member.id, member.leaves ?? []);
        }
        setLeavesState({ key: dayKey, map });
      })
      .catch(() => {
        if (alive) setLeavesState({ key: dayKey, map: EMPTY_LEAVES });
      });

    return () => {
      alive = false;
    };
  }, [open, dayKey]);

  const dayItems = useMemo(
    () =>
      items
        .filter((item) =>
          dayjs(item.startDate)
            .add(7, "hour")
            .startOf("day")
            .isSame(date.startOf("day")),
        )
        .sort(sortByDate),
    [items, date],
  );

  const rows = useMemo<ReadinessRow[]>(
    () =>
      dayItems.map((item) => ({
        key: item.id,
        item,
        readiness: evaluate(item, leaves),
      })),
    [dayItems, leaves],
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      ready: rows.filter((row) => row.readiness.ready).length,
      issues: rows.filter(
        (row) => row.readiness.red.length + row.readiness.orange.length > 0,
      ).length,
      missing: rows.filter((row) => row.readiness.missingCrew).length,
      provider: rows.filter((row) => row.readiness.providerIssue).length,
      leave: rows.filter((row) => row.readiness.leaveIssue).length,
      waiting: rows.filter((row) => row.readiness.waiting).length,
    }),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      const { readiness, item } = row;
      if (
        filter === "issues" &&
        readiness.red.length + readiness.orange.length === 0
      ) {
        return false;
      }
      if (filter === "missing" && !readiness.missingCrew) return false;
      if (filter === "provider" && !readiness.providerIssue) return false;
      if (filter === "leave" && !readiness.leaveIssue) return false;
      if (filter === "waiting" && !readiness.waiting) return false;
      if (!needle) return true;
      return [
        item.code,
        item.tourName,
        item.guide?.name,
        item.driver?.name,
        item.provider?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [rows, filter, query]);

  const cutoffAt = seal?.cutoffAt ? dayjs(seal.cutoffAt) : null;
  const remainingMs = cutoffAt ? cutoffAt.valueOf() - now : 0;

  const today = dayjs().startOf("day");
  const minDate = today.subtract(30, "day");
  const maxDate = today.add(90, "day");

  const sealTag = useMemo(() => {
    if (!seal) return null;
    if (!seal.autoMode) {
      return (
        <Tooltip title="Auto-dispatch is off or the board is in Manual mode. There is no 23:00 seal, so the board stays editable.">
          <Tag icon={<UnlockOutlined />} style={{ margin: 0 }}>
            Manual mode — no seal
          </Tag>
        </Tooltip>
      );
    }
    if (seal.sealed) {
      return (
        <Tag color="red" icon={<LockOutlined />} style={{ margin: 0 }}>
          Sealed at {seal.cutoffTime}
        </Tag>
      );
    }
    if (remainingMs > 0) {
      return (
        <Tag
          color={seal.urgent ? "orange" : "blue"}
          icon={<ClockCircleOutlined />}
          style={{ margin: 0 }}
        >
          Dispatch cutoff in {formatRemaining(remainingMs)} · {seal.cutoffTime}
        </Tag>
      );
    }
    return <Tag color="orange" style={{ margin: 0 }}>Cutoff passed</Tag>;
  }, [seal, remainingMs]);

  const columns: ColumnsType<ReadinessRow> = [
    {
      title: "Bus / tour",
      key: "bus",
      width: 205,
      render: (_, row) => {
        const item = row.item;
        const meta = TYPE_META[item.tourType ?? "OTHER"] ?? TYPE_META.OTHER;
        return (
          <Space direction="vertical" size={0}>
            <Space size={6} wrap>
              <Text strong style={{ fontSize: 13 }}>
                {item.code}
              </Text>
              <Tag color={meta.color} style={{ margin: 0, fontSize: 11 }}>
                {meta.label}
              </Tag>
              {item.groupRef && (
                <Tag style={{ margin: 0, fontSize: 11 }}>Group</Tag>
              )}
              {row.readiness.waiting && (
                <Tag color="orange" style={{ margin: 0, fontSize: 11 }}>
                  Waiting
                </Tag>
              )}
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.tourName}
            </Text>
          </Space>
        );
      },
    },
    {
      title: "Departure",
      key: "departure",
      width: 85,
      render: (_, row) => (
        <Text style={{ fontSize: 12 }}>
          {row.item.departureTime ?? "—"}
        </Text>
      ),
    },
    {
      title: "Pax",
      key: "pax",
      width: 50,
      align: "center",
      render: (_, row) => <Text>{row.item.totalPax ?? 0}</Text>,
    },
    {
      title: "Guide",
      key: "guide",
      width: 135,
      render: (_, row) => {
        const item = row.item;
        if (isOutsourced(item)) {
          return <Text type="secondary" style={{ fontSize: 12 }}>Partner</Text>;
        }
        if (item.executionMode === "COMPANY_DRIVER_ONLY") {
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Not required
            </Text>
          );
        }
        if (!item.guide?.name) {
          return <Tag color="red">Missing</Tag>;
        }
        const leave = findLeave(leaves, item, item.guide.id);
        return (
          <Space size={4} wrap>
            <Text style={{ fontSize: 12 }}>{item.guide.name}</Text>
            {leave && (
              <Tooltip
                title={`${dayjs(leave.startDate).format("DD MMM")} → ${dayjs(leave.endDate).format("DD MMM")} · ${leave.status}`}
              >
                <Tag
                  color={leave.status === "APPROVED" ? "red" : "orange"}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {leave.status === "APPROVED" ? "On leave" : "Leave pending"}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Driver",
      key: "driver",
      width: 135,
      render: (_, row) => {
        const item = row.item;
        if (isOutsourced(item)) {
          return <Text type="secondary" style={{ fontSize: 12 }}>Partner</Text>;
        }
        if (!item.driver?.name) {
          const external =
            !!item.providerId && item.provider?.isCompany === false;
          const status = item.providerRequestStatus ?? "NOT_REQUIRED";
          if (external && (status === "REQUESTED" || status === "VIEWED")) {
            return <Tag color="orange">Provider to assign</Tag>;
          }
          return <Tag color="red">Missing</Tag>;
        }
        const leave = findLeave(leaves, item, item.driver.id);
        return (
          <Space size={4} wrap>
            <Text style={{ fontSize: 12 }}>{item.driver.name}</Text>
            {leave && (
              <Tooltip
                title={`${dayjs(leave.startDate).format("DD MMM")} → ${dayjs(leave.endDate).format("DD MMM")} · ${leave.status}`}
              >
                <Tag
                  color={leave.status === "APPROVED" ? "red" : "orange"}
                  style={{ margin: 0, fontSize: 11 }}
                >
                  {leave.status === "APPROVED" ? "On leave" : "Leave pending"}
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: "Vehicle",
      key: "vehicle",
      width: 85,
      render: (_, row) =>
        row.item.vehicle?.plateNumber ? (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 12 }}>{row.item.vehicle.plateNumber}</Text>
            {row.item.vehicle.capacity ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {row.item.vehicle.capacity} seats
              </Text>
            ) : null}
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            —
          </Text>
        ),
    },
    {
      title: "Provider",
      key: "provider",
      width: 140,
      render: (_, row) => {
        const item = row.item;
        const external =
          !!item.providerId && item.provider?.isCompany === false;
        const status = item.providerRequestStatus ?? "NOT_REQUIRED";
        const meta = PROVIDER_STATUS_META[status];
        return (
          <Space direction="vertical" size={1}>
            <Text style={{ fontSize: 12 }}>
              {item.provider?.name ?? "Company fleet"}
            </Text>
            {external && meta && (
              <Tag color={meta.color} style={{ margin: 0, fontSize: 11 }}>
                {meta.label}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, row) => (
        <Tag color={STATUS_COLORS[row.item.status] ?? "default"}>
          {row.item.status.replace(/_/g, " ")}
        </Tag>
      ),
    },
    {
      title: "Issues",
      key: "issues",
      width: 225,
      render: (_, row) => {
        const { red, orange, info, ready } = row.readiness;
        const tags = [
          ...red.map((label) => (
            <Tag key={`red-${label}`} color="red" style={{ margin: 0 }}>
              {label}
            </Tag>
          )),
          ...orange.map((label) => (
            <Tag key={`orange-${label}`} color="orange" style={{ margin: 0 }}>
              {label}
            </Tag>
          )),
          ...info.map((label) => (
            <Tag key={`info-${label}`} color="blue" style={{ margin: 0 }}>
              {label}
            </Tag>
          )),
        ];
        if (ready) {
          tags.unshift(
            <Tag
              key="ready"
              color="green"
              icon={<CheckCircleOutlined />}
              style={{ margin: 0 }}
            >
              Ready
            </Tag>,
          );
        }
        return tags.length ? (
          <Flex wrap gap={4}>
            {tags}
          </Flex>
        ) : (
          <Text type="secondary">—</Text>
        );
      },
    },
  ];

  return (
    <Drawer
      title={
        <Space wrap>
          <UnorderedListOutlined style={{ color: token.colorPrimary }} />
          <Text strong>Assignment readiness</Text>
          <Tag color={token.colorPrimary} style={{ margin: 0 }}>
            {date.format("DD MMM YYYY")}
          </Tag>
        </Space>
      }
      open={open}
      onClose={onClose}
      width="min(1240px, 96vw)"
      destroyOnClose
      afterOpenChange={(isOpen) => {
        if (isOpen) resetView();
      }}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12, borderRadius: 12 }}
        message="Day-before readiness check"
        description="Review every bus before the dispatch cutoff. Red rows block dispatch; fix crew, provider requests and leave conflicts on the board cards."
      />

      {seal?.sealed && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12, borderRadius: 12 }}
          message={`Board sealed at ${seal.cutoffTime}`}
          description="New bookings go to the waiting list. Place late bookings on a real bus after 05:00; crew and vehicle changes stay open until the 06:00 cutoff."
        />
      )}

      <Card
        size="small"
        style={{ borderRadius: 14, marginBottom: 12 }}
        styles={{ body: { padding: "12px 16px" } }}
      >
        <Flex wrap gap={10} justify="space-between" align="center">
          <Space wrap size={8}>
            <CalendarOutlined style={{ color: token.colorPrimary }} />
            <DatePicker
              value={date}
              onChange={(value) => {
                if (value) setDate(value);
              }}
              allowClear={false}
              format="YYYY-MM-DD"
              disabledDate={(value) =>
                value.startOf("day").isBefore(minDate) ||
                value.startOf("day").isAfter(maxDate)
              }
              style={{ width: 170 }}
            />
            <Button
              size="small"
              onClick={() => setDate(dayjs().add(1, "day").startOf("day"))}
            >
              Tomorrow
            </Button>
            <Button
              size="small"
              onClick={() => setDate(dayjs().startOf("day"))}
            >
              Today
            </Button>
          </Space>
          <Space wrap size={8}>
            {sealTag}
            {seal && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {seal.timezone}
              </Text>
            )}
          </Space>
        </Flex>
        <Space wrap size={6} style={{ marginTop: 10 }}>
          <Tag style={{ margin: 0 }}>{counts.total} buses</Tag>
          <Tag color="green" style={{ margin: 0 }}>
            {counts.ready} ready
          </Tag>
          <Tag
            color={counts.issues ? "red" : "default"}
            style={{ margin: 0 }}
          >
            {counts.issues} need attention
          </Tag>
          <Tag color="orange" style={{ margin: 0 }}>
            {counts.missing} missing crew
          </Tag>
          <Tag color="volcano" style={{ margin: 0 }}>
            {counts.provider} provider
          </Tag>
          <Tag color="magenta" style={{ margin: 0 }}>
            {counts.leave} leave
          </Tag>
          <Tag color="gold" style={{ margin: 0 }}>
            {counts.waiting} waiting
          </Tag>
        </Space>
      </Card>

      <Flex wrap gap={8} justify="space-between" align="center" style={{ marginBottom: 10 }}>
        <Segmented
          size="small"
          value={filter}
          onChange={(value) => setFilter(value as FilterKey)}
          options={[
            { label: "All", value: "all" },
            { label: "Needs attention", value: "issues" },
            { label: "Missing crew", value: "missing" },
            { label: "Provider", value: "provider" },
            { label: "Leave", value: "leave" },
            { label: "Waiting list", value: "waiting" },
          ]}
        />
        <Input
          allowClear
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          prefix={<SearchOutlined />}
          placeholder="Search bus, tour, guide, driver, provider"
          style={{ width: 300 }}
        />
      </Flex>

      <Table<ReadinessRow>
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={shown}
        pagination={false}
        scroll={{ x: 1160 }}
        locale={{
          emptyText: (
            <Empty
              description={
                counts.total === 0
                  ? `No buses start on ${date.format("DD MMM YYYY")}`
                  : "No bus matches this filter"
              }
            />
          ),
        }}
        onRow={(row) => ({
          style:
            row.readiness.red.length > 0
              ? { background: token.colorErrorBg }
              : row.readiness.orange.length > 0
                ? { background: token.colorWarningBg }
                : undefined,
        })}
      />
    </Drawer>
  );
}
