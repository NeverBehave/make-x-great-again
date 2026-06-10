import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const destPath = path.resolve(__dirname, "../extension/public/blacklist-data.json");

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${name}: ${ok ? "✅ PASS" : "❌ FAIL"}${detail ? ` ${detail}` : ""}`);
  if (!ok) failures++;
}

console.log("Loading compacted blacklist...");
const list = JSON.parse(fs.readFileSync(destPath, "utf-8"));
console.log("Loaded successfully. Total entries:", list.length);
check("Compiled list is non-empty", list.length > 0);

// Build lookup maps mirroring extension/lib/local-index.ts.
const userIdMap = new Map();
const handleMap = new Map();
for (const [userId, handle, label, confidence, reasons] of list) {
  const entry = { userId, handle, verdict: { label, confidence, reasons } };
  if (userId) userIdMap.set(userId, entry);
  if (handle) handleMap.set(handle.toLowerCase(), entry);
}

// Derive probe accounts from the compiled file itself instead of hard-coding
// ids that may rotate out of the list.
const probeById = list.find(([userId]) => Boolean(userId));
const probeByHandle = list.find(([, handle]) => Boolean(handle));

// Test case 1: lookup by user ID.
if (probeById) {
  const [testUserId] = probeById;
  const match = userIdMap.get(testUserId);
  check(`Lookup User ID "${testUserId}"`, Boolean(match));
  if (match) {
    console.log("  Handle:", match.handle);
    console.log("  Verdict:", match.verdict.label);
    console.log("  Reasons:", match.verdict.reasons);
  }
} else {
  check("Found an entry with a userId to probe", false);
}

// Test case 2: lookup by handle.
if (probeByHandle) {
  const [, testHandle] = probeByHandle;
  const match = handleMap.get(testHandle.toLowerCase());
  check(`Lookup Handle "${testHandle}"`, Boolean(match));
  if (match) {
    console.log("  User ID:", match.userId);
    console.log("  Verdict:", match.verdict.label);
  }
} else {
  check("Found an entry with a handle to probe", false);
}

// Test case 3: non-existent lookup must miss.
const nonExistent = "clean_user_123_does_not_exist";
check(
  `Lookup non-existent "${nonExistent}" returns null`,
  handleMap.get(nonExistent.toLowerCase()) === undefined,
);

if (failures > 0) {
  console.error(`\nSmoke test FAILED: ${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nSmoke test passed.");
