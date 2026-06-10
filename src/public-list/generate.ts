import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { CurationRecord, type ReviewStatus } from "../schema.ts";
import { add, bloomParams, createBloomFilter, serialize } from "./bloom.ts";
import { BloomIndex, Meta, type PublicEntry, ShardManifest } from "./schema.ts";

export interface GenerateOptions {
  /** Path to the private JSONL curation DB (one CurationRecord per line). */
  sourcePath: string;
  /** Output directory for the public list (will create data/shards/ inside). */
  outDir: string;
  /** SemVer version tag for this release. */
  version: string;
  /** Git commit SHA of the source code that produced this release. */
  sourceCommit: string;
  /** Number of shards (default 256). */
  shardCount?: number;
  /** Verdict labels eligible for public list (default ["spam","porn_bot"]). */
  eligibleLabels?: ReadonlyArray<"spam" | "porn_bot" | "likely_spam" | "uncertain" | "legit">;
  /** Review status required for publication (default "human_confirmed"). */
  reviewStatus?: ReviewStatus;
  /**
   * Entries removed since the previous release. When omitted it is computed
   * by diffing the previous data/shards/ output (if present) against the new
   * entry set.
   */
  removedCount?: number;
}

export interface GenerateResult {
  metaPath: string;
  indexPath: string;
  shardDir: string;
  totalEntries: number;
  removedCount: number;
  indexSizeBytes: number;
  metaSizeBytes: number;
}

/** Target false-positive rate for the published bloom index. */
const BLOOM_TARGET_FPR = 0.01;

/**
 * Read the private curation DB, filter to human-confirmed entries,
 * dedupe by userId (latest createdAt wins), hash-shard, and write
 * public list artefacts.
 *
 * Output is written atomically: artefacts are built and validated in a temp
 * dir next to data/ and only then swapped into place, so a crash mid-write
 * never leaves a half-built live directory.
 *
 * Returns paths and sizes so the caller can validate or commit.
 */
export function generatePublicList(opts: GenerateOptions): GenerateResult {
  const {
    sourcePath,
    outDir,
    version,
    sourceCommit,
    shardCount = 256,
    eligibleLabels = ["spam", "porn_bot"],
    reviewStatus = "human_confirmed",
  } = opts;

  // 1. Read & parse
  const records = readCurationDb(sourcePath);

  // 2. Filter to eligible, confirmed entries. Records whose userId is not a
  // real numeric X id are excluded: src/mvp.ts synthesizes a leading-zero
  // placeholder for handle-only records (idResolved=false) and those must
  // never be published as if they carried a real id.
  const eligible = records.filter(
    (r) =>
      r.reviewStatus === reviewStatus &&
      eligibleLabels.includes(r.verdict.label) &&
      /^[1-9]\d*$/.test(r.userId),
  );

  // 3. Deduplicate by userId — latest createdAt wins
  const byId = new Map<string, CurationRecord>();
  for (const r of eligible) {
    const existing = byId.get(r.userId);
    if (!existing || r.createdAt > existing.createdAt) {
      byId.set(r.userId, r);
    }
  }

  // 4. Convert to PublicEntry and sort by numeric id
  const entries: PublicEntry[] = Array.from(byId.values())
    .map((r) => ({
      id: r.userId,
      h: r.handle,
      v: r.verdict.label as "spam" | "porn_bot",
      c: Math.round(r.verdict.confidence * 100) / 100,
      r: r.verdict.reasons.slice(0, 6),
      t: new Date(r.createdAt).getTime(),
    }))
    .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));

  // 5. Build bloom filter, sized for the actual entry count at the target
  // false-positive rate. m/k are published in index.json so consumers stay
  // compatible whatever sizing this release used.
  const { m, k } = bloomParams(entries.length, BLOOM_TARGET_FPR);
  const filter = createBloomFilter(m, k);
  for (const e of entries) add(filter, e.id);
  const index = BloomIndex.parse({
    schema: 1,
    ...serialize(filter),
  });

  // 6. Compute removedCount against the previous release (if any) before the
  // live dir is replaced.
  const dataDir = join(outDir, "data");
  const removedCount =
    opts.removedCount ?? computeRemovedCount(dataDir, new Set(entries.map((e) => e.id)));

  // 7. Build everything into a temp dir. Rebuilding from scratch means removed
  // or successfully appealed accounts cannot survive as stale shard files.
  mkdirSync(outDir, { recursive: true });
  const tmpDir = join(outDir, ".data-tmp");
  const oldDir = join(outDir, ".data-old");
  rmSync(tmpDir, { recursive: true, force: true });
  rmSync(oldDir, { recursive: true, force: true });
  const tmpShardDir = join(tmpDir, "shards");
  mkdirSync(tmpShardDir, { recursive: true });

  const shards = new Map<string, PublicEntry[]>();
  for (const e of entries) {
    const bucket = hashBucket(e.id, shardCount);
    const list = shards.get(bucket) ?? [];
    list.push(e);
    shards.set(bucket, list);
  }
  for (const [bucket, list] of shards) {
    const manifest = ShardManifest.parse({ schema: 1, bucket, count: list.length, list });
    writeFileSync(join(tmpShardDir, `${bucket}.json`), JSON.stringify(manifest, null, 2), "utf8");
  }

  writeFileSync(join(tmpDir, "index.json"), JSON.stringify(index, null, 2), "utf8");

  const meta = Meta.parse({
    schema: 1,
    version,
    generatedAt: Date.now(),
    sourceCommit,
    count: entries.length,
    shardCount,
    removedCount,
  });
  writeFileSync(join(tmpDir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");

  // 8. Swap the validated build into place atomically (rename, not rebuild).
  if (existsSync(dataDir)) renameSync(dataDir, oldDir);
  renameSync(tmpDir, dataDir);
  rmSync(oldDir, { recursive: true, force: true });

  return {
    metaPath: join(dataDir, "meta.json"),
    indexPath: join(dataDir, "index.json"),
    shardDir: join(dataDir, "shards"),
    totalEntries: entries.length,
    removedCount: meta.removedCount,
    indexSizeBytes: Buffer.byteLength(JSON.stringify(index), "utf8"),
    metaSizeBytes: Buffer.byteLength(JSON.stringify(meta), "utf8"),
  };
}

function readCurationDb(path: string): CurationRecord[] {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const out: CurationRecord[] = [];
  const lines = raw.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    let json: unknown;
    try {
      json = JSON.parse(line);
    } catch {
      console.warn(`WARN: skipping malformed JSON at ${path}:${i + 1}`);
      continue;
    }
    const parsed = CurationRecord.safeParse(json);
    if (!parsed.success) {
      console.warn(`WARN: skipping invalid CurationRecord at ${path}:${i + 1}`);
      continue;
    }
    out.push(parsed.data);
  }
  return out;
}

/**
 * Count ids that were in the previous release's shards but are absent from
 * the new entry set. Best-effort: a missing or unreadable previous release
 * counts as zero removals.
 */
function computeRemovedCount(prevDataDir: string, currentIds: ReadonlySet<string>): number {
  let files: string[];
  try {
    files = readdirSync(join(prevDataDir, "shards"));
  } catch {
    return 0;
  }
  let removed = 0;
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const manifest = JSON.parse(readFileSync(join(prevDataDir, "shards", file), "utf8")) as {
        list?: { id?: unknown }[];
      };
      for (const e of manifest.list ?? []) {
        if (typeof e.id === "string" && !currentIds.has(e.id)) removed += 1;
      }
    } catch {
      // Unreadable previous shard — skip; removedCount stays best-effort.
    }
  }
  return removed;
}

/**
 * FNV-1a 32-bit hash of a numeric string, returned as a hex bucket id.
 * Avoids JavaScript BigInt precision issues by hashing the string directly.
 */
export function hashBucket(userId: string, shardCount: number): string {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const idx = Math.abs(hash | 0) % shardCount;
  return idx.toString(16).padStart(2, "0");
}
