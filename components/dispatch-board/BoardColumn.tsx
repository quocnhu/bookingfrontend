"use client";

import { Col, Empty, Tag, theme as antdTheme } from "antd";
import type { Dayjs } from "dayjs";
import type { BoardCrew, BoardItem, TourMeta } from "./types";
import BoardCard from "./BoardCard";

export default function BoardColumn({
  meta,
  items,
  today,
  confirmingId,
  dispatchingId,
  recallingId,
  canConfirm,
  onConfirm,
  onDispatch,
  onRecall,
  onMoveBooking,
  onTemplate,
  onVerify,
  onAdditions,
  crew,
  onCrewChange,
}: {
  meta: TourMeta;
  items: BoardItem[];
  today: Dayjs;
  confirmingId: string | null;
  dispatchingId: string | null;
  recallingId: string | null;
  canConfirm: boolean;
  onConfirm: (assignment: BoardItem) => void;
  onDispatch: (assignment: BoardItem) => void;
  onRecall: (assignment: BoardItem) => void;
  onMoveBooking: (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
  ) => void;
  onTemplate: (assignment: BoardItem) => void;
  onVerify?: (assignment: BoardItem) => void;
  onAdditions?: (assignment: BoardItem) => void;
  crew?: BoardCrew;
  onCrewChange?: (
    assignment: BoardItem,
    field: "guideId" | "driverId",
    userId: string | null,
  ) => void;
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
        items.map((a, idx) => (
          <BoardCard
            key={a.id}
            assignment={a}
            index={idx}
            meta={meta}
            today={today}
            confirming={confirmingId === a.id}
            dispatching={dispatchingId === a.id}
            recalling={recallingId === a.id}
            canConfirm={canConfirm}
            onConfirm={onConfirm}
            onDispatch={onDispatch}
            onRecall={onRecall}
onMoveBooking={onMoveBooking}
              onTemplate={onTemplate}
              onVerify={onVerify}
              onAdditions={onAdditions}
              crew={crew}
              onCrewChange={onCrewChange}
          />
        ))
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