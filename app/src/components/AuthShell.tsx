import Image from "next/image";
import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <Image src="/logo.png" alt="UnyBase" width={140} height={28} priority />
        </Link>
        <div className="card">
          <h1 style={{ margin: "0 0 6px", fontSize: "1.4rem", fontWeight: 600 }}>{title}</h1>
          {subtitle ? (
            <p style={{ margin: "0 0 24px", color: "var(--paper-dim)" }}>{subtitle}</p>
          ) : (
            <div style={{ height: 12 }} />
          )}
          {children}
        </div>
        {footer ? (
          <div
            style={{
              marginTop: 20,
              textAlign: "center",
              color: "var(--paper-dim)",
              fontSize: "0.9rem",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  );
}
