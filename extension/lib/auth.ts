// Local auth/config storage. GitHub token gates the write endpoints.
// (Admin moderation is a separate web console, never in the extension.)
const K = {
  ghClientId: "xss:ghClientId",
  ghToken: "xss:ghToken",
  ghLogin: "xss:ghLogin",
} as const;

async function get(k: string): Promise<string> {
  try {
    return ((await chrome.storage.local.get(k))[k] as string) ?? "";
  } catch {
    return "";
  }
}
async function set(k: string, v: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [k]: v });
  } catch {
    /* non-fatal */
  }
}

// Public Device-Flow client id (no secret). Overridable via the panel.
const DEFAULT_GH_CLIENT_ID = "Ov23lirXe9BdkZvvs39b";
export const getGhClientId = async () =>
  (await get(K.ghClientId)) || DEFAULT_GH_CLIENT_ID;
export const setGhClientId = (v: string) => set(K.ghClientId, v.trim());
export const getGhToken = () => get(K.ghToken);
export const getGhLogin = () => get(K.ghLogin);
export const setGh = async (token: string, login: string) => {
  await set(K.ghToken, token);
  await set(K.ghLogin, login);
};
export const clearGh = async () => {
  await set(K.ghToken, "");
  await set(K.ghLogin, "");
};
