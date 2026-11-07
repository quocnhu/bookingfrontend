"use client";

import { CarOutlined } from "@ant-design/icons";
import AdminTransportRequests from "@/components/transport-requests/admin-transport-requests";

export default function TransportRequestsPage() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <CarOutlined />
        <h2 style={{ margin: 0 }}>Transport requests</h2>
      </div>
      <p style={{ marginTop: 0, color: "var(--ant-color-text-secondary)" }}>
        Ask third-party transportation providers to assign a driver and vehicle for each bus.
      </p>
      <AdminTransportRequests />
    </div>
  );
}
