"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Flex, Modal, Skeleton, Typography, message } from "antd";
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

const usd = (n: number) =>
  `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Brand palette
const NAVY = "#1f3a5f";
const NAVY_DARK = "#16263f";
const EMERALD = "#0f766e";
const EMERALD_DARK = "#115e59";
const INK = "#1a2333";
const BORDER = "#d6deeb";

export default function TourTemplateModal({
  assignment: a,
  open,
  onClose,
}: {
  assignment: BoardItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCompanyLoading(true);
    api
      .get("/company-profile")
      .then((r) => setCompany(r.data ?? null))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load company profile")))
      .finally(() => setCompanyLoading(false));
  }, [open]);

  const rows = useMemo(
    () =>
      (a?.bookings ?? []).map((b, i) => ({
        index: i + 1,
        bookingRef: b.bookingRef || "—",
        customer: b.customerName || "—",
        pickup: b.hotelName || b.address || "—",
        pax: b.totalPax ?? 0,
        collect: (b.settlements ?? [])
          .filter((s) => s.category?.flowType === "COLLECT_MONEY")
          .reduce((sum, s) => sum + Number(s.amount ?? 0), 0),
        refund: (b.settlements ?? [])
          .filter((s) => s.category?.flowType === "PAY_MONEY")
          .reduce((sum, s) => sum + Number(s.amount ?? 0), 0),
      })),
    [a],
  );

  const totalCollect = rows.reduce((sum, r) => sum + r.collect, 0);
  const totalRefund = rows.reduce((sum, r) => sum + r.refund, 0);
  const totalPax = rows.reduce((sum, r) => sum + r.pax, 0);
  const printedAt = dayjs().format("DD MMM YYYY");

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
        @page { size: A4; margin: 0; }
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
          .print-doc, .print-doc * { visibility: visible !important; }
          .print-doc {
            position: absolute !important;
            left: 0; top: 0; margin: 0;
            /* A4 with a binding margin on the LEFT for hole-punching */
            width: 210mm;
            min-height: 297mm;
            padding: 12mm 10mm 12mm 20mm !important;
            box-shadow: none !important;
            background: #fff !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-doc td, .print-doc th, .print-doc div, .print-doc span, .print-doc p, .print-doc table {
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-doc .tt-label-cell,
          .print-doc .tt-table-header th {
            font-weight: 700 !important;
            color: #000 !important;
          }
          .print-doc .tt-bold {
            font-weight: 700 !important;
          }
          .print-doc .tt-white,
          .print-doc .tt-white div,
          .print-doc .tt-white span,
          .print-doc .tt-white th {
            color: #fff !important;
            font-weight: 700 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .tt-paper { border-radius: 0; border-color: #000; }
          .tt-block td { border: 1px solid #000 !important; }
          .tt-zebra tr:nth-child(even) td { background: #f3f6fb !important; }
          /* Compress for A4 fit + narrow side margins for binding */
          .tt-pad-h { padding-left: 6mm !important; padding-right: 6mm !important; }
          .tt-pad-v { padding-top: 6mm !important; padding-bottom: 6mm !important; }
        }
      `}</style>

      {companyLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : a ? (
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
                  Tour Settlement Voucher
                </div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                  Phiếu quyết toán chuyến — print &amp; stamp
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
                      {["#", "Booking ref", "Customer", "Pickup / Hotel", "Pax", "Collect", "Refund"].map((h, i) => (
                        <th
                          key={h}
                          className="tt-white"
                          style={{
                            padding: "8px 10px",
                            textAlign: i >= 4 ? "right" : "left",
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
                      ))}
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
                        <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "right", color: EMERALD_DARK, fontWeight: 600 }}>{usd(r.collect)}</td>
                        <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "right" }}>{usd(r.refund)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#eef5f3" }}>
                      <td colSpan={4} style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700, color: NAVY_DARK }}>
                        TOTAL ({totalPax} pax)
                      </td>
                      <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700 }}>{totalPax}</td>
                      <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700, color: EMERALD_DARK }}>{usd(totalCollect)}</td>
                      <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "right", fontWeight: 700 }}>{usd(totalRefund)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No bookings on this bus" />
              )}
            </div>

            {/* ── Notes + signature row ── */}
            <div className="tt-pad-h tt-pad-v" style={{ padding: "14px 26px 22px" }}>
              <div style={{ fontSize: 12, marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 11, color: "#6b7280" }}>
                  Notes: ______________________________________________________________________
                </Text>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <tbody>
                  <tr>
                    {["Prepared by", "Accounting / Stamp", "Date"].map((t, i, arr) => (
                      <td
                        key={t}
                        style={{
                          textAlign: "center",
                          padding: "8px 0",
                          borderTop: `1px solid ${BORDER}`,
                          color: NAVY,
                          fontWeight: 600,
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
                      <td key={i} style={{ textAlign: "center", height: 40, verticalAlign: "top", width: `${100 / arr.length}%`, fontSize: 12 }}>
                        {t}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <Empty description="Select a tour" />
      )}
    </Modal>
  );
}
