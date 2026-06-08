import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";
import express from "express";

// 🚨 صبينا مفتاح OpenRouter بتاعك هنا مباشرة عشان يشتغل طيران وبدون حظر الشبكة
const OPENROUTER_KEY = "Sk-or-v1-f128323d6e1dfc75de1bbc94abae2b3a2e06221981571e4a1d47f431cbcc27a0";
const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

const SYSTEM_INSTRUCTION = `أنت مساعد ذكي ومرح، تجيب باختصار ووضوح وبلهجة سودانية ودية. اسمك هو (${BOT_NAME}). تذكر دائماً أن مطورك وصانعك الوحيد هو (${DEVELOPER})، ولكن لا تذكر اسم مطورك أبداً في إجاباتك إلا إذا سألك المستخدم صراحة عن من قام ببرمجتك أو تطويرك.`;

// ===== سيرفر Express لمنع توقف ريندر =====
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send(`🤖 البوت ${BOT_NAME} لايف ومستقر!`));
app.listen(PORT, '0.0.0.0');

// ===== دالة الـ AI المعدلة عبر OpenRouter (مفتوحة ومضمونة في السودان) =====
async function askAI(text) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://render.com",
        "X-Title": "Goku WA Bot"
      },
      body: JSON.stringify({
        "model": "google/gemini-flash-1.5", // شغال بموديل جيميناي فلاش السريع جداً
        "messages": [
          { role: "system", content: SYSTEM_INSTRUCTION },
          { role: "user", content: text }
        ],
        "temperature": 0.6
      })
    });

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "والله ما فهمتك، أرسل تاني يا غالي.";
  } catch (err) {
    console.error("🚨 خطأ في الاتصال بـ OpenRouter:", err.message);
    return "حصل ضغط في السيرفر هسي، أرسل رسالتك تاني سريع.";
  }
}

// ===== تشغيل المحرك الرئيسي =====
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    mobile: false,
    browser: Browsers.ubuntu('Chrome'), 
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== توليد كود الربط تلقائياً لو الجلسة طارت =====
  if (!sock.authState.creds.registered) {
    const targetPhone = "249967185716"; 
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(targetPhone);
        console.log("\n========================================");
        console.log(`🔑 كود الربط للرقم الجديد (+${targetPhone}) هو: ${code}`);
        console.log("========================================\n");
      } catch (error) {
        console.error("🚨 فشل توليد كود الربط:", error.message);
      }
    }, 5000);
  }

  // ===== استقبال ومعالجة الرسائل =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;
    
    const cleanText = text.toLowerCase().trim();

    // فحص يدوي وسريع لو سأل عن المطور
    if (cleanText.includes("من مطورك") || cleanText.includes("منو عملك") || cleanText.includes("منو برمجك") || cleanText.includes("من مطور البوت")) {
      return sock.sendMessage(from, { text: `أنا البوت ${BOT_NAME} 🤖، ومطوري وصانعي الوحيد هو المبرمج الباش ${DEVELOPER} ✨.` });
    }

    // تمجيد الرسايل عبر السيرفر المفتوح
    const reply = await askAI(text);
    await sock.sendMessage(from, { text: reply });
  });

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'close') start();
    else if (connection === 'open') console.log('🟢 تم الربط بنجاح والبوت شغال أونلاين ومستقر هسي!');
  });
}

start();
