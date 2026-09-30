"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Subscriptions" },
  { href: "/admin/solutions", label: "Solutions" },
  { href: "/admin/guides", label: "Guides" },
];

export function ContentTabs() {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 24,
        borderBottom: "1px solid var(--line)",
        flexWrap: "wrap",
      }}
    >
      {TABS.map((t) => {
        const active =
          t.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{
              padding: "10px 16px",
              fontSize: "0.9rem",
              fontWeight: 500,
              color: active ? "var(--paper)" : "var(--paper-dim)",
              borderBottom: `2px solid ${active ? "var(--amber)" : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
