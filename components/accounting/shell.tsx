"use client";

import { useEffect, useState } from "react";
import { Flex, Tag, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import { api } from "@/lib/api";
import { useApp } from "@/lib/app-context";
import type { Category, Person } from "./shared";

/**
 * Shared shell for the 3 Accounting Room sub-pages. Each sidebar sub-tab reuses
 * this shell, so the header + people list are loaded only once.
 */
export default function AccountingShell({
  title,
  description,
  children,
  hideHeader,
}: {
  title: string;
  description: string;
  children: (ctx: {
    people: Person[];
    categories: Category[];
    reloadPeople: () => Promise<void>;
  }) => React.ReactNode;
  hideHeader?: boolean;
}) {
  const { hasPermission, user } = useApp();
  const [people, setPeople] = useState<Person[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const reloadPeople = async () => {
    try {
      const { data } = await api.get("/accounting/people");
      // The API returns { groups, payees }; a flat array is accepted too so a
      // malformed/failed response doesn't break the UI.
      const list = Array.isArray(data) ? data : data?.payees;
      setPeople(Array.isArray(list) ? list : []);
    } catch {
      setPeople([]);
    }
  };

  useEffect(() => {
    reloadPeople();
    api
      .get("/accounting/categories")
      .then((r) => setCategories(r.data ?? []))
      .catch(() => setCategories([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const level = user?.role === "ADMIN"
    ? "Full access"
    : hasPermission("accounting.period.export")
      ? "Accounting"
      : hasPermission("accounting.money.verify")
        ? "Verification"
        : "View only";

  return (
    <div className="accounting-page">
      {!hideHeader && (
        <Flex justify="space-between" align="center" wrap gap={12} style={{ marginBottom: 16 }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>
              <SafetyCertificateOutlined /> {title}
            </Typography.Title>
            {description ? (
              <Typography.Text type="secondary">{description}</Typography.Text>
            ) : null}
          </div>
          <Tag>Permission: {level}</Tag>
        </Flex>
      )}
      {children({ people, categories, reloadPeople })}
    </div>
  );
}
