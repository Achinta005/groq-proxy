import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json({ limit: "10mb" }));

/* ─── User-Agent pool ──────────────────────────────────────────────────────── */

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.6367.82 Mobile Safari/537.36",
];

const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

/* ─── Cookie helper (node-fetch v2 + v3 safe) ─────────────────────────────── */

function extractSetCookies(response) {
  if (typeof response.headers.raw === "function") {
    return response.headers.raw()["set-cookie"] ?? [];
  }
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookies();
  }
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

/* ─── Routes ───────────────────────────────────────────────────────────────── */

app.get("/", (req, res) => res.send("Proxy running"));

app.get("/health", (req, res) =>
  res.status(200).json({ status: "ok", uptime: process.uptime() })
);

/* Groq passthrough */
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

/* Generic page fetch */
app.post("/fetch", async (req, res) => {
  const { url, headers: customHeaders = {} } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  const ALLOWED_DOMAINS = ["amazon.in", "flipkart.com"];
  if (!ALLOWED_DOMAINS.some((domain) => url.includes(domain))) {
    return res.status(403).json({ error: "Domain not allowed" });
  }

  const ua = customHeaders["User-Agent"] ?? randomUA();

  // Build sensible per-domain defaults
  const isAmazon = url.includes("amazon.in");
  const defaultReferer = isAmazon
    ? "https://www.google.com/"
    : "https://www.flipkart.com/";
  const defaultOrigin = isAmazon
    ? "https://www.amazon.in"
    : "https://www.flipkart.com";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": ua,
        "Accept-Language": "en-IN,en;q=0.9,hi;q=0.8",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        DNT: "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        Referer: defaultReferer,
        Origin: defaultOrigin,
        // Caller overrides come last (e.g. Cookie header from Flipkart session)
        ...customHeaders,
      },
      redirect: "follow",
    });

    const html = await response.text();
    const cookies = extractSetCookies(response);

    res.status(200).json({
      status: response.status,
      html,
      cookies,
    });
  } catch (err) {
    console.error("[/fetch] error:", err);
    res.status(500).json({ error: String(err) });
  }
});

app.listen(3000, () => console.log("Proxy server running on port 3000"));