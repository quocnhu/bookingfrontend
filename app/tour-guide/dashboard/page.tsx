"use client";

import RoleDashboard from "@/components/role-dashboard";

export default function GuideDashboardPage() {
  return (
    <RoleDashboard
      mode="guide"
      title="Tour Guide Dashboard"
      subtitle="Your upcoming trips and pending reports at a glance."
      tripsHref="/tour-guide/my-trips"
      accent="#10B981"
    />
  );
}
