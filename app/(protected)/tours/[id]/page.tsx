"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Input,
  InputNumber,
  Segmented,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import {
  SaveOutlined,
  FileTextOutlined,
  PlusOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  HolderOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const ItineraryEditor = dynamic(() => import("@/components/itinerary-editor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <Spin />
    </div>
  ),
});

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

let counter = 0;
const nextKey = () => `__item_${Date.now()}_${counter++}`;

export default function TourDetailPage() {
  const params = useParams<{ id: string }>();
  const { hasPermission } = useApp();
  const [tour, setTour] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const editorRefs = useRef<Record<string, any>>({});

  const canEdit = hasPermission("tour.itinerary.edit");

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
      [...items].sort(
        (a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex,
      ),
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

  const patch = (key: string, change: Partial<ItineraryItem>) => {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...change } : it)));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        dayNumber: 1,
        orderIndex: prev.length,
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

  const onSave = async () => {
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

  const field = (
    label: string,
    control: React.ReactNode,
    span = 8,
  ) => (
    <Flex vertical gap={4} style={{ flex: `1 1 ${span > 1 ? "30%" : "auto"}` }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Typography.Text>
      {control}
    </Flex>
  );

  return (
    <div>
      <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
        {canEdit && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            Save Itinerary
          </Button>
        )}
      </Flex>

      <Card variant="borderless" style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, md: 4 }} size="small">
          <Descriptions.Item label="Tour Code">
            <Tag color="geekblue">{tour.code}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Adult Price">
            <Typography.Text strong>
              {tour.adultPrice ?? 0} {tour.currency}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Child Price">
            <Typography.Text strong>
              {tour.childPrice ?? 0} {tour.currency}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Infant Price">
            <Typography.Text strong>
              {tour.infantPrice ?? 0} {tour.currency}
            </Typography.Text>
          </Descriptions.Item>
          <Descriptions.Item label="Bookings">
            <Tag color="purple">{tour._count?.bookings ?? 0}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        variant="borderless"
        title={
          <Flex align="center" gap={12} wrap>
            <span>
              <FileTextOutlined /> Itinerary
              <Tag style={{ marginLeft: 8 }} color={canEdit ? "blue" : "default"}>
                {canEdit ? `${items.length} item${items.length === 1 ? "" : "s"}` : "read-only"}
              </Tag>
            </span>
            {canEdit && (
              <Segmented
                size="small"
                value={viewMode}
                onChange={(v) => setViewMode(v as "edit" | "preview")}
                options={[
                  { label: "Edit", value: "edit" },
                  { label: "Preview", value: "preview" },
                ]}
              />
            )}
          </Flex>
        }
      >
        {canEdit && viewMode === "preview" ? (
          days.length === 0 ? (
            <Empty description="No itinerary yet." />
          ) : (
            <Flex vertical gap={16}>
              {days.map(([day, dayItems]) => (
                <Card key={day} size="small" variant="borderless" title={`Day ${day}`}>
                  <Flex vertical gap={16}>
                    {dayItems.map((it) => (
                      <div key={it.key}>
                        <Flex align="center" gap={8} wrap>
                          <Tag color="blue">#{it.orderIndex + 1}</Tag>
                          <Typography.Text strong>{it.title}</Typography.Text>
                          {it.timeSlot && (
                            <Typography.Text type="secondary">
                              <ClockCircleOutlined /> {it.timeSlot}
                            </Typography.Text>
                          )}
                        </Flex>
                        {it.location && (
                          <Flex gap={4} align="center" style={{ marginTop: 4 }}>
                            <EnvironmentOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
                            <Typography.Text type="secondary">{it.location}</Typography.Text>
                          </Flex>
                        )}
                        {it.description ? (
                          <div
                            className="prose-content"
                            style={{ marginTop: 8 }}
                            dangerouslySetInnerHTML={{ __html: it.description }}
                          />
                        ) : null}
                        {it.location && (
                          <iframe
                            title={`Map - ${it.location}`}
                            src={`https://www.google.com/maps?q=${encodeURIComponent(it.location)}&output=embed`}
                            style={{
                              width: "100%",
                              height: 200,
                              border: 0,
                              borderRadius: 8,
                              marginTop: 12,
                              filter: "grayscale(0.2)",
                            }}
                            loading="lazy"
                            allowFullScreen
                          />
                        )}
                        <Divider style={{ margin: "12px 0 0" }} />
                      </div>
                    ))}
                  </Flex>
                </Card>
              ))}
            </Flex>
          )
        ) : canEdit ? (
          <Flex vertical gap={16}>
            {sorted.map((it, idx) => (
              <Card
                key={it.key}
                size="small"
                variant="borderless"
                title={`Item ${idx + 1}`}
                extra={
                  <Button
                    danger
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => removeItem(it.key)}
                  >
                    Remove
                  </Button>
                }
              >
                <Flex wrap gap={12} style={{ marginBottom: 12 }}>
                  {field("Day number", <InputNumber min={1} value={it.dayNumber} onChange={(v) => patch(it.key, { dayNumber: v ?? 1 })} />)}
                  {field("Order", <InputNumber min={0} value={it.orderIndex} onChange={(v) => patch(it.key, { orderIndex: v ?? 0 })} />)}
                  {field("Time slot", <Input value={it.timeSlot ?? ""} placeholder="09:00 AM" onChange={(e) => patch(it.key, { timeSlot: e.target.value })} />)}
                  {field("Location", <Input value={it.location ?? ""} placeholder="e.g. Marina Bay Sands" onChange={(e) => patch(it.key, { location: e.target.value })} />, 12)}
                </Flex>
                <Flex vertical gap={4} style={{ marginBottom: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Title
                  </Typography.Text>
                  <Input value={it.title} placeholder="Activity title" onChange={(e) => patch(it.key, { title: e.target.value })} />
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Description
                </Typography.Text>
                <div style={{ marginTop: 4 }}>
                  <ItineraryEditor
                    initialHtml={it.description ?? ""}
                    onChange={(html) => patch(it.key, { description: html })}
                    ref={(el: any) => {
                      editorRefs.current[it.key] = el;
                    }}
                  />
                </div>
              </Card>
            ))}
            <Flex justify="center">
              <Button icon={<PlusOutlined />} onClick={addItem}>
                Add itinerary item
              </Button>
            </Flex>
          </Flex>
        ) : days.length === 0 ? (
          <Empty description="No itinerary yet." />
        ) : (
          <Flex vertical gap={16}>
            {days.map(([day, dayItems]) => (
              <Card key={day} size="small" variant="borderless" title={`Day ${day}`}>
                <Flex vertical gap={16}>
                  {dayItems.map((it) => (
                    <div key={it.key}>
                      <Flex align="center" gap={8} wrap>
                        <Tag color="blue">#{it.orderIndex + 1}</Tag>
                        <Typography.Text strong>{it.title}</Typography.Text>
                        {it.timeSlot && (
                          <Typography.Text type="secondary">
                            <ClockCircleOutlined /> {it.timeSlot}
                          </Typography.Text>
                        )}
                      </Flex>
                      {it.location && (
                        <Flex gap={4} align="center" style={{ marginTop: 4 }}>
                          <EnvironmentOutlined style={{ color: "rgba(255,255,255,0.45)" }} />
                          <Typography.Text type="secondary">{it.location}</Typography.Text>
                        </Flex>
                      )}
                      {it.description ? (
                        <div
                          className="prose-content"
                          style={{ marginTop: 8 }}
                          dangerouslySetInnerHTML={{ __html: it.description }}
                        />
                      ) : null}
                      <Divider style={{ margin: "12px 0 0" }} />
                    </div>
                  ))}
                </Flex>
              </Card>
            ))}
          </Flex>
        )}
      </Card>
    </div>
  );
}
