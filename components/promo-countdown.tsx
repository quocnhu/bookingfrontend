"use client";

import { useEffect, useState } from "react";
import { Flex, Typography } from "antd";
import { ThunderboltOutlined } from "@ant-design/icons";
import { promoEndsAt, splitDuration, type PromoFields } from "@/lib/promo";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Live countdown to the end of a tour promotion.
 * Renders nothing when there is no active promotion window.
 */
export default function PromoCountdown({
  tour,
  compact = false,
  bare = false,
  showLabel = true,
}: {
  tour: PromoFields;
  compact?: boolean;
  bare?: boolean;
  showLabel?: boolean;
}) {
  const [remaining, setRemaining] = useState(() => promoEndsAt(tour));

  useEffect(() => {
    setRemaining(promoEndsAt(tour));
    if (promoEndsAt(tour) <= 0) return;
    const id = setInterval(() => {
      const next = promoEndsAt(tour);
      setRemaining(next);
      if (next <= 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [tour]);

  if (remaining <= 0) return null;

  const { days, hours, minutes, seconds } = splitDuration(remaining);

  if (compact) {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
          padding: bare ? 0 : "4px 10px",
          borderRadius: bare ? 0 : 999,
          background: bare
            ? undefined
            : "linear-gradient(120deg, rgba(220,38,38,0.08), rgba(234,179,8,0.10))",
          border: bare ? undefined : "1px solid rgba(220,38,38,0.18)",
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        <ThunderboltOutlined style={{ color: "#dc2626", fontSize: 11 }} />
        {showLabel && (
          <Typography.Text
            strong
            style={{
              fontSize: 10,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              color: "#b91c1c",
            }}
          >
            Ends in
          </Typography.Text>
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#dc2626",
            fontVariantNumeric: "tabular-nums",
            letterSpacing: 0.3,
          }}
        >
          {pad(days)}d {pad(hours)}h {pad(minutes)}m {pad(seconds)}s
        </span>
      </div>
    );
  }

  const cells = [
    [days, "d"],
    [hours, "h"],
    [minutes, "m"],
    [seconds, "s"],
  ];

  return (
    <div
      style={{
        marginTop: 10,
        padding: "10px 12px",
        borderRadius: 12,
        background:
          "linear-gradient(120deg, rgba(220,38,38,0.08), rgba(234,179,8,0.10))",
        border: "1px solid rgba(220,38,38,0.18)",
      }}
    >
      <Typography.Text
        strong
        style={{
          fontSize: 11,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: "#dc2626",
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 6,
        }}
      >
        <ThunderboltOutlined /> Hurry — offer ends in
      </Typography.Text>
      <Flex gap={6} align="center" justify="space-between">
        {cells.map(([value, unit], i) => (
          <Flex
            key={i}
            vertical
            align="center"
            gap={2}
            style={{ flex: 1 }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                padding: "5px 0",
                borderRadius: 8,
                background: "#dc2626",
                color: "#fff",
                fontWeight: 800,
                fontSize: 16,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
                boxShadow: "0 2px 8px rgba(220,38,38,0.28)",
              }}
            >
              {pad(Number(value))}
            </span>
            <Typography.Text style={{ fontSize: 10, color: "#b91c1c" }}>
              {unit}
            </Typography.Text>
          </Flex>
        ))}
      </Flex>
    </div>
  );
}
