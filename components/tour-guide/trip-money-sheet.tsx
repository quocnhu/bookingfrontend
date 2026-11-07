"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Flex,
  Input,
  InputNumber,
  Select,
  Spin,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { message } from "@/lib/antd-message";
import { useApp as useSession } from "@/lib/app-context";
import {
  useTourMoney,
  type MoneyRow,
} from "@/components/dispatch-board/use-tour-money";

const { Text } = Typography;

const fmtVnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );

function TagBox({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: number;
  tone: string;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "6px 12px",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280" }}>{label}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: bold ? 700 : 600,
          color: tone,
        }}
      >
        {fmtVnd(value)} ₫
      </div>
    </div>
  );
}

/**
 * Trip-level money sheet for the guide's Tour Report drawer — same layout as
 * the admin "Confirm finished" modal: Collect / Company expense / Remaining,
 * the entry list, and an Add form (Category / Amount / Note).
 */
export default function TripMoneySheet({
  assignmentId,
  allowEmpty,
  onChanged,
}: {
  assignmentId: string;
  /** Private-group child bus: customer paid on the parent booking, so net 0 is allowed. */
  allowEmpty?: boolean;
  onChanged?: () => void;
}) {
  const { modal } = App.useApp();
  const { user } = useSession();
  const { money, loading, addMoney, deleteMoney } = useTourMoney(assignmentId);
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const selectedCategory = useMemo(
    () => (money?.categories ?? []).find((c) => c.id === categoryId),
    [money, categoryId],
  );

  useEffect(() => {
    if (!categoryId && money?.categories?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCategoryId(money.categories[0].id);
    }
  }, [money, categoryId]);

  const add = async () => {
    if (!amount || amount <= 0) {
      message.warning("Enter an amount greater than 0");
      return;
    }
    if (!categoryId) {
      message.warning("Choose a category");
      return;
    }
    setAdding(true);
    const ok = await addMoney({
      direction:
        selectedCategory?.flowType === "COLLECT_MONEY"
          ? "COLLECT_MONEY"
          : "PAY_MONEY",
      amount,
      categoryId,
      note: note.trim() || undefined,
    });
    setAdding(false);
    if (ok) {
      setAmount(null);
      setNote("");
      onChanged?.();
    }
  };

  const remove = (row: MoneyRow) => {
    modal.confirm({
      title: "Delete this entry?",
      content: "The entry will be permanently removed from this trip's money sheet.",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        const ok = await deleteMoney(row.id);
        if (ok) onChanged?.();
        if (!ok) throw new Error("delete failed");
      },
    });
  };

  const columns: ColumnsType<MoneyRow> = [
    {
      title: "#",
      key: "__index",
      width: 44,
      align: "center",
      render: (_: unknown, __: MoneyRow, i: number) => i + 1,
    },
    {
      title: "Category",
      key: "cat",
      render: (_: unknown, r: MoneyRow) => (
        <Flex vertical gap={0}>
          <Text style={{ fontSize: 12 }}>{r.category?.name ?? "—"}</Text>
          {r.note ? (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {r.note}
            </Text>
          ) : null}
        </Flex>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      align: "right",
      width: 120,
      render: (v: number, r: MoneyRow) => (
        <Text
          style={{
            fontSize: 12,
            fontWeight: 600,
            color:
              r.category?.flowType === "COLLECT_MONEY" ? "#0f766e" : "#b91c1c",
          }}
        >
          {fmtVnd(v)}
        </Text>
      ),
    },
    {
      title: "",
      key: "act",
      width: 44,
      render: (_: unknown, r: MoneyRow) =>
        !user || (user.role !== "ADMIN" && r.createdById !== user.id) ? null : (
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => remove(r)}
          />
        ),
    },
  ];

  if (loading && !money) {
    return (
      <Flex justify="center" style={{ padding: 12 }}>
        <Spin size="small" />
      </Flex>
    );
  }

  if (!money) return null;

  const locked = money.locked;

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} wrap>
        <TagBox label="Collect" value={money.collected} tone="#0f766e" />
        <TagBox label="Company expense" value={money.paid} tone="#b91c1c" />
        <TagBox label="Remaining" value={money.net} tone="#2563eb" bold />
      </Flex>

      {locked ? (
        <Alert
          type="success"
          showIcon
          message={`Money locked${money.lockedBy ? ` by ${money.lockedBy}` : ""}`}
        />
      ) : money.rows.length === 0 ? (
        allowEmpty ? (
          <Alert
            type="info"
            showIcon
            message="Customer paid on the parent booking"
            description="You can submit with no money entries — Accounting will lock this bus at net 0. Add expenses or extra cash only if they happened on this bus."
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message="At least one entry is required"
            description="Add what you collected or spent on this trip before submitting — Accounting cannot verify an empty money sheet."
          />
        )
      ) : (
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          columns={columns}
          dataSource={money.rows}
          scroll={{ x: 480 }}
        />
      )}

      {!locked && money.net !== 0 ? (
        <Alert
          type={money.net > 0 ? "warning" : "info"}
          showIcon
          message={
            money.net > 0
              ? `You owe the company ${fmtVnd(money.net)} ₫`
              : `The company owes you ${fmtVnd(-money.net)} ₫`
          }
          description="This entry will be re-checked by Accounting Room when you submit your report."
        />
      ) : null}

      {!locked && (
        <Flex gap={8} wrap align="flex-end">
          <Flex vertical gap={4}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Category
            </Text>
            <Select
              style={{ width: 210 }}
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Choose a category"
              options={(money.categories ?? []).map((c) => ({
                value: c.id,
                label: `${c.name} (${
                  c.flowType === "COLLECT_MONEY" ? "Collect" : "Expense"
                })`,
              }))}
            />
          </Flex>
          <Flex vertical gap={4}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Amount
            </Text>
            <InputNumber
              style={{ width: 150 }}
              min={0}
              value={amount}
              onChange={(v) => setAmount(v as number | null)}
              placeholder="₫"
            />
          </Flex>
          <Flex vertical gap={4} style={{ flex: 1, minWidth: 160 }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Note
            </Text>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note"
              onPressEnter={add}
            />
          </Flex>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={adding}
            onClick={add}
          >
            Add
          </Button>
        </Flex>
      )}
    </Flex>
  );
}
