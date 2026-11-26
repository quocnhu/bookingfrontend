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
  Select,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { message } from "@/lib/antd-message";
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
  UploadOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";

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

interface PendingEvidenceFile extends DriveFile {
  assignmentId: string;
  assignmentCode: string;
  tourName: string;
  startDate: string;
  assignmentStatus: string;
  reportStatus: string;
}

interface DriveState {
  current: DriveFolder | null;
  breadcrumb: { id: string | null; name: string }[];
  folders: DriveFolder[];
  files: DriveFile[];
  pendingEvidence?: PendingEvidenceFile[];
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
const DRIVE_ROLE_COLOR: Record<string, string> = {
  TOUR_GUIDE: "green",
  DRIVER: "cyan",
  OFFICE: "geekblue",
  ACCOUNTING: "orange",
  TRANSPORT_PROVIDER: "purple",
  HOTEL: "gold",
  TOURIST: "magenta",
  CUSTOMER: "default",
};
const DRIVE_ROLE_ORDER: Record<string, number> = {
  TOUR_GUIDE: 1,
  DRIVER: 2,
  OFFICE: 3,
  ACCOUNTING: 4,
  TRANSPORT_PROVIDER: 5,
  HOTEL: 6,
  TOURIST: 7,
  CUSTOMER: 8,
};
type DriveUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  provider?: { isCompany?: boolean } | null;
  guideProfile?: { type?: "OFFICIAL" | "FREELANCE" } | null;
  driverProfile?: { type?: "COMPANY" | "FREELANCE" | "PROVIDER" } | null;
};
const driveUserEmployment = (u: DriveUser) => {
  if (u.role === "TOUR_GUIDE") {
    return u.guideProfile?.type === "OFFICIAL"
      ? { label: "Company", order: 1, color: "green" }
      : { label: "Freelancer", order: 2, color: "lime" };
  }
  if (u.role === "DRIVER") {
    const t = u.driverProfile?.type;
    if (t === "COMPANY") return { label: "Company", order: 1, color: "blue" };
    if (t === "PROVIDER" || u.provider?.isCompany === false)
      return { label: "Provider", order: 3, color: "purple" };
    return { label: "Freelancer", order: 2, color: "cyan" };
  }
  if (u.role === "TRANSPORT_PROVIDER") {
    return u.provider?.isCompany === false
      ? { label: "Provider", order: 2, color: "purple" }
      : { label: "Company", order: 1, color: "geekblue" };
  }
  return null;
};

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
  const { refreshProfile, user } = useApp();
  const isAdmin = user?.role === "ADMIN";
  const [data, setData] = useState<DriveState | null>(null);
  const [driveUsers, setDriveUsers] = useState<
    {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      provider?: { isCompany?: boolean } | null;
      guideProfile?: { type?: "OFFICIAL" | "FREELANCE" } | null;
      driverProfile?: { type?: "COMPANY" | "FREELANCE" | "PROVIDER" } | null;
    }[]
  >([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  const tableHeight = useFillHeight({
    rootSelector: ".drive-page",
    activeTab: "",
    paginated: false,
    deps: [data?.files?.length],
  });
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

  const load = useCallback(
    async (folderId?: string | null) => {
      setLoading(true);
      try {
        const qs = selectedUserId
          ? `?userId=${encodeURIComponent(selectedUserId)}`
          : "";
        const r = await api.get(
          folderId ? `/drive/folders/${folderId}${qs}` : `/drive${qs}`,
        );
        setData(r.data);
        setCurrentFolderId(folderId ?? null);
      } catch (e) {
        message.error(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    },
    [selectedUserId],
  );

  useEffect(() => {
    if (!isAdmin) return;
    api
      .get("/drive/users")
      .then((r) => setDriveUsers(r.data ?? []))
      .catch(() => setDriveUsers([]));
  }, [isAdmin]);

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
      const qs = selectedUserId
        ? `?userId=${encodeURIComponent(selectedUserId)}`
        : "";
      await api.post(`/drive/folders${qs}`, {
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
      const qs = selectedUserId
        ? `?userId=${encodeURIComponent(selectedUserId)}`
        : "";
      await api.post(`/drive/files${qs}`, fd);
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
      const qs = selectedUserId
        ? `?userId=${encodeURIComponent(selectedUserId)}`
        : "";
      await api.patch(
        `/drive/${renameTarget.kind === "folder" ? "folders" : "files"}/${renameTarget.id}${qs}`,
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
      const qs = selectedUserId
        ? `?userId=${encodeURIComponent(selectedUserId)}`
        : "";
      await api.delete(
        `/drive/${kind === "folder" ? "folders" : "files"}/${id}${qs}`,
      );
      message.success(kind === "folder" ? "Folder deleted" : "File deleted");
      load(currentFolderId);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns = centerColumns([
    indexColumn(1, 999),
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      filters: Array.from(new Set((data?.files ?? []).map((f: DriveFile) => f.name).filter(Boolean))).sort().map((n: any) => ({ text: n, value: n })),
      onFilter: (v: any, r: DriveFile) => (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
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
      filters: Array.from(new Set((data?.files ?? []).map((f: DriveFile) => f.mimeType).filter(Boolean))).sort().map((m: any) => ({ text: m, value: m })),
      onFilter: (v: any, r: DriveFile) => (r.mimeType ?? "").toLowerCase().includes(String(v).toLowerCase()),
      render: (m: string | null) => (m ? <Tag>{m}</Tag> : <Tag>-</Tag>),
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      filters: Array.from(new Set((data?.files ?? []).map((f: DriveFile) => formatBytes(f.size)))).sort().map((s: any) => ({ text: s, value: s })),
      onFilter: (v: any, r: DriveFile) => formatBytes(r.size).toLowerCase().includes(String(v).toLowerCase()),
      render: (s: number) => formatBytes(s),
    },
    {
      title: "Uploaded",
      dataIndex: "createdAt",
      key: "createdAt",
      filters: Array.from(new Set((data?.files ?? []).map((f: DriveFile) => f.createdAt ? new Date(f.createdAt).toLocaleDateString() : null).filter(Boolean))).sort().map((d: any) => ({ text: d, value: d })),
      onFilter: (v: any, r: DriveFile) => new Date(r.createdAt).toLocaleDateString().includes(String(v)),
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
    <Flex vertical gap={16} className="drive-page">
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
      >
        <Flex vertical gap={16}>
          <Flex gap={8} wrap align="center" justify="space-between">
            <Flex gap={8} wrap align="center">
              {isAdmin && (
                <Select
                  size="small"
                  allowClear
                  style={{ minWidth: 320 }}
                  placeholder="My Drive — choose a user to browse"
                  value={selectedUserId}
                  onChange={(value) => setSelectedUserId(value)}
                  optionLabelProp="label"
                  options={[...driveUsers]
                    .filter((u) => u.role !== "ADMIN")
                    .sort((a, b) => {
                      const roleDiff =
                        (DRIVE_ROLE_ORDER[a.role] ?? 99) - (DRIVE_ROLE_ORDER[b.role] ?? 99);
                      if (roleDiff !== 0) return roleDiff;
                      const empDiff =
                        (driveUserEmployment(a)?.order ?? 99) -
                        (driveUserEmployment(b)?.order ?? 99);
                      if (empDiff !== 0) return empDiff;
                      return (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "");
                    })
                    .map((u) => {
                      const roleColor = DRIVE_ROLE_COLOR[u.role] ?? "default";
                      const employment = driveUserEmployment(u);
                      const label = u.name ?? u.email ?? u.id;
                      return {
                        value: u.id,
                        label: (
                          <Flex align="center" gap={8} wrap>
                            <span>{label}</span>
                            <Tag color={roleColor} style={{ marginInlineEnd: 0 }}>{u.role}</Tag>
                            {employment && (
                              <Tag color={employment.color} style={{ marginInlineEnd: 0 }}>
                                {employment.label}
                              </Tag>
                            )}
                          </Flex>
                        ),
                        searchLabel:
                          `${label} ${u.role} ${employment?.label ?? ""} ${u.email ?? ""}`.toLowerCase(),
                      };
                    })}
                  showSearch
                  filterOption={(input, option) =>
                    String((option as any)?.searchLabel ?? "").includes(input.toLowerCase())
                  }
                />
              )}
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
            </Flex>
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
                Upload file
              </Button>
            </Upload>
          </Flex>
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

          {(data?.pendingEvidence?.length ?? 0) > 0 && (
            <Card
              size="small"
              title={
                <Flex align="center" gap={8}>
                  <FileImageOutlined style={{ color: "#fa8c16" }} />
                  <span>Pending tour evidence (not yet verified)</span>
                  <Tag color="orange">{data!.pendingEvidence!.length}</Tag>
                </Flex>
              }
            >
              <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                These files were uploaded by the guide/driver but are still in pending evidence.
                They will move into the tour folder automatically after Admin/Accounting verifies the report.
              </Typography.Paragraph>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                scroll={{ x: "max-content" }}
                dataSource={data!.pendingEvidence}
                columns={centerColumns([
                  indexColumn(1, 999),
                  {
                    title: "File",
                    dataIndex: "name",
                    key: "name",
                    render: (name: string, file: PendingEvidenceFile) => (
                      <Flex align="center" gap={8}>
                        {fileIcon(file.mimeType, file.name)}
                        <Typography.Text
                          style={{ cursor: file.mimeType?.startsWith("image/") ? "pointer" : undefined }}
                          onClick={() => file.mimeType?.startsWith("image/") && setPreviewFile(file)}
                        >
                          {name}
                        </Typography.Text>
                      </Flex>
                    ),
                  },
                  {
                    title: "Tour / Assignment",
                    key: "assignment",
                    render: (_: unknown, file: PendingEvidenceFile) => (
                      <Flex vertical gap={0}>
                        <Typography.Text>{file.tourName}</Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {file.assignmentCode} · {new Date(file.startDate).toLocaleDateString()}
                        </Typography.Text>
                      </Flex>
                    ),
                  },
                  {
                    title: "Report",
                    dataIndex: "reportStatus",
                    key: "reportStatus",
                    render: (v: string) => (
                      <Tag color={v === "SUBMITTED" ? "blue" : v === "REJECTED" ? "red" : "default"}>
                        {v}
                      </Tag>
                    ),
                  },
                  {
                    title: "Size",
                    dataIndex: "size",
                    key: "size",
                    render: (s: number) => formatBytes(s),
                  },
                  {
                    title: "Actions",
                    key: "actions",
                    render: (_: unknown, file: PendingEvidenceFile) => (
                      <Flex gap={4}>
                        {file.mimeType?.startsWith("image/") && (
                          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setPreviewFile(file)} />
                        )}
                        <Button
                          type="text"
                          size="small"
                          icon={<FileOutlined />}
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      </Flex>
                    ),
                  },
                ])}
              />
            </Card>
          )}

          <Table
            rowKey="id"
            size="small"
            loading={loading}
            columns={columns}
            dataSource={data?.files ?? []}
            scroll={{ x: "max-content", y: tableHeight }}
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
