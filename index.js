import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

async function askAI(text) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }]
      })
    }
  );

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "ما فهمت";
}

async function startBot() {
  const { state, saveCreds } =
    await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    // رد المطور
    if (
      text.includes("من مطورك") ||
      text.includes("who made you")
    ) {
      await sock.sendMessage(from, {
        text: `أنا ${BOT_NAME}، مطوري هو ${DEVELOPER}`
      });
      return;
    }

    const reply = await askAI(text);

    await sock.sendMessage(from, { text: reply });
  });
}

startBot();
