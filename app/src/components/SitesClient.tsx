"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type SiteView = {
  id: string;
  siteName: string;
  clientName: string | null;
  domain: string | null;
  notes: string | null;
  keyPrefix: string;
  mode: "auto" | "paused" | "active";
  overrideReason: string | null;
  overrideSetAt: string | null;
  createdAt: string;
  lastCheckedAt: string | null;
  lastCheckOrigin: string | null;
  keyRotatedAt: string | null;
  retiredAt: string | null;
  state: "active" | "grace" | "paused" | "retired";
  ownerEmail: string | null;
  account: { label: string; color: string; bg: string; hint: string } | null;
};

type Mode = SiteView["mode"];

const MODES: { mode: Mode; label: string; hint: string }[] = [
  { mode: "auto", label: "Auto", hint: "Follows the owner's account: paused only if you cut the account off" },
  { mode: "paused", label: "Paused", hint: "Visitors see the temporarily unavailable page" },
  { mode: "active", label: "Always on", hint: "Stays on even if the owner's account is cut off" },
];

const STATE_PILL: Record<SiteView["state"], { label: string; cls: string }> = {
  active: { label: "Running", cls: "pill pill-good" },
  grace: { label: "Grace", cls: "pill pill-warn" },
  paused: { label: "Paused", cls: "pill pill-bad" },
  retired: { label: "Retired", cls: "pill" },
};

// A check-in older than this means the app is not calling in (not
// deployed with the key, or not live).
const STALE_MS = 15 * 60 * 1000;

function ago(iso: string | null, now: number): string {
  if (!iso) return "Never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function call(method: "POST" | "PATCH", body: Record<string, unknown>) {
  const res = await fetch("/api/admin/sites", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof j.error === "string" ? j.error : `Request failed (${res.status})`);
  return j;
}

export function SitesClient({
  sites,
  accounts,
  prompt,
  promptVersion,
}: {
  sites: SiteView[];
  accounts: string[];
  prompt: string;
  promptVersion: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState<{ site: SiteView | null } | null>(null);
  const [revealKey, setRevealKey] = useState<{ siteName: string; licenseKey: string; rotated: boolean } | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "pause"; site: SiteView }
    | { kind: "resume"; site: SiteView; mode: Mode }
    | { kind: "rotate"; site: SiteView }
    | { kind: "retire"; site: SiteView }
    | null
  >(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const live = sites.filter((s) => !s.retiredAt);
  const retired = sites.filter((s) => s.retiredAt);
  const counts = {
    paused: live.filter((s) => s.state === "paused").length,
    grace: live.filter((s) => s.state === "grace").length,
    silent: live.filter((s) => !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() > STALE_MS).length,
  };

  function pickMode(site: SiteView, mode: Mode) {
    if (mode === site.mode) return;
    if (mode === "paused") setConfirm({ kind: "pause", site });
    else setConfirm({ kind: "resume", site, mode });
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <button type="button" className="btn btn-amber" onClick={() => setForm({ site: null })}>
          Register a site
        </button>
        <span style={{ fontSize: "0.85rem", color: "var(--paper-dim)" }}>
          {live.length} site{live.length === 1 ? "" : "s"}
          {counts.paused ? ` · ${counts.paused} paused` : ""}
          {counts.grace ? ` · ${counts.grace} in grace` : ""}
          {counts.silent ? ` · ${counts.silent} not checking in` : ""}
        </span>
      </div>

      {flash ? (
        <div
          role="status"
          className="card"
          style={{ marginBottom: 16, padding: "10px 14px", fontSize: "0.9rem", borderColor: "rgba(76,195,138,.4)" }}
        >
          {flash}
        </div>
      ) : null}

      <div className="card" style={{ padding: 0, overflowX: "auto", marginBottom: 24 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: "1%" }}>Status</th>
              <th>Site</th>
              <th>Owner account</th>
              <th>Switch</th>
              <th>Last check-in</th>
              <th style={{ textAlign: "right" }}>Key</th>
            </tr>
          </thead>
          <tbody>
            {live.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--paper-dim)", textAlign: "center", padding: 28 }}>
                  No client sites yet. Register one, then add its key to the app.
                </td>
              </tr>
            ) : (
              live.map((s) => {
                const pill = STATE_PILL[s.state];
                const stale = !s.lastCheckedAt || now - new Date(s.lastCheckedAt).getTime() > STALE_MS;
                return (
                  <tr key={s.id}>
                    <td>
                      <span className={pill.cls} title={s.overrideReason ?? undefined}>
                        {pill.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.siteName}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--paper-dim)" }}>
                        {[s.clientName, s.domain].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {s.notes ? (
                        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }} title={s.notes}>
                          {s.notes.length > 70 ? `${s.notes.slice(0, 70)}…` : s.notes}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {s.ownerEmail ? (
                        <>
                          <div style={{ fontSize: "0.85rem" }}>{s.ownerEmail}</div>
                          {s.account ? (
                            // Plain text with a coloured dot: the status
                            // colours are tuned for the dark theme and are
                            // unreadable as text on a light background.
                            <div
                              title={s.account.hint}
                              style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, fontSize: "0.75rem", color: "var(--paper-dim)" }}
                            >
                              <span
                                aria-hidden
                                style={{ width: 8, height: 8, borderRadius: 999, flex: "none", background: s.account.color, boxShadow: "0 0 0 1px rgba(0,0,0,.25)" }}
                              />
                              {s.account.label}
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Not linked · manual only</span>
                      )}
                    </td>
                    <td>
                      <div
                        role="radiogroup"
                        aria-label={`Switch for ${s.siteName}`}
                        style={{
                          display: "inline-flex",
                          border: "1px solid var(--line)",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        {MODES.map((m) => {
                          const on = s.mode === m.mode;
                          const danger = m.mode === "paused";
                          return (
                            <button
                              key={m.mode}
                              type="button"
                              role="radio"
                              aria-checked={on}
                              title={m.hint}
                              onClick={() => pickMode(s, m.mode)}
                              style={{
                                padding: "6px 10px",
                                fontSize: "0.78rem",
                                border: 0,
                                borderRight: m.mode === "active" ? 0 : "1px solid var(--line)",
                                cursor: on ? "default" : "pointer",
                                fontWeight: on ? 600 : 400,
                                color: on ? (danger ? "#fff" : "var(--paper)") : "var(--paper-dim)",
                                background: on ? (danger ? "var(--danger)" : "var(--surface)") : "transparent",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {m.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ fontSize: "0.82rem", whiteSpace: "nowrap" }}>
                      <span style={{ color: stale ? "var(--amber)" : "var(--paper)" }}>
                        {ago(s.lastCheckedAt, now)}
                      </span>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                        {s.lastCheckedAt ? s.lastCheckOrigin ?? "server-side check" : "not connected yet"}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <code style={{ fontSize: "0.78rem" }}>{s.keyPrefix}…</code>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", marginTop: 4 }}>
                        <SmallButton onClick={() => setForm({ site: s })}>Edit</SmallButton>
                        <SmallButton onClick={() => setConfirm({ kind: "rotate", site: s })}>New key</SmallButton>
                        <SmallButton onClick={() => setConfirm({ kind: "retire", site: s })}>Retire</SmallButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PromptCard prompt={prompt} version={promptVersion} />

      {retired.length ? (
        <details className="card" style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            Retired sites ({retired.length})
          </summary>
          <p style={{ fontSize: "0.82rem", color: "var(--paper-dim)", margin: "8px 0" }}>
            Retired keys are no longer recognised. An app still using one keeps running; it just stops checking in.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.85rem" }}>
            {retired.map((s) => (
              <li key={s.id}>
                {s.siteName}
                {s.domain ? ` · ${s.domain}` : ""} — retired {new Date(s.retiredAt!).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {form ? (
        <SiteForm
          site={form.site}
          accounts={accounts}
          onClose={() => setForm(null)}
          onCreated={(siteName, key) => {
            setForm(null);
            setRevealKey({ siteName, licenseKey: key, rotated: false });
            router.refresh();
          }}
          onSaved={() => {
            setForm(null);
            setFlash("Saved.");
            router.refresh();
          }}
        />
      ) : null}

      {revealKey ? (
        <KeyReveal {...revealKey} prompt={prompt} onClose={() => setRevealKey(null)} />
      ) : null}

      {confirm ? (
        <ConfirmAction
          state={confirm}
          onClose={() => setConfirm(null)}
          onDone={(message, key) => {
            const c = confirm;
            setConfirm(null);
            if (key) setRevealKey({ siteName: c.site.siteName, licenseKey: key, rotated: true });
            else setFlash(message);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function SmallButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={onClick} style={{ padding: "3px 8px", fontSize: "0.72rem" }}>
      {children}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="ui-inputs"
        style={{
          background: "var(--ink)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 560,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2 style={{ margin: "0 0 12px", fontSize: "1.2rem" }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ display: "block", fontSize: "0.85rem", color: "var(--paper-dim)", marginBottom: 4 }}>{label}</span>
      {children}
      {hint ? <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", marginTop: 3 }}>{hint}</span> : null}
    </label>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return (
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
      {message}
    </div>
  );
}

function SiteForm({
  site,
  accounts,
  onClose,
  onCreated,
  onSaved,
}: {
  site: SiteView | null;
  accounts: string[];
  onClose: () => void;
  onCreated: (siteName: string, key: string) => void;
  onSaved: () => void;
}) {
  const [siteName, setSiteName] = useState(site?.siteName ?? "");
  const [clientName, setClientName] = useState(site?.clientName ?? "");
  const [domain, setDomain] = useState(site?.domain ?? "");
  const [ownerEmail, setOwnerEmail] = useState(site?.ownerEmail ?? "");
  const [notes, setNotes] = useState(site?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fields = {
      site_name: siteName,
      client_name: clientName,
      domain,
      owner_email: ownerEmail,
      notes,
    };
    try {
      if (site) {
        await call("PATCH", { id: site.id, action: "edit", ...fields });
        onSaved();
      } else {
        const j = await call("POST", fields);
        onCreated(siteName.trim(), String(j.key));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Modal title={site ? `Edit ${site.siteName}` : "Register a client site"} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Site or app name *" hint="What you call it, e.g. Joe's Tires booking app.">
          <input value={siteName} onChange={(e) => setSiteName(e.target.value)} required maxLength={120} style={{ width: "100%" }} autoFocus />
        </Field>
        <Field label="Client or business name">
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} style={{ width: "100%" }} />
        </Field>
        <Field label="Domain" hint="Where the app lives, e.g. book.joestires.com.">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} maxLength={300} style={{ width: "100%" }} placeholder="book.example.com" />
        </Field>
        <Field
          label="Owner's UnyBase account (email)"
          hint="Links the site to that account's billing: cutting the account off pauses this site too. Leave blank for a client who pays outside UnyBase; the switch is then manual only."
        >
          <input
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            list="unybase-accounts"
            type="email"
            maxLength={320}
            style={{ width: "100%" }}
          />
          <datalist id="unybase-accounts">
            {accounts.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
        <Field label="Notes (internal)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} style={{ width: "100%", resize: "vertical" }} />
        </Field>
        <ErrorBox message={err} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-amber" disabled={busy || !siteName.trim()}>
            {busy ? "Saving…" : site ? "Save" : "Register and get key"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ padding: "6px 12px", fontSize: "0.82rem" }}
      onClick={async () => {
        const ok = await copy(text);
        setDone(ok ? "ok" : "fail");
        setTimeout(() => setDone("idle"), 2000);
      }}
    >
      {done === "ok" ? "Copied" : done === "fail" ? "Select and copy" : label}
    </button>
  );
}

function KeyReveal({
  siteName,
  licenseKey,
  rotated,
  prompt,
  onClose,
}: {
  siteName: string;
  licenseKey: string;
  rotated: boolean;
  prompt: string;
  onClose: () => void;
}) {
  return (
    <Modal title={rotated ? `New key for ${siteName}` : `${siteName} is registered`} onClose={onClose}>
      <p style={{ margin: "0 0 10px", fontSize: "0.9rem", color: "var(--paper-dim)" }}>
        This key is shown <strong style={{ color: "var(--paper)" }}>once</strong>. Copy it now; if it&rsquo;s lost, issue a new key.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input readOnly value={licenseKey} onFocus={(e) => e.currentTarget.select()} className="mono" style={{ flex: 1, fontSize: "0.82rem" }} />
        <CopyButton text={licenseKey} label="Copy key" />
      </div>
      <ol style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: "0.88rem", lineHeight: 1.6, listStyle: "decimal" }}>
        {rotated ? (
          <li>
            The old key stopped working just now. The app keeps running but stops checking in until you swap the key.
          </li>
        ) : null}
        <li>
          In the app&rsquo;s hosting (for Vercel: Project → Settings → Environment Variables), set{" "}
          <code>UNYBASE_LICENSE_KEY</code> to this key for Production and Preview. For a browser-only site, put it in
          the script tag&rsquo;s <code>data-key</code> instead.
        </li>
        <li>
          {rotated
            ? "Redeploy the app so it picks up the new key."
            : "Make sure the app includes the licence check: paste the builder prompt into Claude in the app's project, then redeploy."}
        </li>
        <li>Open the site, then come back here: &ldquo;Last check-in&rdquo; should show within a minute.</li>
      </ol>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        {rotated ? <span /> : <CopyButton text={prompt} label="Copy builder prompt" />}
        <button type="button" className="btn btn-amber" onClick={onClose}>
          I&rsquo;ve saved the key
        </button>
      </div>
    </Modal>
  );
}

function ConfirmAction({
  state,
  onClose,
  onDone,
}: {
  state:
    | { kind: "pause"; site: SiteView }
    | { kind: "resume"; site: SiteView; mode: Mode }
    | { kind: "rotate"; site: SiteView }
    | { kind: "retire"; site: SiteView };
  onClose: () => void;
  onDone: (message: string, key?: string) => void;
}) {
  const { site } = state;
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const gate = state.kind === "pause" ? "PAUSE" : state.kind === "retire" ? "RETIRE" : null;
  const ready = !busy && (!gate || typed === gate);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      if (state.kind === "pause" || state.kind === "resume") {
        const mode = state.kind === "pause" ? "paused" : state.mode;
        const j = await call("PATCH", { id: site.id, action: "set_mode", mode, reason: reason.trim() || null });
        const status = String(j.status ?? "");
        const mailed = j.emailed ? " The owner has been emailed." : "";
        onDone(
          status === "paused"
            ? `${site.siteName} is paused. Visitors will see the unavailable page within a minute.${mailed}`
            : `${site.siteName} is ${status === "grace" ? "running (in grace)" : "running"} again.${mailed}`
        );
      } else if (state.kind === "rotate") {
        const j = await call("PATCH", { id: site.id, action: "rotate_key" });
        onDone("", String(j.key));
      } else {
        await call("PATCH", { id: site.id, action: "retire" });
        onDone(`${site.siteName} is retired.`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  let title = "";
  let body: ReactNode = null;
  if (state.kind === "pause") {
    title = `Pause ${site.siteName}?`;
    body = (
      <>
        <p style={{ margin: "0 0 12px", color: "var(--paper-dim)", fontSize: "0.9rem" }}>
          Within about a minute every visitor{site.domain ? ` to ${site.domain}` : ""} sees a neutral
          &ldquo;temporarily unavailable&rdquo; page. Data, webhooks and scheduled jobs are untouched.
          {site.ownerEmail ? ` ${site.ownerEmail} will get an email saying the app is paused.` : " No UnyBase account is linked, so nobody is emailed: tell the client yourself."}
        </p>
        <Field label={site.ownerEmail ? "Reason (saved to the audit trail and included in the owner's email)" : "Reason (saved to the audit trail)"}>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} style={{ width: "100%", resize: "vertical" }} placeholder="e.g. Invoice 1042 unpaid 30 days after reminders" />
        </Field>
      </>
    );
  } else if (state.kind === "resume") {
    title = state.mode === "active" ? `Set ${site.siteName} to Always on?` : `Set ${site.siteName} back to Auto?`;
    body = (
      <p style={{ margin: "0 0 12px", color: "var(--paper-dim)", fontSize: "0.9rem" }}>
        {state.mode === "active"
          ? "The site will run even if the owner's account is cut off. Use this for a client with a separate arrangement."
          : "The site will follow the owner's account again: it runs unless you cut the account off."}
        {site.state === "paused" ? " It comes back within about a minute." : ""}
      </p>
    );
  } else if (state.kind === "rotate") {
    title = `Issue a new key for ${site.siteName}?`;
    body = (
      <p style={{ margin: "0 0 12px", color: "var(--paper-dim)", fontSize: "0.9rem" }}>
        The current key stops working immediately. The app keeps running (it fails open) but stops checking in, and
        can&rsquo;t be paused, until you put the new key in its hosting and redeploy.
      </p>
    );
  } else {
    title = `Retire ${site.siteName}?`;
    body = (
      <p style={{ margin: "0 0 12px", color: "var(--paper-dim)", fontSize: "0.9rem" }}>
        Use this when the app is gone or handed over. Its key stops being recognised, so the app (if still live) keeps
        running and can no longer be paused from here. This can&rsquo;t be undone; register it again if needed.
      </p>
    );
  }

  return (
    <Modal title={title} onClose={onClose}>
      {body}
      {gate ? (
        <Field label={`Type ${gate} to confirm`}>
          <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} style={{ width: "100%", letterSpacing: "0.05em" }} autoFocus />
        </Field>
      ) : null}
      <ErrorBox message={err} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className={state.kind === "pause" || state.kind === "retire" ? "btn btn-danger" : "btn btn-amber"}
          onClick={run}
          disabled={!ready}
        >
          {busy
            ? "Working…"
            : state.kind === "pause"
              ? "Pause site"
              : state.kind === "resume"
                ? "Confirm"
                : state.kind === "rotate"
                  ? "Issue new key"
                  : "Retire site"}
        </button>
      </div>
    </Modal>
  );
}

function PromptCard({ prompt, version }: { prompt: string; version: string }) {
  return (
    <details className="card">
      <summary style={{ cursor: "pointer" }}>
        <strong>Builder prompt</strong>
        <span style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>
          {" "}
          — paste into Claude when building or rebuilding a client app (spec {version})
        </span>
      </summary>
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "12px 0 8px" }}>
        <CopyButton text={prompt} label="Copy prompt" />
      </div>
      <pre
        style={{
          margin: 0,
          maxHeight: 420,
          overflow: "auto",
          padding: 14,
          borderRadius: 8,
          background: "var(--ink)",
          border: "1px solid var(--line)",
          fontSize: "0.76rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
        }}
      >
        {prompt}
      </pre>
    </details>
  );
}
