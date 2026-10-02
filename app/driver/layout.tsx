"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin, Flex } from "antd";
import RoleShell from "@/components/role-shell";
import { CarOutlined, DashboardOutlined, UserOutlined, CalendarOutlined } from "@ant-design/icons";
import { useApp, getDefaultRoute } from "@/lib/app-context";

const DRIVER_MENU = [
  { key: "/driver/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/driver/my-trips", icon: <CarOutlined />, label: "My Trips" },
  { key: "/driver/day-off", icon: <CalendarOutlined />, label: "Day Off" },
  { key: "/driver/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "DRIVER" && user.role !== "ADMIN") {
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
    <RoleShell menuItems={DRIVER_MENU} roleLabel="Driver" roleColor="#06B6D4">
      {children}
    </RoleShell>
  );
}
