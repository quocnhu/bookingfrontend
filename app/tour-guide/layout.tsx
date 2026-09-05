"use client";

import RoleShell from "@/components/role-shell";
import { CarOutlined, UserOutlined, FileTextOutlined, WalletOutlined } from "@ant-design/icons";

const GUIDE_MENU = [
  { key: "/tour-guide/my-trips", icon: <CarOutlined />, label: "My Trips" },
  { key: "/tour-guide/submit-report", icon: <FileTextOutlined />, label: "Submit Report" },
  { key: "/tour-guide/payments", icon: <WalletOutlined />, label: "Payments" },
  { key: "/tour-guide/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function TourGuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleShell menuItems={GUIDE_MENU} roleLabel="Tour Guide" roleColor="#10B981">
      {children}
    </RoleShell>
  );
}
