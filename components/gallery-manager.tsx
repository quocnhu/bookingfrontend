"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button, Flex, Modal, Typography, message, Upload } from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  PictureOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";

export interface GalleryImage {
  id: string;
  url: string;
  sortIndex: number;
}

interface Props {
  tourId: string;
  images: GalleryImage[];
  onChanged?: (images: GalleryImage[]) => void;
}

export default function GalleryManager({ tourId, images, onChanged }: Props) {
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onDrop = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", files[0]);
        const r = await api.post(`/tours/${tourId}/media`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        onChanged?.(r.data.gallery);
        message.success(`Uploaded 1 photo`);
      } catch (e) {
        message.error(getErrorMessage(e, "Upload failed"));
      } finally {
        setUploading(false);
      }
    },
    [tourId, onChanged],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 15 * 1024 * 1024,
  });

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...images];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      const r = await api.put(`/tours/${tourId}/gallery/reorder`, {
        files: next.map((i) => i.id),
      });
      onChanged?.(r.data.gallery);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to reorder"));
    }
  };

  const remove = async (img: GalleryImage) => {
    setBusyId(img.id);
    try {
      const r = await api.delete(
        `/tours/${tourId}/gallery/${encodeURIComponent(img.id)}`,
      );
      onChanged?.(r.data.gallery);
      message.success("Photo removed");
    } catch (e) {
      message.error(getErrorMessage(e, "Delete failed"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Flex vertical gap={16}>
      <Flex
        {...getRootProps()}
        align="center"
        justify="center"
        style={{
          padding: "22px 16px",
          borderRadius: 12,
          border: `2px dashed ${
            isDragActive ? "var(--ant-color-primary)" : "var(--ant-color-border-secondary)"
          }`,
          cursor: "pointer",
          background: "var(--ant-color-fill-quaternary)",
        }}
      >
        <input {...getInputProps()} />
        <Flex vertical align="center" gap={4}>
          <UploadOutlined style={{ fontSize: 22, color: "var(--ant-color-text-tertiary)" }} />
          <Typography.Text>{isDragActive ? "Drop to upload" : "Drag & drop or click to upload a photo"}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            JPG / PNG / WEBP up to 15MB — stored in the tour picture folder
          </Typography.Text>
        </Flex>
      </Flex>

      {images.length === 0 ? (
        <Flex align="center" gap={8} style={{ color: "var(--ant-color-text-tertiary)" }}>
          <FolderOpenOutlined />
          <Typography.Text type="secondary">No photos yet. Upload to build the slideshow.</Typography.Text>
        </Flex>
      ) : (
        <Flex wrap gap={12}>
          {images.map((img, index) => (
            <Flex
              key={img.id}
              vertical
              gap={6}
              style={{
                width: 132,
                borderRadius: 12,
                border: "1px solid var(--ant-color-border-secondary)",
                padding: 6,
                background: "var(--ant-color-bg-container)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`photo ${index + 1}`}
                style={{ width: "100%", height: 88, objectFit: "cover", borderRadius: 8 }}
              />
              <Flex align="center" justify="space-between">
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  #{index + 1}
                </Typography.Text>
                <Flex gap={2}>
                  <Button
                    size="small"
                    type="text"
                    icon={<ArrowUpOutlined />}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <Button
                    size="small"
                    type="text"
                    icon={<ArrowDownOutlined />}
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    loading={busyId === img.id}
                    onClick={() => remove(img)}
                  />
                </Flex>
              </Flex>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}
