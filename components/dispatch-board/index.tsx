"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Empty,
  Flex,
  Modal,
  Row,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
  theme as antdTheme,
  message,
} from "antd";
import type { DatePickerProps } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  SendOutlined,
  ScheduleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import { api, getErrorMessage } from "@/lib/api";
import type { BoardCrew, BoardItem } from "./types";
import { TYPE_META, sortByDate } from "./types";
import BoardColumn from "./BoardColumn";
import BookingAdditionsModal from "./BookingAdditionsModal";
import ConfirmFinishedModal from "./ConfirmFinishedModal";
import CrewAvailabilityDrawer from "./CrewAvailabilityDrawer";
import TourTemplateModal from "./TourTemplateModal";
import VerifyReportModal from "./VerifyReportModal";

const { Text } = Typography;

function BoardLoadingOverlay({ text }: { text: string }) {
  const { token } = antdTheme.useToken();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "rgba(255, 255, 255, 0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <LoadingOutlined
        spin
        style={{ fontSize: 42, color: token.colorPrimary }}
      />
      <Text type="secondary" style={{ fontSize: 14, letterSpacing: 0.3 }}>
        {text}
      </Text>
    </div>
  );
}

export default function DispatchBoard({
  open,
  onClose,
  onChanged,
  canUpdateAssignment,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  canUpdateAssignment: boolean;
}) {
  const { token } = antdTheme.useToken();

  const [boardData, setBoardData] = useState<BoardItem[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crew, setCrew] = useState<BoardCrew>({ guides: [], drivers: [] });
  const [confirmingId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<BoardItem | null>(null);
  const [templateTarget, setTemplateTarget] = useState<BoardItem | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<BoardItem | null>(null);
  const [filterDate, setFilterDate] = useState<Dayjs | null>(dayjs().startOf("day"));
  const [additionsTarget, setAdditionsTarget] = useState<BoardItem | null>(null);
  const [crewAvailOpen, setCrewAvailOpen] = useState(false);

  const loadBoard = useCallback((background = false) => {
    if (background) setRefreshing(true);
    else setBoardLoading(true);
    api
      .get("/assignments/board")
      .then((r) => {
        const data: BoardItem[] = r.data ?? [];
        setBoardData(data);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load board")))
      .finally(() => {
        setBoardLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    if (open) {
      setFilterDate(dayjs().startOf("day"));
      loadBoard();
      api
        .get("/assignments/board/crew")
        .then((r) => setCrew(r.data ?? { guides: [], drivers: [] }))
        .catch(() => setCrew({ guides: [], drivers: [] }));
    }
  }, [open, loadBoard]);

  const changeCrew = async (
    assignment: BoardItem,
    field: "guideId" | "driverId",
    userId: string | null,
  ) => {
    if (!canUpdateAssignment) return;
    try {
      await api.put(`/assignments/${assignment.id}`, { [field]: userId });
      const changed = field === "guideId" ? "guide" : "driver";
      message.success(
        userId
          ? `Reassigned ${changed} for bus "${assignment.code}"`
          : `Removed ${changed} from bus "${assignment.code}"`,
      );
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, `Failed to update ${field}`));
    }
  };

  const confirmTour = (assignment: BoardItem) => {
    setFinishing(assignment);
  };

  const openTemplate = (assignment: BoardItem) => {
    setTemplateTarget(assignment);
  };

  const openVerify = (assignment: BoardItem) => {
    setVerifyTarget(assignment);
  };

  const dispatchAssignment = async (assignment: BoardItem) => {
    setDispatchingId(assignment.id);
    try {
      await api.put(`/assignments/${assignment.id}/status`, {
        status: "DISPATCHED",
      });
      message.success(
        `Bus "${assignment.code}" dispatched — bookings set to ASSIGNED`,
      );
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to dispatch bus"));
    } finally {
      setDispatchingId(null);
    }
  };

  const [recalling, setRecalling] = useState<BoardItem | null>(null);
  const [recallingId, setRecallingId] = useState<string | null>(null);

  const recallAssignment = async (assignment: BoardItem) => {
    setRecallingId(assignment.id);
    try {
      await api.put(`/assignments/${assignment.id}/status`, {
        status: "PENDING",
      });
      message.success(
        `Bus "${assignment.code}" recall dispatched — bookings back to PENDING`,
      );
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to recall dispatch"));
    } finally {
      setRecallingId(null);
    }
  };

  const onRecall = (assignment: BoardItem) => {
    // After 7am the guide may be en route — ask for explicit confirmation.
    const now = dayjs();
    const cutoff = now.clone().startOf("day").add(7, "hour");
    if (now.isAfter(cutoff)) {
      setRecalling(assignment);
    } else {
      recallAssignment(assignment);
    }
  };

  const [dispatchingAll, setDispatchingAll] = useState(false);

  const dispatchAllBuses = async () => {
    setDispatchingAll(true);
    try {
      const r = await api.post(`/assignments/board/dispatch-all`);
      const dispatched = r.data?.dispatched ?? 0;
      if (dispatched > 0) {
        message.success(`Dispatched ${dispatched} bus(es)`);
        loadBoard(true);
        onChanged?.();
      } else {
        message.info("No buses available to dispatch");
      }
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to dispatch all buses"));
    } finally {
      setDispatchingAll(false);
    }
  };

  const setAllOrigin = async (origin: "MANUAL" | "AUTO_ASSIGN") => {
    try {
      await api.put(`/assignments/board/origin`, { origin });
      message.success(
        `Switched to ${origin === "AUTO_ASSIGN" ? "Auto-assign" : "Manual"}`,
      );
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to update assignment origins"));
    }
  };

  const moveBooking = async (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
  ) => {
    const source = boardData.find((a) =>
      a.bookings?.some((b) => b.id === bookingId),
    );
    if (!source) return;
    const target = boardData.find((a) => a.id === toAssignmentId);
    if (!target) return;

    const sameBus = source.id === toAssignmentId;
    const key = `dd-${bookingId}`;
    message.loading({ content: "Updating bus…", key });

    const insertAt = (order: string[]) => {
      const without = order.filter((id) => id !== bookingId);
      if (beforeBookingId) {
        const at = without.indexOf(beforeBookingId);
        without.splice(at === -1 ? without.length : at, 0, bookingId);
      } else {
        without.push(bookingId);
      }
      return without;
    };

    try {
      if (sameBus) {
        const order = insertAt(target.bookings?.map((b) => b.id) ?? []);
        await api.post(`/assignments/${target.id}/bookings/reorder`, {
          bookingIds: order,
        });
        message.success({ content: "Booking reordered in bus", key });
      } else {
        await api.put(
          `/assignments/${source.id}/bookings/${bookingId}/move`,
          { toAssignmentId },
        );
        const updated = await api
          .get(`/assignments/${toAssignmentId}`)
          .then((r) => r.data);
        const order = insertAt(updated.bookings?.map((b: any) => b.id) ?? []);
        if (order.length > 1) {
          await api.post(`/assignments/${toAssignmentId}/bookings/reorder`, {
            bookingIds: order,
          });
        }
        message.success({ content: "Booking moved between buses", key });
      }
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error({
        content: getErrorMessage(e, "Failed to update booking"),
        key,
      });
    }
  };

  const filtered = useMemo(
    () =>
      boardData.filter((a) => {
        if (!filterDate) return true;
        // Show every tour that is ACTIVE on the selected date (multi-day):
        // startDate <= filterDate <= endDate. Tours on the board by overlapping
        // the date, not only by their START date.
        const start = dayjs(a.startDate).startOf("day");
        const end = dayjs(a.endDate ?? a.startDate).startOf("day");
        return (
          start.isSameOrBefore(filterDate.startOf("day")) &&
          end.isSameOrAfter(filterDate.startOf("day"))
        );
      }),
    [boardData, filterDate],
  );

  const groupItems = useMemo(
    () => filtered.filter((a) => a.tourType === "GROUP_TOUR").sort(sortByDate),
    [filtered],
  );
  const privateItems = useMemo(
    () =>
      filtered.filter((a) => a.tourType === "PRIVATE_TOUR").sort(sortByDate),
    [filtered],
  );
  const otherItems = useMemo(
    () =>
      filtered
        .filter((a) => a.tourType !== "GROUP_TOUR" && a.tourType !== "PRIVATE_TOUR")
        .sort(sortByDate),
    [filtered],
  );

  const bookingDates = useMemo(() => {
    const dates = new Set<string>();
    for (const a of boardData) {
      let d = dayjs(a.startDate);
      const end = dayjs(a.endDate);
      while (d.isSameOrBefore(end, "day")) {
        dates.add(d.format("YYYY-MM-DD"));
        d = d.add(1, "day");
      }
    }
    return dates;
  }, [boardData]);
  const today = dayjs().startOf("day");
  const isFilterToday = !!filterDate && filterDate.startOf("day").isSame(today);

  const stats = useMemo(
    () => ({
      pending: filtered.filter((a) => a.status === "PENDING").length,
      dispatched: filtered.filter((a) => a.status === "DISPATCHED").length,
      verifying: filtered.filter((a) => a.status === "VERIFYING").length,
      group: groupItems.length,
      private: privateItems.length,
      other: otherItems.length,
      total: filtered.length,
    }),
    [filtered, groupItems, privateItems, otherItems],
  );

  const renderDateCell: NonNullable<DatePickerProps["cellRender"]> = (
    current,
    info,
  ) => {
    if (info.type !== "date") return info.originNode;
    const dateStr = (current as Dayjs).format("YYYY-MM-DD");
    const hasBookings = bookingDates.has(dateStr);
    const isToday = dateStr === today.format("YYYY-MM-DD");
    const isSelected =
      !!filterDate && dateStr === filterDate.format("YYYY-MM-DD");
    return (
      <div style={{ position: "relative" }}>
        {info.originNode}
        {hasBookings && !isSelected && (
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
    <Drawer
      title={
        <Space>
          <ScheduleOutlined style={{ color: token.colorPrimary }} />
          <Text strong>Tour Operations &amp; Dispatch Board</Text>
        </Space>
      }
      open={open}
      onClose={onClose}
      width="100%"
      destroyOnClose
    >
      {boardLoading && filtered.length === 0 ? (
        <BoardLoadingOverlay text="Loading schedule…" />
      ) : (
        <>
          {refreshing && <BoardLoadingOverlay text="Refreshing…" />}
          {filtered.length === 0 ? (
            <Empty
              description={
                filterDate ? "No tours on this date" : "No upcoming tours"
              }
              style={{ padding: 48 }}
            />
          ) : (
            <div
              style={{ padding: "0 4px", position: "relative", minHeight: 120 }}
            >
          <Card
            size="small"
            style={{ marginBottom: 16, borderRadius: 14 }}
            styles={{ body: { padding: "14px 18px" } }}
          >
            <Row gutter={[16, 16]} align="middle">
              <Col xs={24} md={14}>
                <Space direction="vertical" size={6}>
                  <Space wrap>
                    {isFilterToday && (
                      <Tag color="green" style={{ fontSize: 12 }}>
                        Today
                      </Tag>
                    )}
                    <Text strong style={{ fontSize: 17 }}>
                      {filterDate
                        ? filterDate.format("dddd, MMMM D, YYYY")
                        : "All upcoming tours"}
                    </Text>
                  </Space>
                  <Space wrap>
                    <CalendarOutlined style={{ color: token.colorPrimary }} />
                    <Text type="secondary">Filter by date:</Text>
                    <DatePicker
                      value={filterDate}
                      onChange={(d) => setFilterDate(d)}
                      allowClear
                      placeholder="All dates"
                      style={{ width: 200 }}
                      cellRender={renderDateCell}
                    />
                  </Space>
                </Space>
              </Col>
              <Col xs={24} md={10}>
                <Flex wrap gap={8} align="center" justify="flex-end">
                  <Switch
                    checkedChildren="Auto"
                    unCheckedChildren="Manual"
                    checked={filtered.every((a) => a.origin === "AUTO_ASSIGN")}
                    onChange={(auto) =>
                      setAllOrigin(auto ? "AUTO_ASSIGN" : "MANUAL")
                    }
                    title="Bật Auto-assign cho tất cả chuyến trên board"
                  />
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
                    {filtered.length} assignment
                    {filtered.length > 1 ? "s" : ""}
                  </Tag>
                  <Button
                    icon={<TeamOutlined />}
                    onClick={() => setCrewAvailOpen(true)}
                    style={{ borderRadius: 10 }}
                  >
                    Crew availability
                  </Button>
                  {canUpdateAssignment && filtered.some((a) => a.status === "PENDING") && (
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={dispatchingAll}
                      onClick={dispatchAllBuses}
                      style={{ borderRadius: 10 }}
                    >
                      Dispatch all
                    </Button>
                  )}
                </Flex>
              </Col>
            </Row>
          </Card>

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
                confirmingId={confirmingId}
                dispatchingId={dispatchingId}
                recallingId={recallingId}
                canConfirm={canUpdateAssignment}
                onConfirm={confirmTour}
                onDispatch={dispatchAssignment}
                onRecall={onRecall}
                onMoveBooking={moveBooking}
                onTemplate={openTemplate}
                onVerify={openVerify}
                onAdditions={setAdditionsTarget}
                crew={crew}
                onCrewChange={canUpdateAssignment ? changeCrew : undefined}
              />
              <BoardColumn
                meta={TYPE_META.PRIVATE_TOUR}
                items={privateItems}
                today={today}
                confirmingId={confirmingId}
                dispatchingId={dispatchingId}
                recallingId={recallingId}
                canConfirm={canUpdateAssignment}
                onConfirm={confirmTour}
                onDispatch={dispatchAssignment}
                onRecall={onRecall}
                onMoveBooking={moveBooking}
                onTemplate={openTemplate}
                onVerify={openVerify}
                onAdditions={setAdditionsTarget}
                crew={crew}
                onCrewChange={canUpdateAssignment ? changeCrew : undefined}
              />
              {otherItems.length > 0 && (
                <BoardColumn
                  meta={TYPE_META.OTHER}
                  items={otherItems}
                  today={today}
                  confirmingId={confirmingId}
                  dispatchingId={dispatchingId}
                  recallingId={recallingId}
                  canConfirm={canUpdateAssignment}
                  onConfirm={confirmTour}
                  onDispatch={dispatchAssignment}
                  onRecall={onRecall}
                  onMoveBooking={moveBooking}
                  onTemplate={openTemplate}
                  onAdditions={setAdditionsTarget}
                  crew={crew}
                  onCrewChange={canUpdateAssignment ? changeCrew : undefined}
                />
              )}
            </Row>
          </Card>

          <Alert
            type="info"
            showIcon
            icon={<CheckCircleOutlined />}
            message={<Text strong>Summary</Text>}
            description={
              <Row gutter={[12, 8]} style={{ marginTop: 8 }}>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Pending"
                    value={stats.pending}
                    valueStyle={{ fontSize: 18, color: "#faad14" }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Verifying"
                    value={stats.verifying}
                    valueStyle={{ fontSize: 18, color: "#722ed1" }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Group Tours"
                    value={stats.group}
                    valueStyle={{ fontSize: 18, color: "#1677ff" }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Private Tours"
                    value={stats.private}
                    valueStyle={{ fontSize: 18, color: "#722ed1" }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Other"
                    value={stats.other}
                    valueStyle={{ fontSize: 18, color: "#8c8c8c" }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Total"
                    value={stats.total}
                    valueStyle={{ fontSize: 18, color: token.colorPrimary }}
                  />
                </Col>
              </Row>
            }
            style={{ borderRadius: 12, marginTop: 16 }}
          />
        </div>
      )}
        </>
      )}

      <ConfirmFinishedModal
        assignment={finishing}
        open={!!finishing}
        onClose={() => setFinishing(null)}
        onDone={() => {
          loadBoard(true);
          onChanged?.();
        }}
      />
      <TourTemplateModal
        assignment={templateTarget}
        open={!!templateTarget}
        onClose={() => setTemplateTarget(null)}
      />
      <VerifyReportModal
        assignment={verifyTarget}
        open={!!verifyTarget}
        onClose={() => setVerifyTarget(null)}
        onDone={() => {
          loadBoard(true);
          onChanged?.();
        }}
      />
      <BookingAdditionsModal
        assignment={additionsTarget}
        open={!!additionsTarget}
        onClose={() => setAdditionsTarget(null)}
        onDone={() => {
          loadBoard(true);
          onChanged?.();
        }}
      />
      <CrewAvailabilityDrawer
        open={crewAvailOpen}
        onClose={() => setCrewAvailOpen(false)}
      />
      <Modal
        open={!!recalling}
        title="Recall dispatch"
        okText="Recall"
        okType="danger"
        cancelText="Keep dispatched"
        confirmLoading={!!recalling && recallingId === recalling.id}
        onOk={() => {
          if (recalling) {
            const target = recalling;
            setRecalling(null);
            recallAssignment(target);
          }
        }}
        onCancel={() => setRecalling(null)}
      >
        <p>
          Bus{" "}
          <Text strong>{recalling?.code ?? ""}</Text> has already been dispatched
          for more than the 7:00 cutoff — the guide may already be en route to
          pick up tourists.
        </p>
        <p style={{ marginBottom: 0 }}>
          Recalling returns the bus to <Text strong>PENDING</Text> so you can
          re-assign it. Driver and guide are notified of both the recall and any
          re-dispatch.
        </p>
      </Modal>
    </Drawer>
  );
}
