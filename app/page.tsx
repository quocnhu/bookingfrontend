"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Empty, Flex, Row, Spin, Tag, Typography, message } from "antd";
import {
  CompassOutlined,
  LoginOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";

interface HomepageTour {
  id: string;
  code: string;
  name: string;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  _count?: { bookings: number };
}

const TYPE_COLOR: Record<string, string> = {
  PRIVATE_TOUR: "purple",
  GROUP_TOUR: "cyan",
};

const usd = (value: string | number | null | undefined) =>
  `$${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function HomePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useApp();
  const [tours, setTours] = useState<HomepageTour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/tours", { params: { limit: 100 } })
      .then((r) => setTours(r.data?.items ?? []))
      .catch((e) => message.error(getErrorMessage(e, "Failed to load tours")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Flex
        justify="space-between"
        align="center"
        style={{ padding: "16px 24px", borderBottom: "1px solid var(--ant-color-border-secondary)" }}
      >
        <Flex align="center" gap={10}>
          <span
            style={{
              display: "inline-flex",
              width: 38,
              height: 38,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: "#062A30",
              background: "linear-gradient(135deg, #22D3EE, #3B82F6)",
            }}
          >
            <CompassOutlined />
          </span>
          <Typography.Title level={4} style={{ margin: 0, background: "linear-gradient(90deg, #22D3EE, #3B82F6)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            Vietnam Tours
          </Typography.Title>
        </Flex>
        <Flex gap={8}>
          {authLoading ? null : user ? (
            <Button type="primary" icon={<DashboardOutlined />} onClick={() => router.push("/dashboard")}>
              Dashboard
            </Button>
          ) : (
            <Button icon={<LoginOutlined />} onClick={() => router.push("/login")}>
              Sign in
            </Button>
          )}
        </Flex>
      </Flex>

      <Flex
        vertical
        align="center"
        style={{ textAlign: "center", padding: "56px 24px 40px" }}
      >
        <Typography.Title style={{ fontSize: 40, marginBottom: 8 }}>
          Explore Vietnam's Best Tours
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 16, maxWidth: 640 }}>
          From the misty karsts of Ha Long Bay to the lantern-lit streets of Hoi An — handpicked
          day trips and private experiences across Vietnam.
        </Typography.Text>
      </Flex>

      <Flex
        flex="1"
        justify="center"
        style={{ padding: "0 24px 56px", width: "100%", maxWidth: 1280, margin: "0 auto" }}
      >
        {loading ? (
          <Flex justify="center" style={{ padding: 80 }}>
            <Spin size="large" />
          </Flex>
        ) : tours.length === 0 ? (
          <Empty description="No tours available right now." />
        ) : (
          <Row gutter={[16, 16]}>
            {tours.map((tour) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={tour.id}>
                <Card
                  hoverable
                  variant="borderless"
                  style={{ height: "100%", overflow: "hidden" }}
                  styles={{ body: { display: "flex", flexDirection: "column", gap: 8 } }}
                  cover={
                    tour.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tour.thumbnailUrl}
                        alt={tour.name}
                        style={{ height: 180, width: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : undefined
                  }
                  onClick={() => router.push(`/tour/${tour.id}`)}
                >
                  <Flex justify="space-between" align="center" wrap gap={8}>
                    <Tag color={TYPE_COLOR[tour.type] ?? "blue"}>{tour.type.replace("_", " ")}</Tag>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {tour.code}
                    </Typography.Text>
                  </Flex>
                  <Typography.Title level={5} style={{ margin: 0 }}>
                    {tour.name}
                  </Typography.Title>
                  <Typography.Title
                    level={4}
                    style={{ margin: "4px 0 0", color: "var(--ant-color-primary)" }}
                  >
                    From {usd(tour.adultPrice)}
                    <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                      {" "}
                      / person
                    </Typography.Text>
                  </Typography.Title>
                  <Flex gap={12} align="center" style={{ marginTop: "auto", paddingTop: 8 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      <ClockCircleOutlined /> Half / Full day
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      <TeamOutlined /> {tour._count?.bookings ?? 0} bookings
                    </Typography.Text>
                  </Flex>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Flex>

      <Flex
        justify="center"
        style={{ padding: 24, borderTop: "1px solid var(--ant-color-border-secondary)" }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          © {new Date().getFullYear()} Vietnam Tours
        </Typography.Text>
      </Flex>
    </div>
  );
}
