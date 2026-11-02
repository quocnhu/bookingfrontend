"use client";

import AccountingShell from "@/components/accounting/shell";
import BookingPaymentsTab from "@/components/accounting/booking-payments-tab";

export default function AccountingPaymentsPage() {
  return (
    <AccountingShell
      title="Customer payments"
      description="Check website/PayPal booking payments here. Guide and driver money stays in Verification queue and Payment history."
      hideHeader
    >
      {() => <BookingPaymentsTab />}
    </AccountingShell>
  );
}
