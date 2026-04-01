// content.js

const API_URL = "https://purchasing-agent-bay.vercel.app/api/save-post";

function init() {
  injectButtons();
  const observer = new MutationObserver(() => injectButtons());
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectButtons() {
  const targets = [...document.querySelectorAll('span')]
    .filter(el => el.innerText.trim() === '所有留言');

  targets.forEach(target => {
    const wrapper = target.closest('div');
    if (!wrapper) return;
    if (wrapper.parentElement.querySelector('.daigou-btn')) return;

    const btn = document.createElement('button');
    btn.className = 'daigou-btn';
    btn.innerText = '🛒 抓取 +1 留言';
    btn.style.cssText = `
      background: #1877f2;
      color: white;
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      width: 100%;
      margin-bottom: 8px;
      display: block;
    `;

    const status = document.createElement('div');
    status.className = 'daigou-status';
    status.style.cssText = `text-align:center; font-size:12px; color:#555; margin-bottom:4px;`;

    wrapper.parentElement.insertBefore(btn, wrapper);
    wrapper.parentElement.insertBefore(status, wrapper);

    const article = btn.closest('div[role="article"]');
    btn.addEventListener('click', () => handleClick(article || document.body, btn, status));
  });
}

async function handleClick(article, btn, status) {
  btn.disabled = true;
  status.innerText = "⏳ 抓取中...";

  try {
    // ── 抓貼文 ID ──
    const url = window.location.href;
    let post_id = "";
    const m1 = url.match(/\/posts\/(\d+)/);
    const m2 = url.match(/story_fbid=(\d+)/);
    const m3 = url.match(/[?&]fbid=(\d+)/);
    const m4 = url.match(/\/permalink\/(\d+)/);
    if (m1) post_id = m1[1];
    else if (m2) post_id = m2[1];
    else if (m3) post_id = m3[1];
    else if (m4) post_id = m4[1];
    else post_id = "post_" + Date.now();

    // ── 抓貼文內文 ──
    let post_content = "";
    const contentEl = article.querySelector('[data-ad-preview="message"]') ||
                      article.querySelector('div[dir="auto"]');
    if (contentEl) post_content = contentEl.innerText.trim();

    // ── 抓留言 ──
    const comments = [];
    const seen = new Set();

    article.querySelectorAll('div[role="article"][aria-label]').forEach((block) => {
      const label = block.getAttribute("aria-label") || "";
      const nameMatch = label.match(/^(.+?)的留言/);
      if (!nameMatch) return;
      const name = nameMatch[1].trim();
      if (seen.has(name)) return;

      let text = "";
      block.querySelectorAll("span").forEach((span) => {
        const t = span.innerText.trim();
        if (t.includes("+") && t.length < 50) text = t;
      });
      if (!text) return;

      seen.add(name);
      let quantity = 1;
      const qMatch = text.match(/\+(\d+)/);
      if (qMatch) quantity = parseInt(qMatch[1]);

      comments.push({ name, text, quantity });
    });

    if (comments.length === 0) {
      status.innerText = "⚠️ 沒找到含 + 的留言，請先滾動載入所有留言";
      btn.disabled = false;
      return;
    }

    // ── 送到 API ──
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post_id, post_url: url, post_content, comments }),
    });
    const json = await res.json();

    if (json.success) {
      status.innerText = `✅ 已儲存 ${json.saved} 筆！`;
    } else {
      status.innerText = `❌ 錯誤：${json.error}`;
    }
  } catch (e) {
    status.innerText = `❌ 失敗：${e.message}`;
  }

  btn.disabled = false;
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}