// Local achievement counters — what THIS user has done with the extension.
// Lives in chrome.storage.local. NOT synced to the Worker, NOT PII —
// purely a "你已经帮社区干掉 N 个号" UX feel-good signal in the popup.
//
// Bumped by the background-script message dispatcher, which is the
// natural choke point for every action the user takes:
//   - classify   → "AI 扫了一个"
//   - lookup hit → "命中公榜（直接拉黑、零成本）"
//   - confirm    → "你亲手拉黑了一个"

export interface LocalStats {
  /** Total /v1/classify calls that returned cached:false (i.e. real LLM work). */
  scanned: number;
  /** Total times this user hit the public blacklist (no LLM call needed). */
  hitPublic: number;
  /** Total /v1/confirm calls — i.e. user clicked the in-page block button. */
  blocked: number;
  /** First-ever use timestamp; lets us show "陪你 N 天了". */
  firstUsedAt: number;
}

const KEY = "mxga_stats_v1";

export async function getStats(): Promise<LocalStats> {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY, (got) => {
      const s = (got?.[KEY] ?? {}) as Partial<LocalStats>;
      resolve({
        scanned: s.scanned ?? 0,
        hitPublic: s.hitPublic ?? 0,
        blocked: s.blocked ?? 0,
        firstUsedAt: s.firstUsedAt ?? Date.now(),
      });
    });
  });
}

export async function bumpStatBy(
  key: keyof Omit<LocalStats, "firstUsedAt">,
  n = 1,
): Promise<void> {
  const cur = await getStats();
  cur[key] = (cur[key] ?? 0) + Math.max(0, Math.floor(n));
  // Set firstUsedAt the first time we bump anything from a fresh install.
  if (!cur.firstUsedAt) cur.firstUsedAt = Date.now();
  await new Promise<void>((r) => chrome.storage.local.set({ [KEY]: cur }, () => r()));
}

export async function bumpStat(key: keyof Omit<LocalStats, "firstUsedAt">): Promise<void> {
  await bumpStatBy(key, 1);
}
