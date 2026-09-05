"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Flex,
  InputNumber,
  Modal,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import type { BoardItem } from "./types";

const { Text } = Typography;

interface ServiceRow {
  key: number;
  categoryId?: string;
  name: string;
  amount: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  code: string;
  flowType: "COLLECT_MONEY" | "PAY_MONEY";
}

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export default function ConfirmFinishedModal({
  assignment,
  open,
  onClose,
  onDone,
}: {
  assignment: BoardItem | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [collected, setCollected] = useState(0);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const nextKey = useRef(0);

  useEffect(() => {
    api
      .get("/settlements/categories")
      .then((r) => {
        const list: ServiceCategory[] = Array.isArray(r.data) ? r.data : [];
        setCategories(list.filter((c) => c.flowType === "PAY_MONEY"));
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (open && assignment) {
      const base = (assignment.bookings ?? []).reduce(
        (sum, b) =>
          sum +
          (b.settlements ?? [])
            .filter((s) => s.category?.flowType === "COLLECT_MONEY")
            .reduce((x, s) => x + Number(s.amount ?? 0), 0),
        0,
      );
      setCollected(base);
      setServices([]);
      nextKey.current = 0;
    }
  }, [open, assignment]);

  const servicesTotal = useMemo(
    () => services.reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [services],
  );
  const net = collected - servicesTotal;
  const flow = net >= 0 ? "COLLECT_MONEY" : "PAY_MONEY";

  const addService = () => {
    setServices((prev) => [
      ...prev,
      { key: ++nextKey.current, name: "", amount: 0 },
    ]);
  };

  const removeService = (key: number) => {
    setServices((prev) => prev.filter((s) => s.key !== key));
  };

  const updateRow = (key: number, patch: Partial<ServiceRow>) => {
    setServices((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    );
  };

  const onPickCategory = (key: number, categoryId?: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    updateRow(key, { categoryId, name: cat?.name ?? "" });
  };

  const submit = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      await api.put(`/assignments/${assignment.id}/finalize`, {
        collectedAmount: collected,
        services: services.map((s) => ({
          categoryId: s.categoryId || undefined,
          name: s.name,
          amount: s.amount,
        })),
      });
      message.success(
        `Tour "${assignment.tourName ?? assignment.code}" settled`,
      );
      onClose();
      onDone();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to settle tour"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Confirm finished — ${assignment?.tourName ?? assignment?.code ?? ""}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Confirm & settle"
      cancelText="Cancel"
      confirmLoading={submitting}
      width={560}
      destroyOnClose
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        <Flex justify="space-between" align="center" wrap gap={8}>
          <Text>Collect amount (tour guide collected):</Text>
          <InputNumber
            min={0}
            precision={0}
            value={collected}
            onChange={(v) => setCollected(Number(v ?? 0))}
            style={{ width: 180 }}
            addonBefore="$"
          />
        </Flex>

        <Flex vertical gap={8}>
          <Flex justify="space-between" align="center">
            <Text strong>Operator services (tour guide paid out)</Text>
            <Button size="small" icon={<PlusOutlined />} onClick={addService}>
              Add service
            </Button>
          </Flex>
          {services.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No operator services deducted.
            </Text>
          ) : (
            services.map((s) => (
              <Flex key={s.key} gap={8} align="center">
                <Select
                  value={s.categoryId}
                  placeholder="Select service"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                  onChange={(v) => onPickCategory(s.key, v)}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  min={0}
                  precision={0}
                  value={s.amount}
                  placeholder="Amount"
                  onChange={(v) =>
                    updateRow(s.key, { amount: Number(v ?? 0) })
                  }
                  addonBefore="$"
                    style={{ width: 160 }}
                />
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeService(s.key)}
                />
              </Flex>
            ))
          )}
        </Flex>

        <Flex vertical gap={4}>
          <Flex justify="space-between">
            <Text type="secondary">Collected</Text>
            <Text>{fmt(collected)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text type="secondary">Services total</Text>
            <Text type="danger">−{fmt(servicesTotal)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text strong>Net</Text>
            <Text strong>{fmt(net)}</Text>
          </Flex>
        </Flex>

        <Alert
          type={flow === "COLLECT_MONEY" ? "warning" : "success"}
          showIcon
          message={
            flow === "COLLECT_MONEY"
              ? `Tour guide pays company ${fmt(Math.abs(net))}`
              : `Company returns ${fmt(Math.abs(net))} to tour guide`
          }
          description={
            flow === "PAY_MONEY"
              ? "Collect amount is less than the services paid out — the balance is refunded to the tour guide."
              : "Recorded as a collection from the tour guide."
          }
        />
      </Flex>
    </Modal>
  );
}