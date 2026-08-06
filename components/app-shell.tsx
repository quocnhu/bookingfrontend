"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Layout,
  Menu,
  Avatar,
  Dropdown,
  Button,
  Spin,
  Tag,
  Flex,
  Typography,
  theme as antdTheme,
} from "antd";
import {
  DashboardOutlined,
  CarOutlined,
  TeamOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LoginOutlined,
  CloudOutlined,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RocketFilled,
} from "@ant-design/icons";
import { useApp } from "@/lib/app-context";

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard" },
  { key: "/tours", icon: <CarOutlined />, label: "Tours" },
  { key: "/bookings", icon: <FileTextOutlined />, label: "Bookings" },
  { key: "/drive", icon: <CloudOutlined />, label: "Drive" },
  { key: "/users", icon: <TeamOutlined />, label: "Users" },
  { key: "/audit", icon: <HistoryOutlined />, label: "Audit" },
  { key: "/auth-activities", icon: <LoginOutlined />, label: "Auth Activity" },
  { key: "/profile", icon: <UserOutlined />, label: "Profile" },
];

const roleColors: Record<string, { tag: string; avatar: string }> = {
  ADMIN: { tag: "gold", avatar: "#F59E0B" },
  OFFICE: { tag: "geekblue", avatar: "#6366F1" },
  TOUR_GUIDE: { tag: "green", avatar: "#10B981" },
  DRIVER: { tag: "cyan", avatar: "#06B6D4" },
  TRANSPORT_PROVIDER: { tag: "purple", avatar: "#8B5CF6" },
  CUSTOMER: { tag: "pink", avatar: "#EC4899" },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, theme, toggleTheme, logout } = useApp();
  const { token } = antdTheme.useToken();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  const selectedKey = "/" + (pathname.split("/")[1] ?? "");
  const roleColor = roleColors[user.role] ?? { tag: "blue", avatar: "#6366F1" };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="lg"
        collapsedWidth={64}
        collapsed={collapsed}
        trigger={null}
        theme={isDark ? "dark" : "light"}
        style={{ position: "sticky", top: 0, height: "100vh", overflow: "auto", zIndex: 20 }}
      >
        <Flex
          align="center"
          justify="center"
          gap={8}
          style={{ height: 56, borderBottom: `1px solid ${token.colorSplit}` }}
        >
          <RocketFilled style={{ color: token.colorPrimary, fontSize: 20 }} />
          {!collapsed && (
            <Typography.Text strong style={{ fontSize: 17, color: token.colorText }}>
              Booking
            </Typography.Text>
          )}
        </Flex>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => router.push(key)}
          style={{ borderInlineEnd: "none", paddingBlock: 8 }}
        />
      </Sider>
      <Layout>
        <Header>
          <Flex align="center" justify="space-between" gap={16} style={{ height: "100%" }}>
            <Flex align="center" gap={12}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed((c) => !c)}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              />
              <Typography.Text strong>Welcome, {user.name ?? user.email}</Typography.Text>
            </Flex>
            <Flex align="center" gap={16}>
              <Button
                type="text"
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
                aria-label="Toggle theme"
              />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "profile",
                      icon: <UserOutlined />,
                      label: "Profile",
                      onClick: () => router.push("/profile"),
                    },
                    { type: "divider" },
                    {
                      key: "logout",
                      icon: <LogoutOutlined />,
                      label: "Logout",
                      danger: true,
                      onClick: logout,
                    },
                  ],
                }}
              >
                <Flex
                  align="center"
                  gap={8}
                  style={{
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: token.colorFillQuaternary,
                  }}
                >
                  <Avatar
                    size="small"
                    src={user.avatarUrl || undefined}
                    icon={<UserOutlined />}
                    style={{ backgroundColor: roleColor.avatar }}
                  />
                  <Typography.Text strong>{user.name ?? user.email}</Typography.Text>
                  <Tag color={roleColor.tag} style={{ marginInlineEnd: 0 }}>
                    {user.role}
                  </Tag>
                </Flex>
              </Dropdown>
            </Flex>
          </Flex>
        </Header>
        <Content style={{ padding: 16 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
