"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Flex, Form, Input, Typography, message, theme as antdTheme } from "antd";
import { LockOutlined, MailOutlined, RocketFilled, UserOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

export default function RegisterPage() {
  const { login } = useApp();
  const { token } = antdTheme.useToken();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { name: string; email: string; password: string }) => {
    setLoading(true);
    try {
      await api.post("/auth/register", values);
      await login(values.email, values.password);
      message.success("Account created");
      router.push("/dashboard");
    } catch (e) {
      message.error(getErrorMessage(e, "Registration failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg">
      <Card className="auth-card" variant="borderless">
        <Flex vertical align="center" gap={8} style={{ marginBottom: 24 }}>
          <RocketFilled style={{ fontSize: 44, color: token.colorPrimary }} />
          <Typography.Title level={3} style={{ margin: 0, textAlign: "center" }}>
            Create account
          </Typography.Title>
          <Typography.Text type="secondary">Join the booking platform</Typography.Text>
        </Flex>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="name"
            label="Full name"
            rules={[{ required: true, message: "Please enter your name" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="Your name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="you@example.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Please enter a password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="At least 6 characters" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Repeat password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Register
          </Button>
        </Form>
        <Flex justify="center" style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">
            Already have an account? <a onClick={() => router.push("/login")}>Sign in</a>
          </Typography.Text>
        </Flex>
      </Card>
    </div>
  );
}
