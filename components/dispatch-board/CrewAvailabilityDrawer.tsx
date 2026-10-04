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
} from "antd";
import { message } from "@/lib/antd-message";
import type { ColumnsType } from "antd/es/table";
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
  plateNumber?: string | null;
  // Paid = exported in a non-voided payment period (Accounting clicked
  // Accept/Export after checking the total). Verified-but-not-exported stays unpaid.
  paid?: boolean;
  moneyVerifiedAt?: string | null;
  paidToName?: string | null;
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
        render: (_, row) => {
          // Red "Off" tag next to the crew name when they have a day-off
          // covering any visible day (in addition to the per-day Off cells).
          const offLeave = row.member.leaves?.find(
            (l) =>
              l.status !== "REJECTED" &&
              days.some((d) => coversLeave(d, l)),
          );
          // Paid summary for the searched range: derived from the exported
          // payment periods (Accounting preview → Accept/Export → Paid).
          const tours = row.member.assignments ?? [];
          const paidCount = tours.filter((a) => a.paid).length;
          const paidTag =
            tours.length === 0 ? null : paidCount === tours.length ? (
              <Tooltip title={`${paidCount}/${tours.length} tours in this range already exported (paid)`}>
                <Tag icon={<span>✓</span>} color="success" style={{ margin: 0, fontSize: 10 }}>
                  Paid
                </Tag>
              </Tooltip>
            ) : paidCount > 0 ? (
              <Tooltip title={`${paidCount}/${tours.length} tours paid — rest still unpaid`}>
                <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>
                  {paidCount}/{tours.length} paid
                </Tag>
              </Tooltip>
            ) : (
              <Tooltip title={`${tours.length} tour(s) in this range — none exported yet (unpaid)`}>
                <Tag color="default" style={{ margin: 0, fontSize: 10 }}>
                  Unpaid
                </Tag>
              </Tooltip>
            );
          return (
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
              <Flex vertical gap={2}>
                <Flex gap={4} align="center" wrap>
                  <Text strong style={{ fontSize: 13 }}>
                    {row.name}
                  </Text>
                  {offLeave && (
                    <Tooltip
                      title={`Off (${offLeave.status}) · ${dayjs(offLeave.startDate).format("DD MMM YYYY")} → ${dayjs(offLeave.endDate).format("DD MMM YYYY")}`}
                    >
                      <Tag color="red" style={{ margin: 0, fontSize: 10 }}>
                        Off
                      </Tag>
                    </Tooltip>
                  )}
                  {paidTag}
                </Flex>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {row.kind === "guide" ? "Guide" : "Driver"}
                  {row.attr ? ` · ${row.attr}` : ""}
                  {row.rating != null ? ` · ★ ${row.rating}` : ""}
                </Text>
              </Flex>
            </Flex>
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
            // Completed tours read grey — only running buses stay orange,
            // so free-to-assign days are obvious at a glance.
            const done = busy.status === "COMPLETED";
            // Assigned driver/guide carries the bus number plate.
            const plate = busy.plateNumber ? ` · ${busy.plateNumber}` : "";
            const paidMark = busy.paid
              ? ` · ✓ Paid${busy.paidToName ? ` to ${busy.paidToName}` : ""}`
              : busy.moneyVerifiedAt
                ? " · Unpaid (money locked, not exported)"
                : " · Unpaid (not exported)";
            return (
              <Tooltip
                title={`${busy.code ?? "Bus"}${plate} · ${busy.tourName ?? "Tour"} · ${busy.status ?? ""}${paidMark}`}
              >
                <div
                  style={{
                    height: 40,
                    borderRadius: 10,
                    background: busy.paid
                      ? "rgba(82, 196, 26, 0.14)"
                      : done
                        ? "rgba(0, 0, 0, 0.04)"
                        : "rgba(250, 140, 22, 0.16)",
                    border: busy.paid
                      ? "1px solid rgba(82, 196, 26, 0.55)"
                      : done
                        ? "1px solid #d9d9d9"
                        : "1px solid rgba(250, 140, 22, 0.35)",
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
                      color: busy.paid ? "#389e0d" : done ? "#8c8c8c" : "#d46b08",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {busy.paid
                      ? `✓ ${busy.code ?? "Paid"}${busy.plateNumber ? ` · ${busy.plateNumber}` : ""}`
                      : done
                        ? `✓ ${busy.code ?? "Done"}${busy.plateNumber ? ` · ${busy.plateNumber}` : ""} · Unpaid`
                        : `${busy.code ?? "Busy"}${busy.plateNumber ? ` · ${busy.plateNumber}` : ""} · Unpaid`}
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
      size="92%"
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
          <Tooltip title="Available — no tour assigned">
            <Tag
              icon={<span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#52c41a", marginRight: 4 }} />}
              color="green"
            >
              Free
            </Tag>
          </Tooltip>
          <Tooltip title="On tour — assigned to a running bus">
            <Tag color="orange">On tour</Tag>
          </Tooltip>
          <Tooltip title="Tour completed">
            <Tag color="default">Done</Tag>
          </Tooltip>
          <Tooltip title="Exported payment period — Accounting checked the total and clicked Accept/Export">
            <Tag color="success">✓ Paid</Tag>
          </Tooltip>
          <Tooltip title="Money not exported yet — still unpaid">
            <Tag color="default">Unpaid</Tag>
          </Tooltip>
          <Tooltip title="Off — tourguide or driver has day leaves">
            <Tag color="volcano">Off</Tag>
          </Tooltip>
        </Space>
      }
    >
      <Flex justify="flex-end" align="center" wrap gap={6} style={{ marginBottom: 10 }}>
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