"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { GuideRow } from "@/lib/siteContentShared";

// The guide editor.
//
// These articles are screenshot-heavy — the Zoho walkthrough runs to
// about fifteen images — so image handling is the primary constraint,
// not a detail. Paste, drag, or pick: all three land in the same upload
// and insert the reference at the cursor.
//
// Everything else follows from two failure modes worth designing out:
// losing a long draft (hence autosave), and silently breaking a live
// URL (hence the slug lock and the redirect it writes).

type Props = { initial: GuideRow; siteBase: string };

type SaveState =
  | { kind: "idle" }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string };

const AUTOSAVE_MS = 1500;

export function GuideEditor({ initial, siteBase }: Props) {
  const [guide, setGuide] = useState<GuideRow>(initial);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [tab, setTab] = useState<"write" | "preview" | "seo">("write");
  const [uploading, setUploading] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [pendingSlug, setPendingSlug] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [, forceTick] = useState(0);

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(guide);
  latest.current = guide;

  // Keeps the "Saved 12s ago" label honest without re-rendering the
  // textarea on every tick of its own state.
  useEffect(() => {
    const i = setInterval(() => forceTick((n) => n + 1), 5000);
    return () => clearInterval(i);
  }, []);

  const persist = useCallback(
    async (patch: Partial<GuideRow>, opts?: { confirmSlug?: boolean }) => {
      setSave({ kind: "saving" });
      const res = await fetch("/api/admin/guides", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: latest.current.id,
          ...patch,
          ...(opts?.confirmSlug ? { confirm_slug_change: true } : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (json.error === "slug_locked") {
          setSave({ kind: "dirty" });
          setPendingSlug(json.proposed_slug);
          setRenaming(true);
          return null;
        }
        setSave({ kind: "error", message: json.error || "Could not save." });
        return null;
      }

      setGuide(json.guide as GuideRow);
      setSave({ kind: "saved", at: Date.now() });
      return json;
    },
    []
  );

  // Autosave. Only the fields that change while typing go through here;
  // publish and rename are explicit actions with their own handlers.
  const queueSave = useCallback(
    (patch: Partial<GuideRow>) => {
      setSave({ kind: "dirty" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void persist(patch);
      }, AUTOSAVE_MS);
    },
    [persist]
  );

  function edit<K extends keyof GuideRow>(key: K, value: GuideRow[K]) {
    setGuide((g) => ({ ...g, [key]: value }));
    queueSave({ [key]: value } as Partial<GuideRow>);
  }

  // Title drives the slug only until the guide goes live. After that
  // the URL is indexed and renaming has to be deliberate.
  function onTitleChange(value: string) {
    const patch: Partial<GuideRow> = { title: value };
    if (!guide.slug_locked) patch.slug = value;
    setGuide((g) => ({ ...g, title: value }));
    queueSave(patch);
  }

  // ---------- markdown toolbar ----------

  const applyToSelection = useCallback(
    (fn: (selected: string) => { text: string; caret?: number }) => {
      const el = bodyRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = el.value.slice(start, end);
      const { text, caret } = fn(selected);
      const next = el.value.slice(0, start) + text + el.value.slice(end);

      setGuide((g) => ({ ...g, body_markdown: next }));
      queueSave({ body_markdown: next });

      requestAnimationFrame(() => {
        el.focus();
        const pos = caret ?? start + text.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [queueSave]
  );

  const wrap = useCallback(
    (before: string, after = before, placeholder = "text") =>
      applyToSelection((sel) => {
        const inner = sel || placeholder;
        return {
          text: `${before}${inner}${after}`,
          caret: sel ? undefined : undefined,
        };
      }),
    [applyToSelection]
  );

  const linePrefix = useCallback(
    (prefix: string) =>
      applyToSelection((sel) => {
        const lines = (sel || "").split("\n");
        const text = lines.map((l) => `${prefix}${l}`).join("\n");
        return { text };
      }),
    [applyToSelection]
  );

  const insertAtCursor = useCallback(
    (snippet: string) => applyToSelection(() => ({ text: snippet })),
    [applyToSelection]
  );

  // ---------- image upload ----------

  const uploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      setUploading(false);

      if (!res.ok) {
        setSave({ kind: "error", message: json.error || "Upload failed." });
        return null;
      }
      return json.url as string;
    },
    []
  );

  const uploadAndInsert = useCallback(
    async (file: File) => {
      const url = await uploadImage(file);
      if (!url) return;
      const alt = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
      insertAtCursor(`\n![${alt}](${url})\n`);
    },
    [uploadImage, insertAtCursor]
  );

  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const item = Array.from(e.clipboardData.items).find((i) =>
      i.type.startsWith("image/")
    );
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    e.preventDefault();
    void uploadAndInsert(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith("image/")
    );
    if (file) void uploadAndInsert(file);
  }

  // ---------- publish / rename ----------

  async function publish() {
    if (timer.current) clearTimeout(timer.current);
    await persist({
      status: "published",
      title: guide.title,
      body_markdown: guide.body_markdown,
      excerpt: guide.excerpt,
    });
  }

  async function unpublish() {
    if (timer.current) clearTimeout(timer.current);
    await persist({ status: "draft" });
  }

  async function confirmRename() {
    setRenaming(false);
    await persist({ slug: pendingSlug }, { confirmSlug: true });
  }

  const previewUrl = siteBase
    ? `${siteBase}/guides/${guide.slug}?preview=${guide.preview_token}`
    : null;
  const liveUrl = siteBase ? `${siteBase}/guides/${guide.slug}` : null;

  const savedLabel = useMemo(() => {
    switch (save.kind) {
      case "saving":
        return "Saving…";
      case "dirty":
        return "Unsaved changes";
      case "error":
        return save.message;
      case "saved": {
        const secs = Math.round((Date.now() - save.at) / 1000);
        if (secs < 5) return "Saved just now";
        if (secs < 60) return `Saved ${secs}s ago`;
        return `Saved ${Math.round(secs / 60)}m ago`;
      }
      default:
        return "No changes yet";
    }
  }, [save]);

  return (
    <>
      {/* ---------- status bar ---------- */}
      <div
        className="card"
        style={{
          padding: "12px 16px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          className={
            guide.status === "published"
              ? "pill pill-good"
              : guide.status === "archived"
                ? "pill"
                : "pill pill-warn"
          }
        >
          {guide.status === "published"
            ? "Live"
            : guide.status === "archived"
              ? "Archived"
              : "Draft"}
        </span>

        <span
          style={{
            fontSize: "0.82rem",
            color:
              save.kind === "error"
                ? "#ffb3b3"
                : save.kind === "dirty"
                  ? "#ffd76a"
                  : "var(--paper-dim)",
            flex: 1,
            minWidth: 160,
          }}
        >
          {savedLabel}
        </span>

        {previewUrl && guide.status !== "published" && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ padding: "6px 14px", fontSize: "0.82rem" }}
          >
            Preview on site
          </a>
        )}
        {liveUrl && guide.status === "published" && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
            style={{ padding: "6px 14px", fontSize: "0.82rem" }}
          >
            View live
          </a>
        )}

        {guide.status === "published" ? (
          <button
            className="btn btn-ghost"
            onClick={unpublish}
            disabled={save.kind === "saving"}
            style={{ padding: "6px 14px", fontSize: "0.82rem" }}
          >
            Unpublish
          </button>
        ) : (
          <button
            className="btn btn-amber"
            onClick={publish}
            disabled={save.kind === "saving"}
            style={{ padding: "6px 16px", fontSize: "0.82rem" }}
          >
            Publish
          </button>
        )}
      </div>

      {/* ---------- rename confirmation ---------- */}
      {renaming && (
        <div
          className="card"
          style={{
            padding: 20,
            marginBottom: 16,
            borderColor: "rgba(242,169,59,.5)",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>
            Change a published URL?
          </h3>
          <p style={{ color: "var(--paper-dim)", fontSize: "0.88rem" }}>
            This guide is live at <code>/guides/{guide.slug}</code>. Anyone who
            has linked to it, and any search result pointing at it, uses that
            address. Renaming it to <code>/guides/{pendingSlug}</code> will
            leave a permanent redirect behind so those links keep working.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-amber" onClick={confirmRename}>
              Rename and redirect
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setRenaming(false);
                setGuide((g) => ({ ...g }));
              }}
            >
              Keep the current URL
            </button>
          </div>
        </div>
      )}

      {/* ---------- tabs ---------- */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
        {(["write", "preview", "seo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? "btn btn-ghost" : "btn"}
            style={{
              padding: "6px 16px",
              fontSize: "0.85rem",
              background: tab === t ? "var(--surface-2)" : "transparent",
              border: `1px solid ${tab === t ? "var(--line-2)" : "transparent"}`,
              color: tab === t ? "var(--paper)" : "var(--paper-dim)",
              textTransform: "capitalize",
            }}
          >
            {t === "seo" ? "SEO & social" : t}
          </button>
        ))}
      </div>

      {tab === "write" && (
        <>
          <div className="field">
            <label htmlFor="g-title">Title</label>
            <input
              id="g-title"
              value={guide.title}
              onChange={(e) => onTitleChange(e.target.value)}
              style={{ fontSize: "1.1rem", fontWeight: 500 }}
            />
          </div>

          <div className="field">
            <label htmlFor="g-slug">
              URL{" "}
              {guide.slug_locked && (
                <span style={{ color: "var(--amber)" }}>· locked (published)</span>
              )}
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
                /guides/
              </span>
              <input
                id="g-slug"
                value={guide.slug}
                onChange={(e) => {
                  const v = e.target.value;
                  setGuide((g) => ({ ...g, slug: v }));
                  if (!guide.slug_locked) queueSave({ slug: v });
                }}
                onBlur={(e) => {
                  if (guide.slug_locked && e.target.value !== initial.slug) {
                    setPendingSlug(e.target.value);
                    setRenaming(true);
                  }
                }}
                style={{ flex: 1 }}
              />
            </div>
            {!guide.slug_locked && (
              <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                Follows the title until you publish, then locks.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="g-excerpt">
              Excerpt — the line under the title on the guides list
            </label>
            <textarea
              id="g-excerpt"
              rows={2}
              value={guide.excerpt}
              onChange={(e) => edit("excerpt", e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="g-hero">Hero image</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                id="g-hero"
                value={guide.hero_image_url ?? ""}
                onChange={(e) => edit("hero_image_url", e.target.value)}
                placeholder="/media/… or upload"
                style={{ flex: 1, minWidth: 200 }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={uploading}
                onClick={async () => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = async () => {
                    const f = input.files?.[0];
                    if (!f) return;
                    const url = await uploadImage(f);
                    if (url) edit("hero_image_url", url);
                  };
                  input.click();
                }}
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>
            {guide.hero_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={guide.hero_image_url}
                alt=""
                style={{
                  marginTop: 8,
                  maxHeight: 140,
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                }}
              />
            )}
          </div>

          {/* ---------- toolbar ---------- */}
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              padding: 8,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderBottom: "none",
              borderRadius: "8px 8px 0 0",
            }}
          >
            <ToolButton label="H2" title="Heading" onClick={() => linePrefix("## ")} />
            <ToolButton label="H3" title="Subheading" onClick={() => linePrefix("### ")} />
            <ToolButton label="B" title="Bold" bold onClick={() => wrap("**")} />
            <ToolButton label="I" title="Italic" italic onClick={() => wrap("*")} />
            <ToolButton label="Link" title="Link" onClick={() => wrap("[", "](https://)", "link text")} />
            <ToolButton label="• List" title="Bullet list" onClick={() => linePrefix("- ")} />
            <ToolButton label="1. List" title="Numbered list" onClick={() => linePrefix("1. ")} />
            <ToolButton label="Quote" title="Callout" onClick={() => linePrefix("> ")} />
            <ToolButton label="Code" title="Inline code" onClick={() => wrap("`")} />
            <div style={{ flex: 1 }} />
            <ToolButton
              label={uploading ? "Uploading…" : "Insert image"}
              title="Upload an image, or just paste/drag one into the editor"
              onClick={() => fileRef.current?.click()}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAndInsert(f);
                e.target.value = "";
              }}
            />
          </div>

          <textarea
            ref={bodyRef}
            value={guide.body_markdown}
            onChange={(e) => edit("body_markdown", e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            spellCheck
            style={{
              width: "100%",
              minHeight: 460,
              padding: 16,
              borderRadius: "0 0 8px 8px",
              border: `1px solid ${dragOver ? "var(--amber)" : "var(--line)"}`,
              background: dragOver ? "var(--surface-2)" : "var(--ink-2)",
              color: "var(--paper)",
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              fontSize: "0.88rem",
              lineHeight: 1.7,
              outline: "none",
              resize: "vertical",
            }}
          />
          <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 6 }}>
            Paste or drag an image straight in to upload it. Markdown:{" "}
            <code>**bold**</code>, <code>## heading</code>,{" "}
            <code>[text](url)</code>.
          </p>
        </>
      )}

      {tab === "preview" && (
        <div
          className="card"
          style={{
            padding: 0,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <div
            style={{
              padding: "32px 36px 44px",
              color: "#0f172a",
              fontFamily:
                'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
              maxWidth: 760,
              margin: "0 auto",
            }}
            className="guide-preview"
          >
            {guide.hero_image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={guide.hero_image_url}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: 12,
                  marginBottom: 24,
                  display: "block",
                }}
              />
            )}
            <h1 style={{ fontSize: "2rem", lineHeight: 1.15, margin: "0 0 14px" }}>
              {guide.title}
            </h1>
            {guide.excerpt && (
              <p style={{ fontSize: "1.1rem", color: "#5b6b7f", margin: "0 0 28px" }}>
                {guide.excerpt}
              </p>
            )}
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {guide.body_markdown || "_Nothing written yet._"}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {tab === "seo" && (
        <>
          <div className="field">
            <label htmlFor="g-eyebrow">Eyebrow (small label above the title)</label>
            <input
              id="g-eyebrow"
              value={guide.eyebrow ?? ""}
              onChange={(e) => edit("eyebrow", e.target.value)}
              placeholder="For business owners deploying apps"
            />
          </div>
          <div className="field">
            <label htmlFor="g-seotitle">
              Search title — defaults to the guide title
            </label>
            <input
              id="g-seotitle"
              value={guide.seo_title ?? ""}
              onChange={(e) => edit("seo_title", e.target.value)}
              maxLength={200}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              {(guide.seo_title ?? guide.title).length} characters · Google
              shows roughly the first 60.
            </span>
          </div>
          <div className="field">
            <label htmlFor="g-seodesc">
              Search description — defaults to the excerpt
            </label>
            <textarea
              id="g-seodesc"
              rows={3}
              value={guide.seo_description ?? ""}
              onChange={(e) => edit("seo_description", e.target.value)}
              maxLength={400}
            />
            <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
              {(guide.seo_description ?? guide.excerpt).length} characters ·
              aim for 150–160.
            </span>
          </div>
          <div className="field">
            <label htmlFor="g-og">
              Social share image — defaults to the hero image
            </label>
            <input
              id="g-og"
              value={guide.og_image_url ?? ""}
              onChange={(e) => edit("og_image_url", e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="g-author">Author</label>
            <input
              id="g-author"
              value={guide.author ?? ""}
              onChange={(e) => edit("author", e.target.value)}
            />
          </div>
        </>
      )}

      <style>{`
        .guide-preview h2 { font-size: 1.5rem; margin: 36px 0 12px; }
        .guide-preview h3 { font-size: 1.2rem; margin: 28px 0 10px; }
        .guide-preview p  { margin: 0 0 16px; color: #26313f; line-height: 1.65; }
        .guide-preview ul, .guide-preview ol { padding-left: 22px; margin: 0 0 16px; color: #26313f; }
        .guide-preview li { margin-bottom: 6px; }
        .guide-preview img { max-width: 100%; border-radius: 8px; margin: 18px 0; border: 1px solid #e2e8f0; }
        .guide-preview a { color: #1e73be; text-decoration: underline; }
        .guide-preview blockquote {
          background: #f4f7fb; border-left: 4px solid #1e73be;
          padding: 14px 18px; border-radius: 6px; margin: 18px 0;
        }
        .guide-preview code {
          background: #f4f7fb; border: 1px solid #e2e8f0;
          border-radius: 4px; padding: 2px 5px; font-size: 0.9em;
        }
        .guide-preview table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .guide-preview th, .guide-preview td { border: 1px solid #e2e8f0; padding: 7px 10px; text-align: left; }
      `}</style>
    </>
  );
}

function ToolButton({
  label,
  title,
  onClick,
  bold,
  italic,
}: {
  label: string;
  title: string;
  onClick: () => void;
  bold?: boolean;
  italic?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: "5px 11px",
        borderRadius: 6,
        border: "1px solid var(--line)",
        background: "var(--ink-2)",
        color: "var(--paper-dim)",
        fontSize: "0.8rem",
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      {label}
    </button>
  );
}
