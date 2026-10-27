"use client";

import { useState } from "react";
import {
  Avatar,
  Button,
  Divider,
  Flex,
  Input,
  Modal,
  Typography,
  Upload,
  theme as antdTheme,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  CameraOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  LoadingOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";

interface AvatarEditorProps {
  avatarUrl?: string | null;
  fallbackColor: string;
  size?: number;
  onUpdated?: () => void;
}

function isValidImageUrl(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function AvatarEditor({
  avatarUrl,
  fallbackColor,
  size = 104,
  onUpdated,
}: AvatarEditorProps) {
  const { token } = antdTheme.useToken();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  const openEditor = () => {
    setUrlDraft(avatarUrl ?? "");
    setOpen(true);
  };

  const uploadPicture = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      await api.post("/drive/avatar", fd);
      message.success("Avatar updated");
      setOpen(false);
      onUpdated?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const saveUrl = async () => {
    const url = urlDraft.trim();
    if (url && !isValidImageUrl(url)) {
      message.error("Please enter a valid public http(s) image URL");
      return;
    }
    setSaving(true);
    try {
      await api.put("/auth/profile", { avatarUrl: url || null });
      message.success("Avatar updated");
      setOpen(false);
      onUpdated?.();
    } catch (e) {
      message.error(getErrorMessage(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Flex
        style={{
          position: "relative",
          width: size,
          height: size,
          flexShrink: 0,
        }}
      >
        <Avatar
          size={size}
          src={avatarUrl || undefined}
          icon={<UserOutlined />}
          style={{
            backgroundColor: fallbackColor,
            fontSize: Math.round(size * 0.42),
          }}
        />
        <Button
          size="small"
          shape="circle"
          type="primary"
          icon={<CameraOutlined />}
          onClick={openEditor}
          aria-label="Update avatar"
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            boxShadow: token.boxShadowSecondary,
          }}
        />
      </Flex>

      <Modal
        open={open}
        title="Update avatar"
        okText="Save"
        cancelText="Cancel"
        confirmLoading={saving}
        onOk={saveUrl}
        onCancel={() => setOpen(false)}
        width={420}
      >
        <Flex vertical align="center" gap={20} style={{ paddingTop: 8 }}>
          <Avatar
            size={96}
            src={urlDraft || undefined}
            icon={<UserOutlined />}
            style={{ backgroundColor: fallbackColor, fontSize: 40 }}
          />
          <Upload
            accept="image/png,image/jpeg"
            showUploadList={false}
            beforeUpload={(file) => {
              uploadPicture(file as File);
              return false;
            }}
          >
            <Button
              type="primary"
              ghost
              icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
              loading={uploading}
            >
              Upload picture
            </Button>
          </Upload>
          <Divider plain style={{ margin: 0 }}>
            or paste a URL
          </Divider>
          <Input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
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
    </>
  );
}
