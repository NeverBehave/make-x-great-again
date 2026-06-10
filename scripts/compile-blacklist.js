import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(__dirname, "../data/blacklist/v1.json");
const destPath = path.resolve(__dirname, "../extension/public/blacklist-data.json");

// Must mirror the Label union in extension/lib/types.ts.
const SUPPORTED_LABELS = new Set(["spam", "porn_bot", "likely_spam", "uncertain", "legit"]);

console.log("Reading raw blacklist from:", srcPath);
const rawData = fs.readFileSync(srcPath, "utf-8");
const parsed = JSON.parse(rawData);

if (!parsed || !Array.isArray(parsed.list)) {
  console.error("ERROR: expected a top-level { list: [...] } in", srcPath);
  process.exit(1);
}

console.log("Found raw entries count:", parsed.list.length);

// Validate, filter, and dedup. Output rows keep the exact shape the extension
// parses (extension/lib/local-index.ts):
//   [x_user_id, handle, verdict_label, confidence, reasons]
let droppedBadShape = 0;
let droppedNoNumericId = 0; // handle-only entries are a handle-reuse trap
let droppedBadLabel = 0;
let dedupedById = 0;

/** @type {Map<string, { row: [string, string, string, number, string[]], publishedAt: number }>} */
const byId = new Map();

for (const item of parsed.list) {
  if (item === null || typeof item !== "object" || Array.isArray(item)) {
    droppedBadShape++;
    continue;
  }

  const rawId = item.x_user_id;
  const id = typeof rawId === "string" ? rawId : typeof rawId === "number" ? String(rawId) : null;
  if (!id || !/^\d+$/.test(id)) {
    droppedNoNumericId++;
    continue;
  }

  const label = item.verdict_label || "spam";
  if (typeof label !== "string" || !SUPPORTED_LABELS.has(label)) {
    droppedBadLabel++;
    continue;
  }

  const handle = typeof item.handle === "string" ? item.handle : "";
  const confidence =
    typeof item.confidence === "number" && Number.isFinite(item.confidence) ? item.confidence : 1;
  const reasons = Array.isArray(item.reasons)
    ? item.reasons.filter((r) => typeof r === "string")
    : [];
  const publishedAt = typeof item.published_at === "number" ? item.published_at : 0;

  const prev = byId.get(id);
  if (prev) {
    dedupedById++;
    if (publishedAt < prev.publishedAt) continue; // keep the latest published_at
  }
  byId.set(id, { row: [id, handle, label, confidence, reasons], publishedAt });
}

const compacted = [...byId.values()].map((v) => v.row);

console.log("Writing compacted blacklist to:", destPath);
fs.mkdirSync(path.dirname(destPath), { recursive: true });
fs.writeFileSync(destPath, JSON.stringify(compacted), "utf-8");

console.log(
  `Summary: kept=${compacted.length} dropped_no_numeric_id=${droppedNoNumericId} ` +
    `dropped_unsupported_label=${droppedBadLabel} dropped_bad_shape=${droppedBadShape} ` +
    `deduped_by_id=${dedupedById}`,
);
console.log(
  "Done! Compacted blacklist size:",
  (fs.statSync(destPath).size / 1024 / 1024).toFixed(2),
  "MB",
);
