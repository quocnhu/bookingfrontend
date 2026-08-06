"use client";

import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Col,
  Divider,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  Upload,
  theme as antdTheme,
  message,
} from "antd";
import {
  CameraOutlined,
  CheckCircleOutlined,
  IdcardOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LinkOutlined,
  LoadingOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const roleColors: Record<string, { tag: string; avatar: string }> = {
  ADMIN: { tag: "gold", avatar: "#F59E0B" },
  OFFICE: { tag: "geekblue", avatar: "#6366F1" },
  TOUR_GUIDE: { tag: "green", avatar: "#10B981" },
  DRIVER: { tag: "cyan", avatar: "#06B6D4" },
  TRANSPORT_PROVIDER: { tag: "purple", avatar: "#8B5CF6" },
  CUSTOMER: { tag: "pink", avatar: "#EC4899" },
};

const providerLabel: Record<string, string> = {
  LOCAL: "Local",
  GOOGLE: "Google",
};

function isValidImageUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ProfilePage() {
  const { user, refreshProfile } = useApp();
  const { token } = antdTheme.useToken();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState("");
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const profileName = Form.useWatch("name", profileForm);
  const passwordValues = Form.useWatch([], passwordForm);
  const profileDirty = profileName !== undefined && profileName !== (user?.name ?? "");
  const passwordDirty = Object.values(passwordValues ?? {}).some((v) => Boolean(v));

  useEffect(() => {
    if (user) profileForm.setFieldsValue({ name: user.name ?? "" });
  }, [user]);

  if (!user) return null;

  const roleColor = roleColors[user.role] ?? { tag: "blue", avatar: "#6366F1" };

  const openAvatarEditor = () => {
    setAvatarUrlDraft(user.avatarUrl ?? "");
    setAvatarOpen(true);
  };

  const uploadAvatarPicture = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setUploadingAvatar(true);
    try {
      await api.post("/drive/avatar", fd);
      message.success("Avatar updated");
      setAvatarOpen(false);
      refreshProfile();
    } catch (e) {
      message.error(getErrorMessage(e, "Upload failed"));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveAvatar = async () => {
    const url = avatarUrlDraft.trim();
    if (url && !isValidImageUrl(url)) {
      message.error("Please enter a valid public http(s) image URL");
      return;
    }
    setSavingAvatar(true);
    try {
      await api.put("/auth/profile", { avatarUrl: url || null });
      message.success("Avatar updated");
      setAvatarOpen(false);
      refreshProfile();
    } catch (e) {
      message.error(getErrorMessage(e, "Update failed"));
    } finally {
      setSavingAvatar(false);
    }
  };

  const saveProfile = async () => {
    const values = await profileForm.validateFields();
    setSavingProfile(true);
    try {
      await api.put("/auth/profile", values);
      message.success("Profile updated");
      refreshProfile();
    } catch (e) {
      message.error(getErrorMessage(e, "Update failed"));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    const values = await passwordForm.validateFields();
    setSavingPassword(true);
    try {
      await api.put("/auth/change-password", values);
      message.success("Password changed");
      passwordForm.resetFields();
    } catch (e) {
      message.error(getErrorMessage(e, "Change failed"));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      <Card variant="borderless" styles={{ body: { padding: 32 } }}>
        <Flex wrap gap={32} align="center" justify="space-between">
          <Flex align="center" gap={24}>
            <Flex
              style={{
                position: "relative",
                width: 104,
                height: 104,
                flexShrink: 0,
              }}
            >
              <Avatar
                size={104}
                src={user.avatarUrl || undefined}
                icon={<UserOutlined />}
                style={{ backgroundColor: roleColor.avatar, fontSize: 44 }}
              />
              <Button
                size="small"
                shape="circle"
                type="primary"
                icon={<CameraOutlined />}
                onClick={openAvatarEditor}
                aria-label="Update avatar"
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  boxShadow: token.boxShadowSecondary,
                }}
              />
            </Flex>
            <Flex vertical gap={2}>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {user.name ?? user.email}
              </Typography.Title>
              <Typography.Text type="secondary">
                <MailOutlined style={{ marginRight: 6 }} />
                {user.email}
              </Typography.Text>
              <Space style={{ marginTop: 10 }}>
                <Tag color={roleColor.tag} style={{ fontWeight: 700, textTransform: "uppercase" }}>
                  {user.role}
                </Tag>
                {user.userType && <Tag>{user.userType}</Tag>}
                {user.authProvider && (
                  <Tag icon={<CheckCircleOutlined />}>
                    {providerLabel[user.authProvider] ?? user.authProvider}
                  </Tag>
                )}
              </Space>
            </Flex>
          </Flex>
        </Flex>

        <Divider />

        <Row gutter={[32, 16]}>
          <Col xs={12} lg={6}>
            <Statistic
              title="Permissions"
              value={user.permissions?.length ?? 0}
              valueStyle={{ fontWeight: 700 }}
            />
          </Col>
          <Col xs={12} lg={6}>
            <Statistic
              title="Member since"
              value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              valueStyle={{ fontSize: 18, fontWeight: 700 }}
            />
          </Col>
          <Col xs={12} lg={6}>
            <Statistic
              title="Account ID"
              valueRender={() => (
                <Tooltip title={user.id ?? undefined} mouseEnterDelay={0.2}>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {user.id ? `${user.id.slice(0, 8)}…` : "—"}
                  </Typography.Text>
                </Tooltip>
              )}
            />
          </Col>
          <Col xs={12} lg={6}>
            <Statistic
              title="Status"
              value="Active"
              valueStyle={{ fontSize: 18, fontWeight: 700 }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            id="update-profile"
            title={
              <Space>
                <IdcardOutlined />
                Update Profile
              </Space>
            }
            style={{ height: "100%" }}
          >
            <Form form={profileForm} layout="vertical" initialValues={{ name: user.name ?? "" }}>
              <Form.Item
                name="name"
                label="Full name"
                rules={[{ required: true, message: "Please enter your name" }]}
              >
                <Input prefix={<UserOutlined />} placeholder="Your name" />
              </Form.Item>
              <Form.Item label="Email">
                <Input prefix={<MailOutlined />} value={user.email} disabled />
              </Form.Item>
              <Flex justify="center">
                <Button
                  type="primary"
                  loading={savingProfile}
                  onClick={saveProfile}
                  disabled={!profileDirty}
                  style={{ height: 32, minWidth: 140 }}
                >
                  Save changes
                </Button>
              </Flex>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            variant="borderless"
            title={
              <Space>
                <SafetyCertificateOutlined />
                Change Password
              </Space>
            }
            style={{ height: "100%" }}
          >
            <Form form={passwordForm} layout="vertical">
              <Form.Item
                name="currentPassword"
                label="Current password"
                rules={[{ required: true, message: "Current password required" }]}
              >
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="New password"
                rules={[{ required: true, min: 6, message: "Min 6 characters" }]}
              >
                <Input.Password prefix={<KeyOutlined />} />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm new password"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "Please confirm your password" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                      return Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<KeyOutlined />} />
              </Form.Item>
              <Flex justify="center">
                <Button
                  type="primary"
                  loading={savingPassword}
                  onClick={savePassword}
                  disabled={!passwordDirty}
                  style={{ height: 32, minWidth: 140 }}
                >
                  Change password
                </Button>
              </Flex>
            </Form>
          </Card>
        </Col>
      </Row>

      <Modal
        open={avatarOpen}
        title="Update avatar"
        okText="Save"
        cancelText="Cancel"
        confirmLoading={savingAvatar}
        onOk={saveAvatar}
        onCancel={() => setAvatarOpen(false)}
        width={420}
      >
        <Flex vertical align="center" gap={20} style={{ paddingTop: 8 }}>
          <Avatar
            size={96}
            src={avatarUrlDraft || undefined}
            icon={<UserOutlined />}
            style={{ backgroundColor: roleColor.avatar, fontSize: 40 }}
          />
          <Upload
            accept="image/png,image/jpeg"
            showUploadList={false}
            beforeUpload={(file) => {
              uploadAvatarPicture(file as File);
              return false;
            }}
          >
            <Button
              type="primary"
              ghost
              icon={uploadingAvatar ? <LoadingOutlined /> : <UploadOutlined />}
              loading={uploadingAvatar}
            >
              Upload picture
            </Button>
          </Upload>
          <Divider plain style={{ margin: 0 }}>
            or paste a URL
          </Divider>
          <Input
            value={avatarUrlDraft}
            onChange={(e) => setAvatarUrlDraft(e.target.value)}
            prefix={<LinkOutlined />}
            placeholder="https://example.com/avatar.png"
            allowClear
          />
          <Flex gap={4} align="center">
            <InfoCircleOutlined style={{ color: token.colorTextSecondary }} />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Upload any PNG/JPG — it is auto-resized to 515×515 and stored in
              your Drive.
            </Typography.Text>
          </Flex>
        </Flex>
      </Modal>
    </div>
  );
}
