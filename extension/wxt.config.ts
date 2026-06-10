import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// Make X Great Again (MXGA) — strictly passive. No host permissions beyond
// the content-script match (we only read the DOM already rendered for the
// user) and zero remote requests: the blacklist ships inside the package.
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({ plugins: [tailwindcss()] }),
  // Don't spawn a throwaway browser profile on `wxt dev`. Load the built
  // .output/chrome-mv3 into your own Chrome (logged into X) manually; WXT
  // still watches + hot-reloads it.
  webExt: { disabled: true },
  // Force Manifest V3 for all browsers (including Firefox).
  manifestVersion: 3,
  // We declare Firefox data-collection below (gecko.data_collection_permissions:
  // none), so silence WXT's reminder that new AMO listings need it.
  suppressWarnings: { firefoxDataCollection: true },
  manifest: ({ browser }) => ({
    name: "Make X Great Again (MXGA)",
    description:
      "Passive spam / porn-bot badges for X, powered by a bundled local blacklist. Zero remote requests. Public-good, open source.",
    permissions: ["storage"],
    action: { default_title: "Make X Great Again (MXGA)" },
    options_ui: { open_in_tab: true },
    // Firefox / AMO requirements (ignored by the Chrome build):
    //  - gecko.id: stable add-on ID, keyed to a domain we control.
    //  - strict_min_version 109.0: the first Firefox release with Manifest V3
    //    support (we no longer ship any MAIN-world content script).
    //  - data_collection_permissions "none": the consumer extension makes zero
    //    remote requests; everything (blacklist, stats) is local. AMO requires
    //    new listings to declare this since 2025-11-03.
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "x-spam-sentinel@zuoluo.tv",
              strict_min_version: "109.0",
              data_collection_permissions: { required: ["none"] },
            },
          },
        }
      : {}),
  }),
});
