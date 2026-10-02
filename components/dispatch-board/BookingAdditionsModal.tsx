"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Flex,
  Input,
  Modal,
  Table,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import type { ColumnsType } from "antd/es/table";
import { App, InputNumber, Select, Tooltip } from "antd";
import { DollarOutlined, RollbackOutlined, WarningOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useTourMoney } from "./use-tour-money";
import type { BoardItem } from "./types";

const { Text } = Typography;

const fmtVnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));

interface RowState {
  id: string;
  busCode?: string | null;
  customerName?: string;
  bookingRef?: string;
  totalPax?: number;
  notes: string;
}

interface Draft {
  bookingId: string;
  direction: "COLLECT_MONEY" | "PAY_MONEY";
  amount: number | null;
  categoryId?: string;
  note: string;
}

export default function BookingAdditionsModal({
  open,
  assignment,
  onClose,
  onDone,
}: {
  open: boolean;
  assignment: BoardItem | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);

  const { money, loading: moneyLoading, load: loadMoney, perBooking, addMoney } =
    useTourMoney(open ? assignment?.id : null);

  // Check if booking details are locked (tour report submitted for verification)
  const isLocked = assignment?.tourReport?.locked === true;

  useEffect(() => {
    if (!open || !assignment) return;
    const list: RowState[] = [];
    for (const b of assignment.bookings ?? []) {
      list.push({
        id: b.id,
        busCode: assignment.code,
        customerName: b.customerName,
        bookingRef: b.bookingRef,
        totalPax: b.totalPax,
        notes: b.notes ?? "",
      });
    }
    setRows(list);
  }, [open, assignment]);

  const patch = (id: string, p: Partial<RowState>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const save = async () => {
    if (isLocked) {
      message.warning(
        "This trip's details are locked because the tour report has been submitted for verification. Only accounting can unlock it by rejecting the report.",
      );
      return;
    }
    setSaving(true);
    try {
      await api.put("/bookings/batch", {
        items: rows.map((r) => ({
          id: r.id,
          notes: r.notes.trim() || null,
        })),
      });
      message.success(`Saved ${rows.length} booking(s)`);
      await loadMoney();
      onDone?.();
      onClose();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save booking details"));
    } finally {
      setSaving(false);
    }
  };

  const withNotes = useMemo(() => rows.filter((r) => r.notes.trim()).length, [rows]);

  const openDraft = (r: RowState, direction: "COLLECT_MONEY" | "PAY_MONEY") => {
    if (money?.locked) {
      message.warning(
        "This trip's money has been locked by accounting - no new entries can be added.",
      );
      return;
    }
    if (isLocked) {
      message.warning(
        "This trip's details are locked because the tour report has been submitted for verification. Only accounting can unlock it by rejecting the report.",
      );
      return;
    }
    const fallback = (money?.categories ?? []).find((c) => c.flowType === direction);
    setDraft({
      bookingId: r.id,
      direction,
      amount: null,
      categoryId: fallback?.id,
      note: "",
    });
  };

  const submitDraft = async () => {
    if (!draft) return;
    setDraftBusy(true);
    const ok = await addMoney({
      direction: draft.direction,
      amount: draft.amount ?? 0,
      categoryId: draft.categoryId,
      note: draft.note,
      bookingId: draft.bookingId,
    });
    setDraftBusy(false);
    if (ok) {
      setDraft(null);
      onDone?.();
    }
  };

  const categoryOptions = (money?.categories ?? [])
    .filter((c) => c.flowType === draft?.direction)
    .map((c) => ({
      value: c.id,
      label: `${c.name} (${c.flowType === "COLLECT_MONEY" ? "Collect" : "Expense"})`,
    }));

  const draftCustomer = rows.find((r) => r.id === draft?.bookingId)?.customerName ?? "";

  const columns: ColumnsType<RowState> = [
    {
      title: "Bus",
      dataIndex: "busCode",
      key: "busCode",
      width: 130,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v ?? "—"}</Text>,
    },
    {
      title: "Customer",
      dataIndex: "customerName",
      key: "customerName",
      width: 170,
      render: (v, r) => (
        <Flex vertical gap={2}>
          <Text style={{ fontSize: 12 }}>{v || "no name"}</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {r.bookingRef || "—"} · {r.totalPax ?? 0} pax
          </Text>
        </Flex>
      ),
    },
    {
      title: "Note",
      dataIndex: "notes",
      key: "notes",
      render: (v: string, r) => (
        <Input
          value={v}
          onChange={isLocked ? undefined : (e) => patch(r.id, { notes: e.target.value })}
          placeholder="Diet, entry place, special instructions..."
          size="small"
          allowClear
          disabled={isLocked}
        />
      ),
    },
    {
      title: "Collect / Refund 💰",
      key: "cash",
      width: 180,
      render: (_: unknown, r) => {
        const v = perBooking.get(r.id);
        if (!v || (v.collected === 0 && v.paid === 0)) {
          return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
        }
        return (
          <Flex vertical gap={2}>
            {v.collected !== 0 && (
              <Text style={{ fontSize: 11, color: "#389e0d", fontWeight: 600 }}>
                💵 Collect {fmtVnd(v.collected)}
              </Text>
            )}
            {v.paid !== 0 && (
              <Text style={{ fontSize: 11, color: "#cf1322", fontWeight: 600 }}>
                ↩️ Refund {fmtVnd(v.paid)}
              </Text>
            )}
          </Flex>
        );
      },
    },
    {
      title: "",
      key: "cashActions",
      width: 170,
      render: (_: unknown, r) => (
        <Flex gap={6}>
          <Tooltip title="Record money collected from this passenger">
            <Button
              size="small"
              icon={<DollarOutlined />}
              disabled={money?.locked || isLocked}
              onClick={() => openDraft(r, "COLLECT_MONEY")}
            >
              Collect
            </Button>
          </Tooltip>
          <Tooltip title="Record money refunded to this passenger">
            <Button
              size="small"
              icon={<RollbackOutlined />}
              disabled={money?.locked || isLocked}
              onClick={() => openDraft(r, "PAY_MONEY")}
            >
              Refund
            </Button>
          </Tooltip>
        </Flex>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={save}
      okText={`Save (${rows.length} bookings)`}
      confirmLoading={saving}
      width={860}
      title={
        assignment
          ? `Booking details — ${assignment.code} (${assignment.bookings?.length ?? 0} bookings)`
          : "Booking details"
      }
    >
      <Flex justify="space-between" align="center" gap={12} wrap style={{ marginBottom: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {withNotes} booking(s) have notes. Notes show a gold icon on the board
          and are visible to the crew.
        </Text>
        {money && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Collect <Text strong style={{ fontSize: 12, color: "#389e0d" }}>{fmtVnd(money.collected)}</Text>{" "}
            · Refund <Text strong style={{ fontSize: 12, color: "#cf1322" }}>{fmtVnd(money.paid)}</Text>{" "}
            · <Text strong style={{ fontSize: 12 }}>{fmtVnd(money.net)} left for the company</Text>
          </Text>
        )}
      </Flex>

      {money?.locked && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            border: "1px solid #ffe58f",
            background: "#fffbe6",
            borderRadius: 6,
            fontSize: 12,
            color: "#ad6800",
          }}
        >
          <WarningOutlined style={{ marginRight: 6 }} />
          This trip's money is locked{money.lockedBy ? ` by ${money.lockedBy}` : ""}. Read-only,
          no adding or editing entries.
        </div>
      )}

      {isLocked && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            border: "1px solid #ffccc7",
            background: "#fff1f0",
            borderRadius: 6,
            fontSize: 12,
            color: "#cf1322",
          }}
        >
          <WarningOutlined style={{ marginRight: 6 }} />
          This trip's details are <strong>locked</strong> — the tour report has been submitted for
          accounting verification. Notes and collect/refund entries are disabled. Only accounting
          can unlock by rejecting the report.
        </div>
      )}
      {rows.length === 0 ? (
        <Text type="secondary" style={{ padding: "24px 0", display: "block" }}>
          No bookings on this bus.
        </Text>
      ) : (
        <Table
          style={{ marginTop: 12 }}
          size="small"
          rowKey="id"
          pagination={false}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 800 }}
          loading={moneyLoading}
        />
      )}

      <Modal
        open={!!draft}
        title={
          draft?.direction === "COLLECT_MONEY"
            ? "Record money collected from the passenger"
            : "Record money refunded to the passenger"
        }
        okText="Save"
        cancelText="Cancel"
        confirmLoading={draftBusy}
        onOk={submitDraft}
        onCancel={() => setDraft(null)}
        destroyOnHidden
      >
        <Flex vertical gap={12} style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            This entry is linked to booking{" "}
            <Text strong>{draftCustomer}</Text> and appears in the trip's money
            sheet; accounting will review it.
          </Text>
          <InputNumber
            addonBefore="₫"
            style={{ width: "100%" }}
            size="large"
            min={0}
            step={10000}
            placeholder="Amount"
            value={draft?.amount ?? null}
            onChange={(v) =>
              setDraft((d) => (d ? { ...d, amount: v as number | null } : d))
            }
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
            placeholder="Note for this entry (e.g. passenger handed over cash, ticket fees…)"
            value={draft?.note ?? ""}
            onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))}
          />
        </Flex>
      </Modal>
    </Modal>
  );
}