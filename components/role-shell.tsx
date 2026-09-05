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
  CarOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
  MoonOutlined,
  SunOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  CalendarOutlined,
  RocketFilled,
  ProfileOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import NotificationCenter from "@/components/notification-center";

const { Header, Sider, Content } = Layout;

interface RoleShellProps {
  children: React.ReactNode;
  menuItems: { key: string; icon: React.ReactNode; label: string }[];
  roleLabel: string;
  roleColor: string;
}

export default function RoleShell({ children, menuItems, roleLabel, roleColor }: RoleShellProps) {
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

  const selectedKey = "/" + (pathname.split("/")[1] ?? "") + "/" + (pathname.split("/")[2] ?? "");
  const normalizedKey = selectedKey.replace(/\/+$/, "") || "/";

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
              {roleLabel}
            </Typography.Text>
          )}
        </Flex>
        <Menu
          mode="inline"
          selectedKeys={[normalizedKey]}
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
              <NotificationCenter />
              <Dropdown
                menu={{
                  items: [
                    {
                      key: "profile",
                      icon: <UserOutlined />,
                      label: "Profile",
                      onClick: () => router.push(`/${roleLabel.toLowerCase().replace(/\s+/g, "-")}/profile`),
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
                    style={{ backgroundColor: roleColor }}
                  />
                  <Typography.Text strong>{user.name ?? user.email}</Typography.Text>
                  <Tag color={roleColor} style={{ marginInlineEnd: 0 }}>
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
