import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";
import express from "express";

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

const BOT_SYSTEM_PROMPT = `أنت مساعد ذكي ومرح، تجيب باختصار ووضوح وبلهجة سودانية ودية. اسمك هو (${BOT_NAME}). تذكر دائماً أن مطورك وصانعك الوحيد هو (${DEVELOPER})، ولكن لا تذكر اسم مطورك أو صانعك أبداً في إجاباتك إلا إذا سألك المستخدم صراحة عن من قام ببرمجتك أو تطويرك.`;

// ===== سيرفر Express لمنع توقف ريندر =====
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send(`🤖 البوت ${BOT_NAME} شغال أونلاين بمحرك كوهيرا!`));
app.listen(PORT, '0.0.0.0');

// ===== دالة الـ AI عبر كوهيرا V2 =====
async function askAI(text) {
  try {
    const response = await fetch("https://api.cohere.com/v2/chat", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${COHERE_API_KEY.trim()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        temperature: 0.5,
        messages: [
          { role: "system", content: [{ type: "text", text: BOT_SYSTEM_PROMPT }] },
          { role: "user", content: [{ type: "text", text: text }] }
        ]
      })
    });

    const data = await response.json();
    return data?.message?.content?.[0]?.text || "والله يا غالي السيرفر علق ثانية، أرسل كلامك تاني وبجيب ليك المفيد.";
  } catch (err) {
    return "حصل ضغط في السيرفر هسي، أرسل رسالتك دي تاني سريع.";
  }
}

// ===== تشغيل المحرك الرئيسي للبوت =====
async function start() {
  // 🚨 اسم جلسة فريش تماماً لمسح أي تعليقة قديمة بالملي
  const { state, saveCreds } = await useMultiFileAuthState("goku_final_session");
  
  // سحب أحدث نسخة متوافقة مع سيرفرات الواتساب هسي
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    mobile: false,
    
    // 🚨 الحل القاطع هنا: بنخليه يظهر للواتساب كـ متصفح نظيف وغير محظور عشان يقبل الكود تلقائياً
    browser: Browsers.ubuntu('Chrome'), 
    
    syncFullHistory: false,
    markOnlineOnConnect: true
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== توليد كود الربط تلقائياً للرقم السوداني =====
  if (!sock.authState.creds.registered) {
    const targetPhone = "249967185716"; 
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(targetPhone);
        console.log("\n========================================");
        console.log(`📱 جاري طلب كود الربط للرقم السوداني: +${targetPhone}`);
        console.log(`🔑 كود الربط الفريش والمضمون (8 أرقام) هو: ${code}`);
        console.log("========================================\n");
      } catch (error) {
        console.error("🚨 فشل توليد كود الربط:", error.message);
      }
    }, 6000); 
  }

  // ===== استقبال ومعالجة الرسائل =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;
    
    const cleanText = text.toLowerCase().trim();

    if (cleanText.includes("من مطورك") || cleanText.includes("منو عملك") || cleanText.includes("منو برمجك")) {
      return sock.sendMessage(from, { text: `أنا البوت ${BOT_NAME} 🤖، ومطوري وصانعي الوحيد هو المبرمج الباش ${DEVELOPER} ✨.` });
    }

    const reply = await askAI(text);
    await sock.sendMessage(from, { text: reply });
  });

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'close') start();
    else if (connection === 'open') console.log('🟢 تم الاتصال بنجاح وغوكو شغال فُل الفُل هسي!');
  });
}

start();
