"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button, Empty, Flex, Modal, Skeleton, Typography } from "antd";
import { message } from "@/lib/antd-message";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import type { BoardItem } from "./types";

const { Text } = Typography;

interface CompanyProfile {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  website?: string;
}

// Brand palette
const NAVY = "#1f3a5f";
const NAVY_DARK = "#16263f";
const INK = "#1a2333";
const BORDER = "#d6deeb";

interface TourReportData {
  notes?: string | null;
  moneyVerifiedAt?: string | null;
  netAmount?: number | null;
  settlementFlow?: "COLLECT_MONEY" | "PAY_MONEY" | null;
  actualPax?: number | null;
  distanceKm?: number | null;
  fuelCost?: number | null;
  tollParking?: number | null;
  pickupNotes?: string | null;
}

interface FullAssignmentData {
  id: string;
  code: string;
  tourName: string;
  tourType: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  vehicle?: { plateNumber?: string; capacity?: number } | null;
  provider?: { name?: string } | null;
  driver?: { id?: string; name?: string } | null;
  guide?: { id?: string; name?: string } | null;
  bookings?: Array<{
    id: string;
    bookingRef?: string;
    customerName?: string;
    hotelName?: string;
    address?: string;
    totalPax?: number;
    notes?: string | null;
    payment?: string | null;
  }>;
  tourReport?: {
    notes?: string | null;
    moneyVerifiedAt?: string | null;
    netAmount?: number | null;
    settlementFlow?: "COLLECT_MONEY" | "PAY_MONEY" | null;
    actualPax?: number | null;
    distanceKm?: number | null;
    fuelCost?: number | null;
    tollParking?: number | null;
    pickupNotes?: string | null;
  } | null;
  tripNotes?: string | null;
}

function Voucher({
  a,
  company,
  tourReport,
}: {
  a: FullAssignmentData;
  company: CompanyProfile | null;
  tourReport?: TourReportData | null;
}) {
  /**
   * Collect/Refund per passenger, grouped from the settlements linked to a
   * bookingId. That way the print template (manifest) and the money sheet
   * always match.
   */
  const [cashByBooking, setCashByBooking] = useState<Map<string, { collected: number; paid: number }>>(
    new Map(),
  );

  useEffect(() => {
    if (!a?.id) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assignments/${a.id}/money`);
        if (!alive) return;
        const map = new Map<string, { collected: number; paid: number }>();
        for (const row of data?.rows ?? []) {
          if (!row?.bookingId) continue;
          const cur = map.get(row.bookingId) ?? { collected: 0, paid: 0 };
          if (row.category?.flowType === "COLLECT_MONEY") cur.collected += Number(row.amount) || 0;
          else cur.paid += Number(row.amount) || 0;
          map.set(row.bookingId, cur);
        }
        setCashByBooking(map);
      } catch {
        // If it cannot be loaded, print without the money column - safer than
        // printing wrong figures.
        if (alive) setCashByBooking(new Map());
      }
    })();
    return () => {
      alive = false;
    };
  }, [a?.id]);

  const rows = useMemo(
    () =>
      (a?.bookings ?? []).map((b, i) => {
        const cash = b.id ? cashByBooking.get(b.id) : undefined;
        return {
          index: i + 1,
          bookingRef: b.bookingRef || "—",
          customer: b.customerName || "—",
          pickup: b.hotelName || b.address || "—",
          pax: b.totalPax ?? 0,
          notes: b.notes?.trim() || "",
          collected: cash?.collected ?? 0,
          paid: cash?.paid ?? 0,
        };
      }),
    [a, cashByBooking],
  );

  const totalPax = rows.reduce((sum, r) => sum + r.pax, 0);
  const hasNotes = rows.some((r) => r.notes.length > 0);
  const totalCollected = rows.reduce((sum, r) => sum + r.collected, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.paid, 0);
  const fmtVnd = (n: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));

  const printedAt = dayjs().format("DD MMM YYYY");

  // Check if tour is completed or money verified
  const isCompleted = a.status === "COMPLETED" || tourReport?.moneyVerifiedAt;
  
  // Money summary
  const getMoneySummary = () => {
    if (!tourReport || tourReport.netAmount === null || tourReport.netAmount === undefined) return null;
    const net = Number(tourReport.netAmount);
    const flow = tourReport.settlementFlow;
    if (flow === "COLLECT_MONEY") {
      return net > 0
        ? `Tour guide returns to company: ${fmtVnd(net)} VND`
        : `Company returns to tour guide: ${fmtVnd(-net)} VND`;
    } else if (flow === "PAY_MONEY") {
      return net > 0
        ? `Company pays tour guide: ${fmtVnd(net)} VND`
        : `Tour guide pays company: ${fmtVnd(-net)} VND`;
    }
    return `Net amount: ${fmtVnd(net)} VND`;
  };
  
  const moneySummary = getMoneySummary();
  const isCompletedOrVerified = a.status === "COMPLETED" || tourReport?.moneyVerifiedAt;

  return (
    <div className="print-doc" style={{ fontFamily: `Georgia, "Times New Roman", serif` }}>
      <div className="tt-paper" style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        {/* ── Letterhead: navy band ── */}
        <div
          className="tt-white"
          style={{
            background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 60%, #2d4d7a 100%)`,
            color: "#fff",
            padding: "20px 26px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: 0.3 }}>{company?.name ?? "—"}</div>
            {company?.address && (
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{company.address}</div>
            )}
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {[company?.phone && `Tel: ${company.phone}`, company?.email && company.email]
                .filter(Boolean)
                .join("  ·  ")}
            </div>
            {company?.taxId && (
              <div style={{ fontSize: 12, opacity: 0.85 }}>Tax ID: {company.taxId}</div>
            )}
          </div>
          <Flex vertical align="flex-end" style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Tour Manifest
            </div>
            <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
              Trip passenger list — print &amp; hand over
            </div>
          </Flex>
        </div>

        {/* ── Tour info block ── */}
        <div className="tt-pad-h" style={{ padding: "18px 26px 6px" }}>
          <table className="tt-block" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <tbody>
              <tr>
                <td style={{ width: 120, padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Tour code</td>
                <td style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>{a.code}</td>
                <td style={{ width: 90, padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Status</td>
                <td style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>{a.status}</td>
              </tr>
              <tr>
                <td style={{ padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Tour</td>
                <td colSpan={3} style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>{a.tourName}</td>
              </tr>
              <tr>
                <td style={{ padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Dates</td>
                <td style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>
                  {dayjs(a.startDate).format("DD MMM YYYY")} → {dayjs(a.endDate).format("DD MMM YYYY")} ({a.durationDays} day{a.durationDays > 1 ? "s" : ""})
                </td>
                <td style={{ padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Type</td>
                <td style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>{a.tourType}</td>
              </tr>
              <tr>
                <td style={{ padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Vehicle</td>
                <td style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>
                  {a.vehicle?.plateNumber ?? "—"}{a.provider?.name ? ` · ${a.provider.name}` : ""}
                </td>
                <td style={{ padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Guide</td>
                <td style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>{a.guide?.name ?? "Unassigned"}</td>
              </tr>
              <tr>
                <td style={{ padding: "7px 10px", fontWeight: 700, background: "#eef2f9", color: NAVY, border: `1px solid ${BORDER}` }}>Driver</td>
                <td colSpan={3} style={{ padding: "7px 10px", border: `1px solid ${BORDER}` }}>
                  {a.driver?.name ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Bookings table ── */}
        <div className="tt-pad-h" style={{ padding: "14px 26px 6px" }}>
          {a.bookings?.length ? (
            <table className="tt-block tt-zebra" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["#", "Booking ref", "Customer", "Pickup / Hotel", "Pax", ...(hasNotes ? ["Notes"] : []), "Collected", "Refunded"].map((h, i) => {
                    const numeric = i >= 4 && h !== "Notes";
                    return (
                    <th
                      key={h}
                      className="tt-white"
                      style={{
                        padding: "8px 10px",
                        textAlign: numeric ? "right" : "left",
                        background:
                          "linear-gradient(135deg, #16263f 0%, #1f3a5f 60%, #2d4d7a 100%)",
                        color: "#fff",
                        border: `1px solid ${NAVY_DARK}`,
                        fontWeight: 600,
                        letterSpacing: 0.3,
                      }}
                    >
                      {h}
                    </th>
                  );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.bookingRef + r.index} style={{ background: idx % 2 ? "#f7f9fd" : "#fff" }}>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}` }}>{r.index}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}` }}>{r.bookingRef}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}` }}>{r.customer}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}` }}>{r.pickup}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "right" }}>{r.pax}</td>
                    {hasNotes && (
                      <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, color: r.notes ? "#8a6d3b" : "#adb5bd", fontStyle: r.notes ? "normal" : "italic" }}>
                        {r.notes || "—"}
                      </td>
                    )}
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "right", color: "#2f7a3f" }}>
                      {r.collected ? fmtVnd(r.collected) : "—"}
                    </td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "right", color: "#b02a37" }}>
                      {r.paid ? fmtVnd(r.paid) : "—"}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "#eef5f3" }}>
                  <td colSpan={4} style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700, color: NAVY_DARK }}>
                    TOTAL
                  </td>
                  <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700 }}>{totalPax}</td>
                  {hasNotes && <td style={{ border: `1px solid ${BORDER}` }} />}
                  <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700, color: "#2f7a3f" }}>
                    {totalCollected ? fmtVnd(totalCollected) : "—"}
                  </td>
                  <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700, color: "#b02a37" }}>
                    {totalPaid ? fmtVnd(totalPaid) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No bookings on this bus" />
          )}
        </div>

        {/* ── Notes + signature row ── */}
        <div className="tt-pad-h tt-pad-v" style={{ padding: "14px 26px 22px" }}>
          {isCompletedOrVerified && (
            <div
              style={{
                position: "relative",
                marginBottom: 16,
                padding: "12px 20px",
                background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
                border: "2px solid #10b981",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#065f46",
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                ✅ Completed
              </Text>
              {tourReport?.moneyVerifiedAt && (
                <div style={{ marginTop: 4, fontSize: 11, color: "#047857" }}>
                  Money locked on {dayjs(tourReport.moneyVerifiedAt).format("DD MMM YYYY HH:mm")}
                </div>
              )}
            </div>
          )}

          {moneySummary && (
            <div
              style={{
                marginBottom: 16,
                padding: "12px 20px",
                background: "linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)",
                border: "2px solid #f59e0b",
                borderRadius: 12,
                textAlign: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#92400e",
                }}
              >
                💰 Money Summary
              </Text>
              <div style={{ marginTop: 4, fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                {moneySummary}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11, color: "#6b7280" }}>
              Notes: ______________________________________________________________________
            </Text>
          </div>
          {(tourReport?.notes || a.tripNotes) && (
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>Trip notes: </Text>
              <Text style={{ fontSize: 11.5 }}>{tourReport?.notes ?? a.tripNotes}</Text>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <tbody>
              <tr>
                {["Prepared by", "Approved by", "Date"].map((t, i, arr) => (
                  <td
                    key={t}
                    style={{
                      textAlign: "center",
                      padding: "8px 0",
                      borderTop: `1px solid ${BORDER}`,
                      color: "#1a2333",
                      fontWeight: 700,
                      fontSize: 12.5,
                      width: `${100 / arr.length}%`,
                    }}
                  >
                    {t === "Date" ? printedAt : t}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                {["____________", "____________", "(date)"].map((t, i, arr) => (
                  <td key={i} style={{ textAlign: "center", height: 40, verticalAlign: "top", width: `${100 / arr.length}%`, fontSize: 12, color: "#1a2333" }}>
                    {t}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface TourReportData {
  notes?: string | null;
  moneyVerifiedAt?: string | null;
  netAmount?: number | null;
  settlementFlow?: "COLLECT_MONEY" | "PAY_MONEY" | null;
  actualPax?: number | null;
  distanceKm?: number | null;
  fuelCost?: number | null;
  tollParking?: number | null;
  pickupNotes?: string | null;
}

interface FullAssignmentData {
  id: string;
  code: string;
  tourName: string;
  tourType: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  status: string;
  vehicle?: { plateNumber?: string; capacity?: number } | null;
  provider?: { name?: string } | null;
  driver?: { id?: string; name?: string } | null;
  guide?: { id?: string; name?: string } | null;
  bookings?: Array<{
    id: string;
    bookingRef?: string;
    customerName?: string;
    hotelName?: string;
    address?: string;
    totalPax?: number;
    notes?: string | null;
    payment?: string | null;
  }>;
  tourReport?: TourReportData | null;
  tripNotes?: string | null;
}

export default function TourTemplateModal({
  assignment: initialAssignment,
  open,
  onClose,
}: {
  assignment: BoardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [assignment, setAssignment] = useState<FullAssignmentData | null>(null);
  const [assignmentLoading, setAssignmentLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompanyLoading(true);
    api
      .get("/company-profile")
      .then((r) => setCompany(r.data ?? null))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load company profile")))
      .finally(() => setCompanyLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open || !initialAssignment?.id) {
      setAssignment(null);
      return;
    }
    setAssignmentLoading(true);
    api.get(`/assignments/${initialAssignment.id}`)
      .then((r) => setAssignment(r.data ?? null))
      .catch((e) => {
        message.error(getErrorMessage(e, "Failed to load assignment"));
        setAssignment(null);
      })
      .finally(() => setAssignmentLoading(false));
    return () => {
      setAssignment(null);
    };
  }, [open, initialAssignment?.id]);

  const fmtVnd = (n: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.round(n));

  const getMoneySummary = (a: FullAssignmentData) => {
    const report = a.tourReport;
    if (!report || report.netAmount === null || report.netAmount === undefined) return null;
    const net = Number(report.netAmount);
    const flow = report.settlementFlow;
    if (flow === "COLLECT_MONEY") {
      return net > 0
        ? `Tour guide will return to company: ${fmtVnd(net)} VND`
        : `Company will return to tour guide: ${fmtVnd(-net)} VND`;
    } else if (flow === "PAY_MONEY") {
      return net > 0
        ? `Company will pay tour guide: ${fmtVnd(net)} VND`
        : `Tour guide will pay company: ${fmtVnd(-net)} VND`;
    }
    return `Net amount: ${fmtVnd(net)} VND`;
  };

  const moneySummary = assignment ? getMoneySummary(assignment) : null;

  return (
    <Modal
      title={
        <Flex align="center" gap={8}>
          <PrinterOutlined />
          <span>Print-ready Tour Template</span>
        </Flex>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} className="no-print">
          Close
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          className="no-print"
          onClick={() => window.print()}
        >
          Print / Stamp
        </Button>,
      ]}
      width={820}
      destroyOnClose
    >
<style>{`
        @page { size: A4; margin: 15mm 15mm 15mm 25mm; }
        .print-doc {
          background: #fff !important;
          color: ${INK} !important;
        }
        .print-doc td, .print-doc th, .print-doc div, .print-doc span, .print-doc p {
          color: ${INK} !important;
        }
        .print-doc .tt-white,
        .print-doc .tt-white div,
        .print-doc .tt-white span,
        .print-doc .tt-white th {
          color: #fff !important;
        }
        .tt-paper {
          border: 1px solid ${BORDER};
          border-radius: 12px;
          overflow: hidden;
        }
        @media print {
          body * { visibility: hidden !important; }
          .print-copy, .print-copy * { visibility: visible !important; }
          .print-copy {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0;
            /* A4 with binding margin on the LEFT for hole-punching/binding */
            width: 210mm;
            min-height: 297mm;
            padding: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-copy td, .print-copy th, .print-copy div, .print-copy span, .print-copy p, .print-copy table {
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-copy .tt-label-cell,
          .print-copy .tt-table-header th {
            font-weight: 700 !important;
            color: #000 !important;
          }
          .print-copy .tt-bold {
            font-weight: 700 !important;
          }
          .print-copy .tt-white,
          .print-copy .tt-white div,
          .print-copy .tt-white span,
          .print-copy .tt-white th {
            color: #fff !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-copy .tt-paper { border-radius: 0; border-color: #000; }
          .print-copy .tt-block td { border: 1px solid #000 !important; }
          .print-copy .tt-zebra tr:nth-child(even) td { background: #f3f6fb !important; }
          /* Compress for A4 fit + binding margin on LEFT */
          .print-copy .tt-pad-h { padding-left: 8mm !important; padding-right: 8mm !important; }
          .print-copy .tt-pad-v { padding-top: 6mm !important; padding-bottom: 6mm !important; }
          .print-copy .tt-paper { margin: 0 !important; padding: 0 !important; }
          .print-copy > div:first-child { padding: 15mm 15mm 15mm 25mm !important; }
        }
      `}</style>

      {(companyLoading || assignmentLoading) ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : assignment ? (
        <>
          <Voucher a={assignment} company={company} tourReport={assignment.tourReport ?? undefined} />
          {moneySummary && (
            <div style={{ marginTop: 16, padding: 12, background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8 }}>
              <Text strong style={{ color: "#52c41a" }}>{moneySummary}</Text>
            </div>
          )}
          {typeof document !== "undefined" &&
            createPortal(
              <div className="print-copy" style={{ display: "none" }}>
                <Voucher a={assignment} company={company} tourReport={assignment.tourReport ?? undefined} />
                {moneySummary && (
                  <div style={{ marginTop: 16, padding: 12, background: "#f6ffed", border: "1px solid #b7eb8f", borderRadius: 8 }}>
                    <Text strong style={{ color: "#52c41a" }}>{moneySummary}</Text>
                  </div>
                )}
              </div>,
              document.body,
            )}
        </>
      ) : (
        <Empty description="Select a tour" />
      )}
    </Modal>
  );
}