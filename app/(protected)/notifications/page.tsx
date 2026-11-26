"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Flex,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import { SearchOutlined, SendOutlined, TeamOutlined, UserOutlined } from "@ant-design/icons";
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

interface NotificationLogRecipient {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  read: boolean;
}

interface NotificationLogRow {
  id: string;
  createdAt: string;
  type: string;
  title: string;
  body: string;
  sender?: { id: string; name?: string | null; email?: string | null; role?: string | null } | null;
  recipients: NotificationLogRecipient[];
  recipientCount: number;
  toRoleTypes: string[];
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  OFFICE: "Office",
  TOUR_GUIDE: "Tour Guide",
  DRIVER: "Driver",
  TRANSPORT_PROVIDER: "Transport Provider",
  TOURIST: "Tourist",
  HOTEL: "Hotel",
  ACCOUNTING: "Accounting",
};

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
  const [sendOpen, setSendOpen] = useState(false);
  const [log, setLog] = useState<NotificationLogRow[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(15);
  const [logTotal, setLogTotal] = useState(0);
  const [senderRole, setSenderRole] = useState<string | undefined>();
  const [recipientRole, setRecipientRole] = useState<string | undefined>();
  const [logSearch, setLogSearch] = useState("");

  const loadTargets = useCallback(async () => {
    try {
      const r = await api.get("/notifications/targets");
      setRoles(r.data?.roleGroups ?? []);
      setUsers(r.data?.users ?? []);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load recipients"));
    }
  }, []);

  const loadLog = useCallback(async (page = 1, pageSize = logPageSize) => {
    try {
      setLogLoading(true);
      const r = await api.get("/notifications/log", {
        params: {
          page,
          limit: pageSize,
          ...(senderRole ? { senderRole } : {}),
          ...(recipientRole ? { recipientRole } : {}),
          ...(logSearch.trim() ? { search: logSearch.trim() } : {}),
        },
      });
      setLog(r.data?.items ?? []);
      setLogTotal(r.data?.total ?? 0);
      setLogPage(r.data?.page ?? page);
      setLogPageSize(r.data?.limit ?? pageSize);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load notification log"));
    } finally {
      setLogLoading(false);
    }
  }, [logPageSize, logSearch, recipientRole, senderRole]);

  useEffect(() => {
    if (canSend) loadTargets();
  }, [canSend, loadTargets]);

  useEffect(() => {
    if (canSend) loadLog(1);
  }, [canSend, loadLog]);

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
      setSendOpen(false);
      loadLog(1);
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

  const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

  const logColumns = [
    {
      title: "#",
      key: "index",
      width: 64,
      align: "center" as const,
      render: (_: unknown, __: NotificationLogRow, i: number) => (logPage - 1) * logPageSize + i + 1,
    },
    {
      title: "Sent at",
      dataIndex: "createdAt",
      width: 170,
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "From",
      key: "sender",
      width: 190,
      render: (_: unknown, row: NotificationLogRow) => {
        const s = row.sender;
        return (
          <Flex vertical gap={0}>
            <Typography.Text strong style={{ fontSize: 12 }}>{s?.name || s?.email || "System"}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{ROLE_LABELS[s?.role ?? ""] ?? s?.role ?? "—"}</Typography.Text>
          </Flex>
        );
      },
    },
    {
      title: "To",
      key: "recipients",
      width: 260,
      render: (_: unknown, row: NotificationLogRow) => (
        <Space size={[4, 4]} wrap>
          {row.toRoleTypes.map((r) => <Tag key={r} color="blue">{ROLE_LABELS[r] ?? r}</Tag>)}
          {row.recipients.slice(0, 3).map((r) => (
            <Tag key={r.id}>{r.name || r.email} · {ROLE_LABELS[r.role ?? ""] ?? r.role}</Tag>
          ))}
          {row.recipients.length > 3 && <Tag>+{row.recipients.length - 3} more</Tag>}
        </Space>
      ),
    },
    {
      title: "Title / Message",
      key: "content",
      render: (_: unknown, row: NotificationLogRow) => (
        <Flex vertical gap={2}>
          <Typography.Text strong>{row.title}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{row.body}</Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Recipients",
      dataIndex: "recipientCount",
      width: 100,
      align: "center" as const,
    },
  ];

  return (
    <div style={{ padding: 4 }}>
      <Modal
        title="Send Notification"
        open={sendOpen}
        onCancel={() => setSendOpen(false)}
        onOk={send}
        okText={`Send${recipientCount > 0 ? ` to ${recipientCount}` : ""}`}
        confirmLoading={sending}
        okButtonProps={{ disabled: !ready }}
        width={760}
        destroyOnHidden
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
        </Flex>
      </Modal>

      <Card
        title="Notification Log"
        extra={
          <Button type="primary" icon={<SendOutlined />} onClick={() => setSendOpen(true)}>
            Send Notification
          </Button>
        }
        style={{ borderRadius: 14 }}
        styles={{ body: { padding: 16 } }}
      >
        <Flex gap={8} wrap style={{ marginBottom: 12 }}>
          <Select allowClear placeholder="Sender role" style={{ width: 180 }} value={senderRole} onChange={setSenderRole} options={roleOptions} />
          <Select allowClear placeholder="Recipient role" style={{ width: 180 }} value={recipientRole} onChange={setRecipientRole} options={roleOptions} />
          <Input
            allowClear
            prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
            placeholder="Search title, message, recipient"
            style={{ width: 320 }}
            value={logSearch}
            onChange={(e) => setLogSearch(e.target.value)}
            onPressEnter={() => loadLog(1)}
          />
          <Button onClick={() => loadLog(1)}>Filter</Button>
        </Flex>
        <Table
          rowKey="id"
          size="small"
          loading={logLoading}
          columns={logColumns}
          dataSource={log}
          scroll={{ x: 1050 }}
          pagination={{
            current: logPage,
            total: logTotal,
            pageSize: logPageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 15, 20, 50],
            onChange: (p, ps) => loadLog(p, ps),
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} notifications`,
          }}
        />
      </Card>
    </div>
  );
}