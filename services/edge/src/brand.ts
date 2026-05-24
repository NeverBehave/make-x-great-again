// Single source of truth for the project's public identity. Used by the
// Worker SSR pages so the GitHub repo, public domain, and various deep links
// can be moved in one place when the project changes home.
//
// Keep in sync with `extension/lib/brand.ts`.

export const BRAND = {
  /** Public GitHub repo URL (no trailing slash). */
  repo: "https://github.com/foru17/x-spam-sentinel",
  /** Latest GitHub Release page (auto-redirects to newest assets). */
  release: "https://github.com/foru17/x-spam-sentinel/releases/latest",
  /** Public Worker entry point (custom domain). */
  edgeBase: "https://x.zuoluo.tv",
  /** Governance doc inside the repo. */
  governance: "https://github.com/foru17/x-spam-sentinel/blob/main/docs/GOVERNANCE.md",
  /** Privacy doc inside the repo. */
  privacy: "https://github.com/foru17/x-spam-sentinel/blob/main/docs/PRIVACY.md",
  /** Appeal / removal request entry. */
  appealNewIssue: "https://github.com/foru17/x-spam-sentinel/issues/new",
  /** Generic issue tracker URL. */
  issues: "https://github.com/foru17/x-spam-sentinel/issues",
  /** Org / owner display name (shown in the footer). */
  owner: "foru17",
  /** License id. */
  license: "AGPL-3.0",
} as const;
