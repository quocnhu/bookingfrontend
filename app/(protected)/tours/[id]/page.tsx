"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Flex,
  Input,
  InputNumber,
  Row,
  Segmented,
  Select,
  Spin,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import {
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  FolderOpenOutlined,
  PrinterOutlined,
  EyeOutlined,
  CarOutlined,
  StarOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useMapSrc } from "@/lib/use-map-src";
import { discountedPrice, isPromoActive } from "@/lib/promo";
import PromoCountdown from "@/components/promo-countdown";
import GalleryManager, { type GalleryImage } from "@/components/gallery-manager";
import TourSlideshow from "@/components/tour-slideshow";
import DayTimeline from "@/components/day-timeline";

const RichTextEditor = dynamic(() => import("@/components/rich-text-editor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
      <Spin />
    </div>
  ),
});

const TYPE_OPTIONS = [
  { value: "PRIVATE_TOUR", label: "Private Tour" },
  { value: "GROUP_TOUR", label: "Group Tour" },
];

interface ItineraryItem {
  key: string;
  id?: string;
  dayNumber: number;
  orderIndex: number;
  title: string;
  description?: string | null;
  timeSlot?: string | null;
  location?: string | null;
}

interface TourState {
  id: string;
  code?: string;
  name: string;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  durationDays?: number | null;
  departureLocation?: string | null;
  transportation?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  discountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  overview?: string | null;
  highlights?: string | null;
  includedServices?: string | null;
  excludedServices?: string | null;
  regulations?: string | null;
  insurancePolicy?: string | null;
  mapQuery?: string | null;
  gallery?: GalleryImage[];
}

let counter = 0;
const nextKey = () => `__item_${Date.now()}_${counter++}`;

const RICH_FIELDS: Array<{ key: keyof TourState; label: string }> = [
  { key: "highlights", label: "Highlights" },
  { key: "overview", label: "Itinerary" },
  { key: "regulations", label: "Instructions" },
  { key: "insurancePolicy", label: "Insurance" },
];

const TAB_FIELDS: Array<{ key: keyof TourState; label: string; icon: React.ReactNode }> = [
  { key: "overview", label: "Itinerary", icon: <CalendarOutlined /> },
  { key: "regulations", label: "Instructions", icon: <ReadOutlined /> },
  { key: "insurancePolicy", label: "Insurance", icon: <SafetyCertificateOutlined /> },
];

export default function TourItineraryEditorPage() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useApp();
  const canEdit = hasPermission("tour.itinerary.edit") || hasPermission("tour.update");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"edit" | "public">("edit");
  const [tour, setTour] = useState<TourState | null>(null);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const editorRefs = useRef<Record<string, any>>({});
  const richRefs = useRef<Record<string, any>>({});

  const load = () => {
    setLoading(true);
    api
      .get(`/tours/${params.id}`)
      .then((r) => {
        setTour(r.data);
        setItems(
          (r.data.itineraries ?? []).map((it: any) => ({ ...it, key: it.id ?? nextKey() })),
        );
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [params.id]);

  const sorted = useMemo(
    () =>
      [...items].sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex),
    [items],
  );

  const days = useMemo(() => {
    const map = new Map<number, ItineraryItem[]>();
    sorted.forEach((it) => {
      if (!map.has(it.dayNumber)) map.set(it.dayNumber, []);
      map.get(it.dayNumber)!.push(it);
    });
    return [...map.entries()];
  }, [sorted]);

  const maxDay = days.length > 0 ? days[days.length - 1][0] : 0;

  const mapSrc = useMapSrc(tour?.mapQuery, tour?.departureLocation);

  const patch = (key: string, change: Partial<ItineraryItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...change } : it)));
  };

  const patchTour = (change: Partial<TourState>) => {
    setTour((prev) => (prev ? { ...prev, ...change } : prev));
  };

  const addItem = (dayNumber: number) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        dayNumber,
        orderIndex: prev.filter((i) => i.dayNumber === dayNumber).length,
        title: "",
        description: "",
        timeSlot: "",
        location: "",
      },
    ]);
  };

  const addDay = () => {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        dayNumber: maxDay + 1,
        orderIndex: 0,
        title: "",
        description: "",
        timeSlot: "",
        location: "",
      },
    ]);
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((it) => it.key !== key));
    delete editorRefs.current[key];
  };

  const removeDay = (day: number) => {
    const keys = items.filter((i) => i.dayNumber === day).map((i) => i.key);
    keys.forEach((k) => delete editorRefs.current[k]);
    setItems((prev) => prev.filter((i) => i.dayNumber !== day));
  };

  const onSave = async () => {
    if (!tour) return;
    setSaving(true);
    try {
      const payload = items.map((it) => ({
        dayNumber: it.dayNumber,
        orderIndex: it.orderIndex,
        title: it.title,
        description: editorRefs.current[it.key]?.getHTML() ?? it.description ?? "",
        timeSlot: it.timeSlot ?? "",
        location: it.location ?? "",
      }));
      const rich: Record<string, string | undefined> = {};
      RICH_FIELDS.forEach(({ key }) => {
        const refKey = `rich:${key}`;
        const html = richRefs.current[refKey]?.getHTML();
        if (html !== undefined && html !== null) rich[key] = html;
      });

      await api.put(`/tours/${params.id}`, {
        name: tour.name,
        type: tour.type,
        thumbnailUrl: tour.thumbnailUrl,
        durationDays: tour.durationDays ?? 1,
        departureLocation: tour.departureLocation,
        transportation: tour.transportation,
        adultPrice: tour.adultPrice,
        childPrice: tour.childPrice,
        infantPrice: tour.infantPrice,
        currency: tour.currency,
        mapQuery: tour.mapQuery,
        ...rich,
      });
      await api.put(`/tours/${params.id}/itinerary`, { items: payload });
      message.success("Itinerary saved");
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!tour) return <Empty description="Tour not found." />;

  const stops = items.length;

  const field = (label: string, control: React.ReactNode, grow = true) => (
    <Flex vertical gap={4} style={{ flex: grow ? "1 1 30%" : undefined }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      {control}
    </Flex>
  );

  const slideshow = (
    <TourSlideshow images={tour.gallery ?? []} />
  );

  return (
    <div>
      {/* ─── TOP ACTION BAR ─── */}
      <Card className="no-print" variant="borderless" style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center" wrap gap={12}>
          <Flex align="center" gap={12} wrap style={{ flex: "1 1 300px" }}>
            <Flex gap={8} align="center">
              <Tag color="geekblue">{tour.code}</Tag>
              {canEdit ? (
                <Input
                  style={{ maxWidth: 360, fontWeight: 600 }}
                  value={tour.name}
                  onChange={(e) => patchTour({ name: e.target.value })}
                />
              ) : (
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {tour.name}
                </Typography.Title>
              )}
            </Flex>
          </Flex>
          <Flex gap={8} align="center">
            {canEdit && (
              <Segmented
                value={mode}
                onChange={(v) => setMode(v as "edit" | "public")}
                options={[
                  { label: "Editor", value: "edit", icon: <SaveOutlined /> },
                  { label: "Public view", value: "public", icon: <EyeOutlined /> },
                ]}
              />
            )}
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print Itinerary
            </Button>
            {canEdit && (
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
                Save
              </Button>
            )}
          </Flex>
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        {/* ─── LEFT: MAIN CONTENT ─── */}
        <Col xs={24} lg={16}>
          <Flex vertical gap={16}>
            {/* SLIDESHOW / FOLDER GALLERY */}
            <Card
              variant="borderless"
              title={
                <Flex align="center" gap={8}>
                  <FolderOpenOutlined />
                  <span>Tour Image Slideshow / Folder Gallery</span>
                </Flex>
              }
              className="print-full"
            >
              {canEdit && mode === "edit" ? (
                <GalleryManager
                  tourId={tour.id}
                  images={tour.gallery ?? []}
                  onChanged={(images) => patchTour({ gallery: images })}
                />
              ) : (
                slideshow
              )}
            </Card>

            {/* PICKUP & MEETING LOCATION */}
            <Card
              variant="borderless"
              title={
                <Flex align="center" gap={8}>
                  <EnvironmentOutlined style={{ color: "#22d3ee" }} />
                  <span>Pickup Location &amp; Meeting Point</span>
                </Flex>
              }
            >
              {canEdit && mode === "edit" ? (
                <Flex wrap gap={12}>
                  {field("Pickup / meeting point", <Input value={tour.departureLocation ?? ""} placeholder="e.g. Central Station Plaza, Main Gate 3" onChange={(e) => patchTour({ departureLocation: e.target.value })} />)}
                  {field("Transportation", <Input value={tour.transportation ?? ""} placeholder="e.g. AC coach, boat" onChange={(e) => patchTour({ transportation: e.target.value })} />)}
                </Flex>
              ) : (
                <Flex vertical gap={8}>
                  {tour.departureLocation ? (
                    <Typography.Text style={{ fontSize: 15 }}>
                      <EnvironmentOutlined style={{ color: "#22d3ee", marginRight: 8 }} />
                      {tour.departureLocation}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">No pickup location configured.</Typography.Text>
                  )}
                  {tour.transportation && (
                    <Typography.Text type="secondary">
                      <CarOutlined style={{ marginRight: 8 }} />
                      {tour.transportation}
                    </Typography.Text>
                  )}
                </Flex>
              )}
            </Card>

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
              {days.length === 0 && !(canEdit && mode === "edit") ? (
                <Empty description="No itinerary published yet." />
              ) : (
                <Flex vertical gap={16}>
                  <DayTimeline>
                    {days.map(([day, dayItems], di) => (
                      <div key={day} className="timeline-day">
                        <div className="timeline-rail">
                          <span
                            className="knot-dot"
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
                              border: "2px solid var(--ant-color-bg-container)",
                              animationDelay: `${(di * 3.5) / Math.max(days.length, 1)}s`,
                            }}
                          />
                        </div>
                        <div className="timeline-content">
                          <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
                            <Typography.Text strong style={{ fontSize: 15 }}>
                              Day {day}
                            </Typography.Text>
                            {canEdit && mode === "edit" && (
                              <Button
                                danger
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => removeDay(day)}
                              >
                                Remove day
                              </Button>
                            )}
                          </Flex>
                          <Flex vertical gap={12}>
                            {dayItems.map((it) => (
                              <Card
                                key={it.key}
                                size="small"
                                variant="borderless"
                                styles={{ body: { padding: 16 } }}
                                style={{ border: "1px solid var(--ant-color-border-secondary)" }}
                              >
                                {canEdit && mode === "edit" ? (
                                  <Flex vertical gap={12}>
                                    <Flex wrap gap={12}>
                                      {field("Title", <Input value={it.title} placeholder="e.g. Arrival & Hotel Check-in" onChange={(e) => patch(it.key, { title: e.target.value })} />, false)}
                                    </Flex>
                                    <Flex wrap gap={12}>
                                      {field("Time slot", <Input value={it.timeSlot ?? ""} placeholder="e.g. 14:00" prefix={<ClockCircleOutlined />} onChange={(e) => patch(it.key, { timeSlot: e.target.value })} />)}
                                      {field("Location", <Input value={it.location ?? ""} placeholder="e.g. Central Station" prefix={<EnvironmentOutlined />} onChange={(e) => patch(it.key, { location: e.target.value })} />)}
                                    </Flex>
                                    <RichTextEditor
                                      ref={(el: any) => {
                                        editorRefs.current[it.key] = el;
                                      }}
                                      initialHtml={it.description ?? ""}
                                      onChange={(html) => patch(it.key, { description: html })}
                                      placeholder="Describe this stop…"
                                    />
                                    <Flex justify="flex-end">
                                      <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeItem(it.key)}>
                                        Remove stop
                                      </Button>
                                    </Flex>
                                  </Flex>
                                ) : (
                                  <Flex vertical gap={6}>
                                    <Flex align="center" gap={8} wrap>
                                      <Typography.Text strong>{it.title || "Untitled stop"}</Typography.Text>
                                      {it.timeSlot && (
                                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                                          <ClockCircleOutlined /> {it.timeSlot}
                                        </Typography.Text>
                                      )}
                                    </Flex>
                                    {it.location && (
                                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                                        <EnvironmentOutlined style={{ marginRight: 4 }} />
                                        {it.location}
                                      </Typography.Text>
                                    )}
                                    {it.description ? (
                                      <div
                                        className="prose-content"
                                        style={{ marginTop: 4 }}
                                        dangerouslySetInnerHTML={{ __html: it.description }}
                                      />
                                    ) : null}
                                  </Flex>
                                )}
                              </Card>
                            ))}
                            {canEdit && mode === "edit" && (
                              <Button
                                icon={<PlusOutlined />}
                                onClick={() => addItem(day)}
                                style={{ alignSelf: "flex-start" }}
                              >
                                Add stop
                              </Button>
                            )}
                          </Flex>
                        </div>
                      </div>
                    ))}
                  </DayTimeline>
                  {canEdit && mode === "edit" && (
                    <Button icon={<PlusOutlined />} onClick={addDay} block>
                      + Add Day
                    </Button>
                  )}
                </Flex>
              )}
            </Card>

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
              {canEdit && mode === "edit" && (
                <Flex vertical gap={12} style={{ marginBottom: 12 }}>
                  {field("Map center: Google Maps embed code, place name, \"lat,lng\" or a Google Maps link", <Input value={tour.mapQuery ?? ""} placeholder='e.g. paste a Google Maps embed <iframe> code, "46.5198,6.6323", "Lausanne, Switzerland" or a Google Maps share link' onChange={(e) => patchTour({ mapQuery: e.target.value })} />)}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    This value is converted into a Google Maps embed and shown in the &ldquo;Location &amp; Route Overview&rdquo; box on the tour page.
                  </Typography.Text>
                </Flex>
              )}
              {mapSrc ? (
                <iframe
                  title={`Map - ${tour.name}`}
                  src={mapSrc}
                  style={{ width: "100%", height: 360, border: 0, borderRadius: 12, filter: "grayscale(0.15)" }}
                  loading="lazy"
                  allowFullScreen
                />
              ) : (
                <Empty description="Set a map center to show the route overview." />
              )}
            </Card>

            {/* HIGHLIGHTS + TABBED CONTENT SECTIONS */}
            {canEdit || RICH_FIELDS.some(({ key }) => tour[key as keyof TourState]) ? (
              <Card variant="borderless" title="Tour content">
                <Flex vertical gap={8}>
                  <Typography.Text strong>
                    <StarOutlined style={{ color: "#f59e0b", marginRight: 8 }} />
                    Highlights
                  </Typography.Text>
                  {canEdit && mode === "edit" ? (
                    <RichTextEditor
                      ref={(el: any) => {
                        richRefs.current["rich:highlights"] = el;
                      }}
                      initialHtml={tour.highlights ?? ""}
                      minHeight={120}
                      placeholder="Write highlights for this tour…"
                    />
                  ) : tour.highlights ? (
                    <div
                      className="prose-content"
                      dangerouslySetInnerHTML={{ __html: tour.highlights }}
                    />
                  ) : null}
                </Flex>
                <Divider style={{ margin: "16px 0" }} />
                <Tabs
                  defaultActiveKey="overview"
                  items={TAB_FIELDS.map(({ key, label, icon }) => ({
                    key: String(key),
                    label: (
                      <span>
                        {icon} {label}
                      </span>
                    ),
                    children:
                      canEdit && mode === "edit" ? (
                        <RichTextEditor
                          ref={(el: any) => {
                            richRefs.current[`rich:${key}`] = el;
                          }}
                          initialHtml={(tour[key as keyof TourState] as string) ?? ""}
                          minHeight={140}
                          placeholder={`Write ${label.toLowerCase()}…`}
                        />
                      ) : (tour[key as keyof TourState] as string) ? (
                        <div
                          className="prose-content"
                          dangerouslySetInnerHTML={{
                            __html: tour[key as keyof TourState] as string,
                          }}
                        />
                      ) : (
                        <Typography.Text type="secondary">
                          No {label.toLowerCase()} content yet.
                        </Typography.Text>
                      ),
                  }))}
                />
              </Card>
            ) : null}
          </Flex>
        </Col>

        {/* ─── RIGHT: TOUR BOOKING BOX ─── */}
        <Col xs={24} lg={8}>
          <Card
            className="print-full"
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
              <Flex align="center" gap={8}>
                <Typography.Text strong style={{ fontSize: 16, letterSpacing: 0.5 }}>
                  TOUR BOOKING
                </Typography.Text>
              </Flex>
            </div>
            <Flex vertical gap={4} style={{ padding: 20 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                TOTAL PRICE
              </Typography.Text>
              {canEdit && mode === "edit" ? (
                <Flex align="center" gap={8}>
                  <InputNumber
                    value={Number(tour.adultPrice ?? 0)}
                    min={0}
                    style={{ fontWeight: 700, fontSize: 24, width: 160 }}
                    onChange={(v) => patchTour({ adultPrice: v })}
                  />
                  <Select
                    value={tour.currency ?? "USD"}
                    style={{ width: 80 }}
                    options={["VND", "USD", "EUR"].map((c) => ({ value: c, label: c }))}
                    onChange={(c) => patchTour({ currency: c })}
                  />
                </Flex>
              ) : (
                <>
                  {isPromoActive(tour) ? (
                    <>
                      <Typography.Text
                        type="secondary"
                        delete
                        style={{ fontSize: 15, lineHeight: 1 }}
                      >
                        {Number(tour.adultPrice ?? 0).toLocaleString()} {tour.currency}
                      </Typography.Text>
                      <Typography.Title level={3} style={{ margin: 0, color: "#dc2626" }}>
                        {Number(discountedPrice(tour.adultPrice, tour.discountPercent)).toLocaleString()}{" "}
                        {tour.currency}
                      </Typography.Title>
                      <Tag color="red" style={{ alignSelf: "flex-start" }}>
                        Save {tour.discountPercent}%
                      </Tag>
                    </>
                  ) : (
                    <Typography.Title level={3} style={{ margin: 0 }}>
                      {Number(tour.adultPrice ?? 0).toLocaleString()} {tour.currency}
                    </Typography.Title>
                  )}
                </>
              )}
              <PromoCountdown tour={tour} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Per person · Taxes included
              </Typography.Text>

              <Divider style={{ margin: "16px 0" }} />

              <Flex justify="space-between" style={{ marginBottom: 8 }}>
                <Typography.Text>Duration</Typography.Text>
                {canEdit && mode === "edit" ? (
                  <InputNumber
                    min={1}
                    size="small"
                    value={tour.durationDays ?? 1}
                    style={{ width: 72 }}
                    onChange={(v) => patchTour({ durationDays: v })}
                  />
                ) : (
                  <Typography.Text strong>
                    {tour.durationDays ?? 1} {Number(tour.durationDays ?? 1) === 1 ? "Day" : "Days"}
                  </Typography.Text>
                )}
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
              <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 8, textAlign: "center" }}>
                Free cancellation within 24h
              </Typography.Text>
            </Flex>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
