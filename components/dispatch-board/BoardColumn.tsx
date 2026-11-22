"use client";

import { Col, Empty, Tag, theme as antdTheme } from "antd";
import type { Dayjs } from "dayjs";
import type { BoardCrew, BoardItem, TourMeta } from "./types";
import BoardCard from "./BoardCard";

const BUCKETS: Array<{
  key: NonNullable<BoardItem["departureBucket"]>;
  label: string;
  color: string;
}> = [
  { key: "MORNING", label: "Morning", color: "#fa8c16" },
  { key: "AFTERNOON", label: "Afternoon", color: "#1677ff" },
  { key: "EVENING", label: "Evening", color: "#722ed1" },
  { key: "UNSCHEDULED", label: "No departure time", color: "#8c8c8c" },
];

function renderItems(props: {
  items: BoardItem[];
  groupByDeparture?: boolean;
  meta: TourMeta;
  today: Dayjs;
  confirmingId: string | null;
  dispatchingId: string | null;
  recallingId: string | null;
  canConfirm: boolean;
  recallCutoff?: string;
  readOnly?: boolean;
  sealed?: boolean;
  onConfirm: (assignment: BoardItem) => void;
  onDispatch: (assignment: BoardItem) => void;
  onRecall: (assignment: BoardItem) => void;
  onMoveBooking: (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
  ) => void;
  onTemplate?: (assignment: BoardItem) => void;
  onVerify?: (assignment: BoardItem) => void;
  onReject?: (assignment: BoardItem) => void;
  onAdditions?: (assignment: BoardItem) => void;
  onPartnerHandoff?: (assignment: BoardItem) => void;
  onPartnerReturn?: (assignment: BoardItem) => void;
  crew?: BoardCrew;
  onCrewChange?: (
    assignment: BoardItem,
    field: "guideId" | "driverId",
    userId: string | null,
  ) => void;
  reminderModeSavingId?: string | null;
  reminderSendingId?: string | null;
  onReminderModeChange?: (
    assignment: BoardItem,
    mode: "AUTO" | "MANUAL",
  ) => void;
  onSendReminder?: (assignment: BoardItem) => void;
}) {
  const card = (a: BoardItem, idx: number) => (
    <BoardCard
      key={a.id}
      assignment={a}
      index={idx}
      meta={props.meta}
      today={props.today}
      confirming={props.confirmingId === a.id}
      dispatching={props.dispatchingId === a.id}
      recalling={props.recallingId === a.id}
      canConfirm={props.canConfirm}
      recallCutoff={props.recallCutoff}
      readOnly={props.readOnly}
      sealed={props.sealed}
      onConfirm={props.onConfirm}
      onDispatch={props.onDispatch}
      onRecall={props.onRecall}
      onMoveBooking={props.onMoveBooking}
      onTemplate={props.onTemplate}
      onVerify={props.onVerify}
      onReject={props.onReject}
      onAdditions={props.onAdditions}
      onPartnerHandoff={props.onPartnerHandoff}
      onPartnerReturn={props.onPartnerReturn}
      crew={props.crew}
      onCrewChange={props.onCrewChange}
      reminderModeSavingId={props.reminderModeSavingId}
      reminderSendingId={props.reminderSendingId}
      onReminderModeChange={props.onReminderModeChange}
      onSendReminder={props.onSendReminder}
    />
  );

  if (!props.groupByDeparture) {
    return props.items.map((a, idx) => card(a, idx));
  }

  let index = 0;
  return (
    <>
      {BUCKETS.map((bucket) => {
        const bucketItems = props.items.filter(
          (a) =>
            (a.departureBucket ?? "UNSCHEDULED") === bucket.key,
        );
        if (bucketItems.length === 0) return null;
        return (
          <div key={bucket.key} style={{ marginBottom: 6 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                margin: "4px 0 8px",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: bucket.color,
                  display: "inline-block",
                }}
              />
              <Tag
                style={{
                  margin: 0,
                  border: "none",
                  background: `${bucket.color}18`,
                  color: bucket.color,
                  fontWeight: 600,
                  fontSize: 11,
                }}
              >
                {bucket.label}
              </Tag>
              <span style={{ fontSize: 11, color: "#8c8c8c" }}>
                {bucketItems.length}
              </span>
            </div>
            {bucketItems.map((a) => card(a, index++))}
          </div>
        );
      })}
    </>
  );
}

export default function BoardColumn({
  meta,
  items,
  today,
  confirmingId,
  dispatchingId,
  recallingId,
  canConfirm,
  recallCutoff,
  readOnly,
  sealed,
  groupByDeparture,
  onConfirm,
  onDispatch,
  onRecall,
  onMoveBooking,
  onTemplate,
  onVerify,
  onReject,
  onAdditions,
  onPartnerHandoff,
  onPartnerReturn,
  crew,
  onCrewChange,
  reminderModeSavingId,
  reminderSendingId,
  onReminderModeChange,
  onSendReminder,
}: {
  meta: TourMeta;
  items: BoardItem[];
  today: Dayjs;
  confirmingId: string | null;
  dispatchingId: string | null;
  recallingId: string | null;
  canConfirm: boolean;
  recallCutoff?: string;
  readOnly?: boolean;
  sealed?: boolean;
  groupByDeparture?: boolean;
  onConfirm: (assignment: BoardItem) => void;
  onDispatch: (assignment: BoardItem) => void;
  onRecall: (assignment: BoardItem) => void;
  onMoveBooking: (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
  ) => void;
  onTemplate?: (assignment: BoardItem) => void;
  onVerify?: (assignment: BoardItem) => void;
  onReject?: (assignment: BoardItem) => void;
  onAdditions?: (assignment: BoardItem) => void;
  onPartnerHandoff?: (assignment: BoardItem) => void;
  onPartnerReturn?: (assignment: BoardItem) => void;
  crew?: BoardCrew;
  onCrewChange?: (
    assignment: BoardItem,
    field: "guideId" | "driverId",
    userId: string | null,
  ) => void;
  reminderModeSavingId?: string | null;
  reminderSendingId?: string | null;
  onReminderModeChange?: (
    assignment: BoardItem,
    mode: "AUTO" | "MANUAL",
  ) => void;
  onSendReminder?: (assignment: BoardItem) => void;
}) {
  const { token } = antdTheme.useToken();

  return (
    <Col xs={24} lg={12}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            borderRadius: 999,
            background: `${meta.accent}1a`,
            color: meta.accent,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {meta.label} Tours
        </span>
        <Tag
          style={{
            margin: 0,
            borderRadius: 999,
            background: token.colorFillSecondary,
            border: "none",
            fontWeight: 600,
          }}
        >
          {items.length}
        </Tag>
      </div>
      {items.length ? (
        renderItems({
          items,
          groupByDeparture,
          meta,
          today,
          confirmingId,
          dispatchingId,
          recallingId,
          canConfirm,
          recallCutoff,
          readOnly,
          sealed,
          onConfirm,
          onDispatch,
          onRecall,
          onMoveBooking,
          onTemplate,
          onVerify,
          onReject,
          onAdditions,
          onPartnerHandoff,
          onPartnerReturn,
          crew,
          onCrewChange,
          reminderModeSavingId,
          reminderSendingId,
          onReminderModeChange,
          onSendReminder,
        })
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${meta.label.toLowerCase()} tours`}
          style={{ padding: "24px 0" }}
        />
      )}
    </Col>
  );
}