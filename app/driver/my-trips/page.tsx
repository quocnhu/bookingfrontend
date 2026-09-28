"use client";

import { CarOutlined } from "@ant-design/icons";
import RoleTripsPage from "@/components/role-trips";

export default function DriverMyTripsPage() {
  return (
    <RoleTripsPage
      mode="driver"
      title="My Trips"
      titleIcon={<CarOutlined />}
      subtitle="Your assigned pickups — filter by date range and tap “Where to go” for the route."
    />
  );
}