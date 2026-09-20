"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Flex,
  Form,
  Image,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
  theme as antdTheme,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  HomeOutlined,
  EnvironmentOutlined,
  DeleteOutlined,
  PictureOutlined,
  ReloadOutlined,
  SendOutlined,
  UserOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import dayjs from "dayjs";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "orange",
  DISPATCHED: "blue",
  VERIFYING: "purple",
  COMPLETED: "green",
  CANCELED: "red",
};

interface EvidenceItem {
  name?: string;
  url: string;
  uploadedAt?: string;
  uploadedByName?: string;
}

export default function SubmitReportPage() {
  const { user } = useApp();
  const { token } = antdTheme.useToken();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [form] = Form.useForm();
  const nextKey = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/assignments/my-assignments");
      const items = r.data ?? [];
      // Show DISPATCHED (needs report) + VERIFYING (submitted/pending/rejected) + COMPLETED (verified).
      setAssignments(
        items.filter(
          (a: any) =>
            a.status === "DISPATCHED" ||
            a.status === "VERIFYING" ||
            a.status === "COMPLETED",
        ),
      );
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = (a: any) => {
    setDetail(a);
    if (a.tourReport) {
      form.setFieldsValue({
        actualPax: a.tourReport.actualPax,
        distanceKm: a.tourReport.distanceKm,
        fuelCost: a.tourReport.fuelCost,
        tollParking: a.tourReport.tollParking,
        notes: a.tourReport.notes,
        pickupNotes: a.tourReport.pickupNotes,
      });
      setEvidence(Array.isArray(a.tourReport.evidenceImages) ? a.tourReport.evidenceImages : []);
    } else {
      form.resetFields();
      setEvidence([]);
    }
  };

  const canEditReport = (a: any) =>
    !a.tourReport || a.tourReport.status === "REJECTED";

  const reportStatus = detail?.tourReport?.status;

  const uploadEvidence = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post(`/assignments/${detail.id}/tour-report/images`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const entry: EvidenceItem = r.data ?? { url: "" };
      setEvidence((prev) => [...prev, { ...entry, name: entry.name ?? file.name }]);
      message.success(`Uploaded "${file.name}"`);
    } catch (e) {
      message.error(getErrorMessage(e, "Upload failed"));
      throw e;
    }
  };

  const submit = async (assignmentId: string) => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      await api.post(`/assignments/${assignmentId}/tour-report`, {
        actualPax: values.actualPax,
        distanceKm: values.distanceKm,
        fuelCost: values.fuelCost,
        tollParking: values.tollParking,
        notes: values.notes,
        pickupNotes: values.pickupNotes,
        evidenceImages: evidence,
      });
      message.success("Tour report submitted successfully!");
      setDetail(null);
      setEvidence([]);
      form.resetFields();
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to submit report"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined /> Submit Tour Report
        </Typography.Title>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          Refresh
        </Button>
      </Flex>

      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        After completing a tour, submit your report and any evidence pictures here for the
        accounting department to verify.
      </Typography.Text>

      {loading ? (
        <Flex justify="center" style={{ padding: 80 }}>
          <Spin size="large" />
        </Flex>
      ) : assignments.length === 0 ? (
        <Empty description="No trips to report" />
      ) : (
        assignments.map((a: any) => {
          const hasReport = Boolean(a.tourReport);
          const reportStatus = a.tourReport?.status;
          const readyToEdit = !hasReport || reportStatus === "REJECTED";
          return (
            <Card
              key={a.id}
              variant="borderless"
              style={{
                marginBottom: 12,
                border: `1px solid ${
                  !hasReport
                    ? token.colorBorderSecondary
                    : reportStatus === "VERIFIED"
                      ? token.colorSuccess
                      : reportStatus === "REJECTED"
                        ? token.colorError
                        : token.colorWarning
                }`,
                borderRadius: 12,
              }}
            >
              <Flex justify="space-between" align="flex-start" wrap gap={16}>
                <Flex vertical gap={4} style={{ flex: 1, minWidth: 240 }}>
                  <Flex align="center" gap={8} wrap>
                    <Typography.Text strong style={{ fontSize: 16 }}>
                      {a.tourName ?? a.code}
                    </Typography.Text>
                    <Tag color={STATUS_COLOR[a.status]}>{a.status}</Tag>
                    {hasReport && (
                      <Tag
                        color={
                          reportStatus === "VERIFIED"
                            ? "green"
                            : reportStatus === "REJECTED"
                              ? "red"
                              : "orange"
                        }
                      >
                        Report: {reportStatus}
                      </Tag>
                    )}
                    {reportStatus === "REJECTED" && (
                      <Tag color="red" style={{ fontWeight: 600 }}>
                        Need to verify again
                      </Tag>
                    )}
                  </Flex>
                  <Typography.Text type="secondary">
                    <ClockCircleOutlined /> {dayjs(a.startDate).format("DD/MM/YYYY")} —{" "}
                    {dayjs(a.endDate).format("DD/MM/YYYY")}
                    {a.durationDays ? ` · ${a.durationDays} ${a.durationDays === 1 ? "Day" : "Days"}` : ""}
                  </Typography.Text>
                  {Array.isArray(a.tourReport?.evidenceImages) &&
                    a.tourReport.evidenceImages.length > 0 && (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        <PictureOutlined /> {a.tourReport.evidenceImages.length} evidence
                        picture(s)
                      </Typography.Text>
                    )}
                </Flex>
                <Button
                  type={readyToEdit ? "primary" : "default"}
                  icon={readyToEdit ? <SendOutlined /> : <CheckCircleOutlined />}
                  onClick={() => openDetail(a)}
                >
                  {!hasReport
                    ? "Submit Report"
                    : reportStatus === "REJECTED"
                      ? "Resubmit Report"
                      : "View Report"}
                </Button>
              </Flex>
            </Card>
          );
        })
      )}

      <Drawer
        title={`Tour Report — ${detail?.tourName ?? detail?.code ?? ""}`}
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={520}
        footer={
          detail && canEditReport(detail) ? (
            <Flex justify="end">
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={() => submit(detail.id)}
              >
                {reportStatus === "REJECTED" ? "Resubmit Report" : "Submit Report"}
              </Button>
            </Flex>
          ) : null
        }
      >
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Tour">{detail.tourName ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Code">{detail.code ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Dates">
                {dayjs(detail.startDate).format("DD/MM/YYYY")} — {dayjs(detail.endDate).format("DD/MM/YYYY")}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {detail.durationDays ?? 1} {(detail.durationDays ?? 1) === 1 ? "Day" : "Days"}
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLOR[detail.status]}>{detail.status}</Tag>
              </Descriptions.Item>
              {detail.vehicle && (
                <Descriptions.Item label="Vehicle">{detail.vehicle.plateNumber}</Descriptions.Item>
              )}
            </Descriptions>

            {detail.pickups && detail.pickups.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Typography.Text strong style={{ fontSize: 12, color: "#666", letterSpacing: 0.5, display: "block", marginBottom: 8 }}>
                  BOOKING MANIFEST ({detail.pickups.length} booking{detail.pickups.length > 1 ? "s" : ""})
                </Typography.Text>
                {detail.pickups.map((p: any, i: number) => (
                  <div key={i} style={{ padding: "8px 10px", marginBottom: 6, borderRadius: 8, background: token.colorBgLayout, border: `1px solid ${token.colorBorderSecondary}` }}>
                    <Flex align="center" gap={6} style={{ marginBottom: 4 }}>
                      <Tag color="blue" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>{i + 1}</Tag>
                      <Typography.Text strong style={{ fontSize: 13 }}>{p.customerName ?? "No name"}</Typography.Text>
                      <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>{p.totalPax} pax</Tag>
                    </Flex>
                    <Flex vertical gap={2} style={{ paddingLeft: 30 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        <HomeOutlined style={{ marginRight: 4 }} />{p.pickup || "No hotel"}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        Ref: {p.bookingRef}
                      </Typography.Text>
                    </Flex>
                  </div>
                ))}
              </div>
            )}

            {detail.tourReport && (
              <Descriptions column={1} size="small" bordered style={{ marginBottom: 24 }}>
                <Descriptions.Item label="Report Status">
                  <Tag
                    color={
                      detail.tourReport.status === "VERIFIED"
                        ? "green"
                        : detail.tourReport.status === "REJECTED"
                          ? "red"
                          : "orange"
                    }
                  >
                    {detail.tourReport.status}
                  </Tag>
                  {detail.tourReport.status === "REJECTED" && (
                    <Tag color="red" style={{ fontWeight: 600 }}>
                      Need to verify again
                    </Tag>
                  )}
                </Descriptions.Item>
                {detail.tourReport.submittedByName && (
                  <Descriptions.Item label="Submitted by">{detail.tourReport.submittedByName}</Descriptions.Item>
                )}
                {detail.tourReport.verifiedByName && (
                  <Descriptions.Item label="Verified by">{detail.tourReport.verifiedByName}</Descriptions.Item>
                )}
                {detail.tourReport.verificationNotes && (
                  <Descriptions.Item label="Verification note">
                    {detail.tourReport.verificationNotes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            )}

            {canEditReport(detail) ? (
              <>
                <Form form={form} layout="vertical">
                  <Form.Item name="actualPax" label="Actual pax count">
                    <InputNumber min={0} style={{ width: "100%" }} placeholder="Number of guests who showed up" />
                  </Form.Item>
                  <Form.Item name="distanceKm" label="Distance (km)">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name="fuelCost" label="Fuel cost">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name="tollParking" label="Toll & parking cost">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                  <Form.Item name="pickupNotes" label="Pickup notes">
                    <Input.TextArea rows={2} placeholder="Any notes about pickup logistics" />
                  </Form.Item>
                  <Form.Item name="notes" label="Additional notes">
                    <Input.TextArea rows={3} placeholder="Anything else the accounting team should know" />
                  </Form.Item>
                </Form>

                <div style={{ marginBottom: 24 }}>
                  <Typography.Text strong style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 8 }}>
                    <PictureOutlined /> Evidence pictures ({evidence.length})
                  </Typography.Text>
                  <Flex wrap gap={8} align="center">
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      multiple={false}
                      customRequest={async ({ file, onSuccess, onError }) => {
                        try {
                          await uploadEvidence(file as File);
                          onSuccess?.({});
                        } catch (e) {
                          onError?.(e as Error);
                        }
                      }}
                    >
                      <Button icon={<UploadOutlined />}>Upload picture</Button>
                    </Upload>
                  </Flex>
                  {evidence.length > 0 && (
                    <Flex wrap gap={10} style={{ marginTop: 10 }}>
                      {evidence.map((e, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <Image
                            src={e.url}
                            alt={e.name ?? "evidence"}
                            width={80}
                            height={80}
                            style={{ objectFit: "cover", borderRadius: 8 }}
                          />
                          <DeleteOutlined
                            onClick={() =>
                              setEvidence((prev) => prev.filter((_, x) => x !== i))
                            }
                            style={{
                              position: "absolute",
                              top: 4,
                              right: 4,
                              background: "rgba(0,0,0,0.6)",
                              color: "#fff",
                              borderRadius: 6,
                              padding: 4,
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          />
                        </div>
                      ))}
                    </Flex>
                  )}
                  <Typography.Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 8 }}>
                    Pictures are saved to the tour guide folder (guide name + tour date) and
                    stay pending until the accounting room verifies this report.
                  </Typography.Text>
                </div>
              </>
            ) : (
              <>
                {evidence.length === 0 ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    No evidence pictures uploaded.
                  </Typography.Text>
                ) : (
                  <Image.PreviewGroup>
                    <Flex wrap gap={10} style={{ marginBottom: 24 }}>
                      {evidence.map((e, i) => (
                        <Image
                          key={i}
                          src={e.url}
                          alt={e.name ?? "evidence"}
                          width={90}
                          height={90}
                          style={{ objectFit: "cover", borderRadius: 8 }}
                        />
                      ))}
                    </Flex>
                  </Image.PreviewGroup>
                )}
              </>
            )}
          </>
        )}
      </Drawer>
    </div>
  );
}