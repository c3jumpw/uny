import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getUserRole } from "@/lib/admin";
import { accessFor, type AccessReason, type StatusRow } from "@/lib/subscriptionStatus";

export type Access = {
  allowed: boolean;
  reason: AccessReason;
  status: StatusRow | null;
};

// Resolves whether the signed-in user may use the dashboard, or must
// pick and pay for a plan first. Used by the dashboard and onboarding
// layouts (gate) and by /plans (to send paying users onward).
export async function getAccess(supabase: SupabaseClient, user: User): Promise<Access> {
  const role = getUserRole(user.email);
  const isAdmin = role === "super_admin" || role === "technical_admin";

  const { data } = await supabase
    .from("subscription_status")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const status = data
    ? ({ ...(data as StatusRow), created_at: user.created_at } as StatusRow)
    : null;

  let isCollaborator = false;
  if (!isAdmin) {
    const first = accessFor(status, { isAdmin: false });
    if (!first.allowed) {
      // Only pay for the extra lookups when the answer could change.
      const [{ data: shared }, { data: granted }] = await Promise.all([
        supabase.rpc("change_request_workspaces"),
        supabase
          .from("technical_admin_grants")
          .select("id")
          .eq("technical_admin_id", user.id)
          .is("revoked_at", null)
          .limit(1),
      ]);
      const others = ((shared as Array<{ access: string }> | null) ?? []).filter(
        (w) => w.access === "shared" || w.access === "granted"
      );
      isCollaborator = others.length > 0 || ((granted as unknown[] | null) ?? []).length > 0;
    }
  }

  const { allowed, reason } = accessFor(status, { isAdmin, isCollaborator });
  return { allowed, reason, status };
}
