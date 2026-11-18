import type { ReactNode } from "react";

// Tiny formatter for the callout notes in src/lib/shotNotes.json, which
// are plain strings so the guide, the tour and the coverage check can
// all read them. Supports **bold**, *emphasis*, `code`, [[Key]] and
// [text](href), plus {name} placeholders filled from vars.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/g;

export function inline(text: string, vars: Record<string, string | number> = {}, kbdClass?: string): ReactNode[] {
  const filled = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return filled.split(TOKEN).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("[[")) return <kbd key={i} className={kbdClass}>{part.slice(2, -2)}</kbd>;
    if (part.startsWith("`")) return <code key={i}>{part.slice(1, -1)}</code>;
    if (part.startsWith("[")) {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) return <a key={i} href={m[2]} style={{ color: "var(--sky)" }}>{m[1]}</a>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}
