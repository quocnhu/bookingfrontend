"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Flex, Typography } from "antd";
import { CompassOutlined, LoginOutlined, DashboardOutlined } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";

export default function PublicHeader() {
  const router = useRouter();
  const { user, loading: authLoading } = useApp();

  return (
    <Flex
      justify="space-between"
      align="center"
      style={{ padding: "16px 24px", borderBottom: "1px solid var(--ant-color-border-secondary)" }}
    >
      <Link
        href="/"
        aria-label="Hana Tourist — home"
        style={{ display: "flex", alignItems: "center", gap: 10 }}
      >
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
          Hana Tourist
        </Typography.Title>
      </Link>
      <Flex gap={8} align="center">
        <Link href="/tours" style={{ fontSize: 14, padding: "0 8px" }}>
          All tours
        </Link>
        {authLoading ? null : user ? (
          <Button type="primary" icon={<DashboardOutlined />} onClick={() => router.push("/dashboard")}>
            Dashboard
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
