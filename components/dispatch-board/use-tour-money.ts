"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { message } from "@/lib/antd-message";

export interface MoneyRow {
  id: string;
  amount: number;
  bookingId?: string | null;
  note?: string | null;
  createdAt: string;
  createdById?: string | null;
  createdByName?: string | null;
  reversesId?: string | null;
  category?: { id: string; code: string; name: string; flowType: string } | null;
}

export interface MoneyCategory {
  id: string;
  code: string;
  name: string;
  flowType: string;
}

export interface TourMoney {
  rows: MoneyRow[];
  categories: MoneyCategory[];
  collected: number;
  paid: number;
  net: number;
  locked: boolean;
  lockedBy: string | null;
}

/** Collect/Refund amounts recorded per booking. */
export type CashByBooking = Map<string, { collected: number; paid: number }>;

const sumByBooking = (rows: MoneyRow[]): CashByBooking => {
  const map: CashByBooking = new Map();
  for (const row of rows) {
    if (!row.bookingId) continue;
    const cur = map.get(row.bookingId) ?? { collected: 0, paid: 0 };
    if (row.category?.flowType === "COLLECT_MONEY") cur.collected += row.amount;
    else cur.paid += row.amount;
    map.set(row.bookingId, cur);
  }
  return map;
};

/**
 * A trip's money sheet + the add/delete entry actions.
 *
 * Shared by the Dispatch Board (office) and the guide portal so both always
 * see the same figure. Every entry goes through /assignments/:id/money, so
 * this is the single source of truth - the printed manifest reads this same
 * endpoint.
 */
export function useTourMoney(assignmentId: string | null | undefined) {
  const [money, setMoney] = useState<TourMoney | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!assignmentId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/assignments/${assignmentId}/money`);
      setMoney(data as TourMoney);
    } catch (e) {
      message.error(getErrorMessage(e, "Could not load the trip's money sheet"));
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const perBooking = useMemo(() => sumByBooking(money?.rows ?? []), [money]);

  /** Record a Collect/Refund entry. `direction` decides the category's flowType. */
  const addMoney = useCallback(
    async (input: {
      direction: "COLLECT_MONEY" | "PAY_MONEY";
      amount: number;
      categoryId?: string;
      note?: string;
      bookingId?: string;
    }) => {
      if (!assignmentId) throw new Error("No assignment");
      if (!input.amount || input.amount <= 0) {
        message.warning("Enter an amount greater than 0");
        return false;
      }
      if (!input.categoryId) {
        message.warning("Choose a Collect/Expense category");
        return false;
      }
      try {
        await api.post(`/assignments/${assignmentId}/money`, {
          amount: input.amount,
          categoryId: input.categoryId,
          note: input.note?.trim() || undefined,
          bookingId: input.bookingId,
        });
        message.success("Passenger money entry recorded");
        await load();
        return true;
      } catch (e) {
        message.error(getErrorMessage(e, "Could not record the money entry"));
        return false;
      }
    },
    [assignmentId, load],
  );

  /** Delete a row permanently (only while the money is not locked). The backend blocks deleting someone else's row. */
  const deleteMoney = useCallback(
    async (settlementId: string) => {
      if (!assignmentId) return false;
      try {
        await api.delete(`/assignments/${assignmentId}/money/${settlementId}`);
        message.success("Entry deleted");
        await load();
        return true;
      } catch (e) {
        message.error(getErrorMessage(e, "Could not delete the entry"));
        return false;
      }
    },
    [assignmentId, load],
  );

  return { money, loading, load, perBooking, addMoney, deleteMoney };
}
