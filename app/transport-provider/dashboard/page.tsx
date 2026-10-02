"use client";

import RoleDashboard from "@/components/role-dashboard";

export default function ProviderDashboardPage() {
  return (
    <RoleDashboard
      mode="provider"
      title="Fleet Dashboard"
      subtitle="Your upcoming fleet trips at a glance."
      tripsHref="/transport-provider/my-trips"
      accent="#8B5CF6"
    />
  );
}
