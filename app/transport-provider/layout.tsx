"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin, Flex } from "antd";
import { TruckOutlined, CalendarOutlined, UserOutlined } from "@ant-design/icons";
import RoleShell from "@/components/role-shell";
import { useApp, getDefaultRoute } from "@/lib/app-context";

const PROVIDER_MENU = [
  { key: "/transport-provider/my-trips", icon: <CalendarOutlined />, label: "Fleet Trips" },
  { key: "/transport-provider/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function TransportProviderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "TRANSPORT_PROVIDER" && user.role !== "ADMIN") {
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
      menuItems={PROVIDER_MENU}
      roleLabel="Transport Provider"
      roleColor="#8B5CF6"
    >
      {children}
    </RoleShell>
  );
}