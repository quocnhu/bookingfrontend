"use client";

import AccountingShell from "@/components/accounting/shell";
import { QueueTab } from "@/components/accounting/shared";
import { useApp } from "@/lib/app-context";

export default function AccountingQueuePage() {
  const { hasPermission } = useApp();
  return (
    <AccountingShell
      title="Verification queue"
      description="Review the money sheet, then decide: Verify to lock the money, or Return it so the submitter can check it again."
    >
      {({ categories }) => (
        <QueueTab
          canVerify={hasPermission("accounting.money.verify")}
          canReject={hasPermission("accounting.money.reject")}
          canSettle={hasPermission("accounting.settlement.create")}
          categories={categories}
        />
      )}
    </AccountingShell>
  );
}
