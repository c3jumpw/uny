import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";
import { BrandLockup } from "@/components/BrandLockup";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Only same-site paths, so the login page cannot be used to bounce
  // someone to another domain after they sign in.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";

  return (
    <main className="auth-wrap">
      <div className="card auth-card">
        <BrandLockup />
        <div className="mark-stripe" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <h1>Sign in to Unywebs Admin</h1>
        <p className="sub">Manage the Unywebs website and products.</p>
        <LoginForm next={safeNext} unybaseUrl={process.env.UNYBASE_APP_URL || "https://unybase.unywebs.com"} />
      </div>
    </main>
  );
}
