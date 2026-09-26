import Image from "next/image";
import Link from "next/link";

export function OnboardingShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          background: "rgba(10,18,32,.9)",
          backdropFilter: "saturate(140%) blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 40,
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
          <Link href="/dashboard" style={{ display: "flex", alignItems: "center" }}>
            <Image src="/logo.png" alt="UnyBase" width={120} height={24} priority />
          </Link>
          <span style={{ color: "var(--paper-dim)", fontSize: "0.85rem" }}>Getting started</span>
        </div>
      </header>

      <main
        style={{
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          padding: "48px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 720 }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>{title}</h1>
            {subtitle ? (
              <p style={{ margin: 0, color: "var(--paper-dim)" }}>{subtitle}</p>
            ) : null}
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
