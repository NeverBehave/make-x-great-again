import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  add,
  bloomParams,
  test as bloomTest,
  createBloomFilter,
  deserialize,
  serialize,
} from "../src/public-list/bloom.ts";
import { generatePublicList, hashBucket } from "../src/public-list/generate.ts";
import { BloomIndex, Meta, type PublicEntry, ShardManifest } from "../src/public-list/schema.ts";

const tmp = mkdtempSync(join(tmpdir(), "xss-pl-"));
process.env.CURATION_DB_PATH = join(tmp, "records.jsonl");
process.env.PUBLIC_LIST_DIR = join(tmp, "public-list");
after(() => rmSync(tmp, { recursive: true, force: true }));

// ---- bloom filter ----

test("bloom filter: add and test", () => {
  const f = createBloomFilter();
  add(f, "12345");
  assert.equal(bloomTest(f, "12345"), true);
  assert.equal(bloomTest(f, "99999"), false);
});

test("bloom filter: serialize roundtrip", () => {
  const f = createBloomFilter();
  add(f, "111");
  add(f, "222");
  const s = serialize(f);
  const f2 = deserialize(s);
  assert.equal(bloomTest(f2, "111"), true);
  assert.equal(bloomTest(f2, "222"), true);
  assert.equal(bloomTest(f2, "333"), false);
});

test("bloom filter: index size for 10k entries is ~12 KB", () => {
  const f = createBloomFilter(95850, 7);
  for (let i = 0; i < 10_000; i++) add(f, String(i));
  const s = serialize(f);
  const json = JSON.stringify({ schema: 1, ...s });
  const size = Buffer.byteLength(json, "utf8");
  assert.ok(size < 20_000, `expected <20 KB, got ${size} bytes`);
});

test("bloomParams computes optimal m/k and floors n at 1", () => {
  const { m, k } = bloomParams(10_000, 0.01);
  assert.equal(m, Math.ceil((-10_000 * Math.log(0.01)) / Math.LN2 ** 2));
  assert.equal(k, Math.max(1, Math.round((m / 10_000) * Math.LN2)));
  // Empty set still yields a usable filter (m >= 2, k >= 1).
  const empty = bloomParams(0, 0.01);
  assert.ok(empty.m >= 2);
  assert.ok(empty.k >= 1);
});

test("bloom filter: FPR stays under 2% with computed sizing at 10k entries", () => {
  const n = 10_000;
  const { m, k } = bloomParams(n, 0.01);
  const f = createBloomFilter(m, k);
  for (let i = 0; i < n; i++) add(f, `present-${i}`);
  let falsePositives = 0;
  for (let i = 0; i < n; i++) {
    if (bloomTest(f, `absent-${i}`)) falsePositives++;
  }
  const fpr = falsePositives / n;
  assert.ok(fpr < 0.02, `expected FPR < 0.02, got ${fpr} (${falsePositives}/${n})`);
});

test("bloom filter: golden serialization vector pins the wire format", () => {
  // If this test breaks, the hash spec in src/public-list/bloom.ts changed
  // (SHA-256 double hashing, h2 in [1, m-1], LSB-first bits, base64 bytes)
  // and every published index.json consumer breaks with it.
  const f = createBloomFilter(64, 3);
  for (const key of ["1", "22", "333"]) add(f, key);
  const s = serialize(f);
  assert.deepEqual(s, { k: 3, m: 64, n: 3, bits: "iCQAIAAhCAE=" });
});

// ---- hash bucket ----

test("hashBucket returns 2-hex string for 256 shards", () => {
  const b = hashBucket("123456789", 256);
  assert.match(b, /^[0-9a-f]{2}$/);
});

test("hashBucket distributes roughly evenly", () => {
  const counts = new Map<string, number>();
  for (let i = 0; i < 10_000; i++) {
    const b = hashBucket(String(i), 256);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  // Should fill all 256 buckets
  assert.equal(counts.size, 256);
});

// ---- generatePublicList ----

test("generatePublicList: empty source produces empty output", () => {
  const dbPath = join(tmp, "empty.jsonl");
  writeFileSync(dbPath, "", "utf8");
  const outDir = join(tmp, "out-empty");
  const result = generatePublicList({
    sourcePath: dbPath,
    outDir,
    version: "v0.0.0",
    sourceCommit: "abc123",
  });
  assert.equal(result.totalEntries, 0);
  // Bloom filter index still exists with n=0, but size is bounded
  assert.ok(result.indexSizeBytes < 20_000, `index size ${result.indexSizeBytes} should be < 20KB`);
  assert.ok(result.metaSizeBytes > 0, "meta.json should be written");
  // Verify meta.json has count 0
  const meta = JSON.parse(readFileSync(join(outDir, "data", "meta.json"), "utf8"));
  assert.equal(meta.count, 0);
});

test("generatePublicList: filters only human_confirmed spam/porn_bot", () => {
  const dbPath = join(tmp, "filter.jsonl");
  const lines = [
    {
      userId: "1",
      handle: "a",
      signalsHash: "h1",
      model: "m",
      reviewStatus: "human_confirmed",
      verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "2",
      handle: "b",
      signalsHash: "h2",
      model: "m",
      reviewStatus: "auto_pending_review",
      verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "3",
      handle: "c",
      signalsHash: "h3",
      model: "m",
      reviewStatus: "human_confirmed",
      verdict: { label: "legit", confidence: 0.9, reasons: ["r1"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "4",
      handle: "d",
      signalsHash: "h4",
      model: "m",
      reviewStatus: "rejected",
      verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  writeFileSync(dbPath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  const result = generatePublicList({
    sourcePath: dbPath,
    outDir: join(tmp, "out-filter"),
    version: "v1.0.0",
    sourceCommit: "abc123",
    reviewStatus: "human_confirmed",
  });
  assert.equal(result.totalEntries, 1);
});

test("generatePublicList: dedupes by userId, latest wins", () => {
  const dbPath = join(tmp, "dedup.jsonl");
  const lines = [
    {
      userId: "42",
      handle: "old",
      signalsHash: "h1",
      model: "m",
      reviewStatus: "human_confirmed",
      verdict: { label: "spam", confidence: 0.5, reasons: ["old"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    {
      userId: "42",
      handle: "new",
      signalsHash: "h2",
      model: "m",
      reviewStatus: "human_confirmed",
      verdict: { label: "spam", confidence: 0.9, reasons: ["new"] },
      createdAt: "2026-01-02T00:00:00.000Z",
    },
  ];
  writeFileSync(dbPath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  const result = generatePublicList({
    sourcePath: dbPath,
    outDir: join(tmp, "out-dedup"),
    version: "v1.0.0",
    sourceCommit: "abc123",
  });
  assert.equal(result.totalEntries, 1);
  // Verify the latest won by reading the shard
  const shard = JSON.parse(
    readFileSync(join(tmp, "out-dedup", "data", "shards", `${hashBucket("42", 256)}.json`), "utf8"),
  );
  const entry = shard.list[0] as PublicEntry;
  assert.equal(entry.h, "new");
  assert.equal(entry.c, 0.9);
});

test("generatePublicList: rebuilds data dir so removed entries do not leave stale shards", () => {
  const dbPath = join(tmp, "stale-shard.jsonl");
  const outDir = join(tmp, "out-stale-shard");
  const lines = [
    {
      userId: "123",
      handle: "gone",
      signalsHash: "h1",
      model: "m",
      reviewStatus: "human_confirmed",
      verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  writeFileSync(dbPath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  generatePublicList({ sourcePath: dbPath, outDir, version: "v1.0.0", sourceCommit: "abc123" });

  const staleShardPath = join(outDir, "data", "shards", `${hashBucket("123", 256)}.json`);
  assert.equal(existsSync(staleShardPath), true);

  writeFileSync(dbPath, "", "utf8");
  generatePublicList({ sourcePath: dbPath, outDir, version: "v1.0.1", sourceCommit: "def456" });

  assert.equal(existsSync(staleShardPath), false);
  const meta = JSON.parse(readFileSync(join(outDir, "data", "meta.json"), "utf8"));
  assert.equal(meta.count, 0);
  // The disappeared entry is reported as removed relative to the previous release.
  assert.equal(meta.removedCount, 1);
});

test("generatePublicList: skips malformed and schema-invalid source lines", () => {
  const dbPath = join(tmp, "invalid-lines.jsonl");
  const good = {
    userId: "777",
    handle: "ok",
    signalsHash: "h1",
    model: "m",
    reviewStatus: "human_confirmed",
    verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const lines = [
    "{not json at all",
    JSON.stringify({ userId: "888", reviewStatus: "human_confirmed" }), // fails CurationRecord
    JSON.stringify(good),
  ];
  writeFileSync(dbPath, lines.join("\n"), "utf8");
  const result = generatePublicList({
    sourcePath: dbPath,
    outDir: join(tmp, "out-invalid-lines"),
    version: "v1.0.0",
    sourceCommit: "abc123",
  });
  assert.equal(result.totalEntries, 1);
});

test("generatePublicList: excludes synthetic placeholder ids (idResolved=false)", () => {
  const dbPath = join(tmp, "placeholder.jsonl");
  const base = {
    signalsHash: "h1",
    model: "m",
    reviewStatus: "human_confirmed",
    verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const lines = [
    // Leading-zero id = handle-only placeholder from src/mvp.ts — must never publish.
    { ...base, userId: "0123456789", handle: "handle_only" },
    { ...base, userId: "123456789", handle: "real_id" },
  ];
  writeFileSync(dbPath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  const outDir = join(tmp, "out-placeholder");
  const result = generatePublicList({
    sourcePath: dbPath,
    outDir,
    version: "v1.0.0",
    sourceCommit: "abc123",
  });
  assert.equal(result.totalEntries, 1);
  const shard = JSON.parse(
    readFileSync(join(outDir, "data", "shards", `${hashBucket("123456789", 256)}.json`), "utf8"),
  );
  assert.equal((shard.list[0] as PublicEntry).h, "real_id");
});

test("generatePublicList: bloom index is sized for the entry count and explicit removedCount wins", () => {
  const dbPath = join(tmp, "sizing.jsonl");
  const lines = Array.from({ length: 50 }, (_, i) => ({
    userId: String(1000 + i),
    handle: `u${i}`,
    signalsHash: `h${i}`,
    model: "m",
    reviewStatus: "human_confirmed",
    verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
    createdAt: "2026-01-01T00:00:00.000Z",
  }));
  writeFileSync(dbPath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  const outDir = join(tmp, "out-sizing");
  const result = generatePublicList({
    sourcePath: dbPath,
    outDir,
    version: "v1.0.0",
    sourceCommit: "abc123",
    removedCount: 7,
  });
  assert.equal(result.removedCount, 7);
  const index = BloomIndex.parse(
    JSON.parse(readFileSync(join(outDir, "data", "index.json"), "utf8")),
  );
  const expected = bloomParams(50, 0.01);
  assert.equal(index.m, expected.m);
  assert.equal(index.k, expected.k);
  assert.equal(index.n, 50);
});

test("generatePublicList: meta and index schemas validate", () => {
  const dbPath = join(tmp, "schema.jsonl");
  const lines = [
    {
      userId: "100",
      handle: "a",
      signalsHash: "h1",
      model: "m",
      reviewStatus: "human_confirmed",
      verdict: { label: "spam", confidence: 0.9, reasons: ["r1"] },
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ];
  writeFileSync(dbPath, lines.map((l) => JSON.stringify(l)).join("\n"), "utf8");
  const outDir = join(tmp, "out-schema");
  generatePublicList({ sourcePath: dbPath, outDir, version: "v1.0.0", sourceCommit: "abc123" });
  const meta = JSON.parse(readFileSync(join(outDir, "data", "meta.json"), "utf8"));
  const index = JSON.parse(readFileSync(join(outDir, "data", "index.json"), "utf8"));
  assert.doesNotThrow(() => Meta.parse(meta));
  assert.doesNotThrow(() => BloomIndex.parse(index));
  assert.equal(meta.count, 1);
  assert.equal(meta.shardCount, 256);
});
