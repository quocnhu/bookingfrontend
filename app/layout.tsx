import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AppProvider } from "@/lib/app-context";
import AntdProvider from "@/lib/antd-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Booking Project",
  description: "Full-stack booking & tour management",
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
