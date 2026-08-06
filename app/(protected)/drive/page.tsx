"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  Flex,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  FolderFilled,
  HomeOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns } from "@/lib/table";

interface DriveFolder {
  id: string;
  parentId: string | null;
  name: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
}

interface DriveFile {
  id: string;
  folderId: string;
  name: string;
  mimeType: string | null;
  size: number;
  storageKey: string;
  createdAt: string;
  url: string;
}

interface DriveState {
  current: DriveFolder | null;
  breadcrumb: { id: string | null; name: string }[];
  folders: DriveFolder[];
  files: DriveFile[];
  quota: {
    unlimited: boolean;
    quotaBytes: number | null;
    usedBytes: number;
    freeBytes: number | null;
    usedPercent: number;
    maxUploadBytes: number | null;
  } | null;
}

const AVATAR_HINT = "PNG/JPG of any size — auto-resized to 515×515.";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mime: string | null, name: string) {
  if (mime?.startsWith("image/")) return <FileImageOutlined style={{ color: "#2F80ED" }} />;
  if (name.endsWith(".pdf")) return <FileTextOutlined style={{ color: "#EB5757" }} />;
  return <FileOutlined />;
}

export default function DrivePage() {
  const { refreshProfile } = useApp();
  const [data, setData] = useState<DriveState | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  const [renameTarget, setRenameTarget] = useState<
    { id: string; name: string; kind: "folder" | "file" } | null
  >(null);
  const [renameValue, setRenameValue] = useState("");

  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const load = useCallback(async (folderId?: string | null) => {
    setLoading(true);
    try {
      const r = await api.get(
        folderId ? `/drive/folders/${folderId}` : "/drive",
      );
      setData(r.data);
      setCurrentFolderId(folderId ?? null);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const isAvatarFolder = data?.current?.kind === "avatar";
  const uploadAccept = isAvatarFolder ? "image/png,image/jpeg" : undefined;
  const storageFull =
    !!data?.quota &&
    !data.quota.unlimited &&
    data.quota.usedPercent >= 100;
  const quotaColor =
    (data?.quota?.usedPercent ?? 0) >= 90
      ? "#EB5757"
      : (data?.quota?.usedPercent ?? 0) >= 70
        ? "#F2994A"
        : "var(--ant-color-primary)";

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    try {
      await api.post("/drive/folders", {
        name,
        parentId: currentFolderId ?? undefined,
      });
      message.success("Folder created");
      setFolderModalOpen(false);
      setFolderName("");
      load(currentFolderId);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const doUpload = async (file: File) => {
    if (
      data?.quota &&
      !data.quota.unlimited &&
      data.quota.maxUploadBytes != null &&
      file.size > data.quota.maxUploadBytes
    ) {
      message.error(
        `Max upload size is ${formatBytes(data.quota.maxUploadBytes)} per file`,
      );
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    if (currentFolderId) fd.append("folderId", currentFolderId);
    setUploading(true);
    try {
      await api.post("/drive/files", fd);
      message.success(isAvatarFolder ? "Avatar updated" : "File uploaded");
      if (isAvatarFolder) refreshProfile();
      load(currentFolderId);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const rename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await api.patch(
        `/drive/${renameTarget.kind === "folder" ? "folders" : "files"}/${renameTarget.id}`,
        { name: renameValue.trim() },
      );
      message.success("Renamed");
      setRenameTarget(null);
      load(currentFolderId);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const remove = async (id: string, kind: "folder" | "file") => {
    try {
      await api.delete(`/drive/${kind === "folder" ? "folders" : "files"}/${id}`);
      message.success(kind === "folder" ? "Folder deleted" : "File deleted");
      load(currentFolderId);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns = centerColumns([
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string, file: DriveFile) => (
        <Flex align="center" gap={8}>
          {fileIcon(file.mimeType, file.name)}
          <Typography.Text
            style={{ cursor: "pointer" }}
            onClick={() =>
              file.mimeType?.startsWith("image/") && setPreviewFile(file)
            }
          >
            {name}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      title: "Type",
      dataIndex: "mimeType",
      key: "mimeType",
      render: (m: string | null) => (m ? <Tag>{m}</Tag> : <Tag>-</Tag>),
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      render: (s: number) => formatBytes(s),
    },
    {
      title: "Uploaded",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (v: string) => new Date(v).toLocaleString(),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: unknown, file: DriveFile) => (
        <Flex gap={4}>
          {file.mimeType?.startsWith("image/") && (
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setPreviewFile(file)}
            />
          )}
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setRenameTarget({ id: file.id, name: file.name, kind: "file" });
              setRenameValue(file.name);
            }}
          />
          <Popconfirm
            title="Delete this file?"
            onConfirm={() => remove(file.id, "file")}
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Flex>
      ),
    },
  ]);

  return (
    <Flex vertical gap={16}>
      <Card
        size="small"
        title={
          <Flex align="center" gap={8}>
            <HomeOutlined />
            <Typography.Text strong>
              {data?.breadcrumb?.[0]?.name ?? "My Drive"}
            </Typography.Text>
          </Flex>
        }
        extra={
          <Flex gap={8}>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => load(currentFolderId)}
            >
              Refresh
            </Button>
            <Button
              size="small"
              icon={<FolderAddOutlined />}
              onClick={() => {
                setFolderName("");
                setFolderModalOpen(true);
              }}
            >
              New folder
            </Button>
            <Upload
              showUploadList={false}
              accept={uploadAccept}
              disabled={storageFull}
              customRequest={({ file, onSuccess, onError }: any) => {
                doUpload(file as File)
                  .then(() => onSuccess?.({}))
                  .catch((e) => onError?.(e));
              }}
            >
              <Button
                type="primary"
                size="small"
                icon={<UploadOutlined />}
                loading={uploading}
                disabled={storageFull}
                title={storageFull ? "Storage is full" : undefined}
              >
                Upload
              </Button>
            </Upload>
          </Flex>
        }
      >
        <Flex vertical gap={16}>
          {data?.quota && (
            <div style={{ maxWidth: 420 }}>
              <Flex align="center" justify="space-between" gap={8} wrap>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {data.quota.unlimited
                    ? `${formatBytes(data.quota.usedBytes)} used · Unlimited`
                    : `${formatBytes(data.quota.usedBytes)} of ${formatBytes(data.quota.quotaBytes ?? 0)} used (${data.quota.usedPercent}%)`}
                  {!data.quota.unlimited &&
                    data.quota.maxUploadBytes != null &&
                    ` · Max ${formatBytes(data.quota.maxUploadBytes)} per file`}
                </Typography.Text>
                {data.quota.unlimited && <Tag color="gold">Admin · Unlimited</Tag>}
                {storageFull && <Tag color="red">Storage full</Tag>}
              </Flex>
              <Progress
                percent={data.quota.unlimited ? 0 : data.quota.usedPercent}
                size="small"
                showInfo={false}
                strokeColor={quotaColor}
                status={storageFull ? "exception" : "normal"}
              />
            </div>
          )}

          <Breadcrumb
            items={(data?.breadcrumb ?? []).map((b) => ({
              title: b.name,
              onClick: () => load(b.id),
            }))}
          />

          {isAvatarFolder && (
            <Tag color="gold">{AVATAR_HINT}</Tag>
          )}

          {(data?.folders?.length ?? 0) > 0 && (
            <Flex wrap gap={12}>
              {data!.folders.map((f) => (
                <Flex
                  key={f.id}
                  vertical
                  align="center"
                  gap={6}
                  style={{
                    width: 120,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--ant-color-border-secondary)",
                    cursor: "pointer",
                    background: "var(--ant-color-bg-container)",
                  }}
                  onClick={() => load(f.id)}
                >
                  <FolderFilled
                    style={{ fontSize: 40, color: "var(--ant-color-primary)" }}
                  />
                  <Typography.Text
                    ellipsis
                    style={{ maxWidth: 100, textAlign: "center" }}
                    title={f.name}
                  >
                    {f.name}
                  </Typography.Text>
                  {f.kind === "avatar" && <Tag color="gold">Avatar</Tag>}
                  {f.kind === "folder" && (
                    <Flex gap={2}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameTarget({
                            id: f.id,
                            name: f.name,
                            kind: "folder",
                          });
                          setRenameValue(f.name);
                        }}
                      />
                      <Popconfirm
                        title="Delete this folder and everything inside?"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          remove(f.id, "folder");
                        }}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    </Flex>
                  )}
                </Flex>
              ))}
            </Flex>
          )}

          <Table
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={data?.files ?? []}
            locale={{ emptyText: <Empty description="No files yet" /> }}
            pagination={false}
          />
        </Flex>
      </Card>

      <Modal
        title="New folder"
        open={folderModalOpen}
        onOk={createFolder}
        onCancel={() => setFolderModalOpen(false)}
        okButtonProps={{ disabled: !folderName.trim() }}
        destroyOnHidden
      >
        <Input
          placeholder="Folder name"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onPressEnter={createFolder}
          autoFocus
        />
      </Modal>

      <Modal
        title={renameTarget?.kind === "folder" ? "Rename folder" : "Rename file"}
        open={!!renameTarget}
        onOk={rename}
        onCancel={() => setRenameTarget(null)}
        okButtonProps={{ disabled: !renameValue.trim() }}
        destroyOnHidden
      >
        <Input
          placeholder="New name"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={rename}
          autoFocus
        />
      </Modal>

      <Modal
        title={previewFile?.name}
        open={!!previewFile}
        onCancel={() => setPreviewFile(null)}
        footer={null}
        destroyOnHidden
      >
        {previewFile && (
          <img
            src={previewFile.url}
            alt={previewFile.name}
            style={{ width: "100%", borderRadius: 8 }}
          />
        )}
      </Modal>
    </Flex>
  );
}
