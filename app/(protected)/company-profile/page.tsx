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
  message,
} from "antd";
import {
  BankOutlined,
  EnvironmentOutlined,
  GlobalOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

const { Text } = Typography;

export default function CompanyProfilePage() {
  const { hasPermission } = useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const canUpdate = hasPermission("company.update");

  useEffect(() => {
    api
      .get("/company-profile")
      .then((r) => {
        const p = r.data ?? {};
        form.setFieldsValue({
          name: p.name ?? "",
          address: p.address ?? "",
          phone: p.phone ?? "",
          email: p.email ?? "",
          taxId: p.taxId ?? "",
          website: p.website ?? "",
          rootLatitude: p.rootLatitude ?? undefined,
          rootLongitude: p.rootLongitude ?? undefined,
        });
      })
      .catch((e) => message.error(getErrorMessage(e, "Failed to load company profile")))
      .finally(() => setLoading(false));
  }, [form]);

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
            Used on the print-ready tour voucher for accounting (year-end stamping)
          </Text>
        }
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            name: "",
            address: "",
            phone: "",
            email: "",
            taxId: "",
            website: "",
          }}
          onValuesChange={() => setDirty(true)}
        >
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