"use client";

import { useMemo, useState } from "react";

export type ChangeStatus = "pending" | "sent" | "done" | "dropped";
export type ChangeKind = "fix" | "change" | "new";
export type ChangePriority = "low" | "normal" | "high";

export type ChangeRequest = {
  id: string;
  workspace_owner_id: string;
  created_by: string | null;
  created_by_email: string | null;
  body: string;
  associated_system: string | null;
  kind: ChangeKind;
  priority: ChangePriority;
  status: ChangeStatus;
  status_note: string | null;
  sent_at: string | null;
  done_at: string | null;
  dropped_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Workspace = { owner_id: string; email: string; access: string };

type View = "backlog" | "pending" | "sent" | "done" | "dropped" | "all";

const STATUS_META: Record<ChangeStatus, { label: string; color: string; bg: string; hint: string }> = {
  // Mid-tone colours so the pills read in both light and dark themes.
  pending: { label: "Pending", color: "#d08a12", bg: "rgba(208,138,18,.14)", hint: "Logged, not handed off yet" },
  sent: { label: "Sent", color: "#3d8fd1", bg: "rgba(61,143,209,.14)", hint: "Handed to the developer or tool" },
  done: { label: "Done", color: "#3f9f52", bg: "rgba(63,159,82,.15)", hint: "Live in the app or tool" },
  dropped: { label: "Dropped", color: "#8a8378", bg: "rgba(138,131,120,.18)", hint: "Decided not to do it" },
};
const KIND_LABEL: Record<ChangeKind, string> = { fix: "Fix", change: "Change", new: "New" };

const VIEWS: Array<{ id: View; label: string; title: string }> = [
  { id: "backlog", label: "Backlog", title: "Everything still open: Pending + Sent" },
  { id: "pending", label: "Pending", title: STATUS_META.pending.hint },
  { id: "sent", label: "Sent", title: STATUS_META.sent.hint },
  { id: "done", label: "Changelog", title: "Done items, by date — your record of what changed" },
  { id: "dropped", label: "Dropped", title: STATUS_META.dropped.hint },
  { id: "all", label: "All", title: "Everything" },
];

function inView(s: ChangeStatus, v: View) {
  if (v === "all") return true;
  if (v === "backlog") return s === "pending" || s === "sent";
  return s === v;
}

/** One request per line; bullets and numbering are stripped. */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•–]|\d+[.)]|\[\s?[xX ]?\s?\])\s+/, "").trim())
    .filter(Boolean);
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The date an item is filed under in a view: done -> done date, otherwise logged date. */
function viewDate(i: ChangeRequest, v: View) {
  if (v === "done" && i.done_at) return i.done_at;
  if (v === "dropped" && i.dropped_at) return i.dropped_at;
  return i.created_at;
}

function groupBySystem(items: ChangeRequest[]) {
  const map = new Map<string, ChangeRequest[]>();
  for (const i of items) {
    const k = i.associated_system?.trim() || "General";
    map.set(k, [...(map.get(k) ?? []), i]);
  }
  return Array.from(map.entries());
}

function line(i: ChangeRequest, n?: number) {
  const tags = [`[${KIND_LABEL[i.kind]}]`, i.priority === "high" ? "(High priority)" : ""].filter(Boolean).join(" ");
  const body = i.body.includes("\n") ? i.body.replace(/\n/g, "\n   ") : i.body;
  return `${n !== undefined ? `${n}. ` : "- "}${tags} ${body}`;
}

/** Brief for a developer / technician / AI dev tool. */
export function buildBrief(items: ChangeRequest[]): string {
  const today = fmtDay(new Date().toISOString());
  const groups = groupBySystem(items);
  const multi = groups.length > 1;
  let n = 0;
  const out: string[] = [];
  out.push(
    multi
      ? `Change requests — ${today} · ${items.length} item${items.length === 1 ? "" : "s"}`
      : `Change requests — ${groups[0]?.[0] ?? "General"}\n${today} · ${items.length} item${items.length === 1 ? "" : "s"}`
  );
  for (const [system, list] of groups) {
    out.push("");
    if (multi) out.push(`${system}`);
    for (const i of list) out.push(line(i, ++n));
  }
  out.push("", "Please reply with the item numbers as each one is done, and flag anything that needs a decision.");
  return out.join("\n");
}

/** Changelog / release notes from done items. */
export function buildChangelog(items: ChangeRequest[]): string {
  const groups = groupBySystem(items);
  const out: string[] = [];
  for (const [system, list] of groups) {
    if (out.length) out.push("");
    out.push(`Changelog — ${system}`);
    const byDay = new Map<string, ChangeRequest[]>();
    for (const i of [...list].sort((a, b) => (b.done_at ?? b.created_at).localeCompare(a.done_at ?? a.created_at))) {
      const k = fmtDay(i.done_at ?? i.created_at);
      byDay.set(k, [...(byDay.get(k) ?? []), i]);
    }
    for (const [day, dl] of byDay) {
      out.push("", day);
      for (const i of dl) out.push(`${line(i)}${i.status_note ? ` — ${i.status_note}` : ""}`);
    }
  }
  return out.join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

async function api(method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const res = await fetch("/api/changes", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as {
    error?: string;
    items?: ChangeRequest[];
    deleted?: string[];
    note?: string;
  };
  if (!res.ok) throw new Error(j.error ?? "Request failed.");
  return j;
}

export function ChangesClient({
  initialItems,
  workspaces,
  systems: initialSystems,
  currentUserId,
}: {
  initialItems: ChangeRequest[];
  workspaces: Workspace[];
  systems: string[];
  currentUserId: string;
}) {
  const [items, setItems] = useState<ChangeRequest[]>(initialItems);
  const [view, setView] = useState<View>("backlog");
  const [systemFilter, setSystemFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Add form
  const [draft, setDraft] = useState("");
  const [draftSystem, setDraftSystem] = useState(initialSystems.length === 1 ? initialSystems[0] : "");
  const [draftKind, setDraftKind] = useState<ChangeKind>("change");
  const [draftPriority, setDraftPriority] = useState<ChangePriority>("normal");
  const [draftOwner, setDraftOwner] = useState(currentUserId);
  const draftLines = splitLines(draft);

  const emailFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of workspaces) m.set(w.owner_id, w.email);
    return m;
  }, [workspaces]);

  const systems = useMemo(
    () =>
      Array.from(
        new Set([...initialSystems, ...items.map((i) => i.associated_system?.trim()).filter((s): s is string => Boolean(s))])
      ).sort((a, b) => a.localeCompare(b)),
    [initialSystems, items]
  );

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const counts = useMemo(() => {
    const c: Record<View, number> = { backlog: 0, pending: 0, sent: 0, done: 0, dropped: 0, all: 0 };
    for (const i of items) {
      if (systemFilter && (i.associated_system ?? "") !== systemFilter) continue;
      for (const v of VIEWS) if (inView(i.status, v.id)) c[v.id] += 1;
    }
    return c;
  }, [items, systemFilter]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((i) => inView(i.status, view))
      .filter((i) => !systemFilter || (i.associated_system ?? "") === systemFilter)
      .filter(
        (i) =>
          !q ||
          i.body.toLowerCase().includes(q) ||
          (i.associated_system ?? "").toLowerCase().includes(q) ||
          (i.status_note ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => {
        const d = viewDate(b, view).localeCompare(viewDate(a, view));
        return newestFirst ? d : -d;
      });
  }, [items, view, systemFilter, query, newestFirst]);

  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; items: ChangeRequest[] }> = [];
    for (const i of shown) {
      const iso = viewDate(i, view);
      const k = dayKey(iso);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(i);
      else out.push({ key: k, label: fmtDay(iso), items: [i] });
    }
    return out;
  }, [shown, view]);

  const selectedItems = shown.filter((i) => selected.has(i.id));
  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(allShownSelected ? new Set() : new Set(shown.map((i) => i.id)));
  }

  function merge(updated: ChangeRequest[] | undefined) {
    if (!updated?.length) return;
    const m = new Map(updated.map((u) => [u.id, u]));
    setItems((prev) => prev.map((i) => m.get(i.id) ?? i));
  }

  async function add() {
    if (draftLines.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const j = await api("POST", {
        items: draftLines,
        associated_system: draftSystem,
        kind: draftKind,
        priority: draftPriority,
        workspace_owner_id: draftOwner,
      });
      setItems((prev) => [...(j.items ?? []), ...prev]);
      setDraft("");
      if (view !== "backlog" && view !== "pending" && view !== "all") setView("backlog");
      flash(`Added ${j.items?.length ?? 0} request${j.items?.length === 1 ? "" : "s"}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(ids: string[], status: ChangeStatus, extra?: Record<string, unknown>) {
    if (!ids.length) return;
    setBusy(true);
    setErr(null);
    try {
      const j = await api("PATCH", { ids, status, ...extra });
      merge(j.items);
      flash(`${ids.length} marked ${STATUS_META[status].label.toLowerCase()}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, fields: Record<string, unknown>) {
    setErr(null);
    try {
      const j = await api("PATCH", { ids: [id], ...fields });
      merge(j.items);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    }
  }

  async function remove(ids: string[]) {
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} request${ids.length === 1 ? "" : "s"} permanently? (Use Dropped to keep a record.)`)) return;
    setBusy(true);
    setErr(null);
    try {
      const j = await api("DELETE", { ids });
      const gone = new Set(j.deleted ?? []);
      setItems((prev) => prev.filter((i) => !gone.has(i.id)));
      setSelected(new Set());
      if (j.note) setErr(j.note);
      else flash(`Deleted ${gone.size}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  function textFor(list: ChangeRequest[]) {
    return view === "done" ? buildChangelog(list) : buildBrief(list);
  }

  async function copy(list: ChangeRequest[], markSent = false) {
    if (!list.length) return;
    const ok = await copyText(textFor(list));
    if (!ok) {
      setPreview(textFor(list));
      setErr("Your browser blocked the clipboard — the text is shown below to copy by hand.");
      return;
    }
    flash(`Copied ${list.length} item${list.length === 1 ? "" : "s"}`);
    if (markSent) {
      const ids = list.filter((i) => i.status === "pending").map((i) => i.id);
      if (ids.length) await setStatus(ids, "sent");
    }
  }

  const bulkTarget = selectedItems.length ? selectedItems : [];

  return (
    <div className="ui-inputs">
      <Terminology />

      {/* Add */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Log change requests</div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void add();
          }}
          rows={4}
          placeholder={"One request per line — paste a list straight from your notes.\nLogin button overlaps the logo on mobile\nAdd CSV export to the clients table\nRename “Vault” to “Credentials” in the nav"}
          style={{ width: "100%", resize: "vertical", fontFamily: "inherit", marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            list="change-systems"
            value={draftSystem}
            onChange={(e) => setDraftSystem(e.target.value)}
            placeholder="App / tool / system (e.g. UnyBase app)"
            style={{ flex: "1 1 220px", minWidth: 180 }}
            aria-label="Associated app, tool or system"
          />
          <datalist id="change-systems">
            {systems.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <select value={draftKind} onChange={(e) => setDraftKind(e.target.value as ChangeKind)} aria-label="Type">
            <option value="fix">Fix (something broken)</option>
            <option value="change">Change (adjust existing)</option>
            <option value="new">New (feature / addition)</option>
          </select>
          <select
            value={draftPriority}
            onChange={(e) => setDraftPriority(e.target.value as ChangePriority)}
            aria-label="Priority"
          >
            <option value="normal">Normal priority</option>
            <option value="high">High priority</option>
            <option value="low">Low priority</option>
          </select>
          {workspaces.length > 1 ? (
            <select value={draftOwner} onChange={(e) => setDraftOwner(e.target.value)} aria-label="Workspace">
              {workspaces.map((w) => (
                <option key={w.owner_id} value={w.owner_id}>
                  {w.owner_id === currentUserId ? "My workspace" : w.email}
                </option>
              ))}
            </select>
          ) : null}
          <button type="button" className="btn btn-amber" onClick={add} disabled={busy || draftLines.length === 0}>
            {draftLines.length > 1 ? `Add ${draftLines.length} requests` : "Add request"}
          </button>
        </div>
        <small style={{ display: "block", marginTop: 8, color: "var(--muted)", fontSize: "0.75rem" }}>
          Tip: Ctrl/⌘ + Enter adds. Bullets and numbers at the start of pasted lines are removed.
        </small>
      </div>

      {/* Views + filters */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }} role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            title={v.title}
            onClick={() => {
              setView(v.id);
              setSelected(new Set());
            }}
            className="btn btn-ghost"
            style={{
              padding: "6px 12px",
              fontSize: "0.85rem",
              ...(view === v.id ? { borderColor: "var(--amber)", color: "var(--paper)", background: "var(--surface)" } : {}),
            }}
          >
            {v.label} <span style={{ color: "var(--muted)", marginLeft: 4 }}>{counts[v.id]}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value)} aria-label="Filter by system">
          <option value="">All apps / tools</option>
          {systems.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search requests"
          style={{ flex: "1 1 180px", minWidth: 160 }}
        />
        <button type="button" className="btn btn-ghost" onClick={() => setNewestFirst((v) => !v)} style={{ fontSize: "0.82rem" }}>
          {newestFirst ? "Newest first ↓" : "Oldest first ↑"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(groups.map((g) => g.key)))}
          style={{ fontSize: "0.82rem" }}
        >
          {collapsed.size ? "Expand all" : "Collapse all"}
        </button>
      </div>

      {/* Bulk bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--line)",
          background: "var(--surface)",
          marginBottom: 12,
        }}
      >
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={allShownSelected} onChange={toggleAll} disabled={!shown.length} />
          {selectedItems.length ? `${selectedItems.length} selected` : "Select all shown"}
        </label>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!shown.length}
          onClick={() => copy(bulkTarget.length ? bulkTarget : shown)}
          style={{ fontSize: "0.82rem" }}
          title={view === "done" ? "Copy as a dated changelog" : "Copy as a numbered brief for your developer"}
        >
          {view === "done" ? "Copy changelog" : "Copy"}
          {bulkTarget.length ? ` (${bulkTarget.length})` : shown.length ? ` all ${shown.length}` : ""}
        </button>
        {view !== "done" && view !== "dropped" ? (
          <button
            type="button"
            className="btn btn-amber"
            disabled={busy || !shown.some((i) => i.status === "pending")}
            onClick={() => copy((bulkTarget.length ? bulkTarget : shown).filter((i) => i.status !== "done" && i.status !== "dropped"), true)}
            style={{ fontSize: "0.82rem" }}
            title="Copy the brief and mark the pending items as sent"
          >
            Copy &amp; mark sent
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !bulkTarget.length}
          onClick={() => setStatus(bulkTarget.map((i) => i.id), "done")}
          style={{ fontSize: "0.82rem" }}
        >
          Mark done
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !bulkTarget.length}
          onClick={() => setStatus(bulkTarget.map((i) => i.id), "pending")}
          style={{ fontSize: "0.82rem" }}
        >
          Back to pending
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !bulkTarget.length}
          onClick={() => setStatus(bulkTarget.map((i) => i.id), "dropped")}
          style={{ fontSize: "0.82rem" }}
        >
          Drop
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={busy || !bulkTarget.length}
          onClick={() => remove(bulkTarget.map((i) => i.id))}
          style={{ fontSize: "0.82rem" }}
        >
          Delete
        </button>
      </div>

      {err ? (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            marginBottom: 12,
            border: "1px solid rgba(240,80,80,.3)",
            background: "rgba(240,80,80,.1)",
            color: "#ffb3b3",
            borderRadius: 8,
            fontSize: "0.85rem",
          }}
        >
          {err}
        </div>
      ) : null}
      {preview ? (
        <textarea readOnly value={preview} rows={10} style={{ width: "100%", marginBottom: 12, fontFamily: "ui-monospace, Menlo, monospace", fontSize: "0.8rem" }} onFocus={(e) => e.currentTarget.select()} />
      ) : null}

      {/* List */}
      {shown.length === 0 ? (
        <div className="card" style={{ color: "var(--paper-dim)", textAlign: "center", fontSize: "0.9rem" }}>
          {items.length === 0
            ? "No change requests yet. Log the first one above."
            : view === "done"
              ? "Nothing marked done yet. Finished items appear here by date, ready to copy as a changelog."
              : "No requests match this view."}
        </div>
      ) : (
        groups.map((g) => {
          const isCollapsed = collapsed.has(g.key);
          return (
            <section key={g.key} style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((prev) => {
                    const n = new Set(prev);
                    if (n.has(g.key)) n.delete(g.key);
                    else n.add(g.key);
                    return n;
                  })
                }
                aria-expanded={!isCollapsed}
                style={{
                  background: "none",
                  border: 0,
                  padding: "4px 0",
                  color: "var(--paper-dim)",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                <span style={{ display: "inline-block", transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }}>▾</span>
                {view === "done" ? "Done" : view === "dropped" ? "Dropped" : "Logged"} {g.label}
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {g.items.length}</span>
              </button>
              {isCollapsed ? null : (
                <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                  {g.items.map((i, idx) => (
                    <Row
                      key={i.id}
                      item={i}
                      first={idx === 0}
                      selected={selected.has(i.id)}
                      onToggle={() => toggle(i.id)}
                      ownerLabel={i.workspace_owner_id !== currentUserId ? emailFor.get(i.workspace_owner_id) ?? "Shared workspace" : null}
                      onStatus={(s) => setStatus([i.id], s)}
                      onPatch={(f) => patch(i.id, f)}
                      onCopy={() => copy([i])}
                      onDelete={() => remove([i.id])}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--surface-2)",
            border: "1px solid var(--line)",
            padding: "10px 16px",
            borderRadius: 999,
            fontSize: "0.85rem",
            boxShadow: "0 8px 24px rgba(0,0,0,.3)",
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function Row({
  item,
  first,
  selected,
  onToggle,
  ownerLabel,
  onStatus,
  onPatch,
  onCopy,
  onDelete,
}: {
  item: ChangeRequest;
  first: boolean;
  selected: boolean;
  onToggle: () => void;
  ownerLabel: string | null;
  onStatus: (s: ChangeStatus) => void;
  onPatch: (f: Record<string, unknown>) => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const [system, setSystem] = useState(item.associated_system ?? "");
  const [note, setNote] = useState(item.status_note ?? "");
  const meta = STATUS_META[item.status];
  const closed = item.status === "done" || item.status === "dropped";

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 14px",
        borderTop: first ? undefined : "1px solid var(--line)",
        background: selected ? "rgba(242,169,59,.06)" : undefined,
        opacity: item.status === "dropped" ? 0.7 : 1,
      }}
    >
      <input type="checkbox" checked={selected} onChange={onToggle} aria-label="Select request" style={{ marginTop: 4 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
          <span
            title={meta.hint}
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: "0.7rem",
              fontWeight: 600,
              color: meta.color,
              background: meta.bg,
              border: `1px solid ${meta.color}33`,
            }}
          >
            {meta.label}
          </span>
          <span className="pill" style={{ fontSize: "0.7rem", padding: "1px 8px" }}>
            {KIND_LABEL[item.kind]}
          </span>
          {item.priority === "high" ? (
            <span className="pill pill-bad" style={{ fontSize: "0.7rem", padding: "1px 8px" }}>
              High
            </span>
          ) : item.priority === "low" ? (
            <span style={{ fontSize: "0.7rem", color: "var(--muted)" }}>Low</span>
          ) : null}
          {item.associated_system ? (
            <span style={{ fontSize: "0.75rem", color: "var(--sky)" }}>{item.associated_system}</span>
          ) : null}
          {ownerLabel ? <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>· {ownerLabel}</span> : null}
        </div>

        {editing ? (
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={Math.min(8, Math.max(2, body.split("\n").length))}
              style={{ width: "100%", fontFamily: "inherit", marginBottom: 6 }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <input
                list="change-systems"
                value={system}
                onChange={(e) => setSystem(e.target.value)}
                placeholder="App / tool / system"
                style={{ flex: "1 1 180px" }}
              />
              <select
                defaultValue={item.kind}
                onChange={(e) => onPatch({ kind: e.target.value })}
                aria-label="Type"
              >
                <option value="fix">Fix</option>
                <option value="change">Change</option>
                <option value="new">New</option>
              </select>
              <select
                defaultValue={item.priority}
                onChange={(e) => onPatch({ priority: e.target.value })}
                aria-label="Priority"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="low">Low</option>
              </select>
              <button
                type="button"
                className="btn btn-amber"
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                onClick={() => {
                  onPatch({ body, associated_system: system });
                  setEditing(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                onClick={() => {
                  setBody(item.body);
                  setSystem(item.associated_system ?? "");
                  setEditing(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, wordBreak: "break-word" }}>{item.body}</div>
        )}

        {closed ? (
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if ((item.status_note ?? "") !== note.trim()) onPatch({ status_note: note });
            }}
            placeholder={item.status === "done" ? "Resolution note (version, commit, what changed…)" : "Why it was dropped"}
            style={{ width: "100%", marginTop: 8, fontSize: "0.82rem" }}
          />
        ) : null}

        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginTop: 6 }}>
          Logged {fmtDay(item.created_at)}
          {item.created_by_email ? ` by ${item.created_by_email}` : ""}
          {item.sent_at ? ` · sent ${fmtDay(item.sent_at)}` : ""}
          {item.done_at ? ` · done ${fmtDay(item.done_at)}` : ""}
          {item.dropped_at ? ` · dropped ${fmtDay(item.dropped_at)}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <select
          value={item.status}
          onChange={(e) => onStatus(e.target.value as ChangeStatus)}
          aria-label="Status"
          style={{ fontSize: "0.8rem" }}
        >
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="done">Done</option>
          <option value="dropped">Dropped</option>
        </select>
        <div style={{ display: "flex", gap: 4 }}>
          <IconBtn label="Copy" onClick={onCopy}>
            ⧉
          </IconBtn>
          <IconBtn label="Edit" onClick={() => setEditing((v) => !v)}>
            ✎
          </IconBtn>
          <IconBtn label="Delete" onClick={onDelete}>
            ✕
          </IconBtn>
        </div>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="btn btn-ghost"
      style={{ padding: "3px 8px", fontSize: "0.8rem", lineHeight: 1.2 }}
    >
      {children}
    </button>
  );
}

function Terminology() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "none", border: 0, padding: 0, color: "var(--sky)", fontSize: "0.85rem", cursor: "pointer" }}
        aria-expanded={open}
      >
        {open ? "Hide" : "How this works"} — terms used here
      </button>
      {open ? (
        <div className="card" style={{ marginTop: 8, fontSize: "0.86rem", lineHeight: 1.65, color: "var(--paper-dim)" }}>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: "var(--paper)" }}>Change request</strong> — one edit you want made to an app or tool.
            Tag it <em>Fix</em> (something is broken), <em>Change</em> (adjust what exists) or <em>New</em> (a feature
            or addition).
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: "var(--paper)" }}>Backlog</strong> — everything still open.{" "}
            <strong style={{ color: STATUS_META.pending.color }}>Pending</strong> means logged but not handed off;{" "}
            <strong style={{ color: STATUS_META.sent.color }}>Sent</strong> means it&apos;s with your developer, technician or
            dev tool.
          </p>
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: "var(--paper)" }}>Changelog</strong> — items marked{" "}
            <strong style={{ color: STATUS_META.done.color }}>Done</strong> (live in the app), filed by the date they were
            finished. Copy it as release notes. <strong style={{ color: STATUS_META.dropped.color }}>Dropped</strong> keeps a
            record of what you decided not to do.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--paper)" }}>Copy &amp; mark sent</strong> copies a numbered brief to paste into a
            message, ticket or AI coding tool, and moves those items to Sent so you can see what&apos;s waiting on someone
            else.
          </p>
        </div>
      ) : null}
    </div>
  );
}
