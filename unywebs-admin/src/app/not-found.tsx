import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-wrap">
      <div className="card auth-card" style={{ textAlign: "center" }}>
        <h1>Not found</h1>
        <p className="sub">That page doesn&apos;t exist in the Unywebs admin.</p>
        <Link href="/" className="btn btn-primary">
          Back to the overview
        </Link>
      </div>
    </main>
  );
}
