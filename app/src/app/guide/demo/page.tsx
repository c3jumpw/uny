// Demo screens for the user guide's screenshots.
//
// Renders the real UnyBase components with a made-up workspace
// ("Acme Studio"), so the guide can show every page without anyone's
// data. Switched off unless GUIDE_CAPTURE=1 is set, so production
// never serves it. To refresh the guide's screenshots after a UI
// change, see scripts/capture-guide.cjs.
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { DashboardNav } from "@/components/DashboardNav";
import { OverviewView } from "@/components/OverviewView";
import { VaultClient, type IntegrationEvent } from "@/components/VaultClient";
import { VaultSharing, type VaultShare } from "@/components/VaultSharing";
import { DomainsClient, type DomainRow } from "@/components/DomainsClient";
import { ChangesClient, type ChangeRequest } from "@/components/ChangesClient";
import { GrantsClient, type Grant } from "@/components/GrantsClient";
import { PlansClient } from "@/components/PlansClient";
import { PLANS } from "@/lib/plans";
import type { Integration } from "@/lib/integrations";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminSubscriptionsView, type AdminRow, type ActionRow, type SyncRow } from "@/components/AdminSubscriptionsView";
import { SitesClient, type SiteView } from "@/components/SitesClient";
import { computeStatus, sortByPriority, type StatusRow } from "@/lib/subscriptionStatus";
import { BUILDER_PROMPT, BUILDER_PROMPT_VERSION } from "@/lib/builderPrompt";
import type { UserRole } from "@/lib/admin";

const ME = "user-jane";
const DAY = 86_400_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const base = {
  workspace_owner_id: ME,
  custom_provider_name: null,
  auth_scheme: "bearer" as const,
  auth_param_name: null,
  credential_ciphertext: "x",
  credential_iv: "x",
  credential_tag: "x",
  callback_url: null,
  base_url: null,
  last_regenerated_at: null,
  notes: null,
  created_at: at(-40),
  updated_at: at(-2),
};

const INTEGRATIONS: Integration[] = [
  {
    ...base,
    id: "i1",
    name: "Storefront deploy token",
    associated_system: "Acme storefront",
    integration_type: "github_pat",
    credential_hint: "ghp_…9fQ2",
    env_var_name: "GITHUB_TOKEN",
    expires_at: at(6.5),
    last_regenerated_at: at(-84),
    account_identifier: "acme-studio",
    account_ownership: "client_own",
    last_health_check_at: at(-0.2),
    health_status: "healthy",
    health_detail: "Authenticated as acme-studio.",
    notes: "Rotate from GitHub → Settings → Developer settings. Used by the Vercel build.",
  },
  {
    ...base,
    id: "i2",
    name: "Payments API key",
    associated_system: "Acme storefront",
    integration_type: "custom",
    custom_provider_name: "Stripe",
    credential_hint: "sk_live_…4Hk1",
    env_var_name: "STRIPE_SECRET_KEY",
    base_url: "https://api.stripe.com/v1/balance",
    expires_at: null,
    account_identifier: "billing@acmestudio.com",
    account_ownership: "client_own",
    last_health_check_at: at(-0.2),
    health_status: "failed",
    health_detail: "401 Unauthorized — the key was rolled or revoked.",
  },
  {
    ...base,
    id: "i3",
    name: "Database service key",
    associated_system: "Acme storefront",
    integration_type: "supabase",
    credential_hint: "eyJh…J0wQ",
    env_var_name: "SUPABASE_SERVICE_ROLE_KEY",
    base_url: "https://acme-store.supabase.co",
    expires_at: null,
    account_identifier: "acme-store",
    account_ownership: "client_own",
    last_health_check_at: at(-0.2),
    health_status: "healthy",
    health_detail: "Project responded normally.",
  },
  {
    ...base,
    id: "i4",
    name: "Hosting token",
    associated_system: "Internal CRM",
    integration_type: "vercel",
    credential_hint: "vcp_…7Lr0",
    env_var_name: "VERCEL_TOKEN",
    expires_at: at(45),
    account_identifier: "agency-team",
    account_ownership: "agency_master",
    last_health_check_at: null,
    health_status: "unknown",
    health_detail: null,
  },
];

const EVENTS: Record<string, IntegrationEvent[]> = {
  i1: [
    { integration_id: "i1", actor_email: "scheduled-sweep", event_type: "health_check_passed", detail: "Authenticated as acme-studio.", created_at: at(-0.2) },
    { integration_id: "i1", actor_email: "jane@acmestudio.com", event_type: "credential_revealed", detail: null, created_at: at(-3) },
    { integration_id: "i1", actor_email: "jane@acmestudio.com", event_type: "updated", detail: null, created_at: at(-12) },
  ],
};

const SHARES: VaultShare[] = [
  {
    id: "s1",
    grantee_email: "sam@pixelforge.dev",
    scope_type: "system",
    scope_value: "Acme storefront",
    scope_label: "Acme storefront",
    note: "Contractor on the storefront rebuild",
    granted_at: at(-10),
    expires_at: at(20),
    revoked_at: null,
  },
];

const DOMAINS: DomainRow[] = [
  {
    id: "d1",
    workspace_owner_id: ME,
    domain_name: "acmestudio.com",
    associated_system: "Acme storefront",
    registrar: "Namecheap",
    registrar_account: "acme-studio",
    dns_provider: "Cloudflare",
    dns_account: "jane@acmestudio.com",
    nameservers: "ada.ns.cloudflare.com, rob.ns.cloudflare.com",
    expires_at: at(12.5),
    auto_renew: false,
    ssl_expires_at: at(61),
    ssl_provider: "Cloudflare",
    account_ownership: "client_own",
    registrar_credential_id: null,
    notes: "Renew for 2 years next time.",
  },
  {
    id: "d2",
    workspace_owner_id: ME,
    domain_name: "crm.acmestudio.com",
    associated_system: "Internal CRM",
    registrar: "Namecheap",
    registrar_account: "acme-studio",
    dns_provider: "Cloudflare",
    dns_account: "jane@acmestudio.com",
    nameservers: null,
    expires_at: at(212),
    auto_renew: true,
    ssl_expires_at: at(28),
    ssl_provider: "Let's Encrypt",
    account_ownership: "agency_master",
    registrar_credential_id: null,
    notes: null,
  },
];

const cr = (
  i: number,
  body: string,
  status: ChangeRequest["status"],
  kind: ChangeRequest["kind"],
  sys: string,
  daysAgo: number,
  priority: ChangeRequest["priority"] = "normal"
): ChangeRequest => ({
  id: `c${i}`,
  workspace_owner_id: ME,
  created_by: ME,
  created_by_email: "jane@acmestudio.com",
  body,
  associated_system: sys,
  kind,
  priority,
  status,
  status_note: status === "done" ? "Live in v2.4" : null,
  sent_at: status !== "pending" ? at(-(daysAgo - 1)) : null,
  done_at: status === "done" ? at(-(daysAgo - 3)) : null,
  dropped_at: null,
  created_at: at(-daysAgo),
  updated_at: at(-1),
});

const CHANGES: ChangeRequest[] = [
  cr(1, "Checkout button overlaps the logo on mobile", "pending", "fix", "Acme storefront", 0, "high"),
  cr(2, "Add CSV export to the orders table", "pending", "new", "Acme storefront", 0),
  cr(3, "Rename “Leads” to “Prospects” in the menu", "sent", "change", "Internal CRM", 2),
  cr(4, "Hero video doesn't autoplay on Safari", "sent", "fix", "Acme storefront", 2),
  cr(5, "Show prices with tax on product pages", "done", "change", "Acme storefront", 6),
];

const GRANTS: Grant[] = [
  {
    id: "g1",
    technical_admin_email: "support@pixelforge.dev",
    granted_at: at(-20),
    expires_at: null,
    revoked_at: null,
    note: "Our development agency",
  },
];

// ---------------------------------------------------------------
// Admin screens (Subscriptions, Client sites) for the tour's admin
// tracks. Sample accounts only.
// ---------------------------------------------------------------

const ACCOUNTS: Array<{ id: string; email: string; status: Partial<StatusRow>; events?: string[] }> = [
  {
    id: "u-joes",
    email: "owner@joestires.com",
    status: { created_at: at(-400), subscription_state: "lapsed", last_payment_at: at(-52), last_payment_failed_at: at(-21), active_plan: "basic", active_cycle: "monthly", systeme_signup_tagged_at: at(-90), systeme_customer_tagged_at: at(-88) } as Partial<StatusRow>,
    events: ["payment.failed", "payment.failed"],
  },
  {
    id: "u-bright",
    email: "admin@brightsmile.com",
    status: { created_at: at(-120), subscription_state: "lapsed", last_payment_at: at(-33), last_payment_failed_at: at(-2), active_plan: "premium", active_cycle: "monthly", systeme_signup_tagged_at: at(-60), systeme_customer_tagged_at: at(-58) } as Partial<StatusRow>,
    events: ["payment.failed"],
  },
  {
    id: "u-marco",
    email: "marco@marcoscatering.com",
    status: { created_at: at(-4), subscription_state: "never_paid", trial_started_at: at(-4), trial_ends_at: at(10), trial_note: "Demo call: evaluating for 2 sites", intended_plan: "basic", plan_selected_at: at(-4), systeme_signup_tagged_at: at(-4) } as Partial<StatusRow>,
  },
  {
    id: "u-river",
    email: "hello@riversidegym.com",
    status: { created_at: at(-300), subscription_state: "active", last_payment_at: at(-5), active_plan: "premium", active_cycle: "yearly", systeme_signup_tagged_at: at(-200), systeme_customer_tagged_at: at(-199) } as Partial<StatusRow>,
    events: ["payment.succeeded"],
  },
  {
    id: "u-new",
    email: "sam@newbakery.co",
    status: { created_at: at(-4), subscription_state: "never_paid", systeme_signup_tagged_at: at(-4) } as Partial<StatusRow>,
  },
  {
    id: "u-internal",
    email: "admin@unywebs.com",
    status: { created_at: at(-500), subscription_state: "never_paid", billing_exempt: true, exempt_reason: "Unywebs internal account" } as Partial<StatusRow>,
  },
];

function adminRows(ids?: string[]): AdminRow[] {
  const rows = ACCOUNTS.filter((a) => !ids || ids.includes(a.id)).map((a) => {
    const status = {
      user_id: a.id,
      last_payment_at: null,
      last_payment_failed_at: null,
      subscription_state: "never_paid",
      automations_active: true,
      cut_off_at: null,
      ...a.status,
    } as StatusRow;
    return {
      user: { user_id: a.id, email: a.email, is_super_admin: false, created_at: status.created_at },
      status,
      statusMeta: computeStatus(status),
      key: { user_id: a.id, revoked_at: null },
      events: (a.events ?? []).map((t, i) => ({ user_id: a.id, event_type: t, received_at: at(-2 - i * 30) })),
    } as AdminRow;
  });
  return sortByPriority(rows);
}

const ADMIN_ACTIONS: ActionRow[] = [
  { id: "a1", admin_email: "admin@unywebs.com", target_email: "owner@joestires.com", action_type: "site_paused", notes: "Joe's Tires booking app: Invoice 1042 unpaid after reminders", created_at: at(-0.05) },
  { id: "a2", admin_email: "admin@unywebs.com", target_email: "marco@marcoscatering.com", action_type: "trial_started", notes: "Demo call: evaluating for 2 sites", created_at: at(-4) },
  { id: "a3", admin_email: "support@pixelforge.dev", target_email: "hello@riversidegym.com", action_type: "restore", notes: null, created_at: at(-9) },
  { id: "a4", admin_email: "admin@unywebs.com", target_email: "admin@unywebs.com", action_type: "exempt", notes: "Unywebs internal account", created_at: at(-30) },
];

const SYNC_LOG: SyncRow[] = [
  { id: "s1", email: "hello@riversidegym.com", action: "tag:unybase-customer", ok: true, status_code: 204, detail: null, created_at: at(-0.4) },
  { id: "s2", email: "sam@newbakery.co", action: "tag:unybase-signup", ok: true, status_code: 204, detail: null, created_at: at(-4) },
  { id: "s3", email: "marco@marcoscatering.com", action: "tag:unybase-signup", ok: false, status_code: 404, detail: "Contact not found in systeme.io yet", created_at: at(-4.1) },
];

const SITES: SiteView[] = [
  { id: "1", siteName: "Joe's Tires booking app", clientName: "Joe's Tires", domain: "book.joestires.com", notes: "Monthly retainer", keyPrefix: "unyl_3f9a2c7", mode: "paused", overrideReason: "Invoice 1042 unpaid after reminders", overrideSetAt: at(-0.05), createdAt: at(-40), lastCheckedAt: at(-0.0005), lastCheckOrigin: "book.joestires.com", keyRotatedAt: null, retiredAt: null, state: "paused", ownerEmail: "owner@joestires.com", account: { label: "21d lapsed — cutoff recommended", color: "#ffb3b3", bg: "rgba(180,30,30,.35)", hint: "" } },
  { id: "2", siteName: "Bright Smile patient portal", clientName: "Bright Smile Dental", domain: "portal.brightsmile.com", notes: null, keyPrefix: "unyl_81bd04e", mode: "auto", overrideReason: null, overrideSetAt: null, createdAt: at(-20), lastCheckedAt: at(-0.0014), lastCheckOrigin: "https://portal.brightsmile.com", keyRotatedAt: null, retiredAt: null, state: "grace", ownerEmail: "admin@brightsmile.com", account: { label: "2d lapsed — grace period", color: "#ffd76a", bg: "rgba(200,170,50,.15)", hint: "" } },
  { id: "3", siteName: "Riverside Gym website", clientName: "Riverside Gym", domain: "riversidegym.com", notes: null, keyPrefix: "unyl_c0ffee1", mode: "auto", overrideReason: null, overrideSetAt: null, createdAt: at(-10), lastCheckedAt: at(-0.0008), lastCheckOrigin: null, keyRotatedAt: null, retiredAt: null, state: "active", ownerEmail: "hello@riversidegym.com", account: { label: "Active", color: "#7CC084", bg: "rgba(120,180,120,.15)", hint: "" } },
  { id: "4", siteName: "Marco's catering orders", clientName: "Marco's", domain: null, notes: "Pays by invoice, no UnyBase account", keyPrefix: "unyl_5e5e5e5", mode: "active", overrideReason: null, overrideSetAt: null, createdAt: at(-2), lastCheckedAt: null, lastCheckOrigin: null, keyRotatedAt: null, retiredAt: null, state: "active", ownerEmail: null, account: null },
];

function Shell({
  children,
  role = "client",
  email = "jane@acmestudio.com",
}: {
  children: React.ReactNode;
  role?: UserRole;
  email?: string;
}) {
  return (
    <>
      <DashboardNav role={role} email={email} />
      <main className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
        {children}
      </main>
    </>
  );
}

function Head({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>{title}</h1>
      <p style={{ margin: 0, color: "var(--paper-dim)" }}>{sub}</p>
    </div>
  );
}

export default async function GuidePreview({
  searchParams,
}: {
  searchParams: Promise<{ shot?: string }>;
}) {
  if (process.env.GUIDE_CAPTURE !== "1") notFound();
  const { shot = "overview" } = await searchParams;
  const link = { monthly: "#", yearly: "#" };

  if (shot === "admin" || shot === "admin-tech") {
    const tech = shot === "admin-tech";
    const rows = adminRows(tech ? ["u-joes", "u-river"] : undefined);
    return (
      <Shell role={tech ? "technical_admin" : "super_admin"} email={tech ? "support@pixelforge.dev" : "admin@unywebs.com"}>
        {tech ? null : <AdminTabs current="/admin" />}
        <AdminSubscriptionsView
          rows={rows}
          isSuperAdmin={!tech}
          scopeLabel={tech ? "2 workspaces granted to you" : `${rows.length} workspaces on the platform`}
          actions={tech ? ADMIN_ACTIONS.filter((a) => a.admin_email === "support@pixelforge.dev") : ADMIN_ACTIONS}
          syncLog={SYNC_LOG}
          systemeOn
          sitesByOwner={{ "u-joes": 1, "u-bright": 1 }}
        />
      </Shell>
    );
  }

  if (shot === "sites") {
    return (
      <Shell role="super_admin" email="admin@unywebs.com">
        <AdminTabs current="/admin/sites" />
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Client sites</h1>
          <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 760 }}>
            Every app Unywebs builds checks in here about once a minute. Pause one and its visitors see a
            neutral &ldquo;temporarily unavailable&rdquo; page within a minute. Nothing is deleted, webhooks keep
            running, and switching it back is just as quick. Nothing pauses on its own: a failed payment only
            moves a site to <em>grace</em>.
          </p>
        </div>
        <SitesClient
          sites={SITES}
          accounts={ACCOUNTS.map((a) => a.email)}
          prompt={BUILDER_PROMPT}
          promptVersion={BUILDER_PROMPT_VERSION}
        />
      </Shell>
    );
  }

  if (shot === "vault-shared") {
    return (
      <Shell email="alex@brightcode.dev">
        <Head
          title="Vault"
          sub="Every credential your apps depend on, with live health checks and expiry warnings. Credentials are encrypted before they reach the database."
        />
        <VaultSharing shares={[]} systems={[]} integrations={[]} />
        <VaultClient
          integrations={INTEGRATIONS.filter((i) => i.associated_system === "Acme storefront")}
          currentUserId="user-alex"
          ownerEmails={{ [ME]: "jane@acmestudio.com" }}
          events={EVENTS}
        />
      </Shell>
    );
  }

  if (shot === "plans") {
    return (
      <PlansClient
        email="jane@acmestudio.com"
        plans={PLANS}
        links={{ basic: link, premium: link }}
        dedicatedYearly={{ basic: false, premium: false }}
        defaultPlan="premium"
        defaultCycle="yearly"
        reason="needs_plan"
        trialEndedOn={null}
      />
    );
  }

  if (shot === "vault") {
    return (
      <Shell>
        <Head
          title="Vault"
          sub="Every credential your apps depend on, with live health checks and expiry warnings. Credentials are encrypted before they reach the database."
        />
        <VaultSharing
          shares={SHARES}
          systems={["Acme storefront", "Internal CRM"]}
          integrations={INTEGRATIONS.map((i) => ({ id: i.id, name: i.name }))}
        />
        <VaultClient integrations={INTEGRATIONS} currentUserId={ME} ownerEmails={{}} events={EVENTS} />
      </Shell>
    );
  }

  if (shot === "domains") {
    return (
      <Shell>
        <Head title="Domains" sub="Where each domain is registered, who owns the account, and when it renews." />
        <DomainsClient
          domains={DOMAINS}
          systems={["Acme storefront", "Internal CRM"]}
          credentials={INTEGRATIONS.map((i) => ({ id: i.id, name: i.name }))}
          currentUserId={ME}
          ownerEmails={{}}
        />
      </Shell>
    );
  }

  if (shot === "changes") {
    return (
      <Shell>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>Change requests</h1>
          <p style={{ margin: 0, color: "var(--paper-dim)", maxWidth: 720, lineHeight: 1.6 }}>
            Log every edit you want made to an app or tool, hand a batch to your developer with one copy, and
            keep a dated record of what&apos;s been done.
          </p>
        </div>
        <ChangesClient
          initialItems={CHANGES}
          workspaces={[{ owner_id: ME, email: "jane@acmestudio.com", access: "owner" }]}
          systems={["Acme storefront", "Internal CRM"]}
          currentUserId={ME}
        />
      </Shell>
    );
  }

  if (shot === "settings") {
    return (
      <Shell>
        <Head title="Settings" sub="Control who can access your workspace." />
        <GrantsClient grants={GRANTS} />
      </Shell>
    );
  }

  return (
    <Shell>
      <OverviewView
        data={{
          name: "jane",
          welcome: false,
          status: {
            label: "Active",
            color: "#7CC084",
            bg: "rgba(120,180,120,.15)",
            actionHint: "Paying on schedule",
          },
          trial: null,
          apiKey: { key: "unyb_live_3f9c…e21a", revoked_at: null },
          vault: { total: 4, attention: 2 },
          domains: { total: 2, next: { name: "acmestudio.com", label: "Renews in 12d", color: "#ffb066" } },
          changes: { open: 4, pending: 2 },
        }}
      />
    </Shell>
  );
}
