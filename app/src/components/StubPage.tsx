export function StubPage({
  title,
  description,
  status = "Coming back soon",
}: {
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: "1.6rem", fontWeight: 600 }}>{title}</h1>
        <p style={{ margin: 0, color: "var(--paper-dim)" }}>{description}</p>
      </div>
      <div className="card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "var(--paper-dim)",
          }}
        >
          <span className="pill pill-warn">{status}</span>
          <span style={{ fontSize: "0.9rem" }}>
            This section is being rebuilt. It will return with full functionality shortly.
          </span>
        </div>
      </div>
    </>
  );
}
