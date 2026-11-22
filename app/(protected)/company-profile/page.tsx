"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Row,
  Space,
  Typography,
  Upload,
} from "antd";
import { message } from "@/lib/antd-message";
import {
  BankOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  LoadingOutlined,
  MailOutlined,
  PhoneOutlined,
  PictureOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const { Text } = Typography;

export default function CompanyProfilePage() {
  const { hasPermission, refreshCompany } = useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const canUpdate = hasPermission("company.update");

  useEffect(() => {
    api
      .get("/company-profile")
      .then((r) => {
        const p = r.data ?? {};
        form.setFieldsValue({
          name: p.name ?? "",
          shortName: p.shortName ?? "",
          address: p.address ?? "",
          phone: p.phone ?? "",
          email: p.email ?? "",
          taxId: p.taxId ?? "",
          website: p.website ?? "",
          rootLatitude: p.rootLatitude ?? undefined,
          rootLongitude: p.rootLongitude ?? undefined,
        });
        setLogoUrl(p.logoUrl ?? null);
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load company profile")))
      .finally(() => setLoading(false));
  }, [form]);

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const data = new FormData();
      data.append("file", file);
      const res = await api.post("/company-profile/logo", data);
      setLogoUrl(res.data?.logoUrl ?? null);
      await refreshCompany();
      message.success("Company icon updated");
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to upload company icon"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const beforeLogoUpload = (file: File) => {
    if (file.type !== "image/png") {
      message.error("Only PNG files are allowed");
      return Upload.LIST_IGNORE;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error("The PNG icon must be 2 MB or smaller");
      return Upload.LIST_IGNORE;
    }
    void uploadLogo(file);
    return false;
  };

  const save = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await api.put("/company-profile", {
        ...values,
        rootLatitude:
          values.rootLatitude === undefined || values.rootLatitude === null
            ? null
            : values.rootLatitude,
        rootLongitude:
          values.rootLongitude === undefined || values.rootLongitude === null
            ? null
            : values.rootLongitude,
      });
      setDirty(false);
      await refreshCompany();
      message.success("Company profile saved");
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to save company profile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <Card
        variant="borderless"
        title={
          <Space>
            <BankOutlined />
            Company Profile
          </Space>
        }
        extra={
          <Text type="secondary" style={{ fontSize: 12 }}>
            Icon and short name appear in the sidebar
          </Text>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: "",
            shortName: "",
            address: "",
            phone: "",
            email: "",
            taxId: "",
            website: "",
          }}
          onValuesChange={() => setDirty(true)}
        >
          <Row gutter={16} align="middle">
            <Col xs={24} md={10}>
              <Form.Item label={<Space size={6}><PictureOutlined /><span>Company icon</span></Space>}>
                <Flex align="center" gap={14}>
                  <Flex
                    align="center"
                    justify="center"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 12,
                      border: "1px dashed #d9d9d9",
                      flexShrink: 0,
                    }}
                  >
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Company icon"
                        style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8 }}
                      />
                    ) : (
                      <PictureOutlined style={{ fontSize: 22, opacity: 0.45 }} />
                    )}
                  </Flex>
                  <Flex vertical gap={4}>
                    <Upload
                      accept="image/png"
                      showUploadList={false}
                      disabled={!canUpdate || uploadingLogo}
                      beforeUpload={beforeLogoUpload}
                    >
                      <Button
                        icon={uploadingLogo ? <LoadingOutlined /> : <UploadOutlined />}
                        loading={uploadingLogo}
                        disabled={!canUpdate}
                      >
                        Upload PNG
                      </Button>
                    </Upload>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      PNG only, up to 2 MB. Shown in the sidebar.
                    </Text>
                  </Flex>
                </Flex>
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item
                name="shortName"
                label="Short name"
                extra="Shown next to the icon in the sidebar."
                rules={[{ max: 60, message: "Short name must be 60 characters or less" }]}
              >
                <Input placeholder="e.g. Hana Tourist" maxLength={60} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                name="name"
                label="Company name"
                rules={[{ required: true, message: "Company name is required" }]}
              >
                <Input prefix={<BankOutlined />} placeholder="e.g. ABC Travel Co., Ltd." />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="taxId" label="Tax ID">
                <Input prefix={<SafetyCertificateOutlined />} placeholder="Tax identification number" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="address" label="Company address">
                <Input prefix={<EnvironmentOutlined />} placeholder="Street, city, country" />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="phone" label="Phone">
                <Input prefix={<PhoneOutlined />} placeholder="+84 ..." />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item name="email" label="Email">
                <Input prefix={<MailOutlined />} placeholder="contact@company.com" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="website" label="Website">
                <Input prefix={<GlobalOutlined />} placeholder="https://..." />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item
                label={
                  <Space size={6}>
                    <EnvironmentOutlined />
                    <span>
                      Root coordinate
                      <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                        {" "}
                        — distance / pickup sorting uses this as the origin
                      </Text>
                    </span>
                  </Space>
                }
              >
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="rootLatitude"
                      noStyle
                      rules={[{ type: "number", min: -90, max: 90, message: "Latitude must be between -90 and 90" }]}
                    >
                      <InputNumber
                        style={{ width: "100%" }}
                        placeholder="Latitude e.g. 16.068"
                        step={0.000001}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      name="rootLongitude"
                      noStyle
                      rules={[{ type: "number", min: -180, max: 180, message: "Longitude must be between -180 and 180" }]}
                    >
                      <InputNumber
                        style={{ width: "100%" }}
                        placeholder="Longitude e.g. 108.2297"
                        step={0.000001}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form.Item>
            </Col>
          </Row>
          <Flex justify="flex-end" gap={8}>
            {canUpdate ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                disabled={!dirty}
                onClick={save}
              >
                Save changes
              </Button>
            ) : (
              <Text type="secondary">Read-only — only admins can edit company info.</Text>
            )}
          </Flex>
        </Form>
      </Card>
    </div>
  );
}