"use client";

import AccountingShell from "@/components/accounting/shell";
import { HistoryTab } from "@/components/accounting/shared";
import { useApp } from "@/lib/app-context";

export default function AccountingHistoryPage() {
  const { hasPermission, user } = useApp();
  return (
    <AccountingShell
      title="Payment history"
      description=""
    >
      {({ people }) => (
        <HistoryTab
          people={people}
          canVoid={hasPermission("accounting.period.void")}
          canMarkPaid={
            user?.role === "ADMIN" || hasPermission("accounting.period.export")
          }
        />
      )}
    </AccountingShell>
  );
}
