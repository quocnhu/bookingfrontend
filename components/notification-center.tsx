"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Badge,
  Button,
  Drawer,
  Flex,
  Grid,
  List,
  Popover,
  Tag,
  Typography,
  notification as antdNotification,
  theme as antdTheme,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  BellOutlined,
  CheckCircleFilled,
  CheckOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { useSocket } from "@/lib/use-socket";

const TYPE_COLORS: Record<string, string> = {
  ASSIGNED: "blue",
  TRANSFERRED: "orange",
  CANCELED: "red",
  REPORT_VERIFIED: "green",
  REPORT_REJECTED: "red",
  LEAVE_REQUESTED: "volcano",
  LEAVE_APPROVED: "green",
  LEAVE_REJECTED: "red",
  GENERAL: "default",
};

export default function NotificationCenter() {
  const { token } = antdTheme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { on, connected } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, unread] = await Promise.all([
        api.get("/notifications"),
        api.get("/notifications/unread-count"),
      ]);
      setNotifications(all.data);
      setUnreadCount(unread.data.count);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = useCallback(async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      antdNotification.destroy(id);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    const cleanup = on("notification", (notif: any) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      antdNotification.open({
        key: notif.id,
        message: notif.title,
        description: notif.body,
        placement: "topRight",
        duration: 6,
        btn: (
          <Button
            size="small"
            type="text"
            icon={<CheckOutlined />}
            onClick={() => markRead(notif.id)}
          >
            Mark as read
          </Button>
        ),
      });
    });
    return cleanup;
  }, [on, markRead]);

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) { message.error(getErrorMessage(e)); }
  };

  const liveTag = (
    <Tag color={connected ? "green" : "red"} style={{ margin: 0, fontSize: 10 }}>
      {connected ? "LIVE" : "OFFLINE"}
    </Tag>
  );

  const list = (
    <List
      size="small"
      split={false}
      dataSource={notifications}
      loading={loading}
      locale={{ emptyText: "No notifications" }}
      renderItem={(item: any) => (
        <div
          style={{
            cursor: item.read ? "default" : "pointer",
            border: `1px solid ${
              item.read ? token.colorBorderSecondary : token.colorPrimaryBorder
            }`,
            background: item.read ? token.colorBgContainer : `${token.colorPrimary}08`,
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 8,
          }}
          onClick={() => !item.read && markRead(item.id)}
        >
          <Flex align="flex-start" gap={8}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Flex align="center" gap={6} wrap style={{ marginBottom: 4 }}>
                <Tag
                  color={TYPE_COLORS[item.type] ?? "default"}
                  style={{ margin: 0, fontSize: 10 }}
                >
                  {item.type?.replaceAll("_", " ")}
                </Tag>
                <Typography.Text strong style={{ fontSize: 12, flex: 1, minWidth: 0 }}>
                  {item.title}
                </Typography.Text>
              </Flex>
              <Typography.Text
                type="secondary"
                style={{ fontSize: 11, wordBreak: "break-word" }}
              >
                {item.body}
              </Typography.Text>
              <div style={{ marginTop: 4, fontSize: 10, color: token.colorTextTertiary }}>
                {item.sender?.name && <span>{item.sender.name}</span>}
                <span>
                  {item.sender?.name ? " · " : ""}
                  {dayjs(item.createdAt).format("DD MMM · HH:mm")}
                </span>
              </div>
            </div>
            {item.read ? (
              <CheckCircleFilled
                title="Read"
                style={{ color: token.colorSuccess, fontSize: 14, marginTop: 2 }}
              />
            ) : (
              <Button
                size="small"
                type="text"
                title="Mark as read"
                icon={<CheckOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  markRead(item.id);
                }}
              />
            )}
          </Flex>
        </div>
      )}
    />
  );

  const popoverContent = (
    <div style={{ width: 380, maxWidth: "calc(100vw - 24px)", maxHeight: 440, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" }}>
        <Typography.Text strong>Notifications</Typography.Text>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {liveTag}
          {unreadCount > 0 && (
            <Button size="small" type="link" onClick={markAllRead} icon={<CheckOutlined />}>
              Mark all read
            </Button>
          )}
        </div>
      </div>
      {list}
    </div>
  );

  const bell = (
    <Badge count={unreadCount} size="small" offset={[-2, 4]}>
      <Button
        type="text"
        icon={<BellOutlined style={{ fontSize: 18 }} />}
        onClick={() => {
          if (isMobile) setDrawerOpen(true);
        }}
      />
    </Badge>
  );

  if (isMobile) {
    return (
      <>
        {bell}
        <Drawer
          title={
            <Flex align="center" gap={8}>
              <BellOutlined />
              <Typography.Text strong>Notifications</Typography.Text>
              {liveTag}
            </Flex>
          }
          extra={
            unreadCount > 0 ? (
              <Button size="small" type="link" onClick={markAllRead} icon={<CheckOutlined />}>
                Mark all read
              </Button>
            ) : null
          }
          placement="bottom"
          height="75vh"
          styles={{ body: { padding: "8px 12px 16px" } }}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        >
          {list}
        </Drawer>
      </>
    );
  }

  return (
    <Popover content={popoverContent} trigger="click" placement="bottomRight">
      {bell}
    </Popover>
  );
}
