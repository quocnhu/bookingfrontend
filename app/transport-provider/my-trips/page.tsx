"use client";

import { TruckOutlined } from "@ant-design/icons";
import RoleTripsPage from "@/components/role-trips";

export default function TransportProviderMyTripsPage() {
  return (
    <RoleTripsPage
      mode="provider"
      title="Fleet Trips"
      titleIcon={<TruckOutlined />}
      subtitle="All trips for your buses — see assigned vehicles, drivers & pickups, filtered by date."
    />
  );
}