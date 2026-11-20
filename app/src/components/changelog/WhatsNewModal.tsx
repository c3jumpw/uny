"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ChangeEntry } from "@/lib/changelog";
import { TypeBadge, TYPE_TONE } from "./ChangelogView";
import { TYPE_LABELS, type ChangeType } from "@/lib/changelog";
import s from "./changelog.module.css";
import g from "@/app/guide/guide.module.css";

const SESSION_KEY = "unybase-whatsnew-dismissed";

function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// The popup someone sees the first time they open UnyBase after changes
// that apply to their role. The server decides what's unseen (see
// unseenEntries in src/lib/changelog.ts); closing it records that they
// have seen everything up to the latest change, on their account, so it
// doesn't come back on another device.
export function WhatsNewModal({
  entries,
  total,
  latestId,
  seeAllHref,
  demo = false,
}: {
  /** Newest first, at most a handful. */
  entries: ChangeEntry[];
  /** How many unseen changes there are in all. */
  total: number;
  latestId: string | null;
  seeAllHref: string;
  /** Screenshot mode: always open, never records anything. */
  demo?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(demo);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (demo || entries.length === 0) return;
    // The What's new page already shows everything and records it.
    if (pathname.startsWith("/dashboard/whats-new") || pathname.startsWith("/admin/changelog")) return;
    try {
      if (sessionStorage.getItem(SESSION_KEY) === latestId) return;
    } catch {
      /* storage blocked: still show it */
    }
    setOpen(true);
  }, [demo, entries.length, latestId, pathname]);

  const close = useCallback(() => {
    setOpen(false);
    if (demo) return;
    try {
      sessionStorage.setItem(SESSION_KEY, latestId ?? "");
    } catch {
      /* ignore */
    }
    fetch("/api/changelog/seen", { method: "POST" }).catch(() => undefined);
  }, [demo, latestId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setI((n) => Math.min(entries.length - 1, n + 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, entries.length]);

  if (!open || entries.length === 0) return null;
  const e = entries[Math.min(i, entries.length - 1)];
  const last = i >= entries.length - 1;
  const more = total - entries.length;

  return (
    <div className={s.overlay} onClick={close}>
      <div
        className={s.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsnew-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className={s.modalHead}>
          <div className={s.kicker}>What&apos;s new</div>
          <h2 id="whatsnew-title" className={s.modalTitle}>
            {total === 1 ? "One update since your last visit" : `${total} updates since your last visit`}
          </h2>
          <p className={s.modalSub}>Here&apos;s what changed in UnyBase for you.</p>
        </div>

        <div className={s.modalBody} aria-live="polite">
          {e.shot ? (
            <div className={s.thumb}>
              <img className={g.imgDark} src={`/guide/dark/${e.shot}.webp`} alt="" />
              <img className={g.imgLight} src={`/guide/light/${e.shot}.webp`} alt="" />
            </div>
          ) : (
            <div className={s.art} style={{ ["--tone" as string]: TYPE_TONE[e.type] }} aria-hidden="true">
              <span className={s.artIcon}>
                <TypeIcon type={e.type} />
              </span>
              <span className={s.artText}>
                <strong>{e.area}</strong>
                {TYPE_LABELS[e.type]} in UnyBase
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <TypeBadge type={e.type} />
            <span className={s.chip}>{e.area}</span>
            <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{longDate(e.date)}</span>
          </div>
          <h3 className={s.entryTitle}>{e.title}</h3>
          <p className={s.summary}>{e.summary}</p>
          {e.details?.length ? (
            <ul className={s.details}>
              {e.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
          {e.link ? (
            <div style={{ marginTop: 14 }}>
              <Link href={e.link.href} className="btn btn-ghost" style={{ padding: "7px 14px" }} onClick={close}>
                {e.link.label} →
              </Link>
            </div>
          ) : null}
        </div>

        <div className={s.modalFoot}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.length > 1 ? (
              <nav className={s.dots} aria-label="Updates">
                {entries.map((x, n) => (
                  <button
                    key={x.id}
                    type="button"
                    aria-label={`Update ${n + 1}: ${x.title}`}
                    aria-current={n === i ? "step" : undefined}
                    onClick={() => setI(n)}
                  />
                ))}
              </nav>
            ) : null}
            <Link href={seeAllHref} className={s.seeAll} onClick={close}>
              {more > 0 ? `See all ${total} changes →` : "See the full change log →"}
            </Link>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {i > 0 ? (
              <button type="button" className="btn btn-ghost" onClick={() => setI(i - 1)}>
                Back
              </button>
            ) : null}
            {last ? (
              <button type="button" className="btn btn-amber" onClick={close} autoFocus>
                Got it
              </button>
            ) : (
              <button type="button" className="btn btn-amber" onClick={() => setI(i + 1)} autoFocus>
                Next ({i + 1} of {entries.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple line icons for the art panel, drawn in the change's colour.
function TypeIcon({ type }: { type: ChangeType }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "improved") {
    return (
      <svg {...common}>
        <path d="M4 17l6-6 4 4 6-7" />
        <path d="M15 8h5v5" />
      </svg>
    );
  }
  if (type === "fixed") {
    return (
      <svg {...common}>
        <path d="M14.5 5.5a4 4 0 0 0-5.3 5.3L4 16l4 4 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.6-.9-.9-2.6z" />
      </svg>
    );
  }
  if (type === "security") {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }
  if (type === "removed") {
    return (
      <svg {...common}>
        <path d="M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M11 3l1.9 5.6L18.5 10.5l-5.6 1.9L11 18l-1.9-5.6L3.5 10.5l5.6-1.9z" />
      <path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}
