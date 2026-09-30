import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-header" style={{ paddingBlock: "96px 96px" }}>
      <h1>Page not found</h1>
      <p style={{ marginBottom: 28 }}>
        That page doesn&apos;t exist, or it may have moved.
      </p>
      <Link href="/" className="btn">
        Back to home
      </Link>
    </div>
  );
}
