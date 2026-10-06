// The Unywebs logo with an "Admin" tag, so it is always clear which
// console you are in: the parent company's, not a product's.
export function BrandLockup() {
  return (
    <div className="brand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/unywebs-logo.png" alt="Unywebs" width={54} height={30} />
      <span className="brand-tag">Admin</span>
    </div>
  );
}
