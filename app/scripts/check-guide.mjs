#!/usr/bin/env node
// Keeps the getting-started tour in step with the app. Runs before every
// build (npm "prebuild"), so a deploy fails if:
//
//   - a page exists that no tour step covers and that isn't exempted,
//   - a tour step or exemption points at a page that no longer exists,
//   - a step's screenshot is missing, in either theme,
//   - a screenshot's numbered callouts and its notes disagree in count
//     (the UI changed and the callouts were re-captured, or vice versa),
//   - a screenshot exists that nothing uses.
//
// How to fix a failure: see CLAUDE.md, "Keeping the tour and guide up
// to date". In short, add or update the step in src/lib/tour.json and
// its callout notes in src/lib/shotNotes.json, add the screen to
// /guide/demo and scripts/capture-guide.cjs, and re-capture.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));

const tour = json("src/lib/tour.json");
const notes = json("src/lib/shotNotes.json");
const shots = json("src/lib/guideShots.json");
const guidePage = read("src/app/guide/page.tsx");

const problems = [];

// Every page.tsx under src/app, as a route ("/dashboard/vault").
function pages(dir, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === "api" || entry.name.startsWith("_")) continue;
      const seg = /^\(.*\)$/.test(entry.name) ? "" : `/${entry.name}`;
      out.push(...pages(path.join(dir, entry.name), prefix + seg));
    } else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(entry.name)) {
      out.push(prefix || "/");
    }
  }
  return out;
}
const routes = new Set(pages(path.join(root, "src/app")));

const steps = tour.tracks.flatMap((t) => t.steps.map((s) => ({ ...s, track: t.id })));
const covered = new Set(steps.flatMap((s) => s.routes));
const exempt = tour.exempt ?? {};

for (const r of [...routes].sort()) {
  if (!covered.has(r) && !(r in exempt)) {
    problems.push(
      `New screen ${r} is not in the getting-started tour. Add a step for it to src/lib/tour.json ` +
        `(with a screenshot), or add it to "exempt" with the reason it needs none.`
    );
  }
}
for (const s of steps) {
  for (const r of s.routes) {
    if (!routes.has(r)) problems.push(`Tour step ${s.id} documents ${r}, which no longer exists. Update its "routes".`);
  }
}
for (const r of Object.keys(exempt)) {
  if (!routes.has(r)) problems.push(`"exempt" lists ${r}, which no longer exists. Remove it from src/lib/tour.json.`);
}

const ids = new Set();
for (const s of steps) {
  if (ids.has(s.id)) problems.push(`Tour step id ${s.id} is used twice.`);
  ids.add(s.id);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s.added ?? "")) problems.push(`Tour step ${s.id} needs an "added" date (YYYY-MM-DD).`);
  else if (s.added > tour.updated) problems.push(`Tour step ${s.id} was added after "updated" (${tour.updated}). Bump "updated".`);
  if (!s.title || !s.summary) problems.push(`Tour step ${s.id} needs a title and a summary.`);
}

const shotIds = new Set(steps.map((s) => s.shot));
for (const id of shotIds) {
  const data = shots[id];
  const note = notes[id];
  if (!data) {
    problems.push(`Screenshot "${id}" has not been captured. Add it to scripts/capture-guide.cjs and re-capture.`);
    continue;
  }
  if (!note) problems.push(`Screenshot "${id}" has no callout notes in src/lib/shotNotes.json.`);
  else if (note.items.length !== data.marks.length) {
    problems.push(
      `Screenshot "${id}" has ${data.marks.length} numbered callouts but ${note.items.length} notes. ` +
        `Update src/lib/shotNotes.json or the capture script so they match.`
    );
  }
  for (const theme of ["dark", "light"]) {
    if (!fs.existsSync(path.join(root, "public/guide", theme, `${id}.webp`))) {
      problems.push(`Screenshot "${id}" is missing its ${theme} image (public/guide/${theme}/${id}.webp).`);
    }
  }
}

// Nothing captured and forgotten.
for (const id of Object.keys(shots)) {
  const inGuide = guidePage.includes(`<Shot id="${id}"`);
  if (!shotIds.has(id) && !inGuide) problems.push(`Screenshot "${id}" is captured but used by neither the tour nor the guide.`);
  if (!notes[id]) problems.push(`Screenshot "${id}" has no callout notes in src/lib/shotNotes.json.`);
}

if (problems.length) {
  console.error("\nThe getting-started tour is out of date:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nSee CLAUDE.md, \"Keeping the tour and guide up to date\".\n");
  process.exit(1);
}
console.log(`Tour check passed: ${steps.length} steps, ${shotIds.size} screenshots, ${routes.size} screens covered or exempt.`);
