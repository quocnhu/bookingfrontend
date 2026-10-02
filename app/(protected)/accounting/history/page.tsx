"use client";

import AccountingShell from "@/components/accounting/shell";
import { HistoryTab } from "@/components/accounting/shared";
import { useApp } from "@/lib/app-context";

export default function AccountingHistoryPage() {
  const { hasPermission } = useApp();
  return (
    <AccountingShell
      title="Payment history"
      description="Who was paid, when, who issued the period, and how the period was frozen."
    >
      {({ people }) => (
        <HistoryTab
          people={people}
          canVoid={hasPermission("accounting.period.void")}
        />
      )}
    </AccountingShell>
  );
}
