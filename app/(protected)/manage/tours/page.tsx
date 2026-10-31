"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Table,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import { PlusOutlined, DeleteOutlined, EditOutlined, PictureOutlined, ScheduleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { isTypePromoActive } from "@/lib/promo";
import {
  departureLabel,
  formatDepartureTime,
  formatTourDuration,
} from "@/lib/tour-display";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";
import ThumbnailPicker from "@/components/thumbnail-picker";
import GalleryManager, { type GalleryImage } from "@/components/gallery-manager";

interface Tour {
  id: string;
  code?: string;
  name: string;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  durationDays?: number | null;
  durationValue?: number | null;
  durationUnit?: "HOUR" | "DAY" | null;
  freeCancellationHours?: number | null;
  cancellationPolicy?: string | null;
  departureTimes?: string[] | null;
  departureLocation?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  privateDiscountPercent?: number | null;
  groupDiscountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  typePrices?: {
    type: "PRIVATE_TOUR" | "GROUP_TOUR";
    adultPrice?: string | number | null;
    childPrice?: string | number | null;
    infantPrice?: string | number | null;
    currency?: string | null;
  }[];
  gallery?: GalleryImage[];
  _count?: { bookings: number };
}

const LIMIT = 20;

const PRIVATE_COLOR = "#722ed1";
const GROUP_COLOR = "#08979c";
const PERSON_COLORS = {
  adult: "#1677ff",
  child: "#fa8c16",
  infant: "#52c41a",
};

function PriceField({
  name,
  label,
  color,
}: {
  name: string;
  label: string;
  color: string;
}) {
  return (
    <Form.Item
      name={name}
      label={
        <span style={{ color, fontWeight: 600 }}>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: 4,
              background: color,
              marginRight: 6,
            }}
          />
          {label}
        </span>
      }
      initialValue={0}
    >
      <InputNumber
        style={{ width: "100%", borderColor: color }}
        min={0}
      />
    </Form.Item>
  );
}

function PricingSection({
  title,
  color,
  background,
  prefix,
}: {
  title: string;
  color: string;
  background: string;
  prefix: "privatePrices" | "groupPrices";
}) {
  return (
    <Flex
      vertical
      gap={8}
      style={{
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${color}`,
        background,
      }}
    >
      <Tag color={color} style={{ alignSelf: "flex-start", margin: 0 }}>
        {title}
      </Tag>
      <Row gutter={12}>
        <Col span={8}>
          <PriceField
            name={`${prefix}Adult`}
            label="Adult price"
            color={PERSON_COLORS.adult}
          />
        </Col>
        <Col span={8}>
          <PriceField
            name={`${prefix}Child`}
            label="Child price"
            color={PERSON_COLORS.child}
          />
        </Col>
        <Col span={8}>
          <PriceField
            name={`${prefix}Infant`}
            label="Infant price"
            color={PERSON_COLORS.infant}
          />
        </Col>
      </Row>
    </Flex>
  );
}

function promotionState(
  pct: number | null | undefined,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): { label: string; color: string } | null {
  if (!pct || pct <= 0) return null;
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (start && now < start) return { label: `-${pct}% (upcoming)`, color: "orange" };
  if (end && now > end) return { label: `-${pct}% (ended)`, color: "default" };
  return { label: `-${pct}%`, color: "red" };
}

function promotionTags(r: Tour) {
  const tags: React.ReactNode[] = [];
  const stP = promotionState(r.privateDiscountPercent, r.promotionStartsAt, r.promotionEndsAt);
  const stG = promotionState(r.groupDiscountPercent, r.promotionStartsAt, r.promotionEndsAt);
  if (stP) tags.push(<Tag key="private" color={stP.color}>Private {stP.label}</Tag>);
  if (stG) tags.push(<Tag key="group" color={stG.color}>Group {stG.label}</Tag>);
  return tags.length > 0 ? tags : null;
}

export default function ToursPage() {
  const router = useRouter();
  const { hasPermission } = useApp();
  const canCreate = hasPermission("tour.create");
  const canUpdate = hasPermission("tour.update");
  const canDelete = hasPermission("tour.delete");

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(LIMIT);

  const tableHeight = useFillHeight({
    rootSelector: ".tours-page",
    activeTab: "",
    deps: [data?.items?.length],
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<Tour | null>(null);
  const [saving, setSaving] = useState(false);

  const [galleryTour, setGalleryTour] = useState<Tour | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: pageSize };
      const r = await api.get("/tours", { params });
      setData(r.data);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, pageSize]);

  const openModal = (tour?: Tour) => {
    setEditing(tour ?? null);
    const prices = (tour?.typePrices ?? []).reduce<Record<string, any>>((acc, p) => {
      acc[p.type] = p;
      return acc;
    }, {});
    const pvt = prices["PRIVATE_TOUR"];
    const grp = prices["GROUP_TOUR"];
    form.setFieldsValue({
      name: tour?.name ?? "",
      thumbnailUrl: tour?.thumbnailUrl ?? null,
      durationDays: tour?.durationDays ?? 1,
      durationValue: tour?.durationValue ?? tour?.durationDays ?? 1,
      durationUnit: tour?.durationUnit ?? "DAY",
      freeCancellationHours: tour?.freeCancellationHours ?? 24,
      cancellationPolicy: tour?.cancellationPolicy ?? "",
      departureTimes: tour?.departureTimes ?? [],
      departureLocation: tour?.departureLocation ?? "",
      privatePricesAdult: pvt?.adultPrice ?? (tour?.type === "PRIVATE_TOUR" ? tour?.adultPrice : 0) ?? 0,
      privatePricesChild: pvt?.childPrice ?? (tour?.type === "PRIVATE_TOUR" ? tour?.childPrice : 0) ?? 0,
      privatePricesInfant: pvt?.infantPrice ?? (tour?.type === "PRIVATE_TOUR" ? tour?.infantPrice : 0) ?? 0,
      groupPricesAdult: grp?.adultPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.adultPrice : 0) ?? 0,
      groupPricesChild: grp?.childPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.childPrice : 0) ?? 0,
      groupPricesInfant: grp?.infantPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.infantPrice : 0) ?? 0,
      currency: tour?.currency ?? "USD",
      privateDiscountPercent: tour?.privateDiscountPercent ?? 0,
      groupDiscountPercent: tour?.groupDiscountPercent ?? 0,
      promotionWindow:
        tour?.promotionStartsAt && tour?.promotionEndsAt
          ? [dayjs(tour.promotionStartsAt), dayjs(tour.promotionEndsAt)]
          : null,
    });
    setDrawerOpen(true);
  };

  const openGallery = async (tour: Tour) => {
    try {
      const r = await api.get(`/tours/${tour.id}`);
      setGalleryTour(r.data);
      setGalleryOpen(true);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load gallery"));
    }
  };

  const save = async () => {
    const values = await form.validateFields();
    const window = values.promotionWindow as [Dayjs, Dayjs] | null | undefined;
    const typePrices = [
      {
        type: "PRIVATE_TOUR",
        adultPrice: values.privatePricesAdult,
        childPrice: values.privatePricesChild,
        infantPrice: values.privatePricesInfant,
      },
      {
        type: "GROUP_TOUR",
        adultPrice: values.groupPricesAdult,
        childPrice: values.groupPricesChild,
        infantPrice: values.groupPricesInfant,
      },
    ];
    const tourType = editing?.type ?? "PRIVATE_TOUR";
    const primaryTypePrices =
      typePrices.find((p) => p.type === tourType) ?? typePrices[0];
    const durationValue = Number(values.durationValue ?? values.durationDays ?? 1);
    const durationUnit = values.durationUnit ?? "DAY";
    const durationDays =
      durationUnit === "DAY"
        ? durationValue
        : Math.max(1, Math.ceil(durationValue / 24));
    const payload: any = {
      name: values.name,
      type: tourType,
      thumbnailUrl: values.thumbnailUrl,
      durationDays,
      durationValue,
      durationUnit,
      freeCancellationHours: values.freeCancellationHours,
      cancellationPolicy: values.cancellationPolicy,
      departureTimes: values.departureTimes,
      departureLocation: values.departureLocation,
      currency: values.currency,
      privateDiscountPercent: values.privateDiscountPercent,
      groupDiscountPercent: values.groupDiscountPercent,
      promotionStartsAt: window ? window[0].toISOString() : null,
      promotionEndsAt: window ? window[1].toISOString() : null,
      adultPrice: primaryTypePrices.adultPrice,
      childPrice: primaryTypePrices.childPrice,
      infantPrice: primaryTypePrices.infantPrice,
      typePrices,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/tours/${editing.id}`, payload);
        message.success("Tour updated");
      } else {
        await api.post("/tours", payload);
        message.success("Tour created");
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save tour"));
    } finally {
      setSaving(false);
    }
  };

  const columns = centerColumns([
    indexColumn<Tour>(page, pageSize),
    {
      title: "Thumbnail",
      dataIndex: "thumbnailUrl",
      key: "thumbnailUrl",
      filters: [
        { text: "Has image", value: "yes" },
        { text: "No image", value: "no" },
      ],
      onFilter: (v: any, r: Tour) => v === "yes" ? !!r.thumbnailUrl : !r.thumbnailUrl,
      render: (v: string | null) =>
        v ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={v}
            alt="tour"
            style={{ width: 56, height: 40, borderRadius: 8, objectFit: "cover" }}
          />
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    { title: "Code", dataIndex: "code", key: "code", onFilter: (v: any, r: Tour) => (r.code ?? "").toLowerCase().includes(String(v).toLowerCase()) },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 360,
      ellipsis: { showTitle: true },
      onFilter: (v: any, r: Tour) => (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Group",
      dataIndex: "type",
      key: "group",
      filters: [
        { text: "Private", value: "PRIVATE_TOUR" },
        { text: "Group", value: "GROUP_TOUR" },
      ],
      onFilter: (v: any, r: Tour) => r.type === v,
      render: (v: Tour["type"]) => (
        <Tag color={v === "PRIVATE_TOUR" ? "purple" : "cyan"}>
          {v === "PRIVATE_TOUR" ? "Private" : "Group"}
        </Tag>
      ),
    },
    {
      title: "Duration",
      key: "duration",
      render: (_: any, r: Tour) => <Tag>{formatTourDuration(r)}</Tag>,
    },
    {
      title: "Departures",
      key: "departures",
      filters: [
        { text: "Morning", value: "Morning" },
        { text: "Afternoon", value: "Afternoon" },
        { text: "Evening", value: "Evening" },
      ],
      onFilter: (v: any, r: Tour) =>
        (r.departureTimes ?? []).some((time) => departureLabel(time) === v),
      render: (_: any, r: Tour) =>
        r.departureTimes?.length ? (
          <Flex gap={4} wrap>
            {r.departureTimes.map((time) => (
              <Tag key={time} color="geekblue" style={{ margin: 0 }}>
                {formatDepartureTime(time)}
              </Tag>
            ))}
          </Flex>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "Bookings",
      dataIndex: "_count",
      key: "bookings",
      render: (v: any) => <Tag color="blue">{v?.bookings ?? 0}</Tag>,
      onFilter: (v: any, r: any) => String(r._count?.bookings ?? 0).includes(String(v)),
    },
    {
      title: "Promotion",
      key: "promotion",
      render: (_: any, r: Tour) => {
        const tags = promotionTags(r);
        return tags ?? <Typography.Text type="secondary">—</Typography.Text>;
      },
      filters: [
        { text: "Active", value: "active" },
        { text: "Scheduled", value: "scheduled" },
        { text: "Expired", value: "expired" },
      ],
      onFilter: (v: any, r: Tour) => {
        const pct = Math.max(Number(r.privateDiscountPercent ?? 0), Number(r.groupDiscountPercent ?? 0));
        const st = promotionState(pct, r.promotionStartsAt, r.promotionEndsAt);
        return st?.label.toLowerCase().includes(String(v).toLowerCase()) ?? false;
      },
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, r: Tour) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
          {canUpdate && (
            <Button
              size="small"
              icon={<ScheduleOutlined />}
              onClick={() => router.push(`/manage/tours/${r.id}`)}
              aria-label={`Itinerary ${r.name}`}
              title="Edit itinerary"
            />
          )}
          {canUpdate && (
            <Button
              size="small"
              icon={<PictureOutlined />}
              onClick={() => openGallery(r)}
              aria-label={`Gallery ${r.name}`}
            />
          )}
          {canUpdate && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openModal(r)}
              aria-label={`Edit ${r.name}`}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this tour?"
              onConfirm={async () => {
                try {
                  await api.delete(`/tours/${r.id}`);
                  message.success("Tour deleted");
                  load();
                } catch (e) {
                  message.error(getErrorMessage(e));
                }
              }}
            >
              <Button danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </span>
      ),
    },
  ]);

  const tours: Tour[] = data?.items ?? [];

  return (
    <div className="tours-page">
      <Card
        variant="borderless"
        title="Declared tours"
        extra={
          <Flex wrap gap={8} align="center">
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Add Tour
              </Button>
            )}
          </Flex>
        }
      >
        <Table
          size="small"
          scroll={{ x: 1200, y: tableHeight }}
          rowKey="id"
          columns={columns}
          dataSource={tours}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onChange: paginationChange(setPage, setPageSize, pageSize),
            showTotal: (t) => `Total: ${t}`,
          }}
        />
      </Card>

      <Drawer
        title={editing ? `Edit Tour: ${editing.name}` : "Add Tour"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={620}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={save}>
              {editing ? "Save changes" : "Create tour"}
            </Button>
          </Flex>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="thumbnailUrl" label="Thumbnail">
            <ThumbnailPicker />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tour name"
            rules={[{ required: true, message: "Tour name required" }]}
          >
            <Input placeholder="e.g. Ha Long Bay Full Day" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="durationValue"
                label="Duration"
                initialValue={1}
              >
                <InputNumber style={{ width: "100%" }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="durationUnit"
                label="Duration unit"
                initialValue="DAY"
              >
                <Select
                  options={[
                    { value: "HOUR", label: "Hour(s)" },
                    { value: "DAY", label: "Day(s)" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="freeCancellationHours"
                label="Free cancellation (hours)"
                initialValue={24}
              >
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="departureLocation"
            label="Pickup / meeting point"
          >
            <Input placeholder="e.g. Central Station Plaza, Main Gate 3" />
          </Form.Item>
          <Form.Item name="cancellationPolicy" label="Cancellation policy note">
            <Input.TextArea
              rows={2}
              placeholder="Shown on the tour page when provided"
            />
          </Form.Item>
          <Form.Item
            name="departureTimes"
            label="Departure times"
            extra="Type a time and press Enter, e.g. 08:00, 13:30"
            rules={[
              {
                validator: (_, value: string[] | undefined) => {
                  const bad = (value ?? []).find(
                    (time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time),
                  );
                  return bad
                    ? Promise.reject(
                        new Error(`Use 24-hour HH:mm format: ${bad}`),
                      )
                    : Promise.resolve();
                },
              },
            ]}
          >
            <Select
              mode="tags"
              tokenSeparators={[",", " "]}
              placeholder="08:00, 13:30"
              options={[]}
            />
          </Form.Item>
          <Flex vertical gap={12} style={{ marginTop: 8 }}>
            <PricingSection
              title="Private Tour pricing"
              color={PRIVATE_COLOR}
              background="rgba(114, 46, 209, 0.06)"
              prefix="privatePrices"
            />
            <PricingSection
              title="Group Tour pricing"
              color={GROUP_COLOR}
              background="rgba(8, 151, 156, 0.06)"
              prefix="groupPrices"
            />
          </Flex>
          <Form.Item name="currency" label="Currency" initialValue="USD">
            <Select
              options={["VND", "USD", "EUR"].map((c) => ({ value: c, label: c }))}
              showSearch
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="privateDiscountPercent" label="Private promotion discount (%)" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="groupDiscountPercent" label="Group promotion discount (%)" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="promotionWindow" label="Promotion window (start → end)">
            <DatePicker.RangePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Button
            danger
            block
            icon={<CloseCircleOutlined />}
            onClick={() =>
              form.setFieldsValue({ privateDiscountPercent: 0, groupDiscountPercent: 0, promotionWindow: null })
            }
          >
            Reset discounts & window
          </Button>
        </Form>
      </Drawer>
      <Modal
        title={`Photo folder — ${galleryTour?.name ?? ""}`}
        open={galleryOpen}
        onCancel={() => setGalleryOpen(false)}
        footer={null}
        width={720}
      >
        {galleryTour && (
          <GalleryManager
            tourId={galleryTour.id}
            images={galleryTour.gallery ?? []}
            onChanged={(images) => setGalleryTour((prev) => (prev ? { ...prev, gallery: images } : prev))}
          />
        )}
      </Modal>
    </div>
  );
}
