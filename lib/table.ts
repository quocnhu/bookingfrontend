import type { ColumnsType } from "antd/es/table";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export function paginationChange(
  setPage: (p: number) => void,
  setPageSize: (s: number) => void,
  pageSize: number,
) {
  return (p: number, size: number) => {
    if (size !== pageSize) {
      setPageSize(size);
      setPage(1);
    } else {
      setPage(p);
    }
  };
}

export function centerColumns<T>(columns: ColumnsType<T>): ColumnsType<T> {
  return columns.map((col) => {
    if (!col || typeof col !== "object" || !("align" in col)) {
      return { ...(col as any), align: "center" as const };
    }
    return col;
  });
}

export function indexColumn<T>(page: number, pageSize: number) {
  return {
    title: "#",
    key: "__index",
    width: 64,
    align: "center" as const,
    render: (_: any, __: any, index: number) => (page - 1) * pageSize + index + 1,
  };
}

export function withTotal<T extends object>(pagination: T, total?: number) {
  return {
    ...pagination,
    showTotal: (t: number) => `Total: ${t}`,
  };
}
