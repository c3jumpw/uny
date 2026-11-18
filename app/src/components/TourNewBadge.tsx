"use client";

import { useEffect, useState } from "react";
import tour from "@/lib/tour.json";
import { readTourSeen } from "@/lib/tourSeen";

// "Start here" for someone who has never opened the tour in this
// browser, "Updated" when steps were added since they last did.
export function TourNewBadge() {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const seen = readTourSeen();
    if (!seen) {
      setLabel("Start here");
      return;
    }
    const fresh = tour.tracks.flatMap((t) => t.steps).filter((s) => s.added > seen).length;
    if (fresh > 0 || tour.updated > seen) setLabel(fresh > 0 ? `${fresh} new step${fresh === 1 ? "" : "s"}` : "Updated");
  }, []);
  if (!label) return null;
  return (
    <span
      style={{
        marginLeft: 8,
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: 999,
        color: "var(--amber-ink)",
        background: "var(--amber)",
        verticalAlign: "middle",
      }}
    >
      {label}
    </span>
  );
}
