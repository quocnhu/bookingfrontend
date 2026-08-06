"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Flex, Spin, Tag, Typography, message } from "antd";
import { ArrowLeftOutlined, ClockCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import PublicHeader from "@/components/public-header";

interface PublicItinerary {
  id: string;
  dayNumber: number;
  orderIndex: number;
  title: string;
  description?: string | null;
  timeSlot?: string | null;
  location?: string | null;
}

interface PublicTour {
  id: string;
  code: string;
  name: string;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  itineraries: PublicItinerary[];
}

const usd = (value: string | number | null | undefined) =>
  `$${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PublicTourDetailPage() {
  const params = useParams<{ id: string }>();
  const [tour, setTour] = useState<PublicTour | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/tours/${params.id}`)
      .then((r) => setTour(r.data))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load tour")))
      .finally(() => setLoading(false));
  }, [params.id]);

  const days: Array<[number, PublicItinerary[]]> = [];
  const map = new Map<number, PublicItinerary[]>();
  [...(tour?.itineraries ?? [])]
    .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
    .forEach((it) => {
      if (!map.has(it.dayNumber)) map.set(it.dayNumber, []);
      map.get(it.dayNumber)!.push(it);
    });
  map.forEach((items, day) => days.push([day, items]));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicHeader />

      <Flex flex="1" justify="center" style={{ padding: "32px 24px 56px", width: "100%", maxWidth: 960, margin: "0 auto" }}>
        {loading ? (
          <Flex justify="center" style={{ padding: 80 }}>
            <Spin size="large" />
          </Flex>
        ) : !tour ? (
          <Typography.Text type="secondary">Tour not found.</Typography.Text>
        ) : (
          <Flex vertical gap={16} style={{ width: "100%" }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => history.back()} style={{ alignSelf: "flex-start" }}>
              Back
            </Button>

            {tour.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tour.thumbnailUrl}
                alt={tour.name}
                style={{
                  width: "100%",
                  maxHeight: 360,
                  objectFit: "cover",
                  borderRadius: 16,
                  display: "block",
                }}
              />
            )}

            <Flex justify="space-between" align="flex-start" wrap gap={12}>
              <Flex vertical gap={4}>
                <Flex gap={8} align="center">
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {tour.code}
                  </Typography.Text>
                  <Tag color={tour.type === "PRIVATE_TOUR" ? "purple" : "cyan"}>
                    {tour.type.replace("_", " ")}
                  </Tag>
                </Flex>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {tour.name}
                </Typography.Title>
              </Flex>
            </Flex>

            <Flex wrap gap={24} align="center">
              <Typography.Title level={4} style={{ margin: 0, color: "var(--ant-color-primary)" }}>
                From {usd(tour.adultPrice)}{" "}
                <Typography.Text type="secondary" style={{ fontSize: 14, fontWeight: 400 }}>
                  {tour.currency} / person
                </Typography.Text>
              </Typography.Title>
            </Flex>

            {days.length === 0 ? (
              <Typography.Text type="secondary">No itinerary published yet.</Typography.Text>
            ) : (
              <Flex vertical gap={16}>
                {days.map(([day, items]) => (
                  <div key={day}>
                    <Typography.Title level={5} style={{ marginBottom: 8 }}>
                      Day {day}
                    </Typography.Title>
                    <Flex vertical gap={16}>
                      {items.map((it) => (
                        <div
                          key={it.id}
                          style={{
                            padding: 16,
                            borderRadius: 12,
                            background: "var(--ant-color-bg-container)",
                            border: "1px solid var(--ant-color-border-secondary)",
                          }}
                        >
                          <Flex align="center" gap={8} wrap>
                            <Tag color="geekblue">#{it.orderIndex + 1}</Tag>
                            <Typography.Text strong>{it.title}</Typography.Text>
                            {it.timeSlot && (
                              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                                <ClockCircleOutlined /> {it.timeSlot}
                              </Typography.Text>
                            )}
                          </Flex>
                          {it.location && (
                            <Flex gap={4} align="center" style={{ marginTop: 6 }}>
                              <EnvironmentOutlined style={{ color: "var(--ant-color-text-tertiary)" }} />
                              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                                {it.location}
                              </Typography.Text>
                            </Flex>
                          )}
                          {it.description && (
                            <div
                              className="prose-content"
                              style={{ marginTop: 8 }}
                              dangerouslySetInnerHTML={{ __html: it.description }}
                            />
                          )}
                          {it.location && (
                            <iframe
                              title={`Map - ${it.location}`}
                              src={`https://www.google.com/maps?q=${encodeURIComponent(it.location)}&output=embed`}
                              style={{
                                width: "100%",
                                height: 220,
                                border: 0,
                                borderRadius: 12,
                                marginTop: 12,
                                filter: "grayscale(0.2)",
                              }}
                              loading="lazy"
                              allowFullScreen
                            />
                          )}
                        </div>
                      ))}
                    </Flex>
                  </div>
                ))}
              </Flex>
            )}
          </Flex>
        )}
      </Flex>
    </div>
  );
}
