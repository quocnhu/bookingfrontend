"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Flex, Spin, Typography } from "antd";
import { api, getErrorMessage } from "@/lib/api";

type PayPalConfig = {
  enabled: boolean;
  clientId: string | null;
  currency: string;
  mode: string;
};

type Props = {
  bookingId: string;
  onPaid: () => void;
  onError?: (message: string) => void;
};

let sdkPromise: Promise<void> | null = null;

function loadPayPalSdk(clientId: string, currency: string) {
  if (typeof window === "undefined") return Promise.resolve();
  if ((window as any).paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-paypal-sdk="1"]',
    );
    const script = existing ?? document.createElement("script");
    script.dataset.paypalSdk = "1";
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
      clientId,
    )}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Could not load PayPal"));
    };
    if (!existing) document.body.appendChild(script);
  });
  return sdkPromise;
}

export default function PayPalCheckout({ bookingId, onPaid, onError }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<PayPalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const paidRef = useRef(false);
  const paidCbRef = useRef(onPaid);
  const errorCbRef = useRef(onError);
  paidCbRef.current = onPaid;
  errorCbRef.current = onError;

  useEffect(() => {
    let active = true;
    api
      .get<PayPalConfig>("/payments/paypal/config")
      .then((res) => {
        if (!active) return;
        setConfig(res.data);
        if (!res.data.enabled) {
          setError("PayPal is not configured yet. Please choose Pay later.");
        }
      })
      .catch((e) => active && setError(getErrorMessage(e, "Could not load PayPal")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!config?.enabled || !config.clientId || !hostRef.current) return;
    let cancelled = false;
    let buttons: any = null;
    const host = hostRef.current;
    host.innerHTML = "";

    loadPayPalSdk(config.clientId, config.currency)
      .then(() => {
        if (cancelled || !(window as any).paypal) return;
        buttons = (window as any).paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal", height: 45 },
          createOrder: async () => {
            const res = await api.post("/payments/paypal/orders", { bookingId });
            return res.data.orderId as string;
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              await api.post("/payments/paypal/capture", {
                bookingId,
                orderId: data.orderID,
              });
              if (paidRef.current) return;
              paidRef.current = true;
              paidCbRef.current();
            } catch (e) {
              const text = getErrorMessage(e, "PayPal payment failed");
              setError(text);
              errorCbRef.current?.(text);
            }
          },
          onCancel: () => {
            setError("PayPal payment was cancelled. Your booking is still unpaid.");
          },
          onError: (e: unknown) => {
            const text =
              e instanceof Error ? e.message : "PayPal could not complete the payment";
            setError(text);
            errorCbRef.current?.(text);
          },
        });
        if (!cancelled) buttons.render(host);
      })
      .catch((e) => {
        if (!cancelled) {
          const text = getErrorMessage(e, "Could not load PayPal");
          setError(text);
          errorCbRef.current?.(text);
        }
      });

    return () => {
      cancelled = true;
      try {
        buttons?.close?.();
      } catch {
        // ignore SDK cleanup errors
      }
    };
  }, [config, bookingId]);

  if (loading) {
    return (
      <Flex justify="center" style={{ padding: 16 }}>
        <Spin />
      </Flex>
    );
  }
  if (error) {
    return <Alert type="warning" showIcon message={error} style={{ marginTop: 12 }} />;
  }
  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Secure payment processed by PayPal. Your booking is confirmed only after
        PayPal captures the payment.
      </Typography.Text>
      <div ref={hostRef} style={{ marginTop: 8 }} />
    </div>
  );
}
