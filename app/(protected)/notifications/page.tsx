"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Flex,
  Input,
  Select,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { SendOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

interface RoleGroup {
  key: string;
  label: string;
  count: number;
}

interface TargetUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

export default function NotificationsPage() {
  const { hasPermission } = useApp();
  const canSend = hasPermission("notification.send");

  const [roles, setRoles] = useState<RoleGroup[]>([]);
  const [users, setUsers] = useState<TargetUser[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);

  const loadTargets = useCallback(async () => {
    try {
      const r = await api.get("/notifications/targets");
      setRoles(r.data?.roleGroups ?? []);
      setUsers(r.data?.users ?? []);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load recipients"));
    }
  }, []);

  useEffect(() => {
    if (canSend) loadTargets();
  }, [canSend, loadTargets]);

  const searchUsers = async (q?: string) => {
    try {
      setSearching(true);
      const r = await api.get("/notifications/targets", {
        params: q ? { search: q } : undefined,
      });
      setUsers(r.data?.users ?? []);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const selectedRolePicks = roles.filter((r) => selectedRoles.includes(r.key));
  const selectedUserPicks = users.filter((u) => selectedUsers.includes(u.id));

  const recipientCount = useMemo(() => {
    const rolesCount = selectedRolePicks.reduce((s, r) => s + r.count, 0);
    return rolesCount + selectedUsers.length;
  }, [selectedRolePicks, selectedUsers.length]);

  const ready = title.trim().length > 0 && body.trim().length > 0 && recipientCount > 0;

  const send = async () => {
    if (!ready) {
      message.warning("Fill in title, message and pick at least one recipient");
      return;
    }
    try {
      setSending(true);
      const r = await api.post("/notifications/send", {
        title: title.trim(),
        body: body.trim(),
        roleTypes: selectedRoles,
        userIds: selectedUsers,
      });
      message.success(`Sent to ${r.data.sent} recipient(s)`);
      setTitle("");
      setBody("");
      setSelectedRoles([]);
      setSelectedUsers([]);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  if (!canSend) {
    return (
      <div style={{ padding: 4 }}>
        <Card style={{ borderRadius: 14 }}>
          <Typography.Text type="secondary">
            You don't have permission to send notifications.
          </Typography.Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 4 }}>
      <Card
        title={
          <Flex align="center" justify="space-between" wrap gap={8}>
            <Typography.Title level={5} style={{ margin: 0 }}>
              Send Notification
            </Typography.Title>
          </Flex>
        }
        styles={{ body: { padding: 16 } }}
        style={{ borderRadius: 14 }}
      >
        <Alert
          type="info"
          showIcon
          title="Send a message to a whole role group (all active users of that role) and/or to individual users. Recipients get it immediately in their Notification bell and a live popup."
          style={{ marginBottom: 16, fontSize: 12 }}
        />

        <Flex vertical gap={16}>
          <Flex vertical gap={6}>
            <Typography.Text strong>Title</Typography.Text>
            <Input
              placeholder="e.g. New route schedule announced"
              maxLength={120}
              showCount
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Flex>

          <Flex vertical gap={6}>
            <Typography.Text strong>Message</Typography.Text>
            <Input.TextArea
              placeholder="Write the message content…"
              rows={4}
              maxLength={2000}
              showCount
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Flex>

          <Flex gap={16} wrap>
            <Flex vertical gap={6} style={{ flex: 1, minWidth: 260 }}>
              <Typography.Text strong>
                <TeamOutlined /> Group (by role)
              </Typography.Text>
              <Select
                mode="multiple"
                allowClear
                placeholder="Select one or more roles"
                value={selectedRoles}
                onChange={setSelectedRoles}
                optionFilterProp="label"
                options={roles.map((r) => ({
                  value: r.key,
                  label: `${r.label} (${r.count})`,
                }))}
              />
            </Flex>

            <Flex vertical gap={6} style={{ flex: 1, minWidth: 260 }}>
              <Typography.Text strong>
                <UserOutlined /> Individual users (searchable)
              </Typography.Text>
              <Select
                mode="multiple"
                allowClear
                showSearch
                placeholder="Search by name or email"
                filterOption={false}
                loading={searching}
                value={selectedUsers}
                onChange={setSelectedUsers}
                onSearch={(q) => searchUsers(q || undefined)}
                onFocus={() => searchUsers()}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.name ?? u.email} · ${u.email}`,
                }))}
              />
            </Flex>
          </Flex>

          {selectedRolePicks.length + selectedUserPicks.length > 0 && (
            <>
              <Divider style={{ margin: "4px 0" }} />
              <Flex vertical gap={8}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Recipient preview — will be sent to{" "}
                  <Typography.Text strong>{recipientCount}</Typography.Text>{" "}
                  recipient(s):
                </Typography.Text>
                <Space size={[8, 8]} wrap>
                  {selectedRolePicks.map((r) => (
                    <Tag key={r.key} color="blue">
                      Group · {r.label} ({r.count})
                    </Tag>
                  ))}
                  {selectedUserPicks.map((u) => (
                    <Tag
                      key={u.id}
                      color="cyan"
                      closable
                      onClose={() =>
                        setSelectedUsers((prev) => prev.filter((id) => id !== u.id))
                      }
                    >
                      {u.name ?? u.email} · {u.email}
                    </Tag>
                  ))}
                </Space>
              </Flex>
            </>
          )}

          <Flex justify="flex-end">
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={sending}
              disabled={!ready}
              onClick={send}
            >
              Send{recipientCount > 0 ? ` to ${recipientCount}` : ""}
            </Button>
          </Flex>
        </Flex>
      </Card>
    </div>
  );
}