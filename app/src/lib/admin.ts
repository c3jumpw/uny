// Three-tier role system.
//
// Phase 1 (now): roles come from env vars — simple, fast, and matches
// the current subscriber scale (single-digit users). Env vars are the
// right primitive because super admins and technical admins are a
// controlled list that changes rarely.
//
// Phase 2 (later, when we hit real scale): move to a `user_roles`
// table in Supabase and a `technical_admin_grants` table so clients
// can grant/revoke specific technical admins access to their
// workspace. The API surface (`getUserRole`, `canAccessAdmin`) stays
// the same — only the implementation moves from env-lookup to
// DB-lookup — so callers do not change.
//
// The three tiers, per user spec:
//
//   super_admin       UnyBase company platform account. Full control
//                     and visibility across every workspace, every
//                     subscription, every integration.
//
//   technical_admin   Agency-style client-services account. Can
//                     access and manage multiple client workspaces
//                     WHEN GRANTED ACCESS BY THE CLIENT. In phase 1
//                     technical admins see the admin shell but the
//                     data view is scoped to "workspaces you were
//                     granted access to" (empty until phase 2 wires
//                     the grants table).
//
//   client            Regular consumer front-end account. Can only
//                     see and manage their own workspace. Default
//                     role for every signed-up user.

export type UserRole = "super_admin" | "technical_admin" | "client";

function emailsFromEnv(varName: string): string[] {
  const raw = process.env[varName] || "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function getUserRole(email: string | null | undefined): UserRole {
  if (!email) return "client";
  const e = email.toLowerCase();
  if (emailsFromEnv("SUPER_ADMIN_EMAILS").includes(e)) return "super_admin";
  if (emailsFromEnv("TECHNICAL_ADMIN_EMAILS").includes(e)) return "technical_admin";
  return "client";
}

// Anyone in either admin tier gets the admin shell.
// Client-scoped restrictions happen inside /admin itself, not at the gate.
export function canAccessAdmin(role: UserRole): boolean {
  return role === "super_admin" || role === "technical_admin";
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "super_admin":
      return "Super Admin";
    case "technical_admin":
      return "Technical Admin";
    case "client":
      return "Client";
  }
}
