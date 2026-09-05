"use client";

import { useLayoutEffect, useState } from "react";

export interface UseFillHeightOptions {
  rootSelector: string;
  activeTab: string;
  paginated?: boolean;
  deps?: unknown[];
}

export function useFillHeight({ rootSelector, activeTab, paginated = true, deps = [] }: UseFillHeightOptions) {
  const [tableHeight, setTableHeight] = useState(400);

  useLayoutEffect(() => {
    let raf = 0;
    const getVisibleTable = () => {
      const tables = Array.from(
        document.querySelectorAll<HTMLElement>(`${rootSelector} .ant-table`),
      );
      return tables.find((el) => el.getBoundingClientRect().height > 0) ?? null;
    };
    const compute = () => {
      raf = 0;
      const table = getVisibleTable();
      if (!table) return;
      const rect = table.getBoundingClientRect();
      const header = table.querySelector<HTMLElement>(".ant-table-thead");
      const headerH = header ? header.getBoundingClientRect().height : 40;
      const cardBody = table.closest<HTMLElement>(".ant-card-body");
      const content = table.closest<HTMLElement>(".ant-layout-content");
      const contentPad = content
        ? (parseFloat(getComputedStyle(content).paddingBottom) || 0)
        : 0;
      const cardB = cardBody ? cardBody.getBoundingClientRect().bottom : rect.bottom;
      const below = Math.max(cardB - rect.bottom, paginated ? 40 : 0);
      const contentB = (content ?? document.body).getBoundingClientRect().bottom;
      const target = Math.min(contentB, window.innerHeight) - contentPad;
      const next = Math.max(120, Math.floor(target - rect.top - headerH - below));
      setTableHeight((prev) => (Math.abs(prev - next) < 4 ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener("load", schedule);
    window.addEventListener("resize", schedule);
    document.fonts?.ready?.then(schedule).catch(() => {});
    const ro = new ResizeObserver(() => schedule());
    const rootEl = document.querySelector(rootSelector);
    if (rootEl) ro.observe(rootEl);
    if (document.body) ro.observe(document.body);
    const retry = window.setInterval(() => {
      const table = getVisibleTable();
      const footer =
        table?.querySelector(".ant-table-pagination") ??
        table?.parentElement?.querySelector(".ant-table-pagination");
      if (!table || (paginated && !footer)) return;
      window.clearInterval(retry);
      schedule();
    }, 80);
    schedule();
    return () => {
      window.clearInterval(retry);
      window.removeEventListener("load", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootSelector, activeTab, paginated, ...deps]);

  return tableHeight;
}