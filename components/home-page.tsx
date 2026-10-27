"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Empty, Flex, Row, Tag, Typography } from "antd";
import {
  CompassOutlined,
  LoginOutlined,
  DashboardOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useApp, getDefaultRoute } from "@/lib/app-context";
import PromoCountdown from "@/components/promo-countdown";
import { discountedPrice, discountFor, isTypePromoActive } from "@/lib/promo";
import {
  formatDepartureTime,
  formatFreeCancellation,
  formatTourDuration,
} from "@/lib/tour-display";

interface HomepageTour {
  id: string;
  code: string;
  name: string;
  slug?: string | null;
  type: "PRIVATE_TOUR" | "GROUP_TOUR";
  thumbnailUrl?: string | null;
  adultPrice?: string | number | null;
  childPrice?: string | number | null;
  infantPrice?: string | number | null;
  currency?: string;
  durationDays?: number | null;
  durationValue?: number | null;
  durationUnit?: "HOUR" | "DAY" | null;
  freeCancellationHours?: number | null;
  departureTimes?: string[] | null;
  privateDiscountPercent?: number | null;
  groupDiscountPercent?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  typePrices?: {
    type: "PRIVATE_TOUR" | "GROUP_TOUR";
    adultPrice?: string | number | null;
  }[];
}

const TYPE_COLOR: Record<string, string> = {
  PRIVATE_TOUR: "purple",
  GROUP_TOUR: "cyan",
};

const vnd = (value: string | number | null | undefined) =>
  `${Number(value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ₫`;

/**
 * The home page.
 *
 * The tours are fetched on the SERVER (app/page.tsx) and handed over as a
 * prop: the HTML that Googlebot receives already lists every tour. Fetching
 * them in an effect would render an empty page for the crawler.
 */
export default function HomePage({
  tours: initialTours,
}: {
  tours: HomepageTour[];
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useApp();
  const tours = initialTours;

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
            Hana Tourist
          </Typography.Title>
        </Flex>
        <Flex gap={8}>
          {authLoading ? null : user ? (
            <Button type="primary" icon={<DashboardOutlined />} onClick={() => router.push(getDefaultRoute(user.role))}>
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
        style={{ textAlign: "center", padding: "clamp(24px, 6vw, 56px) 16px 32px" }}
      >
        <Typography.Title
          level={1}
          style={{ fontSize: "clamp(24px, 6vw, 40px)", marginBottom: 8 }}
        >
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
        {tours.length === 0 ? (
          <Empty description="No tours available right now." />
        ) : (
          <Row gutter={[16, 16]}>
            {tours.map((tour) => {
              const typePrices = tour.typePrices ?? [];
              const hasPrice = (type: string) =>
                Number(typePrices.find((p) => p.type === type)?.adultPrice ?? 0) > 0;
              const bothTypes = hasPrice("PRIVATE_TOUR") && hasPrice("GROUP_TOUR");
              const cheapest = typePrices
                .map((p) => ({ type: p.type, price: Number(p.adultPrice ?? 0) }))
                .filter((p) => p.price > 0)
                .sort((a, b) => a.price - b.price)[0];
              const fromPrice = cheapest ? cheapest.price : Number(tour.adultPrice ?? 0);
              const fromType = cheapest ? cheapest.type : tour.type;
              const pct = discountFor(tour, fromType);
              const promo = isTypePromoActive(tour, fromType);
              const price = vnd(Number.isFinite(fromPrice) && fromPrice > 0 ? fromPrice : tour.adultPrice);
              const discounted = vnd(discountedPrice(Number.isFinite(fromPrice) && fromPrice > 0 ? fromPrice : tour.adultPrice, pct));
              const typeLabel = bothTypes
                ? "Private · Group"
                : (tour.type ?? "").replace("_", " ");
              const typeColor = bothTypes ? "blue" : TYPE_COLOR[tour.type] ?? "blue";
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
                                -{pct}%
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
                    onClick={() => router.push(`/tour/${tour.slug || tour.id}`)}
                  >
                    <Flex justify="space-between" align="center" wrap gap={8}>
                      <Tag
                        color={typeColor}
                        style={{ borderRadius: 999, fontWeight: 600 }}
                      >
                        {typeLabel}
                      </Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {tour.code}
                      </Typography.Text>
                    </Flex>
                    <Typography.Title
                      level={2}
                      style={{
                        margin: 0,
                        lineHeight: 1.35,
                        minHeight: 44,
                        fontSize: 16,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      <Link
                        href={`/tour/${tour.slug || tour.id}`}
                        style={{ color: "inherit" }}
                      >
                        {tour.name}
                      </Link>
                    </Typography.Title>

                    <div style={{ minHeight: 34, display: "flex", alignItems: "center" }}>
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
                    </div>

                    <div
                      style={{
                        minHeight: promo ? 108 : 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ width: "100%" }}>
                        <PromoCountdown tour={tour} />
                      </div>
                    </div>

                    <Flex gap={12} wrap align="center" style={{ marginTop: "auto", paddingTop: 8 }}>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        <ClockCircleOutlined /> {formatTourDuration(tour)}
                      </Typography.Text>
                      {formatFreeCancellation(tour.freeCancellationHours) && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          <SafetyCertificateOutlined />{" "}
                          {formatFreeCancellation(tour.freeCancellationHours)}
                        </Typography.Text>
                      )}
                      {(tour.departureTimes ?? []).map((time) => (
                        <Tag
                          key={time}
                          color="geekblue"
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {formatDepartureTime(time)}
                        </Tag>
                      ))}
                    </Flex>
                    <Link
                      href={`/tour/${tour.slug || tour.id}`}
                      style={{ display: "block", marginTop: 4 }}
                    >
                      <Button
                        type="primary"
                        shape="round"
                        block
                        icon={<CalendarOutlined />}
                        style={{
                          fontWeight: 600,
                          background: promo
                            ? "linear-gradient(135deg, #ef4444, #dc2626)"
                            : undefined,
                          borderColor: promo ? "#dc2626" : undefined,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Book now
                      </Button>
                    </Link>
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
          © {new Date().getFullYear()} Hana Tourist
        </Typography.Text>
      </Flex>
    </div>
  );
}
