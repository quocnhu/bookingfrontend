"use client";

import { useEffect, useState, useCallback } from "react";
import { Badge, Button, List, Popover, Tag, Typography, message, theme as antdTheme } from "antd";
import { BellOutlined, CheckOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useSocket } from "@/lib/use-socket";

const TYPE_COLORS: Record<string, string> = {
  ASSIGNED: "blue",
  TRANSFERRED: "orange",
  CANCELED: "red",
  REPORT_VERIFIED: "green",
  REPORT_REJECTED: "red",
  GENERAL: "default",
};

export default function NotificationCenter() {
  const { token } = antdTheme.useToken();
  const { on, connected } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    const cleanup = on("notification", (notif: any) => {
      setNotifications((prev) => [notif, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      message.info({ content: notif.title, duration: 4 });
    });
    return cleanup;
  }, [on]);

  const markRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) { message.error(getErrorMessage(e)); }
  };

  const markAllRead = async () => {
    try {
      await api.put("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) { message.error(getErrorMessage(e)); }
  };

  const content = (
    <div style={{ width: 360, maxHeight: 400, overflow: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 4px" }}>
        <Typography.Text strong>Notifications</Typography.Text>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <Tag color={connected ? "green" : "red"} style={{ margin: 0, fontSize: 10 }}>
            {connected ? "LIVE" : "OFFLINE"}
          </Tag>
          {unreadCount > 0 && (
            <Button size="small" type="link" onClick={markAllRead} icon={<CheckOutlined />}>
              Mark all read
            </Button>
          )}
        </div>
      </div>
      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: "No notifications" }}
        renderItem={(item: any) => (
          <List.Item
            style={{
              cursor: "pointer",
              background: item.read ? "transparent" : `${token.colorPrimary}08`,
              borderRadius: 8,
              padding: "8px 12px",
              marginBottom: 4,
            }}
            onClick={() => !item.read && markRead(item.id)}
          >
            <List.Item.Meta
              title={
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {!item.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: token.colorPrimary, flexShrink: 0 }} />}
                  <Tag color={TYPE_COLORS[item.type] ?? "default"} style={{ margin: 0, fontSize: 10 }}>
                    {item.type?.replace("_", " ")}
                  </Tag>
                  <Typography.Text strong style={{ fontSize: 12, flex: 1 }}>{item.title}</Typography.Text>
                </div>
              }
              description={
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {item.body}
                </Typography.Text>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <Badge count={unreadCount} size="small" offset={[-2, 4]}>
        <Button type="text" icon={<BellOutlined style={{ fontSize: 18 }} />} />
      </Badge>
    </Popover>
  );
}
