import { NextRequest, NextResponse } from "next/server";
import { requireContentAdmin } from "@/lib/siteContent";

// Image upload for the guide editor.
//
// Screenshots are the bulk of these articles, so this is the path that
// gets used most: paste or drag an image into the editor and it lands
// here, then the returned URL is written straight into the markdown.

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(req: NextRequest) {
  const auth = await requireContentAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { admin } = auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: `${file.type || "That file type"} isn't supported. Use PNG, JPG, WebP, GIF or SVG.` },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 10MB.` },
      { status: 400 }
    );
  }

  // Keep a readable stem so the storage bucket stays browsable, but
  // prefix a timestamp: two screenshots called "step-1.png" from
  // different guides must not overwrite each other.
  const rawName = file.name || "image";
  const stem =
    rawName
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "image";

  const ext = EXT[file.type] ?? "png";
  const folder = new Date().toISOString().slice(0, 7); // YYYY-MM
  const path = `guides/${folder}/${Date.now().toString(36)}-${stem}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await admin.storage
    .from("site-media")
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("site-media").getPublicUrl(path);

  return NextResponse.json({ ok: true, url: publicUrl, path });
}
