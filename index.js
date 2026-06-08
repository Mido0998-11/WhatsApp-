import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";
import express from "express";

const GEMINI_KEY = process.env.GEMINI_API_KEY;

const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

// التوجيه الذكي لجيميناي: يثبت اسم غوكو وما يتكلم عن المطور إلا لو اتسأل عنه مباشرة
const SYSTEM_INSTRUCTION = `أنت مساعد ذكي ومرح، تجيب باختصار ووضوح وبلهجة سودانية ودية. اسمك هو (${BOT_NAME}). تذكر دائماً أن مطورك وصانعك الوحيد هو (${DEVELOPER})، ولكن لا تذكر اسم مطورك أبداً في إجاباتك إلا إذا سألك المستخدم صراحة عن من قام ببرمجتك أو تطويرك.`;

// ===== سـيرفر Express عشان منصة Render ما تقفل المشـروع =====
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send(`🤖 البوت ${BOT_NAME} شغال أونلاين ومستقر على ريندر!`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Express server is running on port ${PORT}`);
});

// ===== دالة الـ AI (Gemini) =====
async function askAI(text) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${SYSTEM_INSTRUCTION}\n\nالمستخدم يقول: ${text}` }] }]
        })
      }
    );

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "ما فهمت والله، أرسل تاني.";
  } catch (err) {
    console.error("🚨 خطأ في جيميناي:", err.message);
    return "عذراً، حصل ضغط في السيرفر هسي.";
  }
}

// ===== تشغيل الواتساب =====
async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: "silent" }),
    mobile: false
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== توليد كود الربط تلقائياً للرقم المطلوب =====
  if (!sock.authState.creds.registered) {
    // الرقم المكتوب بدون فراغات أو علامة +
    const targetPhone = "584167776891"; 
    
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(targetPhone);
        console.log("\n========================================");
        console.log(`📱 جاري طلب كود الربط للرقم: +${targetPhone}`);
        console.log(`🔑 كود الربط الخاص بك (8 أرقام) هو: ${code}`);
        console.log("========================================\n");
      } catch (error) {
        console.error("🚨 فشل في توليد كود الربط:", error.message);
      }
    }, 5000); // تأخير 5 ثواني عشان نضمن استقرار السيرفر والاتصال
  }

  // ===== استقبال ومعالجة الرسائل =====
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text;

    if (!text) return;

    const cleanText = text.toLowerCase().trim();

    // الرد المباشر لو زول سأل من المطور
    if (cleanText.includes("من مطورك") || cleanText.includes("منو عملك") || cleanText.includes("منو برمجك") || cleanText.includes("من مطور البوت")) {
      return sock.sendMessage(from, {
        text: `أنا البوت ${BOT_NAME} 🤖، ومطوري وصانعي الوحيد هو المبرمج ${DEVELOPER} ✨.`
      });
    }

    // بقية الرسايل تمشي لجيميناي
    const reply = await askAI(text);
    await sock.sendMessage(from, { text: reply });
  });
}

start();
