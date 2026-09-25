"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/domains", label: "Domains" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/vault", label: "Vault" },
];

export function DashboardNav({ isAdmin, email }: { isAdmin: boolean; email: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(10,18,32,.9)",
        backdropFilter: "saturate(140%) blur(10px)",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
        }}
      >
        <Link
          href="/dashboard"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <Image src="/logo.png" alt="UnyBase" width={120} height={24} priority />
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {LINKS.map((l) => {
            const active =
              l.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  color: active ? "var(--paper)" : "var(--paper-dim)",
                  background: active ? "var(--surface)" : "transparent",
                  border: `1px solid ${active ? "var(--line)" : "transparent"}`,
                }}
              >
                {l.label}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              href="/admin"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: "0.9rem",
                color: "var(--amber)",
                border: "1px solid rgba(242,169,59,.35)",
                marginLeft: 8,
              }}
            >
              Admin
            </Link>
          ) : null}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {email ? (
            <span style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>{email}</span>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={signOut}
            style={{ padding: "6px 14px", fontSize: "0.85rem" }}
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
