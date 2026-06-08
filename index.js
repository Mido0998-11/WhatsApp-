import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ===== ENV =====
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ===== GEMINI =====
async function askAI(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text }]
          }
        ]
      })
    }
  );

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "ما قدرت أرد";
}

// ===== SEND MESSAGE =====
async function sendMessage(to, text) {
  await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      })
    }
  );
}

// ===== WEBHOOK =====
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ===== RECEIVE =====
app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const message = value?.messages?.[0];

  if (!message) return;

  const from = message.from;
  const text = message.text?.body;

  if (!text) return;

  const reply = await askAI(text);

  await sendMessage(from, reply);
});

// ===== START =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot running...");
});
