import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers
} from "@whiskeysockets/baileys";

import P from "pino";
import fetch from "node-fetch";
import express from "express";
import fs from "fs";

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const BOT_NAME = "غوكو";
const DEVELOPER = "محمد عادل ويزي";

// توجيهات الذكاء الاصطناعي الصارمة والنظيفة
const SYSTEM_INSTRUCTION = `أنت مساعد ذكي ومرح، تجيب باختصار ووضوح وبلهجة سودانية ودية. اسمك هو (${BOT_NAME}). تذكر دائماً أن مطورك وصانعك الوحيد هو (${DEVELOPER})، ولكن لا تذكر اسم مطورك أبداً في إجاباتك إلا إذا سألك المستخدم صراحة عن من قام ببرمجتك أو تطويرك.`;

// ===== سيرفر Express لمنع توقف ريندر =====
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send(`🤖 البوت ${BOT_NAME} لايف ومقفل صم!`));
app.listen(PORT, '0.0.0.0');

// ===== دالة الـ AI المعدلة والمضمونة 100% =====
async function askAI(text) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // الصياغة الرسمية الصحيحة لفصل التعليمات عن رسالة المستخدم
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          contents: [{ 
            role: "user",
            parts: [{ text: text }] 
          }],
          generationConfig: {
            temperature: 0.6,
            topK: 40,
            topP: 0.95
          }
        })
      }
    );

    const data = await res.json();
    
    // فحص دقيق للاستجابة قبل ما يضرب
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    } else if (data?.promptFeedback?.blockReason) {
        return "الغالي، الكلام دا حساس شوية وسيرفرات جيميناي حظرته، أرسل غيره بجيك طيارة! 😉";
    }
    
    return "والله يا غالي السيرفر علق ثانية، أرسل كلامك تاني وبجيب ليك المفيد.";
  } catch (err) {
    console.error("🚨 خطأ في جيميناي:", err.message);
    return "حصل ضغط في السيرفر هسي، أرسل رسالتك دي تاني سريع.";
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

  // ===== توليد كود الربط تلقائياً =====
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

    // فحص يدوي وسريع لو سأل عن المطور قبل ما نمشي للـ AI
    if (cleanText.includes("من مطورك") || cleanText.includes("منو عملك") || cleanText.includes("منو برمجك") || cleanText.includes("من مطور البوت")) {
      return sock.sendMessage(from, { text: `أنا البوت ${BOT_NAME} 🤖، ومطوري وصانعي الوحيد هو المبرمج الباش ${DEVELOPER} ✨.` });
    }

    // بقية الونسة بتمشي للذكاء الاصطناعي النظيف هسي
    const reply = await askAI(text);
    await sock.sendMessage(from, { text: reply });
  });

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'close') start();
    else if (connection === 'open') console.log('🟢 تم الربط بنجاح والبوت شغال فُل الفُل هسي!');
  });
}

start();
