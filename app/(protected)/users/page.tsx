"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Avatar,
  Descriptions,
  Drawer,
  Dropdown,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Checkbox,
  Popconfirm,
  Progress,
  Typography,
  Space,
  Upload,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LoadingOutlined,
  SafetyOutlined,
  UploadOutlined,
  UserOutlined,
  MailOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import { api, API_URL, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { leftColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";

interface Permission {
  id: string;
  name: string;
  code: string;
  group?: string | null;
}

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions?: { permission: Permission }[];
}

interface User {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;

  isActive: boolean;
  authProvider?: string | null;
  role?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
  updatedAt?: string;
  hotelId?: string | null;
  providerId?: string | null;
  hotel?: {
    id: string;
    name: string;
    contactName?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    commissionPercent?: number | string | null;
    isActive?: boolean;
  } | null;
  provider?: {
    id: string;
    name: string;
    isCompany?: boolean;
    assignmentMode?: string | null;
  } | null;
  guideProfile?: {
    id: string;
    type?: string | null;
    languages?: string[];
    rating?: number | null;
  } | null;
  driverProfile?: {
    id: string;
    licenseNumber?: string | null;
    type?: string | null;
    rating?: number | null;
  } | null;
  roles?: { role: { id: string; name: string } }[];
  permissions?: { permission: { id: string; code: string } }[];
  storageQuotaMb?: number;
  storageUsedBytes?: number;
}

const MB = 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * MB) return `${(bytes / (1024 * MB)).toFixed(1)} GB`;
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "OFFICE", label: "Office" },
  { value: "TOUR_GUIDE", label: "Tour Guide" },
  { value: "DRIVER", label: "Driver" },
  { value: "TRANSPORT_PROVIDER", label: "Transport Provider" },
  { value: "TOURIST", label: "Tourist" },
];



const TAG_COLORS = [
  "magenta",
  "red",
  "volcano",
  "orange",
  "gold",
  "lime",
  "green",
  "cyan",
  "blue",
  "geekblue",
  "purple",
];

// Assigns a stable, distinct color to any role/type — new roles added in the
// future get a color automatically from the palette (deterministic by name).
function colorFor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function PermissionPicker({
  perms,
  selected,
  onToggle,
  disabled = false,
}: {
  perms: Permission[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of perms) {
      const g = p.group || "Other";
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [perms]);

  return (
    <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
      {grouped.map(([group, items]) => (
        <div key={group} style={{ marginBottom: 12 }}>
          <Typography.Text
            strong
            style={{
              fontSize: 12,
              textTransform: "uppercase" as const,
              color: "#8c8c8c",
              letterSpacing: 0.4,
            }}
          >
            {group}
          </Typography.Text>
          <Row gutter={[8, 8]} style={{ marginTop: 4 }}>
            {items.map((p) => (
              <Col key={p.id}>
                <Checkbox
                  checked={selected.includes(p.id)}
                  disabled={disabled}
                  onChange={(e) => onToggle(p.id, e.target.checked)}
                >
                  {p.code}
                </Checkbox>
              </Col>
            ))}
          </Row>
        </div>
      ))}
    </div>
  );
}

export default function UsersPage() {
  const { user: me, refreshProfile, hasPermission } = useApp();  const canManageUsers = hasPermission("user.create");
  const canManageRoles = hasPermission("role.manage");

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);

  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [mailboxesLoading, setMailboxesLoading] = useState(false);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm] = Form.useForm();
  const [savingUser, setSavingUser] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>();
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(20);
  const [rolePage, setRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(20);
  const [permPage, setPermPage] = useState(1);
  const [permPageSize, setPermPageSize] = useState(20);
  const [permTable, setPermTable] = useState<Permission[]>([]);
  const [permTotal, setPermTotal] = useState(0);
  const [permLoading, setPermLoading] = useState(false);
  const [providers, setProviders] = useState<{ id: string; name: string; isCompany?: boolean }[]>([]);
  const [hotels, setHotels] = useState<{ id: string; name: string }[]>([]);

  const [activeTab, setActiveTab] = useState("users");
  const tableHeight = useFillHeight({
    rootSelector: ".users-page",
    activeTab,
    deps: [users.length, roles.length, mailboxes.length],
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [detailUser, setDetailUser] = useState<User | null>(null);

  const [permUser, setPermUser] = useState<User | null>(null);
  const [permModalOpen, setPermModalOpen] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleForm] = Form.useForm();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  const load = async () => {
    const userParams: Record<string, any> = { limit: 100 };
    if (roleFilter) userParams.role = roleFilter;
    if (statusFilter !== undefined) userParams.isActive = statusFilter;
    try {
      const [u, r, p, pr, h] = await Promise.all([
        api.get("/users", { params: userParams }),
        canManageRoles ? api.get("/roles") : Promise.resolve({ data: [] }),
        canManageRoles ? api.get("/permissions/all") : Promise.resolve({ data: [] }),
        canManageUsers ? api.get("/transportation-providers").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        canManageUsers ? api.get("/hotels").catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      setUsers(u.data.items ?? u.data ?? []);
      setRoles(r.data.items ?? r.data ?? []);
      setPerms(p.data ?? []);
      setProviders((pr.data ?? []).map((x: any) => ({ id: x.id, name: x.name, isCompany: x.isCompany })));
      setHotels((h.data ?? []).map((x: any) => ({ id: x.id, name: x.name })));
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    if (canManageUsers || canManageRoles) load().catch(() => {});
  }, [roleFilter, statusFilter]);

  const canManageMailbox = hasPermission("gmail.manage");

  const loadMailboxes = () => {
    setMailboxesLoading(true);
    api
      .get("/gmail/accounts")
      .then((r) => setMailboxes(r.data ?? []))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load mailboxes")))
      .finally(() => setMailboxesLoading(false));
  };

  useEffect(() => {
    if (canManageMailbox) loadMailboxes();
  }, [canManageMailbox]);

  const connectMailbox = (accountId?: string) => {
    window.location.href = accountId
      ? `${API_URL}/gmail/connect?accountId=${encodeURIComponent(accountId)}`
      : `${API_URL}/gmail/connect`;
  };

  const reconnectMailbox = (account: any) => {
    connectMailbox(account.id);
  };

  const testMailbox = async (account: any) => {
    try {
      const r = await api.post(`/gmail/accounts/${account.id}/test`);
      message.success(
        `Connected: ${r.data?.email ?? account.email}${
          r.data?.historyId ? ` · history ${r.data.historyId}` : ""
        }`,
      );
      loadMailboxes();
    } catch (e) {
      message.error(getErrorMessage(e, "Refresh token invalid — reconnect"));
    }
  };

  const renewWatch = async (account: any) => {
    try {
      const r = await api.post(`/gmail/accounts/${account.id}/renew-watch`);
      message.success(
        r.data?.watchExpiration
          ? `Watch renewed until ${new Date(r.data.watchExpiration).toLocaleString()}`
          : "Watch renewed",
      );
      loadMailboxes();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to renew watch"));
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mailboxStatus = params.get("mailbox");
    const mailboxMessage = params.get("message");
    if (mailboxStatus && canManageMailbox) {
      if (mailboxStatus === "error") {
        message.error(decodeURIComponent(mailboxMessage ?? "Connect failed"));
      } else if (mailboxStatus === "connected") {
        message.success(decodeURIComponent(mailboxMessage ?? "Mailbox tracked"));
      } else if (mailboxStatus === "reconnected") {
        message.success(
          decodeURIComponent(mailboxMessage ?? "Mailbox reconnected"),
        );
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("mailbox");
      url.searchParams.delete("message");
      window.history.replaceState({}, "", url.toString());
      loadMailboxes();
    }
  }, [canManageMailbox]);

  const removeMailbox = async (account: any) => {
    try {
      await api.delete(`/gmail/accounts/${account.id}`);
      message.success(`Removed ${account.email}`);
      loadMailboxes();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to remove mailbox"));
    }
  };

  const openRoleModal = (role?: Role) => {
    setEditingRole(role ?? null);
    roleForm.setFieldsValue({ name: role?.name ?? "" });
    setSelectedPerms(
      role?.name === "ADMIN"
        ? perms.map((p) => p.id)
        : (role?.permissions ?? []).map((p) => p.permission.id),
    );
    setRoleModalOpen(true);
  };

  const saveRole = async () => {
    if (editingRole?.name === "ADMIN") return;
    const values = await roleForm.validateFields();
    setSavingRole(true);
    try {
      const payload = { ...values, permissionIds: selectedPerms };
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, payload);
      } else {
        await api.post("/roles", payload);
      }
      message.success("Role saved");
      setRoleModalOpen(false);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save role"));
    } finally {
      setSavingRole(false);
    }
  };

  const saveUser = async () => {
    const values = await userForm.validateFields();
    setSavingUser(true);
    try {
      await api.post("/users", values);
      message.success("User created");
      setUserModalOpen(false);
      userForm.resetFields();
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to create user"));
    } finally {
      setSavingUser(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    editForm.setFieldsValue({
      name: u.name ?? "",
      avatarUrl: u.avatarUrl ?? "",

      role: u.role ?? undefined,
      isActive: u.isActive,
      storageQuotaMb: u.storageQuotaMb ?? 3072,
      hotelId: u.hotelId ?? undefined,
      hotelCommissionPercent:
        u.hotel?.commissionPercent !== undefined && u.hotel?.commissionPercent !== null
          ? Number(u.hotel.commissionPercent)
          : undefined,
      providerId: u.providerId ?? undefined,
      guideProfile: u.guideProfile
        ? {
            type: u.guideProfile.type ?? undefined,
            languages: u.guideProfile.languages ?? [],
            rating: u.guideProfile.rating ?? 5,
          }
        : undefined,
      driverProfile: u.driverProfile
        ? {
            licenseNumber: u.driverProfile.licenseNumber ?? "",
            type: u.driverProfile.type ?? undefined,
            rating: u.driverProfile.rating ?? 5,
          }
        : undefined,
    });
    setEditModalOpen(true);
  };

  const uploadAvatarFor = async (file: File) => {
    if (!editingUser) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("userId", editingUser.id);
    setUploadingAvatar(true);
    try {
      const res = await api.post("/drive/avatar", fd);
      editForm.setFieldsValue({ avatarUrl: res.data.url ?? "" });
      if (editingUser.id === me?.id) refreshProfile();
      message.success("Avatar updated");
    } catch (e) {
      message.error(getErrorMessage(e, "Upload failed"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveEdit = async () => {
    const values = await editForm.validateFields();
    if (!editingUser) return;
    const role = values.role ?? editingUser.role;
    const payload: any = { ...values };
    if (role !== "TOUR_GUIDE") delete payload.guideProfile;
    if (role !== "DRIVER") delete payload.driverProfile;
    if (role !== "HOTEL") {
      payload.hotelId = null;
      delete payload.hotelCommissionPercent;
    }
    if (role !== "TRANSPORT_PROVIDER") payload.providerId = null;
    setSavingEdit(true);
    try {
      await api.put(`/users/${editingUser.id}`, payload);
      message.success("User updated");
      setEditModalOpen(false);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to update user"));
    } finally {
      setSavingEdit(false);
    }
  };

  const openPermModal = (u: User) => {
    setPermUser(u);
    setSelectedRoleIds((u.roles ?? []).map((r) => r.role.id));
    setSelectedPermIds((u.permissions ?? []).map((p) => p.permission.id));
    setPermModalOpen(true);
  };

  const savePerms = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    try {
      await api.put(`/users/${permUser.id}/roles`, {
        roleIds: selectedRoleIds,
        permissionIds: selectedPermIds,
      });
      message.success("Permissions updated");
      setPermModalOpen(false);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to update permissions"));
    } finally {
      setSavingPerms(false);
    }
  };

  const userColumns = leftColumns([
    indexColumn<User>(userPage, userPageSize),
    {
      title: "",
      dataIndex: "avatarUrl",
      key: "avatar",
      width: 48,
      filters: [
        { text: "Has avatar", value: "yes" },
        { text: "No avatar", value: "no" },
      ],
      onFilter: (v: any, r: User) => v === "yes" ? !!r.avatarUrl : !r.avatarUrl,
      render: (v: string | null) => (
        <Avatar size={32} src={v || undefined} icon={<UserOutlined />} />
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (v: any) => v ?? "—",
      onFilter: (v: any, r: User) => (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      onFilter: (v: any, r: User) => (r.email ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Provider",
      dataIndex: "authProvider",
      key: "authProvider",
      render: (v: string | null) =>
        v === "GOOGLE" ? <Tag color="blue">Google</Tag> : <Tag>Local</Tag>,
      filters: [
        { text: "Google", value: "GOOGLE" },
        { text: "Local", value: "LOCAL" },
      ],
      onFilter: (v: any, r: User) => (r.authProvider ?? "LOCAL") === v,
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (v: string | null, r: User) => {
        const isAdmin = me?.id === r.id;
        return v ? <Tag color={colorFor(v)}>{v}</Tag> : <Tag color="red">None</Tag>;
      },
      filters: Array.from(new Set(users.map((u) => u.role).filter(Boolean))).map((t) => ({ text: t!, value: t! })),
      onFilter: (v: any, r: User) => r.role === v,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag color="red">Disabled</Tag>),
      filters: [{ text: "Active", value: true }, { text: "Disabled", value: false }],
      onFilter: (v: any, r: User) => r.isActive === v,
    },
    {
      title: "Storage",
      key: "storage",
      filters: [
        { text: "Unlimited", value: "unlimited" },
        { text: "Normal", value: "normal" },
      ],
      onFilter: (v: any, r: User) => v === "unlimited" ? r.role === "ADMIN" : r.role !== "ADMIN",
      render: (_: any, r: User) => {
        if (r.role === "ADMIN") return <Tag color="gold">Unlimited</Tag>;
        const quotaMb = r.storageQuotaMb ?? 3072;
        const used = r.storageUsedBytes ?? 0;
        const quota = quotaMb * 1024 * 1024;
        const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
        return (
          <Flex vertical gap={2} style={{ minWidth: 120 }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatBytes(used)} / {formatBytes(quota)} · {pct}%
            </Typography.Text>
            <Progress
              percent={pct}
              size="small"
              showInfo={false}
              strokeColor={pct >= 90 ? "#EB5757" : pct >= 70 ? "#F2994A" : "var(--ant-color-primary)"}
              status={pct >= 100 ? "exception" : "normal"}
            />
          </Flex>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: User) => (
        <Space size={8}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailUser(r)}
            aria-label={`View ${r.email}`}
          />
          {canManageUsers && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(r)}
              aria-label={`Edit ${r.email}`}
            />
          )}
          {canManageUsers && (
            <Button
              size="small"
              icon={<SafetyOutlined />}
              onClick={() => openPermModal(r)}
              aria-label={`Permissions for ${r.email}`}
            />
          )}
          {canManageUsers && me?.id !== r.id && (
            <Popconfirm
              title="Delete this user?"
              onConfirm={async () => {
                try {
                  await api.delete(`/users/${r.id}`);
                  message.success("User deleted");
                  load();
                } catch (e) {
                  message.error(getErrorMessage(e));
                }
              }}
            >
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]);

  const mailboxColumns = leftColumns([
    indexColumn(1, 999),
    {
      title: "Mailbox",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (v: string) => (
        <Flex align="center" gap={8} style={{ minWidth: 0 }}>
          <MailOutlined style={{ color: "#3b82f6", flexShrink: 0 }} />
          <Tooltip title={v}>
            <Typography.Text strong ellipsis style={{ minWidth: 0 }}>
              {v}
            </Typography.Text>
          </Tooltip>
        </Flex>
      ),
      filters: Array.from(new Set(mailboxes.map((m: any) => m.email).filter(Boolean))).sort().map((e: any) => ({ text: e, value: e })),
      onFilter: (v: any, r: any) => (r.email ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Watch status",
      key: "watch",
      width: 145,
      filters: [{ text: "Active", value: true }, { text: "Expired", value: false }],
      onFilter: (v: any, r: any) => r.isWatchActive === v,
      render: (_: any, r: any) =>
        r.isWatchActive ? (
          <Tooltip title="Renews automatically when 1 day or less remains. Use Renew watch to reset it now.">
            <Tag color={r.expiresInDays <= 1 ? "orange" : "green"}>
              Active · {r.expiresInDays}d left
            </Tag>
          </Tooltip>
        ) : (
          <Tooltip title="The hourly renewal retries automatically; use Renew watch to retry now.">
            <Tag color="red">Expired</Tag>
          </Tooltip>
        ),
    },
    {
      title: "Last history ID",
      dataIndex: "lastHistoryId",
      key: "lastHistoryId",
      width: 125,
      filters: Array.from(new Set(mailboxes.map((m: any) => m.lastHistoryId).filter(Boolean))).sort().map((h: any) => ({ text: h, value: h })),
      onFilter: (v: any, r: any) => (r.lastHistoryId ?? "").toLowerCase().includes(String(v).toLowerCase()),
      render: (v: any) =>
        v ? (
          <Typography.Text code style={{ whiteSpace: "nowrap" }}>
            {v}
          </Typography.Text>
        ) : (
          "—"
        ),
    },
    {
      title: "Watch expires",
      dataIndex: "watchExpiration",
      key: "watchExpiration",
      width: 160,
      render: (v: any) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {v ? new Date(v).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      title: "Refresh token",
      dataIndex: "refreshTokenMasked",
      key: "refreshTokenMasked",
      width: 110,
      filters: Array.from(new Set(mailboxes.map((m: any) => m.refreshTokenMasked).filter(Boolean))).sort().map((t: any) => ({ text: t, value: t })),
      onFilter: (v: any, r: any) => (r.refreshTokenMasked ?? "").toLowerCase().includes(String(v).toLowerCase()),
      render: (v: any) =>
        v ? (
          <Typography.Text code style={{ whiteSpace: "nowrap" }}>
            {v}
          </Typography.Text>
        ) : (
          "—"
        ),
    },
    {
      title: "Connected",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      filters: Array.from(new Set(mailboxes.map((m: any) => m.createdAt ? new Date(m.createdAt).toLocaleDateString() : null).filter(Boolean))).sort().map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => r.createdAt ? new Date(r.createdAt).toLocaleDateString().includes(String(v)) : false,
      render: (v: any) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {v ? new Date(v).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      title: "Updated",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 160,
      filters: Array.from(new Set(mailboxes.map((m: any) => m.updatedAt ? new Date(m.updatedAt).toLocaleDateString() : null).filter(Boolean))).sort().map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: any) => r.updatedAt ? new Date(r.updatedAt).toLocaleDateString().includes(String(v)) : false,
      render: (v: any) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {v ? new Date(v).toLocaleString() : "—"}
        </span>
      ),
    },
    ...(canManageMailbox
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 120,
            render: (_: any, r: any) => (
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    {
                      key: "test",
                      label: "Test connection",
                    },
                    {
                      key: "renew",
                      label: "Renew watch",
                    },
                    {
                      key: "reconnect",
                      label: "Reconnect",
                    },
                    { type: "divider" as const },
                    {
                      key: "remove",
                      danger: true,
                      icon: <DeleteOutlined />,
                      label: "Remove mailbox",
                    },
                  ],
                  onClick: ({ key }) => {
                    if (key === "test") testMailbox(r);
                    else if (key === "renew") renewWatch(r);
                    else if (key === "reconnect") reconnectMailbox(r);
                    else if (key === "remove") removeMailbox(r);
                  },
                }}
              >
                <Button size="small" icon={<MoreOutlined />}>
                  Actions
                </Button>
              </Dropdown>
            ),
          },
        ]
      : []),
  ]);

  const roleColumns = leftColumns([
    indexColumn<Role>(rolePage, rolePageSize),
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      onFilter: (v: any, r: Role) => (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "System",
      dataIndex: "isSystem",
      key: "isSystem",
      render: (v: boolean) => (v ? <Tag color="gold">System</Tag> : <Tag>Custom</Tag>),
      filters: [{ text: "System", value: true }, { text: "Custom", value: false }],
      onFilter: (v: any, r: Role) => r.isSystem === v,
    },    {
      title: "Permissions",
      key: "perms",
      render: (_: any, r: Role) => (
        <span>{r.permissions?.length ?? 0} permissions</span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: Role) => {
        if (r.isSystem) return <Typography.Text type="secondary">Protected</Typography.Text>;
        return (
          <Popconfirm
            title="Delete this role?"
            onConfirm={async () => {
              try {
                await api.delete(`/roles/${r.id}`);
                message.success("Role deleted");
                load();
              } catch (e) {
                message.error(getErrorMessage(e));
              }
            }}
          >
            <Button danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        );
      },
    },
  ]);

  const loadPermissions = useCallback(async () => {
    setPermLoading(true);
    try {
      const r = await api.get("/permissions", {
        params: { page: permPage, limit: permPageSize },
      });
      setPermTable(r.data.items ?? []);
      setPermTotal(r.data.total ?? 0);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load permissions"));
    } finally {
      setPermLoading(false);
    }
  }, [permPage, permPageSize]);

  useEffect(() => {
    if (canManageRoles) loadPermissions().catch(() => {});
  }, [canManageRoles, loadPermissions]);

  const permissionColumns = leftColumns<Permission>([
    indexColumn<Permission>(permPage, permPageSize),
    {
      title: "Code",
      dataIndex: "code",
      key: "code",
      align: "left",
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
      filters: Array.from(new Set(perms.map((p) => p.code).filter(Boolean)))
        .sort()
        .map((c) => ({ text: c!, value: c! })),
      filterSearch: true,
      onFilter: (v: any, r: Permission) => r.code === v,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      align: "left",
      filters: Array.from(new Set(perms.map((p) => p.name).filter(Boolean)))
        .sort()
        .map((n) => ({ text: n!, value: n! })),
      filterSearch: true,
      onFilter: (v: any, r: Permission) =>
        (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Group",
      dataIndex: "group",
      key: "group",
      align: "left",
      render: (v: string | null | undefined) =>
        v ? <Tag color={colorFor(v)}>{v}</Tag> : "—",
      filters: Array.from(
        new Set(perms.map((p) => p.group).filter(Boolean) as string[]),
      )
        .sort()
        .map((g) => ({ text: g, value: g })),
      filterSearch: true,
      onFilter: (v: any, r: Permission) => r.group === v,
    },
  ]);

  return (
    <div className="users-page">
      <style>{`
        .users-page .ant-table-filter-column { display: inline-flex; }
      `}</style>
      {!canManageUsers && !canManageRoles && !canManageMailbox && (
        <Typography.Text type="secondary">You have no access to user management.</Typography.Text>
      )}
      {(canManageUsers || canManageRoles || canManageMailbox) && (
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          ...(canManageMailbox
            ? [
                {
                  key: "mailboxes",
                  label: (
                    <span>
                      <MailOutlined /> Mailboxes
                    </span>
                  ),
                  children: (
                    <Card
                      variant="borderless"
                      extra={
                        <Flex gap={8} align="center">
                          <Tooltip
                            title={
                              mailboxes.length >= 1
                                ? "Only one mailbox can be tracked. Reconnect or remove the existing mailbox first."
                                : ""
                            }
                          >
                            <Button
                              type="primary"
                              icon={<MailOutlined />}
                              disabled={mailboxes.length >= 1}
                              onClick={() => connectMailbox()}
                            >
                              Connect mailbox
                            </Button>
                          </Tooltip>
                        </Flex>
                      }
                    >
                      <Table
                        rowKey="id"
                        size="small"
                        columns={mailboxColumns}
                        dataSource={mailboxes}
                        loading={mailboxesLoading}
                        scroll={{ x: 1250, y: tableHeight }}
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          pageSizeOptions: PAGE_SIZE_OPTIONS,
                          showTotal: (t) => `Total: ${t}`,
                        }}
                      />
                    </Card>
                  ),
                },
              ]
            : []),
          {
            key: "users",
            label: "Users",
            children: (
              <Card
                variant="borderless"
                extra={
                  <Flex wrap gap={8} align="center">
                    <Select
                      allowClear
                      size="small"
                      placeholder="Role"
                      style={{ width: 150 }}
                      value={roleFilter}
                      onChange={setRoleFilter}
                      options={ROLE_OPTIONS}
                    />

                    <Select
                      allowClear
                      size="small"
                      placeholder="Status"
                      style={{ width: 120 }}
                      value={statusFilter}
                      onChange={setStatusFilter}
                      options={[
                        { value: true, label: "Active" },
                        { value: false, label: "Disabled" },
                      ]}
                    />
                    {canManageUsers && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setUserModalOpen(true)}
                      >
                        Add User
                      </Button>
                    )}
                  </Flex>
                }
              >
                <Table
                  rowKey="id"
                  size="small"
                  columns={userColumns}
                  dataSource={users}
                  scroll={{ x: 1000, y: tableHeight }}
                  pagination={{
                    current: userPage,
                    pageSize: userPageSize,
                    showSizeChanger: true,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    onChange: paginationChange(setUserPage, setUserPageSize, userPageSize),
                    showTotal: (t) => `Total: ${t}`,
                  }}
                />
              </Card>
            ),
          },
          {
            key: "roles",
            label: "Roles",
            children: (
              <Card
                variant="borderless"
                extra={
                  <Flex wrap gap={8} align="center">
                    {canManageRoles && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openRoleModal()}>
                        Add Role
                      </Button>
                    )}
                  </Flex>
                }
              >
                <Table
                  rowKey="id"
                  size="small"
                  columns={roleColumns}
                  dataSource={roles}
                  scroll={{ x: "max-content", y: tableHeight }}
                  pagination={{
                    current: rolePage,
                    pageSize: rolePageSize,
                    showSizeChanger: true,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    onChange: paginationChange(setRolePage, setRolePageSize, rolePageSize),
                    showTotal: (t) => `Total: ${t}`,
                  }}
                  onRow={(r) =>
                    canManageRoles
                      ? { onClick: () => openRoleModal(r), style: { cursor: "pointer" } }
                      : {}
                  }
                />
              </Card>
            ),
          },
          {
            key: "permissions",
            label: "Permissions",
            children: (
              <Card variant="borderless">
                <Table
                  rowKey="id"
                  size="small"
                  columns={permissionColumns}
                  dataSource={permTable}
                  loading={permLoading}
                  scroll={{ y: tableHeight }}
                  pagination={{
                    current: permPage,
                    pageSize: permPageSize,
                    showSizeChanger: true,
                    pageSizeOptions: PAGE_SIZE_OPTIONS,
                    total: permTotal,
                    onChange: paginationChange(setPermPage, setPermPageSize, permPageSize),
                    showTotal: (t) => `Total: ${t}`,
                  }}
                />
              </Card>
            ),
          },
        ]}
      />
      )}

      <Modal
        title="Add User"
        open={userModalOpen}
        onCancel={() => setUserModalOpen(false)}
        onOk={saveUser}
        confirmLoading={savingUser}
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ required: true, message: "Email required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, min: 6, message: "Min 6 characters" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="OFFICE">
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue("role") === "TOUR_GUIDE" ? (
                <Form.Item name={["guideProfile", "type"]} label="Guide type">
                  <Select
                    allowClear
                    options={[
                      { value: "OFFICIAL", label: "Company (Official)" },
                      { value: "FREELANCE", label: "Freelancer" },
                    ]}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue("role") === "DRIVER" ? (
                <>
                  <Form.Item name={["driverProfile", "type"]} label="Driver type">
                    <Select
                      allowClear
                      options={[
                        { value: "OFFICIAL", label: "Company (Official)" },
                        { value: "FREELANCE", label: "Freelancer" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item name="providerId" label="Transportation provider">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={providers.map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.isCompany ? " (Company)" : ""}`,
                      }))}
                    />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue("role") === "HOTEL" ? (
                <>
                  <Form.Item name="hotelId" label="Hotel">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={hotels.map((h) => ({ value: h.id, label: h.name }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="hotelCommissionPercent"
                    label="Commission %"
                    extra="Applied to every completed, paid booking linked to this hotel."
                  >
                    <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingUser ? `Edit User: ${editingUser.name ?? editingUser.email}` : "Edit User"}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={saveEdit}
        confirmLoading={savingEdit}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="Name">
            <Input />
          </Form.Item>
          <Form.Item name="avatarUrl" label="Avatar">
            <Flex gap={8} vertical>
              <Upload
                accept="image/png,image/jpeg"
                showUploadList={false}
                beforeUpload={(file) => {
                  uploadAvatarFor(file as File);
                  return false;
                }}
              >
                <Button
                  type="primary"
                  ghost
                  icon={
                    uploadingAvatar ? (
                      <LoadingOutlined />
                    ) : (
                      <UploadOutlined />
                    )
                  }
                  loading={uploadingAvatar}
                >
                  Upload picture (auto 515×515)
                </Button>
              </Upload>
            </Flex>
          </Form.Item>
          {editingUser?.id !== me?.id && (
            <Form.Item name="role" label="Role">
              <Select allowClear options={ROLE_OPTIONS} />
            </Form.Item>
          )}
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
          {editingUser?.id !== me?.id && (
            <Form.Item
              name="storageQuotaMb"
              label="Storage quota (MB)"
              extra="Admin users are unlimited. 3072 MB = 3 GB default."
            >
              <InputNumber min={1} max={2097152} style={{ width: "100%" }} />
            </Form.Item>
          )}

          <Form.Item noStyle shouldUpdate={(p, c) => p.role !== c.role}>
            {({ getFieldValue }) => {
              const role = getFieldValue("role") ?? editingUser?.role;
              if (role === "TOUR_GUIDE") {
                return (
                  <>
                    <Typography.Title level={5}>Guide profile</Typography.Title>
                    <Form.Item name={["guideProfile", "type"]} label="Guide type">
                      <Select options={[{ value: "OFFICIAL", label: "Official" }, { value: "FREELANCE", label: "Freelance" }]} />
                    </Form.Item>
                    <Form.Item name={["guideProfile", "languages"]} label="Languages">
                      <Select mode="tags" tokenSeparators={[","]} placeholder="English, Vietnamese" />
                    </Form.Item>
                    <Form.Item name={["guideProfile", "rating"]} label="Rating">
                      <InputNumber min={0} max={5} step={0.1} style={{ width: "100%" }} />
                    </Form.Item>
                  </>
                );
              }
              if (role === "DRIVER") {
                return (
                  <>
                    <Typography.Title level={5}>Driver profile</Typography.Title>
                    <Form.Item name={["driverProfile", "licenseNumber"]} label="License number">
                      <Input />
                    </Form.Item>
                    <Form.Item name={["driverProfile", "type"]} label="Driver type">
                      <Select options={[{ value: "COMPANY", label: "Company" }, { value: "FREELANCE", label: "Freelance" }]} />
                    </Form.Item>
                    <Form.Item name={["driverProfile", "rating"]} label="Rating">
                      <InputNumber min={0} max={5} step={0.1} style={{ width: "100%" }} />
                    </Form.Item>
                  </>
                );
              }
              if (role === "TRANSPORT_PROVIDER") {
                return (
                  <Form.Item name="providerId" label="Transportation provider">
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="label"
                      options={providers.map((p) => ({
                        value: p.id,
                        label: `${p.name}${p.isCompany ? " (Company)" : ""}`,
                      }))}
                    />
                  </Form.Item>
                );
              }
              if (role === "HOTEL") {
                return (
                  <>
                    <Form.Item name="hotelId" label="Hotel">
                      <Select
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        options={hotels.map((h) => ({ value: h.id, label: h.name }))}
                      />
                    </Form.Item>
                    <Form.Item
                      name="hotelCommissionPercent"
                      label="Commission %"
                      extra="Applies to every completed, paid booking linked to this hotel."
                    >
                      <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
                    </Form.Item>
                  </>
                );
              }
              return null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={permUser ? `Permissions: ${permUser.name ?? permUser.email}` : "Permissions"}
        open={permModalOpen}
        onCancel={() => setPermModalOpen(false)}
        onOk={savePerms}
        confirmLoading={savingPerms}
        width={520}
      >
        <Typography.Title level={5}>Roles</Typography.Title>
        <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
          {roles.map((r) => {
            const isSelf = permUser?.id === me?.id;
            const locked = isSelf && r.isSystem;
            return (
              <Col key={r.id}>
                <Checkbox
                  checked={selectedRoleIds.includes(r.id)}
                  disabled={locked}
                  onChange={(e) =>
                    setSelectedRoleIds((prev) =>
                      e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id),
                    )
                  }
                >
                  {r.name}
                </Checkbox>
              </Col>
            );
          })}
        </Row>
        <Typography.Title level={5}>Permissions</Typography.Title>
        <PermissionPicker
          perms={perms}
          selected={selectedPermIds}
          onToggle={(id, checked) =>
            setSelectedPermIds((prev) =>
              checked ? [...prev, id] : prev.filter((x) => x !== id),
            )
          }
        />
      </Modal>

      <Modal
        title={editingRole ? `Edit Role: ${editingRole.name}` : "Add Role"}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={saveRole}
        confirmLoading={savingRole}
        okButtonProps={{ disabled: editingRole?.name === "ADMIN" }}
        width={520}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="Role name"
            extra={
              editingRole
                ? "Role names are fixed after creation."
                : undefined
            }
            rules={[{ required: true, message: "Role name required" }]}
          >
            <Input disabled={Boolean(editingRole)} />
          </Form.Item>
          <Form.Item
            label="Permissions"
            extra={
              editingRole?.name === "ADMIN"
                ? "System role — the admin always has every permission."
                : undefined
            }
          >
            <PermissionPicker
              perms={perms}
              selected={
                editingRole?.name === "ADMIN"
                  ? perms.map((p) => p.id)
                  : selectedPerms
              }
              disabled={editingRole?.name === "ADMIN"}
              onToggle={(id, checked) =>
                setSelectedPerms((prev) =>
                  checked ? [...prev, id] : prev.filter((x) => x !== id),
                )
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detailUser ? `User Details: ${detailUser.name ?? detailUser.email}` : "User Details"}
        open={!!detailUser}
        onCancel={() => setDetailUser(null)}
        footer={
          <Space>
            {canManageUsers && detailUser && (
              <Button
                onClick={() => {
                  const u = detailUser;
                  setDetailUser(null);
                  openEditModal(u);
                }}
              >
                Edit
              </Button>
            )}
            <Button type="primary" onClick={() => setDetailUser(null)}>Close</Button>
          </Space>
        }
        width={760}
      >
        {detailUser && (
          <Flex vertical gap={16}>
            <Descriptions bordered size="small" column={2} title="Account">
              <Descriptions.Item label="Name">{detailUser.name ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailUser.email}</Descriptions.Item>
              <Descriptions.Item label="Role">
                {detailUser.role ? <Tag color={colorFor(detailUser.role)}>{detailUser.role}</Tag> : <Tag color="red">None</Tag>}
              </Descriptions.Item>

              <Descriptions.Item label="Status">
                {detailUser.isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Disabled</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Provider">
                {detailUser.authProvider === "GOOGLE" ? <Tag color="blue">Google</Tag> : <Tag>Local</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Last Login">
                {detailUser.lastLogin ? new Date(detailUser.lastLogin).toLocaleString() : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {detailUser.createdAt ? new Date(detailUser.createdAt).toLocaleString() : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Storage Quota">
                {detailUser.role === "ADMIN" ? <Tag color="gold">Unlimited</Tag> : `${detailUser.storageQuotaMb ?? 3072} MB`}
              </Descriptions.Item>
              <Descriptions.Item label="Storage Used">
                {formatBytes(detailUser.storageUsedBytes ?? 0)}
              </Descriptions.Item>
            </Descriptions>

            <Descriptions bordered size="small" column={2} title="Role Information">
              {detailUser.role === "TOUR_GUIDE" && (
                <>
                  <Descriptions.Item label="Guide Type">{detailUser.guideProfile?.type ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Rating">{detailUser.guideProfile?.rating ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Languages" span={2}>
                    {detailUser.guideProfile?.languages?.length ? detailUser.guideProfile.languages.join(", ") : "—"}
                  </Descriptions.Item>
                </>
              )}
              {detailUser.role === "DRIVER" && (
                <>
                  <Descriptions.Item label="Driver Type">{detailUser.driverProfile?.type ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="License Number">{detailUser.driverProfile?.licenseNumber ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Rating">{detailUser.driverProfile?.rating ?? "—"}</Descriptions.Item>
                </>
              )}
              {detailUser.role === "TRANSPORT_PROVIDER" && (
                <>
                  <Descriptions.Item label="Provider Name">{detailUser.provider?.name ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Company Fleet">
                    {detailUser.provider ? (detailUser.provider.isCompany ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>) : "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Assignment Mode">{detailUser.provider?.assignmentMode ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Provider ID">{detailUser.providerId ?? "—"}</Descriptions.Item>
                </>
              )}
              {detailUser.role === "HOTEL" && (
                <>
                  <Descriptions.Item label="Hotel Name">{detailUser.hotel?.name ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Contact Name">{detailUser.hotel?.contactName ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{detailUser.hotel?.phone ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Email">{detailUser.hotel?.email ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Address" span={2}>{detailUser.hotel?.address ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Commission %">{detailUser.hotel?.commissionPercent ?? "—"}</Descriptions.Item>
                  <Descriptions.Item label="Hotel Active">
                    {detailUser.hotel ? (detailUser.hotel.isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>) : "—"}
                  </Descriptions.Item>
                </>
              )}
              {!["TOUR_GUIDE", "DRIVER", "TRANSPORT_PROVIDER", "HOTEL"].includes(detailUser.role ?? "") && (
                <Descriptions.Item label="Additional Profile" span={2}>
                  No additional role-specific profile information.
                </Descriptions.Item>
              )}
            </Descriptions>

            <Descriptions bordered size="small" column={1} title="Access">
              <Descriptions.Item label="Roles">
                <Flex gap={4} wrap="wrap">
                  {(detailUser.roles ?? []).length
                    ? detailUser.roles!.map((r) => <Tag key={r.role.id} color={colorFor(r.role.name)}>{r.role.name}</Tag>)
                    : "—"}
                </Flex>
              </Descriptions.Item>
              <Descriptions.Item label="Extra Permissions">
                {(detailUser.permissions ?? []).length ? `${detailUser.permissions!.length} permission(s)` : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Flex>
        )}
      </Modal>

    </div>
  );
}