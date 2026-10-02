"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Descriptions,
  Flex,
  Image,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
  PictureOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import type { BoardItem } from "./types";
import TourTemplateModal from "./TourTemplateModal";

const { Text } = Typography;

export default function VerifyReportModal({
  assignment: a,
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
  const [verificationNotes, setVerificationNotes] = useState("");
  const [submitting, setSubmitting] = useState<"VERIFIED" | "REJECTED" | null>(
    null,
  );
  const [showTemplate, setShowTemplate] = useState(false);
  const [tourReport, setTourReport] = useState<{ notes?: string; moneyVerifiedAt?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setVerificationNotes(a?.tourReport?.verificationNotes ?? "");
      setShowTemplate(false);
    }
  }, [open, a]);

  useEffect(() => {
    if (showTemplate && a) {
      api.get(`/assignments/${a.id}/tour-report`)
        .then((r) => setTourReport(r.data ?? null))
        .catch(() => setTourReport(null));
    } else {
      setTourReport(null);
    }
  }, [showTemplate, a]);

  if (!a) return null;

  const report = a.tourReport;
  const images = report?.evidenceImages ?? [];

  const verify = () => {
    modal.confirm({
      title: "Verify tour report?",
      icon: <WarningOutlined />,
      content: (
        <>
          <p>This will mark the tour report as <b>VERIFIED</b>.</p>
          <Input.TextArea
            rows={3}
            placeholder="Verification note (optional)"
            onChange={(e) => setVerificationNotes(e.target.value)}
          />
        </>
      ),
      okText: "Verify",
      okType: "primary",
      cancelText: "Cancel",
      onOk: async () => {
        setSubmitting("VERIFIED");
        try {
          await api.put(`/assignments/${a.id}/tour-report/verify`, {
            status: "VERIFIED",
            verificationNotes: verificationNotes.trim() || undefined,
          });
          message.success(`Report verified — tour "${a.tourName ?? a.code}" completed`);
          onClose();
          onDone();
        } catch (e) {
          message.error(getErrorMessage(e, "Failed to verify report"));
          throw e;
        } finally {
          setSubmitting(null);
        }
      },
    });
  };

  const reject = () => {
    let reason = "";
    modal.confirm({
      title: "Return tour report?",
      icon: <CloseCircleOutlined />,
      okText: "Return",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      content: (
        <>
          <p>
            The tour report will be returned to the tour guide for re-checking.
            The guide will be notified and can resubmit after making corrections.
          </p>
          <Input.TextArea
            rows={3}
            placeholder="Return reason (required) — the guide will see this"
            onChange={(e) => {
              reason = e.target.value;
            }}
          />
        </>
      ),
      onOk: async () => {
        if (!reason.trim()) {
          message.warning("A return reason is required");
          throw new Error("reason required");
        }
        setSubmitting("REJECTED");
        try {
          await api.put(`/assignments/${a.id}/tour-report/verify`, {
            status: "REJECTED",
            verificationNotes: reason.trim(),
          });
          message.success("Returned — the guide has been notified to resubmit");
          onClose();
          onDone();
        } catch (e) {
          message.error(getErrorMessage(e, "Failed to return report"));
          throw e;
        } finally {
          setSubmitting(null);
        }
      },
    });
  };

  return (
    <Modal
      title={
        <Space>
          <FileDoneOutlined style={{ color: "#1677ff" }} />
          <Text strong>Verify tour report</Text>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={640}
      footer={
        <Flex justify="space-between" align="center">
          <Space>
            {report?.status === "REJECTED" && (
              <Tag color="red">Need to verify again</Tag>
            )}
          </Space>
          <Space>
            <Button
              danger
              icon={<CloseCircleOutlined />}
              loading={submitting === "REJECTED"}
              onClick={reject}
            >
              Return with message
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={submitting === "VERIFIED"}
              style={{ background: "#52c41a" }}
              onClick={verify}
            >
              Verify
            </Button>
          </Space>
        </Flex>
      }
      destroyOnClose
    >
      <Flex vertical gap={16} style={{ paddingTop: 8 }}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Tour">
            {a.tourName ?? a.code}
          </Descriptions.Item>
          <Descriptions.Item label="Bus / Code">
            {a.code ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Dates">
            {dayjs(a.startDate).format("DD/MM/YYYY")} —{" "}
            {dayjs(a.endDate).format("DD/MM/YYYY")}
          </Descriptions.Item>
          <Descriptions.Item label="Guide">
            {a.guide?.name ?? "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Report status">
            {report ? (
              <Tag
                color={
                  report.status === "VERIFIED"
                    ? "green"
                    : report.status === "REJECTED"
                      ? "red"
                      : "orange"
                }
              >
                {report.status}
              </Tag>
            ) : (
              <Text type="secondary">No report submitted</Text>
            )}
          </Descriptions.Item>
          {report?.submittedByName && (
            <Descriptions.Item label="Submitted by">
              {report.submittedByName} ·{" "}
              {report.submittedAt
                ? dayjs(report.submittedAt).format("DD/MM/YYYY HH:mm")
                : ""}
            </Descriptions.Item>
          )}
        </Descriptions>

        {report && (
          <Flex vertical gap={12}>
            <Flex justify="space-between" align="center">
              <Text strong>Tour Manifest (Print Template)</Text>
              <Button size="small" icon={<PictureOutlined />} onClick={() => setShowTemplate(!showTemplate)}>
                {showTemplate ? "Hide Template" : "Show Template"}
              </Button>
            </Flex>
            {showTemplate && (
              <TourTemplateModal
                assignment={a}
                open={true}
                onClose={() => setShowTemplate(false)}
              />
            )}
            {report.pickupNotes && (
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="Pickup notes">
                  {report.pickupNotes}
                </Descriptions.Item>
              </Descriptions>
            )}
            {images.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                No evidence pictures uploaded.
              </Text>
            ) : (
              <div>
                <Text
                  strong
                  style={{ fontSize: 12, display: "block", marginBottom: 8 }}
                >
                  <PictureOutlined /> Evidence pictures ({images.length})
                </Text>
                <Image.PreviewGroup>
                  <Flex gap={8} wrap>
                    {images.map((img, i) => (
                      <Image
                        key={i}
                        src={img.url}
                        alt={img.name ?? "evidence"}
                        width={96}
                        height={96}
                        style={{ objectFit: "cover", borderRadius: 8 }}
                      />
                    ))}
                  </Flex>
                </Image.PreviewGroup>
              </div>
            )}
          </Flex>
        )}

        <Flex vertical gap={4}>
          <Text strong style={{ fontSize: 12 }}>
            Verification note
          </Text>
          <Input.TextArea
            rows={3}
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            placeholder="Optional note to the tour guide about this decision"
          />
        </Flex>
      </Flex>
    </Modal>
  );
}