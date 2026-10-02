"use client";

import RoleDashboard from "@/components/role-dashboard";

export default function DriverDashboardPage() {
  return (
    <RoleDashboard
      mode="driver"
      title="Driver Dashboard"
      subtitle="Your upcoming trips at a glance."
      tripsHref="/driver/my-trips"
      accent="#06B6D4"
    />
  );
}
