"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Subscriptions" },
  { href: "/admin/sites", label: "Client sites" },
];

// `current` lets the tour's demo screens show the right tab as active.
export function AdminTabs({ current }: { current?: string } = {}) {
  const routePath = usePathname();
  const pathname = current ?? routePath;
  return (
    <nav aria-label="Admin sections" style={{ display: "flex", gap: 6, marginBottom: 24, borderBottom: "1px solid var(--line)" }}>
      {TABS.map((t) => {
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
