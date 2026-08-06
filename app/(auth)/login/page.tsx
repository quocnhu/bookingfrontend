"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Card,
  Divider,
  Flex,
  Form,
  Input,
  Spin,
  Typography,
  message,
  theme as antdTheme,
} from "antd";
import { GoogleOutlined, LockOutlined, MailOutlined, RocketFilled } from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import { getErrorMessage } from "@/lib/api";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Flex justify="center" align="center" style={{ minHeight: "100vh" }}>
          <Spin />
        </Flex>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login, loginWithGoogle, refreshProfile, user } = useApp();
  const { token } = antdTheme.useToken();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "google") {
      message.error("Google sign-in failed");
      return;
    }
    if (searchParams.size > 0) {
      refreshProfile();
    }
  }, [searchParams, refreshProfile]);

  useEffect(() => {
    if (user) {
      const redirect = searchParams.get("redirect");
      router.replace(redirect && redirect.startsWith("/") ? redirect : "/dashboard");
    }
  }, [user, router, searchParams]);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success("Logged in");
      router.push("/dashboard");
    } catch (e) {
      message.error(getErrorMessage(e, "Login failed"));
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
            Booking Project
          </Typography.Title>
          <Typography.Text type="secondary">Sign in to continue</Typography.Text>
        </Flex>
        <Button block icon={<GoogleOutlined />} onClick={() => loginWithGoogle()}>
          Continue with Google
        </Button>
        <Divider plain>or</Divider>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Invalid email" },
            ]}
          >
            <Input prefix={<MailOutlined />} placeholder="admin@booking.local" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: "Please enter your password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Sign in
          </Button>
        </Form>
        <Flex justify="center" style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">
            No account? <a onClick={() => router.push("/register")}>Register</a>
          </Typography.Text>
        </Flex>
      </Card>
    </div>
  );
}
