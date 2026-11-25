"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Empty,
  Flex,
  Modal,
  Spin,
  Tag,
  Typography,
  theme as antdTheme,
} from "antd";
import { CalendarOutlined, CreditCardOutlined, EnvironmentOutlined } from "@ant-design/icons";
import PublicHeader from "@/components/public-header";
import PayPalCheckout from "@/components/paypal-checkout";
import { api, getErrorMessage } from "@/lib/api";
import { message } from "@/lib/antd-message";
import { useApp } from "@/lib/app-context";
import {
  formatUnpaidDeadline,
  formatVnd,
  isUnpaidPayPalBooking,
} from "@/lib/unpaid";

type MyBooking = {
  id: string;
  bookingRef: string;
  status?: string | null;
  payment?: string | null;
  paymentMethod?: string | null;
  payLater?: boolean | null;
  channel?: string | null;
  startingDate?: string | null;
  departureTime?: string | null;
  totalPax?: number | null;
  totalAmount?: number | string | null;
  currency?: string | null;
  hotelName?: string | null;
  address?: string | null;
  customerName?: string | null;
  notes?: string | null;
  paymentNote?: string | null;
  unpaid?: boolean;
  canRetryPayment?: boolean;
  autoCancelAt?: string | null;
  tour?: {
    id?: string;
    name?: string | null;
    slug?: string | null;
    thumbnailUrl?: string | null;
  } | null;
  assignment?: { code?: string | null; status?: string | null } | null;
  payments?: Array<{
    id: string;
    status?: string | null;
    providerOrderId?: string | null;
    providerCaptureId?: string | null;
    paidAt?: string | null;
    createdAt?: string | null;
  }>;
};

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";

export default function MyBookingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useApp();
  const { token } = antdTheme.useToken();
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payBooking, setPayBooking] = useState<MyBooking | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<MyBooking[]>("/bookings/mine")
      .then((res) => setBookings(res.data ?? []))
      .catch((e) => setError(getErrorMessage(e, "Could not load your bookings")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?redirect=/my-bookings");
      return;
    }
    let alive = true;
    Promise.resolve().then(() => {
      if (alive) load();
    });
    return () => {
      alive = false;
    };
  }, [authLoading, user, router]);

  const openPayment = (booking: MyBooking) => {
    setPayBooking(booking);
  };

  return (
    <div style={{ minHeight: "100vh", background: token.colorBgLayout }}>
      <PublicHeader />
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" }}>
        <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 20 }}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              My bookings
            </Typography.Title>
            <Typography.Text type="secondary">
              Complete an unpaid PayPal booking here instead of booking again.
            </Typography.Text>
          </div>
          <Link href="/tours">
            <Button>Browse tours</Button>
          </Link>
        </Flex>

        {error ? (
          <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
        ) : null}

        {loading || authLoading ? (
          <Flex justify="center" style={{ padding: 60 }}>
            <Spin size="large" />
          </Flex>
        ) : bookings.length === 0 ? (
          <Card variant="borderless">
            <Empty description="You have no bookings yet.">
              <Link href="/tours">
                <Button type="primary">Find a tour</Button>
              </Link>
            </Empty>
          </Card>
        ) : (
          <Flex vertical gap={14}>
            {bookings.map((booking) => {
              const unpaid = isUnpaidPayPalBooking(booking) || booking.unpaid === true;
              const paid = booking.payment === "PAID";
              const canceled = booking.status === "CANCELED";
              const payLater = booking.payLater === true && booking.payment === "PENDING";
              const deadline = formatUnpaidDeadline(booking.autoCancelAt);
              const canPay = unpaid && booking.canRetryPayment !== false && !canceled;
              const tourName = booking.tour?.name ?? "Tour";
              return (
                <Card key={booking.id} variant="borderless">
                  <Flex justify="space-between" align="flex-start" wrap gap={16}>
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <Flex align="center" gap={8} wrap>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                          {tourName}
                        </Typography.Title>
                        <Tag style={{ margin: 0 }}>{booking.bookingRef}</Tag>
                        {canceled ? (
                          <Tag color="red" style={{ margin: 0 }}>
                            CANCELED
                          </Tag>
                        ) : paid ? (
                          <Tag color="green" style={{ margin: 0 }}>
                            PAID
                          </Tag>
                        ) : payLater ? (
                          <Tag color="gold" style={{ margin: 0 }}>
                            PAY LATER
                          </Tag>
                        ) : unpaid ? (
                          <Tag color="orange" style={{ margin: 0 }}>
                            UNPAID
                          </Tag>
                        ) : (
                          <Tag style={{ margin: 0 }}>{booking.payment ?? "—"}</Tag>
                        )}
                      </Flex>
                      <Typography.Text style={{ display: "block", marginTop: 10 }}>
                        <CalendarOutlined /> {fmtDate(booking.startingDate)}
                        {booking.departureTime ? ` · ${booking.departureTime}` : ""}
                        {" · "}
                        {booking.totalPax ?? 0} pax
                      </Typography.Text>
                      {(booking.hotelName || booking.address) && (
                        <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                          <EnvironmentOutlined />{" "}
                          {[booking.hotelName, booking.address].filter(Boolean).join(", ")}
                        </Typography.Text>
                      )}
                      {booking.assignment?.code ? (
                        <Typography.Text type="secondary" style={{ display: "block", marginTop: 4 }}>
                          Bus: {booking.assignment.code}
                          {booking.assignment.status
                            ? ` · ${booking.assignment.status.replace(/_/g, " ")}`
                            : ""}
                        </Typography.Text>
                      ) : null}
                      {unpaid && !canceled ? (
                        <Typography.Text
                          type="warning"
                          style={{ display: "block", marginTop: 8, fontWeight: 500 }}
                        >
                          {canPay
                            ? `Complete the payment${deadline ? ` before ${deadline}` : ""}. Otherwise the booking is automatically cancelled (reason: "PayPal payment not completed").`
                            : "The payment window has closed. This booking will be cancelled automatically — please book again."}
                        </Typography.Text>
                      ) : null}
                      {payLater ? (
                        <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                          This is a pay-later booking — pay the guide at the end of the tour.
                        </Typography.Text>
                      ) : null}
                    </div>
                    <Flex vertical align="flex-end" gap={10} style={{ minWidth: 180 }}>
                      <div style={{ textAlign: "right" }}>
                        <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
                          Total
                        </Typography.Text>
                        <Typography.Title level={4} style={{ margin: 0 }}>
                          {formatVnd(booking.totalAmount)}
                        </Typography.Title>
                      </div>
                      {canPay ? (
                        <Button
                          type="primary"
                          icon={<CreditCardOutlined />}
                          onClick={() => openPayment(booking)}
                        >
                          Complete payment
                        </Button>
                      ) : unpaid && !canceled ? (
                        <Button disabled icon={<CreditCardOutlined />}>
                          Payment window closed
                        </Button>
                      ) : null}
                    </Flex>
                  </Flex>
                </Card>
              );
            })}
          </Flex>
        )}
      </main>

      <Modal
        open={!!payBooking}
        title="Complete your payment"
        onCancel={() => setPayBooking(null)}
        footer={null}
        destroyOnHidden
        width={520}
      >
        {payBooking ? (
          <Flex vertical gap={14} style={{ paddingTop: 8 }}>
            <Typography.Text>
              {payBooking.tour?.name ?? "Tour"} · {payBooking.bookingRef} ·{" "}
              {formatVnd(payBooking.totalAmount)}
            </Typography.Text>
            {payBooking.autoCancelAt ? (
              <Alert
                type="warning"
                showIcon
                message={`This booking is held until ${formatUnpaidDeadline(payBooking.autoCancelAt)}`}
                description="If the payment is not completed, the booking is automatically cancelled. The payment attempt stays in the audit trail."
              />
            ) : null}
            <PayPalCheckout
              bookingId={payBooking.id}
              onPaid={() => {
                setPayBooking(null);
                message.success("Payment received. Your booking is confirmed.");
                load();
              }}
              onError={() => undefined}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              After a successful payment your booking joins the tour and you receive a
              confirmation email.
            </Typography.Text>
          </Flex>
        ) : null}
      </Modal>
    </div>
  );
}
