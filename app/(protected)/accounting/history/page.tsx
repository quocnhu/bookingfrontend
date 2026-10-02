"use client";

import AccountingShell from "@/components/accounting/shell";
import { HistoryTab } from "@/components/accounting/shared";

export default function AccountingHistoryPage() {
  return (
    <AccountingShell
      title="Payment history"
      description="Who was paid, when, who issued the period, and how the period was frozen."
    >
      {({ people }) => <HistoryTab people={people} />}
    </AccountingShell>
  );
}
