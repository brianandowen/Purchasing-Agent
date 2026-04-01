// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {
    try {
      const result = scrapePostData();
      sendResponse({ success: true, data: result });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true;
});

function scrapePostData() {
  // ── 1. 從網址解析貼文 ID ──
  const url = window.location.href;
  let post_id = "";
  const m1 = url.match(/\/posts\/(\d+)/);
  const m2 = url.match(/story_fbid=(\d+)/);
  const m3 = url.match(/[?&]fbid=(\d+)/);
  if (m1) post_id = m1[1];
  else if (m2) post_id = m2[1];
  else if (m3) post_id = m3[1];
  else post_id = "unknown_" + Date.now();

  // ── 2. 抓貼文內文 ──
  let post_content = "";
  const postSelectors = [
    '[data-ad-preview="message"]',
    'div[dir="auto"][style*="text-align"]',
  ];
  for (const sel of postSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 10) {
      post_content = el.innerText.trim();
      break;
    }
  }
  if (!post_content) {
    const meta = document.querySelector('meta[property="og:description"]');
    if (meta) post_content = meta.getAttribute("content") || "";
  }

  // ── 3. 抓所有含 + 的留言 ──
  const comments = [];
  const seen = new Set(); // 去重用

  document.querySelectorAll('div[role="article"][aria-label]').forEach((block) => {
    const label = block.getAttribute("aria-label") || "";

    // 從 aria-label 抓名字，格式：「劉俐伶的留言2週前」
    const nameMatch = label.match(/^(.+?)的留言/);
    if (!nameMatch) return;
    const name = nameMatch[1].trim();

    // 同一個人只記第一筆
    if (seen.has(name)) return;

    // 找含有 + 的 span 文字
    let text = "";
    block.querySelectorAll("span").forEach((span) => {
      const t = span.innerText.trim();
      if (t.includes("+") && t.length < 50) text = t;
    });
    if (!text) return;

    seen.add(name); // 確認有留言才加入去重

    let quantity = 1;
    const qMatch = text.match(/\+(\d+)/);
    if (qMatch) quantity = parseInt(qMatch[1]);

    comments.push({ name, text, quantity });
  });

  return { post_id, post_url: url, post_content, comments };
}