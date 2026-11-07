"use client";

import { CarOutlined } from "@ant-design/icons";
import ProviderTransportRequests from "@/components/transport-requests/provider-transport-requests";

export default function ProviderRequestsPage() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <CarOutlined />
        <h2 style={{ margin: 0 }}>Transport requests</h2>
      </div>
      <p style={{ marginTop: 0, color: "var(--ant-color-text-secondary)" }}>
        Assign a driver and vehicle for each requested trip.
      </p>
      <ProviderTransportRequests />
    </div>
  );
}
