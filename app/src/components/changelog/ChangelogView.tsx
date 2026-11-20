"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AUDIENCE_LABELS,
  TYPE_LABELS,
  type Audience,
  type ChangeEntry,
  type ChangeType,
} from "@/lib/changelog";
import s from "./changelog.module.css";

export const TYPE_TONE: Record<ChangeType, string> = {
  new: "var(--sky)",
  improved: "var(--good)",
  fixed: "var(--amber)",
  security: "var(--danger)",
  removed: "var(--muted)",
};

const REPO = "https://github.com/c3jumpw/uny/commit/";

function monthLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function dayLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function longDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function TypeBadge({ type }: { type: ChangeType }) {
  return (
    <span className={s.badge} style={{ ["--tone" as string]: TYPE_TONE[type] }}>
      {TYPE_LABELS[type]}
    </span>
  );
}

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The change log as a timeline, grouped by month. Used by
// /admin/changelog (admin: audiences, commits, export) and by
// /dashboard/whats-new (everyone, filtered to their role).
export function ChangelogView({
  entries,
  freshIds = [],
  admin = false,
  markSeen = false,
}: {
  /** Oldest first, already filtered to what this viewer may see. */
  entries: ChangeEntry[];
  /** Entries that are new since the viewer last looked. */
  freshIds?: string[];
  admin?: boolean;
  /** Record that the viewer has now seen everything (What's new page). */
  markSeen?: boolean;
}) {
  const [order, setOrder] = useState<"newest" | "oldest">("newest");
  const [type, setType] = useState<ChangeType | "all">("all");
  const [audience, setAudience] = useState<Audience | "all">("all");
  const [q, setQ] = useState("");
  const fresh = useMemo(() => new Set(freshIds), [freshIds]);

  useEffect(() => {
    if (!markSeen) return;
    fetch("/api/changelog/seen", { method: "POST" }).catch(() => undefined);
  }, [markSeen]);

  const types = useMemo(() => Array.from(new Set(entries.map((e) => e.type))), [entries]);
  const audiences = useMemo(
    () => (Object.keys(AUDIENCE_LABELS) as Audience[]).filter((a) => entries.some((e) => e.audiences.includes(a))),
    [entries]
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = entries.filter(
      (e) =>
        (type === "all" || e.type === type) &&
        (audience === "all" || e.audiences.includes(audience)) &&
        (!needle ||
          [e.title, e.summary, e.area, ...(e.details ?? [])].some((t) => t.toLowerCase().includes(needle)))
    );
    return order === "newest" ? [...list].reverse() : list;
  }, [entries, type, audience, q, order]);

  const months: Array<{ label: string; items: ChangeEntry[] }> = [];
  for (const e of shown) {
    const label = monthLabel(e.date);
    const last = months.at(-1);
    if (last && last.label === label) last.items.push(e);
    else months.push({ label, items: [e] });
  }

  function exportJson() {
    download("unybase-changelog.json", JSON.stringify(shown, null, 2) + "\n", "application/json");
  }
  function exportCsv() {
    const head = ["date", "type", "area", "audiences", "title", "summary", "details", "link", "commits"];
    const rows = [...shown]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((e) =>
        [
          e.date,
          e.type,
          e.area,
          e.audiences.join(" "),
          e.title,
          e.summary,
          (e.details ?? []).join(" | "),
          e.link?.href ?? "",
          (e.commits ?? []).join(" "),
        ]
          .map(csvCell)
          .join(",")
      );
    download("unybase-changelog.csv", [head.join(","), ...rows].join("\n") + "\n", "text/csv");
  }

  const first = entries[0]?.date;
  const last = entries.at(-1)?.date;

  return (
    <div className="ui-inputs">
      <div className={s.controls}>
        <input
          className={s.search}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search changes"
          aria-label="Search changes"
        />
        <div className={s.seg} role="group" aria-label="Type of change">
          <button type="button" aria-pressed={type === "all"} onClick={() => setType("all")}>
            All
          </button>
          {(Object.keys(TYPE_LABELS) as ChangeType[])
            .filter((t) => types.includes(t))
            .map((t) => (
              <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>
                {TYPE_LABELS[t]}
              </button>
            ))}
        </div>
        {admin ? (
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience | "all")} aria-label="Who it affects">
            <option value="all">Everyone it affects</option>
            {audiences.map((a) => (
              <option key={a} value={a}>
                {AUDIENCE_LABELS[a]}
              </option>
            ))}
          </select>
        ) : null}
        <div className={s.seg} role="group" aria-label="Order">
          <button type="button" aria-pressed={order === "newest"} onClick={() => setOrder("newest")}>
            Newest first
          </button>
          <button type="button" aria-pressed={order === "oldest"} onClick={() => setOrder("oldest")}>
            Oldest first
          </button>
        </div>
        {admin ? (
          <>
            <button type="button" className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={exportCsv}>
              Export CSV
            </button>
            <button type="button" className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: "0.8rem" }} onClick={exportJson}>
              Export JSON
            </button>
          </>
        ) : null}
      </div>
      <p className={s.summaryLine}>
        {shown.length === entries.length
          ? `${entries.length} change${entries.length === 1 ? "" : "s"}`
          : `${shown.length} of ${entries.length} changes`}
        {first && last ? ` · ${longDate(first)} to ${longDate(last)}` : ""}
        {fresh.size ? ` · ${fresh.size} new since your last visit` : ""}
      </p>

      {months.length === 0 ? (
        <div className={`card ${s.empty}`}>No changes match.</div>
      ) : (
        months.map((m) => (
          <section key={m.label} className={s.monthBlock} aria-label={m.label}>
            <h2 className={s.month}>{m.label}</h2>
            {m.items.map((e) => (
              <article key={e.id} className={s.row} data-guide={`change-${e.id}`}>
                <div className={s.date}>{dayLabel(e.date)}</div>
                <div className={s.rail} aria-hidden="true">
                  <span className={s.dot} style={{ ["--tone" as string]: TYPE_TONE[e.type] }} />
                </div>
                <div className={fresh.has(e.id) ? `${s.card} ${s.cardFresh}` : s.card}>
                  <div className={s.cardTop}>
                    <TypeBadge type={e.type} />
                    <span className={s.chip}>{e.area}</span>
                    {fresh.has(e.id) ? <span className={`${s.chip} ${s.newChip}`}>New for you</span> : null}
                    {admin
                      ? e.audiences.map((a) => (
                          <span key={a} className={s.chip} title="Who this change affects">
                            {AUDIENCE_LABELS[a]}
                          </span>
                        ))
                      : null}
                  </div>
                  <h3 className={s.title}>{e.title}</h3>
                  <p className={s.summary}>{e.summary}</p>
                  {e.details?.length ? (
                    <ul className={s.details}>
                      {e.details.map((d) => (
                        <li key={d}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                  {e.link || (admin && e.commits?.length) ? (
                    <div className={s.cardFoot}>
                      {e.link ? <Link href={e.link.href}>{e.link.label} →</Link> : null}
                      {admin && e.commits?.length ? (
                        <span className={s.commits}>
                          {e.commits.map((c, i) => (
                            <span key={c}>
                              {i ? ", " : ""}
                              <a href={REPO + c} target="_blank" rel="noopener">
                                <code>{c}</code>
                              </a>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
