"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
  Flex,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import FilterBar from "@/components/filter-bar";
import ThumbnailPicker from "@/components/thumbnail-picker";

interface Tour {
  id: string;
  code?: string;
  name: string;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  _count?: { bookings: number };
}

const TYPE_OPTIONS = [
  { value: "PRIVATE_TOUR", label: "Private Tour", color: "purple" },
  { value: "GROUP_TOUR", label: "Group Tour", color: "cyan" },
];

const LIMIT = 10;

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
      adultPrice: tour?.adultPrice ?? 0,
      childPrice: tour?.childPrice ?? 0,
      infantPrice: tour?.infantPrice ?? 0,
      currency: tour?.currency ?? "USD",
    });
    setModalOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/tours/${editing.id}`, values);
        message.success("Tour updated");
      } else {
        await api.post("/tours", values);
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
      title: "Actions",
      key: "actions",
      render: (_: any, r: Tour) => (
        <span style={{ display: "inline-flex", gap: 8 }}>
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
      <Tabs
        items={[
          {
            key: "manage",
            label: "Manage Tours",
            children: (
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
            ),
          },
          {
            key: "available",
            label: "Available Tours",
            children: (
              <Card
                variant="borderless"
                title="Available tours"
                extra={tourFilterBar}
              >
                {loading && tours.length === 0 ? (
                  <Flex justify="center" style={{ padding: 80 }}>
                    <Spin size="large" />
                  </Flex>
                ) : tours.length === 0 ? (
                  <Empty description="No tours yet" />
                ) : (
                  <>
                    <Row gutter={[16, 16]}>
                      {tours.map((tour) => (
                        <Col xs={24} sm={12} lg={8} xl={6} key={tour.id}>
                          <Card
                            hoverable
                            variant="borderless"
                            title={tour.name}
                            extra={
                              <Tag
                                color={
                                  TYPE_OPTIONS.find((t) => t.value === tour.type)?.color ?? "blue"
                                }
                              >
                                {tour.type}
                              </Tag>
                            }
                            onClick={() => router.push(`/tours/${tour.id}`)}
                            style={{ height: "100%" }}
                          >
                            <Typography.Paragraph style={{ marginBottom: 8 }}>
                              <strong>Adult:</strong> {Number(tour.adultPrice ?? 0).toLocaleString()}{" "}
                              {tour.currency}
                              <br />
                              <strong>Child:</strong> {Number(tour.childPrice ?? 0).toLocaleString()}{" "}
                              {tour.currency}
                              <br />
                              <strong>Infant:</strong> {Number(tour.infantPrice ?? 0).toLocaleString()}{" "}
                              {tour.currency}
                            </Typography.Paragraph>
                            <Typography.Text type="secondary">
                              {tour._count?.bookings ?? 0} bookings
                            </Typography.Text>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                    {data && data.total > pageSize && (
                      <Flex justify="center" style={{ marginTop: 24 }}>
                        <Pagination
                          current={page}
                          pageSize={pageSize}
                          total={data.total}
                          showSizeChanger
                          pageSizeOptions={PAGE_SIZE_OPTIONS}
                          onChange={(p, size) => paginationChange(setPage, setPageSize, pageSize)(p, size)}
                        />
                      </Flex>
                    )}
                  </>
                )}
              </Card>
            ),
          },
        ]}
      />

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
        </Form>
      </Modal>
    </div>
  );
}
