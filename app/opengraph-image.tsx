import { ImageResponse } from "next/og";
import { BRAND, SITE_DESCRIPTION } from "@/lib/site";

export const alt = `${BRAND} — Vietnam tours, day trips & private experiences`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The social preview image (Facebook / Zalo / WhatsApp / X).
 * Generated so it always carries the current brand — no binary to maintain.
 */
export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #062A30 0%, #0F3B44 55%, #123A5E 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              background: "linear-gradient(135deg, #22D3EE, #3B82F6)",
              color: "#062A30",
              fontWeight: 700,
            }}
          >
            ✈
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 0.5 }}>
            {BRAND}
          </div>
        </div>

        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            maxWidth: 900,
            display: "flex",
          }}
        >
          Vietnam tours, day trips & private experiences
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.35,
            color: "#B9E6F2",
            maxWidth: 860,
            display: "flex",
          }}
        >
          Ha Long Bay cruises, Ninh Binh day trips, Hoi An lantern nights and
          Da Nang &amp; Ba Na Hills — booked directly with a local operator.
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 14,
            fontSize: 24,
            color: "#7DD3FC",
          }}
        >
          <span>Ha Long Bay</span>
          <span>·</span>
          <span>Ninh Binh</span>
          <span>·</span>
          <span>Hoi An</span>
          <span>·</span>
          <span>Da Nang</span>
          <span>·</span>
          <span>Ho Chi Minh City</span>
        </div>
      </div>
    ),
    size,
  );
}
