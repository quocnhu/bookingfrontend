"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Collapse,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { message } from "@/lib/antd-message";
import { DollarOutlined, RollbackOutlined, WarningOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp as useSession } from "@/lib/app-context";
import { useTourMoney, type MoneyRow } from "@/components/dispatch-board/use-tour-money";

const { Text } = Typography;

const fmtVnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));

export interface GuideBooking {
  id: string;
  bookingRef?: string | null;
  customerName?: string | null;
  totalPax?: number | null;
  notes?: string | null;
}

/** A money entry draft in the add form. */
interface Draft {
  bookingId?: string;
  direction: "COLLECT_MONEY" | "PAY_MONEY";
  amount: number | null;
  categoryId?: string;
  note: string;
}

/**
 * "Booking & money" table for guides: notes per passenger (allergies, pickup…)
 * plus the Collect / Refund entries linked to that booking. Every entry goes
 * through POST /assignments/:id/money so it flows automatically into the
 * Accounting Room money sheet.
 */
export default function GuideBookingsPanel({
  assignmentId,
  bookings,
  readOnlyNotes,
  onBookingsChanged,
}: {
  assignmentId: string;
  bookings: GuideBooking[];
  /** true = view notes only (driver / provider), no editing or money entries. */
  readOnlyNotes?: boolean;
  onBookingsChanged?: () => void;
}) {
  const { modal } = App.useApp();
  const { user } = useSession();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { money, loading, load: loadMoney, perBooking, addMoney, deleteMoney } =
    useTourMoney(assignmentId);

  // Notes saved on the server are the source of truth; in-progress edits live in `drafts`.
  const mergedNotes = useMemo(
    () => bookings.map((b) => ({ ...b, notes: drafts[b.id] ?? b.notes ?? "" })),
    [bookings, drafts],
  );

  const saveNote = async (booking: GuideBooking) => {
    const next = drafts[booking.id] ?? booking.notes ?? "";
    if (next.trim() === (booking.notes ?? "").trim()) {
      setDrafts((d) => {
        const next2 = { ...d };
        delete next2[booking.id];
        return next2;
      });
      return;
    }
    setSavingNote(booking.id);
    try {
      await api.put("/bookings/batch", {
        items: [{ id: booking.id, notes: next.trim() || null }],
      });
      setDrafts((d) => {
        const n = { ...d };
        delete n[booking.id];
        return n;
      });
      message.success("Note saved");
      onBookingsChanged?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not save the note"));
    } finally {
      setSavingNote(null);
    }
  };

  const openDraft = (booking: GuideBooking, direction: "COLLECT_MONEY" | "PAY_MONEY") => {
    if (money?.locked) {
      message.warning("Money for this trip has been locked by accounting, no new entries allowed.");
      return;
    }
    const fallback = (money?.categories ?? []).find((c) => c.flowType === direction);
    setDraft({
      bookingId: booking.id,
      direction,
      amount: null,
      categoryId: fallback?.id,
      note: "",
    });
  };

  const submitDraft = async () => {
    if (!draft) return;
    setSubmitting(true);
    const ok = await addMoney({
      direction: draft.direction,
      amount: draft.amount ?? 0,
      categoryId: draft.categoryId,
      note: draft.note,
      bookingId: draft.bookingId,
    });
    setSubmitting(false);
    if (ok) {
      setDraft(null);
      onBookingsChanged?.();
    }
  };

  const deleteRow = (row: MoneyRow) => {
    modal.confirm({
      title: "Delete this entry?",
      content:
        "The entry will be permanently removed from this trip's money sheet.",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        const ok = await deleteMoney(row.id);
        if (!ok) throw new Error("delete failed");
      },
    });
  };

  const columns: ColumnsType<GuideBooking> = [
    {
      title: "#",
      width: 40,
      render: (_, __, i) => <Text type="secondary">{i + 1}</Text>,
    },
    {
      title: "Customer",
      width: 190,
      render: (_, b) => (
        <Flex vertical gap={2}>
          <Text strong style={{ fontSize: 13 }}>
            {b.customerName ?? "No name"}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {b.bookingRef ?? "—"} · {b.totalPax ?? 0} pax
          </Text>
        </Flex>
      ),
    },
    {
      title: "Note (allergies, pickup…)",
      render: (_, b) =>
        readOnlyNotes ? (
          b.notes ? (
            <Tag color="gold" style={{ margin: 0 }}>
              {b.notes}
            </Tag>
          ) : (
            <Text type="secondary">—</Text>
          )
        ) : (
          <Input
            size="small"
            allowClear
            value={b.notes ?? ""}
            placeholder="e.g. seafood allergy, no spicy food…"
            onChange={(e) => setDrafts((d) => ({ ...d, [b.id]: e.target.value }))}
            onBlur={() => saveNote(b)}
            onPressEnter={() => saveNote(b)}
            suffix={
              savingNote === b.id ? (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  …
                </Text>
              ) : null
            }
          />
        ),
    },
    {
      title: "Passenger money",
      width: 150,
      render: (_, b) => {
        const v = perBooking.get(b.id);
        if (!v || (v.collected === 0 && v.paid === 0)) {
          return <Text type="secondary">—</Text>;
        }
        return (
          <Flex vertical gap={2}>
            {v.collected !== 0 && (
              <Text style={{ fontSize: 12, color: "#389e0d" }}>
                Collect {fmtVnd(v.collected)} ₫
              </Text>
            )}
            {v.paid !== 0 && (
              <Text style={{ fontSize: 12, color: "#cf1322" }}>
                Refund {fmtVnd(v.paid)} ₫
              </Text>
            )}
          </Flex>
        );
      },
    },
    {
      title: "",
      width: 190,
      render: (_, b) =>
        readOnlyNotes ? null : (
          <Flex gap={6}>
            <Button
              size="small"
              icon={<DollarOutlined />}
              disabled={money?.locked}
              onClick={() => openDraft(b, "COLLECT_MONEY")}
            >
              Collect
            </Button>
            <Button
              size="small"
              icon={<RollbackOutlined />}
              disabled={money?.locked}
              onClick={() => openDraft(b, "PAY_MONEY")}
            >
              Refund
            </Button>
          </Flex>
        ),
    },
  ];

  const categoryOptions = (money?.categories ?? [])
    .filter((c) => c.flowType === draft?.direction)
    .map((c) => ({ value: c.id, label: `${c.name} (${c.flowType === "COLLECT_MONEY" ? "Collect" : "Refund"})` }));

  const noteCount = mergedNotes.filter((b) => b.notes.trim().length > 0).length;

  return (
    <Flex vertical gap={10} style={{ marginTop: 12 }}>
      <Flex align="center" gap={8} wrap>
        <Text strong>
          Booking &amp; money ({bookings.length})
        </Text>
        {noteCount > 0 && (
          <Tag color="gold" style={{ margin: 0 }}>
            {noteCount} with notes
          </Tag>
        )}
        {money && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Collect {fmtVnd(money.collected)} ₫ · Refund {fmtVnd(money.paid)} ₫ ·{" "}
            <Text strong style={{ fontSize: 12 }}>
              {fmtVnd(money.net)} ₫ due to the company
            </Text>
          </Text>
        )}
        <Button size="small" onClick={() => void loadMoney()} loading={loading}>
          Refresh
        </Button>
      </Flex>

      {money?.locked && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`Money for this trip has been locked${money.lockedBy ? ` by ${money.lockedBy}` : ""}. Read-only, no adding/editing entries.`}
        />
      )}

      <Table<GuideBooking>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={mergedNotes}
        pagination={false}
        scroll={{ x: 720 }}
      />

      <Collapse
        size="small"
        items={[
          {
            key: "entries",
            label: `Recorded entries (${(money?.rows ?? []).length})`,
            children: (
              <Table<MoneyRow>
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={money?.rows ?? []}
                columns={[
                  {
                    title: "Category",
                    dataIndex: ["category", "name"],
                    width: 180,
                    render: (v?: string | null) => v ?? "—",
                  },
                  {
                    title: "Booking",
                    width: 170,
                    render: (_, r) =>
                      mergedNotes.find((b) => b.id === r.bookingId)?.customerName ??
                      (r.bookingId ? "—" : "Whole trip"),
                  },
                  {
                    title: "Note",
                    dataIndex: "note",
                    render: (v?: string | null) => v ?? "—",
                  },
                  {
                    title: "Recorded by",
                    width: 130,
                    render: (_, r) => r.createdByName ?? "—",
                  },
                  {
                    title: "Amount",
                    width: 130,
                    align: "right",
                    render: (_, r) => (
                      <Text
                        style={{
                          fontSize: 12,
                          color:
                            (r.category?.flowType ?? "PAY_MONEY") === "COLLECT_MONEY"
                              ? "#389e0d"
                              : "#cf1322",
                        }}
                      >
                        {r.amount < 0 ? "−" : ""}
                        {fmtVnd(Math.abs(r.amount))} ₫
                      </Text>
                    ),
                  },
                  {
                    title: "",
                    width: 90,
                    render: (_, r) => {
                      if (money?.locked) return null;
                      if (r.reversesId) return null;
                      if (user?.role !== "ADMIN" && r.createdById && user && r.createdById !== user.id) return null;
                      return (
                        <Tooltip title="Delete this line permanently">
                          <Button size="small" type="text" danger onClick={() => deleteRow(r)}>
                            Delete
                          </Button>
                        </Tooltip>
                      );
                    },
                  },
                ]}
              />
            ),
          },
        ]}
      />

      <Modal
        open={!!draft}
        title={
          draft?.direction === "COLLECT_MONEY"
            ? "Record money collected from passengers"
            : "Record money refunded to passengers"
        }
        okText="Save"
        cancelText="Cancel"
        confirmLoading={submitting}
        onOk={submitDraft}
        onCancel={() => setDraft(null)}
        destroyOnHidden
      >
        <Flex vertical gap={12} style={{ marginTop: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            This entry will be linked to booking{" "}
            <Text strong>
              {mergedNotes.find((b) => b.id === draft?.bookingId)?.customerName ?? ""}
            </Text>{" "}
            and shown in the trip's money sheet, where accounting will re-check it.
          </Typography.Text>
          <InputNumber
            addonBefore="₫"
            style={{ width: "100%" }}
            size="large"
            min={0}
            step={10000}
            placeholder="Amount"
            value={draft?.amount ?? null}
            onChange={(v) => setDraft((d) => (d ? { ...d, amount: v as number | null } : d))}
          />
          <Select
            style={{ width: "100%" }}
            placeholder="Category"
            value={draft?.categoryId}
            options={categoryOptions}
            onChange={(v) => setDraft((d) => (d ? { ...d, categoryId: v } : d))}
          />
          <Input
            allowClear
            placeholder="Money note (e.g. customer lent cash, extras fee…)"
            value={draft?.note ?? ""}
            onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))}
          />
        </Flex>
      </Modal>
    </Flex>
  );
}
