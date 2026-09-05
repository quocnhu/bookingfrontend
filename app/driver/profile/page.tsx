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
  Row,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  message,
  theme as antdTheme,
} from "antd";
import {
  CarOutlined,
  CheckCircleOutlined,
  IdcardOutlined,
  KeyOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const roleColors: Record<string, string> = {
  DRIVER: "#06B6D4",
};

export default function DriverProfilePage() {
  const { user, refreshProfile } = useApp();
  const { token } = antdTheme.useToken();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    if (user) profileForm.setFieldsValue({ name: user.name ?? "" });
  }, [user]);

  if (!user) return null;

  const avatarColor = roleColors[user.role] ?? "#06B6D4";

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
        <Flex align="center" gap={24}>
          <Avatar
            size={104}
            src={user.avatarUrl || undefined}
            icon={<UserOutlined />}
            style={{ backgroundColor: avatarColor, fontSize: 44 }}
          />
          <Flex vertical gap={2}>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {user.name ?? user.email}
            </Typography.Title>
            <Typography.Text type="secondary">
              <MailOutlined style={{ marginRight: 6 }} />
              {user.email}
            </Typography.Text>
            <Space style={{ marginTop: 10 }}>
              <Tag color="cyan" style={{ fontWeight: 700, textTransform: "uppercase" }}>
                DRIVER
              </Tag>
            </Space>
          </Flex>
        </Flex>
        <Divider />
        <Row gutter={[32, 16]}>
          <Col xs={12} lg={6}>
            <Statistic title="Permissions" value={user.permissions?.length ?? 0} valueStyle={{ fontWeight: 700 }} />
          </Col>
          <Col xs={12} lg={6}>
            <Statistic
              title="Member since"
              value={user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
              valueStyle={{ fontSize: 18, fontWeight: 700 }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card variant="borderless" title={<Space><IdcardOutlined /> Update Profile</Space>} style={{ height: "100%" }}>
            <Form form={profileForm} layout="vertical">
              <Form.Item name="name" label="Full name" rules={[{ required: true }]}>
                <Input prefix={<UserOutlined />} placeholder="Your name" />
              </Form.Item>
              <Form.Item label="Email">
                <Input prefix={<MailOutlined />} value={user.email} disabled />
              </Form.Item>
              <Flex justify="center">
                <Button type="primary" loading={savingProfile} onClick={saveProfile} style={{ height: 32, minWidth: 140 }}>
                  Save changes
                </Button>
              </Flex>
            </Form>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card variant="borderless" title={<Space><SafetyCertificateOutlined /> Change Password</Space>} style={{ height: "100%" }}>
            <Form form={passwordForm} layout="vertical">
              <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}>
                <Input.Password prefix={<LockOutlined />} />
              </Form.Item>
              <Form.Item name="newPassword" label="New password" rules={[{ required: true, min: 6 }]}>
                <Input.Password prefix={<KeyOutlined />} />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="Confirm new password"
                dependencies={["newPassword"]}
                rules={[
                  { required: true },
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
                <Button type="primary" loading={savingPassword} onClick={savePassword} style={{ height: 32, minWidth: 140 }}>
                  Change password
                </Button>
              </Flex>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
