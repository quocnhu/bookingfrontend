"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Flex,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Table,
  Typography,
  Upload,
  App,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import TourTemplateModal from "./TourTemplateModal";
import type { ColumnsType } from "antd/es/table";
import type { BoardItem } from "./types";

const { Text } = Typography;

interface MoneyRow {
  id: string;
  amount: number;
  note?: string | null;
  createdAt: string;
  createdById?: string | null;
  createdByName?: string | null;
  reversesId?: string | null;
  category?: { id: string; code: string; name: string; flowType: string } | null;
}

interface MoneyCategory {
  id: string;
  code: string;
  name: string;
  flowType: string;
}

interface TourMoney {
  rows: MoneyRow[];
  categories: MoneyCategory[];
  collected: number;
  paid: number;
  net: number;
  flow: string;
  entryCount: number;
  locked: boolean;
  lockedBy: string | null;
  returnedForRecheck: boolean;
}

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

const fmtVnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));

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
  const { modal } = App.useApp();
  const { user } = useApp();
  const [submitting, setSubmitting] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState<EvidenceRow[]>([]);
  // ── Trip money sheet (preview before submitting) ──
  const [showTemplate, setShowTemplate] = useState(false);
  const [money, setMoney] = useState<TourMoney | null>(null);
  const [moneyLoading, setMoneyLoading] = useState(false);
  const [feeAmount, setFeeAmount] = useState<number | null>(null);
  const [feeCategory, setFeeCategory] = useState<string | undefined>();
  const [feeNote, setFeeNote] = useState("");
  const [addingFee, setAddingFee] = useState(false);
  const [tourReport, setTourReport] = useState<{ notes?: string; moneyVerifiedAt?: string } | null>(null);
  const nextEvKey = useRef(0);
  const pendingRef = useRef(0);
  const successRef = useRef(0);
  const failRef = useRef(0);

  const loadMoney = useCallback(async () => {
    if (!assignment) return;
    setMoneyLoading(true);
    try {
      const { data } = await api.get(`/assignments/${assignment.id}/money`);
      setMoney(data as TourMoney);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load the money sheet"));
    } finally {
      setMoneyLoading(false);
    }
  }, [assignment]);

  useEffect(() => {
    if (open && assignment) {
      void loadMoney();
      setEvidenceFiles([]);
      nextEvKey.current = 0;
      pendingRef.current = 0;
      successRef.current = 0;
      failRef.current = 0;
    }
  }, [open, assignment, loadMoney]);

  useEffect(() => {
    if (showTemplate && assignment) {
      api.get(`/assignments/${assignment.id}/tour-report`)
        .then((r) => setTourReport(r.data ?? null))
        .catch(() => setTourReport(null));
    } else {
      setTourReport(null);
    }
  }, [showTemplate, assignment]);

  const submit = async () => {
    if (!assignment) return;
    setSubmitting(true);
    try {
      // Submit tour report with evidence images
      await api.post(`/assignments/${assignment.id}/tour-report`, {
        evidenceImages: evidenceFiles
          .filter((f) => !f.uploading && !f.error && f.url)
          .map((f) => ({
            name: f.name,
            url: f.url,
            ext: f.ext,
          })),
      });
      message.success(`Tour report submitted for "${assignment.tourName ?? assignment.code}" — awaiting accounting verification`);
      onClose();
      onDone();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to submit tour report"));
    } finally {
      setSubmitting(false);
    }
  };

  const addFee = async () => {
    if (!assignment) return;
    if (!feeAmount || feeAmount <= 0) {
      message.warning("Enter an amount greater than 0");
      return;
    }
    if (!feeCategory) {
      message.warning("Choose a category");
      return;
    }
    setAddingFee(true);
    try {
      await api.post(`/assignments/${assignment.id}/money`, {
        amount: feeAmount,
        categoryId: feeCategory,
        note: feeNote.trim() || undefined,
      });
      setFeeAmount(null);
      setFeeNote("");
      await loadMoney();
    } catch (e) {
      message.error(getErrorMessage(e, "Could not add the entry"));
    } finally {
      setAddingFee(false);
    }
  };

  const deleteRow = (r: MoneyRow) => {
    modal.confirm({
      title: "Delete this entry?",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      content: "The entry will be permanently removed from this trip's money sheet.",
      onOk: async () => {
        try {
          if (!assignment) return;
          await api.delete(`/assignments/${assignment.id}/money/${r.id}`);
          message.success("Entry deleted");
          await loadMoney();
        } catch (e) {
          message.error(getErrorMessage(e, "Could not delete the entry"));
          throw e;
        }
      },
    });
  };

  const moneyColumns: ColumnsType<MoneyRow> = [
    {
      title: "Category",
      key: "cat",
      render: (_, r) => (
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
      width: 130,
      render: (v: number, r) => (
        <Text
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: r.reversesId ? "#999" : r.category?.flowType === "COLLECT_MONEY" ? "#0f766e" : "#b91c1c",
            textDecoration: r.reversesId ? "line-through" : undefined,
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
      render: (_, r) =>
        r.reversesId || !user || (user.role !== "ADMIN" && r.createdById !== user.id) ? null : (
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => deleteRow(r)}
          />
        ),
    },
  ];

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
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        successRef.current += 1;
        setEvidenceFiles((prev) =>
          prev.map((item) =>
            item.key === key ? { ...data, key, uploading: false } : item,
          ),
        );
      } catch (e) {
        failRef.current += 1;
        console.error(e);
        setEvidenceFiles((prev) =>
          prev.map((item) =>
            item.key === key ? { ...item, uploading: false, error: true } : item,
          ),
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

    return false;
  };

  const noEntries =
    !moneyLoading && !!money && !money.locked && money.entryCount === 0;

  return (
    <Modal
      title={`Confirm finished — ${assignment?.tourName ?? assignment?.code ?? ""}`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Confirm finished"
      cancelText="Cancel"
      confirmLoading={submitting}
      okButtonProps={{ disabled: noEntries }}
      width={760}
      destroyOnClose
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        {/* ── Print template + money sheet: preview before submitting ── */}
        <Card
          size="small"
          title="Trip money sheet"
          extra={
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => setShowTemplate(true)}
            >
              View print template
            </Button>
          }
        >
          {moneyLoading ? (
            <Flex justify="center" style={{ padding: 12 }}>
              <Spin size="small" />
            </Flex>
          ) : !money ? null : money.locked ? (
            <Alert
              type="success"
              showIcon
              message={`Money locked${money.lockedBy ? ` by ${money.lockedBy}` : ""}`}
            />
          ) : (
            <>
              <Flex gap={8} wrap style={{ marginBottom: 12 }}>
                <TagBox label="Collect" value={money.collected} tone="#0f766e" />
                <TagBox label="Company expense" value={money.paid} tone="#b91c1c" />
                <TagBox label="Remaining" value={money.net} tone="#2563eb" bold />
              </Flex>

              {money.entryCount === 0 ? (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="At least one entry is required"
                  description="Add what you collected or spent on this trip before submitting — Accounting cannot verify an empty money sheet."
                />
              ) : (
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  columns={moneyColumns}
                  dataSource={money.rows}
                  style={{ marginBottom: 12 }}
                />
              )}

              {money.net !== 0 ? (
                <Alert
                  type={money.net > 0 ? "warning" : "info"}
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={
                    money.net > 0
                      ? `You owe the company ${fmtVnd(money.net)} ₫`
                      : `The company owes you ${fmtVnd(-money.net)} ₫`
                  }
                  description="This entry will be re-checked by Accounting Room when you submit your report."
                />
              ) : null}

              <Flex gap={8} wrap align="flex-end">
                <Flex vertical gap={4}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Category</Text>
                  <Select
                    style={{ width: 190 }}
                    value={feeCategory}
                    onChange={setFeeCategory}
                    placeholder="Choose a category"
                    options={(money.categories ?? []).map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.flowType === "COLLECT_MONEY" ? "Collect" : "Expense"})`,
                    }))}
                  />
                </Flex>
                <Flex vertical gap={4}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Amount</Text>
                  <InputNumber
                    style={{ width: 140 }}
                    min={0}
                    value={feeAmount}
                    onChange={setFeeAmount}
                    placeholder="₫"
                  />
                </Flex>
                <Flex vertical gap={4} style={{ flex: 1, minWidth: 160 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Note</Text>
                  <Input
                    value={feeNote}
                    onChange={(e) => setFeeNote(e.target.value)}
                    placeholder="Note"
                  />
                </Flex>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  loading={addingFee}
                  onClick={addFee}
                >
                  Add
                </Button>
              </Flex>
            </>
          )}
        </Card>

        <Divider style={{ margin: 0 }} />

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
                        prev.filter((x) => x.key !== file.key),
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

        <Text type="secondary" style={{ fontSize: 12 }}>
          This submits the tour report for accounting verification. The trip
          will be completed after Accounting verifies and locks the money.
        </Text>
      </Flex>

      <TourTemplateModal
        assignment={assignment}
        open={showTemplate}
        onClose={() => setShowTemplate(false)}
      />
    </Modal>
  );
}