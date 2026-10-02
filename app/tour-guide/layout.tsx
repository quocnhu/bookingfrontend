"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spin, Flex } from "antd";
import RoleShell from "@/components/role-shell";
import { CarOutlined, UserOutlined, FileTextOutlined, CalendarOutlined, DashboardOutlined } from "@ant-design/icons";
import { useApp, getDefaultRoute } from "@/lib/app-context";

const GUIDE_MENU = [
  { key: "/tour-guide/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/tour-guide/my-trips", icon: <CarOutlined />, label: "My Trips" },
  { key: "/tour-guide/submit-report", icon: <FileTextOutlined />, label: "Submit Report" },
  { key: "/tour-guide/day-off", icon: <CalendarOutlined />, label: "Day Off" },
  { key: "/tour-guide/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function TourGuideLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "TOUR_GUIDE" && user.role !== "ADMIN") {
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
    <RoleShell menuItems={GUIDE_MENU} roleLabel="Tour Guide" roleColor="#10B981">
      {children}
    </RoleShell>
  );
}
