import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(__dirname, "../data/blacklist/v1.json");
const destDir = path.resolve(__dirname, "../extension/public");
const manifestPath = path.join(destDir, "blacklist-data.json");
// AMO's validator refuses to parse any single JSON file > 5 MB. Shard well
// under that; ~3.5 MB leaves headroom for future growth without touching the
// packing logic.
const SHARD_TARGET_BYTES = 3_500_000;

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

fs.mkdirSync(destDir, { recursive: true });

// Clean up any stale shards from a previous run so a shrinking dataset
// doesn't leave orphan files in the packaged extension.
for (const name of fs.readdirSync(destDir)) {
  if (/^blacklist-data-\d+\.json$/.test(name)) fs.unlinkSync(path.join(destDir, name));
}

// Pack rows into shards, each roughly SHARD_TARGET_BYTES of serialized JSON.
// The manifest file (`blacklist-data.json`) is a tiny index the extension
// reads first to discover the shard filenames.
const shards = [];
let current = [];
let currentBytes = 2; // "[]"
for (const row of compacted) {
  const rowJson = JSON.stringify(row);
  const addedBytes = rowJson.length + (current.length === 0 ? 0 : 1); // comma separator
  if (currentBytes + addedBytes > SHARD_TARGET_BYTES && current.length > 0) {
    shards.push(current);
    current = [];
    currentBytes = 2;
  }
  current.push(row);
  currentBytes += rowJson.length + (current.length === 1 ? 0 : 1);
}
if (current.length > 0) shards.push(current);

const shardFiles = [];
shards.forEach((rows, i) => {
  const filename = `blacklist-data-${String(i + 1).padStart(3, "0")}.json`;
  const filePath = path.join(destDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(rows), "utf-8");
  shardFiles.push({
    name: filename,
    count: rows.length,
    bytes: fs.statSync(filePath).size,
  });
});

const manifest = {
  version: 1,
  total: compacted.length,
  shards: shardFiles.map((s) => s.name),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest), "utf-8");

console.log(
  `Summary: kept=${compacted.length} dropped_no_numeric_id=${droppedNoNumericId} ` +
    `dropped_unsupported_label=${droppedBadLabel} dropped_bad_shape=${droppedBadShape} ` +
    `deduped_by_id=${dedupedById}`,
);
console.log(`Wrote ${shardFiles.length} shard(s) + manifest to ${destDir}:`);
for (const s of shardFiles) {
  console.log(`  - ${s.name}: ${(s.bytes / 1024 / 1024).toFixed(2)} MB (${s.count} rows)`);
}
console.log(`  - blacklist-data.json (manifest): ${fs.statSync(manifestPath).size} bytes`);
