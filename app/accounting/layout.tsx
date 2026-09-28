"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin, Flex } from "antd";
import { FileDoneOutlined, DollarOutlined, UserOutlined } from "@ant-design/icons";
import RoleShell from "@/components/role-shell";
import { useApp, getDefaultRoute } from "@/lib/app-context";

const ACCOUNTING_MENU = [
  { key: "/accounting/verify", icon: <FileDoneOutlined />, label: "Verify Reports" },
  { key: "/accounting/settlements", icon: <DollarOutlined />, label: "Guide Settlements" },
  { key: "/accounting/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (
      !loading &&
      user &&
      user.role !== "OFFICE" &&
      user.role !== "ADMIN"
    ) {
      router.replace(getDefaultRoute(user.role));
    }
  }, [loading, user, router]);

  if (!user) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <RoleShell
      menuItems={ACCOUNTING_MENU}
      roleLabel="Accounting"
      roleColor="#F59E0B"
    >
      {children}
    </RoleShell>
  );
}