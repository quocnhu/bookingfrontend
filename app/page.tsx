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
  CalendarOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import PromoCountdown from "@/components/promo-countdown";
import { discountedPrice, isPromoActive } from "@/lib/promo";

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
  discountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
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
            {tours.map((tour) => {
              const promo = isPromoActive(tour);
              const price = usd(tour.adultPrice);
              const discounted = usd(discountedPrice(tour.adultPrice, tour.discountPercent));
              return (
                <Col
                  xs={24}
                  sm={12}
                  lg={8}
                  xl={6}
                  key={tour.id}
                  style={{ display: "flex" }}
                >
                  <Card
                    hoverable
                    variant="borderless"
                    style={{
                      width: "100%",
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                      borderRadius: 16,
                      border: promo
                        ? "1px solid rgba(220,38,38,0.35)"
                        : "1px solid var(--ant-color-border-secondary)",
                      boxShadow: promo ? "0 8px 24px rgba(220,38,38,0.10)" : undefined,
                      transition: "all 0.25s ease",
                    }}
                    styles={{
                      body: {
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      },
                    }}
                    cover={
                      <div style={{ position: "relative" }}>
                        {tour.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={tour.thumbnailUrl}
                            alt={tour.name}
                            style={{ height: 180, width: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          <div
                            style={{
                              height: 180,
                              width: "100%",
                              background:
                                "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(59,130,246,0.15))",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CompassOutlined style={{ fontSize: 40, color: "#94a3b8" }} />
                          </div>
                        )}
                        {promo && (
                          <div
                            style={{
                              position: "absolute",
                              top: 10,
                              right: 10,
                              zIndex: 2,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 54,
                                height: 54,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                                color: "#fff",
                                boxShadow: "0 4px 14px rgba(220,38,38,0.45)",
                                border: "2px solid #fff",
                              }}
                            >
                              <span style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>
                                -{tour.discountPercent}%
                              </span>
                              <span style={{ fontSize: 9, letterSpacing: 0.5, opacity: 0.9 }}>
                                OFF
                              </span>
                            </div>
                          </div>
                        )}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            height: 70,
                            background: "linear-gradient(180deg, rgba(0,0,0,0.28), transparent)",
                          }}
                        />
                      </div>
                    }
                    onClick={() => router.push(`/tour/${tour.id}`)}
                  >
                    <Flex justify="space-between" align="center" wrap gap={8}>
                      <Tag
                        color={TYPE_COLOR[tour.type] ?? "blue"}
                        style={{ borderRadius: 999, fontWeight: 600 }}
                      >
                        {tour.type.replace("_", " ")}
                      </Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {tour.code}
                      </Typography.Text>
                    </Flex>
                    <Typography.Title level={5} style={{ margin: 0, lineHeight: 1.35 }}>
                      {tour.name}
                    </Typography.Title>

                    {promo ? (
                      <Flex align="baseline" wrap gap={6} style={{ marginTop: 2 }}>
                        <Typography.Title
                          level={4}
                          style={{ margin: 0, color: "#dc2626", fontWeight: 800 }}
                        >
                          {discounted}
                        </Typography.Title>
                        <Typography.Text
                          type="secondary"
                          delete
                          style={{ fontSize: 13, fontWeight: 500 }}
                        >
                          {price}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          / person
                        </Typography.Text>
                      </Flex>
                    ) : (
                      <Typography.Title
                        level={4}
                        style={{ margin: "4px 0 0", color: "var(--ant-color-primary)" }}
                      >
                        From {price}
                        <Typography.Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
                          {" "}
                          / person
                        </Typography.Text>
                      </Typography.Title>
                    )}

                    <PromoCountdown tour={tour} />

                    <Flex gap={12} align="center" style={{ marginTop: "auto", paddingTop: 8 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> Half / Full day
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        <TeamOutlined /> {tour._count?.bookings ?? 0} bookings
                      </Typography.Text>
                    </Flex>
                    <Button
                      type="primary"
                      shape="round"
                      block
                      icon={<CalendarOutlined />}
                      style={{
                        marginTop: 4,
                        fontWeight: 600,
                        background: promo
                          ? "linear-gradient(135deg, #ef4444, #dc2626)"
                          : undefined,
                        borderColor: promo ? "#dc2626" : undefined,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/tour/${tour.id}`);
                      }}
                    >
                      Book now
                    </Button>
                  </Card>
                </Col>
              );
            })}
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
