import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProvider } from "@/lib/app-context";
import AntdProvider from "@/lib/antd-provider";
import {
  BRAND,
  DEFAULT_LOCALE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND} — Vietnam Tours, Day Trips & Private Experiences`,
    template: `%s | ${BRAND}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: BRAND,
  authors: [{ name: BRAND, url: SITE_URL }],
  creator: BRAND,
  publisher: BRAND,
  category: "travel",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: BRAND,
    locale: DEFAULT_LOCALE,
    url: SITE_URL,
    title: `${BRAND} — Vietnam Tours, Day Trips & Private Experiences`,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND} — Vietnam Tours, Day Trips & Private Experiences`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: { telephone: true, address: true, email: true },
};

export const viewport: Viewport = {
  themeColor: "#062A30",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">
        <AntdRegistry>
          <AppProvider>
            <AntdProvider>{children}</AntdProvider>
          </AppProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
