// popup.js
const btn = document.getElementById("scrapeBtn");
const status = document.getElementById("status");
const result = document.getElementById("result");
const apiInput = document.getElementById("apiUrl");

// 記住上次填的 API 網址
chrome.storage.local.get("apiUrl", (data) => {
  if (data.apiUrl) apiInput.value = data.apiUrl;
});
apiInput.addEventListener("change", () => {
  chrome.storage.local.set({ apiUrl: apiInput.value });
});

btn.addEventListener("click", async () => {
  const apiUrl = apiInput.value.trim();
  if (!apiUrl) {
    status.textContent = "❌ 請先填入 Vercel API 網址";
    return;
  }

  btn.disabled = true;
  status.textContent = "⏳ 抓取中...";
  result.innerHTML = "";

  // 取得目前分頁
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes("facebook.com")) {
    status.textContent = "❌ 請先開啟 Facebook 貼文頁面";
    btn.disabled = false;
    return;
  }

  // 發送訊息給 content.js
  chrome.tabs.sendMessage(tab.id, { action: "scrape" }, async (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      status.textContent = "❌ 抓取失敗，請重新整理頁面後再試";
      btn.disabled = false;
      return;
    }

    const { data } = response;
    status.textContent = `✅ 找到 ${data.comments.length} 筆含 + 的留言，上傳中...`;

    // 先顯示預覽表格
    showTable(data.comments);

    // 送出到 Vercel API
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        status.innerHTML = `<span class="success">✅ 成功儲存 ${json.saved} 筆！</span>`;
      } else {
        status.innerHTML = `<span class="error">❌ API 錯誤：${json.error}</span>`;
      }
    } catch (e) {
      status.innerHTML = `<span class="error">❌ 無法連線：${e.message}</span>`;
    }

    btn.disabled = false;
  });
});

function showTable(comments) {
  if (comments.length === 0) {
    result.innerHTML = "<p style='color:#888;font-size:13px;'>沒有找到含 + 的留言</p>";
    return;
  }
  let html = `<table>
    <tr><th>#</th><th>留言者</th><th>數量</th><th>留言內容</th></tr>`;
  comments.forEach((c, i) => {
    const text = c.text.length > 20 ? c.text.slice(0, 20) + "…" : c.text;
    html += `<tr>
      <td>${i + 1}</td>
      <td>${esc(c.name)}</td>
      <td><b>+${c.quantity}</b></td>
      <td style="color:#888">${esc(text)}</td>
    </tr>`;
  });
  html += "</table>";
  result.innerHTML = html;
}

// 防止 XSS
function esc(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}