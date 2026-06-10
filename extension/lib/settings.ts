// User-facing settings (chrome.storage.local, single object). Read at
// content-script start + live-updated via storage.onChanged. No PII.
/** How a confirmed spam account is handled when the user takes action:
 *  - "local": hide its posts only in this extension (display:none). Zero
 *    network — X never knows. Reversible from the options page. (default)
 *  - "mute":  X-native one-way mute. ta still exists for you, you just stop
 *    seeing them; ta is not notified; follow relationship is kept.
 *  - "block": X-native block. Mutual — breaks the follow relationship and
 *    hides you from each other. Strongest. */
export type ActionMode = "local" | "mute" | "block";

export interface Settings {
  enabled: boolean; // master: passive detection on/off
  bubble: boolean; // show the corner bubble
  bubblePos: "tr" | "br"; // top-right / bottom-right
  actionMode: ActionMode; // what "隐藏" does to a flagged account
  edgeBase: string; // advanced: override the public-list site base URL (links only)
}

export const DEFAULTS: Settings = {
  enabled: true,
  bubble: true,
  bubblePos: "tr",
  actionMode: "local",
  edgeBase: "",
};

const KEY = "xss:settings";

export async function getSettings(): Promise<Settings> {
  try {
    const g = await chrome.storage.local.get(KEY);
    return { ...DEFAULTS, ...((g[KEY] as Partial<Settings>) ?? {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function setSetting<K extends keyof Settings>(
  k: K,
  v: Settings[K],
): Promise<void> {
  try {
    const s = await getSettings();
    await chrome.storage.local.set({ [KEY]: { ...s, [k]: v } });
  } catch {
    /* non-fatal */
  }
}

/** Fires whenever settings change (any tab/page). Returns an unsubscribe. */
export function onSettingsChange(cb: (s: Settings) => void): () => void {
  const h = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area === "local" && changes[KEY]) {
      cb({ ...DEFAULTS, ...((changes[KEY].newValue as Partial<Settings>) ?? {}) });
    }
  };
  chrome.storage.onChanged.addListener(h);
  return () => chrome.storage.onChanged.removeListener(h);
}
