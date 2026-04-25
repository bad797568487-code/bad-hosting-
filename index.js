const { Telegraf, Markup } = require('telegraf');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

// --- ⚙️ CONFIG ---
const TOKEN = '8640771765:AAF3EeSAQfZN0k2n46-ZRK8U5FC_IdQzXLs';
let ADMIN_IDS = [8338131451, 6576245378, 5971439265]; 
const bot = new Telegraf(TOKEN);

// Render Port Keep-alive (မအိပ်အောင်)
http.createServer((req, res) => {
    res.write("TITAN PUBLIC HOSTING ONLINE");
    res.end();
}).listen(process.env.PORT || 8080);

let activeBots = {}; // { fileName: process }
let waitingForAdminId = false;

// --- ⌨️ KEYBOARDS ---
const adminMenu = Markup.keyboard([
    ['📊 SERVER HEALTH', '➕ ADD ADMIN'],
    ['🛑 STOP ALL USERS', '📁 GET HOST CODE']
]).resize();

const userMenu = Markup.keyboard([
    ['🚀 MY BOTS STATUS', '🗑 DELETE MY BOT'],
    ['🛠 HOW TO HOST?', '📞 CONTACT ADMIN']
]).resize();

// --- 🤖 START ---
bot.start((ctx) => {
    const isInsideAdmin = ADMIN_IDS.includes(ctx.from.id);
    const welcomeMsg = isInsideAdmin 
        ? "👑 <b>TITAN ADMIN PANEL</b>\nဝန်ဆောင်မှုအားလုံးကို စီမံခန့်ခွဲနိုင်ပါပြီ သားကြီး။"
        : "🛠 <b>TITAN PUBLIC HOSTING</b>\n\nမင်းရဲ့ .js ဒါမှမဟုတ် .py ဖိုင်တွေကို ပို့ပြီး ၂၄ နာရီ Host လုပ်နိုင်ပါပြီ။";
    
    ctx.reply(welcomeMsg, { parse_mode: 'HTML', ...(isInsideAdmin ? adminMenu : userMenu) });
});

// --- 📥 FILE HOSTING LOGIC ---
bot.on('document', async (ctx) => {
    const userId = ctx.from.id;
    const file = ctx.message.document;
    const originalName = file.file_name;
    const fileName = `${userId}_${originalName}`; // User တစ်ယောက်ချင်းစီခွဲထားမယ်
    const fileLink = await ctx.telegram.getFileLink(file.file_id);

    if (!originalName.endsWith('.js') && !originalName.endsWith('.py')) {
        return ctx.reply("❌ .js သို့မဟုတ် .py ဖိုင်ပဲ တင်လို့ရပါတယ် သားကြီး။");
    }

    ctx.reply(`🚀 <b>${originalName}</b> ကို Deploy လုပ်နေပါတယ်။ ခဏစောင့်ပါ။`, { parse_mode: 'HTML' });

    try {
        const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        fs.writeFileSync(fileName, response.data);

        // အရင် Run နေတာရှိရင် အရင်သတ်မယ်
        if (activeBots[fileName]) {
            activeBots[fileName].kill();
            delete activeBots[fileName];
        }

        let cmd = originalName.endsWith('.js') ? 'node' : 'python';
        const child = spawn(cmd, [fileName]);

        activeBots[fileName] = child;

        child.on('error', (err) => {
            ctx.reply(`❌ Error: ${originalName} ကို Run လို့မရပါ။`);
            delete activeBots[fileName];
        });

        ctx.reply(`✅ <b>${originalName}</b> အောင်မြင်စွာ Online ရောက်သွားပါပြီ!`, { parse_mode: 'HTML' });
    } catch (e) {
        ctx.reply("❌ တစ်ခုခုမှားယွင်းနေပါတယ်။ နောက်မှ ပြန်ကြိုးစားပါ။");
    }
});

// --- 🚀 USER BUTTONS ---
bot.hears('🚀 MY BOTS STATUS', (ctx) => {
    const userId = ctx.from.id;
    let myBots = Object.keys(activeBots).filter(name => name.startsWith(`${userId}_`));
    
    if (myBots.length === 0) return ctx.reply("❌ မင်းမှာ Run ထားတဲ့ Bot မရှိသေးဘူး။");
    
    let msg = "📊 <b>သင့်ရဲ့ Active Bots:</b>\n\n";
    myBots.forEach(name => {
        msg += `• ${name.split('_')[1]} - 🟢 Running\n`;
    });
    ctx.reply(msg, { parse_mode: 'HTML' });
});

bot.hears('🗑 DELETE MY BOT', (ctx) => {
    const userId = ctx.from.id;
    let myBots = Object.keys(activeBots).filter(name => name.startsWith(`${userId}_`));
    
    myBots.forEach(name => {
        if (activeBots[name]) activeBots[name].kill();
        delete activeBots[name];
        if (fs.existsSync(name)) fs.unlinkSync(name);
    });
    ctx.reply("🗑 သင့်ရဲ့ Bot တွေအားလုံးကို ပိတ်ပြီး ဖျက်လိုက်ပါပြီ။");
});

// --- 👑 ADMIN BUTTONS ---
bot.hears('📊 SERVER HEALTH', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    const totalBots = Object.keys(activeBots).length;
    const memory = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    ctx.reply(`📊 <b>Server Status:</b>\n\nTotal Running Bots: ${totalBots}\nMemory Usage: ${memory} MB`, { parse_mode: 'HTML' });
});

bot.hears('➕ ADD ADMIN', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    waitingForAdminId = true;
    ctx.reply("👤 Admin လုပ်မယ့်သူရဲ့ <b>Telegram ID</b> ကို ပို့ပေးပါ သားကြီး။", { parse_mode: 'HTML' });
});

bot.hears('🛑 STOP ALL USERS', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    Object.keys(activeBots).forEach(name => {
        activeBots[name].kill();
        delete activeBots[name];
    });
    ctx.reply("🛑 All users' bots have been stopped!");
});

bot.hears('📁 GET HOST CODE', (ctx) => {
    if (!ADMIN_IDS.includes(ctx.from.id)) return;
    ctx.replyWithDocument({ source: './index.js' }).catch(() => ctx.reply("Error sending file."));
});

// Admin ID လက်ခံခြင်း Logic
bot.on('text', (ctx) => {
    if (waitingForAdminId && ADMIN_IDS.includes(ctx.from.id)) {
        let newId = parseInt(ctx.message.text);
        if (!isNaN(newId)) {
            ADMIN_IDS.push(newId);
            ctx.reply(`✅ Added Admin ID: <code>${newId}</code>`, { parse_mode: 'HTML' });
        } else {
            ctx.reply("❌ Invalid ID.");
        }
        waitingForAdminId = false;
        return;
    }
});

bot.launch();
console.log("Hosting Bot Started...");
                                         
