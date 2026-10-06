import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteBase } from "@/lib/admin";
import { AdminNav } from "@/components/AdminNav";
import { BrandLockup } from "@/components/BrandLockup";
import { SignOutButton } from "@/components/SignOutButton";

// Gate for every admin page. Signed-out visitors are already redirected by
// the middleware; this decides whether a signed-in account may come in,
// using the same is_site_admin() check the database enforces on writes.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: allowed } = await supabase.rpc("is_site_admin");

  if (allowed !== true) {
    return (
      <main className="auth-wrap">
        <div className="card auth-card" style={{ textAlign: "center" }}>
          <BrandLockup />
          <h1>No admin access</h1>
          <p className="sub">
            {user.email} is signed in but is not a Unywebs admin. Ask a super
            admin to give this account a role, then sign in again.
          </p>
          <SignOutButton />
        </div>
      </main>
    );
  }

  return (
    <div className="shell">
      <AdminNav
        email={user.email ?? null}
        siteUrl={siteBase()}
        unybaseAppUrl={process.env.UNYBASE_APP_URL || "https://unybase.unywebs.com"}
      />
      <main className="main">
        <div className="main-inner">{children}</div>
      </main>
    </div>
  );
}
