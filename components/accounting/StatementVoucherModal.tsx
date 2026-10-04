"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Flex, Modal, Skeleton } from "antd";
import { message } from "@/lib/antd-message";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { calcStatementTotals, type StatementLine } from "./shared";

const NAVY = "#1f3a5f";
const NAVY_DARK = "#16263f";
const BORDER = "#d6deeb";
const INK = "#1a2333";

/** Max days rendered as a day-grid (crew-calendar style). Longer ranges
 *  fall back to the grouped trip list so the A4 sheet stays readable. */
const GRID_MAX_DAYS = 14;

export interface VoucherPayee {
  name: string;
  role?: string | null;
  groupLabel?: string | null;
  providerName?: string | null;
}

const vnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(n ?? 0);

const fmtD = (d?: string | null) =>
  d ? dayjs(d).format("DD/MM/YYYY") : "—";

function statusText(r: StatementLine): string {
  if (r.paid)
    return `Paid · ${r.paidToName ?? "—"}${r.periodToDate ? ` · thru ${fmtD(r.periodToDate)}` : ""}`;
  if (r.exportable) return "Unpaid — ready to export";
  if (!r.locked) return "Not locked yet";
  return r.settlesWith ? `Unpaid — settles with ${r.settlesWith}` : "Unpaid";
}

function netText(mode: string, r: StatementLine): { text: string; toCrew: boolean } {
  const v = r.amount ?? r.netAmount;
  if (v == null) return { text: "—", toCrew: false };
  const toCrew = mode === "ROUTE_PRICE" || r.flow === "PAY_MONEY";
  return { text: `${vnd(v)} ₫`, toCrew };
}

function tripDates(r: StatementLine): string {
  const s = fmtD(r.tourDate);
  const e = r.endDate && fmtD(r.endDate) !== s ? ` → ${fmtD(r.endDate)}` : "";
  return `${s}${e}`;
}

function coversDay(day: string, r: StatementLine): boolean {
  // day = YYYY-MM-DD; trip covers it when start <= day <= end.
  const s = dayjs(r.tourDate).format("YYYY-MM-DD");
  const e = dayjs(r.endDate ?? r.tourDate).format("YYYY-MM-DD");
  return s <= day && day <= e;
}

export default function StatementVoucherModal({
  open,
  onClose,
  payee,
  fromDate,
  toDate,
  mode,
  rows,
  paidThrough,
  note,
}: {
  open: boolean;
  onClose: () => void;
  payee: VoucherPayee;
  fromDate: string;
  toDate: string;
  mode: "SETTLEMENT" | "ROUTE_PRICE";
  rows: StatementLine[];
  paidThrough?: string | null;
  note?: string | null;
}) {
  const [company, setCompany] = useState<{
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    taxId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get("/company-profile")
      .then((r) => setCompany(r.data ?? null))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load company profile")))
      .finally(() => setLoading(false));
  }, [open ]);

  const totals = useMemo(
    () => calcStatementTotals(mode, rows),
    [mode, rows],
  );

  const days = useMemo(() => {
    const out: string[] = [];
    let d = dayjs(fromDate);
    const end = dayjs(toDate);
    while ((d.isBefore(end) || d.isSame(end, "day")) && out.length <= GRID_MAX_DAYS) {
      out.push(d.format("YYYY-MM-DD"));
      d = d.add(1, "day");
    }
    return out;
  }, [fromDate, toDate]);
  const gridTooWide =
    dayjs(toDate).diff(dayjs(fromDate), "day") + 1 > GRID_MAX_DAYS;

  const byDriver = useMemo(() => {
    const map = new Map<string, StatementLine[]>();
    for (const r of rows) {
      const k = r.driverName || "Unassigned driver";
      const arr = map.get(k) ?? [];
      arr.push(r);
      map.set(k, arr);
    }
    return [...map.entries()];
  }, [rows]);

  const title =
    mode === "ROUTE_PRICE" ? "Transport Provider Statement" : "Payment Statement";

  const th: React.CSSProperties = {
    padding: "7px 8px",
    textAlign: "center",
    background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 60%, #2d4d7a 100%)`,
    color: "#fff",
    border: `1px solid ${NAVY_DARK}`,
    fontWeight: 600,
    fontSize: 11,
  };
  const td: React.CSSProperties = {
    padding: "6px 8px",
    border: `1px solid ${BORDER}`,
    fontSize: 12,
  };
  const label: React.CSSProperties = {
    width: 130,
    padding: "6px 10px",
    fontWeight: 700,
    background: "#eef2f9",
    color: NAVY,
    border: `1px solid ${BORDER}`,
    fontSize: 12,
  };

  return (
    <Modal
      title={
        <Flex align="center" gap={8} className="stmt-no-print">
          <PrinterOutlined />
          <span>{title} (A4)</span>
        </Flex>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} className="stmt-no-print">
          Close
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          className="stmt-no-print"
          onClick={() => window.print()}
        >
          Print A4
        </Button>,
      ]}
      width={920}
      destroyOnClose
    >
      <style>{`
        @page { size: A4; margin: 10mm 12mm; }
        .stmt-doc { background: #fff !important; color: ${INK} !important; }
        .stmt-doc td, .stmt-doc th, .stmt-doc div, .stmt-doc span, .stmt-doc p { color: ${INK} !important; }
        .stmt-doc .stmt-white, .stmt-doc .stmt-white div, .stmt-doc .stmt-white span, .stmt-doc .stmt-white th { color: #fff !important; }
        @media print {
          body { overflow: visible !important; height: auto !important; }
          body * { visibility: hidden !important; }
          .ant-modal-wrap, .ant-modal, .ant-modal-content, .ant-modal-body,
          .stmt-doc, .stmt-doc * { visibility: visible !important; }
          .ant-modal { width: 100% !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .ant-modal-content { box-shadow: none !important; }
          .stmt-doc { display: block !important; position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; width: 100% !important; padding: 0 !important; box-shadow: none !important; }
          .stmt-no-print { display: none !important; }
          .stmt-doc, .stmt-doc * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {loading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <div className="stmt-doc" style={{ fontFamily: `Georgia, "Times New Roman", serif` }}>
          {/* ── Letterhead ── */}
          <div
            className="stmt-white"
            style={{
              background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 60%, #2d4d7a 100%)`,
              color: "#fff",
              padding: "18px 24px",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>{company?.name ?? "—"}</div>
            {company?.address && <div style={{ fontSize: 12, opacity: 0.9 }}>{company.address}</div>}
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {[company?.phone && `Tel: ${company.phone}`, company?.email && company.email]
                .filter(Boolean)
                .join("  ·  ")}
              {company?.taxId ? `  ·  Tax ID: ${company.taxId}` : ""}
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", marginTop: 10, textAlign: "center" }}>
              {title}
            </div>
            <div style={{ fontSize: 12, textAlign: "center", opacity: 0.9 }}>
              {fmtD(fromDate)} → {fmtD(toDate)}
              {paidThrough ? `  ·  Paid through ${fmtD(paidThrough)}` : ""}
            </div>
          </div>

          {/* ── Payee block ── */}
          <div style={{ padding: "14px 24px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={label}>Payee</td>
                  <td style={td}><b>{payee.name}</b>{payee.role ? ` · ${payee.role}` : ""}</td>
                  <td style={label}>Group</td>
                  <td style={td}>{payee.groupLabel ?? "—"}</td>
                </tr>
                <tr>
                  <td style={label}>Belongs to</td>
                  <td style={td}>{payee.providerName ?? "—"}</td>
                  <td style={label}>Work days</td>
                  <td style={td}>{rows.length} trip{rows.length > 1 ? "s" : ""}</td>
                </tr>
                {note && (
                  <tr>
                    <td style={label}>Note</td>
                    <td colSpan={3} style={td}>{note}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Provider day-grid (crew-calendar style) ── */}
          {mode === "ROUTE_PRICE" && !gridTooWide && byDriver.length > 0 && (
            <div style={{ padding: "14px 24px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 6 }}>
                Where the drivers went (day grid)
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>Driver</th>
                    {days.map((d) => (
                      <th key={d} style={{ ...th, fontSize: 10, padding: "6px 2px" }}>
                        {dayjs(d).format("DD/MM")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byDriver.map(([name, list]) => (
                    <tr key={name}>
                      <td style={{ ...td, fontWeight: 700, fontSize: 11 }}>{name}</td>
                      {days.map((d) => {
                        const hit = list.find((r) => coversDay(d, r));
                        return (
                          <td key={d} style={{ ...td, textAlign: "center", fontSize: 10, background: hit ? "#e6f7ff" : undefined }}>
                            {hit ? (hit.code ?? "✓") : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {mode === "ROUTE_PRICE" && gridTooWide && (
            <div style={{ padding: "10px 24px 0", fontSize: 12 }}>
              Day grid hidden — range is longer than {GRID_MAX_DAYS} days; see the trip list below.
            </div>
          )}

          {/* ── Trip list (where they went) ── */}
          <div style={{ padding: "14px 24px 0" }}>
            {mode === "ROUTE_PRICE" ? (
              byDriver.map(([name, list]) => {
                const sub = list.reduce((s, r) => s + (r.amount ?? r.netAmount ?? 0), 0);
                return (
                  <div key={name} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>
                      {name} — {list.length} trip{list.length > 1 ? "s" : ""} — subtotal {vnd(sub)} ₫
                    </div>
                    <TripTable th={th} td={td} rows={list} mode={mode} />
                  </div>
                );
              })
            ) : (
              <TripTable th={th} td={td} rows={rows} mode={mode} />
            )}
          </div>

          {/* ── Totals + final result ── */}
          <div style={{ padding: "14px 24px 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {mode === "ROUTE_PRICE" ? (
                  <tr>
                    <td style={label}>Company owes provider</td>
                    <td style={{ ...td, fontWeight: 800, fontSize: 14 }}>{vnd(totals.toCrew)} ₫</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td style={label}>Crew returns to company</td>
                      <td style={{ ...td, fontWeight: 700 }}>{vnd(totals.toCompany)} ₫</td>
                    </tr>
                    <tr>
                      <td style={label}>Company returns to crew</td>
                      <td style={{ ...td, fontWeight: 700 }}>{vnd(totals.toCrew)} ₫</td>
                    </tr>
                    <tr>
                      <td style={label}>Final result</td>
                      <td style={{ ...td, fontWeight: 800, fontSize: 14 }}>
                        {totals.finalNet > 0
                          ? `Trip creators return ${vnd(totals.finalNet)} ₫ to the company`
                          : totals.finalNet < 0
                            ? `Company returns ${vnd(Math.abs(totals.finalNet))} ₫ to the trip creators`
                            : "Balanced — no money due"}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
            <div style={{ fontSize: 11, marginTop: 4 }}>
              Totals count locked trips only ({totals.lockedCount} of {rows.length} have locked money).
            </div>
          </div>

          {/* ── Signatures ── */}
          <div style={{ padding: "26px 24px 10px", display: "flex", gap: 24 }}>
            {["Prepared by (Accounting)", "Payee confirmation"].map((t) => (
              <div key={t} style={{ flex: 1, textAlign: "center", fontSize: 12 }}>
                <div style={{ fontWeight: 700 }}>{t}</div>
                <div style={{ marginTop: 56, borderTop: "1px solid #999", paddingTop: 4 }}>
                  (sign &amp; full name)
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: "0 24px 16px", fontSize: 11, textAlign: "right" }}>
            Printed {dayjs().format("DD/MM/YYYY HH:mm")}
          </div>
        </div>
      )}
    </Modal>
  );
}

function TripTable({
  th,
  td,
  rows,
  mode,
}: {
  th: React.CSSProperties;
  td: React.CSSProperties;
  rows: StatementLine[];
  mode: "SETTLEMENT" | "ROUTE_PRICE";
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={th}>#</th>
          <th style={th}>Date</th>
          <th style={th}>Bus</th>
          <th style={{ ...th, textAlign: "left" }}>Tour (where)</th>
          {mode === "SETTLEMENT" && <th style={th}>Crew</th>}
          <th style={th}>Plate</th>
          <th style={th}>Provider</th>
          <th style={th}>Net</th>
          <th style={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const n = netText(mode, r);
          return (
            <tr key={r.assignmentId}>
              <td style={{ ...td, textAlign: "center" }}>{i + 1}</td>
              <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>{tripDates(r)}</td>
              <td style={{ ...td, textAlign: "center" }}>{r.code ?? "—"}</td>
              <td style={td}>{r.tourName ?? "—"}</td>
              {mode === "SETTLEMENT" && (
                <td style={{ ...td, fontSize: 11 }}>
                  {[r.myRole, r.guideName && `G:${r.guideName}`, r.driverName && `D:${r.driverName}`]
                    .filter(Boolean)
                    .join(" · ")}
                </td>
              )}
              <td style={{ ...td, textAlign: "center" }}>{r.plateNumber ?? "—"}</td>
              <td style={{ ...td, textAlign: "center" }}>{r.providerName ?? "—"}</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{n.text}</td>
              <td style={{ ...td, textAlign: "center", fontSize: 11 }}>{statusText(r)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
