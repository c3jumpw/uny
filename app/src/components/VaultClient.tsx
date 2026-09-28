"use client";

import { useState, useMemo } from "react";
import { RevealCredential } from "@/components/RevealCredential";
import { useRouter } from "next/navigation";
import {
  PROVIDERS,
  AUTH_SCHEMES,
  providerLabel,
  type AuthScheme,
  HEALTH_DISPLAY,
  expiryState,
  integrationPriority,
  type Integration,
  type IntegrationType,
} from "@/lib/integrations";

type FormState = {
  id?: string;
  name: string;
  associated_system: string;
  custom_provider_name: string;
  auth_scheme: AuthScheme;
  auth_param_name: string;
  integration_type: IntegrationType;
  credential: string;
  env_var_name: string;
  callback_url: string;
  base_url: string;
  expires_at: string;
  account_identifier: string;
  account_ownership: "agency_master" | "client_own";
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  associated_system: "",
  custom_provider_name: "",
  auth_scheme: "bearer",
  auth_param_name: "",
  integration_type: "github_pat",
  credential: "",
  env_var_name: "",
  callback_url: "",
  base_url: "",
  expires_at: "",
  account_identifier: "",
  account_ownership: "client_own",
  notes: "",
};

export type IntegrationEvent = {
  integration_id: string;
  actor_email: string | null;
  event_type: string;
  detail: string | null;
  created_at: string;
};

export function VaultClient({
  integrations,
  currentUserId,
  ownerEmails,
  events,
}: {
  integrations: Integration[];
  currentUserId?: string | null;
  ownerEmails?: Record<string, string>;
  events?: Record<string, IntegrationEvent[]>;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [systemFilter, setSystemFilter] = useState<string>("all");

  // Existing values double as the suggestion list in the form and
  // as the filter options here, so the vocabulary stays consistent
  // without having to be enforced.
  const systems = useMemo(() => {
    const set = new Set<string>();
    for (const i of integrations) {
      if (i.associated_system?.trim()) set.add(i.associated_system.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [integrations]);

  const visible = useMemo(() => {
    if (systemFilter === "all") return integrations;
    if (systemFilter === "__untagged")
      return integrations.filter((i) => !i.associated_system?.trim());
    return integrations.filter(
      (i) => i.associated_system?.trim() === systemFilter
    );
  }, [integrations, systemFilter]);

  const sorted = useMemo(
    () =>
      [...visible].sort((a, b) => {
        // Health and expiry urgency still win — a dead credential
        // matters more than tidy grouping. Within equal urgency,
        // fall back to grouping by system so related credentials
        // sit next to each other.
        const p = integrationPriority(b) - integrationPriority(a);
        if (p !== 0) return p;
        const as = a.associated_system ?? "";
        const bs = b.associated_system ?? "";
        if (as !== bs) return as.localeCompare(bs);
        return a.name.localeCompare(b.name);
      }),
    [visible]
  );

  // Attention count is deliberately over ALL integrations, not the
  // filtered view: a failure hiding under a filter you aren't
  // looking at is exactly the thing this page exists to prevent.
  const needsAttention = integrations.filter(
    (i) =>
      i.health_status === "failed" ||
      i.health_status === "degraded" ||
      expiryState(i.expires_at).urgent
  ).length;

  async function checkHealth(id?: string) {
    setBusy(id ?? "all");
    setErr(null);
    try {
      const res = await fetch("/api/integrations/health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr((j as { error?: string }).error ?? "Health check failed.");
      }
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Health check failed.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!form || !form.name.trim()) {
      setErr("Name is required.");
      return;
    }
    setBusy("save");
    setErr(null);
    try {
      const editing = Boolean(form.id);
      const payload: Record<string, unknown> = {
        name: form.name,
        associated_system: form.associated_system,
        custom_provider_name: form.custom_provider_name,
        auth_scheme: form.auth_scheme,
        auth_param_name: form.auth_param_name,
        integration_type: form.integration_type,
        env_var_name: form.env_var_name,
        callback_url: form.callback_url,
        base_url: form.base_url,
        expires_at: form.expires_at || null,
        account_identifier: form.account_identifier,
        account_ownership: form.account_ownership,
        notes: form.notes,
      };
      if (editing) payload.id = form.id;
      if (form.credential.trim()) payload.credential = form.credential;

      const res = await fetch("/api/integrations", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr((j as { error?: string }).error ?? "Save failed.");
        setBusy(null);
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
    if (!confirm(`Delete "${name}"? The stored credential will be destroyed.`)) return;
    setBusy(id);
    try {
      await fetch(`/api/integrations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function startEdit(i: Integration) {
    setErr(null);
    setForm({
      id: i.id,
      name: i.name,
      associated_system: i.associated_system ?? "",
      custom_provider_name: i.custom_provider_name ?? "",
      auth_scheme: i.auth_scheme ?? "bearer",
      auth_param_name: i.auth_param_name ?? "",
      integration_type: i.integration_type,
      credential: "",
      env_var_name: i.env_var_name ?? "",
      callback_url: i.callback_url ?? "",
      base_url: i.base_url ?? "",
      expires_at: i.expires_at ? i.expires_at.slice(0, 10) : "",
      account_identifier: i.account_identifier ?? "",
      account_ownership: i.account_ownership,
      notes: i.notes ?? "",
    });
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
          {integrations.length === 0 ? (
            "No integrations yet."
          ) : needsAttention > 0 ? (
            <>
              <strong style={{ color: "#ffb066" }}>
                {needsAttention} need{needsAttention === 1 ? "s" : ""} attention
              </strong>{" "}
              of {integrations.length} tracked.
            </>
          ) : (
            <>All {integrations.length} integrations look healthy.</>
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
              {systems.map((sys) => (
                <option key={sys} value={sys}>
                  {sys}
                </option>
              ))}
              <option value="__untagged">Untagged</option>
            </select>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => checkHealth()}
            disabled={busy !== null || integrations.length === 0}
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            {busy === "all" ? "Checking…" : "Check all"}
          </button>
          <button
            type="button"
            className="btn btn-amber"
            onClick={() => {
              setErr(null);
              setForm({ ...EMPTY_FORM });
            }}
            style={{ padding: "8px 14px", fontSize: "0.85rem" }}
          >
            Add integration
          </button>
        </div>
      </div>

      {err ? (
        <div
          style={{
            padding: "10px 14px",
            marginBottom: 16,
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

      {sorted.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p style={{ margin: "0 0 6px", color: "var(--paper)" }}>
            Nothing stored yet.
          </p>
          <p style={{ margin: 0, color: "var(--paper-dim)", fontSize: "0.9rem" }}>
            Add the API keys, tokens and URLs your app depends on. UnyBase will check
            they still work and warn you before they expire.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {sorted.map((i) => {
            const health = HEALTH_DISPLAY[i.health_status];
            const exp = expiryState(i.expires_at);
            const provider = PROVIDERS[i.integration_type];
            return (
              <div key={i.id} className="card">
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
                      <strong style={{ fontSize: "1rem" }}>{i.name}</strong>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: "0.7rem",
                          color: "var(--paper-dim)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        {providerLabel(i)}
                      </span>
                      {currentUserId && i.workspace_owner_id !== currentUserId ? (
                        <span
                          title="Shared with you by another workspace"
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: "0.7rem",
                            color: "#b79be8",
                            background: "rgba(150,110,220,.14)",
                            border: "1px solid rgba(150,110,220,.3)",
                          }}
                        >
                          Shared by {ownerEmails?.[i.workspace_owner_id] ?? "another workspace"}
                        </span>
                      ) : null}
                      {i.associated_system?.trim() ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSystemFilter(
                              systemFilter === i.associated_system
                                ? "all"
                                : i.associated_system!.trim()
                            )
                          }
                          title="Filter by this system"
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: "0.7rem",
                            color: "var(--sky)",
                            background: "rgba(90,169,230,.12)",
                            border: "1px solid rgba(90,169,230,.3)",
                            cursor: "pointer",
                          }}
                        >
                          {i.associated_system}
                        </button>
                      ) : null}
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: health.color,
                          background: health.bg,
                          border: `1px solid ${health.color}33`,
                        }}
                      >
                        {health.label}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: "0.7rem",
                          color:
                            i.account_ownership === "agency_master"
                              ? "var(--amber)"
                              : "var(--paper-dim)",
                          border: `1px solid ${
                            i.account_ownership === "agency_master"
                              ? "rgba(242,169,59,.35)"
                              : "var(--line)"
                          }`,
                        }}
                      >
                        {i.account_ownership === "agency_master"
                          ? "Agency account"
                          : "Client account"}
                      </span>
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
                      <div>
                        <span style={{ color: "var(--muted)" }}>Credential: </span>
                        {i.credential_hint ? (
                          <RevealCredential
                            integrationId={i.id}
                            hint={i.credential_hint}
                          />
                        ) : (
                          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>
                            Not set
                          </span>
                        )}
                      </div>
                      <Field label="System" value={i.associated_system} />
                      <Field label="Account" value={i.account_identifier} />
                      <Field label="Env var" value={i.env_var_name} mono />
                      <Field label="URL" value={i.base_url} />
                      <Field label="Callback" value={i.callback_url} />
                      <div>
                        <span style={{ color: "var(--muted)" }}>Expiry: </span>
                        <span style={{ color: exp.color }}>{exp.label}</span>
                      </div>
                      <Field
                        label="Last rotated"
                        value={
                          i.last_regenerated_at
                            ? new Date(i.last_regenerated_at).toLocaleDateString()
                            : null
                        }
                      />
                      <Field label="Notes" value={i.notes} />
                    </div>

                    <HistoryDisclosure entries={events?.[i.id] ?? []} />

                    {i.health_detail ? (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: "0.75rem",
                          color: "var(--muted)",
                          borderLeft: `2px solid ${health.color}55`,
                          paddingLeft: 8,
                        }}
                      >
                        {i.health_detail}
                        {i.last_health_check_at ? (
                          <> &middot; checked {new Date(i.last_health_check_at).toLocaleString()}</>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => checkHealth(i.id)}
                      disabled={busy !== null}
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    >
                      {busy === i.id ? "Checking…" : "Check"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => startEdit(i)}
                      disabled={busy !== null}
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      onClick={() => remove(i.id, i.name)}
                      disabled={busy !== null}
                      style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form ? (
        <IntegrationForm
          form={form}
          systems={systems}
          setForm={setForm}
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

function IntegrationForm({
  form,
  systems,
  setForm,
  onSave,
  onCancel,
  busy,
  error,
}: {
  form: FormState;
  systems: string[];
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
  error: string | null;
}) {
  const provider = PROVIDERS[form.integration_type];
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
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: "1.2rem" }}>
          {editing ? "Edit integration" : "Add integration"}
        </h2>
        <p style={{ margin: "0 0 20px", color: "var(--paper-dim)", fontSize: "0.85rem" }}>
          {provider.hint} Only a name is required &mdash; every other field is optional,
          since what each integration needs depends on how the account is set up.
        </p>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Acme Corp GitHub deploy token"
            style={{ width: "100%" }}
            autoFocus
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>App / tool / system</label>
          <input
            type="text"
            list="vault-systems"
            value={form.associated_system}
            onChange={(e) => setForm({ ...form, associated_system: e.target.value })}
            placeholder="e.g. Acme storefront, Internal CRM, Staging"
            style={{ width: "100%" }}
          />
          <datalist id="vault-systems">
            {systems.map((sys) => (
              <option key={sys} value={sys} />
            ))}
          </datalist>
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
            Which app or system this credential belongs to. Lets you tell two
            credentials from the same provider apart, and group everything one app
            depends on.
          </small>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Provider</label>
          <select
            value={form.integration_type}
            onChange={(e) =>
              setForm({ ...form, integration_type: e.target.value as IntegrationType })
            }
            style={{ width: "100%" }}
            disabled={editing}
          >
            {Object.entries(PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          {editing ? (
            <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
              Provider can&apos;t change after creation. Delete and re-add instead.
            </small>
          ) : null}
        </div>

        {form.integration_type === "custom" ? (
          <>
            <div className="field" style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Provider name</label>
              <input
                type="text"
                value={form.custom_provider_name}
                onChange={(e) =>
                  setForm({ ...form, custom_provider_name: e.target.value })
                }
                placeholder="e.g. Stripe, Twilio, Airtable, internal API"
                style={{ width: "100%" }}
              />
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                Shown on the card in place of a built-in provider name.
              </small>
            </div>

            <div className="field" style={{ marginBottom: 14 }}>
              <label style={labelStyle}>How it authenticates</label>
              <select
                value={form.auth_scheme}
                onChange={(e) =>
                  setForm({ ...form, auth_scheme: e.target.value as AuthScheme })
                }
                style={{ width: "100%" }}
              >
                {AUTH_SCHEMES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
                Used only for the health check, so we send the credential the way
                this provider expects.
              </small>
            </div>

            {form.auth_scheme === "header" || form.auth_scheme === "query" ? (
              <div className="field" style={{ marginBottom: 14 }}>
                <label style={labelStyle}>
                  {form.auth_scheme === "header" ? "Header name" : "Query parameter name"}
                </label>
                <input
                  type="text"
                  value={form.auth_param_name}
                  onChange={(e) =>
                    setForm({ ...form, auth_param_name: e.target.value })
                  }
                  placeholder={
                    form.auth_scheme === "header" ? "e.g. X-API-Key" : "e.g. api_key"
                  }
                  style={{ width: "100%" }}
                />
              </div>
            ) : null}
          </>
        ) : null}

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>
            {provider.credentialLabel}
            {editing ? " (leave blank to keep current)" : ""}
          </label>
          <input
            type="password"
            value={form.credential}
            onChange={(e) => setForm({ ...form, credential: e.target.value })}
            placeholder={editing ? "••••••••  unchanged" : "Paste the token or key"}
            style={{ width: "100%" }}
            autoComplete="new-password"
          />
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
            Encrypted before it reaches the database. Never shown again after saving.
          </small>
        </div>

        {provider.needsBaseUrl ? (
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{provider.baseUrlLabel ?? "URL"}</label>
            <input
              type="text"
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="https://…"
              style={{ width: "100%" }}
            />
          </div>
        ) : null}

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Account this belongs to</label>
          <input
            type="text"
            value={form.account_identifier}
            onChange={(e) => setForm({ ...form, account_identifier: e.target.value })}
            placeholder="e.g. c3jumpw, billing@acme.com"
            style={{ width: "100%" }}
          />
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
            The login on the provider&apos;s side. Matters when offboarding.
          </small>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Who owns that account?</label>
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
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
            Drives who gets billed and what has to be handed over if the client leaves.
          </small>
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Environment variable name</label>
          <input
            type="text"
            value={form.env_var_name}
            onChange={(e) => setForm({ ...form, env_var_name: e.target.value })}
            placeholder="e.g. GITHUB_TOKEN"
            style={{ width: "100%" }}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Callback URL</label>
          <input
            type="text"
            value={form.callback_url}
            onChange={(e) => setForm({ ...form, callback_url: e.target.value })}
            placeholder="Where the provider sends requests back, if any"
            style={{ width: "100%" }}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Expires on</label>
          <input
            type="date"
            value={form.expires_at}
            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
            style={{ width: "100%" }}
          />
          <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>
            Leave blank if the credential doesn&apos;t expire.
          </small>
        </div>

        <div className="field" style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            style={{ width: "100%", resize: "vertical" }}
            placeholder="Anything the next person needs to know"
          />
        </div>

        {error ? (
          <div
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
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-amber" onClick={onSave} disabled={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Add integration"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  color: "var(--paper-dim)",
  marginBottom: 4,
};


// Every field renders whether or not it has a value. Which
// credentials and URLs an integration needs varies by provider and
// by how the client's system is wired, so a blank field is normal
// rather than an error — but hiding it entirely makes the card look
// like the information was never asked for. Showing "Not set" keeps
// the shape of the record visible.
function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const has = Boolean(value && String(value).trim());
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


// Access and change history for one credential.
//
// Collapsed by default: on a normal day the history is noise, and
// on the day a key leaks it is the first thing you want. Reveals
// are highlighted because "who saw this" is the question that
// actually matters, while health checks are routine chatter.
function HistoryDisclosure({ entries }: { entries: IntegrationEvent[] }) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  const reveals = entries.filter((e) => e.event_type === "credential_revealed").length;

  return (
    <div style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          padding: 0,
          border: "none",
          background: "transparent",
          color: "var(--sky)",
          fontSize: "0.75rem",
          cursor: "pointer",
        }}
      >
        {open ? "Hide history" : "History"}
        {reveals > 0 ? (
          <span style={{ color: "var(--muted)" }}>
            {" "}
            · {reveals} reveal{reveals === 1 ? "" : "s"}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            marginTop: 6,
            paddingLeft: 10,
            borderLeft: "2px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {entries.map((e, idx) => {
            const isReveal = e.event_type === "credential_revealed";
            const isRotate = e.event_type === "credential_rotated";
            return (
              <div key={idx} style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                <span
                  style={{
                    color: isReveal
                      ? "var(--amber)"
                      : isRotate
                        ? "var(--sky)"
                        : "var(--muted)",
                  }}
                >
                  {e.event_type.replace(/_/g, " ")}
                </span>
                {e.actor_email ? (
                  <span> · {e.actor_email}</span>
                ) : null}
                <span> · {new Date(e.created_at).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
