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
  Drawer,
  Grid,
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
  CompassOutlined,
  ProfileOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { BRAND } from "@/lib/site";
import NotificationCenter from "@/components/notification-center";

const { Header, Sider, Content } = Layout;

interface RoleShellProps {
  children: React.ReactNode;
  menuItems: { key: string; icon: React.ReactNode; label: string }[];
  roleLabel: string;
  roleColor: string;
}

export default function RoleShell({ children, menuItems, roleLabel, roleColor }: RoleShellProps) {
  const { user, company, loading, theme, toggleTheme, logout } = useApp();
  const { token } = antdTheme.useToken();
  const brandName = company?.shortName?.trim() || BRAND;
  const brandLogo = company?.logoUrl?.trim() || null;
  const screens = Grid.useBreakpoint();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = !screens.lg;
  const isNarrow = !screens.sm;
  const isDark = theme === "dark";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  if (loading || !user) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  const selectedKey = "/" + (pathname.split("/")[1] ?? "") + "/" + (pathname.split("/")[2] ?? "");
  const normalizedKey = selectedKey.replace(/\/+$/, "") || "/";

  const navigate = (key: string) => {
    router.push(key);
    setMobileNavOpen(false);
  };

  const navMenu = (
    <Menu
      mode="inline"
      selectedKeys={[normalizedKey]}
      items={menuItems}
      onClick={({ key }) => navigate(key)}
      style={{ borderInlineEnd: "none", paddingBlock: 8 }}
    />
  );

  return (
    <Layout className="role-shell" style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          breakpoint="lg"
          collapsedWidth={64}
          collapsed={collapsed}
          trigger={null}
          theme={isDark ? "dark" : "light"}
          style={{ position: "sticky", top: 0, height: "100vh", zIndex: 20, display: "flex", flexDirection: "column" }}
        >
          <Flex vertical style={{ height: "100%" }}>
            <Flex
              align="center"
              justify="center"
              gap={8}
              style={{ height: 56, borderBottom: `1px solid ${token.colorSplit}` }}
            >
              {brandLogo ? (
                <img
                  src={brandLogo}
                  alt={brandName}
                  style={{
                    height: 30,
                    maxWidth: collapsed ? 40 : 120,
                    objectFit: "contain",
                    borderRadius: 6,
                  }}
                />
              ) : (
                <CompassOutlined style={{ color: token.colorPrimary, fontSize: 20 }} />
              )}
              {!collapsed && (
                <Typography.Text strong ellipsis style={{ fontSize: 17, color: token.colorText, maxWidth: 140 }}>
                  {brandName}
                </Typography.Text>
              )}
            </Flex>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{navMenu}</div>
            <div
              style={{
                borderTop: `1px solid ${token.colorSplit}`,
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {collapsed ? "QN-HN" : "Designed by QN-HN"}
              </Typography.Text>
            </div>
          </Flex>
        </Sider>
      )}
      <Drawer
        title={
          <Flex align="center" gap={8} style={{ minWidth: 0 }}>
            {brandLogo ? (
              <img
                src={brandLogo}
                alt={brandName}
                style={{ height: 26, maxWidth: 120, objectFit: "contain", borderRadius: 6 }}
              />
            ) : (
              <CompassOutlined style={{ color: token.colorPrimary, fontSize: 20 }} />
            )}
            <Typography.Text strong ellipsis style={{ fontSize: 16, maxWidth: 170 }}>
              {brandName}
            </Typography.Text>
          </Flex>
        }
        open={isMobile && mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        placement="left"
        size={260}
        styles={{ body: { padding: 0 } }}
      >
        <Flex vertical style={{ height: "100%" }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{navMenu}</div>
          <div
            style={{
              borderTop: `1px solid ${token.colorSplit}`,
              padding: "10px 16px",
              textAlign: "center",
            }}
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Designed by QN-HN
            </Typography.Text>
          </div>
        </Flex>
      </Drawer>
      <Layout>
        <Header className="role-shell-header" style={{ paddingInline: isNarrow ? 8 : isMobile ? 16 : 24 }}>
          <Flex
            align="center"
            justify="space-between"
            gap={isNarrow ? 4 : 12}
            className="role-shell-header-row"
            style={{ height: "100%" }}
          >
            <Flex align="center" gap={8} className="role-shell-header-user" style={{ minWidth: 0 }}>
              <Button
                type="text"
                icon={
                  !isMobile ? (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />) : <MenuUnfoldOutlined />
                }
                onClick={() => (isMobile ? setMobileNavOpen((o) => !o) : setCollapsed((c) => !c))}
                aria-label={isMobile ? "Open navigation" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
              />
              {!isNarrow && (
                <Typography.Text strong ellipsis style={{ maxWidth: "100%" }}>
                  Welcome, {user.name ?? user.email}
                </Typography.Text>
              )}
            </Flex>
            <Flex align="center" gap={isNarrow ? 2 : 8} className="role-shell-header-actions">
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
                    padding: "6px 8px",
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
                  {!isMobile && (
                    <>
                      <Typography.Text strong>{user.name ?? user.email}</Typography.Text>
                      <Tag color={roleColor} style={{ marginInlineEnd: 0 }}>
                        {user.role}
                      </Tag>
                    </>
                  )}
                </Flex>
              </Dropdown>
            </Flex>
          </Flex>
        </Header>
        <Content>{children}</Content>
      </Layout>
    </Layout>
  );
}
