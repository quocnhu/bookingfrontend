'use client';

import { ConfigProvider, theme as antdTheme } from 'antd';
import { useApp } from './app-context';

const LIGHT = {
  colorPrimary: '#7C3AED',
  colorInfo: '#0891B2',
  colorSuccess: '#10B981',
  colorWarning: '#F59E0B',
  colorError: '#F43F5E',
  colorLink: '#7C3AED',
};

const DARK = {
  colorPrimary: '#22D3EE',
  colorInfo: '#3B82F6',
  colorSuccess: '#10B981',
  colorWarning: '#F59E0B',
  colorError: '#EF4444',
  colorLink: '#22D3EE',
  colorBgBase: '#0B0F1E',
  colorBgLayout: '#0B0F1E',
  colorBgContainer: '#131A2E',
  colorBgElevated: '#1A2340',
  colorBorder: 'rgba(34, 211, 238, 0.22)',
  colorBorderSecondary: 'rgba(34, 211, 238, 0.10)',
  colorText: 'rgba(255, 255, 255, 0.92)',
  colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
  colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
  colorSplit: 'rgba(34, 211, 238, 0.14)',
};

const ACCENT = '#22D3EE';

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useApp();
  const isDark = theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          ...(isDark ? DARK : LIGHT),
          borderRadius: 10,
          borderRadiusLG: 16,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Layout: {
            headerHeight: 56,
            siderBg: isDark ? '#0D1222' : '#E9E0FF',
            headerBg: isDark ? 'rgba(11, 15, 30, 0.72)' : 'rgba(255, 255, 255, 0.72)',
            headerPadding: '0 24px',
          },
          Menu: {
            itemBorderRadius: 10,
            itemMarginInline: 8,
            itemSelectedBg: 'rgba(124, 58, 237, 0.12)',
            itemSelectedColor: LIGHT.colorPrimary,
            itemHoverBg: 'rgba(124, 58, 237, 0.08)',
            darkItemBg: 'transparent',
            darkItemSelectedBg: ACCENT,
            darkItemSelectedColor: '#062A30',
            darkItemColor: 'rgba(255, 255, 255, 0.75)',
            darkItemHoverBg: 'rgba(34, 211, 238, 0.16)',
            darkItemHoverColor: ACCENT,
          },
          Card: {
            borderRadiusLG: 16,
          },
          Button: {
            borderRadius: 10,
            controlHeight: 38,
            primaryShadow: '0 4px 14px rgba(34, 211, 238, 0.25)',
          },
          Input: {
            activeBorderColor: ACCENT,
            hoverBorderColor: ACCENT,
            activeShadow: '0 0 0 3px rgba(34, 211, 238, 0.12)',
          },
          Select: {
            activeBorderColor: ACCENT,
            hoverBorderColor: ACCENT,
          },
          DatePicker: {
            activeBorderColor: ACCENT,
            hoverBorderColor: ACCENT,
          },
          Table: {
            headerBg: isDark ? 'rgba(34, 211, 238, 0.08)' : 'rgba(124, 58, 237, 0.06)',
            headerSplitColor: 'transparent',
            rowHoverBg: isDark ? 'rgba(34, 211, 238, 0.06)' : 'rgba(124, 58, 237, 0.03)',
            cellPaddingBlock: 14,
            headerBorderRadius: 12,
          },
          Statistic: {
            titleFontSize: 13,
            contentFontSize: 24,
          },
          Tabs: {
            itemColor: 'var(--ant-color-text-secondary)',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
