"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Shot } from "@/components/guide/Shot";
import shots from "@/lib/guideShots.json";
import { readTourSeen, writeTourSeen } from "@/lib/tourSeen";

export type TourStep = {
  id: string;
  shot: string;
  title: string;
  summary: string;
  routes: string[];
  added: string;
  link?: { href: string; label: string };
};

export type TourTrack = {
  id: string;
  label: string;
  audience: string;
  roles: string[];
  steps: TourStep[];
};

const SIZES = shots as Record<string, { w: number; h: number }>;

function niceDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function TourClient({
  tracks,
  updated,
  initialTrack,
  initialStep,
  vars,
}: {
  tracks: TourTrack[];
  updated: string;
  initialTrack: string;
  initialStep: number;
  vars: Record<string, string | number>;
}) {
  const [trackId, setTrackId] = useState(initialTrack);
  const track = tracks.find((t) => t.id === trackId) ?? tracks[0];
  const [step, setStep] = useState(Math.min(initialStep, track.steps.length - 1));
  // undefined until read; null = this browser has never opened the tour.
  const [seen, setSeen] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setSeen(readTourSeen());
    writeTourSeen(updated);
  }, [updated]);

  const current = track.steps[Math.min(step, track.steps.length - 1)];
  const trackIndex = tracks.findIndex((t) => t.id === track.id);
  const nextTrack = tracks[trackIndex + 1] ?? null;
  const isLast = step >= track.steps.length - 1;
  const isNew = useCallback((s: TourStep) => Boolean(seen && s.added > seen), [seen]);

  const go = useCallback(
    (n: number) => {
      setStep(Math.max(0, Math.min(track.steps.length - 1, n)));
      document.getElementById("tour-step")?.scrollIntoView({ block: "start", behavior: "smooth" });
    },
    [track.steps.length]
  );

  function pickTrack(id: string) {
    setTrackId(id);
    setStep(0);
  }

  // Keep the address shareable: /dashboard/tour?track=vault&step=3
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("track", track.id);
      url.searchParams.set("step", String(step + 1));
      window.history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
  }, [track.id, step]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step]);

  const size = SIZES[current.shot];
  const split = size ? size.w / size.h < 1.25 : false;
  const newCounts = useMemo(
    () => Object.fromEntries(tracks.map((t) => [t.id, t.steps.filter(isNew).length])),
    [tracks, isNew]
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ color: "var(--amber)", fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
          Getting started
        </div>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>A tour of every screen</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 720, lineHeight: 1.6 }}>
          Real screenshots of UnyBase, one step at a time. Use the arrow keys or the buttons to move through it.
          Updated {niceDate(updated)}.{" "}
          <Link href="/guide" style={{ color: "var(--sky)" }}>
            Prefer to read it all on one page? Open the full guide →
          </Link>{" "}
          <Link href="/dashboard/whats-new" style={{ color: "var(--sky)" }}>
            See what&apos;s new →
          </Link>
        </p>
      </div>

      {tracks.length > 1 ? (
        <div role="tablist" aria-label="Tour tracks" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {tracks.map((t) => {
            const on = t.id === track.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pickTrack(t.id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  fontSize: "0.85rem",
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer",
                  color: on ? "var(--amber-ink)" : "var(--paper-dim)",
                  background: on ? "var(--amber)" : "transparent",
                  border: `1px solid ${on ? "var(--amber)" : "var(--line)"}`,
                }}
              >
                {t.label} <span style={{ opacity: 0.75 }}>· {t.steps.length}</span>
                {newCounts[t.id] ? (
                  <span style={{ marginLeft: 6, fontSize: "0.72rem", fontWeight: 600, color: on ? "var(--amber-ink)" : "var(--amber)" }}>
                    {newCounts[t.id]} new
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <p style={{ margin: "0 0 20px", color: "var(--muted)", fontSize: "0.85rem" }}>{track.audience}</p>

      <section id="tour-step" className="card" aria-live="polite" style={{ padding: "20px 22px", scrollMarginTop: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--paper-dim)", whiteSpace: "nowrap" }}>
            Step {step + 1} of {track.steps.length}
          </span>
          <div
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={track.steps.length}
            aria-valuenow={step + 1}
            aria-label="Tour progress"
            style={{ flex: "1 1 160px", height: 6, borderRadius: 999, background: "var(--line)", overflow: "hidden" }}
          >
            <div style={{ width: `${((step + 1) / track.steps.length) * 100}%`, height: "100%", background: "var(--amber)", transition: "width .2s" }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: "1 1 420px" }}>
            <h2 style={{ margin: "0 0 6px", fontSize: "1.3rem", fontWeight: 600 }}>
              {current.title}
              {isNew(current) ? (
                <span
                  style={{
                    marginLeft: 10,
                    verticalAlign: "middle",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    color: "var(--amber-ink)",
                    background: "var(--amber)",
                  }}
                >
                  New
                </span>
              ) : null}
            </h2>
            <p style={{ margin: 0, color: "var(--paper-dim)", lineHeight: 1.6, maxWidth: 760 }}>{current.summary}</p>
          </div>
          {current.link ? (
            <Link href={current.link.href} className="btn btn-ghost" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
              {current.link.label} →
            </Link>
          ) : null}
        </div>

        <Shot key={current.id} id={current.shot} split={split} wideLegend={!split} vars={vars} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={() => go(step - 1)} disabled={step === 0}>
            ← Back
          </button>

          <nav aria-label="Steps in this track" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {track.steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Step ${i + 1}: ${s.title}`}
                aria-current={i === step ? "step" : undefined}
                title={s.title}
                style={{
                  width: 10,
                  height: 10,
                  padding: 0,
                  borderRadius: 999,
                  cursor: "pointer",
                  border: `1px solid ${isNew(s) ? "var(--amber)" : "var(--line)"}`,
                  background: i === step ? "var(--amber)" : i < step ? "var(--paper-dim)" : "transparent",
                }}
              />
            ))}
          </nav>

          {!isLast ? (
            <button type="button" className="btn btn-amber" onClick={() => go(step + 1)}>
              Next →
            </button>
          ) : nextTrack ? (
            <button type="button" className="btn btn-amber" onClick={() => pickTrack(nextTrack.id)}>
              Next: {nextTrack.label} →
            </button>
          ) : (
            <Link href="/dashboard" className="btn btn-amber">
              Done, go to Overview
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
