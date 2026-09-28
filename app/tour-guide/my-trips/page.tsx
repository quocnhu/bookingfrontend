"use client";

import { CarOutlined } from "@ant-design/icons";
import RoleTripsPage from "@/components/role-trips";

export default function TourGuideMyTripsPage() {
  return (
    <RoleTripsPage
      mode="guide"
      title="My Trips"
      titleIcon={<CarOutlined />}
      subtitle="Your tours with itinerary & pickups — filter by date range and open the route in Google Maps."
    />
  );
}