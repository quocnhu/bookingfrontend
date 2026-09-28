"use client";

import React from "react";
import { App } from "antd";
import type { MessageInstance } from "antd/es/message/interface";

let messageApi: MessageInstance | null = null;

/**
 * Mounts inside antd's <App /> and publishes the theme-aware message instance
 * at module scope, so existing `message.success(...)` call sites keep working
 * without the static message API (which cannot consume ConfigProvider theme).
 */
export default function AntdMessageBridge() {
  const { message } = App.useApp();
  messageApi = message;
  return null;
}

function handler(method: keyof MessageInstance) {
  return (...args: unknown[]) => {
    if (!messageApi) return undefined;
    return (messageApi[method] as (...a: unknown[]) => unknown)(...args);
  };
}

export const message = {
  info: handler("info"),
  success: handler("success"),
  error: handler("error"),
  warning: handler("warning"),
  loading: handler("loading"),
  open: handler("open"),
  destroy: handler("destroy"),
} as MessageInstance;