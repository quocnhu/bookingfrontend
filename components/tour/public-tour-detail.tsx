"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Spin,
  Steps,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { message } from "@/lib/antd-message";
import dayjs from "dayjs";
import {
  PrinterOutlined,
  EnvironmentOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  CarOutlined,
  FolderOpenOutlined,
  EditOutlined,
  StarOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { api, getErrorMessage } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import { useMapSrc } from "@/lib/use-map-src";
import { discountedPrice, discountFor, isTypePromoActive } from "@/lib/promo";
import {
  formatDepartureTime,
  formatFreeCancellation,
  formatTourDuration,
  hasTypePrice,
  typeDisplayPrice,
} from "@/lib/tour-display";
import PromoCountdown from "@/components/promo-countdown";
import PayPalCheckout from "@/components/paypal-checkout";
import PublicHeader from "@/components/public-header";
import TourSlideshow from "@/components/tour-slideshow";
import DayTimeline from "@/components/day-timeline";
import type { PublicTour } from "@/lib/server-tours";


const vnd = (value: string | number | null | undefined) =>
  `${Number(value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: 0 })} ₫`;

/**
 * The public tour page.
 *
 * The tour is fetched on the SERVER (app/tour/[slug]/page.tsx) and handed
 * over as a prop: the HTML Googlebot receives already contains the tour, its
 * itinerary and its price. Fetching it in an effect would render an empty
 * page for the crawler.
 */
export default function PublicTourDetail({
  tour,
}: {
  tour: PublicTour;
}) {
  const router = useRouter();
  const { user, hasPermission } = useApp();

  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm] = Form.useForm();
  const [savingBooking, setSavingBooking] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [coordinates, setCoordinates] = useState<any[]>([]);
  const [payChoice, setPayChoice] = useState<"paynow" | "paylater">("paynow");
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [paypalEnabled, setPaypalEnabled] = useState<boolean | null>(null);
  const [paypalRate, setPaypalRate] = useState(25000);
  const [paypalCurrency, setPaypalCurrency] = useState("USD");
  const watchedPax = Form.useWatch("totalPax", bookingForm);
  const watchedDate = Form.useWatch("startingDate", bookingForm);
  const watchedHotel = Form.useWatch("hotelName", bookingForm);

  const canEdit = hasPermission("tour.itinerary.edit") || hasPermission("tour.update");

  const typePrices = tour?.typePrices ?? [];
  const priceOf = (type?: string) => {
    const match = typePrices.find((x) => x.type === type);
    if (match) return hasTypePrice(match) ? typeDisplayPrice(match) : 0;
    if (typePrices.length === 0 && type === tour?.type) {
      return Number(tour?.adultPrice ?? 0) || 0;
    }
    return 0;
  };

  const priceOptions = (["PRIVATE_TOUR", "GROUP_TOUR"] as const)
    .map((type) => ({
      type,
      label: type === "PRIVATE_TOUR" ? "Private" : "Group",
      price: priceOf(type),
      pct: discountFor(tour ?? {}, type),
      promo: isTypePromoActive(tour ?? {}, type),
    }))
    .filter((o) => o.price > 0);

  if (priceOptions.length === 0) {
    const type = tour?.type ?? "PRIVATE_TOUR";
    priceOptions.push({
      type,
      label: type === "GROUP_TOUR" ? "Group" : "Private",
      price: Number(tour?.adultPrice ?? 0) || 0,
      pct: discountFor(tour ?? {}, type),
      promo: isTypePromoActive(tour ?? {}, type),
    });
  }

  const offeredTypes: string[] = priceOptions.map((o) => o.type);
  const offeredKey = offeredTypes.join(",");

  const categories = useMemo(
    () =>
      [...(tour?.categories ?? [])]
        .filter((link) => link.category?.isActive !== false)
        .sort(
          (a, b) =>
            Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) ||
            (a.category.sortOrder ?? 0) - (b.category.sortOrder ?? 0) ||
            a.category.name.localeCompare(b.category.name),
        ),
    [tour],
  );

  const initialType =
    tour?.type && offeredTypes.includes(tour.type)
      ? tour.type
      : offeredTypes[0] ?? tour?.type ?? "PRIVATE_TOUR";

  const [selectedType, setSelectedType] = useState<string>(initialType);
  const privatePaxOptions = useMemo(
    () =>
      (tour?.privatePaxPrices ?? [])
        .filter((row) => Number(row.pricePerPerson ?? 0) > 0)
        .map((row) => row.pax)
        .sort((a, b) => a - b),
    [tour],
  );
  const privateMaxPax = privatePaxOptions.length
    ? Math.max(...privatePaxOptions)
    : 12;
  const maxSelectablePax =
    selectedType === "PRIVATE_TOUR" && privatePaxOptions.length
      ? privateMaxPax
      : 12;

  useEffect(() => {
    if (!offeredTypes.includes(selectedType)) {
      setSelectedType(offeredTypes[0] ?? tour?.type ?? "PRIVATE_TOUR");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour?.id, offeredKey, selectedType]);

  const selectTourType = (type: string) => {
    setSelectedType(type);
    const nextMax =
      type === "PRIVATE_TOUR" && privatePaxOptions.length
        ? privateMaxPax
        : 12;
    const currentPax = Number(bookingForm.getFieldValue("totalPax") ?? 1);
    bookingForm.setFieldsValue({
      tourType: type,
      ...(currentPax > nextMax ? { totalPax: nextMax } : {}),
    });
  };

  const hasPromo = priceOptions.some((o) => o.promo);

  useEffect(() => {
    api
      .get("/coordinates", { params: { limit: 1000 } })
      .then((r) => setCoordinates(r.data.items ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    api
      .get("/payments/paypal/config")
      .then((r) => {
        setPaypalEnabled(!!r.data?.enabled);
        setPaypalRate(Number(r.data?.vndPerUsd) || 25000);
        setPaypalCurrency(String(r.data?.currency || "USD"));
      })
      .catch(() => setPaypalEnabled(false));
  }, []);

  useEffect(() => {
    if (paypalEnabled === false && payChoice === "paynow" && !createdBookingId) {
      setPayChoice("paylater");
    }
  }, [paypalEnabled, payChoice, createdBookingId]);

  useEffect(() => {
    if (createdBookingId) return;
    if (!bookingOpen || !tour?.id || !selectedType || !watchedPax) {
      setQuote(null);
      return;
    }
    let active = true;
    setQuoteLoading(true);
    api
      .post("/bookings/website/quote", {
        tourId: tour.id,
        tourType: selectedType,
        totalPax: Number(watchedPax),
      })
      .then((r) => active && setQuote(r.data))
      .catch(() => active && setQuote(null))
      .finally(() => active && setQuoteLoading(false));
    return () => {
      active = false;
    };
  }, [bookingOpen, tour?.id, selectedType, watchedPax, createdBookingId]);

  const openBooking = () => {
    if (!user) {
      router.push(
        `/login?redirect=${encodeURIComponent(window.location.pathname)}`,
      );
      return;
    }
    const tourType = selectedType ?? tour?.type ?? "PRIVATE_TOUR";
    setCreatedBookingId(null);
    setQuote(null);
    setCurrentStep(0);
    setPayChoice(paypalEnabled === false ? "paylater" : "paynow");
    bookingForm.resetFields();
    bookingForm.setFieldsValue({
      tourType,
      tourId: tour?.id,
      departureTime: tour?.departureTimes?.[0],
      customerName: user.name ?? "",
      mail: user.email ?? "",
      totalPax: 1,
      startingDate: dayjs().add(1, "day").startOf("day"),
    });
    setBookingOpen(true);
  };

  const stepFields = (step: number) => {
    if (step === 0) {
      return [
        "tourType",
        ...((tour?.departureTimes ?? []).length ? ["departureTime"] : []),
        "startingDate",
        "totalPax",
        "paxDetail",
      ];
    }
    if (step === 1) {
      return ["customerName", "phone", "mail", "hotelName", "address"];
    }
    return [];
  };

  const goToNextStep = async () => {
    try {
      await bookingForm.validateFields(stepFields(currentStep));
      setCurrentStep((step) => Math.min(2, step + 1));
    } catch {
      // Ant Design renders the field errors; the user can correct them here.
    }
  };

  const saveBooking = async () => {
    if (createdBookingId) {
      setBookingOpen(false);
      return;
    }
    let values: any;
    try {
      values = await bookingForm.validateFields();
    } catch {
      return;
    }
    setSavingBooking(true);
    try {
      if (payChoice === "paynow" && paypalEnabled === false) {
        message.error("PayPal is not configured yet. Please choose Pay later.");
        return;
      }
      const payload = {
        ...values,
        tourId: tour?.id,
        startingDate: values.startingDate?.format("YYYY-MM-DD"),
        payLater: payChoice === "paylater",
        paymentNote:
          payChoice === "paylater"
            ? "Customer selected pay later on the website."
            : undefined,
      };
      const res = await api.post("/bookings/website", payload);
      if (payChoice === "paylater") {
        message.success(
          `Booking ${res.data.booking?.bookingRef ?? ""} submitted. Payment is due at the end of the tour.`,
        );
        setBookingOpen(false);
      } else {
        setCreatedBookingId(res.data.booking?.id ?? null);
        message.success("Booking created. Complete the PayPal payment below.");
      }
    } catch (e) {
      message.error(getErrorMessage(e, "Failed to submit booking"));
    } finally {
      setSavingBooking(false);
    }
  };

  const days = useMemo(() => {
    const map = new Map<number, NonNullable<PublicTour["itineraries"]>>();
    [...(tour?.itineraries ?? [])]
      .sort((a, b) => a.dayNumber - b.dayNumber || a.orderIndex - b.orderIndex)
      .forEach((it) => {
        if (!map.has(it.dayNumber)) map.set(it.dayNumber, []);
        map.get(it.dayNumber)!.push(it);
      });
    return [...map.entries()];
  }, [tour]);

  const stops = tour?.itineraries?.length ?? 0;
  const mapSrc = useMapSrc(tour?.mapQuery, tour?.departureLocation);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <PublicHeader />

      <Flex flex="1" justify="center" style={{ padding: "24px 16px 56px" }}>
        {(
          <Flex vertical gap={16} style={{ width: "100%", maxWidth: 1360 }}>
            {/* ─── PUBLIC VIEW TOP BAR ─── */}
            <Flex justify="space-between" align="center" wrap gap={12}>
              <Flex align="center" gap={8} wrap>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {tour.code}
                </Typography.Text>
                {offeredTypes.map((type) => (
                  <Tag
                    key={type}
                    color={type === "PRIVATE_TOUR" ? "purple" : "cyan"}
                  >
                    {type === "PRIVATE_TOUR" ? "PRIVATE TOUR" : "GROUP TOUR"}
                  </Tag>
                ))}
                <Typography.Title level={1} style={{ margin: 0, fontSize: 26 }}>
                  {tour.name}
                </Typography.Title>
                {categories.map(({ category, isPrimary }) => (
                  <Link
                    key={category.id}
                    href={`/tours?category=${encodeURIComponent(category.slug)}`}
                  >
                    <Tag
                      color={isPrimary ? "blue" : "default"}
                      style={{ cursor: "pointer", marginInlineEnd: 0 }}
                    >
                      {category.name}
                    </Tag>
                  </Link>
                ))}
              </Flex>
              <Flex gap={8} className="no-print">
                {user && canEdit && (
                  <Button icon={<EditOutlined />} onClick={() => router.push(`/manage/tours/${tour.id}`)}>
                    Back to Editor
                  </Button>
                )}
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  Print
                </Button>
              </Flex>
            </Flex>

            <Row gutter={[16, 16]}>
              {/* ─── LEFT: MAIN CONTENT ─── */}
              <Col xs={24} lg={18}>
                <Flex vertical gap={16}>
                  {/* SLIDESHOW */}
                  <Card
                    variant="borderless"
                    className="print-full"
                    styles={{ body: { padding: 0 } }}
                    title={
                      <Flex align="center" gap={8}>
                        <FolderOpenOutlined />
                        <span>Slideshow</span>
                      </Flex>
                    }
                  >
                    <TourSlideshow
                      images={tour.gallery ?? []}
                      alt={`${tour.name} — photo ${tour.departureLocation ?? "Vietnam"}`}
                    />
                  </Card>

                  {/* PICKUP & MEETING */}
                  <Card
                    variant="borderless"
                    title={
                      <Flex align="center" gap={8}>
                        <EnvironmentOutlined style={{ color: "#22d3ee" }} />
                        <span>Pickup &amp; Meeting Location</span>
                      </Flex>
                    }
                  >
                    {tour.departureLocation ? (
                      <Flex vertical gap={6}>
                        <Typography.Text style={{ fontSize: 15 }}>
                          <EnvironmentOutlined style={{ color: "#22d3ee", marginRight: 8 }} />
                          {tour.departureLocation}
                        </Typography.Text>
                        {tour.transportation && (
                          <Typography.Text type="secondary">
                            <CarOutlined style={{ marginRight: 8 }} />
                            {tour.transportation}
                          </Typography.Text>
                        )}
                      </Flex>
                    ) : (
                      <Typography.Text type="secondary">No pickup location configured.</Typography.Text>
                    )}
                  </Card>

                  <Divider style={{ margin: 0 }} />

                  {/* DAILY ITINERARY */}
                  <Card
                    variant="borderless"
                    title={
                      <Flex align="center" gap={8}>
                        <CalendarOutlined style={{ color: "#8b5cf6" }} />
                        <span>Daily Itinerary</span>
                      </Flex>
                    }
                  >
                    {days.length === 0 ? (
                      <Empty description="No itinerary published yet." />
                    ) : (
                      <DayTimeline>
                        {days.map(([day, dayItems], di) => (
                          <div key={day} className="timeline-day">
                            <div className="timeline-rail">
                              <span
                                className="knot-dot"
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, #22d3ee, #8b5cf6)",
                                  border: "2px solid var(--ant-color-bg-container)",
                                  boxShadow: "0 0 0 4px rgba(139,92,246,0.15)",
                                  animationDelay: `${(di * 3.5) / Math.max(days.length, 1)}s`,
                                }}
                              />
                            </div>
                            <div className="timeline-content">
                              <Flex align="center" gap={10} style={{ marginBottom: 12 }}>
                                <Typography.Text strong style={{ fontSize: 18 }}>
                                  Day {day}
                                </Typography.Text>
                              </Flex>
                              <Flex vertical gap={14}>
                                {dayItems.map((it) => (
                                  <Card
                                    key={it.id}
                                    size="small"
                                    variant="borderless"
                                    style={{
                                      borderRadius: 12,
                                      border: "1px solid var(--ant-color-border-secondary)",
                                    }}
                                    styles={{ body: { padding: 18 } }}
                                  >
                                    <Flex vertical gap={8}>
                                      <Flex align="center" gap={8} wrap>
                                        <Tag color="geekblue">#{it.orderIndex + 1}</Tag>
                                        <Typography.Text strong style={{ fontSize: 16 }}>
                                          {it.title}
                                        </Typography.Text>
                                        {it.timeSlot && (
                                          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                                            <ClockCircleOutlined /> {it.timeSlot}
                                          </Typography.Text>
                                        )}
                                      </Flex>
                                      {it.location && (
                                        <Typography.Text type="secondary" style={{ fontSize: 14 }}>
                                          <EnvironmentOutlined style={{ marginRight: 4 }} />
                                          {it.location}
                                        </Typography.Text>
                                      )}
{it.description && (
  <div
    className="prose-content"
    style={{ marginTop: 4 }}
    dangerouslySetInnerHTML={{ __html: it.description ?? "" }}
  />
)}
                                    </Flex>
                                  </Card>
                                ))}
                              </Flex>
                            </div>
                          </div>
                        ))}
                      </DayTimeline>
                    )}
                  </Card>

                  {/* HIGHLIGHTS + TABBED CONTENT */}
                  {tour.highlights ||
                  tour.overview ||
                  tour.regulations ||
                  tour.insurancePolicy ? (
                    <Card
                      variant="borderless"
                      title={
                        <Flex align="center" gap={8}>
                          <StarOutlined style={{ color: "#f59e0b" }} />
                          <span>Tour content</span>
                        </Flex>
                      }
                    >
{tour.highlights && (
  <Flex vertical gap={8} style={{ marginBottom: 16 }}>
    <Typography.Text strong>
      <StarOutlined style={{ color: "#f59e0b", marginRight: 8 }} />
      Highlights
    </Typography.Text>
    <div
      className="prose-content"
      dangerouslySetInnerHTML={{ __html: tour.highlights }}
    />
  </Flex>
)}
                      <Tabs
                        defaultActiveKey="overview"
                        items={[
                          {
                            key: "overview",
                            label: (
                              <span>
                                <CalendarOutlined /> Itinerary
                              </span>
                            ),
children: tour.overview ? (
  <div
    className="prose-content"
    dangerouslySetInnerHTML={{ __html: tour.overview }}
  />
) : (
                              <Typography.Text type="secondary">
                                No itinerary description yet.
                              </Typography.Text>
                            ),
                          },
                          {
                            key: "regulations",
                            label: (
                              <span>
                                <ReadOutlined /> Instructions
                              </span>
                            ),
children: tour.regulations ? (
  <div
    className="prose-content"
    dangerouslySetInnerHTML={{ __html: tour.regulations }}
  />
) : (
                              <Typography.Text type="secondary">
                                No instructions yet.
                              </Typography.Text>
                            ),
                          },
                          {
                            key: "insurancePolicy",
                            label: (
                              <span>
                                <SafetyCertificateOutlined /> Insurance
                              </span>
                            ),
children: tour.insurancePolicy ? (
  <div
    className="prose-content"
    dangerouslySetInnerHTML={{ __html: tour.insurancePolicy }}
  />
) : (
                              <Typography.Text type="secondary">
                                No insurance policy yet.
                              </Typography.Text>
                            ),
                          },
                        ]}
                      />
                    </Card>
                  ) : null}

                  {/* LOCATION & ROUTE OVERVIEW */}
                  <Card
                    variant="borderless"
                    title={
                      <Flex align="center" gap={8}>
                        <EnvironmentOutlined style={{ color: "#10b981" }} />
                        <span>Location &amp; Route Overview</span>
                      </Flex>
                    }
                  >
                    {mapSrc ? (
                      <iframe
                        title={`Map - ${tour.name}`}
                        src={mapSrc}
                        style={{ width: "100%", height: 380, border: 0, borderRadius: 12, filter: "grayscale(0.15)" }}
                        loading="lazy"
                        allowFullScreen
                      />
                    ) : (
                      <Empty description="No map configured for this tour." />
                    )}
                  </Card>
                </Flex>
              </Col>

              {/* ─── RIGHT: TOUR BOOKING BOX ─── */}
              <Col xs={24} lg={6}>
                <Card
                  style={{
                    position: "sticky",
                    top: 16,
                    borderRadius: 16,
                    border: "1px solid var(--ant-color-border-secondary)",
                    overflow: "hidden",
                  }}
                  styles={{ body: { padding: 0 } }}
                >
                  <div
                    style={{
                      padding: "16px 20px",
                      color: "#062A30",
                      background: "linear-gradient(135deg, #22D3EE, #3B82F6)",
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: 16, letterSpacing: 0.5 }}>
                      TOUR BOOKING
                    </Typography.Text>
                  </div>
                  <Flex vertical gap={4} style={{ padding: 20 }}>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      TOUR TYPE
                    </Typography.Text>
                    <Flex gap={8}>
                      {priceOptions.map((offer) => (
                        <Button
                          key={offer.type}
                          shape="round"
                          size="small"
                          type={selectedType === offer.type ? "primary" : "default"}
                          onClick={() => selectTourType(offer.type)}
                          style={{ fontWeight: 600 }}
                        >
                          {offer.label}
                        </Button>
                      ))}
                    </Flex>

                    <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
                      {selectedType === "PRIVATE_TOUR" ? "FROM PRICE" : "TOTAL PRICE"} (
                      {(selectedType ?? "").replace("_", " ").toUpperCase()})
                    </Typography.Text>
                    {hasPromo ? (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 8,
                          borderRadius: 12,
                          border: "1px solid rgba(220,38,38,0.22)",
                          background:
                            "linear-gradient(120deg, rgba(220,38,38,0.06), rgba(234,179,8,0.08))",
                        }}
                      >
                        <Flex vertical gap={4}>
                          {priceOptions.map((offer) => {
                            const active = selectedType === offer.type;
                            return (
                              <div
                                key={offer.type}
                                onClick={() => selectTourType(offer.type)}
                                style={{
                                  cursor: "pointer",
                                  padding: "6px 10px",
                                  borderRadius: 10,
                                  border: active
                                    ? "1px solid rgba(220,38,38,0.35)"
                                    : "1px solid transparent",
                                  background: active
                                    ? "rgba(220,38,38,0.08)"
                                    : undefined,
                                }}
                              >
                                <Flex justify="space-between" align="center" gap={8}>
                                  <Flex align="center" gap={6}>
                                    <Typography.Text strong style={{ fontSize: 12 }}>
                                      {offer.label}
                                    </Typography.Text>
                                    {offer.promo && (
                                      <span
                                        style={{
                                          padding: "0 5px",
                                          borderRadius: 999,
                                          background: "#dc2626",
                                          color: "#fff",
                                          fontSize: 9,
                                          fontWeight: 700,
                                          lineHeight: "16px",
                                        }}
                                      >
                                        -{offer.pct}%
                                      </span>
                                    )}
                                  </Flex>
                                  {offer.promo ? (
                                    <PromoCountdown tour={tour} compact bare />
                                  ) : (
                                    <Typography.Text
                                      type="secondary"
                                      style={{ fontSize: 11 }}
                                    >
                                      No discount
                                    </Typography.Text>
                                  )}
                                </Flex>
                                <Flex
                                  justify="space-between"
                                  align="baseline"
                                  gap={8}
                                  style={{ marginTop: 2 }}
                                >
                                  <Typography.Text
                                    type="secondary"
                                    delete={offer.promo}
                                    style={{ fontSize: 11 }}
                                  >
                                    {offer.promo ? vnd(offer.price) : ""}
                                  </Typography.Text>
                                  <Typography.Text
                                    strong
                                    style={{
                                      color: offer.promo ? "#dc2626" : undefined,
                                      fontSize: offer.promo ? 16 : 14,
                                    }}
                                  >
                                    {vnd(
                                      discountedPrice(
                                        offer.price,
                                        offer.promo ? offer.pct : 0,
                                      ),
                                    )}
                                  </Typography.Text>
                                </Flex>
                              </div>
                            );
                          })}
                        </Flex>
                      </div>
                    ) : (
                      <Typography.Title level={3} style={{ margin: 0 }}>
                        {vnd(priceOf(selectedType))}
                      </Typography.Title>
                    )}
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {selectedType === "PRIVATE_TOUR"
                        ? "Per person · price depends on group size"
                        : "Per person · Taxes included"}
                    </Typography.Text>

                    <Divider style={{ margin: "16px 0" }} />

                    <Flex justify="space-between" style={{ marginBottom: 8 }}>
                      <Typography.Text>Duration</Typography.Text>
                      <Typography.Text strong>
                        {formatTourDuration(tour)}
                      </Typography.Text>
                    </Flex>
                    {(tour.departureTimes ?? []).length > 0 && (
                      <Flex
                        justify="space-between"
                        align="flex-start"
                        gap={8}
                        style={{ marginBottom: 8 }}
                      >
                        <Typography.Text style={{ whiteSpace: "nowrap" }}>
                          Departures
                        </Typography.Text>
                        <Flex gap={4} wrap justify="flex-end">
                          {(tour.departureTimes ?? []).map((time) => (
                            <Tag key={time} color="geekblue" style={{ margin: 0 }}>
                              {formatDepartureTime(time)}
                            </Tag>
                          ))}
                        </Flex>
                      </Flex>
                    )}
                    <Flex justify="space-between" style={{ marginBottom: 16 }}>
                      <Typography.Text>Stops</Typography.Text>
                      <Typography.Text strong>
                        {stops} Configured {stops === 1 ? "Stop" : "Stops"}
                      </Typography.Text>
                    </Flex>

                    <Button
                      type="primary"
                      size="large"
                      block
                      style={{ fontWeight: 700 }}
                      icon={<CalendarOutlined />}
                      onClick={openBooking}
                    >
                      BOOK THIS TOUR NOW
                    </Button>
                    {formatFreeCancellation(tour.freeCancellationHours) && (
                      <Typography.Text
                        type="secondary"
                        style={{
                          fontSize: 12,
                          marginTop: 8,
                          textAlign: "center",
                        }}
                      >
                        <SafetyCertificateOutlined />{" "}
                        {formatFreeCancellation(tour.freeCancellationHours)}
                      </Typography.Text>
                    )}
                  </Flex>
                </Card>
              </Col>
            </Row>
          </Flex>
        )}
      </Flex>

      <Modal
        title={tour ? `Book · ${tour.name}` : "Book this tour"}
        open={bookingOpen}
        onCancel={() => setBookingOpen(false)}
        width={640}
        footer={
          createdBookingId
            ? [
                <Button key="close" onClick={() => setBookingOpen(false)}>
                  Close
                </Button>,
              ]
            : [
                currentStep > 0 ? (
                  <Button key="back" onClick={() => setCurrentStep((step) => step - 1)}>
                    Back
                  </Button>
                ) : null,
                <Button
                  key="next"
                  type="primary"
                  loading={currentStep === 2 && savingBooking}
                  disabled={
                    currentStep === 2 &&
                    (quoteLoading ||
                      !quote?.totalAmount ||
                      (payChoice === "paynow" && paypalEnabled === false))
                  }
                  onClick={() => {
                    if (currentStep < 2) {
                      void goToNextStep();
                    } else {
                      void saveBooking();
                    }
                  }}
                >
                  {currentStep < 2
                    ? "Continue"
                    : payChoice === "paylater"
                      ? "Confirm pay-later booking"
                      : "Create booking & pay"}
                </Button>,
              ]
        }
        styles={{
          body: {
            maxHeight: "calc(100vh - 300px)",
            overflowY: "auto",
            paddingRight: 4,
          },
        }}
      >
        <Steps
          size="small"
          current={createdBookingId ? 2 : currentStep}
          items={[
            { title: "Trip" },
            { title: "Contact" },
            { title: "Payment" },
          ]}
          style={{ marginBottom: 20 }}
        />

        {createdBookingId ? (
          <Flex vertical gap={12}>
            <Alert
              type="success"
              showIcon
              message="Booking created — payment is the last step"
              description="Complete the PayPal payment below. The booking stays unpaid until PayPal confirms the capture."
            />
            <Card size="small" style={{ background: "#fafafa" }}>
              <Flex justify="space-between" align="baseline">
                <Typography.Text type="secondary">
                  Total {quote?.totalPax ?? watchedPax ?? 0} pax
                </Typography.Text>
                <Typography.Title level={4} style={{ margin: 0 }}>
                  {vnd(quote?.totalAmount ?? 0)}
                </Typography.Title>
              </Flex>
              {paypalEnabled && quote?.totalAmount ? (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  PayPal charges approximately {paypalCurrency}{" "}
                  {(Number(quote.totalAmount) / paypalRate).toFixed(2)} (rate{" "}
                  {paypalRate.toLocaleString("vi-VN")} VND/{paypalCurrency}).
                </Typography.Text>
              ) : null}
            </Card>
            <PayPalCheckout
              bookingId={createdBookingId}
              onPaid={() => {
                message.success("Payment received. Your booking is confirmed.");
                setBookingOpen(false);
              }}
              onError={(text) => message.error(text)}
            />
          </Flex>
        ) : (
          <Form form={bookingForm} layout="vertical">
            <div style={{ display: currentStep === 0 ? "block" : "none" }}>
              <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
                Step 1 of 3 · Choose your trip
              </Typography.Text>
              <Row gutter={12}>
                <Col span={14}>
                  <Form.Item
                    name="tourType"
                    label="Tour type"
                    rules={[{ required: true, message: "Please choose a tour type" }]}
                  >
                    <Select
                      options={priceOptions.map((offer) => ({
                        value: offer.type,
                        label: `${offer.label} Tour`,
                      }))}
                      onChange={(value) => selectTourType(value)}
                    />
                  </Form.Item>
                </Col>
                <Col span={10}>
                  {(tour?.departureTimes ?? []).length > 0 && (
                    <Form.Item
                      name="departureTime"
                      label="Departure"
                      rules={[
                        { required: true, message: "Please choose a departure time" },
                      ]}
                    >
                      <Select
                        placeholder="Choose"
                        options={(tour?.departureTimes ?? []).map((time) => ({
                          value: time,
                          label: formatDepartureTime(time),
                        }))}
                      />
                    </Form.Item>
                  )}
                </Col>
              </Row>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="startingDate"
                    label="Start date"
                    rules={[{ required: true, message: "Start date is required" }]}
                  >
                    <DatePicker
                      style={{ width: "100%" }}
                      format="DD MMM YYYY"
                      disabledDate={(date) => date.isBefore(dayjs().startOf("day"))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="totalPax"
                    label="Total pax"
                    extra={
                      selectedType === "PRIVATE_TOUR" && privatePaxOptions.length
                        ? `Available: ${privatePaxOptions.join(", ")} people`
                        : undefined
                    }
                    rules={[{ required: true, message: "Total pax is required" }]}
                  >
                    <InputNumber
                      min={1}
                      max={maxSelectablePax}
                      precision={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="paxDetail"
                label="Pax detail"
                rules={[
                  { required: true, whitespace: true, message: "Pax detail is required" },
                ]}
              >
                <Input placeholder="e.g. 1 adult, 1 child" />
              </Form.Item>
              <Card size="small" style={{ background: "#fafafa" }}>
                <Flex justify="space-between" align="baseline">
                  <Typography.Text type="secondary">
                    {quoteLoading ? "Checking price…" : "Price per person"}
                  </Typography.Text>
                  <Typography.Text strong>
                    {vnd(
                      quote?.unitPrice ??
                        discountedPrice(
                          priceOf(selectedType),
                          discountFor(tour ?? {}, selectedType),
                        ),
                    )}
                  </Typography.Text>
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedType === "PRIVATE_TOUR"
                    ? "Private price depends on the number of people."
                    : "Group price is per person. The final total is shown in the payment step."}
                </Typography.Text>
              </Card>
            </div>

            <div style={{ display: currentStep === 1 ? "block" : "none" }}>
              <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
                Step 2 of 3 · Contact & pickup
              </Typography.Text>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name="customerName"
                    label="Customer name"
                    rules={[{ required: true, message: "Customer name is required" }]}
                  >
                    <Input placeholder="Your full name" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="phone"
                    label="Phone"
                    rules={[{ required: true, message: "Phone is required" }]}
                  >
                    <Input placeholder="Your phone number" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="mail"
                label="Email"
                rules={[
                  { required: true, message: "Email is required" },
                  { type: "email", message: "Please enter a valid email address" },
                ]}
              >
                <Input placeholder="Your email" />
              </Form.Item>
              <Form.Item
                name="hotelName"
                label="Hotel"
                rules={[
                  {
                    required: true,
                    message: "Please pick a hotel from the list or type a new one",
                  },
                ]}
                required
              >
                <AutoComplete
                  options={coordinates.map((c: any) => ({ value: c.hotelName }))}
                  filterOption={(input, option) =>
                    String(option?.value ?? "")
                      .toLowerCase()
                      .includes(input.toLowerCase())
                  }
                  onChange={(value) => {
                    const c = coordinates.find(
                      (x: any) =>
                        x.hotelName.toLowerCase() ===
                        String(value ?? "").trim().toLowerCase(),
                    );
                    if (c) {
                      bookingForm.setFieldsValue({
                        address: c.address,
                        latitude: c.latitude,
                        longitude: c.longitude,
                      });
                    } else {
                      bookingForm.setFieldsValue({
                        address: undefined,
                        latitude: undefined,
                        longitude: undefined,
                      });
                    }
                  }}
                  placeholder="Type to search hotels, or enter a new one"
                />
              </Form.Item>
              <Form.Item
                name="address"
                label="Pickup address"
                rules={[{ required: true, message: "Address is required" }]}
              >
                <Input placeholder="Auto-filled when the hotel is picked from the list" />
              </Form.Item>
            </div>

            <div style={{ display: currentStep === 2 ? "block" : "none" }}>
              <Typography.Text strong style={{ display: "block", marginBottom: 12 }}>
                Step 3 of 3 · Review & payment
              </Typography.Text>
              <Descriptions
                size="small"
                column={2}
                bordered
                style={{ marginBottom: 12 }}
                items={[
                  {
                    key: "tour",
                    label: "Tour",
                    children: tour?.name ?? "—",
                    span: 2,
                  },
                  {
                    key: "date",
                    label: "Date",
                    children: watchedDate
                      ? watchedDate.format("DD MMM YYYY")
                      : "—",
                  },
                  {
                    key: "pax",
                    label: "Pax",
                    children: quote?.totalPax ?? watchedPax ?? 0,
                  },
                  {
                    key: "pickup",
                    label: "Pickup",
                    children: watchedHotel || "—",
                    span: 2,
                  },
                ]}
              />
              <Form.Item label="Payment method" style={{ marginBottom: 12 }}>
                <Radio.Group
                  value={payChoice}
                  onChange={(e) => setPayChoice(e.target.value)}
                >
                  <Radio.Button value="paynow" disabled={paypalEnabled === false}>
                    Pay now with PayPal
                  </Radio.Button>
                  <Radio.Button value="paylater">Pay later</Radio.Button>
                </Radio.Group>
              </Form.Item>
              <Card size="small" style={{ background: "#fafafa" }}>
                {quoteLoading ? (
                  <Spin size="small" />
                ) : (
                  <Flex justify="space-between" align="baseline">
                    <Typography.Text type="secondary">
                      Total {quote?.totalPax ?? watchedPax ?? 0} pax
                    </Typography.Text>
                    <Typography.Title level={4} style={{ margin: 0 }}>
                      {vnd(quote?.totalAmount ?? 0)}
                    </Typography.Title>
                  </Flex>
                )}
                {payChoice === "paynow" && paypalEnabled && quote?.totalAmount ? (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    PayPal charges approximately {paypalCurrency}{" "}
                    {(Number(quote.totalAmount) / paypalRate).toFixed(2)} (rate{" "}
                    {paypalRate.toLocaleString("vi-VN")} VND/{paypalCurrency}).
                  </Typography.Text>
                ) : null}
                {payChoice === "paynow" && paypalEnabled === false && (
                  <Typography.Text type="warning" style={{ fontSize: 12 }}>
                    PayPal is not configured. Choose Pay later or contact us.
                  </Typography.Text>
                )}
                {!quoteLoading && !quote?.totalAmount && (
                  <Typography.Text type="warning" style={{ fontSize: 12 }}>
                    Go back and check the date and pax so the total can be calculated.
                  </Typography.Text>
                )}
              </Card>
            </div>

            <Form.Item name="tourId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="latitude" hidden>
              <InputNumber />
            </Form.Item>
            <Form.Item name="longitude" hidden>
              <InputNumber />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
