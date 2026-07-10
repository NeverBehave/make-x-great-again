// Local public-member index — shipped with the extension, loaded at startup.
// Provides O(1) lookup by numeric userId and handle. No remote requests.
import type { Label, Verdict } from "./types";

const LABELS: ReadonlySet<string> = new Set<Label>([
  "spam",
  "porn_bot",
  "likely_spam",
  "uncertain",
  "legit",
]);

export interface IndexEntry {
  userId: string;
  handle: string;
  verdict: Verdict;
  source: "curated" | "community";
  updatedAt: string; // ISO date
}

// ---- In-memory lookup structures ----
let userIdMap: Map<string, IndexEntry> | null = null;
let handleMap: Map<string, IndexEntry> | null = null;
let warmed = false;

type Row = [string, string, string, number, string[]];
interface Manifest {
  version: number;
  total: number;
  shards: string[];
}

/** Warm the local index at startup (asynchronous, loads sharded blacklist). */
export async function warmLocalIndex(): Promise<void> {
  if (warmed) return;
  try {
    // AMO's validator refuses to parse any single JSON file > 5 MB, so the
    // dataset is split across N shards listed in a tiny manifest file.
    const manifestUrl = chrome.runtime.getURL("blacklist-data.json");
    const manifest = (await (await fetch(manifestUrl)).json()) as Manifest;

    const shardLists = await Promise.all(
      manifest.shards.map(async (name) => {
        const url = chrome.runtime.getURL(name);
        return (await (await fetch(url)).json()) as Row[];
      }),
    );

    userIdMap = new Map();
    handleMap = new Map();

    const updatedAt = new Date().toISOString();
    for (const list of shardLists) {
      for (const [userId, handle, label, confidence, reasons] of list) {
        if (!LABELS.has(label)) continue; // unknown label → skip entry
        const entry: IndexEntry = {
          userId,
          handle,
          verdict: {
            label: label as Label,
            confidence,
            reasons,
          },
          source: "curated",
          updatedAt,
        };
        if (userId) userIdMap.set(userId, entry);
        if (handle) handleMap.set(handle.toLowerCase(), entry);
      }
    }
    warmed = true;
  } catch (e) {
    console.error("Failed to load local blacklist index:", e);
  }
}

/** Synchronous lookup by numeric userId. Returns null if not found. */
export function lookupByUserId(userId: string): IndexEntry | null {
  return userIdMap?.get(userId) ?? null;
}

/** Synchronous lookup by handle (case-insensitive). Returns null if not found. */
export function lookupByHandle(handle: string): IndexEntry | null {
  return handleMap?.get(handle.toLowerCase()) ?? null;
}

/** Lookup by userId first, fall back to handle. */
export function lookupLocal(userId?: string, handle?: string): IndexEntry | null {
  if (userId) {
    const byId = lookupByUserId(userId);
    if (byId) return byId;
  }
  if (handle) {
    return lookupByHandle(handle);
  }
  return null;
}

/** Total entries in the loaded index. */
export function indexSize(): number {
  return userIdMap ? userIdMap.size : 0;
}
