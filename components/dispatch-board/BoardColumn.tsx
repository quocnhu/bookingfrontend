"use client";

import { Col, Empty, Tag, theme as antdTheme } from "antd";
import type { Dayjs } from "dayjs";
import type { BoardItem, TourMeta } from "./types";
import BoardCard from "./BoardCard";

export default function BoardColumn({
  meta,
  items,
  today,
  confirmingId,
  dispatchingId,
  canConfirm,
  onConfirm,
  onDispatch,
  onMoveBooking,
  onTemplate,
}: {
  meta: TourMeta;
  items: BoardItem[];
  today: Dayjs;
  confirmingId: string | null;
  dispatchingId: string | null;
  canConfirm: boolean;
  onConfirm: (assignment: BoardItem) => void;
  onDispatch: (assignment: BoardItem) => void;
  onMoveBooking: (
    bookingId: string,
    toAssignmentId: string,
    beforeBookingId?: string | null,
  ) => void;
  onTemplate: (assignment: BoardItem) => void;
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
            canConfirm={canConfirm}
            onConfirm={onConfirm}
            onDispatch={onDispatch}
            onMoveBooking={onMoveBooking}
            onTemplate={onTemplate}
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
