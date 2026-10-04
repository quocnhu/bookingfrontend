"use client";

import { useEffect, useRef, useState } from "react";
import { Tooltip } from "antd";
import type { CSSProperties, ReactNode } from "react";

/**
 * Shared overflow marquee: text that is too long for its box scrolls
 * left↔right on a loop (global `board-marquee-x` keyframes in
 * globals.css); short text renders statically. Uses ResizeObserver so it
 * reacts to layout changes. Pass `tip` to also show the full text on
 * hover — every truncated name in the app should use this.
 */
export function useElementMetrics<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [metrics, setMetrics] = useState({ over: false, shift: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const over = el.scrollWidth > el.clientWidth + 1;
      setMetrics({ over, shift: over ? el.scrollWidth - el.clientWidth : 0 });
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, ...metrics };
}

export default function MarqueeText({
  children,
  strong = false,
  fill = false,
  style,
  tip,
}: {
  children: ReactNode;
  strong?: boolean;
  fill?: boolean;
  style?: CSSProperties;
  tip?: string;
}) {
  const { ref, over, shift } = useElementMetrics<HTMLSpanElement>();
  const base: CSSProperties = {
    fontWeight: strong ? 600 : undefined,
    display: "inline-block",
    maxWidth: "100%",
    minWidth: 0,
    overflow: "hidden",
    whiteSpace: "nowrap",
    ...(fill ? { flex: 1 } : {}),
    ...style,
  };
  const body = (
    <span ref={ref} style={base}>
      <span
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          willChange: "transform",
          animation: over
            ? `board-marquee-x ${Math.max(5, shift / 30)}s linear infinite`
            : undefined,
          ["--shift" as string]: `-${shift}px`,
        }}
      >
        {children}
      </span>
    </span>
  );
  if (tip && over) return <Tooltip title={tip}>{body}</Tooltip>;
  return body;
}
