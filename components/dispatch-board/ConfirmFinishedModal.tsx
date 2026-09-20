"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Flex,
  InputNumber,
  Modal,
  Select,
  Spin,
  Typography,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
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

interface EvidenceRow {
  key: number;
  uploading: boolean;
  error?: boolean;
  name?: string;
  url?: string;
  ext?: string;
  uploadedAt?: string;
  uploadedByName?: string;
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
  const [bookingAmounts, setBookingAmounts] = useState<
    Record<string, { collect: number; refund: number }>
  >({});
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceRow[]>([]);
  const nextKey = useRef(0);
  const nextEvKey = useRef(0);

  const bookings = assignment?.bookings ?? [];

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
      const amounts: Record<string, { collect: number; refund: number }> = {};
      for (const b of assignment.bookings ?? []) {
        const plannedCollect = Number(b.collectAmount ?? 0);
        const plannedRefund = Number(b.refundAmount ?? 0);
        const settledCollect = (b.settlements ?? [])
          .filter((s) => s.category?.flowType === "COLLECT_MONEY")
          .reduce((x, s) => x + Number(s.amount ?? 0), 0);
        const settledRefund = (b.settlements ?? [])
          .filter((s) => s.category?.flowType === "PAY_MONEY")
          .reduce((x, s) => x + Number(s.amount ?? 0), 0);
        // Prefer the amounts recorded ahead of the tour (Dispatch Board),
        // fall back to already-settled withdrawal/refund rows on re-finalize.
        amounts[b.id] = {
          collect: plannedCollect > 0 ? plannedCollect : settledCollect,
          refund: plannedRefund > 0 ? plannedRefund : settledRefund,
        };
      }
      setBookingAmounts(amounts);
      setServices([]);
      setEvidenceFiles([]);
      nextKey.current = 0;
      nextEvKey.current = 0;
      pendingRef.current = 0;
      successRef.current = 0;
      failRef.current = 0;
    }
  }, [open, assignment]);

  const collected = useMemo(
    () =>
      Object.values(bookingAmounts).reduce(
        (sum, v) => sum + Number(v.collect || 0),
        0,
      ),
    [bookingAmounts],
  );
  const refunded = useMemo(
    () =>
      Object.values(bookingAmounts).reduce(
        (sum, v) => sum + Number(v.refund || 0),
        0,
      ),
    [bookingAmounts],
  );
  const servicesTotal = useMemo(
    () => services.reduce((sum, s) => sum + Number(s.amount || 0), 0),
    [services],
  );
  const net = collected - refunded - servicesTotal;
  const flow = net >= 0 ? "COLLECT_MONEY" : "PAY_MONEY";

  const setBooking = (
    bookingId: string,
    patch: Partial<{ collect: number; refund: number }>,
  ) => {
    setBookingAmounts((prev) => ({
      ...prev,
      [bookingId]: { ...(prev[bookingId] ?? { collect: 0, refund: 0 }), ...patch },
    }));
  };

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
        refundedAmount: refunded,
        services: services.map((s) => ({
          categoryId: s.categoryId || undefined,
          name: s.name,
          amount: s.amount,
        })),
        bookingSettlements: bookings.map((b) => ({
          bookingId: b.id,
          collect: bookingAmounts[b.id]?.collect ?? 0,
          refund: bookingAmounts[b.id]?.refund ?? 0,
        })),
        evidenceImages: evidenceFiles
          .filter((f) => !f.uploading && !f.error && f.url)
          .map((f) => ({
            name: f.name,
            url: f.url,
            ext: f.ext,
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

  const pendingRef = useRef(0);
  const successRef = useRef(0);
  const failRef = useRef(0);

  const uploadEvidence = (file: File) => {
    if (!assignment) return false;
    const key = ++nextEvKey.current;
    pendingRef.current += 1;
    setEvidenceFiles((prev) => [
      ...prev,
      { key, uploading: true, name: file.name },
    ]);

    void (async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const { data } = await api.post(
          `/assignments/${assignment.id}/tour-report/images`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        successRef.current += 1;
        setEvidenceFiles((prev) =>
          prev.map((item) =>
            item.key === key ? { ...data, key, uploading: false } : item
          )
        );
      } catch (e) {
        failRef.current += 1;
        console.error(e);
        setEvidenceFiles((prev) =>
          prev.map((item) =>
            item.key === key ? { ...item, uploading: false, error: true } : item
          )
        );
      } finally {
        pendingRef.current -= 1;
        if (pendingRef.current === 0) {
          const ok = successRef.current;
          const bad = failRef.current;
          successRef.current = 0;
          failRef.current = 0;
          if (bad === 0 && ok > 0) {
            message.success(`Uploaded ${ok} file(s)`);
          } else if (bad > 0 && ok === 0) {
            message.error("All uploads failed. Please try again.");
          } else if (bad > 0) {
            message.warning(`${bad}/${bad + ok} file(s) failed to upload`);
          }
        }
      }
    })();

    return false; // prevent antd default upload (uploads handled above)
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
        <Flex vertical gap={6}>
          <Text strong>Collect / refund per booking</Text>
          {bookings.length === 0 ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No bookings on this bus.
            </Text>
          ) : (
            <Flex vertical gap={6}>
              <Flex gap={8} align="center" style={{ paddingInline: 4 }}>
                <Text
                  type="secondary"
                  style={{ flex: 1, fontSize: 11 }}
                >
                  Booking
                </Text>
                <Text type="secondary" style={{ width: 110, fontSize: 11 }}>
                  Collect $
                </Text>
                <Text type="secondary" style={{ width: 110, fontSize: 11 }}>
                  Refund $
                </Text>
              </Flex>
              {bookings.map((b) => (
                <Flex
                  key={b.id}
                  gap={8}
                  align="center"
                  style={{
                    border: "1px solid #f0f0f0",
                    borderRadius: 6,
                    padding: "4px 6px",
                  }}
                >
                  <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                    <Text ellipsis style={{ fontSize: 12 }}>
                      {b.customerName || "—"}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {b.bookingRef || "—"} · {b.totalPax ?? 0} pax
                    </Text>
                    {b.notes && (
                      <Text
                        type="secondary"
                        style={{
                          fontSize: 10,
                          color: "#faad14",
                          lineHeight: 1.3,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        ✎ {b.notes}
                      </Text>
                    )}
                  </Flex>
                  <InputNumber
                    min={0}
                    precision={0}
                    value={bookingAmounts[b.id]?.collect ?? 0}
                    onChange={(v) => setBooking(b.id, { collect: Number(v ?? 0) })}
                    style={{ width: 110 }}
                    addonBefore="$"
                  />
                  <InputNumber
                    min={0}
                    precision={0}
                    value={bookingAmounts[b.id]?.refund ?? 0}
                    onChange={(v) => setBooking(b.id, { refund: Number(v ?? 0) })}
                    style={{ width: 110 }}
                    addonBefore="$"
                  />
                </Flex>
              ))}
            </Flex>
          )}
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

        <Flex vertical gap={8}>
          <Flex justify="space-between" align="center">
            <Text strong>Evidence (pictures, videos, files)</Text>
            <Upload
              accept="image/*,video/*,.pdf,.doc,.docx"
              multiple
              beforeUpload={uploadEvidence}
              showUploadList={false}
            >
              <Button size="small" icon={<UploadOutlined />}>
                Upload file
              </Button>
            </Upload>
          </Flex>
          {evidenceFiles.length > 0 ? (
            <Flex gap={8} wrap>
              {evidenceFiles.map((file) => (
                <Flex
                  key={file.key}
                  style={{
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 4,
                    position: "relative",
                  }}
                >
                  {file.uploading ? (
                    <Flex
                      style={{
                        width: 60,
                        height: 60,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Spin size="small" />
                    </Flex>
                  ) : file.error ? (
                    <Flex
                      style={{
                        width: 60,
                        height: 60,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                      }}
                    >
                      <ExclamationCircleOutlined
                        style={{ fontSize: 24, color: "#ff4d4f" }}
                      />
                      <Text style={{ fontSize: 10 }}>Failed</Text>
                    </Flex>
                  ) : file.ext === "jpg" ||
                    file.ext === "jpeg" ||
                    file.ext === "png" ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      style={{ width: 60, height: 60, objectFit: "cover" }}
                    />
                  ) : (
                    <Flex
                      style={{
                        width: 60,
                        height: 60,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                      }}
                    >
                      <UploadOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                      <Text style={{ fontSize: 10 }}>{file.ext}</Text>
                    </Flex>
                  )}
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    style={{ position: "absolute", top: 0, right: 0 }}
                    onClick={() =>
                      setEvidenceFiles((prev) =>
                        prev.filter((x) => x.key !== file.key)
                      )
                    }
                  />
                </Flex>
              ))}
            </Flex>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No files uploaded yet.
            </Text>
          )}
        </Flex>

        <Flex vertical gap={4}>
          <Flex justify="space-between">
            <Text type="secondary">Collected</Text>
            <Text>{fmt(collected)}</Text>
          </Flex>
          <Flex justify="space-between">
            <Text type="secondary">Refunded</Text>
            <Text type="danger">−{fmt(refunded)}</Text>
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
          type={net === 0 ? "info" : flow === "COLLECT_MONEY" ? "warning" : "success"}
          showIcon
          message={
            net === 0
              ? "Settlement settled — no balance between tour guide and company"
              : flow === "COLLECT_MONEY"
                ? `Tour guide pays company ${fmt(Math.abs(net))}`
                : `Company returns ${fmt(Math.abs(net))} to tour guide`
          }
          description={
            flow === "PAY_MONEY"
              ? "Collected + refunds + services leave a negative balance — the difference is returned to the tour guide."
              : "Recorded as a collection from the tour guide."
          }
        />
      </Flex>
    </Modal>
  );
}