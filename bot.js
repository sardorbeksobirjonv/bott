const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// 📌 TOKEN va ADMINLAR
const TOKEN = "8301978711:AAGOF5F29XMyg8DAgan3VLePeizZCFfG4mU";
const ADMINS = [7752032178, 7919326758]; // 2 ta admin ID shu yerda

const bot = new TelegramBot(TOKEN, { polling: true });

// 📂 Fayllar
let movies = fs.existsSync("movies.json")
  ? JSON.parse(fs.readFileSync("movies.json"))
  : [];

let settings = fs.existsSync("settings.json")
  ? JSON.parse(fs.readFileSync("settings.json"))
  : { channels: [] };

// 📌 Saqlash funksiyalari
function saveMovies() {
  fs.writeFileSync("movies.json", JSON.stringify(movies, null, 2));
}
function saveSettings() {
  fs.writeFileSync("settings.json", JSON.stringify(settings, null, 2));
}

let tempData = {};
let users = new Set();

// ------------------ START ------------------
bot.onText(/\/start/, (msg) => {
  users.add(msg.from.id);

  if (settings.channels.length > 0) {
    let links = settings.channels.map((c) => `➡️ [${c}](${c})`).join("\n");
    bot.sendMessage(
      msg.chat.id,
      `👋 Salom!\n🎬 Kino olish uchun kod yuboring.\n\n📢 Avval quyidagi kanallarga a'zo bo‘ling:\n${links}\n\n✅ Keyin kod yuboring.`,
      { parse_mode: "Markdown" }
    );
  } else {
    bot.sendMessage(
      msg.chat.id,
      "👋 Salom!\n🎬 Kino olish uchun kod yuboring.\n\n🔑 Yoki admin kod yuborsa kino chiqadi."
    );
  }
});

// ------------------ KINO YUKLASH ------------------
bot.on("video", (msg) => {
  if (!ADMINS.includes(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Faqat admin kino yuklay oladi!");
  }

  tempData[msg.chat.id] = { fileId: msg.video.file_id };
  bot.sendMessage(msg.chat.id, "✅ Kino qabul qilindi.\nEndi unga kod yuboring 🔑");
});

// ------------------ UMUMIY MATN XABARLAR ------------------
bot.on("text", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (msg.chat.type !== "private") return;

  const isAdmin = ADMINS.includes(msg.from.id);

  // --- ADMIN PANEL BUYRUQLAR ---
  if (isAdmin) {
    if (text === "🎞 Kinolar ro'yxati") {
      if (movies.length === 0) {
        return bot.sendMessage(chatId, "📂 Hozircha kino yo‘q.");
      }
      let list = movies.map((m, i) => `${i + 1}. Kod: ${m.code}`).join("\n");
      return bot.sendMessage(chatId, "🎬 Kinolar ro'yxati:\n\n" + list);
    }

    if (text === "📢 Reklama yuborish") {
      tempData.reklama = true;
      return bot.sendMessage(chatId, "✍️ Reklama matnini yuboring:");
    }

    if (tempData.reklama && text && !text.startsWith("/")) {
      users.forEach((id) => {
        bot.sendMessage(id, "📢 Reklama:\n\n" + text);
      });
      bot.sendMessage(chatId, "✅ Reklama yuborildi!");
      delete tempData.reklama;
      return;
    }

    if (text === "👥 Foydalanuvchilar soni") {
      return bot.sendMessage(chatId, "👥 Foydalanuvchilar soni: " + users.size);
    }

    if (text === "➕ Kanal ulash") {
      tempData.addChannel = true;
      return bot.sendMessage(chatId, "🔗 Kanal linkini yuboring (masalan: @kanal):");
    }
    if (tempData.addChannel && text.startsWith("@")) {
      settings.channels.push(text);
      saveSettings();
      delete tempData.addChannel;
      return bot.sendMessage(
        chatId,
        `✅ Kanal ulandi:\n${text}\n\n📢 Endi foydalanuvchilar shu kanalda bo‘lishi majburiy!`
      );
    }

    if (text === "➖ Kanal uzish") {
      if (settings.channels.length === 0) {
        return bot.sendMessage(chatId, "📂 Hozircha kanal ulanmagan.");
      }
      let list = settings.channels.map((c, i) => `${i + 1}. ${c}`).join("\n");
      tempData.removeChannel = true;
      return bot.sendMessage(
        chatId,
        `❌ Qaysi kanalni uzmoqchisiz? Raqamini yuboring:\n\n${list}`
      );
    }
    if (tempData.removeChannel && !isNaN(text)) {
      let index = parseInt(text) - 1;
      if (settings.channels[index]) {
        let removed = settings.channels.splice(index, 1);
        saveSettings();
        bot.sendMessage(chatId, `❌ Kanal uzildi:\n${removed[0]}`);
      } else {
        bot.sendMessage(chatId, "⚠️ Noto‘g‘ri raqam!");
      }
      delete tempData.removeChannel;
      return;
    }

    if (text === "❌ Chiqish") {
      return bot.sendMessage(chatId, "✅ Admin panel yopildi", {
        reply_markup: { remove_keyboard: true },
      });
    }
  }

  // --- ADMIN KINO KOD QO‘SHYAPTI ---
  if (tempData[chatId] && tempData[chatId].fileId) {
    movies.push({ fileId: tempData[chatId].fileId, code: text });
    saveMovies();
    bot.sendMessage(chatId, `🎉 Kino saqlandi!\n🔑 Kod: *${text}*`, {
      parse_mode: "Markdown",
    });
    delete tempData[chatId];
    return;
  }

  // --- USER KINO KOD YUBORADI ---
  if (settings.channels.length > 0) {
    for (let c of settings.channels) {
      try {
        let member = await bot.getChatMember(c, msg.from.id);
        if (!["member", "administrator", "creator"].includes(member.status)) {
          return bot.sendMessage(
            chatId,
            `📢 Siz avval kanalga a'zo bo‘lishingiz kerak:\n➡️ ${c}`
          );
        }
      } catch (e) {
        return bot.sendMessage(
          chatId,
          `❌ Bot kanalga admin qilinmagan yoki kanal topilmadi: ${c}`
        );
      }
    }
  }

  const movie = movies.find((m) => m.code === text);
  if (movie) {
    return bot.sendVideo(chatId, movie.fileId, {
      caption: "🎬 Marhamat, siz so‘ragan kino!",
    });
  } else {
    return bot.sendMessage(
      chatId,
      "⚠️ Siz yuborgan kod bo‘yicha kino topilmadi.\nIltimos boshqa kod yuboring 🔑"
    );
  }
});

// ------------------ ADMIN PANEL BUYRUQLARI ------------------
bot.onText(/\/admin/, (msg) => {
  if (!ADMINS.includes(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ Siz admin emassiz!");
  }

  bot.sendMessage(msg.chat.id, "📋 Admin panel:", {
    reply_markup: {
      keyboard: [
        ["🎞 Kinolar ro'yxati"],
        ["📢 Reklama yuborish"],
        ["👥 Foydalanuvchilar soni"],
        ["➕ Kanal ulash", "➖ Kanal uzish"],
        ["❌ Chiqish"],
      ],
      resize_keyboard: true,
    },
  });
});
