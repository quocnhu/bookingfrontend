"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Col,
  DatePicker,
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
  message,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, PictureOutlined, ScheduleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
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
  departureLocation?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  discountPercent?: number | null;
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

const TYPE_PRICE_LABELS: Record<string, string> = {
  PRIVATE_TOUR: "Private Tour",
  GROUP_TOUR: "Group Tour",
};

const num = (v: any) => Number(v ?? 0) || 0;

const typePrice = (
  tour: Tour,
  type: "PRIVATE_TOUR" | "GROUP_TOUR",
  field: "adultPrice" | "childPrice" | "infantPrice",
) => {
  const tp = tour.typePrices?.find((x) => x.type === type);
  const fallback = type === "PRIVATE_TOUR" ? (tour[field] ?? 0) : 0;
  return num(tp?.[field] ?? fallback);
};

const LIMIT = 20;

function promotionState(
  discountPercent: number | null | undefined,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
): { label: string; color: string } | null {
  if (!discountPercent || discountPercent <= 0) return null;
  const now = Date.now();
  const start = startsAt ? new Date(startsAt).getTime() : null;
  const end = endsAt ? new Date(endsAt).getTime() : null;
  if (start && now < start) return { label: `-${discountPercent}% (upcoming)`, color: "orange" };
  if (end && now > end) return { label: `-${discountPercent}% (ended)`, color: "default" };
  return { label: `-${discountPercent}%`, color: "red" };
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
  const [modalOpen, setModalOpen] = useState(false);
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
      departureLocation: tour?.departureLocation ?? "",
      privatePricesAdult: pvt?.adultPrice ?? (tour?.type === "PRIVATE_TOUR" ? tour?.adultPrice : 0) ?? 0,
      privatePricesChild: pvt?.childPrice ?? (tour?.type === "PRIVATE_TOUR" ? tour?.childPrice : 0) ?? 0,
      privatePricesInfant: pvt?.infantPrice ?? (tour?.type === "PRIVATE_TOUR" ? tour?.infantPrice : 0) ?? 0,
      groupPricesAdult: grp?.adultPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.adultPrice : 0) ?? 0,
      groupPricesChild: grp?.childPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.childPrice : 0) ?? 0,
      groupPricesInfant: grp?.infantPrice ?? (tour?.type === "GROUP_TOUR" ? tour?.infantPrice : 0) ?? 0,
      currency: tour?.currency ?? "USD",
      discountPercent: tour?.discountPercent ?? 0,
      promotionWindow:
        tour?.promotionStartsAt && tour?.promotionEndsAt
          ? [dayjs(tour.promotionStartsAt), dayjs(tour.promotionEndsAt)]
          : null,
    });
    setModalOpen(true);
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
    const payload: any = {
      name: values.name,
      type: tourType,
      thumbnailUrl: values.thumbnailUrl,
      durationDays: values.durationDays,
      departureLocation: values.departureLocation,
      currency: values.currency,
      discountPercent: values.discountPercent,
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
      setModalOpen(false);
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
    { title: "Name", dataIndex: "name", key: "name", onFilter: (v: any, r: Tour) => (r.name ?? "").toLowerCase().includes(String(v).toLowerCase()) },
    {
      title: "Price (Private / Group)",
      key: "price",
      width: 230,
      render: (_: any, r: Tour) => (
        <Flex vertical gap={3}>
          <Flex justify="space-between" gap={8}>
            <Tag color="purple" style={{ margin: 0, fontSize: 11 }}>
              Private
            </Tag>
            <Typography.Text strong style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              A {typePrice(r, "PRIVATE_TOUR", "adultPrice").toLocaleString()} · C{" "}
              {typePrice(r, "PRIVATE_TOUR", "childPrice").toLocaleString()} · I{" "}
              {typePrice(r, "PRIVATE_TOUR", "infantPrice").toLocaleString()}{" "}
              {r.currency}
            </Typography.Text>
          </Flex>
          <Flex justify="space-between" gap={8}>
            <Tag color="cyan" style={{ margin: 0, fontSize: 11 }}>
              Group
            </Tag>
            <Typography.Text strong style={{ fontSize: 12, whiteSpace: "nowrap" }}>
              A {typePrice(r, "GROUP_TOUR", "adultPrice").toLocaleString()} · C{" "}
              {typePrice(r, "GROUP_TOUR", "childPrice").toLocaleString()} · I{" "}
              {typePrice(r, "GROUP_TOUR", "infantPrice").toLocaleString()}{" "}
              {r.currency}
            </Typography.Text>
          </Flex>
        </Flex>
      ),
    },
    {
      title: "Duration",
      dataIndex: "durationDays",
      key: "durationDays",
      filters: Array.from(new Set<number>((data?.items ?? []).map((t: Tour) => t.durationDays ?? 1))).sort((a, b) => a - b).map((d) => ({ text: d === 1 ? "1 Day" : `${d} Days`, value: d })),
      onFilter: (v: any, r: Tour) => (r.durationDays ?? 1) === v,
      render: (v: number | null) => (
        <Tag>{(v ?? 1) === 1 ? "1 Day" : `${v} Days`}</Tag>
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
        const st = promotionState(r.discountPercent, r.promotionStartsAt, r.promotionEndsAt);
        if (!st) return <Typography.Text type="secondary">—</Typography.Text>;
        return <Tag color={st.color}>{st.label}</Tag>;
      },
      filters: [
        { text: "Active", value: "active" },
        { text: "Scheduled", value: "scheduled" },
        { text: "Expired", value: "expired" },
      ],
      onFilter: (v: any, r: Tour) => {
        const st = promotionState(r.discountPercent, r.promotionStartsAt, r.promotionEndsAt);
        return st?.label.toLowerCase() === String(v).toLowerCase();
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
              onClick={() => router.push(`/tours/${r.id}`)}
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

      <Modal
        title={editing ? `Edit Tour: ${editing.name}` : "Add Tour"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        confirmLoading={saving}
        width={560}
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
            <Col span={12}>
              <Form.Item name="durationDays" label="Duration (days)" initialValue={1}>
                <InputNumber style={{ width: "100%" }} min={1} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="departureLocation" label="Pickup / meeting point">
                <Input placeholder="e.g. Central Station Plaza, Main Gate 3" />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text strong style={{ marginTop: 8, display: "block" }}>
            Private Tour pricing
          </Typography.Text>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="privatePricesAdult" label="Private adult price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="privatePricesChild" label="Private child price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="privatePricesInfant" label="Private infant price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text strong style={{ marginTop: 8, display: "block" }}>
            Group Tour pricing
          </Typography.Text>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="groupPricesAdult" label="Group adult price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="groupPricesChild" label="Group child price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="groupPricesInfant" label="Group infant price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="currency" label="Currency" initialValue="USD">
            <Select
              options={["VND", "USD", "EUR"].map((c) => ({ value: c, label: c }))}
              showSearch
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="discountPercent" label="Promotion discount (%)" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} max={100} addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="promotionWindow" label="Promotion window (start → end)">
                <DatePicker.RangePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Button
            danger
            block
            icon={<CloseCircleOutlined />}
            onClick={() =>
              form.setFieldsValue({ discountPercent: 0, promotionWindow: null })
            }
          >
            Reset discount & window
          </Button>
        </Form>
      </Modal>
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
