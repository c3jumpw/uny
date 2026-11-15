import { createHash, randomBytes } from "crypto";

// Client app licensing (the kill switch). Server-only helpers.
//
// A key is "unyl_" + 48 hex characters. Only its SHA-256 is stored, so
// the admin page shows a key once, at registration or rotation. The
// format must match the check in license_status() in SQL.

export type SiteMode = "auto" | "paused" | "active";
export type SiteState = "active" | "grace" | "paused" | "retired";

export function isSiteMode(v: unknown): v is SiteMode {
  return v === "auto" || v === "paused" || v === "active";
}

export function newLicenseKey(): { key: string; hash: string; prefix: string } {
  const key = `unyl_${randomBytes(24).toString("hex")}`;
  return { key, hash: hashLicenseKey(key), prefix: key.slice(0, 12) };
}

export function hashLicenseKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// "https://www.JoesTires.com/book?x=1" -> "www.joestires.com"
export function normaliseDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const host = raw
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "");
  return /^[a-z0-9.-]{1,200}$/.test(host) ? host : null;
}

export function cleanText(input: unknown, max: number): string | null {
  if (typeof input !== "string") return null;
  const t = input.trim().slice(0, max);
  return t ? t : null;
}

// Values going into email HTML.
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
