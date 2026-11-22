import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProvider } from "@/lib/app-context";
import AntdProvider from "@/lib/antd-provider";
import { fetchCompany } from "@/lib/server-tours";
import {
  BRAND,
  DEFAULT_LOCALE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_URL,
} from "@/lib/site";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const company = await fetchCompany();
  const brandName = company.shortName?.trim() || BRAND;
  const logoUrl = company.logoUrl?.trim() || null;
  const iconUrl = logoUrl || "/icon.svg";
  const iconType = logoUrl ? "image/png" : "image/svg+xml";

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${brandName} — Vietnam Tours, Day Trips & Private Experiences`,
      template: `%s | ${brandName}`,
    },
    description: SITE_DESCRIPTION,
    keywords: SITE_KEYWORDS,
    applicationName: brandName,
    authors: [{ name: brandName, url: SITE_URL }],
    creator: brandName,
    publisher: brandName,
    category: "travel",
    alternates: {
      canonical: "/",
    },
    icons: {
      icon: [{ url: iconUrl, type: iconType }],
      shortcut: iconUrl,
      ...(logoUrl ? { apple: logoUrl } : {}),
    },
    openGraph: {
      type: "website",
      siteName: brandName,
      locale: DEFAULT_LOCALE,
      url: SITE_URL,
      title: `${brandName} — Vietnam Tours, Day Trips & Private Experiences`,
      description: SITE_DESCRIPTION,
    },
    twitter: {
      card: "summary_large_image",
      title: `${brandName} — Vietnam Tours, Day Trips & Private Experiences`,
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
}

export const viewport: Viewport = {
  themeColor: "#062A30",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('booking.theme');if(t!=='light'&&t!=='dark')t='dark';var r=document.documentElement;r.classList.toggle('dark',t==='dark');r.style.colorScheme=t;}catch(e){var r=document.documentElement;r.classList.add('dark');r.style.colorScheme='dark';}})();`}
        </Script>
        <AntdRegistry>
          <AppProvider>
            <AntdProvider>{children}</AntdProvider>
          </AppProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
