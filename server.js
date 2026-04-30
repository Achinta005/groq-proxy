import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

/**
 * Basic health (fast, no external calls)
 */
app.get("/", (req, res) => {
  res.send("Groq proxy running");
});

/**
 * Health endpoint (with Groq check)
 */
app.get("/health", async (req, res) => {
  try {
    const start = Date.now();

    // lightweight test request to Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1
      })
    });

    const latency = Date.now() - start;

    if (!response.ok) {
      return res.status(500).json({
        status: "unhealthy",
        groq: "error",
        latencyMs: latency,
        message: `Groq returned ${response.status}`
      });
    }

    return res.json({
      status: "ok",
      groq: "reachable",
      latencyMs: latency,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({
      status: "unhealthy",
      groq: "down",
      error: String(err),
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Main proxy route
 */
app.post("/groq", async (req, res) => {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(req.body)
    });

    const text = await response.text();
    res.status(response.status).send(text);

  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});