// Product landing — public, zero-PII. base-ui inspired: monochrome canvas,
// type-led hierarchy, accent reserved for state.
import { BRAND } from "../brand";
import { LINKS, layout } from "./_layout";

const CSS = `
/* Hero */
.hero{padding:96px 0 72px;max-width:760px}
.hero .eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:600;
  letter-spacing:.14em;text-transform:uppercase;color:var(--fg-3);padding:5px 10px;
  border:1px solid var(--border);border-radius:999px;margin-bottom:24px}
.hero .eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--ok);
  box-shadow:0 0 0 0 rgba(16,185,129,.45);animation:pulse 2.4s ease-out infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(16,185,129,.45)}100%{box-shadow:0 0 0 6px rgba(16,185,129,0)}}
.hero h1{font-size:60px;line-height:1.05;letter-spacing:-.035em;font-weight:600;
  margin:0 0 22px;color:var(--fg)}
.hero h1 .em{color:var(--fg)}
.hero h1 .sub{display:block;color:var(--fg-3);font-weight:500}
.hero .lede{font-size:17px;color:var(--fg-2);max-width:600px;margin-bottom:32px;
  line-height:1.6;letter-spacing:-.005em}
.hero .ctas{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px}
.hero .meta{font-size:12.5px;color:var(--fg-4);display:flex;flex-wrap:wrap;
  gap:6px 14px;align-items:center}
.hero .meta .dot{width:3px;height:3px;border-radius:50%;background:var(--fg-4);opacity:.5}

/* Section */
section.block{padding:64px 0;border-top:1px solid var(--border)}
section.block h2{font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--fg-3);font-weight:600;margin-bottom:32px}
section.block h2 .num{margin-right:10px;color:var(--fg-4);font-variant-numeric:tabular-nums}

/* How — 4 steps in a tight grid */
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);
  border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
.step{padding:24px 22px;background:var(--bg);transition:background .15s}
.step:hover{background:var(--card)}
.step .n{font-size:11px;font-weight:600;color:var(--fg-4);font-variant-numeric:tabular-nums;
  letter-spacing:.08em;display:block;margin-bottom:14px}
.step h3{font-size:14.5px;font-weight:600;margin-bottom:8px;color:var(--fg);letter-spacing:-.005em}
.step p{font-size:13px;line-height:1.6;color:var(--fg-3)}

/* Trust — 4 governance bullets, each with a themed glyph */
.trust{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);
  border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
.trust .row{display:flex;gap:14px;align-items:flex-start;padding:22px 24px;background:var(--bg);
  transition:background .15s}
.trust .row:hover{background:var(--card)}
.trust .row .ic{width:28px;height:28px;flex-shrink:0;color:var(--ic,var(--fg-3));
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid color-mix(in srgb,var(--ic,var(--fg-3)) 30%,transparent);
  border-radius:var(--r-sm)}
.trust .row .ic svg{width:14px;height:14px}
.trust .row h3{font-size:14px;font-weight:600;margin-bottom:5px;color:var(--fg);letter-spacing:-.005em}
.trust .row p{font-size:13px;line-height:1.6;color:var(--fg-3)}

/* Stats — uniform, type-led */
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);
  border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden}
.stat{padding:24px 24px 22px;background:var(--bg)}
.stat .n{font-size:36px;font-weight:600;letter-spacing:-.025em;font-variant-numeric:tabular-nums;
  line-height:1.05;color:var(--fg)}
.stat .n.skel{display:inline-block;width:64px;height:38px;background:linear-gradient(90deg,
  rgba(255,255,255,.04),rgba(255,255,255,.1),rgba(255,255,255,.04));
  background-size:200% 100%;animation:shim 1.4s ease-in-out infinite;border-radius:var(--r-sm);vertical-align:middle}
@keyframes shim{0%{background-position:200% 0}100%{background-position:-200% 0}}
.stat .lbl{font-size:12px;color:var(--fg-3);margin-top:10px;letter-spacing:.01em}
.stats-foot{margin-top:18px;font-size:12.5px;color:var(--fg-3);display:flex;
  align-items:center;gap:10px;flex-wrap:wrap}
.stats-foot a{color:var(--fg)}.stats-foot a:hover{color:var(--accent)}
.stats-foot .pip{display:inline-flex;align-items:center;gap:6px}
.stats-foot .pip i{width:5px;height:5px;border-radius:50%;background:var(--ok);
  box-shadow:0 0 0 0 rgba(16,185,129,.55);animation:pulse 2.4s ease-out infinite}

/* Install helper popover */
.install-note{margin-top:20px;font-size:13px;color:var(--fg-2);
  background:var(--card);border:1px solid var(--border);border-radius:var(--r);
  padding:14px 18px;max-width:560px;display:none;line-height:1.65}
.install-note.open{display:block;animation:slideIn .2s ease-out}
@keyframes slideIn{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}
.install-note ol{margin:8px 0 0 20px}
.install-note li{margin:5px 0;color:var(--fg-2)}
.install-note code{background:rgba(255,255,255,.06);padding:1px 6px;border-radius:var(--r-sm);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:var(--fg)}

@media (max-width:760px){
  .hero{padding:64px 0 48px}
  .hero h1{font-size:40px;letter-spacing:-.03em}
  .steps{grid-template-columns:1fr 1fr}
  .trust{grid-template-columns:1fr}
  .stats{grid-template-columns:1fr;grid-template-rows:none}
  section.block{padding:48px 0}
}
@media (max-width:440px){
  .hero h1{font-size:34px}
  .steps{grid-template-columns:1fr}
}
`;

// Icons — outline, currentColor
const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`;
const ICON_GH = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.7.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>`;
const ICON_LIST = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`;
const ICON_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>`;
const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const ICON_DB = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>`;
const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

const HERO = `
<section class="hero">
  <span class="eyebrow"><span class="dot" aria-hidden="true"></span>开源 · ${BRAND.license}</span>
  <h1>X 上的垃圾与<br><span class="sub">色情机器人，到此为止。</span></h1>
  <p class="lede">被动检测 · AI 判定 · 社区共识 · 真·拉黑。安装一次扩展，让 AI 在你浏览 X 时静默工作；只有当 3 个独立 GitHub 用户都标注同一账号时才会公开。</p>
  <div class="ctas">
    <a class="btn primary" href="${LINKS.RELEASE_URL}" id="installBtn" aria-label="安装到 Chrome（下载最新 Release）">${ICON_DOWNLOAD}<span>安装到 Chrome</span></a>
    <a class="btn" href="${BRAND.repo}" aria-label="在 GitHub 上查看源码">${ICON_GH}<span>GitHub</span></a>
    <a class="btn" href="/list" aria-label="查看公开 spam 榜单">${ICON_LIST}<span>看公榜</span></a>
  </div>
  <p class="meta">
    <span>不收集 PII</span><span class="dot" aria-hidden="true"></span>
    <span>不追踪</span><span class="dot" aria-hidden="true"></span>
    <span>不需要注册</span><span class="dot" aria-hidden="true"></span>
    <span>开源可审计</span>
  </p>
  <div class="install-note" id="installNote" role="status">
    <strong>开发者模式安装</strong>（Chrome Web Store 上架前的临时入口）：
    <ol>
      <li>下载并解压 GitHub Releases 的最新 <code>.zip</code></li>
      <li>打开 <code>chrome://extensions</code>，右上角开启「开发者模式」</li>
      <li>点击「加载已解压的扩展程序」，选择解压后的目录</li>
      <li>访问 x.com 即开始被动检测</li>
    </ol>
  </div>
</section>
`;

const HOW = `
<section class="block">
  <h2>它怎么工作</h2>
  <div class="steps">
    <div class="step"><span class="n">01</span><h3>安装扩展</h3><p>Chrome 即用，Edge 兼容。无需注册，无需配置。</p></div>
    <div class="step"><span class="n">02</span><h3>被动检测</h3><p>仅在你刷到的账号上分析。从不主动爬取，从不代你操作。</p></div>
    <div class="step"><span class="n">03</span><h3>社区共识</h3><p>AI 高置信判定 + 3 个独立 GitHub 用户佐证，才进公榜。</p></div>
    <div class="step"><span class="n">04</span><h3>真·拉黑</h3><p>驱动 X 自身屏蔽接口，多端同步生效，不是本地隐藏。</p></div>
  </div>
</section>
`;

const TRUST = `
<section class="block">
  <h2>四条治理铁律</h2>
  <div class="trust">
    <div class="row" style="--ic:#10b981"><span class="ic">${ICON_SHIELD}</span><div><h3>AI 单独不能自动公开</h3><p>必须人工审核 或 ≥3 个独立 GitHub 上报人共识才入公榜，红线写进 D1 状态机。</p></div></div>
    <div class="row" style="--ic:#38bdf8"><span class="ic">${ICON_LOCK}</span><div><h3>不收集 PII</h3><p>服务端只存 X 公开数字 ID 与举报人 GitHub 数字 ID；扩展端默认不上传任何浏览数据。</p></div></div>
    <div class="row" style="--ic:#f59e0b"><span class="ic">${ICON_DB}</span><div><h3>状态机锁红线</h3><p>auto_pending_review → human_confirmed 的状态转换只接受人工或社区共识，AI 触发会被路由层拒绝。</p></div></div>
    <div class="row" style="--ic:#a855f7"><span class="ic">${ICON_USER}</span><div><h3>GitHub 登录可写</h3><p>举报与拉黑确认需 GitHub Device Flow 登录，反滥用、可追溯；不强制注册账号。</p></div></div>
  </div>
</section>
`;

const LIVE = `
<section class="block">
  <h2>实时透明</h2>
  <div class="stats">
    <div class="stat"><div class="n" id="sCount"><span class="skel"></span></div><div class="lbl">已确认的 spam / bot 账号</div></div>
    <div class="stat"><div class="n" id="sWeek"><span class="skel"></span></div><div class="lbl">本周新增</div></div>
    <div class="stat"><div class="n" id="sPending"><span class="skel"></span></div><div class="lbl">待人工审核</div></div>
  </div>
  <p class="stats-foot">
    <span class="pip"><i aria-hidden="true"></i><span id="sAgo">每 60 秒更新</span></span>
    <span class="sep">·</span>
    <a href="/list">查看完整公榜 →</a>
  </p>
</section>
`;

const SCRIPT = `
(function(){
  var btn=document.getElementById('installBtn'),note=document.getElementById('installNote');
  if(btn&&note){btn.addEventListener('click',function(e){if(!note.classList.contains('open')){e.preventDefault();note.classList.add('open');setTimeout(function(){window.location=btn.href},900)}})}
  var fmt=function(n){return typeof n==='number'?n.toLocaleString('zh-CN'):'—'};
  var ago=function(ms){if(!ms)return'';var d=Date.now()-ms,s=Math.round(d/1000);if(s<60)return s+' 秒前';var m=Math.round(s/60);if(m<60)return m+' 分钟前';var h=Math.round(m/60);if(h<24)return h+' 小时前';return Math.round(h/24)+' 天前'};
  var refresh=function(){
    fetch('/v1/list/meta').then(function(r){return r.json()}).then(function(j){
      document.getElementById('sCount').textContent=fmt(j.count);
      document.getElementById('sWeek').textContent=(j.week>0?'+':'')+fmt(j.week);
      document.getElementById('sPending').textContent=fmt(j.pending);
      document.getElementById('sAgo').textContent=j.generatedAt?('更新于 '+ago(j.generatedAt)):'每 60 秒更新'
    }).catch(function(){
      ['sCount','sWeek','sPending'].forEach(function(id){var el=document.getElementById(id);if(el)el.textContent='—'})
    })
  };
  refresh();
  setInterval(refresh,60000);
})();
`;

export function landingHtml(): string {
  return layout({
    title: "x-spam-sentinel · 让 AI 拦下 X 上的垃圾与色情机器人",
    current: "home",
    css: CSS,
    head: `<meta name="description" content="开源、半公开的 X(Twitter) 反垃圾扩展。AI 判定 + 社区共识，不收集 PII，AGPL-3.0。">`,
    body: HERO + HOW + TRUST + LIVE,
    script: SCRIPT,
  });
}
