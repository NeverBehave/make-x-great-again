# Chrome Web Store 提交清单

> **目的**：上架 MXGA 浏览器扩展。本文档把上架需要填的所有字段集中放好，
> 复制粘贴即可。涉及合规风险点也明确标出。

> ✅ **已上架** —— [`chromewebstore.google.com/detail/make-x-great-again/aeoldnecphbkkckeedfgfcdcekkljdea`](https://chromewebstore.google.com/detail/make-x-great-again/aeoldnecphbkkckeedfgfcdcekkljdea)。
> 本文档保留作为后续更新（新版本提交、字段调整、被驳回重提）的参考底稿。
> 任何字段改动以 Chrome Web Store Developer Dashboard 的实际状态为准。
>
> **当前文案版本：v0.4.0**（2026-05-28 提交）。v0.2/v0.3 的历史文案见
> git history。每次新版上架前请同步更新本文档对应字段。

---

## 1. 基本信息

| 字段 | 内容 |
|---|---|
| Name (Listing) | MXGA — X spam shield |
| Summary / Manifest description (单行，132 字符内) | AI 驱动的 X 旁路扩展 · 你刷 X 时它在后台静默识别色情/广告 spam 机器人，给你一键真拉黑。完全开源，零数据收集。 |
| Category | Productivity |
| Language | 中文 (简体) — primary，可后加英语 |

## 2. Description（详细描述，可粘贴到商店）

> Chrome Web Store 会同时展示上面的 Summary 和这里的详细描述。不要把
> Summary 原样粘到 Description，否则商店「概述」里会出现两段重复文案。

```
MXGA 是一个开源的 X (Twitter) 旁路防 spam 扩展。你正常刷 X 时,它会在后台读取页面上已经公开显示的账号信息和推文上下文,识别色情引流号、广告推广号和明显模板化 spam bot,并把可疑账号标在评论区旁边。你可以逐个复核,也可以在气泡面板里勾选后批量拉黑。拉黑使用 X 自己的屏蔽能力,结果会同步到你的 X 账号。

主要功能:

- 被动扫描当前 X 页面,不需要改变你的浏览习惯。
- 结合维护者白名单、公开黑名单、本地缓存和 AI 判定,标出 spam / porn_bot / likely_spam 等风险。
- 气泡面板集中列出本页可疑账号,支持逐个查看、勾选批量拉黑和上报。后台拉黑时会显示稳定进度、队列和每个账号的处理状态。
- 可选自动拉黑已确认垃圾号。该开关默认关闭,只作用于社区或本机已经确认过的 spam,不会让 AI 单方面自动屏蔽新账号。
- 支持浅色 / 深色主题,设置页可查看登录状态、检测行为和本地数据。

重要提醒:

短时间内连续拉黑大量账号,可能被 X 判定为异常自动化行为,并触发 Ghost Ban、功能限制或「不真实行为」冻结。MXGA 会尽量限速,但 X 的风控规则不透明。建议分批、少量处理可疑账号,避免高频批量拉黑,尤其不要在新号、刚解封账号或近期被限制过的账号上密集操作。

隐私与治理:

MXGA 不收集你的 X 账号、邮箱、IP、浏览历史或设备指纹,也不读取私信或隐藏数据。用于 AI 判定的内容仅限页面上已经渲染的公开字段,例如 handle、显示名、bio 和本次触发的公开文本。举报时会上传目标 X 数字 ID 和你的 GitHub 数字 ID,用于防重复和防刷票。

公开黑名单不是 AI 单独决定。alpha 阶段账号入榜需要维护者人工确认；多个符合条件的 GitHub 账号独立举报和高置信 AI 判定会作为审核信号,不会单独公开发布。项目严格只处理商业垃圾推广和色情广告机器人,不判断观点、立场、政治或身份。

源码:https://github.com/foru17/make-x-great-again
公榜:https://x.zuoluo.tv/list
隐私政策:https://github.com/foru17/make-x-great-again/blob/main/docs/PRIVACY.md
```

## 3. Permissions Justification（提交表单里有一栏一栏的）

| Permission | 用途 |
|---|---|
| `storage` | 本地缓存 AI 判定结果（避免重复调 LLM）、用户的隐藏列表、登录态、本地处理统计。所有内容仅存于 chrome.storage.local，不上传。 |
| `alarms` | 每 6 小时唤醒一次 service worker 增量同步维护者白名单（从 `/v1/whitelist?since=`），避免 SW 长驻浪费内存。 |
| host `https://x.zuoluo.tv/*` | 扩展的服务端 API：公榜命中查询、AI 判定、举报、白名单增量同步。 |
| host `https://x-spam-sentinel-edge.zuoluotv.workers.dev/*` | 同上的 Cloudflare workers.dev 备用 URL（自定义域名故障时的兜底）。 |
| host `https://github.com/login/*` | GitHub OAuth Device Flow 登录：申请 device code + 兑换 access token。 |
| host `https://api.github.com/user` | 登录后读取你的 GitHub 数字 ID（防滥用计数用），**仅** 此端点。 |
| content_scripts `https://x.com/*` / `https://twitter.com/*` | 唯一执行点 — 读取页面上 X 渲染好的公开账号信息、在每条推文旁挂载一个 shadow-DOM 徽章、显示右上角气泡。 |

## 4. Single Purpose 声明

**v0.3 起更新（明确把 user-enabled 自动模式写进 single purpose,避免审核员
看到自动拉黑设置时怀疑越界）**：

英文版（提交时主用,审核员主要看这版）：

> Identify commercial-spam and pornographic-advertising bot accounts on
> X (Twitter), passively on pages the user is already viewing, and let
> the user block them — either one-by-one or, when the user explicitly
> enables it, automatically for accounts the community has already
> confirmed.

中文版（如果商店表单是中文,粘这一版）：

> 在用户已经访问的 X (Twitter) 页面上,被动识别商业垃圾推广账号和色情
> 广告 bot 账号,并让用户屏蔽它们(手动逐个,或在用户主动开启自动模式后
> 由扩展自动屏蔽社区已确认的账号)。

**关键设计**：把 auto-block 写进单一用途,并强调两点:
1. *user explicitly enables* —— 默认关,需要用户主动开
2. *community already confirmed* —— 只对公榜 / 本地缓存确认过的号生效,不是 AI 单方面

这两点是 Chrome Web Store 审核员对扩展自动化最敏感的红线,先在 Single
Purpose 里写明白,省得 v0.3 提交后被怀疑越界。

## 5. Privacy Practices 声明（表单里一栏一栏的）

Chrome 商店现在要求逐项勾选/解释。对应答案：

| 问题 | 答案 |
|---|---|
| Does this item collect any user data? | **Yes**, see below. |
| Personally identifiable information | No |
| Health information | No |
| Financial and payment information | No |
| Authentication information | **Yes** — GitHub OAuth access token (stored locally; never shared with third parties; used only to call api.github.com/user for the reporter ID). |
| Personal communications | No |
| Location | No |
| Web history | No (only x.com / twitter.com pages, read-only) |
| User activity | **Yes** — when the user actively reports / blocks an account, the target X numeric ID + the user's GitHub numeric ID is transmitted to our backend. No other behavioral data. |
| Website content | **Yes** — public X content rendered on the page (handle, display name, bio, recent public tweet text) is transmitted to our backend for the AI classifier. No private content. |

### 数据用途承诺（要勾的三个 box，都应勾上）

- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes.
- [x] I do not sell user data to third parties (outside of the approved use cases).

### Privacy policy URL

```
https://github.com/foru17/make-x-great-again/blob/main/docs/PRIVACY.md
```

## 6. 截图清单（5 张，1280×800 / 640×400 PNG）

| # | 内容 | 来源 |
|---|---|---|
| 1 | X 评论区里气泡显示「本页命中 N 个账号」+ 固定 4 格状态 + 队列表（含每行 checkbox） | content-script 实际运行截图 |
| 2 | 单个推文旁的红色公榜命中 badge + popover | content-script |
| 3 | 后台静默拉黑 + 多色进度条 + 队列中账号「拉黑中 / 待拉」状态 | 气泡卡片 |
| 4 | popup 主面板（成就 hero + 三栏统计 + 登录状态） | popup |
| 5 | options 设置（GitHub 登录验证码复制 + 检测行为 含「自动拉黑」开关 + 数据与隐私 + 清除） | options |

> 还没准备好？参考 https://x.zuoluo.tv/list 公榜的视觉风格做。

> **v0.4 截图需要重出**：拉黑已从模拟点击改成后台静默队列，气泡顶部状态
> 也改成固定 4 格。原 v0.3 截图如果还停留在旧按钮/旧进度，会跟当前 build
> 不一致。新截图建议:
> - #1 / #3：bubble 固定 4 格状态（命中 / 正在 / 待拉 / 已拉）+ 多色进度条 + 队列表
> - #4：popup 未登录横幅 → 点 GitHub 后能跳设置页
> - #5：设置页把 GitHub 验证码复制卡片入镜，同时保留「自动拉黑」开关（OFF 状态即可）
> - 至少出 1 张浅色主题 + 1 张深色主题,展示双主题支持

## 7. 已知合规风险点

| 风险 | 严重度 | 处理 |
|---|---|---|
| 名字含 "Make X Great Again" 联想 MAGA 政治口号 | 中 | listing name 已改成 `MXGA — X spam shield`；manifest 内部名照旧。如果还被审拒，可考虑改成 "MXGA Spam Shield" |
| 描述提到 "X (Twitter)" — 涉及他人商标 | 低 | Chrome 上很多 X-相关工具都用这套写法，问题不大；如审核要求，改成 "the X platform" |
| auto-publish 路径已关 — 没有"3 人举报自动公榜"的滥用入口 | — | 这是 alpha 阶段加固，给审核员讲故事时正面提及 |
| 服务端 LLM 供应商不在仓库 | — | 写明在 `services/edge/src/index.ts` Env interface 注释里；隐私声明也说明了 |

## 8. 上架前 checklist（已完成 ✅）

- [x] 用 `pnpm zip` 出 production .zip（在 `.output/chrome-mv3-0.2.0.zip`）
- [x] 在干净 Chrome profile 加载该 zip 解压目录，跑一遍：
  - [x] popup 打开正常、登录引导显示
  - [x] 进 x.com → 看到气泡 pill「守护中」/「已扫 N」
  - [x] 进 https://x.com/imwsl90/status/2058805164749050313（有 spam 的 thread） → 看到 badge + 气泡列表
  - [x] 点单条「拉黑」 → 通过 X 屏蔽接口静默完成 → 记录
  - [x] options 页 → GitHub 登录 → Device Flow 跑通
- [x] 截图 5 张
- [x] 准备好商店付款（一次性 $5 注册费）
- [x] 提交并通过审核

## 9. 后续版本更新流程

1. 把新版本号写进 `extension/package.json`（WXT 会同步生成 manifest version）
2. `cd extension && pnpm zip` 出新的 .zip
3. 登录 [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)，找到 MXGA item
4. 「Package → Upload new package」，把 zip 拖进去
5. 如果 listing 文案 / 截图 / 权限有变，同步更新本文档第 1–7 节并保存
6. 提交审核（通常 1–3 天；敏感品类可能 7–14 天）
7. 通过后同步把 GitHub Release 也打一份，让两边版本号一致

## 10. v0.4.0 更新 checklist（2026-05-28）

- [x] `extension/package.json` 版本号 0.3.0 → 0.4.0
- [x] `npm run compile`
- [x] `npm run zip` 产出 `.output/mxga-extension-0.4.0-chrome.zip` (143.44 KB)
- [x] zip 内 `manifest.json` 确认为 `version: 0.4.0`、MV3、无 localhost dev 权限
- [x] `README.md`、`docs/STATUS.md`、`CHANGELOG.md` 同步 v0.4.0
- [ ] **真机冒烟** —— 装新 zip 到日常 Chrome,跑一遍：
  - [ ] 未登录时 popup 点 GitHub → options 设置 tab 自动启动 Device Flow，验证码可复制
  - [ ] 打开有多个 spam 的单条推文 → 气泡自动展开后台拉黑队列
  - [ ] 顶部 4 格状态稳定展示，不随「已拉」数量出现/消失而换行
  - [ ] 开启「对已确认的垃圾号自动拉黑」后，公榜命中进入静默拉黑队列
  - [ ] 单个账号成功拉黑后，队列行头像/名称划掉淡出，本地记录页出现该账号
  - [ ] 系统切到浅色/深色模式 → bubble 与 options 视觉正常
- [ ] 出 v0.4 新截图（参考第 6 节注释）
- [ ] 上传 zip + 必要时更新 Description / Screenshot 到 CWS Dashboard
- [ ] 提交审核,等 1-3 天
- [x] GitHub Release `v0.4.0` 与 CWS zip 对齐
