import { createHash } from "node:crypto";

/**
 * Zero-dependency Bloom filter using SHA-256 double hashing.
 * Portable: runs in Node, Deno, Bun, and any modern browser (Web Crypto).
 *
 * Hash & wire specification (so third parties can reimplement exactly):
 *   key    : UTF-8 bytes of the entry key (the decimal X user-id string).
 *   digest : SHA-256(key) — 32 bytes.
 *   h1     : unsigned 32-bit big-endian integer from digest bytes 0..3.
 *   h2raw  : unsigned 32-bit big-endian integer from digest bytes 4..7.
 *   h2     : (h2raw mod (m - 1)) + 1 — forces h2 into [1, m-1] so the k
 *            probes can never degenerate to a single bit (requires m >= 2).
 *   probes : idx_i = (h1 + i * h2) mod m, for i = 0 .. k-1.
 *   bits   : bit idx lives in byte floor(idx / 8) at mask 1 << (idx mod 8)
 *            (LSB-first within each byte); the array is ceil(m / 8) bytes.
 *   wire   : { k, m, n, bits } where `bits` is standard base64 of the bytes.
 *
 * NOTE: the h2 range restriction is a deliberate wire-format change from the
 * first draft (which used h2 mod m and degenerated when h2 ≡ 0 mod m). There
 * were no external consumers yet, so the format was fixed in place instead of
 * being versioned.
 *
 * Sizing: use `bloomParams(n, p)` to derive m/k for a target false-positive
 * rate. The createBloomFilter defaults are tuned for ~10k entries at 1% FPR.
 */

export interface BloomFilter {
  m: number;
  k: number;
  n: number;
  bits: Uint8Array;
}

const DEFAULT_M = 95850;
const DEFAULT_K = 7;

/**
 * Optimal Bloom parameters for n entries at target false-positive rate p:
 *   m = ceil(-n * ln(p) / ln(2)^2),  k = max(1, round(m / n * ln(2)))
 * n is floored at 1 so an empty set still yields a valid (m >= 2) filter.
 */
export function bloomParams(n: number, p = 0.01): { m: number; k: number } {
  const safeN = Math.max(1, n);
  const m = Math.max(2, Math.ceil((-safeN * Math.log(p)) / Math.LN2 ** 2));
  const k = Math.max(1, Math.round((m / safeN) * Math.LN2));
  return { m, k };
}

export function createBloomFilter(m = DEFAULT_M, k = DEFAULT_K): BloomFilter {
  return { m, k, n: 0, bits: new Uint8Array(Math.ceil(m / 8)) };
}

/** Insert a key (string) into the filter. */
export function add(filter: BloomFilter, key: string): void {
  const { m, k } = filter;
  const { h1, h2 } = hashPair(key, m);
  for (let i = 0; i < k; i++) {
    const idx = (h1 + i * h2) % m;
    setBit(filter.bits, idx);
  }
  filter.n += 1;
}

/** Test whether a key is *probably* in the set. */
export function test(filter: BloomFilter, key: string): boolean {
  const { m, k } = filter;
  const { h1, h2 } = hashPair(key, m);
  for (let i = 0; i < k; i++) {
    const idx = (h1 + i * h2) % m;
    if (!getBit(filter.bits, idx)) return false;
  }
  return true;
}

/** Serialize to the wire format used in index.json. */
export function serialize(filter: BloomFilter): { k: number; m: number; n: number; bits: string } {
  return {
    k: filter.k,
    m: filter.m,
    n: filter.n,
    bits: Buffer.from(filter.bits).toString("base64"),
  };
}

/** Deserialize from the wire format. */
export function deserialize(data: { k: number; m: number; n: number; bits: string }): BloomFilter {
  const bits = Buffer.from(data.bits, "base64");
  return { m: data.m, k: data.k, n: data.n, bits };
}

// ---- internals ----

function setBit(bits: Uint8Array, idx: number): void {
  const byteIdx = idx >> 3;
  const bitMask = 1 << (idx & 7);
  bits[byteIdx] = (bits[byteIdx] ?? 0) | bitMask;
}

function getBit(bits: Uint8Array, idx: number): boolean {
  const byteIdx = idx >> 3;
  return ((bits[byteIdx] ?? 0) & (1 << (idx & 7))) !== 0;
}

/**
 * Produce the double-hashing pair from a single SHA-256 digest.
 * h2 is mapped into [1, m-1] so it is never ≡ 0 (mod m) — otherwise all k
 * probes would collapse onto the same bit. See the header spec.
 */
function hashPair(key: string, m: number): { h1: number; h2: number } {
  const digest = createHash("sha256").update(key, "utf8").digest();
  const h1 = digest.readUInt32BE(0) >>> 0;
  const h2 = ((digest.readUInt32BE(4) >>> 0) % (m - 1)) + 1;
  return { h1, h2 };
}
