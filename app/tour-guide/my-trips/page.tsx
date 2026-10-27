"use client";

import { CarOutlined } from "@ant-design/icons";
import RoleTripsPage from "@/components/role-trips";

export default function TourGuideMyTripsPage() {
  return (
    <RoleTripsPage
      mode="guide"
      title="My Trips"
      titleIcon={<CarOutlined />}
      subtitle="Tours assigned to you by admin or operations — open a trip to see crew, pickups and the route."
    />
  );
}