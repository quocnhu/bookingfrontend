"use client";

import RoleShell from "@/components/role-shell";
import { CarOutlined, FileTextOutlined, UserOutlined, CalendarOutlined, ProfileOutlined } from "@ant-design/icons";

const DRIVER_MENU = [
  { key: "/driver/my-trips", icon: <CarOutlined />, label: "My Trips" },
  { key: "/driver/day-off", icon: <CalendarOutlined />, label: "Day Off" },
  { key: "/driver/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell menuItems={DRIVER_MENU} roleLabel="Driver" roleColor="#06B6D4">
      {children}
    </RoleShell>
  );
}
