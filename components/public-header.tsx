"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Flex, Typography } from "antd";
import { CompassOutlined, LoginOutlined, ScheduleOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { BRAND } from "@/lib/site";

export default function PublicHeader() {
  const router = useRouter();
  const { user, company, loading: authLoading } = useApp();
  const brandName = company?.shortName?.trim() || BRAND;
  const brandLogo = company?.logoUrl?.trim() || null;

  return (
    <Flex
      justify="space-between"
      align="center"
      style={{ padding: "16px 24px", borderBottom: "1px solid var(--ant-color-border-secondary)" }}
    >
      <Link
        href="/"
        aria-label={`${brandName} — home`}
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
        {brandLogo ? (
          <img
            src={brandLogo}
            alt={brandName}
            style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 10 }}
          />
        ) : (
          <span
            style={{
              display: "inline-flex",
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: "#062A30",
              background: "linear-gradient(135deg, #22D3EE, #3B82F6)",
            }}
          >
            <CompassOutlined />
          </span>
        )}
        <Typography.Title
          level={4}
          style={{
            margin: 0,
            background: "linear-gradient(90deg, #22D3EE, #3B82F6)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {brandName}
        </Typography.Title>
      </Link>
      <Flex gap={8} align="center">
        <Link href="/tours" style={{ fontSize: 14, padding: "0 8px" }}>
          All tours
        </Link>
        {authLoading ? null : user ? (
          <Button
            type="primary"
            icon={<ScheduleOutlined />}
            onClick={() => router.push("/my-bookings")}
          >
            My bookings
          </Button>
        ) : (
          <Button icon={<LoginOutlined />} onClick={() => router.push("/login")}>
            Sign in
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
