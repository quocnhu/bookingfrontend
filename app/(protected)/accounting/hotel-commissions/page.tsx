"use client";

import AccountingShell from "@/components/accounting/shell";
import HotelCommissionsTab from "@/components/accounting/hotel-commissions-tab";

export default function AccountingHotelCommissionsPage() {
  return (
    <AccountingShell
      title="Hotel commissions"
      description="Track earned hotel commissions after tours are completed and customer payment is paid. Mark commissions as paid when the company pays the hotel."
    >
      {() => <HotelCommissionsTab />}
    </AccountingShell>
  );
}