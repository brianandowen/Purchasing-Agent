// content.js

const API_URL_KEY = "apiUrl";

// 等頁面載入完再執行
function init() {
  injectButtons();
  // 監聽 Facebook 動態載入新貼文
  const observer = new MutationObserver(() => injectButtons());
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectButtons() {
  // 只抓最外層的貼文，不抓留言裡面的 article
  const articles = document.querySelectorAll(
    'div[role="feed"] > div > div > div[role="article"]'
  );

  // 如果是單篇貼文頁面，用這個
  const singleArticle = document.querySelector(
    'div[data-pagelet="permalink_reaction_pagelet"]'
  )?.closest('div[role="article"]');

  const targets = articles.length > 0
    ? Array.from(articles)
    : singleArticle
    ? [singleArticle]
    : [];

  targets.forEach((article) => {
    if (article.querySelector(".daigou-btn")) return;

    const btn = document.createElement("button");
    btn.className = "daigou-btn";
    btn.innerText = "🛒 抓取留言";
    btn.style.cssText = `
      margin: 8px 0;
      padding: 6px 14px;
      background: #1877f2;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-weight: bold;
    `;

    const status = document.createElement("span");
    status.className = "daigou-status";
    status.style.cssText = `margin-left: 8px; font-size: 12px; color: #555;`;

    const wrapper = document.createElement("div");
    wrapper.style.cssText = "padding: 4px 12px;";
    wrapper.appendChild(btn);
    wrapper.appendChild(status);
    article.appendChild(wrapper);

    btn.addEventListener("click", () => handleClick(article, btn, status));
  });
}
async function handleClick(article, btn, status) {
  btn.disabled = true;
  status.innerText = "⏳ 抓取中...";

  // 讀取 API 網址
  const stored = await chrome.storage.local.get(API_URL_KEY);
  const apiUrl = stored[API_URL_KEY];

  if (!apiUrl) {
    status.innerText = "❌ 請先在擴充功能圖示設定 API 網址";
    btn.disabled = false;
    return;
  }

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
    const res = await fetch(apiUrl, {
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

// 啟動
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}