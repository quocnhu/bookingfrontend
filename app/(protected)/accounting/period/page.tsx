"use client";

import AccountingShell from "@/components/accounting/shell";
import { PeriodTab } from "@/components/accounting/shared";
import { useApp } from "@/lib/app-context";

export default function AccountingPeriodPage() {
  const { hasPermission } = useApp();
  return (
    <AccountingShell
      title="Period check & export"
      description="Choose a guide or driver and a date range, preview the total amounts and who pays whom, then issue the period."
      hideHeader
    >
      {({ people, reloadPeople }) => (
        <PeriodTab
          people={people}
          canExport={hasPermission("accounting.period.export")}
          onExported={reloadPeople}
        />
      )}
    </AccountingShell>
  );
}
