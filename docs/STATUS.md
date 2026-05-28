# Project status

Public snapshot of what exists today, what it depends on, and what still
needs hardening.

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
 │ (X block API + paced queue) + durable block queue +  │
 │ mgmt panel (overview/blocklist/cache/settings) +     │
 │ GitHub Device-Flow login                             │
 └──────────────┬───────────────────────────────────────┘
        /v1/check (anon) · /v1/classify·report·confirm (gh)
                ▼
 ┌── Cloudflare Worker (Hono) — DEPLOYED ───────────────┐
 │ x.zuoluo.tv  (custom domain; *.workers.dev fallback) │
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
| `extension/` | 消费端 MV3 扩展（检测/拉黑/面板/登录） | WXT, React, Shadow DOM | 可用（v0.4.0：静默真拉黑 + 稳定队列进度 + 批量公榜查询 + GitHub 登录深链） |
| `services/edge/` | 边缘 API + D1 + /admin + agent staging | Hono, Zod, Wrangler | **已部署**线上 |
| `src/` | 本地分类器/CLI/旧 localhost 服务 | tsx, Zod, node:test | 早期，部分被 edge 取代 |
| `docs/` | ARCHITECTURE/UX/FLOW/PRODUCT/MODERATION/MVP/RUNNING/STATUS | — | 较全 |

### 3.1 v0.4.0 增量（2026-05-28）

| 模块 | 改动 | 说明 |
|---|---|---|
| 静默拉黑 | 改走 X `blocks/create.json` | 不再手动调起 X 原生屏蔽弹窗；使用当前 X 登录态 + csrf，通过后台队列限速执行，失败有重试/冷却。 |
| 队列 UI | 气泡新增稳定 4 格状态 + 进度条 + 动画队列表 | 顶部固定展示命中 / 正在 / 待拉 / 已拉，避免状态项出现/消失造成窗口抖动；队列成功后头像和名称划掉淡出。 |
| 批量公榜查询 | `/v1/check?ids=...` | 扩展侧 80ms 聚合，最多 100 个 ID 一批；保留老 `lookup` 单账号消息和服务端旧接口兼容。 |
| GitHub 登录 | popup → options settings 深链 | 未登录时从弹窗点 GitHub 会打开 `options.html?tab=settings&login=1` 并自动启动 Device Flow；验证码卡片支持复制。 |
| Agent 管线 | Side-channel reviewer | 新增 `/v1/agent/queue`、`/v1/agent/decide`、`/v1/agent/stats` 和 `agent_blacklist/agent_whitelist/agent_pending` 私有 staging 状态；admin 可单条/批量 promote。 |
| Agent 安全修复 | stale guard + failure attempts | `/v1/agent/decide` 只允许更新仍在 `auto_pending_review` 的新鲜行；`agent_attempts` 改为失败计数，`requeue` 会清空 agent 注解并重入队列。 |
| Landing 趋势 | `/v1/list/trends` | 返回 48h 小时桶 + 7d 日桶；新增 `idx_accounts_status_published_at` 迁移，供官网趋势图使用。 |

### 3.2 扩展 v0.3.0 增量（2026-05-26）

| 模块 | 改动 | 说明 |
|---|---|---|
| 身份解析 | 多源 + 冲突保护 | MAIN-world fetch/XHR 拦截 X 自家 `/i/api/graphql/*` 响应，跟 JSON-LD `mainEntity.identifier` / follow-button `data-testid` / React fiber `rest_id` 交叉校验；rest_id ≠ id_str 或 avatar-id 撞 uid 直接丢弃。新增 `extension/lib/graphql-users.ts` 共享模块 + `entrypoints/x-graphql-main.content.ts` MAIN-world 脚本。 |
| Viewer-scoped 过滤 | 你自己 / 已 follow / 已 mute / 已 block 的号一律绕过 | 前端 step 0 短路；服务端 `/v1/classify` + `/v1/report` 也短路返回 `{ ignored: true, status: "viewer_ignored" }`，不写 D1。signals 上新增 5 个 viewer 字段。 |
| 公榜命中自动拉黑 | 设置开关 `autoBlockListHits`，默认 OFF | 开启后：扫到公榜已确认账号 → 静默进入限速拉黑队列；finalizeBlocked 跳过 `confirm_spam` 上报（账号已确认，再上报无新信号）。`BlockSource = "list_hit"`。 |
| UI 重写 | 浅色主题 + 每行勾选 + 异步上报状态机 + 雷达环进度 | `prefers-color-scheme` 自动适配；一键拉黑变成"拉黑选中"，支持 per-row uncheck；上报按钮状态机：上报 → 上报中 → 已上报 / 失败。 |
| XSS 加固 | `escHtml` 统一转义 | LLM `reasons` / `note` / 头像 URL / 显示名 / handle 全部统一转义；防止 prompt-injection 走 X bio → LLM → 悬浮卡 innerHTML → 内容脚本上下文 RCE 路径。 |
| 管理面板 | 左上角换成小蓝吉祥物 + 新增"自动拉黑"开关 | 之前是通用盾牌 SVG。 |
| 测试 | 新增 `test/uid-detection.test.ts` | 9 条 `ingestGraphqlUsers` 公开 API 契约回归。 |

## 4. 依赖

**技术栈**：WXT 0.20 · Hono 4 · Zod 3 · TypeScript 5 · tsx · Biome ·
Wrangler 4 · @cloudflare/workers-types · @types/chrome。

**外部服务依赖（关键，含风险）**：

| 依赖 | 用途 | 风险 |
|---|---|---|
| **LLM 推理（外部 OpenAI 兼容供应商）** | 服务端分类 | 第三方、单点、经常性成本；`LLM_API_BASE` / `LLM_API_MODEL` / `LLM_API_KEY` 全部 Worker secret，**不入仓** |
| **Cloudflare**（Workers + D1） | 边缘服务 / 数据库 | 平台依赖，需要备份和交接预案 |
| **GitHub OAuth App** | 上报 / 分类鉴权 | client_id 公开常量；REQUIRE_AUTH 开启后强依赖 |
| **X 内部接口/DOM** | 真·拉黑 + 页面解析 | `blocks/create.json` 静默屏蔽 + DOM/GraphQL 身份解析；X 改版即坏，**最脆环节** |
| **unavatar.io** | 审核台老数据头像兜底 | 第三方，仅维护者侧、非关键 |

## 5. 数据与存储

- **D1 `xss-db`**（线上，真源）：`accounts`(x_user_id/handle/avatar_url/
  verdict/confidence/status/source/…)、`reports`(reporter_fp 唯一索引去重)、
  `review_log`、`publications`。状态机：auto_pending_review → human_confirmed
  / rejected / removed。`/v1/check` 只返回 human_confirmed。
- **chrome.storage.local**：`xss:v1:*` 账号判定缓存、`xss:blocklist:v2`
  拉黑记录、`xss:stats` 统计、`xss:blockQueue` 拉黑队列（v0.4 起带
  `source`、队列状态和后台进度展示）、`xss:settings`（含
  `autoBlockListHits` 开关，默认 false）、`xss:ghToken/
  ghLogin/ghClientId`、`xss:edgeBase`。仅本机、无 PII。

## 6. 部署/运行现状

- Worker 已部署，对外通过自定义域 `https://x.zuoluo.tv`；
  历史 URL `*.workers.dev` 仍可用作 fallback。
  Secrets：`LLM_API_BASE` / `LLM_API_MODEL` / `LLM_API_KEY` / `ADMIN_TOKEN`。
- GitHub 登录用于上报和防滥用计数；上线前后需要持续确认鉴权和限流配置。
- 审核台：`/admin`（ADMIN_TOKEN 进入）。
- 扩展主分发渠道：[Chrome Web Store](https://chromewebstore.google.com/detail/make-x-great-again/aeoldnecphbkkckeedfgfcdcekkljdea)；GitHub Release zip 作为非-Chrome 浏览器和开发版的备用通道。

## 7. 安全/治理姿态

信任分层（匿名只读 / GitHub 上报 / 维护者审核）；AI 单独永不自动公开。
alpha 阶段所有举报默认进人工队列；`≥3` 独立 GitHub 上报人 + 高置信 AI
是保留的自动发布治理门槛，但当前关闭。除公开数字 ID 外无 PII。相关红线已在
[GOVERNANCE.md](../GOVERNANCE.md) 和 [MODERATION.md](./MODERATION.md) 成文。

## 8. 已知缺口 / 技术债 / 风险

1. **数据契约仍需收敛** —— D1 schema、公开快照字段、申诉流程需要保持一致。
2. **Bloom-first 模型未落地** —— v0.4 已把 `/v1/check` 改成批量查询，
   但 [ARCHITECTURE.md](./ARCHITECTURE.md) 设计的低成本/可缓存 Bloom
   artifact 尚未落地。
3. **分类器逻辑双份**：`src/llm.ts` 与 `services/edge` 各一套 SYSTEM 提示，
   易漂移（已发生过需两处同改）。
4. **测试覆盖薄**：CI 三作业绿门禁已上（`.github/workflows/ci.yml`：core / extension / edge），但运行时测试只有 `src/` 早期 node:test + v0.3 新加的 `test/uid-detection.test.ts`；扩展 DOM 流程和 edge handler 尚无 e2e/integration。
5. **X DOM/接口脆弱**：选择器与拉黑流程随 X 改版会坏，需持续维护。
6. **管理端鉴权较轻**：当前以维护者密钥保护，后续可升级到多人身份和轮换机制。

## 9. 后续杠杆

收敛数据契约（含统一 schema + 消除分类器双份）→ 发布 Bloom/快照 artifact →
补齐 CI/测试基线 → 强化管理端鉴权与运维交接。
