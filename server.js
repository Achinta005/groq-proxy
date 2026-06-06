import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.get("/", (req, res) => res.send("Proxy running"));
app.get("/health", (req, res) => res.status(200).json({ status: "ok", uptime: process.uptime() }));

// Existing Groq route
app.post("/groq", async (req, res) => {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ── NEW: generic page fetch route ──────────────────────────────────────────
app.post("/fetch", async (req, res) => {
  const { url, headers: customHeaders = {} } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  // Basic allowlist — only allow Amazon and Flipkart
  const allowed = ["amazon.in", "flipkart.com"];
  const isAllowed = allowed.some((domain) => url.includes(domain));
  if (!isAllowed) {
    return res.status(403).json({ error: "Domain not allowed" });
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-IN,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "max-age=0",
        DNT: "1",
        ...customHeaders,  // caller can override/add headers
      },
      redirect: "follow",
    });

    const html = await response.text();

    res.status(response.status).json({
      status: response.status,
      html,
      // Forward set-cookie so NestJS can replay it on next request
      cookies: response.headers.raw()["set-cookie"] ?? [],
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));