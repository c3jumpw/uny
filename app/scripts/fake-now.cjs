// Freezes the clock while screenshots are captured, so the demo data's
// dates and "x days ago" labels render identically on every run and CI
// only commits screenshots when a screen really changed. Loaded only by
// scripts/refresh-guide.sh through NODE_OPTIONS; never in production.
const FIXED = Date.parse(process.env.GUIDE_NOW || "2026-11-18T14:00:00Z");
const RealDate = Date;

// A plain function rather than a subclass: some runtimes copy only a
// constructor's own properties, which would drop Date.parse and Date.UTC.
function FrozenDate(...args) {
  if (!new.target) return new RealDate(FIXED).toString();
  return args.length === 0 ? new RealDate(FIXED) : new RealDate(...args);
}
FrozenDate.prototype = RealDate.prototype;
FrozenDate.now = () => FIXED;
FrozenDate.parse = RealDate.parse;
FrozenDate.UTC = RealDate.UTC;

globalThis.Date = FrozenDate;
