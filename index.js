import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";
import readline from "readline";

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

// ===== AI =====
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

// ===== Pairing Code Input =====
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askNumber(question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" })
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== لو ما مربوط، اطلب رقم =====
  if (!sock.authState.creds.registered) {
    const phone = await askNumber("📱 اكتب رقمك مع كود الدولة: ");
    const code = await sock.requestPairingCode(phone);

    console.log("🔑 كود الربط (8 أرقام):", code);
  }

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    // المطور
    if (text.includes("من مطورك")) {
      return sock.sendMessage(from, {
        text: `أنا ${BOT_NAME}، مطوري هو ${DEVELOPER}`
      });
    }

    const reply = await askAI(text);

    await sock.sendMessage(from, { text: reply });
  });
}

start();
