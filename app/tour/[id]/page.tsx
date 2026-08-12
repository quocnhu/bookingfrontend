"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Flex,
  Row,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  PrinterOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CarOutlined,
  FolderOpenOutlined,
  EditOutlined,
  StarOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useMapSrc } from "@/lib/use-map-src";
import { discountedPrice, isPromoActive } from "@/lib/promo";
import PromoCountdown from "@/components/promo-countdown";
import PublicHeader from "@/components/public-header";
import TourSlideshow from "@/components/tour-slideshow";
import DayTimeline from "@/components/day-timeline";
import type { GalleryImage } from "@/components/gallery-manager";

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
  durationDays?: number | null;
  departureLocation?: string | null;
  transportation?: string | null;
  adultPrice?: string | number | null;
  currency?: string;
  discountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  mapQuery?: string | null;
  gallery?: GalleryImage[];
  overview?: string | null;
  highlights?: string | null;
  regulations?: string | null;
  insurancePolicy?: string | null;
  itineraries: PublicItinerary[];
}

const usd = (value: string | number | null | undefined) =>
  `$${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function PublicTourDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, hasPermission } = useApp();
  const [tour, setTour] = useState<PublicTour | null>(null);
  const [loading, setLoading] = useState(true);

  const canEdit = hasPermission("tour.itinerary.edit") || hasPermission("tour.update");

  useEffect(() => {
    api
      .get(`/tours/${params.id}`)
      .then((r) => setTour(r.data))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load tour")))
      .finally(() => setLoading(false));
  }, [params.id]);

  const days = useMemo(() => {
    const map = new Map<number, PublicItinerary[]>();
    [...(tour?.itineraries ?? [])]
      .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
      .forEach((it) => {
        if (!map.has(it.dayNumber)) map.set(it.dayNumber, []);
        map.get(it.dayNumber)!.push(it);
      });
    return [...map.entries()];
  }, [tour]);

  const stops = tour?.itineraries?.length ?? 0;
  const mapSrc = useMapSrc(tour?.mapQuery, tour?.departureLocation);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicHeader />

      <Flex flex="1" justify="center" style={{ padding: "24px 16px 56px" }}>
        {loading ? (
          <Flex justify="center" style={{ padding: 80, width: "100%" }}>
            <Spin size="large" />
          </Flex>
        ) : !tour ? (
          <Typography.Text type="secondary">Tour not found.</Typography.Text>
        ) : (
          <Flex vertical gap={16} style={{ width: "100%", maxWidth: 1360 }}>
            {/* ─── PUBLIC VIEW TOP BAR ─── */}
            <Flex justify="space-between" align="center" wrap gap={12}>
              <Flex align="center" gap={8}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {tour.code}
                </Typography.Text>
                <Tag color={tour.type === "PRIVATE_TOUR" ? "purple" : "cyan"}>
                  {tour.type.replace("_", " ")}
                </Tag>
                <Typography.Title level={3} style={{ margin: 0 }}>
                  {tour.name}
                </Typography.Title>
              </Flex>
              <Flex gap={8} className="no-print">
                {user && canEdit && (
                  <Button icon={<EditOutlined />} onClick={() => router.push(`/tours/${tour.id}`)}>
                    Back to Editor
                  </Button>
                )}
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  Print
                </Button>
              </Flex>
            </Flex>

            <Row gutter={[16, 16]}>
              {/* ─── LEFT: MAIN CONTENT ─── */}
              <Col xs={24} lg={18}>
                <Flex vertical gap={16}>
                  {/* SLIDESHOW */}
                  <Card
                    variant="borderless"
                    className="print-full"
                    styles={{ body: { padding: 0 } }}
                    title={
                      <Flex align="center" gap={8}>
                        <FolderOpenOutlined />
                        <span>Slideshow</span>
                      </Flex>
                    }
                  >
                    <TourSlideshow images={tour.gallery ?? []} />
                  </Card>

                  {/* PICKUP & MEETING */}
                  <Card
                    variant="borderless"
                    title={
                      <Flex align="center" gap={8}>
                        <EnvironmentOutlined style={{ color: "#22d3ee" }} />
                        <span>Pickup &amp; Meeting Location</span>
                      </Flex>
                    }
                  >
                    {tour.departureLocation ? (
                      <Flex vertical gap={6}>
                        <Typography.Text style={{ fontSize: 15 }}>
                          <EnvironmentOutlined style={{ color: "#22d3ee", marginRight: 8 }} />
                          {tour.departureLocation}
                        </Typography.Text>
                        {tour.transportation && (
                          <Typography.Text type="secondary">
                            <CarOutlined style={{ marginRight: 8 }} />
                            {tour.transportation}
                          </Typography.Text>
                        )}
                      </Flex>
                    ) : (
                      <Typography.Text type="secondary">No pickup location configured.</Typography.Text>
                    )}
                  </Card>

                  <Divider style={{ margin: 0 }} />

                  {/* DAILY ITINERARY */}
                  <Card
                    variant="borderless"
                    title={
                      <Flex align="center" gap={8}>
                        <CalendarOutlined style={{ color: "#8b5cf6" }} />
                        <span>Daily Itinerary</span>
                      </Flex>
                    }
                  >
                    {days.length === 0 ? (
                      <Empty description="No itinerary published yet." />
                    ) : (
                      <DayTimeline>
                        {days.map(([day, dayItems], di) => (
                          <div key={day} className="timeline-day">
                            <div className="timeline-rail">
                              <span
                                className="knot-dot"
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
                                  border: "2px solid var(--ant-color-bg-container)",
                                  boxShadow: "0 0 0 4px rgba(139,92,246,0.15)",
                                  animationDelay: `${(di * 3.5) / Math.max(days.length, 1)}s`,
                                }}
                              />
                            </div>
                            <div className="timeline-content">
                              <Flex align="center" gap={10} style={{ marginBottom: 12 }}>
                                <Typography.Text strong style={{ fontSize: 18 }}>
                                  Day {day}
                                </Typography.Text>
                              </Flex>
                              <Flex vertical gap={14}>
                                {dayItems.map((it) => (
                                  <Card
                                    key={it.id}
                                    size="small"
                                    variant="borderless"
                                    style={{
                                      borderRadius: 12,
                                      border: "1px solid var(--ant-color-border-secondary)",
                                    }}
                                    styles={{ body: { padding: 18 } }}
                                  >
                                    <Flex vertical gap={8}>
                                      <Flex align="center" gap={8} wrap>
                                        <Tag color="geekblue">#{it.orderIndex + 1}</Tag>
                                        <Typography.Text strong style={{ fontSize: 16 }}>
                                          {it.title}
                                        </Typography.Text>
                                        {it.timeSlot && (
                                          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                                            <ClockCircleOutlined /> {it.timeSlot}
                                          </Typography.Text>
                                        )}
                                      </Flex>
                                      {it.location && (
                                        <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                                          <EnvironmentOutlined style={{ marginRight: 4 }} />
                                          {it.location}
                                        </Typography.Text>
                                      )}
                                      {it.description && (
                                        <div
                                          className="prose-content"
                                          style={{ marginTop: 4 }}
                                          dangerouslySetInnerHTML={{ __html: it.description }}
                                        />
                                      )}
                                    </Flex>
                                  </Card>
                                ))}
                              </Flex>
                            </div>
                          </div>
                        ))}
                      </DayTimeline>
                    )}
                  </Card>

                  {/* HIGHLIGHTS + TABBED CONTENT */}
                  {tour.highlights ||
                  tour.overview ||
                  tour.regulations ||
                  tour.insurancePolicy ? (
                    <Card
                      variant="borderless"
                      title={
                        <Flex align="center" gap={8}>
                          <StarOutlined style={{ color: "#f59e0b" }} />
                          <span>Tour content</span>
                        </Flex>
                      }
                    >
                      {tour.highlights && (
                        <Flex vertical gap={8} style={{ marginBottom: 16 }}>
                          <Typography.Text strong>
                            <StarOutlined style={{ color: "#f59e0b", marginRight: 8 }} />
                            Highlights
                          </Typography.Text>
                          <div
                            className="prose-content"
                            dangerouslySetInnerHTML={{ __html: tour.highlights }}
                          />
                        </Flex>
                      )}
                      <Tabs
                        defaultActiveKey="overview"
                        items={[
                          {
                            key: "overview",
                            label: (
                              <span>
                                <CalendarOutlined /> Itinerary
                              </span>
                            ),
                            children: tour.overview ? (
                              <div
                                className="prose-content"
                                dangerouslySetInnerHTML={{ __html: tour.overview }}
                              />
                            ) : (
                              <Typography.Text type="secondary">
                                No itinerary description yet.
                              </Typography.Text>
                            ),
                          },
                          {
                            key: "regulations",
                            label: (
                              <span>
                                <ReadOutlined /> Instructions
                              </span>
                            ),
                            children: tour.regulations ? (
                              <div
                                className="prose-content"
                                dangerouslySetInnerHTML={{ __html: tour.regulations }}
                              />
                            ) : (
                              <Typography.Text type="secondary">
                                No instructions yet.
                              </Typography.Text>
                            ),
                          },
                          {
                            key: "insurancePolicy",
                            label: (
                              <span>
                                <SafetyCertificateOutlined /> Insurance
                              </span>
                            ),
                            children: tour.insurancePolicy ? (
                              <div
                                className="prose-content"
                                dangerouslySetInnerHTML={{ __html: tour.insurancePolicy }}
                              />
                            ) : (
                              <Typography.Text type="secondary">
                                No insurance policy yet.
                              </Typography.Text>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  ) : null}

                  {/* LOCATION & ROUTE OVERVIEW */}
                  <Card
                    variant="borderless"
                    title={
                      <Flex align="center" gap={8}>
                        <EnvironmentOutlined style={{ color: "#10b981" }} />
                        <span>Location &amp; Route Overview</span>
                      </Flex>
                    }
                  >
                    {mapSrc ? (
                      <iframe
                        title={`Map - ${tour.name}`}
                        src={mapSrc}
                        style={{ width: "100%", height: 380, border: 0, borderRadius: 12, filter: "grayscale(0.15)" }}
                        loading="lazy"
                        allowFullScreen
                      />
                    ) : (
                      <Empty description="No map configured for this tour." />
                    )}
                  </Card>
                </Flex>
              </Col>

              {/* ─── RIGHT: TOUR BOOKING BOX ─── */}
              <Col xs={24} lg={6}>
                <Card
                  style={{
                    position: "sticky",
                    top: 16,
                    borderRadius: 16,
                    border: "1px solid var(--ant-color-border-secondary)",
                    overflow: "hidden",
                  }}
                  styles={{ body: { padding: 0 } }}
                >
                  <div
                    style={{
                      padding: "16px 20px",
                      color: "#062A30",
                      background: "linear-gradient(135deg, #22D3EE, #3B82F6)",
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: 16, letterSpacing: 0.5 }}>
                      TOUR BOOKING
                    </Typography.Text>
                  </div>
                  <Flex vertical gap={4} style={{ padding: 20 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      TOTAL PRICE
                    </Typography.Text>
                    {isPromoActive(tour) ? (
                      <>
                        <Typography.Text
                          type="secondary"
                          delete
                          style={{ fontSize: 15, lineHeight: 1 }}
                        >
                          {usd(tour.adultPrice)} {tour.currency}
                        </Typography.Text>
                        <Typography.Title level={3} style={{ margin: 0, color: "#dc2626" }}>
                          {usd(discountedPrice(tour.adultPrice, tour.discountPercent))}{" "}
                          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                            {tour.currency}
                          </Typography.Text>
                        </Typography.Title>
                        <Tag color="red" style={{ alignSelf: "flex-start" }}>
                          Save {tour.discountPercent}%
                        </Tag>
                      </>
                    ) : (
                      <Typography.Title level={3} style={{ margin: 0 }}>
                        {usd(tour.adultPrice)}{" "}
                        <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                          {tour.currency}
                        </Typography.Text>
                      </Typography.Title>
                    )}
                    <PromoCountdown tour={tour} />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      Per person · Taxes included
                    </Typography.Text>

                    <Divider style={{ margin: "16px 0" }} />

                    <Flex justify="space-between" style={{ marginBottom: 8 }}>
                      <Typography.Text>Duration</Typography.Text>
                      <Typography.Text strong>
                        {tour.durationDays ?? 1} {Number(tour.durationDays ?? 1) === 1 ? "Day" : "Days"}
                      </Typography.Text>
                    </Flex>
                    <Flex justify="space-between" style={{ marginBottom: 16 }}>
                      <Typography.Text>Stops</Typography.Text>
                      <Typography.Text strong>
                        {stops} Configured {stops === 1 ? "Stop" : "Stops"}
                      </Typography.Text>
                    </Flex>

                    <Button
                      type="primary"
                      size="large"
                      block
                      style={{ fontWeight: 700 }}
                      icon={<CalendarOutlined />}
                    >
                      BOOK THIS TOUR NOW
                    </Button>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 12, marginTop: 8, textAlign: "center" }}
                    >
                      Free cancellation within 24h
                    </Typography.Text>
                  </Flex>
                </Card>
              </Col>
            </Row>
          </Flex>
        )}
      </Flex>
    </div>
  );
}
