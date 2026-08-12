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
import FilterBar from "@/components/filter-bar";
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
  gallery?: GalleryImage[];
  _count?: { bookings: number };
}

const TYPE_OPTIONS = [
  { value: "PRIVATE_TOUR", label: "Private Tour", color: "purple" },
  { value: "GROUP_TOUR", label: "Group Tour", color: "cyan" },
];

const LIMIT = 10;

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

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
      if (search) params.q = search;
      if (typeFilter) params.type = typeFilter;
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
  }, [page, pageSize, search, typeFilter]);

  const resetFilters = () => {
    setSearch("");
    setTypeFilter(undefined);
    setPage(1);
  };

  const openModal = (tour?: Tour) => {
    setEditing(tour ?? null);
    form.setFieldsValue({
      name: tour?.name ?? "",
      type: tour?.type ?? "PRIVATE_TOUR",
      thumbnailUrl: tour?.thumbnailUrl ?? null,
      durationDays: tour?.durationDays ?? 1,
      departureLocation: tour?.departureLocation ?? "",
      adultPrice: tour?.adultPrice ?? 0,
      childPrice: tour?.childPrice ?? 0,
      infantPrice: tour?.infantPrice ?? 0,
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
    const payload: any = { ...values };
    const window = values.promotionWindow as [Dayjs, Dayjs] | null | undefined;
    payload.promotionStartsAt = window ? window[0].toISOString() : null;
    payload.promotionEndsAt = window ? window[1].toISOString() : null;
    delete payload.promotionWindow;
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
    { title: "Code", dataIndex: "code", key: "code" },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      render: (v: string) => {
        const opt = TYPE_OPTIONS.find((t) => t.value === v);
        return <Tag color={opt?.color}>{opt?.label ?? v}</Tag>;
      },
    },
    {
      title: "Adult",
      dataIndex: "adultPrice",
      key: "adultPrice",
      render: (v: any, r: Tour) => `${Number(v ?? 0).toLocaleString()} ${r.currency}`,
    },
    {
      title: "Child",
      dataIndex: "childPrice",
      key: "childPrice",
      render: (v: any, r: Tour) => `${Number(v ?? 0).toLocaleString()} ${r.currency}`,
    },
    {
      title: "Infant",
      dataIndex: "infantPrice",
      key: "infantPrice",
      render: (v: any, r: Tour) => `${Number(v ?? 0).toLocaleString()} ${r.currency}`,
    },
    {
      title: "Bookings",
      dataIndex: "_count",
      key: "bookings",
      render: (v: any) => <Tag color="blue">{v?.bookings ?? 0}</Tag>,
    },
    {
      title: "Promotion",
      key: "promotion",
      render: (_: any, r: Tour) => {
        const st = promotionState(r.discountPercent, r.promotionStartsAt, r.promotionEndsAt);
        if (!st) return <Typography.Text type="secondary">—</Typography.Text>;
        return <Tag color={st.color}>{st.label}</Tag>;
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

  const tourFilterBar = (
    <FilterBar
      onSearch={(v) => {
        setSearch(v.trim());
        setPage(1);
      }}
      onReset={resetFilters}
      searchPlaceholder="Search name or code..."
    >
      <Select
        allowClear
        size="small"
        placeholder="Type"
        style={{ width: 140 }}
        value={typeFilter}
        onChange={(v) => {
          setTypeFilter(v);
          setPage(1);
        }}
        options={TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))}
      />
    </FilterBar>
  );

  return (
    <div>
      <Card
        variant="borderless"
        title="Declared tours"
        extra={
          <Flex wrap gap={8} align="center">
            {tourFilterBar}
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>
                Add Tour
              </Button>
            )}
          </Flex>
        }
      >
        <Table
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
          <Form.Item name="type" label="Type" initialValue="PRIVATE_TOUR">
            <Select options={TYPE_OPTIONS.map(({ value, label }) => ({ value, label }))} />
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
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="adultPrice" label="Adult price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="childPrice" label="Child price" initialValue={0}>
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="infantPrice" label="Infant price" initialValue={0}>
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
