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
  Row,
  Space,
  Statistic,
  Switch,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { message } from "@/lib/antd-message";
import type { DatePickerProps } from "antd";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  SendOutlined,
  ScheduleOutlined,
  SyncOutlined,
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
import { useSocket } from "@/lib/use-socket";

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
  const { on } = useSocket();

  const [boardData, setBoardData] = useState<BoardItem[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [crew, setCrew] = useState<BoardCrew>({ guides: [], drivers: [] });
  const [confirmingId] = useState<string | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<BoardItem | null>(null);
  const [templateTarget, setTemplateTarget] = useState<BoardItem | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<BoardItem | null>(null);
  const [filterDate, setFilterDate] = useState<Dayjs>(() => dayjs().add(7, "hour").startOf("day"));
  const [additionsTarget, setAdditionsTarget] = useState<BoardItem | null>(null);
  const [crewAvailOpen, setCrewAvailOpen] = useState(false);
  const [autoAssign, setAutoAssign] = useState(false);

  const loadBoard = useCallback((background = false) => {
    if (background) setRefreshing(true);
    else setBoardLoading(true);
    api
      .get("/assignments/board")
      .then((r) => {
        const data: BoardItem[] = r.data ?? [];
        console.log('[DispatchBoard] API returned:', data.map(a => ({
          id: a.id,
          code: a.code,
          tourName: a.tourName,
          startDate: a.startDate,
          endDate: a.endDate,
          status: a.status,
          tourType: a.tourType,
          totalPax: a.totalPax,
          guide: a.guide?.name,
          driver: a.driver?.name,
          bookings: a.bookings?.length
        })));
        console.log('[DispatchBoard] Filter date:', dayjs().format('YYYY-MM-DD'));
        setBoardData(data);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load board")))
      .finally(() => {
        setBoardLoading(false);
        setRefreshing(false);
      });
  }, []);

  // Real-time board updates via WebSocket
  useEffect(() => {
    const cleanup = on('board:refresh', () => {
      console.log('[DispatchBoard] Real-time refresh triggered');
      loadBoard(true);
    });
    return cleanup;
  }, [on, loadBoard]);

  useEffect(() => {
    if (open) {
      setFilterDate(dayjs().startOf("day"));
      loadBoard();
      api
        .get("/assignments/board/mode")
        .then((r) => setAutoAssign(r.data?.mode === "AUTO_ASSIGN"))
        .catch(() => {});
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

  const openReject = (assignment: BoardItem) => {
    // We'll use the same modal but with a different action
    // For now, we'll just use a simple confirm with message
    // In a more complete implementation, this would open a modal with a message input
    // For now, we'll use the browser's prompt for simplicity
    const message = prompt("Enter rejection reason (required):");
    if (!message?.trim()) {
      message?.trim() ? null : message === null || alert("Rejection reason is required");
      return;
    }
    rejectTourReport(assignment.id, message.trim());
  };

  const rejectTourReport = async (id: string, reason: string) => {
    try {
      await api.put(`/assignments/${id}/tour-report/verify`, {
        status: "REJECTED",
        verificationNotes: reason,
      });
      message.success("Report rejected — guide can resubmit");
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to reject report"));
    }
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
    // Server-enforced: recall is blocked after the 06:30 cutoff on the
    // departure day. Before that we recall immediately.
    recallAssignment(assignment);
  };

  const [dispatchingAll, setDispatchingAll] = useState(false);

  const dispatchAllBuses = async () => {
    setDispatchingAll(true);
    try {
      const r = await api.post(`/assignments/board/dispatch-all`);
      const dispatched = r.data?.dispatched ?? 0;
      const skipped = r.data?.skipped ?? 0;
      const skippedOnLeave = r.data?.skippedOnLeave ?? 0;
      const skipNotes = [
        skipped > 0 ? `${skipped} no guide/driver` : "",
        skippedOnLeave > 0 ? `${skippedOnLeave} crew on leave` : "",
      ]
        .filter(Boolean)
        .join(", ");
      if (dispatched > 0) {
        message.success(
          `Dispatched ${dispatched} bus(es)` +
            (skipNotes ? ` — skipped: ${skipNotes}` : ""),
        );
        loadBoard(true);
        onChanged?.();
      } else if (skipNotes) {
        message.warning(`No bus dispatched — skipped: ${skipNotes}`);
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
      const { data } = await api.put(`/assignments/board/origin`, { origin });
      // Sync the switch with what the server actually persisted.
      setAutoAssign((data?.mode ?? origin) === "AUTO_ASSIGN");
      message.success(
        `Switched to ${origin === "AUTO_ASSIGN" ? "Auto-assign" : "Manual"}`,
      );
      loadBoard(true);
      onChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to update assignment origins"));
      // Revert the switch to the persisted mode on failure.
      api
        .get("/assignments/board/mode")
        .then((r) => setAutoAssign(r.data?.mode === "AUTO_ASSIGN"))
        .catch(() => {});
    }
  };

  const moveBooking = async (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
    position: "before" | "after" = "before",
  ) => {
    const source = boardData.find((a) =>
      a.bookings?.some((b) => b.id === bookingId),
    );
    const target = boardData.find((a) => a.id === toAssignmentId);
    const booking = source?.bookings?.find((b) => b.id === bookingId);
    // These used to return silently, so a stale/unknown id looked exactly like
    // drag-and-drop being broken. Say what went wrong instead.
    if (!bookingId || !source || !target) {
      message.error(
        !bookingId
          ? "Could not read the dragged assignment - try again"
          : !source
            ? "That assignment is no longer on the board - refresh and retry"
            : "That bus is no longer on the board - refresh and retry",
      );
      loadBoard(true);
      return;
    }

    // Check if booking's tour matches target assignment's tour
    if (booking?.tourType && target.tourType && booking.tourType !== target.tourType) {
      message.error(
        `Cannot move booking to a bus with a different tour. Booking tour: ${booking.tourType}, Target bus tour: ${target.tourType}`,
      );
      loadBoard(true);
      return;
    }

    const sameBus = source.id === toAssignmentId;
    const key = `dd-${bookingId}`;
    message.loading({ content: "Updating bus…", key });

    const insertAt = (order: string[]) => {
      const without = order.filter((id) => id !== bookingId);
      if (beforeBookingId) {
        const at = without.indexOf(beforeBookingId);
        // "after" = insert directly below the anchor; "before" = directly above it.
        if (at === -1) without.push(bookingId);
        else without.splice(position === "after" ? at + 1 : at, 0, bookingId);
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
    () => {
      const result = boardData.filter((a) => {
        // Only show tours whose DEPARTURE (start) date matches the selected
        // date. Multi-day tours are shown only on the day they start, so the
        // board for today never lists buses from previous days.
        const start = dayjs(a.startDate).add(7, "hour").startOf("day");
        return start.isSame(filterDate.startOf("day"));
      });
      console.log('[DispatchBoard] Filtered:', result.map(a => ({ code: a.code, startDate: a.startDate, filterDate: filterDate.format('YYYY-MM-DD') })));
      return result;
    },
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
      const start = dayjs(a.startDate).add(7, "hour");
      dates.add(start.format("YYYY-MM-DD"));
    }
    return dates;
  }, [boardData]);
  const today = dayjs().add(7, "hour").startOf("day");
  const isFilterToday = filterDate.startOf("day").isSame(today);
  // The backend preloads trips from 30 days back to 90 days ahead
  // (BOARD_LOOKBACK_DAYS in assignments.service.ts). Picking a date outside that
  // window would show "No tours on this date" even when trips exist → block it.
  const minLoadedDate = today.subtract(30, "day");
  const maxLoadedDate = today.add(90, "day");
  const isOutsideLoadedWindow = (d: Dayjs) =>
    d.startOf("day").isBefore(minLoadedDate) ||
    d.startOf("day").isAfter(maxLoadedDate);

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
    const isSelected = dateStr === filterDate.format("YYYY-MM-DD");
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
      size="100%"
      destroyOnClose
    >
      {boardLoading && filtered.length === 0 ? (
        <BoardLoadingOverlay text="Loading schedule…" />
      ) : (
        <>
          {refreshing && <BoardLoadingOverlay text="Refreshing…" />}
          {filtered.length === 0 ? (
            <Empty
              description="No tours on this date"
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
                      {filterDate.format("dddd, MMMM D, YYYY")}
                    </Text>
                  </Space>
                  <Space wrap>
                    <CalendarOutlined style={{ color: token.colorPrimary }} />
                    <Text type="secondary">Filter by date:</Text>
                    <DatePicker
                      value={filterDate}
                      onChange={(d) => {
                        if (d) setFilterDate(d);
                      }}
                      allowClear={false}
                      disabledDate={isOutsideLoadedWindow}
                      placeholder="Select a date"
                      style={{ width: 200 }}
                      cellRender={renderDateCell}
                      picker="date"
                      format="YYYY-MM-DD"
                    />
                  </Space>
                </Space>
              </Col>
              <Col xs={24} md={10}>
                <Flex wrap gap={8} align="center" justify="flex-end">
                  <Switch
                    checkedChildren="Auto"
                    unCheckedChildren="Manual"
                    checked={autoAssign}
                    onChange={(auto) => {
                      setAllOrigin(auto ? "AUTO_ASSIGN" : "MANUAL");
                    }}
                    title={
                      autoAssign
                        ? "Auto-assign is ON — new bookings are grouped onto buses automatically"
                        : "Manual mode — new bookings stay pending for hand assignment"
                    }
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
                onReject={openReject}
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
                onReject={openReject}
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
                  onVerify={openVerify}
                  onReject={openReject}
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
                    title="Group Tours"
                    value={stats.group}
                    styles={{ content: { fontSize: 18, color: "#1677ff" } }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Private Tours"
                    value={stats.private}
                    styles={{ content: { fontSize: 18, color: "#722ed1" } }}
                  />
                </Col>
                <Col xs={12} sm={4}>
                  <Statistic
                    title="Other"
                    value={stats.other}
                    styles={{ content: { fontSize: 18, color: "#8c8c8c" } }}
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
    </Drawer>
  );
}
