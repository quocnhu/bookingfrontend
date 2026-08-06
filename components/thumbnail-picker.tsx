"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useDropzone } from "react-dropzone";
import { Button, Flex, Modal, Slider, Typography, message } from "antd";
import { DeleteOutlined, PictureOutlined, PlusOutlined } from "@ant-design/icons";

const OUTPUT_SIZE = 600;

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

interface Props {
  value?: string | null;
  onChange?: (url: string | null) => void;
}

export default function ThumbnailPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [pixels, setPixels] = useState<Area | null>(null);
  const [applying, setApplying] = useState(false);

  const onDrop = useCallback(async (accepted: File[]) => {
    const file = accepted?.[0];
    if (!file) return;
    const dataUrl = await readFile(file);
    setImage(dataUrl);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: !!image,
  });

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setPixels(croppedAreaPixels);
  }, []);

  const apply = async () => {
    if (!image || !pixels) return;
    setApplying(true);
    try {
      const img = await loadImage(image);
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.drawImage(img, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      onChange?.(canvas.toDataURL("image/jpeg", 0.85));
      message.success("Thumbnail updated");
      setOpen(false);
    } catch {
      message.error("Failed to crop image");
    } finally {
      setApplying(false);
    }
  };

  const resetModal = () => {
    setOpen(false);
    setImage(null);
    setPixels(null);
    setZoom(1);
  };

  return (
    <Flex gap={12} align="flex-start" wrap>
      <div
        style={{
          width: 112,
          height: 112,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px dashed var(--ant-color-border-secondary)",
          background: "var(--ant-color-fill-quaternary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="thumbnail"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <PictureOutlined style={{ fontSize: 28, color: "var(--ant-color-text-tertiary)" }} />
        )}
      </div>
      <Flex vertical gap={8}>
        <Button icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          {value ? "Change thumbnail" : "Upload thumbnail"}
        </Button>
        {value && (
          <Button danger icon={<DeleteOutlined />} onClick={() => onChange?.(null)}>
            Remove
          </Button>
        )}
        <Typography.Text type="secondary" style={{ fontSize: 12, maxWidth: 240 }}>
          Drag & drop an image, then zoom / drag to frame the crop.
        </Typography.Text>
      </Flex>

      <Modal
        title="Thumbnail crop"
        open={open}
        onCancel={resetModal}
        onOk={apply}
        okText="Apply"
        confirmLoading={applying}
        okButtonProps={{ disabled: !image }}
        width={560}
      >
        {!image ? (
          <div
            {...getRootProps()}
            style={{
              minHeight: 300,
              borderRadius: 12,
              border: `2px dashed ${
                isDragActive ? "var(--ant-color-primary)" : "var(--ant-color-border-secondary)"
              }`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              padding: 24,
              background: "var(--ant-color-fill-quaternary)",
            }}
          >
            <input {...getInputProps()} />
            <PictureOutlined style={{ fontSize: 40, color: "var(--ant-color-text-tertiary)" }} />
            <Typography.Text>
              {isDragActive ? "Drop the image here" : "Drag & drop an image, or click to browse"}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              JPG / PNG / WEBP up to 10MB
            </Typography.Text>
          </div>
        ) : (
          <Flex vertical gap={16}>
            <div
              style={{
                position: "relative",
                height: 340,
                borderRadius: 12,
                overflow: "hidden",
                background: "#0B0F1E",
              }}
            >
              <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <Flex vertical gap={4}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Zoom
              </Typography.Text>
              <Slider min={1} max={4} step={0.01} value={zoom} onChange={setZoom} />
            </Flex>
          </Flex>
        )}
      </Modal>
    </Flex>
  );
}
