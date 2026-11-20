import data from "@/lib/changelog.json";
import type { UserRole } from "@/lib/admin";

// The UnyBase change log. src/lib/changelog.json is the record: one
// entry per change, oldest first, appended in the same commit as the
// change itself. It feeds the admin change log (/admin/changelog), the
// What's new page (/dashboard/whats-new) and the popup people see the
// first time they log in after a change that applies to them.

export type Audience = "everyone" | "client" | "shared" | "technical_admin" | "super_admin" | "internal";
export type ChangeType = "new" | "improved" | "fixed" | "security" | "removed";

export type ChangeEntry = {
  id: string;
  date: string; // YYYY-MM-DD, the day it shipped
  type: ChangeType;
  area: string;
  audiences: Audience[];
  title: string;
  summary: string;
  details?: string[];
  link?: { href: string; label: string };
  shot?: string; // a screenshot id from src/lib/guideShots.json
  tourSteps?: string[];
  commits?: string[];
};

/** Every entry, oldest first. */
export const CHANGELOG: ChangeEntry[] = data.entries as ChangeEntry[];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: "Everyone",
  client: "Clients",
  shared: "Shared access",
  technical_admin: "Technical admins",
  super_admin: "Super admins",
  internal: "Internal",
};

export const TYPE_LABELS: Record<ChangeType, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
  security: "Security",
  removed: "Removed",
};

/**
 * Which entries a person sees. Super admins see everything, internal
 * notes included (internal never reaches the popup). Technical admins
 * see what affects them and their clients. Clients see client and
 * shared-access changes; someone who only has shared access sees those.
 */
export function audiencesFor(role: UserRole, opts: { collaboratorOnly?: boolean } = {}): Set<Audience> {
  if (role === "super_admin") {
    return new Set<Audience>(["everyone", "client", "shared", "technical_admin", "super_admin", "internal"]);
  }
  if (role === "technical_admin") return new Set<Audience>(["everyone", "client", "shared", "technical_admin"]);
  if (opts.collaboratorOnly) return new Set<Audience>(["everyone", "shared"]);
  return new Set<Audience>(["everyone", "client", "shared"]);
}

export function entriesFor(audiences: Set<Audience>, opts: { includeInternal?: boolean } = {}): ChangeEntry[] {
  return CHANGELOG.filter((e) =>
    e.audiences.some((a) => audiences.has(a) && (a !== "internal" || opts.includeInternal))
  );
}

export const LATEST_CHANGE_ID: string | null = CHANGELOG.at(-1)?.id ?? null;

/**
 * Entries after the person's "seen" marker (the id of the newest entry
 * when they last dismissed What's new, kept in their account's
 * user_metadata so it follows them across devices). Without a marker,
 * only changes since they signed up count, so a brand-new account
 * starts with nothing to catch up on and is pointed at the tour instead.
 */
export function unseenEntries(
  visible: ChangeEntry[],
  seenId: string | null | undefined,
  signedUpAt: string | null | undefined
): ChangeEntry[] {
  const index = new Map(CHANGELOG.map((e, i) => [e.id, i]));
  const seenIndex = seenId ? index.get(seenId) : undefined;
  if (seenIndex !== undefined) return visible.filter((e) => (index.get(e.id) ?? -1) > seenIndex);
  const since = signedUpAt ? signedUpAt.slice(0, 10) : null;
  if (!since) return [];
  return visible.filter((e) => e.date > since);
}

/** How many unseen changes the popup walks through; the rest are a link away. */
export const POPUP_LIMIT = 6;

/**
 * What the What's new popup shows this person: unseen changes for their
 * role, newest first, never internal notes.
 */
export function whatsNewFor(
  user: { created_at?: string | null; user_metadata?: Record<string, unknown> | null },
  role: UserRole,
  opts: { collaboratorOnly?: boolean } = {}
) {
  const visible = entriesFor(audiencesFor(role, opts));
  const marker = user.user_metadata?.changelog_seen;
  const unseen = unseenEntries(visible, typeof marker === "string" ? marker : null, user.created_at ?? null);
  return {
    entries: unseen.slice(-POPUP_LIMIT).reverse(),
    total: unseen.length,
    freshIds: unseen.map((e) => e.id),
    latestId: LATEST_CHANGE_ID,
  };
}
