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
  hoverOnly = false,
}: {
  children: ReactNode;
  strong?: boolean;
  fill?: boolean;
  style?: CSSProperties;
  tip?: string;
  /**
   * hoverOnly: no motion until the pointer is over the text (sidebar
   * menu labels). Default false = scroll whenever overflowing (board,
   * dropdowns). Detection is identical — ResizeObserver + shift.
   */
  hoverOnly?: boolean;
}) {
  const { ref, over, shift } = useElementMetrics<HTMLSpanElement>();
  const dur = Math.max(5, shift / 30);
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
  const inner: CSSProperties = {
    display: "inline-block",
    whiteSpace: "nowrap",
    willChange: "transform",
    ...(!hoverOnly && over
      ? {
          animation: `board-marquee-x ${dur}s linear infinite`,
          ["--shift" as string]: `-${shift}px`,
        }
      : {}),
    ...(hoverOnly
      ? { ["--shift" as string]: `-${shift}px` }
      : {}),
  };
  const body = (
    <span ref={ref} style={base} className={hoverOnly && over ? "mq-hover" : undefined}>
      {hoverOnly && over && (
        <style>{`.mq-hover:hover > span { animation: board-marquee-x ${dur}s linear infinite; }`}</style>
      )}
      <span style={inner}>{children}</span>
    </span>
  );
  if (tip && over) return <Tooltip title={tip}>{body}</Tooltip>;
  return body;
}
