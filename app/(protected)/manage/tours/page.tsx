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
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import { PlusOutlined, DeleteOutlined, EditOutlined, PictureOutlined, ScheduleOutlined, CloseCircleOutlined, TagsOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { isTypePromoActive } from "@/lib/promo";
import {
  departureLabel,
  formatDepartureTime,
  formatTourDuration,
  hasTypePrice,
} from "@/lib/tour-display";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";
import ThumbnailPicker from "@/components/thumbnail-picker";
import GalleryManager, { type GalleryImage } from "@/components/gallery-manager";
import TourCategoryManager, {
  type AdminTourCategory,
} from "@/components/tour-category-manager";

interface Tour {
  id: string;
  code?: string;
  name: string;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  requiresGuide?: boolean;
  thumbnailUrl?: string | null;
  durationDays?: number | null;
  durationValue?: number | null;
  durationUnit?: "HOUR" | "DAY" | null;
  freeCancellationHours?: number | null;
  freeCancellationValue?: number | null;
  freeCancellationUnit?: "HOUR" | "DAY" | null;
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
  privatePaxPrices?: {
    pax: number;
    pricePerPerson?: string | number | null;
    currency?: string | null;
  }[];
  gallery?: GalleryImage[];
  categories?: {
    categoryId: string;
    isPrimary: boolean;
    category: { id: string; name: string; slug: string };
  }[];
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
      <InputNumber<number>
        style={{ width: "100%", borderColor: color }}
        min={0}
        formatter={(value) =>
          value === undefined || value === null || String(value).trim() === ""
            ? ""
            : Number(value).toLocaleString("en-US")
        }
        parser={(value) => Number(value?.replace(/,/g, "") ?? 0)}
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

function PrivatePaxPricingSection({
  color,
  background,
}: {
  color: string;
  background: string;
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
        Private Tour pricing · per person
      </Tag>
      <Form.List name="privatePaxPrices">
        {(fields, { add, remove }) => (
          <Flex vertical gap={8}>
            {fields.map((field, index) => (
              <Row key={field.key} gutter={8} align="middle" wrap={false}>
                <Col flex="none" style={{ width: 110 }}>
                  <Tag color={PERSON_COLORS.adult} style={{ margin: 0 }}>
                    {index + 1} {index === 0 ? "person" : "people"}
                  </Tag>
                </Col>
                <Col flex="auto">
                  <Form.Item
                    name={[field.name, "pricePerPerson"]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber<number>
                      style={{ width: "100%" }}
                      min={0}
                      placeholder="Price per person (VND)"
                      formatter={(v) =>
                        v == null ? "" : `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      parser={(v) => Number((v ?? "").replace(/,/g, ""))}
                      addonAfter="₫ / person"
                    />
                  </Form.Item>
                </Col>
                <Col flex="none">
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    disabled={fields.length <= 1}
                    onClick={() => remove(field.name)}
                  />
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => add({ pricePerPerson: 0 })}
              style={{ alignSelf: "flex-start" }}
            >
              Add person
            </Button>
          </Flex>
        )}
      </Form.List>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Add one row for each group size. The customer pays the row matching their
        total pax.
      </Typography.Text>
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

function cancellationParts(tour: Tour): {
  value: number | null;
  unit: "HOUR" | "DAY";
} {
  const unit =
    tour.freeCancellationUnit ??
    (tour.freeCancellationHours != null && tour.freeCancellationHours % 24 === 0
      ? "DAY"
      : "HOUR");
  const value =
    tour.freeCancellationValue ??
    (tour.freeCancellationHours != null
      ? unit === "DAY"
        ? tour.freeCancellationHours / 24
        : tour.freeCancellationHours
      : null);
  return { value, unit };
}

function FreeCancellationCell({
  tour,
  canUpdate,
  onSaved,
}: {
  tour: Tour;
  canUpdate: boolean;
  onSaved: () => void;
}) {
  const initial = cancellationParts(tour);
  const [value, setValue] = useState<number | null>(initial.value);
  const [unit, setUnit] = useState<"HOUR" | "DAY">(initial.unit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initial.value);
    setUnit(initial.unit);
  }, [initial.value, initial.unit]);

  const save = async (nextValue: number | null, nextUnit: "HOUR" | "DAY") => {
    if (!canUpdate || nextValue == null || nextValue < 0) return;
    if (nextValue === initial.value && nextUnit === initial.unit) return;
    setSaving(true);
    try {
      await api.put(`/tours/${tour.id}`, {
        freeCancellationValue: nextValue,
        freeCancellationUnit: nextUnit,
      });
      message.success("Free cancellation updated");
      onSaved();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to update free cancellation"));
    } finally {
      setSaving(false);
    }
  };

  if (!canUpdate) {
    return initial.value == null ? (
      <Typography.Text type="secondary">—</Typography.Text>
    ) : (
      <Tag>{`Up to ${initial.value} ${initial.unit === "DAY" ? "day(s)" : "hour(s)"}`}</Tag>
    );
  }

  return (
    <Flex gap={4} align="center">
      <InputNumber
        size="small"
        min={0}
        value={value}
        disabled={saving}
        style={{ width: 72 }}
        onChange={(v) => setValue(typeof v === "number" ? v : null)}
        onBlur={() => save(value, unit)}
        onPressEnter={() => save(value, unit)}
      />
      <Select
        size="small"
        value={unit}
        disabled={saving}
        style={{ width: 100 }}
        options={[
          { value: "HOUR", label: "hour(s)" },
          { value: "DAY", label: "day(s)" },
        ]}
        onChange={(nextUnit: "HOUR" | "DAY") => {
          setUnit(nextUnit);
          void save(value, nextUnit);
        }}
      />
    </Flex>
  );
}

function promotionTags(r: Tour) {
  const tags: React.ReactNode[] = [];
  const stP = promotionState(r.privateDiscountPercent, r.promotionStartsAt, r.promotionEndsAt);
  const stG = promotionState(r.groupDiscountPercent, r.promotionStartsAt, r.promotionEndsAt);
  if (stP)
    tags.push(
      <Tag
        key="private"
        color={stP.color}
        style={{ margin: 0, fontSize: 11, lineHeight: "18px" }}
      >
        Private {stP.label}
      </Tag>,
    );
  if (stG)
    tags.push(
      <Tag
        key="group"
        color={stG.color}
        style={{ margin: 0, fontSize: 11, lineHeight: "18px" }}
      >
        Group {stG.label}
      </Tag>,
    );
  return tags.length > 0 ? (
    <Flex vertical gap={2} align="flex-start">
      {tags}
    </Flex>
  ) : null;
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [categories, setCategories] = useState<AdminTourCategory[]>([]);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const loadCategories = async () => {
    try {
      const r = await api.get("/tour-categories/admin");
      setCategories(r.data ?? []);
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to load categories"));
    }
  };

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

  useEffect(() => {
    if (canCreate || canUpdate) loadCategories();
  }, [canCreate, canUpdate]);

  const openModal = (tour?: Tour) => {
    setEditing(tour ?? null);
    const prices = (tour?.typePrices ?? []).reduce<Record<string, any>>((acc, p) => {
      acc[p.type] = p;
      return acc;
    }, {});
    const pvt = prices["PRIVATE_TOUR"];
    const grp = prices["GROUP_TOUR"];
    const privatePaxValues =
      tour?.privatePaxPrices && tour.privatePaxPrices.length > 0
        ? [...tour.privatePaxPrices]
            .sort((a, b) => a.pax - b.pax)
            .map((row) => ({ pricePerPerson: Number(row.pricePerPerson ?? 0) }))
        : [{ pricePerPerson: Number(pvt?.adultPrice ?? 0) }];
    form.setFieldsValue({
      name: tour?.name ?? "",
      requiresGuide: tour?.requiresGuide ?? true,
      thumbnailUrl: tour?.thumbnailUrl ?? null,
      durationDays: tour?.durationDays ?? 1,
      durationValue: tour?.durationValue ?? tour?.durationDays ?? 1,
      durationUnit: tour?.durationUnit ?? "DAY",
      freeCancellationValue: tour
        ? cancellationParts(tour).value
        : 24,
      freeCancellationUnit: tour
        ? cancellationParts(tour).unit
        : "HOUR",
      cancellationPolicy: tour?.cancellationPolicy ?? "",
      departureTimes: tour?.departureTimes ?? [],
      departureLocation: tour?.departureLocation ?? "",
      categoryIds: (tour?.categories ?? []).map((link) => link.categoryId),
      primaryCategoryId:
        tour?.categories?.find((link) => link.isPrimary)?.categoryId ?? undefined,
      privatePaxPrices: privatePaxValues,
      groupPricesAdult: grp?.adultPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.adultPrice : 0) ?? 0,
      groupPricesChild: grp?.childPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.childPrice : 0) ?? 0,
      groupPricesInfant: grp?.infantPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.infantPrice : 0) ?? 0,
      currency: "VND",
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
    const privatePaxPrices = ((values.privatePaxPrices ?? []) as {
      pricePerPerson?: number;
    }[]).map((row, index) => ({
      pax: index + 1,
      pricePerPerson: Number(row?.pricePerPerson ?? 0),
    }));
    const typePrices = [
      {
        type: "PRIVATE_TOUR",
        adultPrice: privatePaxPrices[0]?.pricePerPerson ?? 0,
        childPrice: 0,
        infantPrice: 0,
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
      requiresGuide: values.requiresGuide ?? true,
      thumbnailUrl: values.thumbnailUrl,
      durationDays,
      durationValue,
      durationUnit,
      privatePaxPrices,
      freeCancellationValue: values.freeCancellationValue ?? 0,
      freeCancellationUnit: values.freeCancellationUnit ?? "HOUR",
      cancellationPolicy: values.cancellationPolicy,
      departureTimes: values.departureTimes,
      departureLocation: values.departureLocation,
      currency: "VND",
      privateDiscountPercent: values.privateDiscountPercent,
      groupDiscountPercent: values.groupDiscountPercent,
      promotionStartsAt: window ? window[0].toISOString() : null,
      promotionEndsAt: window ? window[1].toISOString() : null,
      categoryIds: values.categoryIds ?? [],
      primaryCategoryId: (values.categoryIds ?? []).includes(
        values.primaryCategoryId,
      )
        ? values.primaryCategoryId
        : undefined,
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

  const deleteSelected = async () => {
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        selectedRowKeys.map((id) => api.delete(`/tours/${id}`)),
      );
      const deleted = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - deleted;
      if (failed > 0) {
        message.error(`Deleted ${deleted} of ${results.length} tours`);
      } else {
        message.success(
          `Deleted ${deleted} ${deleted === 1 ? "tour" : "tours"}`,
        );
      }
      setSelectedRowKeys([]);
      load();
    } finally {
      setBulkDeleting(false);
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
      onFilter: (v: any, r: Tour) => {
        const offered = (r.typePrices ?? []).filter(hasTypePrice);
        return offered.length
          ? offered.some((price) => price.type === v)
          : r.type === v;
      },
      render: (_: Tour["type"], r: Tour) => {
        const offered = (r.typePrices ?? []).filter(hasTypePrice);
        const types = offered.length
          ? offered.map((price) => price.type)
          : [r.type];
        return (
          <Flex vertical gap={2} align="flex-start">
            {types.map((type) => (
              <Tag
                key={type}
                color={type === "PRIVATE_TOUR" ? "purple" : "cyan"}
                style={{ margin: 0, fontSize: 11, lineHeight: "18px" }}
              >
                {type === "PRIVATE_TOUR" ? "Private" : "Group"}
              </Tag>
            ))}
          </Flex>
        );
      },
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
      title: "Free cancellation",
      key: "freeCancellation",
      render: (_: any, r: Tour) => (
        <FreeCancellationCell tour={r} canUpdate={canUpdate} onSaved={load} />
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
                  setSelectedRowKeys((keys) => keys.filter((k) => k !== r.id));
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
            {canDelete && selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`Delete ${selectedRowKeys.length} selected ${
                  selectedRowKeys.length === 1 ? "tour" : "tours"
                }?`}
                onConfirm={deleteSelected}
              >
                <Button danger icon={<DeleteOutlined />} loading={bulkDeleting}>
                  Delete selected ({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
            {canUpdate && (
              <Button
                icon={<TagsOutlined />}
                onClick={() => setCategoryManagerOpen(true)}
              >
                Categories
              </Button>
            )}
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
          rowSelection={
            canDelete
              ? {
                  selectedRowKeys,
                  onChange: (keys) => setSelectedRowKeys(keys.map(String)),
                  preserveSelectedRowKeys: true,
                }
              : undefined
          }
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
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="freeCancellationValue"
                label="Free cancellation"
                initialValue={24}
              >
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="freeCancellationUnit"
                label="Free cancellation unit"
                initialValue="HOUR"
              >
                <Select
                  options={[
                    { value: "HOUR", label: "Hour(s)" },
                    { value: "DAY", label: "Day(s)" },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="requiresGuide"
            label="Crew requirement"
            valuePropName="checked"
            extra="Driver only skips the guide and sends the driver's money straight to Accounting."
          >
            <Switch
              checkedChildren="Guide + driver"
              unCheckedChildren="Driver only"
            />
          </Form.Item>
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
          <Form.Item
            name="categoryIds"
            label="Categories"
            extra="Used by the homepage and /tours filters"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Select categories"
              options={categories.map((category) => ({
                value: category.id,
                label: category.isActive
                  ? category.name
                  : `${category.name} (hidden)`,
              }))}
            />
          </Form.Item>
          <Form.Item name="primaryCategoryId" label="Primary category">
            <Select
              allowClear
              placeholder="Defaults to the first selected"
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </Form.Item>
          <Button
            type="link"
            icon={<TagsOutlined />}
            style={{ paddingLeft: 0, marginBottom: 12 }}
            onClick={() => setCategoryManagerOpen(true)}
          >
            Manage categories
          </Button>
          <Typography.Text
            type="secondary"
            style={{ display: "block", margin: "4px 0 8px" }}
          >
            All prices are in VND.
          </Typography.Text>
          <Flex vertical gap={12} style={{ marginTop: 8 }}>
            <PrivatePaxPricingSection
              color={PRIVATE_COLOR}
              background="rgba(114, 46, 209, 0.06)"
            />
            <PricingSection
              title="Group Tour pricing"
              color={GROUP_COLOR}
              background="rgba(8, 151, 156, 0.06)"
              prefix="groupPrices"
            />
          </Flex>
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
      <TourCategoryManager
        open={categoryManagerOpen}
        onClose={() => setCategoryManagerOpen(false)}
        onChanged={loadCategories}
      />
    </div>
  );
}
