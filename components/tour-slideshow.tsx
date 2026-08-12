"use client";

import { useState } from "react";
import { Carousel, Empty, Flex, Modal, Typography } from "antd";
import { PictureOutlined, ZoomInOutlined } from "@ant-design/icons";
import type { GalleryImage } from "@/components/gallery-manager";

interface Props {
  images: GalleryImage[];
  height?: number;
}

export default function TourSlideshow({ images, height = 320 }: Props) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <Flex
        align="center"
        justify="center"
        style={{
          height,
          borderRadius: 16,
          border: "1px dashed var(--ant-color-border-secondary)",
          background: "var(--ant-color-fill-quaternary)",
        }}
      >
        <Flex vertical align="center" gap={8}>
          <PictureOutlined style={{ fontSize: 36, color: "var(--ant-color-text-tertiary)" }} />
          <Typography.Text type="secondary">No photos in this tour folder yet.</Typography.Text>
        </Flex>
      </Flex>
    );
  }

  const open = (index: number) => setPreviewIndex(index);

  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden" }}>
      <Carousel autoplay dots={{ className: "tour-slideshow-dots" }}>
        {images.map((img, i) => (
          <div key={img.id}>
            <button
              type="button"
              onClick={() => open(i)}
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                border: "none",
                cursor: "zoom-in",
                background: "var(--ant-color-fill-secondary)",
              }}
              aria-label={`Open photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt="tour"
                style={{
                  width: "100%",
                  height,
                  objectFit: "contain",
                  display: "block",
                }}
              />
            </button>
          </div>
        ))}
      </Carousel>
      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          padding: "2px 10px",
          borderRadius: 999,
          fontSize: 12,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          pointerEvents: "none",
        }}
      >
        {images.length} {images.length === 1 ? "photo" : "photos"}
      </div>
      <div
        style={{
          position: "absolute",
          left: 12,
          bottom: 12,
          padding: "2px 10px",
          borderRadius: 999,
          fontSize: 12,
          background: "rgba(0,0,0,0.45)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 5,
          pointerEvents: "none",
        }}
      >
        <ZoomInOutlined /> Click to zoom
      </div>

      <Modal
        open={previewIndex !== null}
        onCancel={() => setPreviewIndex(null)}
        footer={null}
        width="min(96vw, 1100px)"
        centered
        styles={{ body: { padding: 12 } }}
      >
        {previewIndex !== null && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <Carousel
              initialSlide={previewIndex}
              dots={{ className: "tour-slideshow-dots" }}
            >
              {images.map((img) => (
                <div key={img.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt="tour"
                    style={{
                      width: "100%",
                      maxHeight: "78vh",
                      objectFit: "contain",
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                </div>
              ))}
            </Carousel>
          </div>
        )}
      </Modal>
    </div>
  );
}
