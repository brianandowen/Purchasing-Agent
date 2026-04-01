const { neon } = require("@neondatabase/serverless");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { post_id, post_url, post_content, comments } = req.body;

    if (!post_id || !comments) {
      return res.status(400).json({ error: "缺少必要欄位" });
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      INSERT INTO posts (post_id, post_url, post_content)
      VALUES (${post_id}, ${post_url}, ${post_content})
      ON CONFLICT (post_id) DO UPDATE
        SET post_content = EXCLUDED.post_content,
            post_url = EXCLUDED.post_url
    `;

    let savedCount = 0;
    for (const c of comments) {
      await sql`
        INSERT INTO orders (post_id, commenter_name, comment_text, quantity)
        VALUES (${post_id}, ${c.name}, ${c.text}, ${c.quantity})
        ON CONFLICT (post_id, commenter_name) DO UPDATE
          SET comment_text = EXCLUDED.comment_text,
              quantity = EXCLUDED.quantity
      `;
      savedCount++;
    }

    return res.status(200).json({ success: true, saved: savedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};