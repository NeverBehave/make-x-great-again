import { createHash } from "node:crypto";
import { config } from "./config.ts";
import { classifyWithLlm } from "./llm.ts";
import { type AccountSignals, type CurationRecord, AccountSignals as Signals } from "./schema.ts";
import { appendRecord, latestByUserId } from "./store.ts";

/**
 * Stable hash of the signals that actually feed the model — every field
 * buildUserPrompt (src/llm.ts) uses, canonicalized in a fixed key order with
 * absent optionals pinned to null. userId is deliberately excluded so the
 * same profile content hashes identically regardless of id.
 */
export function signalsHash(s: AccountSignals): string {
  const canonical = JSON.stringify({
    handle: s.handle,
    displayName: s.displayName,
    bio: s.bio,
    recentTweets: s.recentTweets,
    triggeringComment: s.triggeringComment ?? null,
    threadTopic: s.threadTopic ?? null,
    accountAgeDays: s.accountAgeDays ?? null,
    followersCount: s.followersCount ?? null,
    followingCount: s.followingCount ?? null,
    hasDefaultAvatar: s.hasDefaultAvatar ?? null,
  });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export interface ClassifyOutcome {
  record: CurationRecord;
  cached: boolean;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

/**
 * Classify one account. Skips the LLM if we already scored these exact
 * signals (cache by userId + signalsHash). The result is stored as
 * `auto_pending_review` — never auto-public (governance red-line).
 */
export async function classifyAccount(
  input: unknown,
  opts: { force?: boolean } = {},
): Promise<ClassifyOutcome> {
  const signals = Signals.parse(input);
  const hash = signalsHash(signals);

  if (!opts.force) {
    const prev = latestByUserId().get(signals.userId);
    if (prev && prev.signalsHash === hash) {
      return { record: prev, cached: true };
    }
  }

  const { verdict, usage } = await classifyWithLlm(signals);
  const record: CurationRecord = {
    userId: signals.userId,
    handle: signals.handle,
    signalsHash: hash,
    verdict,
    model: config.LLM_MODEL,
    reviewStatus: "auto_pending_review",
    createdAt: new Date().toISOString(),
  };
  appendRecord(record);
  return { record, cached: false, ...(usage ? { usage } : {}) };
}
