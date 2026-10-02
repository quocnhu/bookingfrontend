"use client";

import { useEffect, useMemo, useState } from "react";
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
  submittedByName?: string | null;
  submittedAt?: string | null;
  moneyVerifiedByName?: string | null;
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
    submittedByName?: string | null;
    submittedAt?: string | null;
    moneyVerifiedByName?: string | null;
  } | null;
}

function Voucher({
  a,
  company,
  tourReport,
}: {
  a: FullAssignmentData;
  company: CompanyProfile | null;
  tourReport?: TourReportData | null | undefined;
}) {
  /**
   * Collect/Refund per passenger, grouped from the settlements linked to a
   * bookingId. That way the print template (manifest) and the money sheet
   * always match.
   */
  const [cashByBooking, setCashByBooking] = useState<Map<string, { collected: number; paid: number }>>(
    new Map(),
  );
  const [moneyCategories, setMoneyCategories] = useState<Array<{
    name: string;
    flowType: string;
    collected: number;
    paid: number;
  }>>([]);

  useEffect(() => {
    if (!a?.id) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/assignments/${a.id}/money`);
        if (!alive) return;
        const map = new Map<string, { collected: number; paid: number }>();
        const catMap = new Map<string, { name: string; flowType: string; collected: number; paid: number }>();
        for (const row of data?.rows ?? []) {
          // Group by category first — trip-level entries have no bookingId
          // but must still appear in the breakdown.
          if (row.category) {
            const catCur = catMap.get(row.category.id) ?? {
              name: row.category.name,
              flowType: row.category.flowType,
              collected: 0,
              paid: 0,
            };
            if (row.category.flowType === "COLLECT_MONEY") catCur.collected += Number(row.amount) || 0;
            else catCur.paid += Number(row.amount) || 0;
            catMap.set(row.category.id, catCur);
          }
          if (!row?.bookingId) continue;
          const cur = map.get(row.bookingId) ?? { collected: 0, paid: 0 };
          if (row.category?.flowType === "COLLECT_MONEY") cur.collected += Number(row.amount) || 0;
          else cur.paid += Number(row.amount) || 0;
          map.set(row.bookingId, cur);
        }
        setCashByBooking(map);
        setMoneyCategories(Array.from(catMap.values()));
      } catch {
        if (alive) {
          setCashByBooking(new Map());
          setMoneyCategories([]);
        }
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

  // Breakdown totals computed from the same grouped rows shown below,
  // so the TOTAL always matches. Normalizes -0 to 0 for clean display.
  const bdCollected = moneyCategories.reduce((s, c) => s + c.collected, 0);
  const bdPaid = moneyCategories.reduce((s, c) => s + c.paid, 0);
  const bdNet = bdCollected - bdPaid === 0 ? 0 : bdCollected - bdPaid;
  const bdDirection =
    bdNet > 0
      ? `Tour guide returns to company: ${fmtVnd(bdNet)} VND`
      : bdNet < 0
        ? `Company returns to tour guide: ${fmtVnd(-bdNet)} VND`
        : "Settled — nothing to return";

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
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>{company?.name ?? "—"}</div>
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
          <Flex
            vertical
            align="center"
            justify="center"
            style={{ flex: 1, textAlign: "center" }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              Assignment and Spending Table
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
            <>
              <table className="tt-block tt-zebra" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["#", "Booking ref", "Customer", "Pickup / Hotel", "Pax", "Collected", "Refunded", ...(hasNotes ? ["Notes"] : [])].map((h) => {
                    return (
                    <th
                      key={h}
                      className="tt-white"
                      style={{
                        padding: "8px 10px",
                        textAlign: "center",
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
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center" }}>{r.index}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center" }}>{r.bookingRef}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center" }}>{r.customer}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center" }}>{r.pickup}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center" }}>{r.pax}</td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center", color: "#2f7a3f" }}>
                      {r.collected ? fmtVnd(r.collected) : "—"}
                    </td>
                    <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center", color: "#b02a37" }}>
                      {r.paid ? fmtVnd(r.paid) : "—"}
                    </td>
                    {hasNotes && (
                      <td style={{ padding: "6px 10px", border: `1px solid ${BORDER}`, textAlign: "center", color: r.notes ? "#8a6d3b" : "#adb5bd", fontStyle: r.notes ? "normal" : "italic" }}>
                        {r.notes || "—"}
                      </td>
                    )}
                  </tr>
                ))}
                <tr style={{ background: "#eef5f3" }}>
                  <td colSpan={4} style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "center", fontWeight: 700, color: NAVY_DARK }}>
                    TOTAL
                  </td>
                  <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "center", fontWeight: 700 }}>{totalPax}</td>
                  <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "center", fontWeight: 700, color: "#2f7a3f" }}>
                    {totalCollected ? fmtVnd(totalCollected) : "—"}
                  </td>
                  <td style={{ padding: "9px 10px", border: `1px solid ${BORDER}`, textAlign: "center", fontWeight: 700, color: "#b02a37" }}>
                    {totalPaid ? fmtVnd(totalPaid) : "—"}
                  </td>
                  {hasNotes && <td style={{ border: `1px solid ${BORDER}` }} />}
                </tr>
              </tbody>
            </table>
            </>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No bookings on this bus" />
          )}
        </div>

        {/* ── Notes + signature row ── */}
        <div className="tt-pad-h tt-pad-v" style={{ padding: "14px 26px 22px" }}>
          {/* Money category breakdown in notes area */}
          {moneyCategories.length > 0 && (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fafafa", border: `1px solid ${BORDER}`, borderRadius: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: NAVY, marginBottom: 8, display: "block" }}>Money Breakdown:</Text>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f0f0f0" }}>
                    <th style={{ padding: "6px 8px", border: `1px solid ${BORDER}`, textAlign: "center" }}>Category</th>
                    <th style={{ padding: "6px 8px", border: `1px solid ${BORDER}`, textAlign: "center", width: "80px" }}>Type</th>
                    <th style={{ padding: "6px 8px", border: `1px solid ${BORDER}`, textAlign: "center", width: "100px" }}>Collected</th>
                    <th style={{ padding: "6px 8px", border: `1px solid ${BORDER}`, textAlign: "center", width: "100px" }}>Paid</th>
                    <th style={{ padding: "6px 8px", border: `1px solid ${BORDER}`, textAlign: "center", width: "100px" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {moneyCategories.map((cat, idx) => (
                    <tr key={cat.name} style={{ background: idx % 2 ? "#f9f9f9" : "#fff" }}>
                      <td style={{ padding: "5px 8px", border: `1px solid ${BORDER}`, textAlign: "center" }}>{cat.name}</td>
                      <td style={{ padding: "5px 8px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
                        {cat.flowType === "COLLECT_MONEY" ? (
                          <span style={{ color: "#2f7a3f", fontWeight: 600, fontSize: 10 }}>Collect</span>
                        ) : (
                          <span style={{ color: "#b02a37", fontWeight: 600, fontSize: 10 }}>Expense</span>
                        )}
                      </td>
                      <td style={{ padding: "5px 8px", border: `1px solid ${BORDER}`, textAlign: "center", color: "#2f7a3f" }}>
                        {cat.collected ? fmtVnd(cat.collected) : "—"}
                      </td>
                      <td style={{ padding: "5px 8px", border: `1px solid ${BORDER}`, textAlign: "center", color: "#b02a37" }}>
                        {cat.paid ? fmtVnd(cat.paid) : "—"}
                      </td>
                      <td style={{ padding: "5px 8px", border: `1px solid ${BORDER}`, textAlign: "center", fontWeight: 600, color: cat.collected - cat.paid >= 0 ? "#2f7a3f" : "#b02a37" }}>
                        {fmtVnd(cat.collected - cat.paid)}
                      </td>
                    </tr>
                  ))}
                    <tr style={{ background: "#eef5f3", fontWeight: 700, fontSize: 11 }}>
                      <td colSpan={2} style={{ padding: "7px 8px", border: `1px solid ${BORDER}`, textAlign: "center", color: NAVY_DARK }}>TOTAL</td>
                      <td style={{ padding: "7px 8px", border: `1px solid ${BORDER}`, textAlign: "center", color: "#2f7a3f" }}>
                        {bdCollected ? fmtVnd(bdCollected) : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", border: `1px solid ${BORDER}`, textAlign: "center", color: "#b02a37" }}>
                        {bdPaid ? fmtVnd(bdPaid) : "—"}
                      </td>
                      <td style={{ padding: "7px 8px", border: `1px solid ${BORDER}`, textAlign: "center", color: bdNet >= 0 ? "#2f7a3f" : "#b02a37" }}>
                        {fmtVnd(bdNet)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 700, color: bdNet > 0 ? "#2f7a3f" : bdNet < 0 ? "#b02a37" : "#1a2333" }}>
                  {bdDirection}
                </div>
              </div>
            )}

          <div style={{ fontSize: 12, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 11, color: "#6b7280" }}>
              Notes: ______________________________________________________________________
            </Text>
          </div>
          {tourReport?.notes && (
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>Trip notes: </Text>
              <Text style={{ fontSize: 11.5 }}>{tourReport?.notes}</Text>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <tbody>
              <tr>
                {["Submitted by", "Accounting", "Date"].map((t, i, arr) => (
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
                    {t}
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ textAlign: "center", padding: "4px 0", fontSize: 12, color: "#1a2333" }}>
                  {tourReport?.submittedByName ?? "—"}
                </td>
                <td style={{ textAlign: "center", padding: "4px 0", fontSize: 12, color: "#1a2333" }}>
                  {tourReport?.moneyVerifiedByName ?? "—"}
                </td>
                <td style={{ textAlign: "center", padding: "4px 0", fontSize: 12, color: "#1a2333" }}>
                  {a.status === "COMPLETED" && (
                    <div style={{ fontSize: 24, color: "#16a34a", fontWeight: 800, lineHeight: 1.2 }}>
                      ✓
                    </div>
                  )}
                  {tourReport?.moneyVerifiedAt
                    ? dayjs(tourReport.moneyVerifiedAt).format("DD MMM YYYY HH:mm")
                    : printedAt}
                </td>
              </tr>
              <tr>
                {["____________", "____________", ""].map((t, i, arr) => (
                  <td key={i} style={{ textAlign: "center", height: 32, verticalAlign: "top", width: `${100 / arr.length}%`, fontSize: 12, color: "#1a2333" }}>
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

return (
    <Modal
      title={
        <Flex align="center" gap={8} className="no-print">
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
        /* NOTE: no size here on purpose — declaring a paper size locks
           Chrome's paper selector. Leaving it out lets you pick A4, A5,
           Letter, etc. freely under More settings. */
        /* Top kept tight so the template starts near the top; left keeps
           room for binding holes. Order: top right bottom left. */
        @page { margin: 3mm 10mm 10mm 20mm; }
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
          /* WYSIWYG: print exactly what the popup shows. Only visibility is
             flipped (hide app/modal chrome, show the manifest as-is) — no
             restyling, so colors, borders, spacing all match the screen. */
          body { overflow: visible !important; height: auto !important; }
          body * { visibility: hidden !important; }
          .ant-modal-wrap, .ant-modal, .ant-modal-content, .ant-modal-body,
          .print-doc, .print-doc * { visibility: visible !important; }
          .ant-modal {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .ant-modal-content { box-shadow: none !important; }
          .print-doc {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .no-print { display: none !important; }
          .print-doc, .print-doc * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {(companyLoading || assignmentLoading) ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : assignment ? (
        <div className="print-doc">
          <Voucher a={assignment} company={company} tourReport={assignment.tourReport ?? undefined} />
        </div>
      ) : (
        <Empty description="Select a tour" />
      )}
    </Modal>
  );
}