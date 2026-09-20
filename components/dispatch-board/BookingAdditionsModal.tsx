"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Flex,
  Input,
  InputNumber,
  Modal,
  Table,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { api, getErrorMessage } from "@/lib/api";
import type { BoardItem } from "./types";

const { Text } = Typography;

interface RowState {
  id: string;
  busCode?: string | null;
  customerName?: string;
  bookingRef?: string;
  totalPax?: number;
  notes: string;
  collect: number;
  refund: number;
}

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

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
        collect: Number(b.collectAmount ?? 0),
        refund: Number(b.refundAmount ?? 0),
      });
    }
    setRows(list);
  }, [open, assignment]);

  const patch = (id: string, p: Partial<RowState>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/bookings/batch", {
        items: rows.map((r) => ({
          id: r.id,
          notes: r.notes.trim() || null,
          collectAmount: r.collect || null,
          refundAmount: r.refund || null,
        })),
      });
      message.success(`Saved ${rows.length} booking(s)`);
      onDone?.();
      onClose();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save booking details"));
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(
    () => ({
      collect: rows.reduce((s, r) => s + r.collect, 0),
      refund: rows.reduce((s, r) => s + r.refund, 0),
      withAdditions: rows.filter(
        (r) => r.notes.trim() || r.collect > 0 || r.refund > 0,
      ).length,
    }),
    [rows],
  );

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
          onChange={(e) => patch(r.id, { notes: e.target.value })}
          placeholder="Diet, entry place, collect/refund instructions..."
          size="small"
          allowClear
        />
      ),
    },
    {
      title: "Collect $",
      dataIndex: "collect",
      key: "collect",
      width: 130,
      render: (v: number, r) => (
        <InputNumber
          min={0}
          precision={2}
          value={v}
          onChange={(x) => patch(r.id, { collect: Number(x ?? 0) })}
          style={{ width: "100%" }}
          addonBefore="$"
          size="small"
        />
      ),
    },
    {
      title: "Refund $",
      dataIndex: "refund",
      key: "refund",
      width: 130,
      render: (v: number, r) => (
        <InputNumber
          min={0}
          precision={2}
          value={v}
          onChange={(x) => patch(r.id, { refund: Number(x ?? 0) })}
          style={{ width: "100%" }}
          addonBefore="$"
          size="small"
        />
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
      <Text type="secondary" style={{ fontSize: 12 }}>
        {totals.withAdditions} booking(s) have notes/collect/refund. These sync
        automatically to the Confirm Finished modal and show a gold icon on the
        board.
      </Text>
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
          scroll={{ x: 680 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={3}>
                <Text strong>Totals</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1}>
                <Text strong>{usd(totals.collect)}</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2}>
                <Text strong type="danger">{usd(totals.refund)}</Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      )}
    </Modal>
  );
}