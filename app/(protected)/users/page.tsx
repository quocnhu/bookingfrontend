"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Avatar,
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
  message,
  Checkbox,
  Popconfirm,
  Progress,
  Typography,
  Space,
  Upload,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  LoadingOutlined,
  SafetyOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import FilterBar from "@/components/filter-bar";

interface Permission {
  id: string;
  name: string;
  code: string;
}

interface Role {
  id: string;
  name: string;
  isSystem: boolean;
  permissions?: Permission[];
}

interface User {
  id: string;
  name: string | null;
  email: string;
  avatarUrl?: string | null;
  userType: string;
  isActive: boolean;
  role?: string | null;
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
  { value: "CUSTOMER", label: "Customer" },
];

const USER_TYPE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "office", label: "Office" },
  { value: "driver", label: "Driver" },
  { value: "guide", label: "Guide" },
  { value: "customer", label: "Customer" },
];

export default function UsersPage() {
  const { user: me, refreshProfile, hasPermission } = useApp();  const canManageUsers = hasPermission("user.create");
  const canManageRoles = hasPermission("role.manage");

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userForm] = Form.useForm();
  const [savingUser, setSavingUser] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [userTypeFilter, setUserTypeFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<boolean | undefined>();
  const [search, setSearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(10);
  const [rolePage, setRolePage] = useState(1);
  const [rolePageSize, setRolePageSize] = useState(10);

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    const userParams: Record<string, any> = {};
    if (search) userParams.q = search;
    if (roleFilter) userParams.role = roleFilter;
    if (userTypeFilter) userParams.userType = userTypeFilter;
    if (statusFilter !== undefined) userParams.isActive = statusFilter;
    const roleParams: Record<string, any> = {};
    if (roleSearch) roleParams.q = roleSearch;
    const [u, r, p] = await Promise.all([
      api.get("/users", { params: userParams }),
      api.get("/roles", { params: roleParams }),
      api.get("/permissions"),
    ]);
    setUsers(u.data.items ?? u.data ?? []);
    setRoles(r.data.items ?? r.data ?? []);
    setPerms(p.data.items ?? p.data ?? []);
  };

  useEffect(() => {
    if (canManageUsers || canManageRoles) load().catch((e) => message.error(getErrorMessage(e)));
  }, [roleFilter, userTypeFilter, statusFilter, search, roleSearch]);

  const resetUserFilters = () => {
    setSearch("");
    setRoleFilter(undefined);
    setUserTypeFilter(undefined);
    setStatusFilter(undefined);
  };

  const resetRoleFilters = () => {
    setRoleSearch("");
  };

  const openRoleModal = (role?: Role) => {
    setEditingRole(role ?? null);
    roleForm.setFieldsValue({ name: role?.name ?? "" });
    setSelectedPerms((role?.permissions ?? []).map((p) => p.id));
    setRoleModalOpen(true);
  };

  const saveRole = async () => {
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
      userType: u.userType ?? undefined,
      role: u.role ?? undefined,
      isActive: u.isActive,
      storageQuotaMb: u.storageQuotaMb ?? 3072,
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
    setSavingEdit(true);
    try {
      await api.put(`/users/${editingUser.id}`, values);
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

  const userColumns = centerColumns([
    indexColumn<User>(userPage, userPageSize),
    {
      title: "",
      dataIndex: "avatarUrl",
      key: "avatar",
      width: 48,
      render: (v: string | null) => (
        <Avatar size={32} src={v || undefined} icon={<UserOutlined />} />
      ),
    },
    { title: "Name", dataIndex: "name", key: "name", render: (v: any) => v ?? "—" },
    { title: "Email", dataIndex: "email", key: "email" },
    { title: "Type", dataIndex: "userType", key: "userType", render: (v: string) => <Tag>{v}</Tag> },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      render: (v: string | null, r: User) => {
        const isAdmin = me?.id === r.id;
        return v ? <Tag color="blue">{v}</Tag> : <Tag color="red">None</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "isActive",
      key: "isActive",
      render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag color="red">Disabled</Tag>),
    },
    {
      title: "Storage",
      key: "storage",
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

  const roleColumns = [
    indexColumn<Role>(rolePage, rolePageSize),
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "System",
      dataIndex: "isSystem",
      key: "isSystem",
      render: (v: boolean) => (v ? <Tag color="gold">System</Tag> : <Tag>Custom</Tag>),
    },
    {
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
  ];

  return (
    <div>
      {!canManageUsers && !canManageRoles && (
        <Typography.Text type="secondary">You have no access to user management.</Typography.Text>
      )}
      {(canManageUsers || canManageRoles) && (
      <Tabs
        items={[
          {
            key: "users",
            label: "Users",
            children: (
              <Card
                variant="borderless"
                title="Users"
                extra={
                  <Flex wrap gap={8} align="center">
                    <FilterBar
                      onSearch={(v) => {
                        setSearch(v.trim());
                      }}
                      onReset={resetUserFilters}
                      searchPlaceholder="Search name or email..."
                    >
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
                        placeholder="Type"
                        style={{ width: 130 }}
                        value={userTypeFilter}
                        onChange={setUserTypeFilter}
                        options={USER_TYPE_OPTIONS}
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
                    </FilterBar>
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
                  columns={userColumns}
                  dataSource={users}
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
                title="Roles"
                extra={
                  <Flex wrap gap={8} align="center">
                    <FilterBar
                      onSearch={(v) => {
                        setRoleSearch(v.trim());
                      }}
                      onReset={resetRoleFilters}
                      searchPlaceholder="Search role name..."
                    />
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
                  columns={roleColumns}
                  dataSource={roles}
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
              <Card variant="borderless" title="Permissions">
                <Row gutter={[12, 12]}>
                  {perms.map((p) => (
                    <Col key={p.id}>
                      <Tag color="geekblue">{p.code}</Tag>
                    </Col>
                  ))}
                </Row>
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
          <Form.Item name="avatarUrl" label="Avatar URL">
            <Input placeholder="https://example.com/avatar.jpg" />
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
          <Form.Item name="userType" label="User type" initialValue="admin">
            <Select
              options={[
                { value: "admin", label: "Admin" },
                { value: "office", label: "Office" },
                { value: "driver", label: "Driver" },
                { value: "guide", label: "Guide" },
                { value: "customer", label: "Customer" },
              ]}
            />
          </Form.Item>
          <Form.Item name="role" label="Role" initialValue="OFFICE">
            <Select options={ROLE_OPTIONS} />
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
              <Input placeholder="Or paste an avatar URL" />
            </Flex>
          </Form.Item>
          <Form.Item name="userType" label="User type">
            <Select
              allowClear
              options={[
                { value: "admin", label: "Admin" },
                { value: "office", label: "Office" },
                { value: "driver", label: "Driver" },
                { value: "guide", label: "Guide" },
                { value: "customer", label: "Customer" },
              ]}
            />
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
        <Row gutter={[8, 8]}>
          {perms.map((p) => (
            <Col key={p.id}>
              <Checkbox
                checked={selectedPermIds.includes(p.id)}
                onChange={(e) =>
                  setSelectedPermIds((prev) =>
                    e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                  )
                }
              >
                {p.code}
              </Checkbox>
            </Col>
          ))}
        </Row>
      </Modal>

      <Modal
        title={editingRole ? `Edit Role: ${editingRole.name}` : "Add Role"}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={saveRole}
        confirmLoading={savingRole}
        width={520}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="Role name"
            rules={[{ required: true, message: "Role name required" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Permissions">
            <Row gutter={[8, 8]}>
              {perms.map((p) => (
                <Col key={p.id}>
                  <Checkbox
                    checked={selectedPerms.includes(p.id)}
                    onChange={(e) =>
                      setSelectedPerms((prev) =>
                        e.target.checked
                          ? [...prev, p.id]
                          : prev.filter((id) => id !== p.id)
                      )
                    }
                  >
                    {p.code}
                  </Checkbox>
                </Col>
              ))}
            </Row>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
