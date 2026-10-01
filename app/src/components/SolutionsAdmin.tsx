"use client";

import { useState, useRef } from "react";
import {
  affiliateUrlWarning,
  type SolutionRow,
  type SolutionFeature,
} from "@/lib/siteContentShared";

// The solutions page is a short, ordered list of visual cards, so this
// is not list-then-detail CRUD. It is one table you can reorder by
// dragging, with an editor beside it that renders the actual card as
// you type — you are editing something people look at, so you should be
// looking at it.

type Props = { initial: SolutionRow[] };

type Draft = Partial<SolutionRow> & { id?: string };

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  published: { label: "Live", cls: "pill pill-good" },
  draft: { label: "Draft", cls: "pill pill-warn" },
  archived: { label: "Archived", cls: "pill" },
};

export function SolutionsAdmin({ initial }: Props) {
  const [rows, setRows] = useState<SolutionRow[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
  const dragFrom = useRef<number | null>(null);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const current: Draft | null = draft ?? selected;

  function openRow(row: SolutionRow) {
    setSelectedId(row.id);
    setDraft(null);
    setMsg(null);
  }

  function startNew() {
    setSelectedId(null);
    setDraft({
      name: "",
      blurb: "",
      cta_label: "Start Today",
      cta_url: "",
      category: "",
      status: "draft",
      features: [],
    });
    setMsg(null);
  }

  function field<K extends keyof SolutionRow>(key: K, value: SolutionRow[K]) {
    setDraft((d) => ({ ...(d ?? selected ?? {}), [key]: value }));
  }

  function setFeature(i: number, key: keyof SolutionFeature, value: string) {
    const list: SolutionFeature[] = [...((current?.features as SolutionFeature[]) ?? [])];
    list[i] = { ...(list[i] ?? { title: "", body: "" }), [key]: value };
    field("features", list as SolutionRow["features"]);
  }

  function addFeature() {
    const list: SolutionFeature[] = [...((current?.features as SolutionFeature[]) ?? [])];
    list.push({ title: "", body: "" });
    field("features", list as SolutionRow["features"]);
  }

  function removeFeature(i: number) {
    const list: SolutionFeature[] = [...((current?.features as SolutionFeature[]) ?? [])];
    list.splice(i, 1);
    field("features", list as SolutionRow["features"]);
  }

  async function save() {
    if (!current?.name?.trim()) {
      setMsg({ kind: "err", text: "A name is required." });
      return;
    }
    setBusy(true);
    setMsg(null);

    const isNew = !current.id;
    const res = await fetch("/api/admin/solutions", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: current.id,
        name: current.name,
        blurb: current.blurb ?? "",
        cta_label: current.cta_label ?? "Start Today",
        cta_url: current.cta_url ?? null,
        logo_url: current.logo_url ?? null,
        category: current.category ?? null,
        status: current.status ?? "draft",
        tagline: current.tagline ?? null,
        overview: current.overview ?? null,
        best_for: current.best_for ?? null,
        pricing_note: current.pricing_note ?? null,
        domain: current.domain ?? null,
        brand_color: current.brand_color ?? null,
        features: current.features ?? [],
      }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setMsg({ kind: "err", text: json.error || "Could not save." });
      return;
    }

    const saved = json.solution as SolutionRow;
    setRows((prev) =>
      isNew
        ? [...prev, saved]
        : prev.map((r) => (r.id === saved.id ? saved : r))
    );
    setSelectedId(saved.id);
    setDraft(null);
    setMsg({
      kind: "ok",
      text: json.revalidated?.ok
        ? "Saved. The live site is updated."
        : `Saved. ${json.revalidated?.detail ?? "The site will pick it up on its next refresh."}`,
    });
  }

  async function setStatus(row: SolutionRow, status: SolutionRow["status"]) {
    setBusy(true);
    const res = await fetch("/api/admin/solutions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: row.id, status }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: json.error || "Could not update." });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? (json.solution as SolutionRow) : r))
    );
    setMsg({ kind: "ok", text: `"${row.name}" is now ${status}.` });
  }

  // Drag to reorder. Position on a live page is real estate; it should
  // be one gesture, not a number field.
  function onDrop(toIndex: number) {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from === null || from === toIndex) return;

    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(toIndex, 0, moved);

    const renumbered = next.map((r, i) => ({ ...r, sort_order: (i + 1) * 10 }));
    setRows(renumbered);

    void fetch("/api/admin/solutions", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        order: renumbered.map((r) => ({ id: r.id, sort_order: r.sort_order })),
      }),
    }).then(async (res) => {
      if (!res.ok) {
        setMsg({ kind: "err", text: "Order was not saved. Reload and retry." });
      } else {
        setMsg({ kind: "ok", text: "New order saved and pushed live." });
      }
    });
  }

  const urlWarning = current ? affiliateUrlWarning(current.cta_url) : null;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: "1.5rem", fontWeight: 600 }}>
            Solutions
          </h1>
          <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            Tools listed on unywebs.com/solutions. Drag to reorder — the order
            here is the order on the page.
          </p>
        </div>
        <button className="btn btn-amber" onClick={startNew} disabled={busy}>
          Add a tool
        </button>
      </div>

      {msg && (
        <div
          className="card"
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            borderColor:
              msg.kind === "err" ? "rgba(229,72,77,.4)" : "rgba(76,195,138,.4)",
            color: msg.kind === "err" ? "#ffb3b3" : "var(--good)",
            fontSize: "0.9rem",
          }}
        >
          {msg.text}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: current ? "minmax(0,1fr) minmax(0,420px)" : "1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ---------- list ---------- */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: "1%" }}></th>
                <th style={{ width: "1%" }}>Status</th>
                <th>Tool</th>
                <th>Link</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--paper-dim)" }}>
                    No tools yet. Add the first one.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => {
                  const st = STATUS_STYLE[row.status] ?? STATUS_STYLE.draft;
                  const warn = affiliateUrlWarning(row.cta_url);
                  return (
                    <tr
                      key={row.id}
                      draggable
                      onDragStart={() => (dragFrom.current = i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDrop(i)}
                      onClick={() => openRow(row)}
                      style={{
                        cursor: "pointer",
                        background:
                          selectedId === row.id ? "var(--surface-2)" : undefined,
                      }}
                    >
                      <td
                        style={{ cursor: "grab", color: "var(--muted)", userSelect: "none" }}
                        title="Drag to reorder"
                      >
                        ⠿
                      </td>
                      <td>
                        <span className={st.cls}>{st.label}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{row.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          /{row.slug}
                          {row.category ? ` · ${row.category}` : ""}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.78rem", maxWidth: 260 }}>
                        {row.cta_url ? (
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "var(--paper-dim)",
                            }}
                            title={row.cta_url}
                          >
                            {row.cta_url}
                          </div>
                        ) : (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        )}
                        {warn && (
                          <div style={{ color: "#ffd76a", fontSize: "0.72rem", marginTop: 2 }}>
                            {warn}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn btn-ghost"
                          style={{ padding: "5px 12px", fontSize: "0.78rem" }}
                          disabled={busy}
                          onClick={() =>
                            setStatus(
                              row,
                              row.status === "published" ? "draft" : "published"
                            )
                          }
                        >
                          {row.status === "published" ? "Unpublish" : "Publish"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ---------- editor + live card preview ---------- */}
        {current && (
          <div className="card" style={{ padding: 20, position: "sticky", top: 84 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>
                {current.id ? "Edit tool" : "New tool"}
              </h2>
              <button
                className="btn btn-ghost"
                style={{ padding: "4px 12px", fontSize: "0.8rem" }}
                onClick={() => {
                  setSelectedId(null);
                  setDraft(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="field">
              <label htmlFor="sol-name">Name</label>
              <input
                id="sol-name"
                value={current.name ?? ""}
                onChange={(e) => field("name", e.target.value)}
                placeholder="OpenPhone"
              />
            </div>

            <div className="field">
              <label htmlFor="sol-blurb">Description</label>
              <textarea
                id="sol-blurb"
                rows={4}
                value={current.blurb ?? ""}
                onChange={(e) => field("blurb", e.target.value)}
                placeholder="What this tool does for the reader's business, in one or two sentences."
              />
            </div>

            <div className="field">
              <label htmlFor="sol-url">Affiliate / signup link</label>
              <input
                id="sol-url"
                value={current.cta_url ?? ""}
                onChange={(e) => field("cta_url", e.target.value)}
                placeholder="https://..."
              />
              {urlWarning && (
                <span style={{ color: "#ffd76a", fontSize: "0.78rem" }}>
                  {urlWarning}
                </span>
              )}
            </div>

            <div className="field">
              <label htmlFor="sol-cta">Button label</label>
              <input
                id="sol-cta"
                value={current.cta_label ?? ""}
                onChange={(e) => field("cta_label", e.target.value)}
                placeholder="Start Today"
              />
            </div>

            <div className="field">
              <label htmlFor="sol-cat">Category (optional)</label>
              <input
                id="sol-cat"
                value={current.category ?? ""}
                onChange={(e) => field("category", e.target.value)}
                placeholder="Automation"
              />
            </div>

            <div className="field">
              <label htmlFor="sol-logo">Logo URL (optional)</label>
              <input
                id="sol-logo"
                value={current.logo_url ?? ""}
                onChange={(e) => field("logo_url", e.target.value)}
                placeholder="Leave blank to use the first letter"
              />
            </div>

            <details className="detail-fields" style={{ marginTop: 4 }}>
              <summary
                style={{
                  cursor: "pointer",
                  color: "var(--paper-dim)",
                  fontSize: "0.85rem",
                  padding: "10px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                Detail page content &mdash; shown at /solutions/{current.slug ?? "…"}
              </summary>

              <div style={{ paddingTop: 14 }}>
                <div className="field">
                  <label htmlFor="sol-tagline">Tagline</label>
                  <input
                    id="sol-tagline"
                    value={current.tagline ?? ""}
                    onChange={(e) => field("tagline", e.target.value)}
                    placeholder="A real business number your whole team shares"
                  />
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    One short line. Replaces the description on cards.
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="sol-overview">Overview</label>
                  <textarea
                    id="sol-overview"
                    rows={4}
                    value={current.overview ?? ""}
                    onChange={(e) => field("overview", e.target.value)}
                    placeholder="Two or three short sentences, in plain language."
                  />
                </div>

                <div className="field">
                  <label>What you get</label>
                  {((current.features as SolutionFeature[]) ?? []).map((f, i) => (
                    <div
                      key={i}
                      style={{
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        background: "var(--ink-2)",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <input
                          value={f.title}
                          onChange={(e) => setFeature(i, "title", e.target.value)}
                          placeholder="Shared Phone Numbers"
                          style={{ flex: 1 }}
                          aria-label={`Feature ${i + 1} title`}
                        />
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                          onClick={() => removeFeature(i)}
                          aria-label={`Remove feature ${i + 1}`}
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={f.body}
                        onChange={(e) => setFeature(i, "body", e.target.value)}
                        placeholder="One sentence on what it does for them."
                        aria-label={`Feature ${i + 1} description`}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    onClick={addFeature}
                  >
                    Add a feature
                  </button>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 6 }}>
                    Four works best &mdash; they lay out two by two.
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="sol-bestfor">Best for</label>
                  <textarea
                    id="sol-bestfor"
                    rows={2}
                    value={current.best_for ?? ""}
                    onChange={(e) => field("best_for", e.target.value)}
                    placeholder="The kind of business this suits, in one sentence."
                  />
                </div>

                <div className="field">
                  <label htmlFor="sol-pricing">Pricing note</label>
                  <input
                    id="sol-pricing"
                    value={current.pricing_note ?? ""}
                    onChange={(e) => field("pricing_note", e.target.value)}
                    placeholder="Free plan available; paid from $X/month"
                  />
                </div>

                <div className="field">
                  <label htmlFor="sol-domain">Website domain</label>
                  <input
                    id="sol-domain"
                    value={current.domain ?? ""}
                    onChange={(e) => field("domain", e.target.value)}
                    placeholder="zapier.com"
                  />
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    No https://. Used to find a logo when none is uploaded.
                  </span>
                </div>

                <div className="field">
                  <label htmlFor="sol-brand">Brand colour</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      id="sol-brand"
                      value={current.brand_color ?? ""}
                      onChange={(e) => field("brand_color", e.target.value)}
                      placeholder="#FF4F00"
                      style={{ flex: 1 }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: current.brand_color || "transparent",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    Tints the tool&apos;s page header and its fallback monogram.
                  </span>
                </div>
              </div>
            </details>

            <CardPreview draft={current} />

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <button className="btn btn-amber" onClick={save} disabled={busy}>
                {busy ? "Saving…" : current.id ? "Save changes" : "Create tool"}
              </button>
              {current.id && current.status !== "archived" && (
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() => {
                    const row = rows.find((r) => r.id === current.id);
                    if (row) setStatus(row, "archived");
                  }}
                >
                  Archive
                </button>
              )}
              {current.id && current.status === "archived" && (
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => {
                    const row = rows.find((r) => r.id === current.id);
                    if (row) setStatus(row, "draft");
                  }}
                >
                  Restore as draft
                </button>
              )}
            </div>
            <p
              style={{
                color: "var(--muted)",
                fontSize: "0.78rem",
                marginTop: 12,
                marginBottom: 0,
              }}
            >
              Archiving pulls the tool off the site but keeps its link, so a
              paused partner can be switched back on without re-entering it.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// The actual card, as it renders on unywebs.com. Same proportions, same
// type scale, same button — shown on the site's white background rather
// than the admin's dark one, because that is where it has to look right.
function CardPreview({ draft }: { draft: Draft }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 8,
        }}
      >
        How it looks on the site
      </div>
      <div
        style={{
          background: "#f4f7fb",
          borderRadius: 12,
          padding: 18,
          border: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 22,
            boxShadow: "0 1px 3px rgba(15,23,42,.06)",
            fontFamily:
              'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            color: "#0f172a",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#eaf2fb",
              color: "#1e73be",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              marginBottom: 14,
              overflow: "hidden",
            }}
          >
            {draft.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.logo_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              (draft.name || "?").charAt(0).toUpperCase()
            )}
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", lineHeight: 1.3 }}>
            {draft.name || "Tool name"}
          </h3>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: "0.9rem",
              color: "#5b6b7f",
              lineHeight: 1.55,
            }}
          >
            {draft.blurb || "The description you write will appear here."}
          </p>
          <span
            style={{
              display: "inline-block",
              background: "#1e73be",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 40,
              fontWeight: 700,
              fontSize: "0.72rem",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {draft.cta_label || "Start Today"} →
          </span>
        </div>
      </div>
    </div>
  );
}
