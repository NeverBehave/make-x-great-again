// Single source of truth for the project's public identity, mirrored from
// `services/edge/src/brand.ts`. Used by every extension entry-point + the
// content-script so links can be moved in one place when the project changes
// home.

export const BRAND = {
  /** Public GitHub repo URL (no trailing slash). */
  repo: "https://github.com/foru17/x-spam-sentinel",
  /** Latest GitHub Release page (auto-redirects to newest .zip). */
  release: "https://github.com/foru17/x-spam-sentinel/releases/latest",
  /** Public Worker base URL (custom domain). The extension can still override
   *  this from settings for testing against localhost or staging. */
  edgeBase: "https://x.zuoluo.tv",
  /** Governance doc inside the repo. */
  governance:
    "https://github.com/foru17/x-spam-sentinel/blob/main/docs/GOVERNANCE.md",
  /** Privacy doc inside the repo. */
  privacy: "https://github.com/foru17/x-spam-sentinel/blob/main/docs/PRIVACY.md",
  /** Appeal / removal request entry (used by the content-script bubble). */
  appealNewIssue:
    "https://github.com/foru17/x-spam-sentinel/issues/new?template=appeal.yml",
  /** Generic issue tracker URL. */
  issues: "https://github.com/foru17/x-spam-sentinel/issues",
  /** Owner display name. */
  owner: "foru17",
  /** License id. */
  license: "AGPL-3.0",
} as const;
