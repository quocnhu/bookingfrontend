"use client";

import AccountingShell from "@/components/accounting/shell";
import { PeriodTab } from "@/components/accounting/shared";

export default function AccountingPeriodPage() {
  return (
    <AccountingShell
      title="Period check & export"
      description="Choose a guide or driver and a date range, preview the total amounts and who pays whom, then issue the period."
    >
      {({ people, reloadPeople }) => (
        <PeriodTab
          people={people}
          canExport={true}
          onExported={reloadPeople}
        />
      )}
    </AccountingShell>
  );
}
