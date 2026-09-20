"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { api, getErrorMessage } from "@/lib/api";

dayjs.extend(isSameOrBefore);

const { Text } = Typography;
const { RangePicker } = DatePicker;

const GUIDE_COMPANY_COLOR = "#0caf7a";
const GUIDE_FREELANCE_COLOR = "#8a3ffc";
const LEAVE_COLOR = "#fa541c";
const DRIVER_PALETTE = [
  "#1677ff",
  "#13c2c2",
  "#fa8c16",
  "#eb2f96",
  "#722ed1",
  "#a0d911",
  "#f5222d",
];
const DRIVER_FALLBACK = "#1677ff";

interface AvailLeave {
  id: string;
  startDate: string;
  endDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface AvailAssignment {
  id: string;
  code?: string | null;
  tourName?: string | null;
  status?: string;
  startDate: string;
  endDate: string;
}

interface AvailGuide {
  id: string;
  name: string;
  email?: string;
  type?: "OFFICIAL" | "FREELANCE";
  rating?: number | null;
  assignments: AvailAssignment[];
  leaves?: AvailLeave[];
}

interface AvailDriver {
  id: string;
  name: string;
  email?: string;
  rating?: number | null;
  provider?: { id?: string; name?: string } | null;
  assignments: AvailAssignment[];
  leaves?: AvailLeave[];
}

interface CrewAvailResponse {
  from: string;
  to: string;
  guides: AvailGuide[];
  drivers: AvailDriver[];
}

interface CrewRow {
  key: string;
  kind: "guide" | "driver";
  name: string;
  color: string;
  attr?: string;
  rating?: number | null;
  member: AvailGuide | AvailDriver;
}

function covers(day: Dayjs, a: AvailAssignment) {
  const t = day.startOf("day").valueOf();
  const s = dayjs(a.startDate).startOf("day").valueOf();
  const e = dayjs(a.endDate).startOf("day").valueOf();
  return t >= s && t <= e;
}

function coversLeave(day: Dayjs, l: AvailLeave) {
  const t = day.startOf("day").valueOf();
  const s = dayjs(l.startDate).startOf("day").valueOf();
  const e = dayjs(l.endDate).startOf("day").valueOf();
  return t >= s && t <= e;
}

export default function CrewAvailabilityDrawer({
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
  const [role, setRole] = useState<"guide" | "driver">("guide");
  const [data, setData] = useState<CrewAvailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [guideType, setGuideType] = useState<"all" | "OFFICIAL" | "FREELANCE">("all");
  const [provider, setProvider] = useState<string>("all");

  const rangeKey = `${range[0].format("YYYY-MM-DD")}-${range[1].format("YYYY-MM-DD")}`;

  const load = useCallback(
    async (from: Dayjs, to: Dayjs) => {
      setLoading(true);
      try {
        const r = await api.get(`/assignments/board/crew/availability`, {
          params: {
            from: from.format("YYYY-MM-DD"),
            to: to.format("YYYY-MM-DD"),
          },
        });
        setData(r.data ?? { from, to, guides: [], drivers: [] });
      } catch (e) {
        message.error(getErrorMessage(e, "Failed to load crew availability"));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

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

  const driverColors = useMemo(() => {
    const map: Record<string, string> = {};
    const names = Array.from(
      new Set(
        (data?.drivers ?? [])
          .map((dr) => dr.provider?.name)
          .filter((n): n is string => !!n),
      ),
    ).sort();
    names.forEach((n, i) => {
      map[n] = DRIVER_PALETTE[i % DRIVER_PALETTE.length];
    });
    return map;
  }, [data]);

  const providerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (data?.drivers ?? [])
            .map((dr) => dr.provider?.name)
            .filter((n): n is string => !!n),
        ),
      ).sort(),
    [data],
  );

  const rows = useMemo<CrewRow[]>(() => {
    const guides: CrewRow[] = (data?.guides ?? [])
      .filter((g) => guideType === "all" || g.type === guideType)
      .map((g) => ({
        key: `guide-${g.id}`,
        kind: "guide",
        name: g.name,
        color:
          g.type === "OFFICIAL" ? GUIDE_COMPANY_COLOR : GUIDE_FREELANCE_COLOR,
        attr: g.type === "OFFICIAL" ? "Company" : "Freelance",
        rating: g.rating,
        member: g,
      }));
    const drivers: CrewRow[] = (data?.drivers ?? [])
      .filter((dr) => provider === "all" || dr.provider?.name === provider)
      .map((dr) => ({
        key: `driver-${dr.id}`,
        kind: "driver",
        name: dr.name,
        color: dr.provider?.name
          ? (driverColors[dr.provider.name] ?? DRIVER_FALLBACK)
          : DRIVER_FALLBACK,
        attr: dr.provider?.name,
        rating: dr.rating,
        member: dr,
      }));
    return role === "guide" ? guides : drivers;
  }, [data, driverColors, role, guideType, provider]);

  const columns = useMemo<ColumnsType<CrewRow>>(
    () => [
      {
        title: "Crew",
        key: "name",
        fixed: "left",
        width: 240,
        render: (_, row) => (
          <Flex gap={8} align="center">
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: row.color,
                flex: "none",
              }}
            />
            <Flex vertical gap={0}>
              <Text strong style={{ fontSize: 13 }}>
                {row.name}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {row.kind === "guide" ? "Guide" : "Driver"}
                {row.attr ? ` · ${row.attr}` : ""}
                {row.rating != null ? ` · ★ ${row.rating}` : ""}
              </Text>
            </Flex>
          </Flex>
        ),
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
        width: 78,
        align: "center" as const,
        render: (_: unknown, row: CrewRow) => {
          const onLeave = row.member.leaves?.find((l) => coversLeave(d, l));
          if (onLeave) {
            return (
              <Tooltip
                title={`Off (${onLeave.status}) · ${dayjs(onLeave.startDate).format("DD MMM YYYY")} → ${dayjs(onLeave.endDate).format("DD MMM YYYY")}`}
              >
                <div
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background:
                      "repeating-linear-gradient(45deg, rgba(250, 84, 28, 0.16) 0 6px, rgba(250, 84, 28, 0.05) 6px 12px)",
                    border: "1px solid rgba(250, 84, 28, 0.45)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    strong
                    style={{
                      fontSize: 11,
                      color: LEAVE_COLOR,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Off
                  </Text>
                </div>
              </Tooltip>
            );
          }
          const busy = row.member.assignments.find((a) => covers(d, a));
          if (busy) {
            return (
              <Tooltip
                title={`${busy.code ?? "Bus"} · ${busy.tourName ?? "Tour"} · ${busy.status ?? ""}`}
              >
                <div
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: "rgba(250, 140, 22, 0.16)",
                    border: "1px solid rgba(250, 140, 22, 0.35)",
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
                      color: "#d46b08",
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
          return (
            <Tooltip title="Available — no tour">
              <div
                style={{
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(82, 196, 26, 0.10)",
                  border: "1px dashed rgba(82, 196, 26, 0.35)",
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
    [days],
  );

  return (
    <Drawer
      title="Crew availability calendar"
      open={open}
      onClose={onClose}
      width="92%"
      destroyOnClose
      extra={
        <Space>
          <RangePicker
            allowEmpty={[false, false]}
            value={range}
            onChange={(v) => {
              if (v && v[0] && v[1]) setRange([v[0].startOf("day"), v[1].startOf("day")]);
            }}
            format="DD MMM YYYY"
          />
          <Tag
            icon={<span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#52c41a", marginRight: 4 }} />}
            color="green"
          >
            Free
          </Tag>
          <Tag color="orange">On tour</Tag>
          <Tag color="volcano">Off</Tag>
          <Tooltip title="Reload">
            <span
              role="button"
              onClick={() => load(range[0], range[1])}
              style={{ cursor: "pointer", fontSize: 16, color: "#1677ff" }}
            >
              <ReloadOutlined />
            </span>
          </Tooltip>
        </Space>
      }
    >
      <Flex justify="space-between" align="center" wrap gap={6} style={{ marginBottom: 10 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Showing{" "}
          <Text strong>
            {role === "guide" ? data?.guides.length ?? 0 : data?.drivers.length ?? 0}{" "}
            {role === "guide" ? "guides" : "drivers"}
          </Text>{" "}
          from {range[0].format("DD MMM YYYY")} to{" "}
          {range[1].format("DD MMM YYYY")}. Green dot = available day, orange =
          assigned to a bus, red hatch = on leave (hover for details).
        </Text>
        <Segmented
          options={[
            { label: "Tourguide", value: "guide" },
            { label: "Driver", value: "driver" },
          ]}
          value={role}
          onChange={(v) => setRole(v as "guide" | "driver")}
        />
      </Flex>
      <Flex wrap gap={8} align="center" style={{ marginBottom: 10 }}>
        {role === "guide" ? (
          <Select
            size="small"
            style={{ width: 140 }}
            value={guideType}
            onChange={(v) => setGuideType(v)}
            options={[
              { value: "all", label: "All types" },
              { value: "OFFICIAL", label: "Company" },
              { value: "FREELANCE", label: "Freelance" },
            ]}
          />
        ) : (
          <Select
            size="small"
            style={{ width: 180 }}
            value={provider}
            onChange={(v) => setProvider(v)}
            options={[
              { value: "all", label: "All providers" },
              ...providerOptions.map((p) => ({ value: p, label: p })),
            ]}
          />
        )}
      </Flex>
      <Table<CrewRow>
        rowKey="key"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        pagination={false}
        sticky
        scroll={{ x: 240 + days.length * 78 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No crew data"
              style={{ padding: 32 }}
            />
          ),
        }}
      />
    </Drawer>
  );
}