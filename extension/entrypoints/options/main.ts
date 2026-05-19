import { getGhClientId, getGhLogin, setGhClientId } from "../../lib/auth";
import {
  type BlockRecord,
  type CacheRow,
  getBlocklist,
  getCacheRows,
  getStats,
  removeBlock,
} from "../../lib/store";
import type { Label } from "../../lib/types";

function bg<T = Record<string, unknown>>(
  msg: unknown,
): Promise<{ ok: boolean; data?: T; error?: string }> {
  return new Promise((r) =>
    chrome.runtime.sendMessage(msg, (resp) => r(resp ?? { ok: false })),
  );
}

const TAG: Record<Label, [string, string]> = {
  spam: ["t-danger", "垃圾"],
  porn_bot: ["t-danger", "色情bot"],
  likely_spam: ["t-warn", "疑似垃圾"],
  uncertain: ["t-neutral", "不确定"],
  legit: ["t-safe", "正常"],
};
const esc = (s: string) =>
  s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
const when = (ts: number) => new Date(ts).toLocaleString("zh-CN", { hour12: false });
const $ = (id: string) => document.getElementById(id) as HTMLElement;

function avatar(url?: string, name?: string) {
  const mono = (name || "?").replace(/^@/, "").charAt(0).toUpperCase();
  return url
    ? `<img src="${esc(url)}" referrerpolicy="no-referrer" alt="">`
    : `<span class="ph">${esc(mono)}</span>`;
}
/** show ` · <id>` only when it's a real numeric id distinct from the handle */
function idTail(id: string, handle: string) {
  return /^\d+$/.test(id) && id !== handle && !/^\d+$/.test(handle) ? ` · ${id}` : "";
}
function tag(label: Label, conf?: number) {
  const [cls, zh] = TAG[label] ?? ["t-neutral", label];
  return `<span class="tag ${cls}">${zh}${conf !== undefined ? ` ${(conf * 100).toFixed(0)}%` : ""}</span>`;
}

async function renderOverview() {
  const s = await getStats();
  const bl = await getBlocklist();
  const dist: Record<string, number> = s.byLabel;
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const seg = (lab: Label, color: string) =>
    dist[lab] ? `<i style="width:${((dist[lab] / total) * 100).toFixed(1)}%;background:${color}"></i>` : "";
  $("main").innerHTML = `
    <h1>概览</h1>
    <div class="sub">本地统计 · 数据仅存于本机，无 PII</div>
    <div class="cards">
      <div class="card"><div class="n">${s.detections}</div><div class="l">AI 检测总数</div></div>
      <div class="card"><div class="n">${s.cacheHits}</div><div class="l">缓存命中 · 省下的 LLM 调用</div></div>
      <div class="card"><div class="n">${bl.length}</div><div class="l">已拉黑账号</div></div>
      <div class="card"><div class="n">${(dist.spam ?? 0) + (dist.porn_bot ?? 0)}</div><div class="l">判定为垃圾/色情bot</div></div>
    </div>
    <h1 style="font-size:15px">检测类别分布</h1>
    <div class="bar">
      ${seg("porn_bot", "#ef4444")}${seg("spam", "#ef4444")}${seg("likely_spam", "#f59e0b")}${seg("uncertain", "#8b949e")}${seg("legit", "#22c55e")}
    </div>
    <div class="legend">
      <span><i style="background:#ef4444"></i>色情/垃圾bot ${(dist.porn_bot ?? 0) + (dist.spam ?? 0)}</span>
      <span><i style="background:#f59e0b"></i>疑似 ${dist.likely_spam ?? 0}</span>
      <span><i style="background:#8b949e"></i>不确定 ${dist.uncertain ?? 0}</span>
      <span><i style="background:#22c55e"></i>正常 ${dist.legit ?? 0}</span>
    </div>`;
}

async function renderBlocklist() {
  const list = (await getBlocklist()).sort((a, b) => b.ts - a.ts);
  const row = (r: BlockRecord) => `<tr data-id="${esc(r.id)}">
    <td><div class="u">${avatar(r.avatarUrl, r.displayName || r.handle)}<div>
      <div class="name">${esc(r.displayName || "@" + r.handle)}</div>
      <div class="h">@${esc(r.handle)}${esc(idTail(r.id, r.handle))}</div></div></div></td>
    <td>${r.verdict ? tag(r.verdict.label, r.verdict.confidence) : "—"}</td>
    <td class="reason">${esc(r.reason || "")}</td>
    <td class="h">${{ manual: "手动", block_all: "一键全部", list_hit: "名单命中" }[r.source]}</td>
    <td class="h">${when(r.ts)}</td>
    <td><button class="btn" data-unblock="${esc(r.id)}">取消拉黑</button></td></tr>`;
  $("main").innerHTML = `
    <h1>拉黑记录</h1>
    <div class="sub">共 ${list.length} 条 · 取消拉黑用于纠正误判（账号会重新可见）</div>
    <div class="toolbar"><input type="search" id="q" placeholder="搜索 @handle / 显示名 / 理由" /></div>
    <table><thead><tr><th>账号</th><th>判定</th><th>理由</th><th>来源</th><th>时间</th><th></th></tr></thead>
    <tbody id="tb">${list.map(row).join("") || ""}</tbody></table>
    ${list.length ? "" : '<div class="empty">还没有拉黑记录</div>'}`;
  const tb = document.getElementById("tb");
  document.getElementById("q")?.addEventListener("input", (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    if (tb)
      tb.innerHTML = list
        .filter((r) =>
          `${r.handle} ${r.displayName ?? ""} ${r.reason ?? ""}`.toLowerCase().includes(q),
        )
        .map(row)
        .join("");
  });
  $("main").addEventListener("click", async (e) => {
    const b = (e.target as HTMLElement).closest("[data-unblock]");
    if (!b) return;
    await removeBlock((b as HTMLElement).dataset.unblock as string);
    renderBlocklist();
  });
}

async function renderCache() {
  const rows = await getCacheRows();
  const r = (c: CacheRow) => `<tr>
    <td><div class="u">${avatar(c.avatarUrl)}<div>
      <div class="name">${esc(c.displayName || "@" + c.handle)}</div>
      <div class="h">@${esc(c.handle)}</div></div></div></td>
    <td>${tag(c.verdict.label, c.verdict.confidence)}</td>
    <td class="h">${esc(c.verdict.reasons[0] ?? "")}</td>
    <td class="h">${esc(c.model)}</td>
    <td class="h">${when(c.ts)}</td></tr>`;
  $("main").innerHTML = `
    <h1>检测缓存</h1>
    <div class="sub">共 ${rows.length} 条 · 同账号再出现直接用缓存，0 次 LLM</div>
    <table><thead><tr><th>账号</th><th>判定</th><th>理由</th><th>模型</th><th>时间</th></tr></thead>
    <tbody>${rows.map(r).join("")}</tbody></table>
    ${rows.length ? "" : '<div class="empty">缓存为空</div>'}`;
}

function renderAbout() {
  $("main").innerHTML = `
    <h1>关于</h1>
    <div class="sub">x-spam-sentinel · 公益、开源</div>
    <div class="about">
      <p>基于 AI 的 X(Twitter) 反垃圾/色情机器人扩展。被动检测、本地优先、
        中心服务（Cloudflare）协同；用户一键拉黑即视为人工确认。</p>
      <p>许可证：<code>AGPL-3.0</code> ·
        仓库：<a href="https://github.com/onenorthlab/x-spam-sentinel" target="_blank" rel="noopener">github.com/onenorthlab/x-spam-sentinel</a></p>
      <p>隐私：除公开的 X 数字 ID 外不存储任何 PII，数据默认仅在本机。</p>
      <p>治理：AI 判定永不自动公开，须人工确认；提供
        <a href="https://github.com/onenorthlab/x-spam-sentinel/blob/main/GOVERNANCE.md" target="_blank" rel="noopener">申诉与移除机制</a>。
        误判申诉：<a href="https://github.com/onenorthlab/x-spam-sentinel/issues/new?template=appeal.yml" target="_blank" rel="noopener">提交</a>。</p>
    </div>`;
}

async function renderSettings() {
  const m = $("main");
  const login = await getGhLogin();
  const cid = await getGhClientId();
  m.innerHTML = `
    <h1>设置</h1>
    <div class="sub">登录与令牌仅存于本机</div>
    <div class="about">
      <p><b>GitHub 登录</b> — 上报与服务端 AI 分析需要（防滥用）。</p>
      <p id="ghs">${login ? `已登录 <code>@${login}</code> · <a href="#" id="ghout">登出</a>` : '<button class="btn" id="ghin">用 GitHub 登录</button>'}</p>
      <p id="ghflow" style="color:var(--warn)"></p>
      <p style="margin-top:18px;color:#8b949e;font-size:12px">审核（守门员）已独立为单独网页，仅维护者使用：
        <a href="https://x-spam-sentinel-edge.zuoluotv.workers.dev/admin" target="_blank" rel="noopener">审核台</a>。</p>
      <p style="margin-top:18px;color:#8b949e;font-size:12px">GitHub OAuth client_id（默认已内置，一般无需改）<br>
        <input id="cid" value="${cid}" style="width:320px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:#8b949e;border-radius:8px;padding:6px 10px;font:12px system-ui">
        <button class="btn" id="cidsave">保存</button></p>
    </div>`;
  document.getElementById("ghout")?.addEventListener("click", async (e) => {
    e.preventDefault();
    await bg({ type: "gh_logout" });
    renderSettings();
  });
  document.getElementById("ghin")?.addEventListener("click", async () => {
    const f = $("ghflow");
    f.textContent = "正在获取设备码…";
    const s = await bg<{ user_code: string; verification_uri: string; device_code: string; interval: number }>(
      { type: "gh_start" },
    );
    if (!s.ok || !s.data) {
      f.textContent = `失败：${s.error ?? "请确认 OAuth App 已勾选 Enable Device Flow"}`;
      return;
    }
    const { user_code, verification_uri, device_code, interval } = s.data;
    window.open(verification_uri, "_blank", "noopener");
    f.innerHTML = `在打开的页面输入码：<code>${user_code}</code>，授权后自动完成…`;
    const poll = async () => {
      const r = await bg<{ login?: string; pending?: string }>({
        type: "gh_poll",
        deviceCode: device_code,
      });
      if (r.ok && r.data?.login) {
        renderSettings();
        return;
      }
      setTimeout(poll, Math.max(5, interval || 5) * 1000);
    };
    setTimeout(poll, (interval || 5) * 1000);
  });
  document.getElementById("cidsave")?.addEventListener("click", async () => {
    await setGhClientId((document.getElementById("cid") as HTMLInputElement).value);
  });
}

const tabs: Record<string, () => void> = {
  overview: renderOverview,
  blocklist: renderBlocklist,
  cache: renderCache,
  settings: renderSettings,
  about: renderAbout,
};

$("nav").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest("button[data-tab]") as HTMLElement | null;
  if (!b) return;
  document.querySelectorAll("#nav button").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  tabs[b.dataset.tab as string]?.();
});

$("ver").textContent = `v${chrome.runtime.getManifest().version}`;
renderOverview();
