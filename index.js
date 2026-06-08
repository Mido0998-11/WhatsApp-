import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";
import express from "express";

// سحب مفتاح كوهيرا من البيئة جوة ريندر
const COHERE_API_KEY = process.env.COHERE_API_KEY;
const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

// التوجيه الصارم لنموذج كوهيرا باللهجة السودانية
const BOT_SYSTEM_PROMPT = `أنت مساعد ذكي ومرح، تجيب باختصار ووضوح وبلهجة سودانية ودية. اسمك هو (${BOT_NAME}). تذكر دائماً أن مطورك وصانعك الوحيد هو (${DEVELOPER})، ولكن لا تذكر اسم مطورك أو صانعك أبداً في إجاباتك إلا إذا سألك المستخدم صراحة عن من قام ببرمجتك أو تطويرك.`;

// ===== سيرفر Express لمنع توقف ريندر =====
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send(`🤖 البوت ${BOT_NAME} شغال بمحرك Cohere واونلاين!`));
app.listen(PORT, '0.0.0.0');

// ===== دالة الـ AI عبر محرك ورابط كوهيرا الرسمي =====
async function askAI(text) {
  try {
    const response = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "command-a-03-2025", // الموديل الممتاز والسريع
        temperature: 0.5,
        messages: [
          { role: "system", content: [{ type: "text", text: BOT_SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "text", text: text }] }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Cohere API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data?.message?.content?.[0]?.text || "عذراً يا غالي، ما قدرت أحلل الكلام ده هسي.";
  } catch (err) {
    console.error("🚨 خطأ في محرك كوهيرا:", err.message);
    return "والله السيرفر علق ثانية، أرسل رسالتك دي تاني سريع وبجيب ليك المفيد.";
  }
}

// ===== تشغيل المحرك الرئيسي للبوت =====
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

  // ===== توليد كود الربط تلقائياً للرقم السوداني لو الجلسة فصلت =====
  if (!sock.authState.creds.registered) {
    const targetPhone = "249967185716"; 
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(targetPhone);
        console.log("\n========================================");
        console.log(`🔑 كود الربط للرقم (+${targetPhone}) هو: ${code}`);
        console.log("========================================\n");
      } catch (error) {
        console.error("🚨 فشل توليد كود الربط:", error.message);
      }
    }, 5000);
  }

  // ===== استقبال ومعالجة الرسائل جوة الواتساب =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;
    
    const cleanText = text.toLowerCase().trim();

    // الفحص اليدوي المباشر لأسئلة المطور لضمان سرعة الرد وثبات الشخصية
    if (cleanText.includes("من مطورك") || cleanText.includes("منو عملك") || cleanText.includes("منو برمجك") || cleanText.includes("من مطور البوت")) {
      return sock.sendMessage(from, { text: `أنا البوت ${BOT_NAME} 🤖، ومطوري وصانعي الوحيد هو الباشمهندس ${DEVELOPER} ✨.` });
    }

    // تمرير الونسة والأسئلة لمحرك كوهيرا
    const reply = await askAI(text);
    await sock.sendMessage(from, { text: reply });
  });

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'close') start();
    else if (connection === 'open') console.log('🟢 تم الاتصال بنجاح! غوكو شغال بمحرك كوهيرا هسي.');
  });
}

start();
