# Project status — as-built audit (2026-05-19)

Honest snapshot of what actually exists, its dependencies, and the debt —
the input for the next planning round. Not aspirational.

## 1. One-liner

AI-driven, public-good X(Twitter) anti-spam: a passive consumer **browser
extension** + a deployed **Cloudflare edge service** (curation DB + public
list + gated reporting + standalone admin console), with a **local dev
toolchain** for the classifier.

## 2. Architecture

```
 ┌── Consumer extension (WXT/MV3, public) ──────────────┐
 │ passive scan X DOM → fiber bio → local heuristic →   │
 │ L2 cache / blocklist short-circuit → (miss) edge     │
 │ /v1/classify → inline badge + bubble + 1-click block │
 │ (DOM-drives X's own block) + durable block queue +   │
 │ mgmt panel (overview/blocklist/cache/settings) +     │
 │ GitHub Device-Flow login                             │
 └──────────────┬───────────────────────────────────────┘
        /v1/check (anon) · /v1/classify·report·confirm (gh)
                ▼
 ┌── Cloudflare Worker (Hono) — DEPLOYED ───────────────┐
 │ x-spam-sentinel-edge.zuoluotv.workers.dev            │
 │ D1 (accounts/reports/review_log) · LLM classify ·    │
 │ report→AI+≥3 gh reporters→auto / else queue ·        │
 │ /admin standalone console (ADMIN_TOKEN)              │
 └──────────────────────────────────────────────────────┘
 ┌── Local dev toolchain (src/, not user-facing) ───────┐
 │ tsx CLI classify + node:test fixtures + a localhost  │
 │ /classify shim (pre-Cloudflare; now superseded)      │
 └──────────────────────────────────────────────────────┘
```

## 3. Components

| 组件 | 作用 | 栈 | 状态 |
|---|---|---|---|
| `extension/` | 消费端 MV3 扩展（检测/拉黑/面板/登录） | WXT, vanilla TS, Shadow DOM | 可用，主功能在 PR#7 |
| `services/edge/` | 边缘 API + D1 + /admin | Hono, Zod, Wrangler | **已部署**线上 |
| `src/` | 本地分类器/CLI/旧 localhost 服务 | tsx, Zod, node:test | 早期，部分被 edge 取代 |
| `docs/` | ARCHITECTURE/UX/FLOW/PRODUCT/MODERATION/MVP/RUNNING/STATUS | — | 较全 |

## 4. 依赖

**内部技术栈**：WXT 0.20 · Hono 4 · Zod 3 · TypeScript 5 · tsx · Biome ·
Wrangler 4 · @cloudflare/workers-types · @types/chrome。

**外部服务依赖（关键，含风险）**：

| 依赖 | 用途 | 风险 |
|---|---|---|
| **LLM `api.ttttt.ai` (gpt-5.5)** | 服务端分类 | 第三方、单点、经常性成本、ToS 未明；key=Worker secret |
| **Cloudflare**（Workers+D1） | 边缘服务/数据库 | 部署在**个人账号** meleilei@gmail.com（非 org），bus-factor |
| **GitHub OAuth App "X-Master"** | 上报/分类鉴权 | client_id Ov23li…（luolei-onl 拥有）；REQUIRE_AUTH 开启后强依赖 |
| **X 内部接口/DOM** | 真·拉黑 + 页面解析 | `blocks/create.json`+不可伪造 transaction-id→只能 DOM 驱动；X 改版即坏，**最脆环节** |
| **unavatar.io** | 审核台老数据头像兜底 | 第三方，仅维护者侧、非关键 |

## 5. 数据与存储

- **D1 `xss-db`**（线上，真源）：`accounts`(x_user_id/handle/avatar_url/
  verdict/confidence/status/source/…)、`reports`(reporter_fp 唯一索引去重)、
  `review_log`、`publications`。状态机：auto_pending_review → human_confirmed
  / rejected / removed。`/v1/check` 只返回 human_confirmed。
- **chrome.storage.local**：`xss:v1:*` 账号判定缓存、`xss:blocklist:v2`
  拉黑记录、`xss:stats` 统计、`xss:blockQueue` 拉黑队列、`xss:ghToken/
  ghLogin/ghClientId`、`xss:edgeBase`。仅本机、无 PII。

## 6. 部署/运行现状

- Worker 已部署：`https://x-spam-sentinel-edge.zuoluotv.workers.dev`
  （个人 CF 账号 cfab318…）；secrets：`LLM_API_KEY`、`ADMIN_TOKEN`。
- **`REQUIRE_AUTH` 仍 = 关**（匿名仍可调用 /v1/classify → LLM 成本暴露未关闭）。
- 审核台：`/admin`（ADMIN_TOKEN 进入）。
- 扩展加载：`extension/.output/chrome-mv3`（生产构建，方案 B：改完 `wxt
  build`、用户点重载）。

## 7. 安全/治理姿态

信任分层（匿名只读 / GitHub 上报 / 维护者审核）；AI 单独永不自动公开，
人工信号=≥3 独立 GitHub 上报人或管理员；除公开数字 ID 外无 PII。**红线已成文
(GOVERNANCE/MODERATION) 且服务端逻辑就位，但强制开关未开。**

## 8. Multica & PR

- Epic LUO-15；T1(LUO-16,todo,**未正式定稿**)、T2(17,ip)、T3(18,ip)、
  T4(19,backlog,**未做**)、T5(20,ip,已部署)、T6(22,backlog,核心已实现)、
  R1(21,backlog,竞品调研未做)。
- main = `9f235d2`（早期 6PR 合并）。**PR#7 巨大且未合并**：真·拉黑、面板、
  T6 服务端、/admin、拉黑队列、动效、登录全在里面。

## 9. 已知缺口 / 技术债 / 风险

1. **PR#7 体量过大、未并 main** —— 分支债重现，审查/回滚困难。
2. **T1 治理/schema 从未正式定稿** —— D1 schema 一路 ad-hoc 演进。
3. **T4 未做** —— 仍走 `/v1/check` 逐 id 查；ARCHITECTURE 设计的 R2
   bloom-first 低成本/可缓存模型尚未落地，规模化成本/性能未兑现。
4. **分类器逻辑双份**：`src/llm.ts` 与 `services/edge` 各一套 SYSTEM 提示，
   易漂移（已发生过需两处同改）。
5. **无 CI / 扩展与 edge 无测试**：只有 `src/` 早期 node:test。
6. **REQUIRE_AUTH 关**：匿名 LLM 成本暴露未闭合（等验收后 flip）。
7. **X DOM/接口脆弱**：选择器与拉黑流程随 X 改版会坏，需持续维护。
8. **CF 在个人账号**：所有权/可持续性（bus-factor）。
9. ADMIN_TOKEN 为单一静态密钥（无每人身份/轮换）。

## 10. 留给规划的开放杠杆（不在此决策）

合并并清理 PR#7 → 正式定稿 T1（含统一 schema + 消除分类器双份）→
是否做 T4(R2 bloom) → REQUIRE_AUTH 上线时机 → CF 账号是否迁 org →
CI/测试基线 → R1 竞品调研。
