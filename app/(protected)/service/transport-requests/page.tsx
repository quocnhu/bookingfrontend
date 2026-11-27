"use client";

import { CarOutlined, TeamOutlined } from "@ant-design/icons";
import { Tabs } from "antd";
import AdminTransportRequests from "@/components/transport-requests/admin-transport-requests";
import AdminGuideConfirmations from "@/components/guide-confirmations/admin-guide-confirmations";

export default function TransportRequestsPage() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <CarOutlined />
        <h2 style={{ margin: 0 }}>External confirmations</h2>
      </div>
      <p style={{ marginTop: 0, color: "var(--ant-color-text-secondary)" }}>
        Manage third-party transport requests and freelance tour guide confirmations in one place.
      </p>
      <Tabs
        defaultActiveKey="providers"
        items={[
          {
            key: "providers",
            label: "Transportation providers",
            children: <AdminTransportRequests />,
          },
          {
            key: "guides",
            label: (
              <span>
                <TeamOutlined /> Freelance guides
              </span>
            ),
            children: <AdminGuideConfirmations />,
          },
        ]}
      />
    </div>
  );
}
