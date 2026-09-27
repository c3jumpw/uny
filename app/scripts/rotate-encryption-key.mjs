#!/usr/bin/env node
/**
 * Re-encrypt every stored credential under a new key.
 *
 * Rotating CREDENTIAL_ENCRYPTION_KEY without running this orphans
 * every ciphertext in the integrations table — the app detects it
 * and reports "re-enter the credential" rather than crashing, but
 * every client would have to paste every secret again. This script
 * is the supported path.
 *
 * Usage:
 *   OLD_KEY=<base64> NEW_KEY=<base64> \
 *   SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
 *   node scripts/rotate-encryption-key.mjs [--commit]
 *
 * Runs as a dry run by default and prints what it would do.
 * Pass --commit to actually write.
 *
 * Generate a new key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * Order of operations matters: run this with --commit FIRST, then
 * update CREDENTIAL_ENCRYPTION_KEY in Vercel, then redeploy. In the
 * window between the write and the redeploy the running app cannot
 * decrypt — keep it short, and run it outside business hours.
 */

import crypto from "node:crypto";

const commit = process.argv.includes("--commit");
const OLD = process.env.OLD_KEY;
const NEW = process.env.NEW_KEY;
const URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD || !NEW || !URL || !SRK) {
  console.error("Missing OLD_KEY, NEW_KEY, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const oldKey = Buffer.from(OLD, "base64");
const newKey = Buffer.from(NEW, "base64");
if (oldKey.length !== 32 || newKey.length !== 32) {
  console.error("Both keys must decode to exactly 32 bytes.");
  process.exit(1);
}
if (oldKey.equals(newKey)) {
  console.error("OLD_KEY and NEW_KEY are identical — nothing to do.");
  process.exit(1);
}

function decrypt(ct, iv, tag, key) {
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}

function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plaintext, "utf8"), c.final()]);
  return {
    credential_ciphertext: enc.toString("base64"),
    credential_iv: iv.toString("base64"),
    credential_tag: c.getAuthTag().toString("base64"),
  };
}

async function api(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const rows = await api(
  "integrations?select=id,name,credential_ciphertext,credential_iv,credential_tag&credential_ciphertext=not.is.null"
);

console.log(`${rows.length} encrypted credential(s) found.`);
console.log(commit ? "MODE: commit (will write)\n" : "MODE: dry run (no writes)\n");

let ok = 0;
let failed = 0;

for (const row of rows) {
  try {
    const plaintext = decrypt(
      row.credential_ciphertext,
      row.credential_iv,
      row.credential_tag,
      oldKey
    );
    const re = encrypt(plaintext, newKey);

    // Verify the round trip before writing anything.
    const check = decrypt(
      re.credential_ciphertext,
      re.credential_iv,
      re.credential_tag,
      newKey
    );
    if (check !== plaintext) throw new Error("round-trip verification failed");

    if (commit) {
      await api(`integrations?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify(re),
      });
    }
    console.log(`  ok   ${row.name}`);
    ok++;
  } catch (e) {
    console.log(`  FAIL ${row.name} — ${e.message}`);
    failed++;
  }
}

console.log(`\n${ok} re-encrypted, ${failed} failed.`);
if (failed > 0) {
  console.log(
    "Resolve the failures before switching the key, or those credentials will need re-entering by hand."
  );
  process.exit(1);
}
if (!commit) console.log("Dry run only. Re-run with --commit to write.");
