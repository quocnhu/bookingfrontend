"use client";

import { useState } from "react";
import { Button, Input, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";

interface FilterBarProps {
  onSearch: (value: string) => void;
  onReset: () => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export default function FilterBar({ onSearch, onReset, searchPlaceholder, children }: FilterBarProps) {
  const [value, setValue] = useState("");

  return (
    <Space size={8} wrap>
      <Input.Search
        allowClear
        size="small"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onSearch={onSearch}
        placeholder={searchPlaceholder ?? "Search..."}
        style={{ width: 200 }}
        enterButton={<SearchOutlined />}
      />
      {children}
      <Button
        size="small"
        onClick={() => {
          setValue("");
          onReset();
        }}
      >
        Reset
      </Button>
    </Space>
  );
}
