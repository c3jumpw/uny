"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { expiryState } from "@/lib/integrations";

export type DomainRow = {
  id: string;
  workspace_owner_id: string;
  domain_name: string;
  associated_system: string | null;
  registrar: string | null;
  registrar_account: string | null;
  dns_provider: string | null;
  dns_account: string | null;
  nameservers: string | null;
  expires_at: string | null;
  auto_renew: boolean;
  ssl_expires_at: string | null;
  ssl_provider: string | null;
  account_ownership: "agency_master" | "client_own";
  registrar_credential_id: string | null;
  notes: string | null;
};

type FormState = Omit<
  DomainRow,
  "id" | "workspace_owner_id" | "auto_renew" | "account_ownership"
> & {
  id?: string;
  auto_renew: boolean;
  account_ownership: "agency_master" | "client_own";
};

const EMPTY: FormState = {
  domain_name: "",
  associated_system: "",
  registrar: "",
  registrar_account: "",
  dns_provider: "",
  dns_account: "",
  nameservers: "",
  expires_at: "",
  auto_renew: false,
  ssl_expires_at: "",
  ssl_provider: "",
  account_ownership: "client_own",
  registrar_credential_id: "",
  notes: "",
};

export function DomainsClient({
  domains,
  systems,
  credentials,
  currentUserId,
  ownerEmails,
}: {
  domains: DomainRow[];
  systems: string[];
  credentials: Array<{ id: string; name: string }>;
  currentUserId: string | null;
  ownerEmails: Record<string, string>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState("all");

  const visible = useMemo(() => {
    if (systemFilter === "all") return domains;
    if (systemFilter === "__untagged")
      return domains.filter((d) => !d.associated_system?.trim());
    return domains.filter((d) => d.associated_system?.trim() === systemFilter);
  }, [domains, systemFilter]);

  // Soonest expiry first: a domain lapsing is the one failure here
  // that takes a whole site down rather than degrading one feature.
  const sorted = useMemo(
    () =>
      [...visible].sort((a, b) => {
        const ax = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
        const bx = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
        if (ax !== bx) return ax - bx;
        return a.domain_name.localeCompare(b.domain_name);
      }),
    [visible]
  );

  const urgent = domains.filter(
    (d) => expiryState(d.expires_at).urgent || expiryState(d.ssl_expires_at).urgent
  ).length;

  async function save() {
    if (!form || !form.domain_name.trim()) {
      setErr("Enter a domain name.");
      return;
    }
    setBusy("save");
    setErr(null);
    try {
      const editing = Boolean(form.id);
      const res = await fetch("/api/domains", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id: form.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Save failed.");
        return;
      }
      setForm(null);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Remove ${name} from the domain list?`)) return;
    setBusy(id);
    try {
      await fetch(`/api/domains?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: "0.9rem", color: "var(--paper-dim)" }}>
          {domains.length === 0 ? (
            "No domains tracked yet."
          ) : urgent > 0 ? (
            <>
              <strong style={{ color: "#ffb066" }}>
                {urgent} need{urgent === 1 ? "s" : ""} attention
              </strong>{" "}
              of {domains.length} tracked.
            </>
          ) : (
            <>All {domains.length} domains have room before renewal.</>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {systems.length > 0 ? (
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              aria-label="Filter by system"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--ink-2)",
                color: "var(--paper)",
                fontSize: "0.85rem",
              }}
            >
              <option value="all">All systems</option>
              {systems.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              <option value="__untagged">Untagged</option>
            </select>
          ) : null}
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => {
              setErr(null);
              setForm({ ...EMPTY });
            }}
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            Add domain
          </button>
        </div>
      </div>

      {err && !form ? (
        <div style={errStyle}>{err}</div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ margin: "0 0 6px", color: "var(--paper)" }}>No domains yet.</p>
          <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            Track where each domain is registered, who owns the account, and when it
            renews. An expired domain takes the whole site down, so this is the one
            date worth never missing.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((d) => {
            const exp = expiryState(d.expires_at);
            const ssl = expiryState(d.ssl_expires_at);
            const shared = currentUserId && d.workspace_owner_id !== currentUserId;
            return (
              <div key={d.id} className="card">
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 220, flex: "1 1 320px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 6,
                      }}
                    >
                      <strong style={{ fontSize: "1rem" }}>{d.domain_name}</strong>
                      {shared ? (
                        <span style={pill("#b79be8", "rgba(150,110,220,.14)")}>
                          Shared by {ownerEmails[d.workspace_owner_id] ?? "another workspace"}
                        </span>
                      ) : null}
                      {d.associated_system?.trim() ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSystemFilter(
                              systemFilter === d.associated_system
                                ? "all"
                                : d.associated_system!.trim()
                            )
                          }
                          style={{
                            ...pill("var(--sky)", "rgba(90,169,230,.12)"),
                            cursor: "pointer",
                          }}
                        >
                          {d.associated_system}
                        </button>
                      ) : null}
                      <span
                        style={pill(
                          d.account_ownership === "agency_master"
                            ? "var(--amber)"
                            : "var(--paper-dim)",
                          "transparent"
                        )}
                      >
                        {d.account_ownership === "agency_master"
                          ? "Agency account"
                          : "Client account"}
                      </span>
                      {d.auto_renew ? (
                        <span style={pill("#7CC084", "rgba(120,180,120,.14)")}>
                          Auto-renew on
                        </span>
                      ) : (
                        <span style={pill("#ffb066", "rgba(200,120,40,.14)")}>
                          Auto-renew off
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--paper-dim)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <F label="Registrar" value={d.registrar} />
                      <F label="Registrar account" value={d.registrar_account} />
                      <F label="DNS provider" value={d.dns_provider} />
                      <F label="DNS account" value={d.dns_account} />
                      <F label="Nameservers" value={d.nameservers} mono />
                      <div>
                        <span style={{ color: "var(--muted)" }}>Domain renewal: </span>
                        <span style={{ color: exp.color }}>{exp.label}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--muted)" }}>SSL: </span>
                        <span style={{ color: ssl.color }}>
                          {d.ssl_expires_at ? ssl.label : "Not tracked"}
                        </span>
                        {d.ssl_provider ? (
                          <span style={{ color: "var(--muted)" }}> · {d.ssl_provider}</span>
                        ) : null}
                      </div>
                      <F label="Notes" value={d.notes} />
                    </div>
                  </div>

                  {!shared ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setErr(null);
                          setForm({
                            id: d.id,
                            domain_name: d.domain_name,
                            associated_system: d.associated_system ?? "",
                            registrar: d.registrar ?? "",
                            registrar_account: d.registrar_account ?? "",
                            dns_provider: d.dns_provider ?? "",
                            dns_account: d.dns_account ?? "",
                            nameservers: d.nameservers ?? "",
                            expires_at: d.expires_at ? d.expires_at.slice(0, 10) : "",
                            auto_renew: d.auto_renew,
                            ssl_expires_at: d.ssl_expires_at
                              ? d.ssl_expires_at.slice(0, 10)
                              : "",
                            ssl_provider: d.ssl_provider ?? "",
                            account_ownership: d.account_ownership,
                            registrar_credential_id: d.registrar_credential_id ?? "",
                            notes: d.notes ?? "",
                          });
                        }}
                        disabled={busy !== null}
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => remove(d.id, d.domain_name)}
                        disabled={busy !== null}
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form ? (
        <DomainForm
          form={form}
          setForm={setForm}
          systems={systems}
          credentials={credentials}
          onSave={save}
          onCancel={() => {
            setForm(null);
            setErr(null);
          }}
          busy={busy === "save"}
          error={err}
        />
      ) : null}
    </>
  );
}

function DomainForm({
  form,
  setForm,
  systems,
  credentials,
  onSave,
  onCancel,
  busy,
  error,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  systems: string[];
  credentials: Array<{ id: string; name: string }>;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const editing = Boolean(form.id);
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.65)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--ink)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 560,
          width: "100%",
          margin: "24px 0",
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem" }}>
          {editing ? "Edit domain" : "Add domain"}
        </h2>
        <p style={{ margin: "0 0 20px", color: "var(--paper-dim)", fontSize: "0.85rem" }}>
          Only the domain name is required. Everything else is optional &mdash; fill in
          what you know.
        </p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={lbl}>Domain name</label>
          <input
            type="text"
            value={form.domain_name}
            onChange={(e) => setForm({ ...form, domain_name: e.target.value })}
            placeholder="example.com"
            style={{ width: "100%" }}
            autoFocus
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={lbl}>App / tool / system</label>
          <input
            type="text"
            list="domain-systems"
            value={form.associated_system ?? ""}
            onChange={(e) => setForm({ ...form, associated_system: e.target.value })}
            placeholder="e.g. Acme storefront"
            style={{ width: "100%" }}
          />
          <datalist id="domain-systems">
            {systems.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
            Use the same tag as the credentials for this project and they&apos;ll share
            a filter &mdash; and one share covers both.
          </small>
        </div>

        <Row>
          <Fld label="Registrar">
            <input
              type="text"
              value={form.registrar ?? ""}
              onChange={(e) => setForm({ ...form, registrar: e.target.value })}
              placeholder="e.g. Namecheap"
              style={{ width: "100%" }}
            />
          </Fld>
          <Fld label="Registrar login">
            <input
              type="text"
              value={form.registrar_account ?? ""}
              onChange={(e) => setForm({ ...form, registrar_account: e.target.value })}
              placeholder="which account it sits under"
              style={{ width: "100%" }}
            />
          </Fld>
        </Row>

        <Row>
          <Fld label="DNS provider">
            <input
              type="text"
              value={form.dns_provider ?? ""}
              onChange={(e) => setForm({ ...form, dns_provider: e.target.value })}
              placeholder="e.g. Cloudflare"
              style={{ width: "100%" }}
            />
          </Fld>
          <Fld label="DNS login">
            <input
              type="text"
              value={form.dns_account ?? ""}
              onChange={(e) => setForm({ ...form, dns_account: e.target.value })}
              placeholder="which account manages DNS"
              style={{ width: "100%" }}
            />
          </Fld>
        </Row>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={lbl}>Nameservers</label>
          <textarea
            value={form.nameservers ?? ""}
            onChange={(e) => setForm({ ...form, nameservers: e.target.value })}
            rows={2}
            style={{ width: "100%", resize: "vertical" }}
            placeholder="ns1.example.com, ns2.example.com"
          />
        </div>

        <Row>
          <Fld label="Domain expires">
            <input
              type="date"
              value={form.expires_at ?? ""}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              style={{ width: "100%" }}
            />
          </Fld>
          <Fld label="SSL expires">
            <input
              type="date"
              value={form.ssl_expires_at ?? ""}
              onChange={(e) => setForm({ ...form, ssl_expires_at: e.target.value })}
              style={{ width: "100%" }}
            />
          </Fld>
        </Row>

        <Row>
          <Fld label="SSL provider">
            <input
              type="text"
              value={form.ssl_provider ?? ""}
              onChange={(e) => setForm({ ...form, ssl_provider: e.target.value })}
              placeholder="e.g. Let's Encrypt, Cloudflare"
              style={{ width: "100%" }}
            />
          </Fld>
          <Fld label="Who owns the account?">
            <select
              value={form.account_ownership}
              onChange={(e) =>
                setForm({
                  ...form,
                  account_ownership: e.target.value as "agency_master" | "client_own",
                })
              }
              style={{ width: "100%" }}
            >
              <option value="client_own">Client&apos;s own account</option>
              <option value="agency_master">Agency master account</option>
            </select>
          </Fld>
        </Row>

        {credentials.length > 0 ? (
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={lbl}>Registrar API credential</label>
            <select
              value={form.registrar_credential_id ?? ""}
              onChange={(e) =>
                setForm({ ...form, registrar_credential_id: e.target.value })
              }
              style={{ width: "100%" }}
            >
              <option value="">None</option>
              {credentials.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              Links this domain to the vault credential that manages it.
            </small>
          </div>
        ) : null}

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginBottom: 14,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={form.auto_renew}
            onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })}
          />
          <span>Auto-renew is enabled at the registrar</span>
        </label>

        <div className="field" style={{ marginBottom: 20 }}>
          <label style={lbl}>Notes</label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            style={{ width: "100%", resize: "vertical" }}
            placeholder="Anything the next person needs to know"
          />
        </div>

        {error ? <div style={errStyle}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-amber" onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add domain"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field" style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );
}

function F({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const has = Boolean(value && value.trim());
  return (
    <div>
      <span style={{ color: "var(--muted)" }}>{label}: </span>
      {has ? (
        mono ? (
          <code style={{ color: "var(--paper)" }}>{value}</code>
        ) : (
          <span style={{ color: "var(--paper)" }}>{value}</span>
        )
      ) : (
        <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Not set</span>
      )}
    </div>
  );
}

function pill(color: string, bg: string): React.CSSProperties {
  return {
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: "0.7rem",
    color,
    background: bg,
    border: `1px solid ${color === "var(--paper-dim)" ? "var(--line)" : `${color}55`}`,
  };
}

const lbl: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  color: "var(--paper-dim)",
  marginBottom: 4,
};

const errStyle: React.CSSProperties = {
  padding: "10px 12px",
  marginBottom: 12,
  border: "1px solid rgba(240,80,80,.3)",
  background: "rgba(240,80,80,.1)",
  color: "#ffb3b3",
  borderRadius: 8,
  fontSize: "0.85rem",
};
