# Trust tiers, GitHub-gated reporting & admin moderation

Status: **proposed** (design + feasibility). Extends GOVERNANCE.md and the
Cloudflare architecture. No code yet.

## Why (threat model)

Today every install can hit the Worker freely:

1. **LLM-cost abuse** — `/v1/classify` holds the server LLM key; anyone can
   burn it.
2. **Report/defamation abuse** — anonymous `/v1/report` can be weaponized to
   mass-list innocent accounts.
3. **Public-list integrity** — needs a real gatekeeper before anything goes
   public.

## Trust tiers (the core idea)

| Tier | Who | Can do |
|---|---|---|
| **Anonymous** | any installed extension | **read only**: `/v1/check`, fetch public list/bloom. Cheap, cacheable, no abuse surface. Local heuristic + local cache still work. |
| **Verified reporter** | signed in with **GitHub** | `/v1/report`. Rate-limited & bannable *per GitHub account*. |
| **Admin (守门员)** | maintainer allowlist | moderation panel: approve / reject / remove. |

Key move: **separate cheap public reads from costly/abusable writes.** Server
LLM classification is no longer a free anonymous endpoint.

## GitHub-gated reporting (feasible, well-trodden)

- Extension uses **GitHub OAuth Device Flow** (best for extensions — no
  redirect-URI hassle): user clicks "用 GitHub 登录以上报" → opens
  `github.com/login/device`, enters code → extension stores the token in
  `chrome.storage`.
- Worker verifies the token via `GET https://api.github.com/user`, derives
  `reporter = gh:<id>` (no PII beyond a GitHub id), rate-limits/bans per id.
- `/v1/report` & `/v1/confirm` require a valid GitHub identity → `401`
  otherwise. `/v1/check` stays anonymous.
- Cost: a free GitHub OAuth App. Effort: **Low–Medium.**

## Report → AI → auto / queue → admin (the gatekeeper pipeline)

```
GitHub-verified report → D1 reports(pending)
        │
        ▼  server re-classifies (Worker → LLM) + counts independent GH reporters
   ┌────────────────────────────────────────────────┐
   │ AI = spam/porn_bot, high conf (≥0.9)            │
   │   AND ≥ K independent GitHub reporters          │ → AUTO-confirm → public
   ├────────────────────────────────────────────────┤
   │ anything else (疑似 / low corroboration / AI    │ → ADMIN QUEUE
   │ unsure)                                         │   (human decides)
   └────────────────────────────────────────────────┘
        │
        ▼  Admin panel: approve → public · reject → dropped · remove → unpublish
```

### Governance reconciliation (must flag)

GOVERNANCE.md currently says *AI verdict never auto-public; needs human
gate*. The user wants clear-cut spam auto-processed. Compromise that keeps
the red line intact: **the human signal = K independent GitHub-verified
reporters.** AI-high-confidence **plus** real corroborating humans → auto.
AI alone never auto-publishes. Everything borderline → admin. (K is a
policy knob, default e.g. 3.)

## Admin moderation panel (守门员)

- A protected web page (Worker-served or static + Worker API). Auth =
  maintainer GitHub-login allowlist (or Cloudflare Access).
- Queue view: account + AI verdict/confidence + evidence (signals snapshot)
  + #reporters; actions **通过 / 驳回 / 移除**, writes `review_log`.
- D1 already has `accounts`, `reports`, `review_log`. Add: `reports.reporter`
  = gh id; `accounts.status` transitions; admin endpoints; allowlist.
- Effort: **Medium** (UI is small; reuses the panel design system).

## Feasibility summary

| Piece | Effort | Notes |
|---|---|---|
| GitHub Device-Flow auth (ext) + Worker verify | Low–Med | standard |
| Gate `/v1/report` `/v1/confirm` by GitHub id | Low | header check |
| Protect `/v1/classify` from anonymous abuse | **decision** | see below |
| Report→AI re-score + auto/queue rule | Med | Worker + D1 |
| Admin moderation panel + admin auth | Med | new Worker routes + small UI |

All on the **existing Cloudflare stack — no new infra.** This is a coherent,
buildable evolution of the current design.

## Decisions (locked by owner)

1. **`/v1/classify` = GitHub-authed only.** Anonymous installs get
   read-only public list (`/v1/check`) + local heuristic + local cache.
   Server-side AI classification requires GitHub login. The server LLM key
   is never an anonymous endpoint. (UX implication: not-logged-in users
   don't get fresh AI verdicts on brand-new accounts — only known-list hits
   + local heuristic. Logging in with GitHub unlocks AI analysis. This is
   the accepted security trade-off.)
2. **Auto-publish = AI ≥ 0.9 AND ≥ 3 independent GitHub reporters.**
   Everything else → admin review queue. AI alone never auto-publishes
   (governance red line intact; the 3 real GitHub reporters are the human
   signal). K=3 is a tunable policy knob.
