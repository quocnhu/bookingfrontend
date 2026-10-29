"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { SelectProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { api, getErrorMessage } from "@/lib/api";
import dayjs, { Dayjs } from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrBefore);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  OFFICE: "Office",
  TOUR_GUIDE: "Tour Guide",
  DRIVER: "Driver",
  TRANSPORT_PROVIDER: "Transport Provider",
  CUSTOMER: "Customer",
};

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "red",
  OFFICE: "geekblue",
  TOUR_GUIDE: "green",
  DRIVER: "cyan",
  TRANSPORT_PROVIDER: "purple",
  CUSTOMER: "default",
};

const LEAVE_COLOR: Record<string, string> = {
  APPROVED: "#fa541c",
  PENDING: "#fa8c16",
  REJECTED: "#8c8c8c",
};

const LEAVE_LABEL: Record<string, string> = {
  APPROVED: "Off",
  PENDING: "Pending",
  REJECTED: "Rejected",
};

const GROUP_LABEL: Record<string, string> = {
  COMPANY_GUIDE: "Company guide",
  FREELANCE_GUIDE: "Freelance guide",
  COMPANY_DRIVER: "Company driver",
  FREELANCE_DRIVER: "Freelance driver",
  PROVIDER_STAFF: "Provider-managed staff",
  PROVIDER_ACCOUNT: "Transport provider",
  OFFICE: "Office",
};

const GROUP_COLOR: Record<string, string> = {
  COMPANY_GUIDE: "green",
  FREELANCE_GUIDE: "cyan",
  COMPANY_DRIVER: "geekblue",
  FREELANCE_DRIVER: "blue",
  PROVIDER_STAFF: "purple",
  PROVIDER_ACCOUNT: "magenta",
  OFFICE: "gold",
};

const GROUP_OPTIONS = Object.entries(GROUP_LABEL).map(([value, label]) => ({
  value,
  label,
}));

const SELECT_THEMES = {
  role: "#1677ff",
  group: "#722ed1",
  provider: "#fa8c16",
} as const;

const selectStyles = (color: string): SelectProps["styles"] => ({
  root: { borderColor: color, background: `${color}0d` },
  placeholder: { color },
});

const selectTagRender = (
  color: string,
): NonNullable<SelectProps["tagRender"]> => {
  return ({ label, closable, onClose }) => (
    <Tag
      color={color}
      closable={closable}
      onClose={onClose}
      style={{ marginInlineEnd: 4 }}
    >
      {label}
    </Tag>
  );
};

const selectOptionRender = (
  color: string,
): NonNullable<SelectProps["optionRender"]> => {
  return (option) => (
    <Flex align="center" gap={6}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          flex: "0 0 auto",
        }}
      />
      <span>{option.label}</span>
    </Flex>
  );
};

/** Tour statuses that count as an actual work day (planned buses do not). */
const WORKED_STATUSES = new Set(["DISPATCHED", "VERIFYING", "COMPLETED"]);

interface TimesheetLeave {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  isEmergency?: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByName?: string | null;
  reviewedAt?: string | null;
}

interface TimesheetAssignment {
  id: string;
  code?: string | null;
  tourName?: string | null;
  status?: string;
  startDate: string;
  endDate: string;
  plateNumber?: string | null;
}

interface TimesheetEmployee {
  id: string;
  name: string;
  email: string;
  role: string;
  userType?: string | null;
  isActive: boolean;
  group?: string | null;
  provider?: { id?: string; name?: string; isCompany?: boolean } | null;
  guideType?: "OFFICIAL" | "FREELANCE" | null;
  driverType?: "COMPANY" | "FREELANCE" | null;
  rating?: number | null;
  leaves: TimesheetLeave[];
  assignments: TimesheetAssignment[];
}

interface TimesheetResponse {
  from: string;
  to: string;
  employees: TimesheetEmployee[];
}

interface Summary {
  worked: number;
  off: number;
  pending: number;
}

function covers(day: Dayjs, item: { startDate: string; endDate: string }) {
  const t = day.startOf("day").valueOf();
  const s = dayjs(item.startDate).startOf("day").valueOf();
  const e = dayjs(item.endDate).startOf("day").valueOf();
  return t >= s && t <= e;
}

/** Distinct calendar days covered by the items, clipped to [from, to]. */
function countDaysCovered(
  items: Array<{ startDate: string; endDate: string }>,
  from: Dayjs,
  to: Dayjs,
) {
  const days = new Set<string>();
  const fromDay = from.startOf("day");
  const toDay = to.startOf("day");
  for (const item of items) {
    let d = dayjs(item.startDate).startOf("day");
    const end = dayjs(item.endDate).startOf("day");
    if (d.isBefore(fromDay, "day")) d = fromDay;
    const stop = end.isAfter(toDay, "day") ? toDay : end;
    while (d.isSameOrBefore(stop, "day")) {
      days.add(d.format("YYYY-MM-DD"));
      d = d.add(1, "day");
    }
  }
  return days.size;
}

function countLeaveDays(
  leaves: TimesheetLeave[],
  status: TimesheetLeave["status"],
  from: Dayjs,
  to: Dayjs,
) {
  return countDaysCovered(
    leaves.filter((l) => l.status === status),
    from,
    to,
  );
}

function typeLabel(emp: TimesheetEmployee) {
  if (emp.guideType) {
    return emp.guideType === "OFFICIAL" ? "Company guide" : "Freelance guide";
  }
  if (emp.driverType) {
    return emp.driverType === "COMPANY" ? "Company driver" : "Freelance driver";
  }
  return ROLE_LABEL[emp.role] ?? emp.role;
}

/** Company transport provider accounts and the staff that belong to them. */
function employeeGroup(emp: TimesheetEmployee) {
  if (emp.group) return emp.group;
  if (emp.role === "TRANSPORT_PROVIDER") return "PROVIDER_ACCOUNT";
  if (emp.provider) return "PROVIDER_STAFF";
  if (emp.role === "TOUR_GUIDE") {
    return emp.guideType === "OFFICIAL" ? "COMPANY_GUIDE" : "FREELANCE_GUIDE";
  }
  if (emp.role === "DRIVER") {
    return emp.driverType === "FREELANCE"
      ? "FREELANCE_DRIVER"
      : "COMPANY_DRIVER";
  }
  return "OFFICE";
}

function dayStatus(emp: TimesheetEmployee, day: Dayjs) {
  const leave = emp.leaves.find((l) => covers(day, l));
  if (leave) {
    const label =
      leave.status === "APPROVED"
        ? "Off"
        : leave.status === "PENDING"
          ? "Pending off"
          : "Rejected off";
    return leave.isEmergency ? `${label} (emergency)` : label;
  }
  const busy = emp.assignments.find((a) => covers(day, a));
  if (busy) {
    const worked = WORKED_STATUSES.has(busy.status ?? "");
    const label = worked ? "On tour" : "Assigned";
    return busy.code ? `${label} (${busy.code})` : label;
  }
  if (!emp.isActive) return "Disabled";
  return "Free";
}

function csvCell(value: unknown) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export default function EmployeeTimesheetDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("day"),
    dayjs().startOf("day").add(6, "day"),
  ]);
  const [data, setData] = useState<TimesheetResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [groupFilter, setGroupFilter] = useState<string[]>([]);
  const [providerFilter, setProviderFilter] = useState<string[]>([]);
  const [includeInactive, setIncludeInactive] = useState(true);

  const rangeKey = `${range[0].format("YYYY-MM-DD")}-${range[1].format("YYYY-MM-DD")}`;

  const load = useCallback(async (from: Dayjs, to: Dayjs) => {
    setLoading(true);
    try {
      const r = await api.get("/leaves/timesheet", {
        params: {
          from: from.format("YYYY-MM-DD"),
          to: to.format("YYYY-MM-DD"),
          includeInactive: true,
        },
      });
      setData(r.data ?? { from, to, employees: [] });
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load employee timesheet"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) load(range[0], range[1]);
  }, [open, rangeKey]);

  const days = useMemo(() => {
    const out: Dayjs[] = [];
    let d = range[0].clone();
    while (d.isSameOrBefore(range[1], "day")) {
      out.push(d.clone());
      d = d.add(1, "day");
    }
    return out;
  }, [range]);

  const providers = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; isCompany: boolean }
    >();
    for (const emp of data?.employees ?? []) {
      if (!emp.provider?.id) continue;
      map.set(emp.provider.id, {
        id: emp.provider.id,
        name: emp.provider.name ?? emp.provider.id,
        isCompany: emp.provider.isCompany === true,
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);

  const employees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.employees ?? []).filter((emp) => {
      if (emp.role === "ADMIN") return false;
      if (!includeInactive && !emp.isActive) return false;
      if (roleFilter.length > 0 && !roleFilter.includes(emp.role)) return false;
      if (
        groupFilter.length > 0 &&
        !groupFilter.includes(employeeGroup(emp))
      ) {
        return false;
      }
      if (
        providerFilter.length > 0 &&
        (!emp.provider?.id || !providerFilter.includes(emp.provider.id))
      ) {
        return false;
      }
      if (!q) return true;
      return `${emp.name} ${emp.email} ${emp.provider?.name ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [
    data,
    search,
    roleFilter,
    groupFilter,
    providerFilter,
    includeInactive,
  ]);

  const summaries = useMemo(() => {
    const map = new Map<string, Summary>();
    for (const emp of data?.employees ?? []) {
      map.set(emp.id, {
        worked: countDaysCovered(
          emp.assignments.filter((a) => WORKED_STATUSES.has(a.status ?? "")),
          range[0],
          range[1],
        ),
        off: countLeaveDays(emp.leaves, "APPROVED", range[0], range[1]),
        pending: countLeaveDays(emp.leaves, "PENDING", range[0], range[1]),
      });
    }
    return map;
  }, [data, range]);

  const exportCsv = () => {
    if (employees.length === 0) {
      message.warning("No employees to export");
      return;
    }
    const dayHeaders = days.map((d) => d.format("YYYY-MM-DD ddd"));
    const header = [
      "Employee",
      "Email",
      "Role",
      "Group",
      "Type",
      "Provider",
      "Active",
      "Days worked",
      "Days off (approved)",
      "Pending off",
      "Date range",
      ...dayHeaders,
    ];
    const dateRange = `${range[0].format("YYYY-MM-DD")} to ${range[1].format("YYYY-MM-DD")}`;
    const rows = employees.map((emp) => {
      const summary = summaries.get(emp.id) ?? { worked: 0, off: 0, pending: 0 };
      const group = employeeGroup(emp);
      return [
        emp.name,
        emp.email,
        ROLE_LABEL[emp.role] ?? emp.role,
        GROUP_LABEL[group] ?? group,
        typeLabel(emp),
        emp.provider?.name ?? "",
        emp.isActive ? "Yes" : "No",
        summary.worked,
        summary.off,
        summary.pending,
        dateRange,
        ...days.map((d) => dayStatus(emp, d)),
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `employee-timesheet_${range[0].format("YYYY-MM-DD")}_${range[1].format("YYYY-MM-DD")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    message.success(`Exported ${employees.length} employee(s)`);
  };

  const columns = useMemo<ColumnsType<TimesheetEmployee>>(
    () => [
      {
        title: "Employee",
        key: "employee",
        fixed: "left",
        width: 250,
        render: (_, emp) => {
          const offLeave = emp.leaves.find(
            (l) => l.status !== "REJECTED" && days.some((d) => covers(d, l)),
          );
          return (
            <Flex vertical gap={2}>
              <Flex gap={4} align="center" wrap>
                <Text strong style={{ fontSize: 13 }}>
                  {emp.name}
                </Text>
                <Tag
                  color={ROLE_COLOR[emp.role] ?? "default"}
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {ROLE_LABEL[emp.role] ?? emp.role}
                </Tag>
                {!emp.isActive && (
                  <Tag color="default" style={{ margin: 0, fontSize: 10 }}>
                    Disabled
                  </Tag>
                )}
                {offLeave && (
                  <Tooltip
                    title={`Off (${offLeave.status}) · ${dayjs(offLeave.startDate).format("DD MMM YYYY")} → ${dayjs(offLeave.endDate).format("DD MMM YYYY")}`}
                  >
                    <Tag color="volcano" style={{ margin: 0, fontSize: 10 }}>
                      Off
                    </Tag>
                  </Tooltip>
                )}
              </Flex>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {typeLabel(emp)}
                {emp.provider?.name ? ` · ${emp.provider.name}` : ""}
                {emp.rating != null ? ` · ★ ${emp.rating}` : ""}
              </Text>
            </Flex>
          );
        },
      },
      {
        title: "Group",
        key: "group",
        fixed: "left",
        width: 150,
        render: (_, emp) => {
          const group = employeeGroup(emp);
          return (
            <Tag
              color={GROUP_COLOR[group] ?? "default"}
              style={{ margin: 0, fontSize: 11 }}
            >
              {GROUP_LABEL[group] ?? group}
            </Tag>
          );
        },
      },
      {
        title: (
          <Tooltip title="Distinct days on a dispatched/verifying/completed tour in this range">
            <span>Days worked</span>
          </Tooltip>
        ),
        key: "worked",
        fixed: "left",
        width: 96,
        align: "center",
        render: (_, emp) => {
          const n = summaries.get(emp.id)?.worked ?? 0;
          return <Text strong>{n}</Text>;
        },
      },
      {
        title: (
          <Tooltip title="Approved leave days in this range">
            <span>Days off</span>
          </Tooltip>
        ),
        key: "off",
        fixed: "left",
        width: 90,
        align: "center",
        render: (_, emp) => {
          const n = summaries.get(emp.id)?.off ?? 0;
          return n > 0 ? (
            <Text strong style={{ color: "#cf1322" }}>
              {n}
            </Text>
          ) : (
            <Text type="secondary">0</Text>
          );
        },
      },
      {
        title: (
          <Tooltip title="Leave requests still waiting for approval">
            <span>Pending off</span>
          </Tooltip>
        ),
        key: "pending",
        fixed: "left",
        width: 100,
        align: "center",
        render: (_, emp) => {
          const n = summaries.get(emp.id)?.pending ?? 0;
          return n > 0 ? (
            <Text strong style={{ color: "#d46b08" }}>
              {n}
            </Text>
          ) : (
            <Text type="secondary">0</Text>
          );
        },
      },
      ...days.map((d) => ({
        title: (
          <Flex vertical align="center" gap={0} style={{ lineHeight: 1.3 }}>
            <Text style={{ fontSize: 11, fontWeight: 600 }}>
              {d.format("DD MMM")}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>
              {d.format("ddd")}
            </Text>
          </Flex>
        ),
        key: d.format("YYYY-MM-DD"),
        width: 82,
        align: "center" as const,
        render: (_: unknown, emp: TimesheetEmployee) => {
          const onLeave = emp.leaves.find((l) => covers(d, l));
          if (onLeave) {
            const color = LEAVE_COLOR[onLeave.status] ?? LEAVE_COLOR.PENDING;
            const label = LEAVE_LABEL[onLeave.status] ?? onLeave.status;
            return (
              <Tooltip
                title={`${label}${onLeave.isEmergency ? " · Emergency" : ""} · ${dayjs(onLeave.startDate).format("DD MMM YYYY")} → ${dayjs(onLeave.endDate).format("DD MMM YYYY")}${onLeave.reason ? ` · ${onLeave.reason}` : ""}`}
              >
                <div
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: `repeating-linear-gradient(45deg, ${color}29 0 6px, ${color}0d 6px 12px)`,
                    border: `1px solid ${color}73`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: emp.isActive ? 1 : 0.55,
                  }}
                >
                  <Text strong style={{ fontSize: 11, color, whiteSpace: "nowrap" }}>
                    {label}
                  </Text>
                </div>
              </Tooltip>
            );
          }

          const busy = emp.assignments.find((a) => covers(d, a));
          if (busy) {
            const done = busy.status === "COMPLETED";
            return (
              <Tooltip
                title={`${busy.code ?? "Bus"}${busy.plateNumber ? ` · ${busy.plateNumber}` : ""} · ${busy.tourName ?? "Tour"} · ${busy.status ?? ""}`}
              >
                <div
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: done ? "rgba(0,0,0,0.04)" : "rgba(22,119,255,0.12)",
                    border: done ? "1px solid #d9d9d9" : "1px solid rgba(22,119,255,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    overflow: "hidden",
                  }}
                >
                  <Text
                    strong
                    style={{
                      fontSize: 11,
                      color: done ? "#8c8c8c" : "#1677ff",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {busy.code ?? "Busy"}
                  </Text>
                </div>
              </Tooltip>
            );
          }

          if (!emp.isActive) {
            return (
              <Tooltip title="Employee disabled">
                <div
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.03)",
                    border: "1px dashed #d9d9d9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    —
                  </Text>
                </div>
              </Tooltip>
            );
          }

          return (
            <Tooltip title="Available — no leave or tour">
              <div
                style={{
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(82,196,26,0.10)",
                  border: "1px dashed rgba(82,196,26,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#52c41a",
                  }}
                />
              </div>
            </Tooltip>
          );
        },
      })),
    ],
    [days, summaries],
  );

  return (
    <Drawer
      title="Employee timesheet"
      open={open}
      onClose={onClose}
      size="92%"
      destroyOnClose
      extra={
        <Space wrap>
          <RangePicker
            allowEmpty={[false, false]}
            value={range}
            onChange={(v) => {
              if (v && v[0] && v[1]) {
                setRange([v[0].startOf("day"), v[1].startOf("day")]);
              }
            }}
            format="DD MMM YYYY"
          />
          <Tooltip title="Available — no leave or tour">
            <Tag
              icon={
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#52c41a",
                    marginRight: 4,
                  }}
                />
              }
              color="green"
            >
              Free
            </Tag>
          </Tooltip>
          <Tooltip title="On tour — assigned to a running bus">
            <Tag color="blue">On tour</Tag>
          </Tooltip>
          <Tooltip title="Approved day off">
            <Tag color="volcano">Off</Tag>
          </Tooltip>
          <Tooltip title="Day-off request waiting for approval">
            <Tag color="orange">Pending</Tag>
          </Tooltip>
          <Tooltip title="Rejected day-off request">
            <Tag color="default">Rejected</Tag>
          </Tooltip>
        </Space>
      }
    >
      <Flex justify="space-between" align="center" wrap gap={8} style={{ marginBottom: 10 }}>
        <Flex align="center" gap={8} wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 260, maxWidth: 420 }}
            styles={selectStyles(SELECT_THEMES.role)}
            tagRender={selectTagRender(SELECT_THEMES.role)}
            optionRender={selectOptionRender(SELECT_THEMES.role)}
            placeholder="Filter roles (multiple)"
            value={roleFilter}
            onChange={setRoleFilter}
            maxTagCount="responsive"
            options={[
              { value: "OFFICE", label: "Office" },
              { value: "TOUR_GUIDE", label: "Tour Guide" },
              { value: "DRIVER", label: "Driver" },
              { value: "TRANSPORT_PROVIDER", label: "Transport Provider" },
            ]}
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 220, maxWidth: 380 }}
            styles={selectStyles(SELECT_THEMES.group)}
            tagRender={selectTagRender(SELECT_THEMES.group)}
            optionRender={selectOptionRender(SELECT_THEMES.group)}
            placeholder="Filter groups (multiple)"
            value={groupFilter}
            onChange={setGroupFilter}
            maxTagCount="responsive"
            options={GROUP_OPTIONS}
          />
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ minWidth: 200, maxWidth: 340 }}
            styles={selectStyles(SELECT_THEMES.provider)}
            tagRender={selectTagRender(SELECT_THEMES.provider)}
            optionRender={selectOptionRender(SELECT_THEMES.provider)}
            placeholder="Filter providers (multiple)"
            value={providerFilter}
            onChange={setProviderFilter}
            maxTagCount="responsive"
            disabled={providers.length === 0}
            options={providers.map((provider) => ({
              value: provider.id,
              label: provider.isCompany
                ? `${provider.name} (internal)`
                : provider.name,
            }))}
          />
          <Tooltip title="Include disabled employees in the list">
            <Tag.CheckableTag
              checked={includeInactive}
              onChange={setIncludeInactive}
            >
              Show disabled
            </Tag.CheckableTag>
          </Tooltip>
        </Flex>
        <Tooltip title="Export the employees currently shown (respects the filters)">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={exportCsv}
            disabled={employees.length === 0}
          >
            Export CSV
          </Button>
        </Tooltip>
      </Flex>

      <Table<TimesheetEmployee>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={employees}
        pagination={false}
        sticky
        scroll={{ x: 250 + 150 + 96 + 90 + 100 + days.length * 82 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No employees"
              style={{ padding: 32 }}
            />
          ),
        }}
      />
    </Drawer>
  );
}
