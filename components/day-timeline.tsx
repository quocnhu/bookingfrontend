"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  children: React.ReactNode;
}

/**
 * Vertical timeline for the daily itinerary.
 * Draws a connecting line from the first day down to the last day
 * and pops each knot when the block scrolls into view.
 */
export default function DayTimeline({ children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`tour-timeline ${seen ? "timeline-seen" : ""}`}>
      {children}
    </div>
  );
}
