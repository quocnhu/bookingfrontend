"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Typography,
  message,
} from "antd";
import { EditOutlined, PlusOutlined, DeleteOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { centerColumns, indexColumn, PAGE_SIZE_OPTIONS, paginationChange } from "@/lib/table";
import { useFillHeight } from "@/lib/use-fill-height";
import FilterBar from "@/components/filter-bar";

export default function CoordinatePage() {
  const { hasPermission } = useApp();
  const canCreate = hasPermission("coordinate.create");
  const canUpdate = hasPermission("coordinate.update");
  const canDelete = hasPermission("coordinate.delete");

  const [coordinates, setCoordinates] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const tableHeight = useFillHeight({
    rootSelector: ".coordinate-page",
    activeTab: "",
    deps: [coordinates.length],
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    setLoading(true);
    const params: Record<string, any> = { page, limit: pageSize };
    if (search.trim()) params.q = search.trim();
    api
      .get("/coordinates", { params })
      .then((r) => {
        setCoordinates(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      })
      .catch((e) => message.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [page, pageSize, search]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue({
      hotelName: record.hotelName,
      starRating: record.starRating,
      address: record.address,
      coordinate: record.coordinate,
      latitude: record.latitude,
      longitude: record.longitude,
    });
    setDrawerOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/coordinates/${editing.id}`, values);
        message.success("Coordinate updated");
      } else {
        await api.post("/coordinates", values);
        message.success("Coordinate created");
      }
      setDrawerOpen(false);
      loadData();
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save coordinate"));
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      await api.delete(`/coordinates/${id}`);
      message.success("Coordinate deleted");
      loadData();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const columns = centerColumns([
    indexColumn(page, pageSize),
    {
      title: "Hotel Name",
      dataIndex: "hotelName",
      key: "hotelName",
      ellipsis: true,
      filters: Array.from(new Set(coordinates.map((c: any) => c.hotelName).filter(Boolean))).sort().map((h: any) => ({ text: h, value: h })),
      onFilter: (v: any, r: any) => (r.hotelName ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Address",
      dataIndex: "address",
      key: "address",
      ellipsis: true,
      filters: Array.from(new Set(coordinates.map((c: any) => c.address).filter(Boolean))).sort().map((a: any) => ({ text: a, value: a })),
      onFilter: (v: any, r: any) => (r.address ?? "").toLowerCase().includes(String(v).toLowerCase()),
    },
    {
      title: "Star",
      dataIndex: "starRating",
      key: "starRating",
      width: 60,
      align: "center" as const,
      filters: Array.from(new Set(coordinates.map((c: any) => c.starRating).filter((s: any) => s != null))).sort((a: any, b: any) => a - b).map((s: any) => ({ text: `${s}★`, value: s })),
      onFilter: (v: any, r: any) => r.starRating === v,
    },
    {
      title: "Latitude",
      dataIndex: "latitude",
      key: "latitude",
      width: 100,
      render: (v: number) => (v != null ? Number(v).toFixed(5) : "—"),
    },
    {
      title: "Longitude",
      dataIndex: "longitude",
      key: "longitude",
      width: 100,
      render: (v: number) => (v != null ? Number(v).toFixed(5) : "—"),
    },
    {
      title: "Map",
      key: "map",
      width: 60,
      render: (_: any, r: any) =>
        r.latitude != null && r.longitude != null ? (
          <a
            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <EnvironmentOutlined style={{ fontSize: 16 }} />
          </a>
        ) : (
          "—"
        ),
    },
    ...(canUpdate || canDelete
      ? [
          {
            title: "Actions",
            key: "actions",
            width: 120,
            render: (_: any, r: any) => (
              <Flex gap={8}>
                {canUpdate && (
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>
                    Edit
                  </Button>
                )}
                {canDelete && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteRecord(r.id)}>
                    Delete
                  </Button>
                )}
              </Flex>
            ),
          },
        ]
      : []),
  ]);

  return (
    <div className="coordinate-page">
      <Card
        variant="borderless"
        title="Coordinates"
        extra={
          <Flex gap={8}>
            <FilterBar
              onSearch={(v) => {
                setSearch(v);
                setPage(1);
              }}
              onReset={() => {
                setSearch("");
                setPage(1);
              }}
              searchPlaceholder="Search hotel or address..."
            />
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add Coordinate
              </Button>
            )}
          </Flex>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={coordinates}
          loading={loading}
          scroll={{ x: 800, y: tableHeight }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            onChange: paginationChange(setPage, setPageSize, pageSize),
          }}
        />
      </Card>

      <Drawer
        title={editing ? "Edit Coordinate" : "Add Coordinate"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="hotelName" label="Hotel Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="starRating" label="Star Rating">
            <Select
              allowClear
              options={[
                { value: "1", label: "1 Star" },
                { value: "2", label: "2 Stars" },
                { value: "3", label: "3 Stars" },
                { value: "4", label: "4 Stars" },
                { value: "5", label: "5 Stars" },
              ]}
            />
          </Form.Item>
          <Form.Item name="address" label="Address" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="coordinate" label="Coordinate (optional)">
            <Input placeholder="e.g. 21.0285,105.8542" />
          </Form.Item>
          <Flex gap={16}>
            <Form.Item name="latitude" label="Latitude" rules={[{ required: true }]}>
              <InputNumber style={{ width: "100%" }} step={0.00001} />
            </Form.Item>
            <Form.Item name="longitude" label="Longitude" rules={[{ required: true }]}>
              <InputNumber style={{ width: "100%" }} step={0.00001} />
            </Form.Item>
          </Flex>
          <Button type="primary" block loading={saving} onClick={save}>
            {editing ? "Update" : "Create"}
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}
