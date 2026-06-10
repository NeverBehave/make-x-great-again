import { appendFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { type CurationRecord, CurationRecord as CurationRecordSchema } from "./schema.ts";

/**
 * Append-only JSONL local curation store — the private source of truth.
 * Never published as-is; the public list is produced only after the
 * human-review gate.
 */
const DB_PATH = process.env.CURATION_DB_PATH ?? ".curation-db/records.jsonl";

let cache: { mtimeMs: number; size: number; records: CurationRecord[] } | null = null;

/**
 * Read every record, cached by file mtime+size so hot paths (e.g. /lookup)
 * don't re-read and re-parse the whole JSONL on each call. Malformed lines
 * are warned about and skipped — one bad line must not take the store down.
 */
export function readAll(): CurationRecord[] {
  let stat: { mtimeMs: number; size: number };
  try {
    stat = statSync(DB_PATH);
  } catch {
    cache = null;
    return [];
  }
  if (cache && cache.mtimeMs === stat.mtimeMs && cache.size === stat.size) {
    return cache.records;
  }

  let raw: string;
  try {
    raw = readFileSync(DB_PATH, "utf8");
  } catch {
    cache = null;
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
      console.warn(`WARN: skipping malformed JSON at ${DB_PATH}:${i + 1}`);
      continue;
    }
    const parsed = CurationRecordSchema.safeParse(json);
    if (!parsed.success) {
      console.warn(`WARN: skipping invalid CurationRecord at ${DB_PATH}:${i + 1}`);
      continue;
    }
    out.push(parsed.data);
  }
  cache = { mtimeMs: stat.mtimeMs, size: stat.size, records: out };
  return out;
}

/** Latest record per userId (last write wins). */
export function latestByUserId(): Map<string, CurationRecord> {
  const m = new Map<string, CurationRecord>();
  for (const r of readAll()) m.set(r.userId, r);
  return m;
}

export function appendRecord(record: CurationRecord): void {
  CurationRecordSchema.parse(record);
  mkdirSync(dirname(DB_PATH), { recursive: true });
  appendFileSync(DB_PATH, `${JSON.stringify(record)}\n`, "utf8");
}
