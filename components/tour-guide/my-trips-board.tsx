"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Flex,
  Row,
  Statistic,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import type { DatePickerProps } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ScheduleOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import BoardColumn from "@/components/dispatch-board/BoardColumn";
import type { BoardItem } from "@/components/dispatch-board/types";
import { TYPE_META, sortByDate } from "@/components/dispatch-board/types";

const { Text } = Typography;

const tripDay = (value: string) =>
  dayjs(value).add(7, "hour").startOf("day");

export default function MyTripsBoard({
  assignments,
  loading,
  onRefresh,
}: {
  assignments: BoardItem[];
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const { token } = antdTheme.useToken();
  const today = dayjs().add(7, "hour").startOf("day");
  const [filterDate, setFilterDate] = useState<Dayjs>(() => today);

  const filtered = useMemo(
    () => assignments.filter((a) => tripDay(a.startDate).isSame(filterDate, "day")),
    [assignments, filterDate],
  );

  const groupItems = useMemo(
    () => filtered.filter((a) => a.tourType === "GROUP_TOUR").sort(sortByDate),
    [filtered],
  );
  const privateItems = useMemo(
    () => filtered.filter((a) => a.tourType === "PRIVATE_TOUR").sort(sortByDate),
    [filtered],
  );
  const otherItems = useMemo(
    () =>
      filtered
        .filter(
          (a) => a.tourType !== "GROUP_TOUR" && a.tourType !== "PRIVATE_TOUR",
        )
        .sort(sortByDate),
    [filtered],
  );

  const tripDates = useMemo(
    () => new Set(assignments.map((a) => tripDay(a.startDate).format("YYYY-MM-DD"))),
    [assignments],
  );

  const jumpTripDate = useMemo(() => {
    const dates = assignments
      .map((a) => tripDay(a.startDate))
      .sort((a, b) => a.valueOf() - b.valueOf());
    return (
      dates.find((d) => !d.isBefore(today, "day")) ?? dates[dates.length - 1] ?? null
    );
  }, [assignments, today]);

  const isFilterToday = filterDate.isSame(today, "day");
  const stats = useMemo(
    () => ({
      pending: filtered.filter((a) => a.status === "PENDING").length,
      dispatched: filtered.filter((a) => a.status === "DISPATCHED").length,
      verifying: filtered.filter((a) => a.status === "VERIFYING").length,
      completed: filtered.filter((a) => a.status === "COMPLETED").length,
      total: filtered.length,
    }),
    [filtered],
  );

  const renderDateCell: NonNullable<DatePickerProps["cellRender"]> = (
    current,
    info,
  ) => {
    if (info.type !== "date") return info.originNode;
    const dateStr = (current as Dayjs).format("YYYY-MM-DD");
    const hasTrip = tripDates.has(dateStr);
    const isToday = dateStr === today.format("YYYY-MM-DD");
    const isSelected = dateStr === filterDate.format("YYYY-MM-DD");
    return (
      <div style={{ position: "relative" }}>
        {info.originNode}
        {hasTrip && !isSelected && (
          <div
            style={{
              position: "absolute",
              bottom: 1,
              left: "50%",
              transform: "translateX(-50%)",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: isToday ? "#52c41a" : "#1677ff",
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div>
      <Card
        size="small"
        style={{ marginBottom: 16, borderRadius: 14 }}
        styles={{ body: { padding: "14px 18px" } }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={14}>
            <Flex vertical gap={6}>
              <Flex wrap gap={8} align="center">
                {isFilterToday && <Tag color="green">Today</Tag>}
                <Text strong style={{ fontSize: 17 }}>
                  {filterDate.format("dddd, MMMM D, YYYY")}
                </Text>
              </Flex>
              <Flex wrap gap={8} align="center">
                <CalendarOutlined style={{ color: token.colorPrimary }} />
                <Text type="secondary">Filter by date:</Text>
                <DatePicker
                  value={filterDate}
                  onChange={(d) => {
                    if (d) setFilterDate(d);
                  }}
                  allowClear={false}
                  style={{ width: 200 }}
                  cellRender={renderDateCell}
                  format="YYYY-MM-DD"
                />
                <Button
                  size="small"
                  onClick={() => setFilterDate((d) => d.subtract(1, "day"))}
                >
                  ← Prev
                </Button>
                <Button size="small" onClick={() => setFilterDate(today)}>
                  Today
                </Button>
                <Button
                  size="small"
                  onClick={() => setFilterDate((d) => d.add(1, "day"))}
                >
                  Next →
                </Button>
              </Flex>
            </Flex>
          </Col>
          <Col xs={24} md={10}>
            <Flex wrap gap={8} align="center" justify="flex-end">
              <Tag
                style={{
                  borderRadius: 999,
                  padding: "0 14px",
                  height: 32,
                  lineHeight: "30px",
                  margin: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  background: `${token.colorPrimary}1a`,
                  color: token.colorPrimary,
                  border: "none",
                }}
              >
                {filtered.length} trip{filtered.length === 1 ? "" : "s"}
              </Tag>
              {onRefresh && (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  loading={loading}
                  style={{ borderRadius: 10 }}
                >
                  Refresh
                </Button>
              )}
            </Flex>
          </Col>
        </Row>
      </Card>

      {filtered.length === 0 ? (
        <Card size="small" style={{ borderRadius: 14 }}>
          <Empty
            description={
              assignments.length === 0
                ? "No tours assigned to you yet — ask your admin or operator"
                : `No tours on ${filterDate.format("DD MMM YYYY")}`
            }
            style={{ padding: 32 }}
          >
            {assignments.length > 0 && jumpTripDate && (
              <Button
                type="primary"
                onClick={() => setFilterDate(jumpTripDate)}
                style={{ marginTop: 8 }}
              >
                {jumpTripDate.isBefore(today, "day")
                  ? "Go to latest trip"
                  : "Go to next trip"}{" "}
                — {jumpTripDate.format("DD MMM YYYY")}
              </Button>
            )}
          </Empty>
          <Flex justify="center" style={{ paddingBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Dots on the calendar mark dates when you have a trip.
            </Text>
          </Flex>
        </Card>
      ) : (
        <>
          <Card
            size="small"
            style={{ borderRadius: 14 }}
            styles={{ body: { padding: 18 } }}
          >
            <Row gutter={[20, 20]}>
              <BoardColumn
                meta={TYPE_META.GROUP_TOUR}
                items={groupItems}
                today={today}
                confirmingId={null}
                dispatchingId={null}
                recallingId={null}
                canConfirm={false}
                readOnly
                onConfirm={() => {}}
                onDispatch={() => {}}
                onRecall={() => {}}
                onMoveBooking={() => {}}
                onTemplate={() => {}}
              />
              <BoardColumn
                meta={TYPE_META.PRIVATE_TOUR}
                items={privateItems}
                today={today}
                confirmingId={null}
                dispatchingId={null}
                recallingId={null}
                canConfirm={false}
                readOnly
                onConfirm={() => {}}
                onDispatch={() => {}}
                onRecall={() => {}}
                onMoveBooking={() => {}}
                onTemplate={() => {}}
              />
              {otherItems.length > 0 && (
                <BoardColumn
                  meta={TYPE_META.OTHER}
                  items={otherItems}
                  today={today}
                  confirmingId={null}
                  dispatchingId={null}
                  recallingId={null}
                  canConfirm={false}
                  readOnly
                  onConfirm={() => {}}
                  onDispatch={() => {}}
                  onRecall={() => {}}
                  onMoveBooking={() => {}}
                  onTemplate={() => {}}
                />
              )}
            </Row>
          </Card>

          <Alert
            type="info"
            showIcon
            icon={<CheckCircleOutlined />}
            message={<Text strong>Day summary</Text>}
            description={
              <Row gutter={[12, 8]} style={{ marginTop: 8 }}>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Pending"
                    value={stats.pending}
                    styles={{ content: { fontSize: 18, color: "#faad14" } }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Dispatched"
                    value={stats.dispatched}
                    styles={{ content: { fontSize: 18, color: "#1677ff" } }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Verifying"
                    value={stats.verifying}
                    styles={{ content: { fontSize: 18, color: "#722ed1" } }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Completed"
                    value={stats.completed}
                    styles={{ content: { fontSize: 18, color: "#52c41a" } }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Total"
                    value={stats.total}
                    styles={{ content: { fontSize: 18, color: token.colorPrimary } }}
                  />
                </Col>
              </Row>
            }
            style={{ borderRadius: 12, marginTop: 16 }}
          />
        </>
      )}

      <Flex justify="center" style={{ marginTop: 12 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>
          <ScheduleOutlined /> This board only shows trips assigned to you. It is
          read-only — admin or operations manage dispatch changes.
        </Text>
      </Flex>
    </div>
  );
}
