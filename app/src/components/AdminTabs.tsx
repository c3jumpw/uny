"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/lib/admin";

// Client sites (the kill switch) are super-admin only; technical admins
// get Subscriptions (their granted workspaces) and the change log.
const TABS: Array<{ href: string; label: string; superOnly?: boolean }> = [
  { href: "/admin", label: "Subscriptions" },
  { href: "/admin/sites", label: "Client sites", superOnly: true },
  { href: "/admin/changelog", label: "Change log" },
];

// `current` lets the tour's demo screens show the right tab as active.
export function AdminTabs({ current, role = "super_admin" }: { current?: string; role?: UserRole } = {}) {
  const routePath = usePathname();
  const pathname = current ?? routePath;
  const tabs = TABS.filter((t) => !t.superOnly || role === "super_admin");
  return (
    <nav aria-label="Admin sections" style={{ display: "flex", gap: 6, marginBottom: 24, borderBottom: "1px solid var(--line)" }}>
      {tabs.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "10px 14px",
              fontSize: "0.9rem",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--paper)" : "var(--paper-dim)",
              borderBottom: `2px solid ${active ? "var(--amber)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
