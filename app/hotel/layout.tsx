"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flex, Spin } from "antd";
import {
  BankOutlined,
  DollarOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import RoleShell from "@/components/role-shell";
import { getDefaultRoute, useApp } from "@/lib/app-context";

const HOTEL_MENU = [
  {
    key: "/hotel/dashboard",
    icon: <BankOutlined />,
    label: "Dashboard",
  },
  {
    key: "/hotel/bookings",
    icon: <FileTextOutlined />,
    label: "Bookings",
  },
  {
    key: "/hotel/commission",
    icon: <DollarOutlined />,
    label: "Commission",
  },
];

export default function HotelLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && user.role !== "HOTEL" && user.role !== "ADMIN") {
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
    <RoleShell menuItems={HOTEL_MENU} roleLabel="Hotel Partner" roleColor="#D97706">
      {children}
    </RoleShell>
  );
}
