"use client";

import { useState } from "react";
import { Button } from "antd";
import { TableOutlined } from "@ant-design/icons";
import AccountingShell from "@/components/accounting/shell";
import { QueueTab } from "@/components/accounting/shared";
import DispatchBoard from "@/components/dispatch-board";
import { useApp } from "@/lib/app-context";

export default function AccountingQueuePage() {
  const { hasPermission } = useApp();
  const [boardOpen, setBoardOpen] = useState(false);

  return (
    <AccountingShell
      title="Verification queue"
      description="Review the money sheet, then decide: Verify to lock the money, or Return it so the submitter can check it again."
    >
      {({ categories }) => (
        <>
          <Button
            icon={<TableOutlined />}
            onClick={() => setBoardOpen(true)}
            style={{ marginBottom: 12 }}
          >
            View dispatch board (read-only)
          </Button>
          <QueueTab
            canVerify={hasPermission("accounting.money.verify")}
            canReject={hasPermission("accounting.money.reject")}
            canSettle={hasPermission("accounting.settlement.create")}
            canDelete={hasPermission("accounting.settlement.delete")}
            categories={categories}
          />
          <DispatchBoard
            open={boardOpen}
            onClose={() => setBoardOpen(false)}
            canUpdateAssignment={false}
          />
        </>
      )}
    </AccountingShell>
  );
}
