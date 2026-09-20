"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Descriptions,
  Flex,
  Image,
  Input,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileDoneOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import type { BoardItem } from "./types";

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
  const [verificationNotes, setVerificationNotes] = useState("");
  const [submitting, setSubmitting] = useState<"VERIFIED" | "REJECTED" | null>(
    null,
  );

  useEffect(() => {
    if (open) {
      setVerificationNotes(a?.tourReport?.verificationNotes ?? "");
    }
  }, [open, a]);

  if (!a) return null;

  const report = a.tourReport;
  const images = report?.evidenceImages ?? [];

  const submit = async (status: "VERIFIED" | "REJECTED") => {
    setSubmitting(status);
    try {
      await api.put(`/assignments/${a.id}/tour-report/verify`, {
        status,
        verificationNotes:
          status === "REJECTED" && !verificationNotes.trim()
            ? "Please add a note explaining the rejection"
            : verificationNotes,
      });
      message.success(
        status === "VERIFIED"
          ? `Report verified — tour "${a.tourName ?? a.code}" completed`
          : `Report rejected — tour guide can resubmit`,
      );
      onClose();
      onDone();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to verify report"));
    } finally {
      setSubmitting(null);
    }
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
              onClick={() => submit("REJECTED")}
            >
              Reject
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={submitting === "VERIFIED"}
              style={{ background: "#52c41a" }}
              onClick={() => submit("VERIFIED")}
            >
              Approve
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
          <Descriptions column={1} size="small" bordered>
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Report numbers
            </Text>
            <Descriptions.Item label="Actual pax">
              {report.actualPax ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Distance (km)">
              {report.distanceKm ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Fuel cost">
              {report.fuelCost ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Toll & parking">
              {report.tollParking ?? "—"}
            </Descriptions.Item>
            {report.pickupNotes && (
              <Descriptions.Item label="Pickup notes">
                {report.pickupNotes}
              </Descriptions.Item>
            )}
            {report.notes && (
              <Descriptions.Item label="Notes">
                {report.notes}
              </Descriptions.Item>
            )}
            {report.verifiedByName && (
              <Descriptions.Item label="Verified by">
                {report.verifiedByName}
              </Descriptions.Item>
            )}
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