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

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now()
  });
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